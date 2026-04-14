import { Request, Response, NextFunction } from "express";
import * as service from "../services/accounts-receivable.service";

// GET /api/accounts-receivable?aging=true&contacto_id=&page=&pageSize=
export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { aging, contacto_id, page, pageSize } = req.query as Record<string, string>;
    const resultado = await service.listarCxC(req.user!.empresaId!, {
      aging:       aging === "true",
      contacto_id: contacto_id ?? undefined,
      page:        page     ? parseInt(page,     10) : 1,
      pageSize:    pageSize ? parseInt(pageSize, 10) : 50,
    });
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// GET /api/accounts-receivable/by-client
export async function porCliente(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.cxcPorCliente(req.user!.empresaId!);
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}
