import { Request, Response, NextFunction } from "express";
import { CanalContacto, EstadoChat } from "@prisma/client";
import * as whatsappService from "../services/whatsapp.service";
import prisma from "../lib/prisma";
import { isValidUUID, isValidEnum } from "../lib/validators";

// Express query params come as string | string[] | ParsedQs — take first string
function qs(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && typeof val[0] === "string") return val[0];
  return undefined;
}

// Express 5 types req.params values as string | string[] — params are always strings at runtime
function p(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

function parsePage(val: unknown): number {
  const n = parseInt(qs(val) ?? "1", 10);
  return isNaN(n) || n < 1 ? 1 : n;
}

function parseLimit(val: unknown): number {
  const n = parseInt(qs(val) ?? "20", 10);
  return isNaN(n) || n < 1 ? 20 : Math.min(n, 100);
}

const CANALES_VALIDOS: CanalContacto[] = ["whatsapp", "messenger", "telegram", "otro"];
const ESTADOS_CHAT_VALIDOS: EstadoChat[] = ["open", "resolved", "pending"];

// ─────────────────────────────────────────────────────────────
// SESSION
// ─────────────────────────────────────────────────────────────

// GET /api/whatsapp/status
export async function getStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const status = whatsappService.getStatus(empresaId);
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
}

