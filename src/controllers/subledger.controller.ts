import { Request, Response, NextFunction } from "express";
import * as service from "../services/subledger.service";

// GET /api/subledger/by-contact?contacto_id=&desde=&hasta=&page=&pageSize=
export async function porContacto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { contacto_id, desde, hasta, page, pageSize } = req.query as Record<string, string>;
    const resultado = await service.auxiliarPorContacto(req.user!.empresaId!, contacto_id, {
      desde:    desde    ? new Date(desde)         : undefined,
      hasta:    hasta    ? new Date(hasta)         : undefined,
      page:     page     ? parseInt(page,     10)  : 1,
      pageSize: pageSize ? parseInt(pageSize, 10)  : 100,
    });
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// GET /api/subledger/by-bank-account?cuenta_id=&desde=&hasta=&page=&pageSize=
export async function porCuentaBancaria(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cuenta_id, desde, hasta, page, pageSize } = req.query as Record<string, string>;
    const resultado = await service.auxiliarPorCuentaBancaria(req.user!.empresaId!, cuenta_id, {
      desde:    desde    ? new Date(desde)         : undefined,
      hasta:    hasta    ? new Date(hasta)         : undefined,
      page:     page     ? parseInt(page,     10)  : 1,
      pageSize: pageSize ? parseInt(pageSize, 10)  : 100,
    });
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// GET /api/subledger/journal?desde=&hasta=&page=&pageSize=
export async function diario(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { desde, hasta, page, pageSize } = req.query as Record<string, string>;
    const resultado = await service.libroDiario(req.user!.empresaId!, {
      desde:    desde    ? new Date(desde)         : undefined,
      hasta:    hasta    ? new Date(hasta)         : undefined,
      page:     page     ? parseInt(page,     10)  : 1,
      pageSize: pageSize ? parseInt(pageSize, 10)  : 50,
    });
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
