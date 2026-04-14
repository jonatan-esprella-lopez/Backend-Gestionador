import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/chart-of-accounts.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

// ── Schemas de validación ─────────────────────────────────────

const crearCuentaSchema = z.object({
  codigo:          z.string().min(1).max(20),
  nombre:          z.string().min(1).max(150),
  tipo:            z.enum(["activo", "pasivo", "patrimonio", "ingreso", "gasto"]),
  naturaleza:      z.enum(["deudora", "acreedora"]),
  nivel:           z.number().int().min(1).max(4),
  cuenta_padre_id: z.string().uuid().optional(),
  permite_asiento: z.boolean().optional(),
});

const actualizarCuentaSchema = z.object({
  nombre:          z.string().min(1).max(150).optional(),
  activo:          z.boolean().optional(),
  permite_asiento: z.boolean().optional(),
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
router.get("/",      authorize("gerente", "contador"), ctrl.list);
router.get("/leaf",  authorize("gerente", "contador", "empleado"), ctrl.listLeaf);
router.get("/:id",   authorize("gerente", "contador"), ctrl.getById);

// Inicializar plan de cuentas (solo gerente)
router.post("/initialize", authorize("gerente"), ctrl.initialize);

// Escritura: solo gerente y contador
router.post(  "/",    authorize("gerente", "contador"), validate(crearCuentaSchema),     ctrl.create);
router.patch( "/:id", authorize("gerente", "contador"), validate(actualizarCuentaSchema), ctrl.update);
router.delete("/:id", authorize("gerente"),                                               ctrl.remove);

export default router;
