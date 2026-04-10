import { Router } from "express";
import * as txController from "../controllers/transaction.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Todas las rutas requieren autenticación y empresa
router.use(authenticate);

// ── Categorías y Resúmenes ─────────────────────────────────
// Todos los roles de empresa pueden ver las categorías disponibles
router.get("/categories", authorize("gerente", "contador", "empleado"), txController.listCategories);
router.get("/summary", authorize("gerente", "contador", "empleado"), txController.summary);

// ── Transacciones ──────────────────────────────────────────
// Lectura: todos los roles de empresa
router.get("/",    authorize("gerente", "contador", "empleado"), txController.list);
router.get("/:id", authorize("gerente", "contador", "empleado"), txController.getById);

// Escritura: gerente y contador
router.post("/",              authorize("gerente", "contador"), txController.create);
router.patch("/:id",          authorize("gerente", "contador"), txController.update);
router.patch("/:id/status",   authorize("gerente", "contador"), txController.updateStatus);
router.delete("/:id",         authorize("gerente", "contador"), txController.remove);

export default router;
