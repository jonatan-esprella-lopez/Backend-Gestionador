import { Router } from "express";
import * as bankController from "../controllers/bank-account.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

// Lectura: gerente y contador
router.get("/",    authorize("gerente", "contador"), bankController.list);
router.get("/:id", authorize("gerente", "contador"), bankController.getById);

// Escritura: solo gerente
router.post("/",    authorize("gerente"), bankController.create);
router.patch("/:id", authorize("gerente"), bankController.update);
router.delete("/:id", authorize("gerente"), bankController.remove);

export default router;
