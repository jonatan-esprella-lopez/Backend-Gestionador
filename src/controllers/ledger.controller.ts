import { Request, Response, NextFunction } from "express";
import * as service from "../services/ledger.service";

// GET /api/ledger?cuenta_id=&desde=&hasta=&page=&pageSize=
export async function libroMayor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { cuenta_id, desde, hasta, page, pageSize } = req.query as Record<string, string>;
    const resultado = await service.libroMayor(req.user!.empresaId!, cuenta_id, {
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

// GET /api/ledger/trial-balance?fecha=
export async function balanceComprobacion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fecha } = req.query as Record<string, string>;
    const resultado = await service.balanceComprobacion(
      req.user!.empresaId!,
      fecha ? new Date(fecha) : new Date()
    );
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// GET /api/ledger/balance-sheet?fecha=
export async function balanceGeneral(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { fecha } = req.query as Record<string, string>;
    const resultado = await service.balanceGeneral(
      req.user!.empresaId!,
      fecha ? new Date(fecha) : new Date()
    );
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// GET /api/ledger/income-statement?desde=&hasta=
export async function estadoResultados(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { desde, hasta } = req.query as Record<string, string>;
    const now = new Date();
    const resultado = await service.estadoResultados(
      req.user!.empresaId!,
      desde ? new Date(desde) : new Date(now.getFullYear(), now.getMonth(), 1),
      hasta ? new Date(hasta) : now
    );
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
