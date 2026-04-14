import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/invoice.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// ── Schemas de validación ─────────────────────────────────────

const lineaSchema = z.object({
  item_id:                 z.string().uuid().optional(),
  descripcion:             z.string().min(1).max(300),
  cantidad:                z.number().positive(),
  precio_unitario:         z.number().min(0),
  tasa_impuesto_id:        z.string().uuid().optional(),
  cuenta_ingreso_gasto_id: z.string().uuid().optional(),
  orden:                   z.number().int().min(1),
});

const crearFacturaSchema = z.object({
  tipo:              z.enum(["venta", "compra", "ticket_pos"]),
  contacto_id:       z.string().uuid(),
  fecha_emision:     z.string().date(),
  fecha_vencimiento: z.string().date(),
  observaciones:     z.string().max(1000).optional(),
  lineas:            z.array(lineaSchema).min(1, "Se requiere al menos una línea."),
  emitir:            z.boolean().optional(),
}).refine(
  (d) => new Date(d.fecha_vencimiento) >= new Date(d.fecha_emision),
  { message: "La fecha de vencimiento no puede ser anterior a la de emisión.", path: ["fecha_vencimiento"] }
);

const anularSchema = z.object({
  motivo: z.string().min(1).max(300),
});

const listQuerySchema = z.object({
  tipo:        z.enum(["venta", "compra", "ticket_pos"]).optional(),
  estado:      z.enum(["borrador", "emitida", "parcial", "pagada", "anulada", "vencida"]).optional(),
  contacto_id: z.string().uuid().optional(),
  desde:       z.string().date().optional(),
  hasta:       z.string().date().optional(),
  page:        z.coerce.number().int().positive().optional(),
  pageSize:    z.coerce.number().int().positive().max(200).optional(),
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

// Creación: gerente y contador
router.post("/", authorize("gerente", "contador"), validate(crearFacturaSchema), ctrl.create);

// Anulación: solo gerente
router.post("/:id/cancel", authorize("gerente"), validate(anularSchema), ctrl.cancel);

export default router;
