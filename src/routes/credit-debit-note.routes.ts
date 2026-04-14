import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/credit-debit-note.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// ── Schemas ───────────────────────────────────────────────────

const crearNotaSchema = z.object({
  factura_id: z.string().uuid(),
  tipo:       z.enum(["credito", "debito"]),
  motivo:     z.string().min(3).max(300),
  monto:      z.number().positive().optional(),
  fecha:      z.coerce.date().optional(),
});

const listQuerySchema = z.object({
  factura_id: z.string().uuid().optional(),
  tipo:       z.enum(["credito", "debito"]).optional(),
  page:       z.coerce.number().int().positive().optional(),
  pageSize:   z.coerce.number().int().positive().max(200).optional(),
});

function validateBody(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: result.error.flatten() });
      return;
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema: z.ZodTypeAny) {
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

// ── Rutas ─────────────────────────────────────────────────────

router.use(authenticate);
router.use(authorize("gerente", "contador"));

router.post("/",   validateBody(crearNotaSchema),  ctrl.crear);
router.get("/",    validateQuery(listQuerySchema), ctrl.listar);
router.get("/:id", ctrl.obtener);

export default router;
