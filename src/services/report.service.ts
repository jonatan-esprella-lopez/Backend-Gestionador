import prisma from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// Helpers de fecha
// ─────────────────────────────────────────────────────────────

function startOfMonth(date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date = new Date()): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toNum(val: unknown): number {
  if (val === null || val === undefined) return 0;
  return Number(val);
}

// ─────────────────────────────────────────────────────────────
// getSummary
// KPIs del dashboard — balance mensual y anual
// ─────────────────────────────────────────────────────────────
export async function getSummary(empresaId: string) {
  const ahora       = new Date();
  const inicioMes   = startOfMonth(ahora);
  const inicioAnio  = startOfYear(ahora);

  const [
    ingresoMes,
    gastoMes,
    ingresoAnio,
    gastoAnio,
    pendientesPorCobrar,
    pendientesPorPagar,
  ] = await prisma.$transaction([
    // Ingresos completados del mes
    prisma.transaccion.aggregate({
      where: { empresa_id: empresaId, tipo: "income", estado: "completed", fecha: { gte: inicioMes } },
      _sum: { monto: true },
    }),
    // Gastos completados del mes
    prisma.transaccion.aggregate({
      where: { empresa_id: empresaId, tipo: "expense", estado: "completed", fecha: { gte: inicioMes } },
      _sum: { monto: true },
    }),
    // Ingresos completados del año
    prisma.transaccion.aggregate({
      where: { empresa_id: empresaId, tipo: "income", estado: "completed", fecha: { gte: inicioAnio } },
      _sum: { monto: true },
    }),
    // Gastos completados del año
    prisma.transaccion.aggregate({
      where: { empresa_id: empresaId, tipo: "expense", estado: "completed", fecha: { gte: inicioAnio } },
      _sum: { monto: true },
    }),
    // Pendientes por cobrar (income pending/overdue)
    prisma.transaccion.aggregate({
      where: { empresa_id: empresaId, tipo: "income", estado: { in: ["pending", "overdue"] } },
      _sum: { monto: true },
    }),
    // Pendientes por pagar (expense pending/overdue)
    prisma.transaccion.aggregate({
      where: { empresa_id: empresaId, tipo: "expense", estado: { in: ["pending", "overdue"] } },
      _sum: { monto: true },
    }),
  ]);

  const ingMes  = toNum(ingresoMes._sum.monto);
  const gstMes  = toNum(gastoMes._sum.monto);
  const ingAnio = toNum(ingresoAnio._sum.monto);
  const gstAnio = toNum(gastoAnio._sum.monto);

  return {
    mensual: {
      ingresos:        ingMes,
      gastos:          gstMes,
      balance:         ingMes - gstMes,
    },
    anual: {
      ingresos:        ingAnio,
      gastos:          gstAnio,
      balance:         ingAnio - gstAnio,
    },
    pendientes: {
      por_cobrar: toNum(pendientesPorCobrar._sum.monto),
      por_pagar:  toNum(pendientesPorPagar._sum.monto),
    },
    periodo: {
      inicio_mes:  inicioMes.toISOString().split("T")[0],
      inicio_anio: inicioAnio.toISOString().split("T")[0],
      hoy:         ahora.toISOString().split("T")[0],
    },
  };
}

// ─────────────────────────────────────────────────────────────
// getCashflow
// Flujo de caja diario — últimos 30 días
// Devuelve por día: income, expense, neto
// ─────────────────────────────────────────────────────────────
export async function getCashflow(empresaId: string) {
  const desde = daysAgo(29); // 30 días incluyendo hoy

  const [incomePorDia, expensePorDia] = await prisma.$transaction([
    prisma.transaccion.groupBy({
      by:    ["fecha"],
      where: { empresa_id: empresaId, tipo: "income", estado: "completed", fecha: { gte: desde } },
      _sum:  { monto: true },
      orderBy: { fecha: "asc" },
    }),
    prisma.transaccion.groupBy({
      by:    ["fecha"],
      where: { empresa_id: empresaId, tipo: "expense", estado: "completed", fecha: { gte: desde } },
      _sum:  { monto: true },
      orderBy: { fecha: "asc" },
    }),
  ]);

  // Construir mapa fecha → valores
  const mapaIncome  = new Map<string, number>();
  const mapaExpense = new Map<string, number>();

  for (const row of incomePorDia) {
    const key = row.fecha.toISOString().split("T")[0];
    mapaIncome.set(key, toNum(row._sum.monto));
  }
  for (const row of expensePorDia) {
    const key = row.fecha.toISOString().split("T")[0];
    mapaExpense.set(key, toNum(row._sum.monto));
  }

  // Generar serie completa de 30 días (sin huecos)
  const serie: Array<{ fecha: string; income: number; expense: number; neto: number }> = [];

  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const fecha   = d.toISOString().split("T")[0];
    const income  = mapaIncome.get(fecha)  ?? 0;
    const expense = mapaExpense.get(fecha) ?? 0;

    serie.push({ fecha, income, expense, neto: income - expense });
  }

  return { data: serie };
}

