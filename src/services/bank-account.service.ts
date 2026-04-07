import prisma from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface CreateBankAccountData {
  nombre:         string;
  banco?:         string;
  numero_cuenta?: string;
  moneda_codigo?: string;
  saldo_actual?:  number;
}

export interface UpdateBankAccountData {
  nombre?:        string;
  banco?:         string | null;
  numero_cuenta?: string | null;
  moneda_codigo?: string;
  saldo_actual?:  number;
  activo?:        boolean;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function notFound() {
  return Object.assign(new Error("Cuenta bancaria no encontrada"), { status: 404 });
}

const PUBLIC_SELECT = {
  id:            true,
  empresa_id:    true,
  nombre:        true,
  banco:         true,
  numero_cuenta: true,
  moneda_codigo: true,
  saldo_actual:  true,
  activo:        true,
  created_at:    true,
  updated_at:    true,
  moneda: { select: { nombre: true, simbolo: true } },
} as const;

// ─────────────────────────────────────────────────────────────
// listBankAccounts
// ─────────────────────────────────────────────────────────────
export async function listBankAccounts(empresaId: string) {
  return prisma.cuentaBancaria.findMany({
    where:   { empresa_id: empresaId, activo: true },
    select:  PUBLIC_SELECT,
    orderBy: { nombre: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────
// getBankAccountById
// ─────────────────────────────────────────────────────────────
export async function getBankAccountById(empresaId: string, id: string) {
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where:  { id, empresa_id: empresaId },
    select: PUBLIC_SELECT,
  });

  if (!cuenta) throw notFound();
  return cuenta;
}

// ─────────────────────────────────────────────────────────────
// createBankAccount
// ─────────────────────────────────────────────────────────────
export async function createBankAccount(empresaId: string, data: CreateBankAccountData) {
  // Obtener moneda de la empresa como default
  const empresa = await prisma.empresa.findUnique({
    where:  { id: empresaId },
    select: { moneda_codigo: true },
  });

  const monedaCodigo = data.moneda_codigo ?? empresa?.moneda_codigo ?? "USD";

  // Validar que la moneda existe
  const moneda = await prisma.moneda.findUnique({ where: { codigo: monedaCodigo } });
  if (!moneda) {
    throw Object.assign(new Error(`Moneda '${monedaCodigo}' no encontrada`), { status: 404 });
  }

  return prisma.cuentaBancaria.create({
    data: {
      empresa_id:    empresaId,
      nombre:        data.nombre,
      banco:         data.banco         ?? null,
      numero_cuenta: data.numero_cuenta ?? null,
      moneda_codigo: monedaCodigo,
      saldo_actual:  data.saldo_actual  ?? 0,
    },
    select: PUBLIC_SELECT,
  });
}

// ─────────────────────────────────────────────────────────────
// updateBankAccount
// ─────────────────────────────────────────────────────────────
export async function updateBankAccount(
  empresaId: string,
  id: string,
  data: UpdateBankAccountData
) {
  const exists = await prisma.cuentaBancaria.findFirst({
    where: { id, empresa_id: empresaId },
  });
  if (!exists) throw notFound();

  if (data.moneda_codigo) {
    const moneda = await prisma.moneda.findUnique({ where: { codigo: data.moneda_codigo } });
    if (!moneda) {
      throw Object.assign(new Error(`Moneda '${data.moneda_codigo}' no encontrada`), { status: 404 });
    }
  }

  return prisma.cuentaBancaria.update({
    where: { id },
    data: {
      ...(data.nombre        !== undefined && { nombre: data.nombre }),
      ...("banco"            in data       && { banco: data.banco }),
      ...("numero_cuenta"    in data       && { numero_cuenta: data.numero_cuenta }),
      ...(data.moneda_codigo !== undefined && { moneda_codigo: data.moneda_codigo }),
      ...(data.saldo_actual  !== undefined && { saldo_actual: data.saldo_actual }),
      ...(data.activo        !== undefined && { activo: data.activo }),
    },
    select: PUBLIC_SELECT,
  });
}

// ─────────────────────────────────────────────────────────────
// deleteBankAccount (soft delete)
// ─────────────────────────────────────────────────────────────
export async function deleteBankAccount(empresaId: string, id: string) {
  const exists = await prisma.cuentaBancaria.findFirst({
    where: { id, empresa_id: empresaId },
  });
  if (!exists) throw notFound();

  await prisma.cuentaBancaria.update({
    where: { id },
    data:  { activo: false },
  });
}
