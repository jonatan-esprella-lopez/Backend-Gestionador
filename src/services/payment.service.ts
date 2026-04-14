// ============================================================
// payment.service.ts
// Registro de pagos/cobros sobre facturas.
// Genera asiento contable automáticamente.
//
// Invariantes:
//   - El monto no puede exceder el saldo_pendiente de la factura.
//   - La cuenta bancaria debe tener cuenta_contable_id configurada.
//   - El trigger fn_sync_factura_saldo actualiza saldo_pendiente
//     y el estado de la factura (parcial → pagada) automáticamente.
// ============================================================

import { PrismaClient, MetodoPago } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

// ── Tipos públicos ────────────────────────────────────────────

export type RegistrarPagoDto = {
  empresa_id:         string;
  usuario_id:         string;
  factura_id:         string;
  cuenta_bancaria_id: string;
  fecha:              Date;
  monto:              number;
  metodo:             MetodoPago;
  referencia?:        string;
  observaciones?:     string;
};

// ── Helpers privados ──────────────────────────────────────────

async function buscarCuentaPorCodigo(tx: any, empresaId: string, codigo: string) {
  const cuenta = await tx.cuentaContable.findFirst({
    where:  { empresa_id: empresaId, codigo, activo: true },
    select: { id: true },
  });
  if (!cuenta) throw new Error(`Cuenta contable '${codigo}' no encontrada.`);
  return cuenta;
}

async function construirMovimientosPago(
  tx: any,
  empresaId: string,
  tipoFactura: string,
  monto: Decimal,
  cuentaBancariaContableId: string | null
): Promise<{ cuenta_id: string; debe: number; haber: number; orden: number }[]> {
  if (!cuentaBancariaContableId) {
    throw new Error(
      "La cuenta bancaria no tiene cuenta contable asignada. " +
      "Configure el campo 'cuenta_contable_id' en la cuenta bancaria."
    );
  }

  const esVenta = tipoFactura === "venta" || tipoFactura === "ticket_pos";

  if (esVenta) {
    // Cobro: DEBE Banco / HABER Cuentas x Cobrar Clientes
    const cxc = await buscarCuentaPorCodigo(tx, empresaId, "1.1.02");
    return [
      { cuenta_id: cuentaBancariaContableId, debe: monto.toNumber(), haber: 0,               orden: 1 },
      { cuenta_id: cxc.id,                   debe: 0,               haber: monto.toNumber(), orden: 2 },
    ];
  }

  // Pago a proveedor: DEBE Cuentas x Pagar Proveedores / HABER Banco
  const cxp = await buscarCuentaPorCodigo(tx, empresaId, "2.1.01");
  return [
    { cuenta_id: cxp.id,                    debe: monto.toNumber(), haber: 0,               orden: 1 },
    { cuenta_id: cuentaBancariaContableId,  debe: 0,               haber: monto.toNumber(), orden: 2 },
  ];
}

// ── Servicio público ──────────────────────────────────────────

/**
 * Registra un pago/cobro sobre una factura en una transacción atómica.
 * Crea el asiento contable correspondiente (cobro o pago a proveedor).
 * El trigger fn_sync_factura_saldo actualiza saldo_pendiente y estado.
 */
