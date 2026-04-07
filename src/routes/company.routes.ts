import { Router, Request, Response, NextFunction } from "express";
import * as companyService from "../services/company.service";
import { authenticate, authorize } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticate);

// GET /api/companies/me — todos los roles de empresa
router.get("/me", authorize("gerente", "contador", "empleado"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.empresaId) {
      res.status(403).json({ message: "Esta operación requiere un usuario de empresa" });
      return;
    }
    const empresa = await companyService.getCompany(req.user!.empresaId);
    res.status(200).json({ empresa });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/companies/me — solo gerente
router.patch("/me", authorize("gerente"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, logo_url, moneda_codigo } = req.body as {
      nombre?:        string;
      logo_url?:      string | null;
      moneda_codigo?: string;
    };

    const empresa = await companyService.updateCompany(req.user!.empresaId!, {
      nombre,
      logo_url,
      moneda_codigo,
    });

    res.status(200).json({ empresa });
  } catch (err) {
    next(err);
  }
});

export default router;
