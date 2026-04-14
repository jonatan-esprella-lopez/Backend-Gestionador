import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/payment.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// ── Schemas de validación ─────────────────────────────────────

const registrarPagoSchema = z.object({
  factura_id:         z.string().uuid(),
  cuenta_bancaria_id: z.string().uuid(),
  fecha:              z.string().date(),
  monto:              z.number().positive(),
  metodo:             z.enum(["efectivo", "transferencia", "cheque", "qr", "tarjeta", "otro"]),
  referencia:         z.string().max(100).optional(),
  observaciones:      z.string().max(500).optional(),
});

const listQuerySchema = z.object({
  factura_id: z.string().uuid().optional(),
  desde:      z.string().date().optional(),
  hasta:      z.string().date().optional(),
  page:       z.coerce.number().int().positive().optional(),
  pageSize:   z.coerce.number().int().positive().max(200).optional(),
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

// Registro de pagos: gerente y contador
router.post("/", authorize("gerente", "contador"), validate(registrarPagoSchema), ctrl.create);

export default router;
