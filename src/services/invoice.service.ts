// ============================================================
// invoice.service.ts
// Gestión de facturas de venta, compra y ticket POS.
// Genera asiento contable automáticamente al emitir.
//
// Invariantes:
//   - Una factura EMITIDA siempre tiene un asiento confirmado.
//   - Solo se puede anular si no tiene pagos registrados.
//   - La numeración es secuencial por empresa+tipo (FV, FC, TP).
//   - saldo_pendiente es mantenido por el trigger fn_sync_factura_saldo.
// ============================================================

import { PrismaClient, TipoFactura, EstadoFactura } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

// ── Tipos públicos ────────────────────────────────────────────

export type LineaFacturaInput = {
  item_id?:                string;
  descripcion:             string;
  cantidad:                number;
  precio_unitario:         number;
  tasa_impuesto_id?:       string;
  cuenta_ingreso_gasto_id?: string;
  orden:                   number;
};

export type CrearFacturaDto = {
  empresa_id:         string;
  usuario_id:         string;
  tipo:               TipoFactura;
  contacto_id:        string;
  fecha_emision:      Date;
  fecha_vencimiento:  Date;
  observaciones?:     string;
  lineas:             LineaFacturaInput[];
  emitir?:            boolean; // true (default) → estado=emitida + asiento generado
};

// ── Tipos internos ────────────────────────────────────────────

type TasaImpuestoResumen = {
  id:                string;
  porcentaje:        Decimal;
  cuenta_debito_id:  string | null;
  cuenta_credito_id: string | null;
};

type LineaCalculada = {
  input:    LineaFacturaInput;
  subtotal: Decimal;
  impuesto: Decimal;
  total:    Decimal;
  tasa?:    TasaImpuestoResumen;
};

type MovimientoData = {
  cuenta_id: string;
  debe:      number;
  haber:     number;
  orden:     number;
};

// ── Helpers privados ──────────────────────────────────────────

async function buscarCuentaPorCodigo(tx: any, empresaId: string, codigo: string) {
  const cuenta = await tx.cuentaContable.findFirst({
    where:  { empresa_id: empresaId, codigo, activo: true },
    select: { id: true, codigo: true },
  });
  if (!cuenta) {
    throw new Error(
      `Cuenta contable '${codigo}' no encontrada. Inicialice el plan de cuentas de la empresa.`
    );
  }
  return cuenta;
}

async function generarNumeroFactura(
  tx: any,
  empresaId: string,
  tipo: TipoFactura
): Promise<string> {
  const count = await tx.factura.count({ where: { empresa_id: empresaId, tipo } });
  const prefix: Record<TipoFactura, string> = { venta: "FV", compra: "FC", ticket_pos: "TP" };
  return `${prefix[tipo]}-${String(count + 1).padStart(5, "0")}`;
}

async function calcularLineas(
  tx: any,
  empresaId: string,
  inputs: LineaFacturaInput[]
): Promise<LineaCalculada[]> {
  const tasaIds = [
    ...new Set(inputs.map((l) => l.tasa_impuesto_id).filter(Boolean)),
  ] as string[];

  const tasas = tasaIds.length
    ? await tx.tasaImpuesto.findMany({
        where:  { id: { in: tasaIds }, empresa_id: empresaId, activo: true },
        select: { id: true, porcentaje: true, cuenta_debito_id: true, cuenta_credito_id: true },
      })
    : [];

  const tasaMap = new Map<string, TasaImpuestoResumen>(
    tasas.map((t: any) => [
      t.id,
      { ...t, porcentaje: new Decimal(t.porcentaje.toString()) },
    ])
  );

  return inputs.map((input) => {
    const tasa     = input.tasa_impuesto_id ? tasaMap.get(input.tasa_impuesto_id) : undefined;
    const subtotal = new Decimal(input.cantidad).times(input.precio_unitario).toDecimalPlaces(2);
    const impuesto = tasa
      ? subtotal.times(tasa.porcentaje).dividedBy(100).toDecimalPlaces(2)
      : new Decimal(0);
    return { input, subtotal, impuesto, total: subtotal.plus(impuesto), tasa };
  });
}

