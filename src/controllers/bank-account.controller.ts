import { Request, Response, NextFunction } from "express";
import * as bankService from "../services/bank-account.service";
import { isValidUUID, isNonNegativeNumber } from "../lib/validators";

// ─────────────────────────────────────────────────────────────
// GET /api/bank-accounts
// ─────────────────────────────────────────────────────────────
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cuentas = await bankService.listBankAccounts(req.user!.empresaId!);
    res.status(200).json({ cuentas });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/bank-accounts/:id
// ─────────────────────────────────────────────────────────────
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cuenta = await bankService.getBankAccountById(req.user!.empresaId!, req.params.id as string);
    res.status(200).json({ cuenta });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/bank-accounts
// Body: { nombre, banco?, numero_cuenta?, moneda_codigo?, saldo_actual? }
// ─────────────────────────────────────────────────────────────
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, banco, numero_cuenta, moneda_codigo, saldo_actual } = req.body as {
      nombre?:         string;
      banco?:          string;
      numero_cuenta?:  string;
      moneda_codigo?:  string;
      saldo_actual?:   number;
    };

    if (!nombre) {
      res.status(400).json({ message: "nombre es requerido" });
      return;
    }

    if (saldo_actual !== undefined && !isNonNegativeNumber(saldo_actual)) {
      res.status(400).json({ message: "saldo_actual debe ser un número no negativo" });
      return;
    }

    const cuenta = await bankService.createBankAccount(req.user!.empresaId!, {
      nombre,
      banco,
      numero_cuenta,
      moneda_codigo,
      saldo_actual,
    });

    res.status(201).json({ cuenta });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/bank-accounts/:id
// Body: campos opcionales
// ─────────────────────────────────────────────────────────────
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!isValidUUID(req.params.id as string)) {
      res.status(400).json({ message: "ID de cuenta bancaria inválido" });
      return;
    }
    const { nombre, banco, numero_cuenta, moneda_codigo, saldo_actual, activo } = req.body as {
      nombre?:        string;
      banco?:         string | null;
      numero_cuenta?: string | null;
      moneda_codigo?: string;
      saldo_actual?:  number;
      activo?:        boolean;
    };

    const cuenta = await bankService.updateBankAccount(req.user!.empresaId!, req.params.id as string, {
      nombre,
      banco,
      numero_cuenta,
      moneda_codigo,
      saldo_actual,
      activo,
    });

    res.status(200).json({ cuenta });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/bank-accounts/:id
// ─────────────────────────────────────────────────────────────
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!isValidUUID(req.params.id as string)) {
      res.status(400).json({ message: "ID de cuenta bancaria inválido" });
      return;
    }
    await bankService.deleteBankAccount(req.user!.empresaId!, req.params.id as string);
    res.status(200).json({ message: "Cuenta bancaria desactivada" });
  } catch (err) {
    next(err);
  }
}