// ─────────────────────────────────────────────────────────────
// getByCategory
// Breakdown de ingresos y gastos por categoría.
// Acepta rango de fechas opcional; por defecto: mes actual.
// ─────────────────────────────────────────────────────────────
export async function getByCategory(
  empresaId: string,
  fechaDesde?: string,
  fechaHasta?: string
) {
  const desde = fechaDesde ? new Date(fechaDesde) : startOfMonth();
  const hasta = fechaHasta ? new Date(fechaHasta) : new Date();

  const [agrupado, categorias] = await prisma.$transaction([
    prisma.transaccion.groupBy({
      by:    ["categoria_id", "tipo"],
      where: {
        empresa_id: empresaId,
        estado:     "completed",
        fecha:      { gte: desde, lte: hasta },
      },
      _sum:   { monto: true },
      _count: { id: true },
    }),
    prisma.categoriaTransaccion.findMany({
      where: { OR: [{ empresa_id: null }, { empresa_id: empresaId }] },
      select: { id: true, nombre: true, tipo: true },
    }),
  ]);

  const catMap = new Map(categorias.map((c) => [c.id, c]));

  const income: Array<{ categoria: string; total: number; count: number }> = [];
  const expense: Array<{ categoria: string; total: number; count: number }> = [];

  for (const row of agrupado) {
    const cat = catMap.get(row.categoria_id);
    const entry = {
      categoria_id: row.categoria_id,
      categoria:    cat?.nombre ?? "Sin categoría",
      total:        toNum(row._sum.monto),
      count:        row._count.id,
    };

    if (row.tipo === "income")  income.push(entry);
    else                        expense.push(entry);
  }

  // Ordenar de mayor a menor
  income.sort((a, b)  => b.total - a.total);
  expense.sort((a, b) => b.total - a.total);

  return {
    periodo: {
      desde: desde.toISOString().split("T")[0],
      hasta: hasta.toISOString().split("T")[0],
    },
    income,
    expense,
  };
}

// ─────────────────────────────────────────────────────────────
// getInventoryValuation
// Valoración del inventario: stock × precio_costo y × precio_venta
// Solo items activos con stock > 0
// ─────────────────────────────────────────────────────────────
export async function getInventoryValuation(empresaId: string) {
  const items = await prisma.inventarioItem.findMany({
    where:  { empresa_id: empresaId, activo: true },
    select: {
      id:           true,
      sku:          true,
      nombre:       true,
      tipo_item:    true,
      stock:        true,
      precio_costo: true,
      precio_venta: true,
      categoria:    { select: { nombre: true } },
    },
    orderBy: { nombre: "asc" },
  });

  let totalCosto = 0;
  let totalVenta = 0;

  const detalle = items.map((item) => {
    const stock       = toNum(item.stock);
    const costo       = toNum(item.precio_costo);
    const venta       = item.precio_venta !== null ? toNum(item.precio_venta) : null;
    const valorCosto  = stock * costo;
    const valorVenta  = venta !== null ? stock * venta : null;

    totalCosto += valorCosto;
    if (valorVenta !== null) totalVenta += valorVenta;

    return {
      id:           item.id,
      sku:          item.sku,
      nombre:       item.nombre,
      tipo_item:    item.tipo_item,
      categoria:    item.categoria?.nombre ?? null,
      stock,
      precio_costo: costo,
      precio_venta: venta,
      valor_costo:  valorCosto,
      valor_venta:  valorVenta,
    };
  });

  return {
    total_costo: totalCosto,
    total_venta: totalVenta,
    detalle,
  };
}
