import { Request, Response, NextFunction } from "express";
import * as service from "../services/tax-rate.service";

// GET /api/tax-rates
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasas = await service.listarTasas(req.user!.empresaId!);
    res.status(200).json({ tasas });
  } catch (err) {
    next(err);
  }
}

// GET /api/tax-rates/:id
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasa = await service.obtenerTasaPorId(req.user!.empresaId!, req.params.id as string);
    if (!tasa) {
      res.status(404).json({ error: "Tasa de impuesto no encontrada." });
      return;
    }
    res.status(200).json({ tasa });
  } catch (err) {
    next(err);
  }
}

// POST /api/tax-rates
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasa = await service.crearTasa(req.user!.empresaId!, req.body);
    res.status(201).json({ tasa });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tax-rates/:id
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tasa = await service.actualizarTasa(
      req.user!.empresaId!,
      req.params.id as string,
      req.body
    );
    res.status(200).json({ tasa });
  } catch (err) {
    next(err);
  }
}