// POST /api/whatsapp/connect
export async function connect(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    await whatsappService.initClient(empresaId);
    res.status(202).json({
      message: "Inicialización en proceso. Consulta GET /api/whatsapp/status para el QR.",
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/whatsapp/connect
export async function disconnect(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    await whatsappService.destroyClient(empresaId);
    res.status(200).json({ message: "Sesión de WhatsApp cerrada." });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// DIRECT MESSAGE
// ─────────────────────────────────────────────────────────────

// POST /api/whatsapp/messages
export async function sendDirectMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const { to, message } = req.body as { to?: string; message?: string };

    if (!to || !message) {
      res.status(400).json({ message: "Los campos 'to' y 'message' son requeridos." });
      return;
    }

    await whatsappService.sendMessage(empresaId, to, message);
    res.status(200).json({ message: "Mensaje enviado." });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// CHATS
// ─────────────────────────────────────────────────────────────

// GET /api/whatsapp/chats
export async function listChats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const estadoVal = qs(req.query.estado);
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);

    if (estadoVal && !isValidEnum(estadoVal, ESTADOS_CHAT_VALIDOS)) {
      res.status(400).json({ message: "estado inválido. Valores: open, resolved, pending" });
      return;
    }

    const where = {
      empresa_id: empresaId,
      ...(estadoVal ? { estado: estadoVal as EstadoChat } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.chat.findMany({
        where,
        include: { contacto: true },
        orderBy: { ultima_actividad: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.chat.count({ where }),
    ]);

    res.status(200).json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// GET /api/whatsapp/chats/:id
export async function getChat(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);

    if (!isValidUUID(id)) {
      res.status(400).json({ message: "ID de chat inválido." });
      return;
    }

    const chat = await prisma.chat.findFirst({
      where: { id, empresa_id: empresaId },
      include: {
        contacto: true,
        mensajes: { orderBy: { created_at: "asc" } },
      },
    });

    if (!chat) {
      res.status(404).json({ message: "Chat no encontrado." });
      return;
    }

    // Mark unread user messages as read
    await prisma.chatMensaje.updateMany({
      where: { chat_id: id, leido: false, remitente: "user" },
      data: { leido: true },
    });

    res.status(200).json(chat);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/whatsapp/chats/:id/status
export async function updateChatStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);
    const { estado } = req.body as { estado?: string };

    if (!isValidUUID(id)) {
      res.status(400).json({ message: "ID de chat inválido." });
      return;
    }
    if (!estado || !isValidEnum(estado, ESTADOS_CHAT_VALIDOS)) {
      res.status(400).json({ message: "estado inválido. Valores: open, resolved, pending" });
      return;
    }

    const existing = await prisma.chat.findFirst({
      where: { id, empresa_id: empresaId },
    });
    if (!existing) {
      res.status(404).json({ message: "Chat no encontrado." });
      return;
    }

    const updated = await prisma.chat.update({
      where: { id },
      data: { estado: estado as EstadoChat },
    });

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

// POST /api/whatsapp/chats/:id/messages
export async function sendAgentMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);
    const { message } = req.body as { message?: string };

    if (!isValidUUID(id)) {
      res.status(400).json({ message: "ID de chat inválido." });
      return;
    }
    if (!message || message.trim() === "") {
      res.status(400).json({ message: "El campo 'message' es requerido." });
      return;
    }

    const chat = await prisma.chat.findFirst({
      where: { id, empresa_id: empresaId },
      include: { contacto: true },
    });
    if (!chat) {
      res.status(404).json({ message: "Chat no encontrado." });
      return;
    }

    // ── 1. Persist the message first (always, regardless of WA state) ──
    const saved = await prisma.chatMensaje.create({
      data: {
        chat_id: id,
        contenido: message.trim(),
        remitente: "agent",
        leido: true,
      },
    });

    await prisma.chat.update({
      where: { id },
      data: { ultima_actividad: new Date() },
    });

    // ── 2. Attempt WhatsApp delivery (non-fatal if session is down) ──
    let wa_sent = false;
    let wa_error: string | null = null;

    if (chat.contacto.telefono) {
      try {
        await whatsappService.sendMessage(
          empresaId,
          chat.contacto.telefono,
          message.trim()
        );
        wa_sent = true;
      } catch (err) {
        wa_error = err instanceof Error ? err.message : String(err);
        console.error("═══ WA SEND ERROR ═══");
        console.error("Telefono:", chat.contacto.telefono);
        console.error("Error completo:", err);
        console.error("═════════════════════");
      }
    } else {
      wa_error = "El contacto no tiene teléfono registrado.";
    }

    res.status(201).json({ ...saved, wa_sent, wa_error });
  } catch (err) {
    next(err);
  }
}


// ─────────────────────────────────────────────────────────────
// CONTACTS
// ─────────────────────────────────────────────────────────────

// GET /api/whatsapp/contacts
export async function listContacts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const canalVal = qs(req.query.canal);
    const page = parsePage(req.query.page);
    const limit = parseLimit(req.query.limit);

    if (canalVal && !isValidEnum(canalVal, CANALES_VALIDOS)) {
      res.status(400).json({ message: "canal inválido. Valores: whatsapp, messenger, telegram, otro" });
      return;
    }

    const where = {
      empresa_id: empresaId,
      activo: true,
      ...(canalVal ? { canal: canalVal as CanalContacto } : {}),
    };

    const [data, total] = await Promise.all([
      prisma.contacto.findMany({
        where,
        orderBy: { nombre: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contacto.count({ where }),
    ]);

    res.status(200).json({ data, total, page, limit });
  } catch (err) {
    next(err);
  }
}

// POST /api/whatsapp/contacts
export async function createContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const { nombre, telefono, email, canal } = req.body as {
      nombre?: string;
      telefono?: string;
      email?: string;
      canal?: string;
    };

    if (!nombre || nombre.trim() === "") {
      res.status(400).json({ message: "El campo 'nombre' es requerido." });
      return;
    }
    if (canal && !isValidEnum(canal, CANALES_VALIDOS)) {
      res.status(400).json({ message: "canal inválido. Valores: whatsapp, messenger, telegram, otro" });
      return;
    }

    const contact = await prisma.contacto.create({
      data: {
        empresa_id: empresaId,
        nombre: nombre.trim(),
        telefono: telefono?.trim() ?? null,
        email: email?.trim() ?? null,
        canal: (canal as CanalContacto) ?? "whatsapp",
      },
    });

    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/whatsapp/contacts/:id
export async function updateContact(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);
    const { nombre, telefono, email, canal, activo } = req.body as {
      nombre?: string;
      telefono?: string;
      email?: string;
      canal?: string;
      activo?: boolean;
    };

    if (!isValidUUID(id)) {
      res.status(400).json({ message: "ID de contacto inválido." });
      return;
    }
    if (canal && !isValidEnum(canal, CANALES_VALIDOS)) {
      res.status(400).json({ message: "canal inválido. Valores: whatsapp, messenger, telegram, otro" });
      return;
    }

    const existing = await prisma.contacto.findFirst({
      where: { id, empresa_id: empresaId },
    });
    if (!existing) {
      res.status(404).json({ message: "Contacto no encontrado." });
      return;
    }

    const updated = await prisma.contacto.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
        ...(telefono !== undefined ? { telefono: telefono.trim() } : {}),
        ...(email !== undefined ? { email: email.trim() } : {}),
        ...(canal !== undefined ? { canal: canal as CanalContacto } : {}),
        ...(activo !== undefined ? { activo } : {}),
      },
    });

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// FLOWS
// ─────────────────────────────────────────────────────────────

