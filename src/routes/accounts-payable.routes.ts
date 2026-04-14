import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as ctrl from "../controllers/accounts-payable.controller";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

const listQuerySchema = z.object({
  aging:       z.enum(["true", "false"]).optional(),
  contacto_id: z.string().uuid().optional(),
  page:        z.coerce.number().int().positive().optional(),
  pageSize:    z.coerce.number().int().positive().max(200).optional(),
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

router.use(authenticate);
router.use(authorize("gerente", "contador"));

// CxP con aging opcional
router.get("/",            validate(listQuerySchema), ctrl.listar);

// CxP agrupado por proveedor
router.get("/by-supplier", ctrl.porProveedor);

export default router;
