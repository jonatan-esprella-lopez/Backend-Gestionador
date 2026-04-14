import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/journal-entry.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// ── Schemas de validación ─────────────────────────────────────

const movimientoSchema = z.object({
  cuenta_id:   z.string().uuid(),
  debe:        z.number().min(0),
  haber:       z.number().min(0),
  descripcion: z.string().max(300).optional(),
  contacto_id: z.string().uuid().optional(),
  orden:       z.number().int().min(1),
}).refine(
  (m) => (m.debe > 0) !== (m.haber > 0),
  { message: "Cada movimiento debe tener debe > 0 O haber > 0, no ambos ni ninguno." }
);

const crearAsientoSchema = z.object({
  fecha:       z.string().datetime({ offset: true }).or(z.string().date()),
  concepto:    z.string().min(1).max(300),
  tipo_origen: z.enum([
    "factura", "pago", "ajuste", "apertura", "cierre",
    "reversion", "pos", "nota_credito", "nota_debito",
  ]),
  origen_id:   z.string().uuid().optional(),
  confirmar:   z.boolean().optional(),
  movimientos: z.array(movimientoSchema).min(2, "Un asiento requiere al menos 2 movimientos."),
});

const ajusteSchema = z.object({
  concepto:    z.string().min(1).max(300),
  movimientos: z.array(movimientoSchema).min(2),
});

const reversarSchema = z.object({
  motivo: z.string().min(1).max(300),
});

const listQuerySchema = z.object({
  desde:      z.string().date().optional(),
  hasta:      z.string().date().optional(),
  estado:     z.enum(["borrador", "confirmado", "anulado"]).optional(),
  tipo_origen: z.enum([
    "factura", "pago", "ajuste", "apertura", "cierre",
    "reversion", "pos", "nota_credito", "nota_debito",
  ]).optional(),
  page:     z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(200).optional(),
});

function validate(schema: z.ZodTypeAny, source: "body" | "query" = "body") {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(source === "body" ? req.body : req.query);
    if (!result.success) {
      res.status(400).json({ error: "Datos inválidos", detalles: result.error.flatten() });
      return;
    }
    if (source === "body") req.body = result.data;
    else                   Object.assign(req.query, result.data);
    next();
  };
}

// ── Rutas ────────────────────────────────────────────────────

router.use(authenticate);

// Lectura: gerente y contador
router.get("/",    authorize("gerente", "contador"), validate(listQuerySchema, "query"), ctrl.list);
router.get("/:id", authorize("gerente", "contador"), ctrl.getById);

// Asiento de ajuste manual (solo contador/gerente)
router.post("/adjustment",   authorize("gerente", "contador"), validate(ajusteSchema),   ctrl.adjustment);

// Crear asiento (en borrador o confirmado directo)
router.post("/",             authorize("gerente", "contador"), validate(crearAsientoSchema), ctrl.create);

// Confirmar asiento en borrador
router.post("/:id/confirm",  authorize("gerente", "contador"), ctrl.confirm);

// Reversar asiento confirmado
router.post("/:id/reverse",  authorize("gerente", "contador"), validate(reversarSchema),    ctrl.reverse);

export default router;
