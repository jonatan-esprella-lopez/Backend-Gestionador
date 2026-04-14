import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import * as ctrl from "../controllers/whatsapp.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Session (gerente + admin) ────────────────────────────────────────────
router.get("/status",     authorize("admin", "gerente"), ctrl.getStatus);
router.post("/connect",   authorize("admin", "gerente"), ctrl.connect);
router.delete("/connect", authorize("admin", "gerente"), ctrl.disconnect);

// ─── Direct message ───────────────────────────────────────────────────────
router.post("/messages", authorize("admin", "gerente"), ctrl.sendDirectMessage);

// ─── Chats ────────────────────────────────────────────────────────────────
router.get("/chats",              authorize("admin", "gerente", "contador", "empleado"), ctrl.listChats);
router.get("/chats/:id",          authorize("admin", "gerente", "contador", "empleado"), ctrl.getChat);
router.patch("/chats/:id/status", authorize("admin", "gerente", "contador"),             ctrl.updateChatStatus);
router.post("/chats/:id/messages", authorize("admin", "gerente", "contador", "empleado"), ctrl.sendAgentMessage);

// ─── Contacts ─────────────────────────────────────────────────────────────
router.get("/contacts",       authorize("admin", "gerente", "contador", "empleado"), ctrl.listContacts);
router.post("/contacts",      authorize("admin", "gerente", "empleado"),             ctrl.createContact);
router.patch("/contacts/:id", authorize("admin", "gerente", "empleado"),             ctrl.updateContact);

// ─── Flows ────────────────────────────────────────────────────────────────
router.get("/flows",      authorize("admin", "gerente"), ctrl.listFlows);
router.post("/flows",     authorize("admin", "gerente"), ctrl.createFlow);
router.get("/flows/:id",  authorize("admin", "gerente"), ctrl.getFlow);
router.patch("/flows/:id", authorize("admin", "gerente"), ctrl.updateFlow);
router.delete("/flows/:id", authorize("admin", "gerente"), ctrl.deleteFlow);

// Flow messages
router.post("/flows/:id/messages",          authorize("admin", "gerente"), ctrl.addFlowMessage);
router.delete("/flows/:id/messages/:msgId", authorize("admin", "gerente"), ctrl.removeFlowMessage);

// Flow options
router.post("/flows/:id/options",          authorize("admin", "gerente"), ctrl.addFlowOption);
router.delete("/flows/:id/options/:optId", authorize("admin", "gerente"), ctrl.removeFlowOption);

export default router;
