import { Request, Response, NextFunction } from "express";
import * as service from "../services/chart-of-accounts.service";

// GET /api/chart-of-accounts
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cuentas = await service.obtenerArbolCuentas(req.user!.empresaId!);
    res.status(200).json({ cuentas });
  } catch (err) {
    next(err);
  }
}

// GET /api/chart-of-accounts/leaf — solo cuentas hoja (para pickers)
export async function listLeaf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cuentas = await service.obtenerCuentasHoja(req.user!.empresaId!);
    res.status(200).json({ cuentas });
  } catch (err) {
    next(err);
  }
}

// GET /api/chart-of-accounts/:id
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cuenta = await service.obtenerCuentaPorId(req.user!.empresaId!, req.params.id as string);
    if (!cuenta) {
      res.status(404).json({ error: "Cuenta no encontrada." });
      return;
    }
    res.status(200).json({ cuenta });
  } catch (err) {
    next(err);
  }
}

// POST /api/chart-of-accounts
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cuenta = await service.crearCuenta(req.user!.empresaId!, req.body);
    res.status(201).json({ cuenta });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/chart-of-accounts/:id
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cuenta = await service.actualizarCuenta(
      req.user!.empresaId!,
      req.params.id as string,
      req.body
    );
    res.status(200).json({ cuenta });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/chart-of-accounts/:id
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await service.eliminarCuenta(req.user!.empresaId!, req.params.id as string);
    res.status(200).json({ result });
  } catch (err) {
    next(err);
  }
}

// POST /api/chart-of-accounts/initialize — seed plan de cuentas Bolivia
export async function initialize(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await service.inicializarPlanCuentas(req.user!.empresaId!);
    res.status(200).json({ message: "Plan de cuentas Bolivia inicializado correctamente." });
  } catch (err) {
    next(err);
  }
}
