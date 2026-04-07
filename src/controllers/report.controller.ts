import { Request, Response, NextFunction } from "express";
import * as reportService from "../services/report.service";

function qs(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && typeof val[0] === "string") return val[0];
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// GET /api/reports/summary
// KPIs: balance mensual, anual, pendientes por cobrar/pagar
// ─────────────────────────────────────────────────────────────
export async function summary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const data = await reportService.getSummary(empresaId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/reports/cashflow
// Flujo de caja diario — últimos 30 días
// ─────────────────────────────────────────────────────────────
export async function cashflow(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const data = await reportService.getCashflow(empresaId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/reports/by-category
// Query: fecha_desde?, fecha_hasta? (default: mes actual)
// ─────────────────────────────────────────────────────────────
export async function byCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const data = await reportService.getByCategory(
      empresaId,
      qs(req.query.fecha_desde),
      qs(req.query.fecha_hasta)
    );
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/reports/inventory-valuation
// Valoración del inventario (stock × precio_costo y precio_venta)
// ─────────────────────────────────────────────────────────────
export async function inventoryValuation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const data = await reportService.getInventoryValuation(empresaId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}
