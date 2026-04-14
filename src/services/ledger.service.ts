// ============================================================
// ledger.service.ts — Libro Mayor, Balance de Comprobación,
//                      Balance General, Estado de Resultados
// ============================================================

import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

type FiltroPeriodo = {
  desde?:    Date;
  hasta?:    Date;
  page?:     number;
  pageSize?: number;
};

// ── Helpers privados ──────────────────────────────────────────

function saldoNeto(debe: Decimal, haber: Decimal, naturaleza: string): Decimal {
  return naturaleza === "deudora" ? debe.minus(haber) : haber.minus(debe);
}

/**
 * Obtiene IDs de asientos confirmados en el rango.
 * Necesario porque Prisma no soporta filtros de relación en `groupBy`.
 */
async function asientoIdsConfirmados(
  empresaId: string,
  desde?:    Date,
  hasta?:    Date
): Promise<string[]> {
  const rows = await prisma.asientoContable.findMany({
    where: {
      empresa_id: empresaId,
      estado:     "confirmado",
      ...(desde || hasta
        ? { fecha: { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) } }
        : {}),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// ── Funciones públicas ────────────────────────────────────────

/**
 * Libro Mayor de una cuenta: movimientos con saldo acumulado.
 * saldo_anterior = saldo neto antes de `desde`.
 * En páginas > 1 el saldo acumulado parte desde el inicio del período.
 */
export async function libroMayor(
  empresaId: string,
  cuentaId:  string,
  filtros:   FiltroPeriodo
) {
  const { desde, hasta, page = 1, pageSize = 100 } = filtros;

  const cuenta = await prisma.cuentaContable.findFirst({
    where: { id: cuentaId, empresa_id: empresaId },
  });
  if (!cuenta) throw new Error("Cuenta contable no encontrada.");

  const naturaleza = cuenta.naturaleza;

  // Saldo acumulado antes del período
  let saldoAnterior = new Decimal(0);
  if (desde) {
    const agg = await prisma.movimientoContable.aggregate({
      where: {
        cuenta_id: cuentaId,
        asiento:   { empresa_id: empresaId, estado: "confirmado", fecha: { lt: desde } },
      },
      _sum: { debe: true, haber: true },
    });
    const d = new Decimal(agg._sum.debe?.toString()  ?? "0");
    const h = new Decimal(agg._sum.haber?.toString() ?? "0");
    saldoAnterior = saldoNeto(d, h, naturaleza);
  }

  const where = {
    cuenta_id: cuentaId,
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
    saldo = naturaleza === "deudora"
      ? saldo.plus(debe).minus(haber)
      : saldo.plus(haber).minus(debe);
    return {
      id:          m.id,
      asiento_id:  m.asiento.id,
      numero:      m.asiento.numero,
      fecha:       m.asiento.fecha,
      concepto:    m.asiento.concepto,
      tipo_origen: m.asiento.tipo_origen,
      descripcion: m.descripcion ?? undefined,
      debe:        debe.toFixed(2),
      haber:       haber.toFixed(2),
      saldo:       saldo.toFixed(2),
    };
  });

  return {
    cuenta: {
      id:         cuenta.id,
      codigo:     cuenta.codigo,
      nombre:     cuenta.nombre,
      tipo:       cuenta.tipo,
      naturaleza: cuenta.naturaleza,
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
 * Balance de Comprobación: todas las cuentas con movimientos hasta
 * `fecha`, mostrando total_debe, total_haber y saldo neto.
 */
export async function balanceComprobacion(empresaId: string, fecha: Date) {
  const asientoIds = await asientoIdsConfirmados(empresaId, undefined, fecha);

  if (asientoIds.length === 0) {
    return {
      fecha:       fecha.toISOString().split("T")[0],
      cuentas:     [],
      total_debe:  "0.00",
      total_haber: "0.00",
      cuadrado:    true,
    };
  }

  const aggregates = await prisma.movimientoContable.groupBy({
    by:    ["cuenta_id"],
    where: { asiento_id: { in: asientoIds } },
    _sum:  { debe: true, haber: true },
  });

  const cuentas = await prisma.cuentaContable.findMany({
    where:   { id: { in: aggregates.map((a) => a.cuenta_id) }, empresa_id: empresaId },
    orderBy: { codigo: "asc" },
  });
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c]));

  let totalDebe  = new Decimal(0);
  let totalHaber = new Decimal(0);

  const resultado = aggregates
    .map((agg) => {
      const cuenta = cuentaMap.get(agg.cuenta_id);
      if (!cuenta) return null;
      const debe  = new Decimal(agg._sum.debe?.toString()  ?? "0");
      const haber = new Decimal(agg._sum.haber?.toString() ?? "0");
      totalDebe  = totalDebe.plus(debe);
      totalHaber = totalHaber.plus(haber);
      return {
        id:          cuenta.id,
        codigo:      cuenta.codigo,
        nombre:      cuenta.nombre,
        tipo:        cuenta.tipo,
        naturaleza:  cuenta.naturaleza,
        total_debe:  debe.toFixed(2),
        total_haber: haber.toFixed(2),
        saldo:       saldoNeto(debe, haber, cuenta.naturaleza).toFixed(2),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  return {
    fecha:       fecha.toISOString().split("T")[0],
    cuentas:     resultado,
    total_debe:  totalDebe.toFixed(2),
    total_haber: totalHaber.toFixed(2),
    cuadrado:    totalDebe.equals(totalHaber),
  };
}

/**
 * Balance General: cuentas de activo, pasivo y patrimonio con
 * saldos netos acumulados hasta `fecha`.
 */
export async function balanceGeneral(empresaId: string, fecha: Date) {
  const asientoIds = await asientoIdsConfirmados(empresaId, undefined, fecha);

  const activos:    { codigo: string; nombre: string; saldo: string }[] = [];
  const pasivos:    { codigo: string; nombre: string; saldo: string }[] = [];
  const patrimonio: { codigo: string; nombre: string; saldo: string }[] = [];
  let totalActivo        = new Decimal(0);
  let totalPasPatrimonio = new Decimal(0);

  if (asientoIds.length === 0) {
    return {
      fecha: fecha.toISOString().split("T")[0],
      activos, pasivos, patrimonio,
      total_activo:            "0.00",
      total_pasivo_patrimonio: "0.00",
      cuadrado:                true,
    };
  }

  const aggregates = await prisma.movimientoContable.groupBy({
    by:    ["cuenta_id"],
    where: { asiento_id: { in: asientoIds } },
    _sum:  { debe: true, haber: true },
  });

  const cuentas = await prisma.cuentaContable.findMany({
    where: {
      id:         { in: aggregates.map((a) => a.cuenta_id) },
      empresa_id: empresaId,
      tipo:       { in: ["activo", "pasivo", "patrimonio"] },
    },
    orderBy: { codigo: "asc" },
  });
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c]));

  for (const agg of aggregates) {
    const cuenta = cuentaMap.get(agg.cuenta_id);
    if (!cuenta) continue;
    const debe  = new Decimal(agg._sum.debe?.toString()  ?? "0");
    const haber = new Decimal(agg._sum.haber?.toString() ?? "0");
    const saldo = saldoNeto(debe, haber, cuenta.naturaleza);
    if (saldo.isZero()) continue;

    const item = { codigo: cuenta.codigo, nombre: cuenta.nombre, saldo: saldo.toFixed(2) };

    if (cuenta.tipo === "activo") {
      activos.push(item);
      totalActivo = totalActivo.plus(saldo);
    } else if (cuenta.tipo === "pasivo") {
      pasivos.push(item);
      totalPasPatrimonio = totalPasPatrimonio.plus(saldo);
    } else {
      patrimonio.push(item);
      totalPasPatrimonio = totalPasPatrimonio.plus(saldo);
    }
  }

  activos.sort(   (a, b) => a.codigo.localeCompare(b.codigo));
  pasivos.sort(   (a, b) => a.codigo.localeCompare(b.codigo));
  patrimonio.sort((a, b) => a.codigo.localeCompare(b.codigo));

  return {
    fecha: fecha.toISOString().split("T")[0],
    activos,
    pasivos,
    patrimonio,
    total_activo:            totalActivo.toFixed(2),
    total_pasivo_patrimonio: totalPasPatrimonio.toFixed(2),
    cuadrado:                totalActivo.equals(totalPasPatrimonio),
  };
}

/**
 * Estado de Resultados: ingresos y gastos en el período.
 */
export async function estadoResultados(empresaId: string, desde: Date, hasta: Date) {
  const asientoIds = await asientoIdsConfirmados(empresaId, desde, hasta);

  const ingresos: { codigo: string; nombre: string; monto: string }[] = [];
  const gastos:   { codigo: string; nombre: string; monto: string }[] = [];
  let totalIngresos = new Decimal(0);
  let totalGastos   = new Decimal(0);

  if (asientoIds.length === 0) {
    return {
      desde: desde.toISOString().split("T")[0],
      hasta: hasta.toISOString().split("T")[0],
      ingresos, gastos,
      total_ingresos: "0.00",
      total_gastos:   "0.00",
      utilidad_neta:  "0.00",
    };
  }

  const aggregates = await prisma.movimientoContable.groupBy({
    by:    ["cuenta_id"],
    where: { asiento_id: { in: asientoIds } },
    _sum:  { debe: true, haber: true },
  });

  const cuentas = await prisma.cuentaContable.findMany({
    where: {
      id:         { in: aggregates.map((a) => a.cuenta_id) },
      empresa_id: empresaId,
      tipo:       { in: ["ingreso", "gasto"] },
    },
    orderBy: { codigo: "asc" },
  });
  const cuentaMap = new Map(cuentas.map((c) => [c.id, c]));

  for (const agg of aggregates) {
    const cuenta = cuentaMap.get(agg.cuenta_id);
    if (!cuenta) continue;
    const debe  = new Decimal(agg._sum.debe?.toString()  ?? "0");
    const haber = new Decimal(agg._sum.haber?.toString() ?? "0");
    const monto = saldoNeto(debe, haber, cuenta.naturaleza);
    if (monto.isZero()) continue;

    const item = { codigo: cuenta.codigo, nombre: cuenta.nombre, monto: monto.toFixed(2) };

    if (cuenta.tipo === "ingreso") {
      ingresos.push(item);
      totalIngresos = totalIngresos.plus(monto);
    } else {
      gastos.push(item);
      totalGastos = totalGastos.plus(monto);
    }
  }

  ingresos.sort((a, b) => a.codigo.localeCompare(b.codigo));
  gastos.sort(  (a, b) => a.codigo.localeCompare(b.codigo));

  return {
    desde:          desde.toISOString().split("T")[0],
    hasta:          hasta.toISOString().split("T")[0],
    ingresos,
    gastos,
    total_ingresos: totalIngresos.toFixed(2),
    total_gastos:   totalGastos.toFixed(2),
    utilidad_neta:  totalIngresos.minus(totalGastos).toFixed(2),
  };
}