export async function registrarPago(dto: RegistrarPagoDto) {
  const monto = new Decimal(dto.monto);
  if (monto.lte(0)) throw new Error("El monto del pago debe ser mayor a cero.");

  return prisma.$transaction(async (tx) => {
    const factura = await tx.factura.findFirst({
      where:  { id: dto.factura_id, empresa_id: dto.empresa_id },
      select: {
        id: true, numero: true, tipo: true, estado: true, saldo_pendiente: true,
        contacto: { select: { nombre: true, razon_social: true } },
      },
    });
    if (!factura)                    throw new Error("Factura no encontrada.");
    if (factura.estado === "anulada") throw new Error("No se puede pagar una factura anulada.");
    if (factura.estado === "pagada")  throw new Error("La factura ya está completamente pagada.");

    const saldo = new Decimal(factura.saldo_pendiente.toString());
    if (monto.gt(saldo)) {
      throw new Error(
        `El monto ${monto.toFixed(2)} BOB excede el saldo pendiente ${saldo.toFixed(2)} BOB.`
      );
    }

    const cuentaBancaria = await tx.cuentaBancaria.findFirst({
      where:  { id: dto.cuenta_bancaria_id, empresa_id: dto.empresa_id, activo: true },
      select: { id: true, nombre: true, cuenta_contable_id: true },
    });
    if (!cuentaBancaria) throw new Error("Cuenta bancaria no encontrada.");

    const pago = await tx.pago.create({
      data: {
        empresa_id:         dto.empresa_id,
        factura_id:         dto.factura_id,
        cuenta_bancaria_id: dto.cuenta_bancaria_id,
        fecha:              dto.fecha,
        monto:              monto.toFixed(2),
        metodo:             dto.metodo,
        referencia:         dto.referencia  ?? null,
        observaciones:      dto.observaciones ?? null,
        usuario_id:         dto.usuario_id,
      },
      select: { id: true },
    });

    const movimientos = await construirMovimientosPago(
      tx,
      dto.empresa_id,
      factura.tipo,
      monto,
      cuentaBancaria.cuenta_contable_id
    );

    const tipoLabel      = factura.tipo === "compra" ? "Pago" : "Cobro";
    const nombreContacto = factura.contacto.razon_social || factura.contacto.nombre;

    const asiento = await tx.asientoContable.create({
      data: {
        empresa_id:  dto.empresa_id,
        numero:      0, // fn_next_asiento_numero lo asigna
        fecha:       dto.fecha,
        concepto:    `${tipoLabel} Factura ${factura.numero} – ${nombreContacto}`,
        tipo_origen: "pago",
        origen_id:   pago.id,
        usuario_id:  dto.usuario_id,
        estado:      "confirmado",
        total_debe:  monto.toFixed(2),
        total_haber: monto.toFixed(2),
        movimientos: { create: movimientos },
      },
      select: { id: true },
    });

    await tx.pago.update({ where: { id: pago.id }, data: { asiento_id: asiento.id } });

    return {
      pago_id:    pago.id,
      asiento_id: asiento.id,
      monto:      monto.toFixed(2),
    };
  });
}

/**
 * Lista pagos de una empresa con filtros opcionales.
 */
export async function listarPagos(
  empresaId: string,
  filtros: {
    factura_id?: string;
    desde?:      Date;
    hasta?:      Date;
    page?:       number;
    pageSize?:   number;
  }
) {
  const { factura_id, desde, hasta, page = 1, pageSize = 50 } = filtros;

  const where = {
    empresa_id: empresaId,
    ...(factura_id && { factura_id }),
    ...((desde || hasta)
      ? { fecha: { ...(desde && { gte: desde }), ...(hasta && { lte: hasta }) } }
      : {}),
  };

  const [total, pagos] = await Promise.all([
    prisma.pago.count({ where }),
    prisma.pago.findMany({
      where,
      orderBy: { fecha: "desc" },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: {
        factura:         { select: { numero: true, tipo: true } },
        cuenta_bancaria: { select: { nombre: true, banco: true } },
        usuario:         { select: { nombre: true } },
      },
    }),
  ]);

  return { total, page, pageSize, pagos };
}

/**
 * Obtiene un pago por ID con detalle de factura, cuenta bancaria y usuario.
 */
export async function obtenerPago(empresaId: string, pagoId: string) {
  return prisma.pago.findFirst({
    where: { id: pagoId, empresa_id: empresaId },
    include: {
      factura: {
        select: {
          numero: true, tipo: true, total: true, saldo_pendiente: true,
          contacto: { select: { nombre: true, razon_social: true, nit: true } },
        },
      },
      cuenta_bancaria: { select: { nombre: true, banco: true } },
      usuario:         { select: { nombre: true } },
    },
  });
}
