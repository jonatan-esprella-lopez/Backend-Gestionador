import { Client, LocalAuth, Message } from "whatsapp-web.js";
import QRCode from "qrcode";
import { existsSync, readdirSync } from "fs";
import path from "path";
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

function normalizePhone(phone: string): string {
  // Remove all non-numeric chars except '+'
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  
  // If it's exactly 8 digits (typical local Bolivian), auto-add 591
  if (p.length === 8) return `591${p}`;
  return p;
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
  
  let validPhone = to;
  // Solo aplicamos normalización a números limpios (que no son grupos ni lids)
  if (!to.includes("@g.us") && !to.includes("@lid")) {
    // Quitamos @c.us por si acaso antes de limpiar
    validPhone = normalizePhone(to.replace("@c.us", ""));
  }
  
  // Si ya trae el dominio (@lid, @g.us u otro), lo usamos. De lo contrario, asumimos que es número personal y añadimos @c.us
  const chatId = validPhone.includes("@") ? validPhone : `${validPhone}@c.us`;
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

async function dispatchFlow(
  session: WhatsAppSession,
  empresaId: string,
  chatId: string,
  phone: string,
  flujoId: string
) {
  // Obtener el flujo con sus componentes
  const flow = await prisma.flujoWebhook.findUnique({
    where: { id: flujoId },
    include: {
      mensajes: { orderBy: { orden: "asc" } },
      opciones: { orderBy: { orden: "asc" } },
    },
  });

  if (!flow || !flow.activo) return;

  // Actualizar el estado del Chat para "atrapar" al usuario en este flujo
  await prisma.chat.update({
    where: { id: chatId },
    data: { flujo_activo_id: flow.id },
  });

  const validPhone = (!phone.includes("@g.us") && !phone.includes("@lid")) ? normalizePhone(phone.replace("@c.us", "")) : phone;
  const waId = validPhone.includes("@") ? validPhone : `${validPhone}@c.us`;

  // Enviar cada mensaje
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
    await new Promise(r => setTimeout(r, 500)); // Delay natural
  }

  // Si hay opciones, agrupar y enviar como menú
  if (flow.opciones.length > 0) {
    const menu = flow.opciones.map(o => `${o.trigger_key}. ${o.etiqueta}`).join("\n");
    await session.client.sendMessage(waId, menu);
    await prisma.chatMensaje.create({
      data: {
        chat_id: chatId,
        contenido: menu,
        remitente: "bot",
        leido: true,
      },
    });
  } else {
    // Si NO hay opciones interactivas, significa que el hilo de conversación terminó
    // Liberamos la sesión (flujo_activo_id = null)
    await prisma.chat.update({
      where: { id: chatId },
      data: { flujo_activo_id: null },
    });
  }
}

async function runFlow(
  empresaId: string,
  chatId: string,
  phone: string,
  text: string
): Promise<void> {
  const session = sessions.get(empresaId);
  if (!session || session.state !== "connected") return;

  // Paso 1: Normalización
  const key = text.trim().toLowerCase();

  // Paso 2: Comportamiento por Estado Activo (Contexto)
  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (chat?.flujo_activo_id) {
    const activeFlow = await prisma.flujoWebhook.findUnique({
      where: { id: chat.flujo_activo_id },
      include: { opciones: true },
    });

    if (activeFlow && activeFlow.opciones.length > 0) {
      // Buscar si digitó una opción válida
      const opt = activeFlow.opciones.find(o => o.trigger_key.toLowerCase() === key);
      
      if (opt && opt.siguiente_flujo) {
        // Encontró opción y salta de flujo
        await dispatchFlow(session, empresaId, chatId, phone, opt.siguiente_flujo);
        return; 
      } else if (opt && !opt.siguiente_flujo) {
        // Encontró opción pero es la última hoja (sin siguiente flujo)
        await prisma.chat.update({
          where: { id: chatId },
          data: { flujo_activo_id: null },
        });
        return;
      }
      // Si la respuesta fue irrelevante, caerá al comportamiento global abajo
    }
  }

  // Paso 3: Comportamiento de Triggers Globales
  const globalFlow = await prisma.flujoWebhook.findFirst({
    where: {
      empresa_id: empresaId,
      activo: true,
      trigger_keys: { has: key },
    },
    orderBy: { orden: "asc" },
  });

  if (globalFlow) {
    await dispatchFlow(session, empresaId, chatId, phone, globalFlow.id);
  }
}
// ─── Auto-reconnect on server startup ──────────────────────────────────────────────────────────────────

/**
 * Scan .wwebjs_auth/ for persisted sessions and reconnect each empresa.
 * Called once on server startup so WA auto-reconnects after restarts.
 */
export async function reconnectPersistedSessions(): Promise<void> {
  const authDir = path.join(process.cwd(), ".wwebjs_auth");
  if (!existsSync(authDir)) {
    logInfo("whatsapp:no_persisted_sessions", { authDir });
    return;
  }

  const sessionDirs = readdirSync(authDir)
    .filter((name) => name.startsWith("session-"))
    .map((name) => name.replace("session-", ""));

  if (sessionDirs.length === 0) {
    logInfo("whatsapp:no_persisted_sessions", { authDir });
    return;
  }

  logInfo("whatsapp:reconnecting_sessions", { count: sessionDirs.length, empresas: sessionDirs });

  for (const empresaId of sessionDirs) {
    try {
      await initClient(empresaId);
    } catch (err) {
      logError("whatsapp:reconnect_error", {
        empresaId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
