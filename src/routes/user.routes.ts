import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// Todas las rutas requieren estar autenticado.
// admin (plataforma) y gerente (admin de empresa) pueden gestionar usuarios.
router.use(authenticate, authorize("admin", "gerente"));

router.get("/",     userController.list);
router.get("/:id",  userController.getById);
router.post("/",    userController.create);
router.patch("/:id", userController.update);
router.delete("/:id", userController.deactivate);

export default router;
