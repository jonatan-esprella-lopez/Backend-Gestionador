import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { authLimiter } from "../middlewares/rate-limit.middleware";

const router = Router();

// Rutas públicas
router.post("/register", authLimiter, authController.register);
router.post("/login",    authLimiter, authController.login);
router.post("/refresh",  authController.refresh);
router.post("/logout",   authController.logout);

// Ruta protegida — devuelve el usuario del token sin tocar la BD
router.get("/me", authenticate, authController.me);

export default router;
