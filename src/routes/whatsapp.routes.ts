import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import * as ctrl from "../controllers/whatsapp.controller";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Session (gerente only) ────────────────────────────────────────────────
router.get("/status",     authorize("gerente"), ctrl.getStatus);
router.post("/connect",   authorize("gerente"), ctrl.connect);
router.delete("/connect", authorize("gerente"), ctrl.disconnect);

// ─── Direct message (gerente only) ────────────────────────────────────────
router.post("/messages", authorize("gerente"), ctrl.sendDirectMessage);

// ─── Chats ────────────────────────────────────────────────────────────────
router.get("/chats",             authorize("gerente", "contador", "empleado"), ctrl.listChats);
router.get("/chats/:id",         authorize("gerente", "contador", "empleado"), ctrl.getChat);
router.patch("/chats/:id/status", authorize("gerente", "contador"),            ctrl.updateChatStatus);
router.post("/chats/:id/messages", authorize("gerente", "contador", "empleado"), ctrl.sendAgentMessage);

// ─── Contacts ─────────────────────────────────────────────────────────────
router.get("/contacts",     authorize("gerente", "contador", "empleado"), ctrl.listContacts);
router.post("/contacts",    authorize("gerente", "empleado"),             ctrl.createContact);
router.patch("/contacts/:id", authorize("gerente", "empleado"),           ctrl.updateContact);

// ─── Flows ────────────────────────────────────────────────────────────────
router.get("/flows",     authorize("gerente"), ctrl.listFlows);
router.post("/flows",    authorize("gerente"), ctrl.createFlow);
router.get("/flows/:id", authorize("gerente"), ctrl.getFlow);
router.patch("/flows/:id", authorize("gerente"), ctrl.updateFlow);
router.delete("/flows/:id", authorize("gerente"), ctrl.deleteFlow);

// Flow messages
router.post("/flows/:id/messages",          authorize("gerente"), ctrl.addFlowMessage);
router.delete("/flows/:id/messages/:msgId", authorize("gerente"), ctrl.removeFlowMessage);

// Flow options
router.post("/flows/:id/options",          authorize("gerente"), ctrl.addFlowOption);
router.delete("/flows/:id/options/:optId", authorize("gerente"), ctrl.removeFlowOption);

export default router;
