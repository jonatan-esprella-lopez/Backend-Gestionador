import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/subledger.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// ── Schemas ───────────────────────────────────────────────────

const contactoQuerySchema = z.object({
  contacto_id: z.string().uuid(),
  desde:       z.string().date().optional(),
  hasta:       z.string().date().optional(),
  page:        z.coerce.number().int().positive().optional(),
  pageSize:    z.coerce.number().int().positive().max(500).optional(),
});

const cuentaQuerySchema = z.object({
  cuenta_id: z.string().uuid(),
  desde:     z.string().date().optional(),
  hasta:     z.string().date().optional(),
  page:      z.coerce.number().int().positive().optional(),
  pageSize:  z.coerce.number().int().positive().max(500).optional(),
});

const periodoQuerySchema = z.object({
  desde:    z.string().date().optional(),
  hasta:    z.string().date().optional(),
  page:     z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({ error: "Parámetros inválidos", detalles: result.error.flatten() });
      return;
    }
    Object.assign(req.query, result.data);
    next();
  };
}

// ── Rutas ────────────────────────────────────────────────────

router.use(authenticate);
router.use(authorize("gerente", "contador"));

// Auxiliar por cliente/proveedor
router.get("/by-contact",      validate(contactoQuerySchema), ctrl.porContacto);

// Auxiliar por cuenta bancaria
router.get("/by-bank-account", validate(cuentaQuerySchema),   ctrl.porCuentaBancaria);

// Libro Diario (cronológico de asientos)
router.get("/journal",         validate(periodoQuerySchema),  ctrl.diario);

export default router;
