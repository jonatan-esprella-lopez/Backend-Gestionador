// ============================================================
// journal-entry.service.ts
// Motor contable: crear, confirmar y reversar AsientoContable.
//
// Reglas invariantes:
//   - Un asiento CONFIRMADO debe cuadrar: suma(debe) = suma(haber)
//   - El DB trigger chk_asiento_cuadrado también lo refuerza en BD.
//   - Solo cuentas con permite_asiento = true aceptan movimientos
//     (DB trigger trg_validar_cuenta_hoja también lo valida).
//   - Los asientos NUNCA se modifican; para corregir se reversa.
// ============================================================

import { PrismaClient, OrigenAsiento, EstadoAsiento } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

// ── Tipos públicos ────────────────────────────────────────────

export type MovimientoInput = {
  cuenta_id:   string;
  debe:        number;
  haber:       number;
  descripcion?: string;
  contacto_id?: string;
  orden:       number;
};

export type CrearAsientoDto = {
  fecha:       Date;
  concepto:    string;
  tipo_origen: OrigenAsiento;
  origen_id?:  string;
  usuario_id:  string;
  empresa_id:  string;
  movimientos: MovimientoInput[];
  confirmar?:  boolean; // si true → pasa directo a estado=confirmado
};

export type AsientoCreado = {
  id:         string;
  numero:     number;
  estado:     EstadoAsiento;
  total_debe: Decimal;
  total_haber: Decimal;
};

// ── Validaciones de dominio ───────────────────────────────────

function validarCuadre(movimientos: MovimientoInput[]): void {
  let totalDebe  = new Decimal(0);
  let totalHaber = new Decimal(0);

  for (const m of movimientos) {
    if (m.debe < 0 || m.haber < 0) {
      throw new Error("Los montos de debe y haber deben ser ≥ 0.");
    }
    if (m.debe > 0 && m.haber > 0) {
      throw new Error(
        `El movimiento en orden ${m.orden} tiene debe y haber simultáneos. Solo uno puede ser > 0.`
      );
    }
    if (m.debe === 0 && m.haber === 0) {
      throw new Error(`El movimiento en orden ${m.orden} tiene debe y haber en 0.`);
    }
    totalDebe  = totalDebe.plus(m.debe);
    totalHaber = totalHaber.plus(m.haber);
  }

  if (!totalDebe.equals(totalHaber)) {
    throw new Error(
      `El asiento no cuadra: Debe ${totalDebe.toFixed(2)} ≠ Haber ${totalHaber.toFixed(2)}.`
    );
  }
}

function calcularTotales(movimientos: MovimientoInput[]) {
  let totalDebe  = new Decimal(0);
  let totalHaber = new Decimal(0);

  for (const m of movimientos) {
    totalDebe  = totalDebe.plus(m.debe);
    totalHaber = totalHaber.plus(m.haber);
  }

  return { totalDebe, totalHaber };
}

// ── Servicio público ──────────────────────────────────────────

/**
 * Crea un AsientoContable con sus MovimientoContable en una
 * transacción Prisma atómica.
 *
 * Si `confirmar = true`, el asiento pasa directo a 'confirmado'.
 * El DB trigger fn_next_asiento_numero asigna el número secuencial.
 */
export async function crearAsiento(dto: CrearAsientoDto): Promise<AsientoCreado> {
  if (dto.movimientos.length < 2) {
    throw new Error("Un asiento contable requiere al menos 2 movimientos.");
  }

  const confirmar = dto.confirmar ?? true;

  if (confirmar) {
    validarCuadre(dto.movimientos);
  }

  const { totalDebe, totalHaber } = calcularTotales(dto.movimientos);

  const asiento = await prisma.$transaction(async (tx) => {
    const nuevo = await tx.asientoContable.create({
      data: {
        empresa_id:  dto.empresa_id,
        numero:      0, // el trigger fn_next_asiento_numero lo sobreescribe
        fecha:       dto.fecha,
        concepto:    dto.concepto,
        tipo_origen: dto.tipo_origen,
        origen_id:   dto.origen_id ?? null,
        usuario_id:  dto.usuario_id,
        estado:      confirmar ? "confirmado" : "borrador",
        total_debe:  totalDebe.toFixed(2),
        total_haber: totalHaber.toFixed(2),
        movimientos: {
          create: dto.movimientos.map((m) => ({
            cuenta_id:   m.cuenta_id,
            debe:        m.debe,
            haber:       m.haber,
            descripcion: m.descripcion ?? null,
            contacto_id: m.contacto_id ?? null,
            orden:       m.orden,
          })),
        },
      },
    });

    return nuevo;
  });

  return {
    id:          asiento.id,
    numero:      asiento.numero,
    estado:      asiento.estado,
    total_debe:  new Decimal(asiento.total_debe.toString()),
    total_haber: new Decimal(asiento.total_haber.toString()),
  };
}

/**
 * Confirma un asiento en estado 'borrador'.
 * Valida cuadre antes de confirmar.
 */
