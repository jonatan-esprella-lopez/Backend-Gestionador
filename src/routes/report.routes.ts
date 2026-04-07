import { Router } from "express";
import * as reportController from "../controllers/report.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

// KPIs y finanzas: gerente y contador
router.get("/summary",     authorize("gerente", "contador"), reportController.summary);
router.get("/cashflow",    authorize("gerente", "contador"), reportController.cashflow);
router.get("/by-category", authorize("gerente", "contador"), reportController.byCategory);

// Valoración de inventario: gerente, contador y empleado
router.get("/inventory-valuation", authorize("gerente", "contador", "empleado"), reportController.inventoryValuation);

export default router;