// GET /api/whatsapp/flows
export async function listFlows(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const flows = await prisma.flujoWebhook.findMany({
      where: { empresa_id: empresaId },
      include: {
        mensajes: { orderBy: { orden: "asc" } },
        opciones: { orderBy: { orden: "asc" } },
      },
      orderBy: { orden: "asc" },
    });
    res.status(200).json(flows);
  } catch (err) {
    next(err);
  }
}

// GET /api/whatsapp/flows/:id
export async function getFlow(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);

    if (!isValidUUID(id)) {
      res.status(400).json({ message: "ID de flujo inválido." });
      return;
    }

    const flow = await prisma.flujoWebhook.findFirst({
      where: { id, empresa_id: empresaId },
      include: {
        mensajes: { orderBy: { orden: "asc" } },
        opciones: { orderBy: { orden: "asc" } },
      },
    });

    if (!flow) {
      res.status(404).json({ message: "Flujo no encontrado." });
      return;
    }

    res.status(200).json(flow);
  } catch (err) {
    next(err);
  }
}

// POST /api/whatsapp/flows
export async function createFlow(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const { nombre, trigger_keys, activo, orden, mensajes, opciones } = req.body as {
      nombre?: string;
      trigger_keys?: string[];
      activo?: boolean;
      orden?: number;
      mensajes?: { contenido: string; orden?: number }[];
      opciones?: { trigger_key: string; etiqueta: string; siguiente_flujo?: string; orden?: number }[];
    };

    if (!nombre || nombre.trim() === "") {
      res.status(400).json({ message: "El campo 'nombre' es requerido." });
      return;
    }
    if (!Array.isArray(trigger_keys) || trigger_keys.length === 0) {
      res.status(400).json({ message: "Se requiere al menos un trigger_key." });
      return;
    }

    const flow = await prisma.flujoWebhook.create({
      data: {
        empresa_id: empresaId,
        nombre: nombre.trim(),
        trigger_keys: trigger_keys.map((k) => k.toLowerCase().trim()),
        activo: activo ?? true,
        orden: orden ?? 0,
        mensajes: mensajes
          ? {
              create: mensajes.map((m, i) => ({
                contenido: m.contenido,
                orden: m.orden ?? i,
              })),
            }
          : undefined,
        opciones: opciones
          ? {
              create: opciones.map((o, i) => ({
                trigger_key: o.trigger_key.toLowerCase().trim(),
                etiqueta: o.etiqueta,
                siguiente_flujo: o.siguiente_flujo ?? null,
                orden: o.orden ?? i,
              })),
            }
          : undefined,
      },
      include: {
        mensajes: { orderBy: { orden: "asc" } },
        opciones: { orderBy: { orden: "asc" } },
      },
    });

    res.status(201).json(flow);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/whatsapp/flows/:id
export async function updateFlow(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);
    const { nombre, trigger_keys, activo, orden } = req.body as {
      nombre?: string;
      trigger_keys?: string[];
      activo?: boolean;
      orden?: number;
    };

    if (!isValidUUID(id)) {
      res.status(400).json({ message: "ID de flujo inválido." });
      return;
    }

    const existing = await prisma.flujoWebhook.findFirst({
      where: { id, empresa_id: empresaId },
    });
    if (!existing) {
      res.status(404).json({ message: "Flujo no encontrado." });
      return;
    }

    const updated = await prisma.flujoWebhook.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
        ...(trigger_keys !== undefined
          ? { trigger_keys: trigger_keys.map((k) => k.toLowerCase().trim()) }
          : {}),
        ...(activo !== undefined ? { activo } : {}),
        ...(orden !== undefined ? { orden } : {}),
      },
      include: {
        mensajes: { orderBy: { orden: "asc" } },
        opciones: { orderBy: { orden: "asc" } },
      },
    });

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/whatsapp/flows/:id
export async function deleteFlow(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);

    if (!isValidUUID(id)) {
      res.status(400).json({ message: "ID de flujo inválido." });
      return;
    }

    const existing = await prisma.flujoWebhook.findFirst({
      where: { id, empresa_id: empresaId },
    });
    if (!existing) {
      res.status(404).json({ message: "Flujo no encontrado." });
      return;
    }

    await prisma.flujoWebhook.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Flow messages ──────────────────────────────────────────