async function construirMovimientosVenta(
  tx: any,
  empresaId: string,
  lineas: LineaCalculada[],
  totalFactura: Decimal
): Promise<MovimientoData[]> {
  const cxc          = await buscarCuentaPorCodigo(tx, empresaId, "1.1.02");
  const ventasDefault = await buscarCuentaPorCodigo(tx, empresaId, "4.1.01");

  const movimientos: MovimientoData[] = [];
  let orden = 1;

  // DEBE: Cuentas x Cobrar Clientes = total de la factura
  movimientos.push({ cuenta_id: cxc.id, debe: totalFactura.toNumber(), haber: 0, orden: orden++ });

  // HABER: por cada línea → ingreso + IVA débito
  for (const linea of lineas) {
    const cuentaId = linea.input.cuenta_ingreso_gasto_id ?? ventasDefault.id;
    movimientos.push({ cuenta_id: cuentaId, debe: 0, haber: linea.subtotal.toNumber(), orden: orden++ });

    if (linea.tasa && linea.impuesto.gt(0) && linea.tasa.cuenta_credito_id) {
      movimientos.push({
        cuenta_id: linea.tasa.cuenta_credito_id,
        debe:  0,
        haber: linea.impuesto.toNumber(),
        orden: orden++,
      });
    }
  }

  return movimientos;
}

async function construirMovimientosCompra(
  tx: any,
  empresaId: string,
  lineas: LineaCalculada[],
  totalFactura: Decimal
): Promise<MovimientoData[]> {
  const cxp          = await buscarCuentaPorCodigo(tx, empresaId, "2.1.01");
  const gastosDefault = await buscarCuentaPorCodigo(tx, empresaId, "5.1.01");

  const movimientos: MovimientoData[] = [];
  let orden = 1;

  // DEBE: por cada línea → gasto + IVA crédito fiscal
  for (const linea of lineas) {
    const cuentaId = linea.input.cuenta_ingreso_gasto_id ?? gastosDefault.id;
    movimientos.push({ cuenta_id: cuentaId, debe: linea.subtotal.toNumber(), haber: 0, orden: orden++ });

    if (linea.tasa && linea.impuesto.gt(0) && linea.tasa.cuenta_debito_id) {
      movimientos.push({
        cuenta_id: linea.tasa.cuenta_debito_id,
        debe:  linea.impuesto.toNumber(),
        haber: 0,
        orden: orden++,
      });
    }
  }

  // HABER: Cuentas x Pagar Proveedores = total de la factura
  movimientos.push({ cuenta_id: cxp.id, debe: 0, haber: totalFactura.toNumber(), orden: orden++ });

  return movimientos;
}

async function crearAsientoFactura(
  tx: any,
  empresaId: string,
  usuarioId: string,
  facturaId: string,
  numero: string,
  tipo: TipoFactura,
  fecha: Date,
  lineas: LineaCalculada[],
  total: Decimal,
  nombreContacto: string
): Promise<string> {
  const movimientos =
    tipo === "compra"
      ? await construirMovimientosCompra(tx, empresaId, lineas, total)
      : await construirMovimientosVenta(tx, empresaId, lineas, total);

  const asiento = await tx.asientoContable.create({
    data: {
      empresa_id:  empresaId,
      numero:      0, // fn_next_asiento_numero lo sobreescribe
      fecha,
      concepto:    `${numero} – ${nombreContacto}`,
      tipo_origen: "factura",
      origen_id:   facturaId,
      usuario_id:  usuarioId,
      estado:      "confirmado",
      total_debe:  total.toFixed(2),
      total_haber: total.toFixed(2),
      movimientos: { create: movimientos },
    },
    select: { id: true },
  });

  return asiento.id;
}

