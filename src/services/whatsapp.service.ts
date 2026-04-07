import { Client, LocalAuth, Message } from "whatsapp-web.js";
import QRCode from "qrcode";
import prisma from "../lib/prisma";
import { logInfo, logWarn, logError } from "../lib/logger";

// ─── Session state ─────────────────────────────────────────────────────────
export type SessionState = "disconnected" | "qr_pending" | "loading" | "connected";

interface WhatsAppSession {
  client: Client;
  state: SessionState;
  qr: string | null;
  phone: string | null;
}

const sessions = new Map<string, WhatsAppSession>();

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize (or reconnect) the WhatsApp client for a given empresa.
 * LocalAuth persists the session to disk under .wwebjs_auth/<empresaId>/
 * so subsequent calls after the first scan are automatic.
 */
export async function initClient(empresaId: string): Promise<void> {
  const existing = sessions.get(empresaId);
  if (
    existing &&
    (existing.state === "connected" ||
      existing.state === "loading" ||
      existing.state === "qr_pending")
  ) {
    return; // Already running
  }

  const client = new Client({
    authStrategy: new LocalAuth({ clientId: empresaId }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    },
  });

  const session: WhatsAppSession = {
    client,
    state: "loading",
    qr: null,
    phone: null,
  };
  sessions.set(empresaId, session);

  client.on("qr", async (rawQr) => {
    session.state = "qr_pending";
    session.qr = await QRCode.toDataURL(rawQr);
    logInfo("whatsapp:qr_generated", { empresaId });
  });

  client.on("authenticated", () => {
    session.qr = null;
    logInfo("whatsapp:authenticated", { empresaId });
  });

  client.on("ready", () => {
    session.state = "connected";
    session.qr = null;
    session.phone = client.info?.wid?.user ?? null;
    logInfo("whatsapp:ready", { empresaId, phone: session.phone });
  });

  client.on("auth_failure", (msg) => {
    session.state = "disconnected";
    session.qr = null;
    logError("whatsapp:auth_failure", { empresaId, msg });
    sessions.delete(empresaId);
  });

  client.on("disconnected", (reason) => {
    session.state = "disconnected";
    session.qr = null;
    session.phone = null;
    logWarn("whatsapp:disconnected", { empresaId, reason });
    sessions.delete(empresaId);
  });

  client.on("message", async (msg: Message) => {
    if (msg.fromMe) return;
    handleIncomingMessage(empresaId, msg).catch((err) =>
      logError("whatsapp:message_handler_error", {
        empresaId,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  });

  // Initialize asynchronously — do not await so the HTTP response returns
  // immediately while puppeteer boots in the background.
  client.initialize().catch((err) => {
    logError("whatsapp:init_error", {
      empresaId,
      error: err instanceof Error ? err.message : String(err),
    });
    sessions.delete(empresaId);
  });
}

export function getStatus(empresaId: string): {
  state: SessionState;
  phone: string | null;
  qr: string | null;
} {
  const session = sessions.get(empresaId);
  if (!session) return { state: "disconnected", phone: null, qr: null };
  return { state: session.state, phone: session.phone, qr: session.qr };
}

export async function destroyClient(empresaId: string): Promise<void> {
  const session = sessions.get(empresaId);
  if (!session) return;
  await session.client.destroy();
  sessions.delete(empresaId);
  logInfo("whatsapp:session_destroyed", { empresaId });
}

export async function sendMessage(
  empresaId: string,
  to: string,
  text: string
): Promise<void> {
  const session = sessions.get(empresaId);
  if (!session || session.state !== "connected") {
    throw Object.assign(
      new Error("WhatsApp no está conectado para esta empresa"),
      { status: 503 }
    );
  }
  const chatId = to.includes("@c.us") ? to : `${to}@c.us`;
  await session.client.sendMessage(chatId, text);
}

// ─── Incoming message handler ───────────────────────────────────────────────

async function handleIncomingMessage(
  empresaId: string,
  msg: Message
): Promise<void> {
  const phone = (msg.from as string).replace("@c.us", "");
  const text = (msg.body ?? "").trim();

  // ── Upsert contact ──────────────────────────────────────────
  let contact = await prisma.contacto.findFirst({
    where: { empresa_id: empresaId, telefono: phone },
  });

  if (!contact) {
    const waContact = await msg.getContact().catch(() => null);
    contact = await prisma.contacto.create({
      data: {
        empresa_id: empresaId,
        nombre: waContact?.pushname || phone,
        telefono: phone,
        canal: "whatsapp",
      },
    });
  }

  // ── Find or open chat ───────────────────────────────────────
  let chat = await prisma.chat.findFirst({
    where: {
      empresa_id: empresaId,
      contacto_id: contact.id,
      estado: { not: "resolved" },
    },
  });

  if (!chat) {
    chat = await prisma.chat.create({
      data: {
        empresa_id: empresaId,
        contacto_id: contact.id,
        estado: "open",
        ultima_actividad: new Date(),
      },
    });
  } else {
    // Only update ultima_actividad — no_leidos/ultimo_mensaje are
    // maintained by the fn_sync_chat_stats() DB trigger.
    await prisma.chat.update({
      where: { id: chat.id },
      data: { ultima_actividad: new Date() },
    });
  }

  // ── Save incoming message ───────────────────────────────────
  await prisma.chatMensaje.create({
    data: {
      chat_id: chat.id,
      contenido: text,
      remitente: "user",
    },
  });

  // ── Run matching chatbot flow ───────────────────────────────
  await runFlow(empresaId, chat.id, phone, text);
}

// ─── Flow engine ────────────────────────────────────────────────────────────

async function runFlow(
  empresaId: string,
  chatId: string,
  phone: string,
  text: string
): Promise<void> {
  const session = sessions.get(empresaId);
  if (!session || session.state !== "connected") return;

  const key = text.toLowerCase();

  const flow = await prisma.flujoWebhook.findFirst({
    where: {
      empresa_id: empresaId,
      activo: true,
      trigger_keys: { has: key },
    },
    include: {
      mensajes: { orderBy: { orden: "asc" } },
      opciones: { orderBy: { orden: "asc" } },
    },
    orderBy: { orden: "asc" },
  });

  if (!flow) return;

  const waId = `${phone}@c.us`;

  // Send each flow message sequentially
  for (const flowMsg of flow.mensajes) {
    await session.client.sendMessage(waId, flowMsg.contenido);
    await prisma.chatMensaje.create({
      data: {
        chat_id: chatId,
        contenido: flowMsg.contenido,
        remitente: "bot",
        leido: true,
      },
    });
  }

  // If there are options, build and send a menu
  if (flow.opciones.length > 0) {
    const menu = flow.opciones
      .map((o) => `*${o.trigger_key}* - ${o.etiqueta}`)
      .join("\n");
    await session.client.sendMessage(waId, menu);
    await prisma.chatMensaje.create({
      data: {
        chat_id: chatId,
        contenido: menu,
        remitente: "bot",
        leido: true,
      },
    });
  }
}
