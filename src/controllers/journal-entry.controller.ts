import { Request, Response, NextFunction } from "express";
import * as service from "../services/journal-entry.service";

// GET /api/journal-entries
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { desde, hasta, estado, tipo_origen, page, pageSize } = req.query as Record<string, string>;

    const resultado = await service.listarAsientos(req.user!.empresaId!, {
      desde:      desde      ? new Date(desde)            : undefined,
      hasta:      hasta      ? new Date(hasta)            : undefined,
      estado:     estado     as any                       ?? undefined,
      tipo_origen: tipo_origen as any                     ?? undefined,
      page:       page       ? parseInt(page, 10)         : 1,
      pageSize:   pageSize   ? parseInt(pageSize, 10)     : 50,
    });

    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// GET /api/journal-entries/:id
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asiento = await service.obtenerAsiento(req.user!.empresaId!, req.params.id as string);
    if (!asiento) {
      res.status(404).json({ error: "Asiento no encontrado." });
      return;
    }
    res.status(200).json({ asiento });
  } catch (err) {
    next(err);
  }
}

// POST /api/journal-entries
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asiento = await service.crearAsiento({
      empresa_id:  req.user!.empresaId!,
      usuario_id:  req.user!.userId,
      fecha:       new Date(req.body.fecha),
      concepto:    req.body.concepto,
      tipo_origen: req.body.tipo_origen,
      origen_id:   req.body.origen_id,
      movimientos: req.body.movimientos,
      confirmar:   req.body.confirmar ?? false,
    });
    res.status(201).json({ asiento });
  } catch (err) {
    next(err);
  }
}

// POST /api/journal-entries/:id/confirm
export async function confirm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asiento = await service.confirmarAsiento(req.user!.empresaId!, req.params.id as string);
    res.status(200).json({ asiento });
  } catch (err) {
    next(err);
  }
}

// POST /api/journal-entries/:id/reverse
export async function reverse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asiento = await service.reversarAsiento(
      req.user!.empresaId!,
      req.params.id as string,
      req.user!.userId,
      req.body.motivo
    );
    res.status(201).json({ asiento });
  } catch (err) {
    next(err);
  }
}

// POST /api/journal-entries/adjustment
export async function adjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const asiento = await service.crearAsientoAjuste(
      req.user!.empresaId!,
      req.user!.userId,
      req.body.concepto,
      req.body.movimientos
    );
    res.status(201).json({ asiento });
  } catch (err) {
    next(err);
  }
}