// ── Servicio público ──────────────────────────────────────────

/**
 * Crea una factura con sus líneas en una transacción atómica.
 * Si `emitir = true` (default), genera el asiento contable y
 * pasa el estado a 'emitida'. De lo contrario queda en 'borrador'.
 */
export async function crearFactura(dto: CrearFacturaDto) {
  if (dto.lineas.length === 0) {
    throw new Error("La factura debe tener al menos una línea.");
  }

  const emitir = dto.emitir ?? true;

  return prisma.$transaction(async (tx) => {
    const contacto = await tx.contacto.findFirst({
      where:  { id: dto.contacto_id, empresa_id: dto.empresa_id },
      select: { id: true, nombre: true, razon_social: true, es_cliente: true, es_proveedor: true },
    });
    if (!contacto) throw new Error("Contacto no encontrado en esta empresa.");

    if (dto.tipo === "venta" || dto.tipo === "ticket_pos") {
      if (!contacto.es_cliente) throw new Error("El contacto no está marcado como cliente.");
    }
    if (dto.tipo === "compra") {
      if (!contacto.es_proveedor) throw new Error("El contacto no está marcado como proveedor.");
    }

    const lineas          = await calcularLineas(tx, dto.empresa_id, dto.lineas);
    const subtotal        = lineas.reduce((acc, l) => acc.plus(l.subtotal), new Decimal(0));
    const totalImpuestos  = lineas.reduce((acc, l) => acc.plus(l.impuesto), new Decimal(0));
    const total           = subtotal.plus(totalImpuestos);
    const numero          = await generarNumeroFactura(tx, dto.empresa_id, dto.tipo);

    const factura = await tx.factura.create({
      data: {
        empresa_id:        dto.empresa_id,
        tipo:              dto.tipo,
        numero,
        contacto_id:       dto.contacto_id,
        usuario_id:        dto.usuario_id,
        fecha_emision:     dto.fecha_emision,
        fecha_vencimiento: dto.fecha_vencimiento,
        moneda_codigo:     "BOB",
        subtotal:          subtotal.toFixed(2),
        total_impuestos:   totalImpuestos.toFixed(2),
        total:             total.toFixed(2),
        saldo_pendiente:   total.toFixed(2),
        estado:            emitir ? "emitida" : "borrador",
        observaciones:     dto.observaciones ?? null,
        lineas: {
          create: lineas.map((l) => ({
            item_id:                 l.input.item_id ?? null,
            descripcion:             l.input.descripcion,
            cantidad:                l.input.cantidad,
            precio_unitario:         l.input.precio_unitario,
            subtotal_linea:          l.subtotal.toFixed(2),
            tasa_impuesto_id:        l.input.tasa_impuesto_id ?? null,
            monto_impuesto:          l.impuesto.toFixed(2),
            total_linea:             l.total.toFixed(2),
            cuenta_ingreso_gasto_id: l.input.cuenta_ingreso_gasto_id ?? null,
            orden:                   l.input.orden,
          })),
        },
      },
      select: { id: true, numero: true, estado: true, total: true, saldo_pendiente: true },
    });

    if (!emitir) return { ...factura, asiento_id: null };

    const nombreContacto = contacto.razon_social || contacto.nombre;
    const asientoId = await crearAsientoFactura(
      tx,
      dto.empresa_id,
      dto.usuario_id,
      factura.id,
      numero,
      dto.tipo,
      dto.fecha_emision,
      lineas,
      total,
      nombreContacto
    );

    await tx.factura.update({ where: { id: factura.id }, data: { asiento_id: asientoId } });

    return { ...factura, asiento_id: asientoId };
  });
}

/**
 * Lista facturas de una empresa con filtros opcionales y paginación.
 */
