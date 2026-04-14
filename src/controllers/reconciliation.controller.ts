import { Request, Response, NextFunction } from "express";
import * as reconService from "../services/reconciliation.service";
import { isValidUUID, parsePositiveInt } from "../lib/validators";

function qs(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && typeof val[0] === "string") return val[0];
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// POST /api/reconciliation/import
// Multipart: file (csv) + campos: cuenta_id, col_fecha,
//            col_monto, col_descripcion, col_referencia?
// ─────────────────────────────────────────────────────────────
export async function importCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;

    if (!req.file) {
      res.status(400).json({ message: "Se requiere un archivo CSV" });
      return;
    }

    const { cuenta_id, col_fecha, col_monto, col_descripcion, col_referencia } =
      req.body as {
        cuenta_id?:       string;
        col_fecha?:       string;
        col_monto?:       string;
        col_descripcion?: string;
        col_referencia?:  string;
      };

    if (!cuenta_id || !col_fecha || !col_monto || !col_descripcion) {
      res.status(400).json({
        message: "cuenta_id, col_fecha, col_monto y col_descripcion son requeridos",
      });
      return;
    }

    if (!isValidUUID(cuenta_id)) {
      res.status(400).json({ message: "cuenta_id inválido" });
      return;
    }

    const csvContent = req.file.buffer.toString("utf-8");

    const result = await reconService.importCsv(empresaId, cuenta_id, csvContent, {
      col_fecha,
      col_monto,
      col_descripcion,
      col_referencia,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/reconciliation/status?cuenta_id=xxx
// ─────────────────────────────────────────────────────────────
export async function getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const cuentaId  = qs(req.query.cuenta_id);

    if (!cuentaId) {
      res.status(400).json({ message: "cuenta_id es requerido" });
      return;
    }

    if (!isValidUUID(cuentaId)) {
      res.status(400).json({ message: "cuenta_id inválido" });
      return;
    }

    const data = await reconService.getStatus(empresaId, cuentaId);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/reconciliation/extractos?cuenta_id=xxx&solo_pendientes?
// ─────────────────────────────────────────────────────────────
export async function listExtractos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId       = req.user!.empresaId!;
    const cuentaId        = qs(req.query.cuenta_id);
    const soloPendientes  = qs(req.query.solo_pendientes) === "true";
    const page            = parsePositiveInt(qs(req.query.page))     ?? 1;
    const pageSize        = parsePositiveInt(qs(req.query.pageSize)) ?? 50;

    if (!cuentaId) {
      res.status(400).json({ message: "cuenta_id es requerido" });
      return;
    }

    if (!isValidUUID(cuentaId)) {
      res.status(400).json({ message: "cuenta_id inválido" });
      return;
    }

    const data = await reconService.listExtractos(empresaId, cuentaId, soloPendientes, page, pageSize);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/reconciliation/match
// Body: { extracto_id, transaccion_id }  → match manual
//       { cuenta_id, auto: true }         → match automático
// ─────────────────────────────────────────────────────────────
export async function match(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const { extracto_id, transaccion_id, cuenta_id, auto } = req.body as {
      extracto_id?:    string;
      transaccion_id?: string;
      cuenta_id?:      string;
      auto?:           boolean;
    };

    // Auto-match
    if (auto === true) {
      if (!cuenta_id) {
        res.status(400).json({ message: "cuenta_id es requerido para match automático" });
        return;
      }
      if (!isValidUUID(cuenta_id)) {
        res.status(400).json({ message: "cuenta_id inválido" });
        return;
      }
      const result = await reconService.matchAuto(empresaId, cuenta_id);
      res.status(200).json(result);
      return;
    }

    // Match manual
    if (!extracto_id || !transaccion_id) {
      res.status(400).json({ message: "extracto_id y transaccion_id son requeridos para match manual" });
      return;
    }

    if (!isValidUUID(extracto_id) || !isValidUUID(transaccion_id)) {
      res.status(400).json({ message: "extracto_id o transaccion_id inválido" });
      return;
    }

    const result = await reconService.matchManual(empresaId, extracto_id, transaccion_id);
    res.status(200).json({ extracto: result });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/reconciliation/match/:extractoId
// Deshace la conciliación de un extracto
// ─────────────────────────────────────────────────────────────
export async function unmatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.extractoId as string)) {
      res.status(400).json({ message: "ID de extracto inválido" });
      return;
    }
    const result    = await reconService.unmatch(empresaId, req.params.extractoId as string);
    res.status(200).json({ extracto: result });
  } catch (err) {
    next(err);
  }
}
