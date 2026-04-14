import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/ledger.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// ── Schemas ───────────────────────────────────────────────────

const mayorQuerySchema = z.object({
  cuenta_id: z.string().uuid(),
  desde:     z.string().date().optional(),
  hasta:     z.string().date().optional(),
  page:      z.coerce.number().int().positive().optional(),
  pageSize:  z.coerce.number().int().positive().max(500).optional(),
});

const fechaQuerySchema = z.object({
  fecha: z.string().date().optional(),
});

const periodoQuerySchema = z.object({
  desde: z.string().date().optional(),
  hasta: z.string().date().optional(),
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

// Libro Mayor — movimientos de una cuenta con saldo acumulado
router.get("/",                 validate(mayorQuerySchema),  ctrl.libroMayor);

// Balance de Comprobación
router.get("/trial-balance",    validate(fechaQuerySchema),  ctrl.balanceComprobacion);

// Balance General (Hoja de Balance)
router.get("/balance-sheet",    validate(fechaQuerySchema),  ctrl.balanceGeneral);

// Estado de Resultados
router.get("/income-statement", validate(periodoQuerySchema), ctrl.estadoResultados);

export default router;
