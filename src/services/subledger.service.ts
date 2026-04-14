// ============================================================
// subledger.service.ts — Libro Auxiliar por contacto,
//                         por cuenta bancaria y Libro Diario
// ============================================================

import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { libroMayor } from "./ledger.service";

const prisma = new PrismaClient();

type FiltroPeriodo = {
  desde?:    Date;
  hasta?:    Date;
  page?:     number;
  pageSize?: number;
};

/**
 * Auxiliar por contacto: todos los movimientos contables donde el
 * contacto aparece como auxiliar (CxC, CxP).
 * Saldo = debe - haber (positivo: el contacto nos debe; negativo: le debemos).
 */
export async function auxiliarPorContacto(
  empresaId:  string,
  contactoId: string,
  filtros:    FiltroPeriodo
) {
  const { desde, hasta, page = 1, pageSize = 100 } = filtros;

  const contacto = await prisma.contacto.findFirst({
    where: { id: contactoId, empresa_id: empresaId },
  });
  if (!contacto) throw new Error("Contacto no encontrado.");

  // Saldo anterior al período
  let saldoAnterior = new Decimal(0);
  if (desde) {
    const agg = await prisma.movimientoContable.aggregate({
      where: {
        contacto_id: contactoId,
        asiento:     { empresa_id: empresaId, estado: "confirmado", fecha: { lt: desde } },
      },
      _sum: { debe: true, haber: true },
    });
    const d = new Decimal(agg._sum.debe?.toString()  ?? "0");
    const h = new Decimal(agg._sum.haber?.toString() ?? "0");
    saldoAnterior = d.minus(h);
  }

  const where = {
    contacto_id: contactoId,
    asiento: {
      empresa_id: empresaId,
      estado:     "confirmado" as const,
      ...(desde || hasta
        ? { fecha: { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) } }
        : {}),
    },
  };

  const [total, rows] = await Promise.all([
    prisma.movimientoContable.count({ where }),
    prisma.movimientoContable.findMany({
      where,
      include: {
        asiento: { select: { id: true, numero: true, fecha: true, concepto: true, tipo_origen: true } },
        cuenta:  { select: { codigo: true, nombre: true, tipo: true } },
      },
      orderBy: [{ asiento: { fecha: "asc" } }, { asiento: { numero: "asc" } }],
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
  ]);

  let saldo = saldoAnterior;
  const movimientos = rows.map((m) => {
    const debe  = new Decimal(m.debe.toString());
    const haber = new Decimal(m.haber.toString());
    saldo = saldo.plus(debe).minus(haber);
    return {
      id:          m.id,
      asiento_id:  m.asiento.id,
      numero:      m.asiento.numero,
      fecha:       m.asiento.fecha,
      concepto:    m.asiento.concepto,
      tipo_origen: m.asiento.tipo_origen,
      cuenta:      m.cuenta,
      descripcion: m.descripcion ?? undefined,
      debe:        debe.toFixed(2),
      haber:       haber.toFixed(2),
      saldo:       saldo.toFixed(2),
    };
  });

  return {
    contacto: {
      id:           contacto.id,
      nombre:       contacto.nombre,
      es_cliente:   contacto.es_cliente,
      es_proveedor: contacto.es_proveedor,
      nit:          contacto.nit,
      razon_social: contacto.razon_social,
    },
    saldo_anterior: saldoAnterior.toFixed(2),
    saldo_final:    saldo.toFixed(2),
    total,
    page,
    pageSize,
    movimientos,
  };
}

/**
 * Auxiliar de cuenta bancaria: movimientos en la cuenta contable
 * asociada a una cuenta bancaria. Delega en `libroMayor`.
 */
export async function auxiliarPorCuentaBancaria(
  empresaId:        string,
  cuentaBancariaId: string,
  filtros:          FiltroPeriodo
) {
  const cb = await prisma.cuentaBancaria.findFirst({
    where: { id: cuentaBancariaId, empresa_id: empresaId },
  });
  if (!cb) throw new Error("Cuenta bancaria no encontrada.");
  if (!cb.cuenta_contable_id) {
    throw new Error(
      "La cuenta bancaria no tiene una cuenta contable asociada. Configúrela primero."
    );
  }

  const mayor = await libroMayor(empresaId, cb.cuenta_contable_id, filtros);

  return {
    cuenta_bancaria: {
      id:     cb.id,
      nombre: cb.nombre,
      banco:  cb.banco,
    },
    ...mayor,
  };
}

/**
 * Libro Diario: lista cronológica de asientos confirmados con
 * sus movimientos y datos de cuenta.
 */
export async function libroDiario(empresaId: string, filtros: FiltroPeriodo) {
  const { desde, hasta, page = 1, pageSize = 50 } = filtros;

  const where = {
    empresa_id: empresaId,
    estado:     "confirmado" as const,
    ...(desde || hasta
      ? { fecha: { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) } }
      : {}),
  };

  const [total, asientos] = await Promise.all([
    prisma.asientoContable.count({ where }),
    prisma.asientoContable.findMany({
      where,
      orderBy: [{ fecha: "asc" }, { numero: "asc" }],
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: {
        movimientos: {
          include: { cuenta: { select: { codigo: true, nombre: true } } },
          orderBy:  { orden: "asc" },
        },
        usuario: { select: { nombre: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    asientos: asientos.map((a) => ({
      id:          a.id,
      numero:      a.numero,
      fecha:       a.fecha,
      concepto:    a.concepto,
      tipo_origen: a.tipo_origen,
      total_debe:  a.total_debe.toString(),
      total_haber: a.total_haber.toString(),
      usuario:     a.usuario.nombre,
      movimientos: a.movimientos.map((m) => ({
        orden:         m.orden,
        cuenta_codigo: m.cuenta.codigo,
        cuenta_nombre: m.cuenta.nombre,
        descripcion:   m.descripcion ?? undefined,
        debe:          m.debe.toString(),
        haber:         m.haber.toString(),
      })),
    })),
  };
}
