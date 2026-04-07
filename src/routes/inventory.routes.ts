import { Router } from "express";
import * as invController from "../controllers/inventory.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";
import { uploadImage } from "../middlewares/upload.middleware";

const router = Router();

router.use(authenticate);

// ── Categorías de inventario ────────────────────────────────
router.get(
  "/categories",
  authorize("gerente", "contador", "empleado"),
  invController.listCategories
);

// ── CRUD de items ───────────────────────────────────────────
// Lectura: todos los roles de empresa
router.get("/",    authorize("gerente", "contador", "empleado"), invController.list);
router.get("/:id", authorize("gerente", "contador", "empleado"), invController.getById);

// Escritura: gerente y empleado — uploadImage procesa multipart/form-data
router.post("/",     authorize("gerente", "empleado"), uploadImage, invController.create);
router.patch("/:id", authorize("gerente", "empleado"), uploadImage, invController.update);
router.delete("/:id", authorize("gerente", "empleado"), invController.remove);

// ── Operaciones de stock ────────────────────────────────────
router.patch("/:id/stock",   authorize("gerente", "empleado"), invController.adjustStock);
router.post("/:id/produce",  authorize("gerente", "empleado"), invController.produce);

// ── Kardex del item ─────────────────────────────────────────
router.get("/:id/kardex", authorize("gerente", "contador", "empleado"), invController.kardex);

export default router;
