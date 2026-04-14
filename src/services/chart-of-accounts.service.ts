// ============================================================
// chart-of-accounts.service.ts
// Gestión del Plan de Cuentas (CuentaContable)
// ============================================================

import { PrismaClient, TipoCuentaContable, NaturalezaCuenta } from "@prisma/client";
import { seedPlanCuentasBolivia } from "../data/planCuentasBolivia";

const prisma = new PrismaClient();

// ── Tipos ────────────────────────────────────────────────────

export type CrearCuentaDto = {
  codigo: string;
  nombre: string;
  tipo: TipoCuentaContable;
  naturaleza: NaturalezaCuenta;
  cuenta_padre_id?: string;
  nivel: number;
  permite_asiento?: boolean;
};

export type ActualizarCuentaDto = {
  nombre?: string;
  activo?: boolean;
  permite_asiento?: boolean;
};

// ── Consultas ────────────────────────────────────────────────

export async function obtenerArbolCuentas(empresaId: string) {
  const cuentas = await prisma.cuentaContable.findMany({
    where: { empresa_id: empresaId },
    orderBy: { codigo: "asc" },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      tipo: true,
      naturaleza: true,
      nivel: true,
      permite_asiento: true,
      activo: true,
      cuenta_padre_id: true,
    },
  });

  return cuentas;
}

export async function obtenerCuentaPorId(empresaId: string, cuentaId: string) {
  return prisma.cuentaContable.findFirst({
    where: { id: cuentaId, empresa_id: empresaId },
    include: { cuenta_padre: true, hijas: true },
  });
}

export async function obtenerCuentasPorTipo(
  empresaId: string,
  tipo: TipoCuentaContable
) {
  return prisma.cuentaContable.findMany({
    where: { empresa_id: empresaId, tipo, activo: true },
    orderBy: { codigo: "asc" },
  });
}

export async function obtenerCuentasHoja(empresaId: string) {
  return prisma.cuentaContable.findMany({
    where: { empresa_id: empresaId, permite_asiento: true, activo: true },
    orderBy: { codigo: "asc" },
    select: { id: true, codigo: true, nombre: true, tipo: true, naturaleza: true },
  });
}

// ── Mutaciones ───────────────────────────────────────────────

export async function crearCuenta(empresaId: string, dto: CrearCuentaDto) {
  const existe = await prisma.cuentaContable.findUnique({
    where: { empresa_id_codigo: { empresa_id: empresaId, codigo: dto.codigo } },
  });

  if (existe) {
    throw new Error(`Ya existe una cuenta con código ${dto.codigo} en esta empresa.`);
  }

  if (dto.cuenta_padre_id) {
    const padre = await prisma.cuentaContable.findFirst({
      where: { id: dto.cuenta_padre_id, empresa_id: empresaId },
    });
    if (!padre) throw new Error("Cuenta padre no encontrada.");
  }

  return prisma.cuentaContable.create({
    data: {
      empresa_id:      empresaId,
      codigo:          dto.codigo,
      nombre:          dto.nombre,
      tipo:            dto.tipo,
      naturaleza:      dto.naturaleza,
      nivel:           dto.nivel,
      permite_asiento: dto.permite_asiento ?? false,
      cuenta_padre_id: dto.cuenta_padre_id ?? null,
    },
  });
}

export async function actualizarCuenta(
  empresaId: string,
  cuentaId: string,
  dto: ActualizarCuentaDto
) {
  const cuenta = await prisma.cuentaContable.findFirst({
    where: { id: cuentaId, empresa_id: empresaId },
  });
  if (!cuenta) throw new Error("Cuenta no encontrada.");

  return prisma.cuentaContable.update({
    where: { id: cuentaId },
    data: dto,
  });
}

export async function eliminarCuenta(empresaId: string, cuentaId: string) {
  const cuenta = await prisma.cuentaContable.findFirst({
    where: { id: cuentaId, empresa_id: empresaId },
  });
  if (!cuenta) throw new Error("Cuenta no encontrada.");

  const tieneMovimientos = await prisma.movimientoContable.count({
    where: { cuenta_id: cuentaId },
  });

  if (tieneMovimientos > 0) {
    // Soft delete: desactivar en lugar de borrar
    return prisma.cuentaContable.update({
      where: { id: cuentaId },
      data: { activo: false },
    });
  }

  const tieneHijas = await prisma.cuentaContable.count({
    where: { cuenta_padre_id: cuentaId },
  });
  if (tieneHijas > 0) {
    throw new Error("No se puede eliminar una cuenta con subcuentas.");
  }

  return prisma.cuentaContable.delete({ where: { id: cuentaId } });
}

export async function inicializarPlanCuentas(empresaId: string) {
  await seedPlanCuentasBolivia(prisma, empresaId);
}
