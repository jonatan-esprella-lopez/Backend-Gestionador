import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/contact.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

const crearContactoSchema = z.object({
  nombre:           z.string().min(1).max(255),
  telefono:         z.string().max(30).optional(),
  email:            z.string().email().optional(),
  es_cliente:       z.boolean().optional(),
  es_proveedor:     z.boolean().optional(),
  nit:              z.string().max(20).optional(),
  razon_social:     z.string().max(200).optional(),
  direccion_fiscal: z.string().optional(),
  ciudad:           z.string().max(100).optional(),
});

const actualizarContactoSchema = crearContactoSchema.partial().extend({
  activo: z.boolean().optional(),
}).refine((d) => Object.keys(d).length > 0, {
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

router.use(authenticate);

// Lectura: todos los roles con empresa
router.get("/",      authorize("gerente", "contador", "empleado"), ctrl.list);
// Escritura: gerente y contador
router.post("/",     authorize("gerente", "contador"), validate(crearContactoSchema),     ctrl.create);
router.patch("/:id", authorize("gerente", "contador"), validate(actualizarContactoSchema), ctrl.update);

export default router;