// POST /api/whatsapp/flows/:id/messages
export async function addFlowMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);
    const { contenido, orden } = req.body as { contenido?: string; orden?: number };

    if (!isValidUUID(id)) {
      res.status(400).json({ message: "ID de flujo inválido." });
      return;
    }
    if (!contenido || contenido.trim() === "") {
      res.status(400).json({ message: "El campo 'contenido' es requerido." });
      return;
    }

    const flow = await prisma.flujoWebhook.findFirst({
      where: { id, empresa_id: empresaId },
    });
    if (!flow) {
      res.status(404).json({ message: "Flujo no encontrado." });
      return;
    }

    const msg = await prisma.flujoMensaje.create({
      data: {
        flujo_id: id,
        contenido: contenido.trim(),
        orden: orden ?? 0,
      },
    });

    res.status(201).json(msg);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/whatsapp/flows/:id/messages/:msgId
export async function removeFlowMessage(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);
    const msgId = p(req.params.msgId);

    const msgIdInt = parseInt(msgId, 10);
    if (!isValidUUID(id) || isNaN(msgIdInt)) {
      res.status(400).json({ message: "IDs inválidos." });
      return;
    }

    const flow = await prisma.flujoWebhook.findFirst({
      where: { id, empresa_id: empresaId },
    });
    if (!flow) {
      res.status(404).json({ message: "Flujo no encontrado." });
      return;
    }

    const msg = await prisma.flujoMensaje.findFirst({
      where: { id: msgIdInt, flujo_id: id },
    });
    if (!msg) {
      res.status(404).json({ message: "Mensaje no encontrado." });
      return;
    }

    await prisma.flujoMensaje.delete({ where: { id: msgIdInt } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ─── Flow options ───────────────────────────────────────────

// POST /api/whatsapp/flows/:id/options
export async function addFlowOption(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);
    const { trigger_key, etiqueta, siguiente_flujo, orden } = req.body as {
      trigger_key?: string;
      etiqueta?: string;
      siguiente_flujo?: string;
      orden?: number;
    };

    if (!isValidUUID(id)) {
      res.status(400).json({ message: "ID de flujo inválido." });
      return;
    }
    if (!trigger_key || !etiqueta) {
      res.status(400).json({ message: "Los campos 'trigger_key' y 'etiqueta' son requeridos." });
      return;
    }
    if (siguiente_flujo && !isValidUUID(siguiente_flujo)) {
      res.status(400).json({ message: "siguiente_flujo debe ser un UUID válido." });
      return;
    }

    const flow = await prisma.flujoWebhook.findFirst({
      where: { id, empresa_id: empresaId },
    });
    if (!flow) {
      res.status(404).json({ message: "Flujo no encontrado." });
      return;
    }

    const option = await prisma.flujoOpcion.create({
      data: {
        flujo_id: id,
        trigger_key: trigger_key.toLowerCase().trim(),
        etiqueta,
        siguiente_flujo: siguiente_flujo ?? null,
        orden: orden ?? 0,
      },
    });

    res.status(201).json(option);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/whatsapp/flows/:id/options/:optId
export async function removeFlowOption(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const id = p(req.params.id);
    const optId = p(req.params.optId);

    if (!isValidUUID(id) || !isValidUUID(optId)) {
      res.status(400).json({ message: "IDs inválidos." });
      return;
    }

    const flow = await prisma.flujoWebhook.findFirst({
      where: { id, empresa_id: empresaId },
    });
    if (!flow) {
      res.status(404).json({ message: "Flujo no encontrado." });
      return;
    }

    const option = await prisma.flujoOpcion.findFirst({
      where: { id: optId, flujo_id: id },
    });
    if (!option) {
      res.status(404).json({ message: "Opción no encontrada." });
      return;
    }

    await prisma.flujoOpcion.delete({ where: { id: optId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