export async function confirmarAsiento(
  empresaId: string,
  asientoId: string
): Promise<AsientoCreado> {
  const asiento = await prisma.asientoContable.findFirst({
    where:   { id: asientoId, empresa_id: empresaId },
    include: { movimientos: true },
  });

  if (!asiento) throw new Error("Asiento no encontrado.");
  if (asiento.estado !== "borrador") {
    throw new Error(`El asiento #${asiento.numero} no está en borrador (estado: ${asiento.estado}).`);
  }

  const movInputs: MovimientoInput[] = asiento.movimientos.map((m) => ({
    cuenta_id: m.cuenta_id,
    debe:      Number(m.debe),
    haber:     Number(m.haber),
    orden:     m.orden,
  }));

  validarCuadre(movInputs);

  const actualizado = await prisma.asientoContable.update({
    where: { id: asientoId },
    data:  { estado: "confirmado" },
  });

  return {
    id:          actualizado.id,
    numero:      actualizado.numero,
    estado:      actualizado.estado,
    total_debe:  new Decimal(actualizado.total_debe.toString()),
    total_haber: new Decimal(actualizado.total_haber.toString()),
  };
}

/**
 * Reversa un asiento confirmado: crea un asiento inverso y marca
 * el original como 'anulado'. Los asientos nunca se modifican.
 */
export async function reversarAsiento(
  empresaId: string,
  asientoId: string,
  usuarioId: string,
  motivo: string
): Promise<AsientoCreado> {
  const original = await prisma.asientoContable.findFirst({
    where:   { id: asientoId, empresa_id: empresaId },
    include: { movimientos: true },
  });

  if (!original) throw new Error("Asiento no encontrado.");
  if (original.estado !== "confirmado") {
    throw new Error("Solo se pueden reversar asientos confirmados.");
  }

  const movimientosInversos: MovimientoInput[] = original.movimientos.map((m, idx) => ({
    cuenta_id:   m.cuenta_id,
    debe:        Number(m.haber), // invertir
    haber:       Number(m.debe),  // invertir
    descripcion: m.descripcion ?? undefined,
    contacto_id: m.contacto_id ?? undefined,
    orden:       idx + 1,
  }));

  const reversion = await prisma.$transaction(async (tx) => {
    // Crear asiento de reversión
    const nuevoAsiento = await tx.asientoContable.create({
      data: {
        empresa_id:          empresaId,
        numero:              0,
        fecha:               new Date(),
        concepto:            `REVERSIÓN: ${motivo} (Asiento #${original.numero})`,
        tipo_origen:         "reversion",
        origen_id:           original.id,
        asiento_reversion_id: original.id,
        usuario_id:          usuarioId,
        estado:              "confirmado",
        total_debe:          original.total_haber.toString(),
        total_haber:         original.total_debe.toString(),
        movimientos: {
          create: movimientosInversos.map((m) => ({
            cuenta_id:   m.cuenta_id,
            debe:        m.debe,
            haber:       m.haber,
            descripcion: m.descripcion ?? null,
            contacto_id: m.contacto_id ?? null,
            orden:       m.orden,
          })),
        },
      },
    });

    // Anular el asiento original
    await tx.asientoContable.update({
      where: { id: asientoId },
      data:  { estado: "anulado" },
    });

    return nuevoAsiento;
  });

  return {
    id:          reversion.id,
    numero:      reversion.numero,
    estado:      reversion.estado,
    total_debe:  new Decimal(reversion.total_debe.toString()),
    total_haber: new Decimal(reversion.total_haber.toString()),
  };
}

/**
 * Obtiene un asiento con sus movimientos y datos de cuenta.
 */
export async function obtenerAsiento(empresaId: string, asientoId: string) {
  return prisma.asientoContable.findFirst({
    where: { id: asientoId, empresa_id: empresaId },
    include: {
      movimientos: {
        include: { cuenta: true, contacto: true },
        orderBy: { orden: "asc" },
      },
      usuario: { select: { nombre: true } },
    },
  });
}

/**
 * Lista asientos de una empresa con filtros opcionales.
 */
export async function listarAsientos(
  empresaId: string,
  filtros: {
    desde?:      Date;
    hasta?:      Date;
    estado?:     EstadoAsiento;
    tipo_origen?: OrigenAsiento;
    page?:       number;
    pageSize?:   number;
  }
) {
  const { desde, hasta, estado, tipo_origen, page = 1, pageSize = 50 } = filtros;

  const where = {
    empresa_id:  empresaId,
    ...(estado      && { estado }),
    ...(tipo_origen && { tipo_origen }),
    ...(desde || hasta
      ? {
          fecha: {
            ...(desde && { gte: desde }),
            ...(hasta && { lte: hasta }),
          },
        }
      : {}),
  };

  const [total, asientos] = await Promise.all([
    prisma.asientoContable.count({ where }),
    prisma.asientoContable.findMany({
      where,
      orderBy: [{ fecha: "desc" }, { numero: "desc" }],
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: {
        usuario: { select: { nombre: true } },
        _count:  { select: { movimientos: true } },
      },
    }),
  ]);

  return { total, page, pageSize, asientos };
}

/**
 * Crea un asiento de ajuste manual (uso contable directo).
 */
export async function crearAsientoAjuste(
  empresaId: string,
  usuarioId: string,
  concepto:  string,
  movimientos: MovimientoInput[]
): Promise<AsientoCreado> {
  return crearAsiento({
    empresa_id:  empresaId,
    usuario_id:  usuarioId,
    fecha:       new Date(),
    concepto,
    tipo_origen: "ajuste",
    movimientos,
    confirmar:   true,
  });
}
