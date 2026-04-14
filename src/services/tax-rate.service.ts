// ============================================================
// tax-rate.service.ts
// Gestión del catálogo de Tasas de Impuesto (Bolivia)
// ============================================================

import { PrismaClient, TipoImpuesto } from "@prisma/client";

const prisma = new PrismaClient();

export type CrearTasaDto = {
  nombre: string;
  codigo: string;
  porcentaje: number;
  tipo: TipoImpuesto;
  cuenta_debito_id?: string;
  cuenta_credito_id?: string;
};

export type ActualizarTasaDto = Partial<CrearTasaDto> & { activo?: boolean };

// ── Consultas ────────────────────────────────────────────────

export async function listarTasas(empresaId: string) {
  return prisma.tasaImpuesto.findMany({
    where: { empresa_id: empresaId },
    include: {
      cuenta_debito:  { select: { codigo: true, nombre: true } },
      cuenta_credito: { select: { codigo: true, nombre: true } },
    },
    orderBy: { codigo: "asc" },
  });
}

export async function obtenerTasaPorId(empresaId: string, tasaId: string) {
  return prisma.tasaImpuesto.findFirst({
    where: { id: tasaId, empresa_id: empresaId },
    include: {
      cuenta_debito:  true,
      cuenta_credito: true,
    },
  });
}

// ── Mutaciones ───────────────────────────────────────────────

export async function crearTasa(empresaId: string, dto: CrearTasaDto) {
  const existe = await prisma.tasaImpuesto.findUnique({
    where: { empresa_id_codigo: { empresa_id: empresaId, codigo: dto.codigo } },
  });
  if (existe) throw new Error(`Ya existe una tasa con código ${dto.codigo}.`);

  return prisma.tasaImpuesto.create({
    data: {
      empresa_id:        empresaId,
      nombre:            dto.nombre,
      codigo:            dto.codigo,
      porcentaje:        dto.porcentaje,
      tipo:              dto.tipo,
      cuenta_debito_id:  dto.cuenta_debito_id ?? null,
      cuenta_credito_id: dto.cuenta_credito_id ?? null,
    },
  });
}

export async function actualizarTasa(
  empresaId: string,
  tasaId: string,
  dto: ActualizarTasaDto
) {
  const tasa = await prisma.tasaImpuesto.findFirst({
    where: { id: tasaId, empresa_id: empresaId },
  });
  if (!tasa) throw new Error("Tasa de impuesto no encontrada.");

  return prisma.tasaImpuesto.update({
    where: { id: tasaId },
    data: dto,
  });
}
