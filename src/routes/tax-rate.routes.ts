import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/tax-rate.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// ── Schemas de validación ─────────────────────────────────────

const crearTasaSchema = z.object({
  nombre:            z.string().min(1).max(80),
  codigo:            z.string().min(1).max(20),
  porcentaje:        z.number().positive().max(100),
  tipo:              z.enum(["trasladado", "retenido"]),
  cuenta_debito_id:  z.string().uuid().optional(),
  cuenta_credito_id: z.string().uuid().optional(),
});

const actualizarTasaSchema = z.object({
  nombre:            z.string().min(1).max(80).optional(),
  porcentaje:        z.number().positive().max(100).optional(),
  tipo:              z.enum(["trasladado", "retenido"]).optional(),
  cuenta_debito_id:  z.string().uuid().nullable().optional(),
  cuenta_credito_id: z.string().uuid().nullable().optional(),
  activo:            z.boolean().optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: "Se debe enviar al menos un campo a actualizar.",
});

function validate(schema: z.ZodTypeAny) {
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

// ── Rutas ────────────────────────────────────────────────────

router.use(authenticate);

// Lectura: gerente y contador
router.get("/",    authorize("gerente", "contador"), ctrl.list);
router.get("/:id", authorize("gerente", "contador"), ctrl.getById);

// Escritura: solo gerente
router.post(  "/",    authorize("gerente"), validate(crearTasaSchema),     ctrl.create);
router.patch( "/:id", authorize("gerente"), validate(actualizarTasaSchema), ctrl.update);

export default router;