export async function listarFacturas(
  empresaId: string,
  filtros: {
    tipo?:        TipoFactura;
    estado?:      EstadoFactura;
    contacto_id?: string;
    desde?:       Date;
    hasta?:       Date;
    page?:        number;
    pageSize?:    number;
  }
) {
  const { tipo, estado, contacto_id, desde, hasta, page = 1, pageSize = 50 } = filtros;

  const where = {
    empresa_id: empresaId,
    ...(tipo        && { tipo }),
    ...(estado      && { estado }),
    ...(contacto_id && { contacto_id }),
    ...((desde || hasta)
      ? { fecha_emision: { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) } }
      : {}),
  };

  const [total, facturas] = await Promise.all([
    prisma.factura.count({ where }),
    prisma.factura.findMany({
      where,
      orderBy: [{ fecha_emision: "desc" }, { numero: "desc" }],
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: {
        contacto: { select: { nombre: true, razon_social: true, nit: true } },
        usuario:  { select: { nombre: true } },
        _count:   { select: { lineas: true, pagos: true } },
      },
    }),
  ]);

  return { total, page, pageSize, facturas };
}

/**
 * Obtiene una factura completa con líneas, pagos y contacto.
 */
export async function obtenerFactura(empresaId: string, facturaId: string) {
  return prisma.factura.findFirst({
    where: { id: facturaId, empresa_id: empresaId },
    include: {
      contacto: true,
      usuario:  { select: { nombre: true } },
      lineas: {
        include: {
          tasa_impuesto: { select: { nombre: true, porcentaje: true } },
          item:          { select: { nombre: true, sku: true } },
        },
        orderBy: { orden: "asc" },
      },
      pagos: {
        include: { cuenta_bancaria: { select: { nombre: true, banco: true } } },
        orderBy: { fecha: "asc" },
      },
    },
  });
}

/**
 * Anula una factura emitida. Requiere que no tenga pagos registrados.
 * Si tiene asiento contable, lo reversa en la misma transacción.
 */
export async function anularFactura(
  empresaId: string,
  facturaId: string,
  usuarioId: string,
  motivo: string
) {
  const factura = await prisma.factura.findFirst({
    where:   { id: facturaId, empresa_id: empresaId },
    include: { pagos: { select: { id: true } } },
  });

  if (!factura)                  throw new Error("Factura no encontrada.");
  if (factura.estado === "anulada") throw new Error("La factura ya está anulada.");
  if (factura.pagos.length > 0)  throw new Error("No se puede anular: la factura tiene pagos registrados.");

  return prisma.$transaction(async (tx) => {
    if (factura.asiento_id) {
      await reversarAsientoFactura(tx, empresaId, usuarioId, factura.asiento_id, factura.numero, motivo);
    }

    return tx.factura.update({
      where:  { id: facturaId },
      data:   { estado: "anulada" },
      select: { id: true, numero: true, estado: true },
    });
  });
}

async function reversarAsientoFactura(
  tx: any,
  empresaId: string,
  usuarioId: string,
  asientoId: string,
  numeroFactura: string,
  motivo: string
) {
  const original = await tx.asientoContable.findUnique({
    where:   { id: asientoId },
    include: { movimientos: true },
  });

  if (!original || original.estado !== "confirmado") return;

  const movimientosInversos = original.movimientos.map((m: any, idx: number) => ({
    cuenta_id: m.cuenta_id,
    debe:      Number(m.haber),
    haber:     Number(m.debe),
    orden:     idx + 1,
  }));

  await tx.asientoContable.create({
    data: {
      empresa_id:           empresaId,
      numero:               0,
      fecha:                new Date(),
      concepto:             `REVERSIÓN: ${motivo} (Factura ${numeroFactura})`,
      tipo_origen:          "reversion",
      origen_id:            original.origen_id,
      asiento_reversion_id: asientoId,
      usuario_id:           usuarioId,
      estado:               "confirmado",
      total_debe:           original.total_haber.toString(),
      total_haber:          original.total_debe.toString(),
      movimientos:          { create: movimientosInversos },
    },
  });

  await tx.asientoContable.update({ where: { id: asientoId }, data: { estado: "anulado" } });
}
