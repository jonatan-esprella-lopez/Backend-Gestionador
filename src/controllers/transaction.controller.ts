import { Request, Response, NextFunction } from "express";
import { TipoTransaccion, EstadoTransaccion } from "@prisma/client";
import * as txService from "../services/transaction.service";
import { isValidUUID, isValidEnum, isValidDate, isPositiveNumber, isPositiveInteger, parsePositiveInt } from "../lib/validators";

const TIPOS_VALIDOS:   TipoTransaccion[]   = ["income", "expense"];
const ESTADOS_VALIDOS: EstadoTransaccion[] = ["completed", "pending", "overdue"];

// Express devuelve query params como string | string[] | ParsedQs.
// Esta función toma solo el primer valor si es array.
function qs(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && typeof val[0] === "string") return val[0];
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// GET /api/transactions
// Query: tipo, estado, categoria_id, fecha_desde, fecha_hasta, page, pageSize
// ─────────────────────────────────────────────────────────────
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const { tipo, estado, categoria_id, fecha_desde, fecha_hasta, page, pageSize } = req.query;

    const tipoVal   = qs(tipo);
    const estadoVal = qs(estado);

    if (tipoVal   && !isValidEnum(tipoVal, TIPOS_VALIDOS)) {
      res.status(400).json({ message: "tipo inválido. Valores: income, expense" });
      return;
    }
    if (estadoVal && !isValidEnum(estadoVal, ESTADOS_VALIDOS)) {
      res.status(400).json({ message: "estado inválido. Valores: completed, pending, overdue" });
      return;
    }

    const result = await txService.listTransactions(empresaId, {
      tipo:         tipoVal as TipoTransaccion | undefined,
      estado:       estadoVal as EstadoTransaccion | undefined,
      categoria_id: parsePositiveInt(qs(categoria_id)),
      fecha_desde:  qs(fecha_desde),
      fecha_hasta:  qs(fecha_hasta),
      page:         parsePositiveInt(qs(page)),
      pageSize:     parsePositiveInt(qs(pageSize)),
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/transactions/categories
// Devuelve categorías disponibles (globales + de la empresa)
// ─────────────────────────────────────────────────────────────
export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const categories = await txService.listCategories(empresaId);
    res.status(200).json({ categories });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/transactions/summary
// Devuelve agrupación de transacciones 
// ─────────────────────────────────────────────────────────────
export async function summary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const { month, year } = req.query;

    const data = await txService.getSummaryTransactions(
      empresaId, 
      month ? Number(month) : undefined, 
      year ? Number(year) : undefined
    );
    res.status(200).json({ summary: data });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/transactions/:id
// ─────────────────────────────────────────────────────────────
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id as string)) {
      res.status(400).json({ message: "ID de transacción inválido" });
      return;
    }
    const tx = await txService.getTransactionById(empresaId, req.params.id as string);
    res.status(200).json({ transaction: tx });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/transactions
// Body: { descripcion, monto, tipo, categoria_id, estado?, fecha?, fecha_vencimiento? }
// ─────────────────────────────────────────────────────────────
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const { descripcion, monto, tipo, categoria_id, estado, fecha, fecha_vencimiento } =
      req.body as {
        descripcion?:      string;
        monto?:            number;
        tipo?:             TipoTransaccion;
        categoria_id?:     number;
        estado?:           EstadoTransaccion;
        fecha?:            string;
        fecha_vencimiento?: string;
      };

    if (!descripcion || monto === undefined || !tipo || categoria_id === undefined) {
      res.status(400).json({ message: "descripcion, monto, tipo y categoria_id son requeridos" });
      return;
    }

    if (!isValidEnum(tipo, TIPOS_VALIDOS)) {
      res.status(400).json({ message: "tipo inválido. Valores: income, expense" });
      return;
    }

    if (estado && !isValidEnum(estado, ESTADOS_VALIDOS)) {
      res.status(400).json({ message: "estado inválido. Valores: completed, pending, overdue" });
      return;
    }

    if (!isPositiveNumber(monto)) {
      res.status(400).json({ message: "monto debe ser un número mayor a 0" });
      return;
    }

    if (!isPositiveInteger(categoria_id)) {
      res.status(400).json({ message: "categoria_id debe ser un entero positivo" });
      return;
    }

    if (fecha && !isValidDate(fecha)) {
      res.status(400).json({ message: "Formato de fecha inválido" });
      return;
    }

    if (fecha_vencimiento && !isValidDate(fecha_vencimiento)) {
      res.status(400).json({ message: "Formato de fecha_vencimiento inválido" });
      return;
    }

    const tx = await txService.createTransaction(empresaId, req.user!.userId, {
      descripcion,
      monto,
      tipo,
      categoria_id,
      estado,
      fecha,
      fecha_vencimiento,
    });

    res.status(201).json({ transaction: tx });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/transactions/:id
// Body: campos opcionales a actualizar
// ─────────────────────────────────────────────────────────────
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id as string)) {
      res.status(400).json({ message: "ID de transacción inválido" });
      return;
    }
    const { descripcion, monto, tipo, categoria_id, estado, fecha, fecha_vencimiento } =
      req.body as {
        descripcion?:       string;
        monto?:             number;
        tipo?:              TipoTransaccion;
        categoria_id?:      number;
        estado?:            EstadoTransaccion;
        fecha?:             string;
        fecha_vencimiento?: string | null;
      };

    const tx = await txService.updateTransaction(empresaId, req.params.id as string, {
      descripcion,
      monto,
      tipo,
      categoria_id,
      estado,
      fecha,
      fecha_vencimiento,
    });

    res.status(200).json({ transaction: tx });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/transactions/:id/status
// Body: { estado }
// ─────────────────────────────────────────────────────────────
export async function updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id as string)) {
      res.status(400).json({ message: "ID de transacción inválido" });
      return;
    }
    const { estado } = req.body as { estado?: EstadoTransaccion };

    if (!estado) {
      res.status(400).json({ message: "estado es requerido" });
      return;
    }

    if (!isValidEnum(estado, ESTADOS_VALIDOS)) {
      res.status(400).json({ message: "estado inválido. Valores: completed, pending, overdue" });
      return;
    }

    const tx = await txService.updateTransactionStatus(empresaId, req.params.id as string, estado);
    res.status(200).json({ transaction: tx });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/transactions/:id
// ─────────────────────────────────────────────────────────────
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id as string)) {
      res.status(400).json({ message: "ID de transacción inválido" });
      return;
    }
    await txService.deleteTransaction(empresaId, req.params.id as string);
    res.status(200).json({ message: "Transacción eliminada" });
  } catch (err) {
    next(err);
  }
}
