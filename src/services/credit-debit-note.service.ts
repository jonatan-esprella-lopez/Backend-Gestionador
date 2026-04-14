// ============================================================
// credit-debit-note.service.ts
// Notas de Crédito y Débito sobre facturas emitidas.
//
// Invariantes:
//   - Nota de crédito: reversa el asiento de la factura y la anula.
//     Requiere que la factura tenga asiento contable.
//   - Nota de débito: cargo adicional; genera asiento nuevo con
//     las mismas cuentas que el tipo de factura original.
//   - No se puede emitir nota sobre una factura en borrador o anulada.
// ============================================================

import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

// ── Tipos públicos ────────────────────────────────────────────

export type CrearNotaDto = {
  empresa_id: string;
  usuario_id: string;
  factura_id: string;
  tipo:       "credito" | "debito";
  motivo:     string;
  monto?:     number; // requerido para debito; para credito usa factura.total
  fecha?:     Date;
};

// ── Helpers privados ──────────────────────────────────────────

async function buscarCuentaPorCodigo(tx: any, empresaId: string, codigo: string) {
  const cuenta = await tx.cuentaContable.findFirst({
    where:  { empresa_id: empresaId, codigo, activo: true },
    select: { id: true },
  });
  if (!cuenta) {
    throw new Error(`Cuenta contable '${codigo}' no encontrada. Inicialice el plan de cuentas.`);
  }
  return cuenta;
}

async function generarNumeroNota(
  tx: any,
  empresaId: string,
  tipo: "credito" | "debito"
): Promise<string> {
  const count = await tx.notaCreditoDebito.count({ where: { empresa_id: empresaId, tipo } });
  const prefix = tipo === "credito" ? "NC" : "ND";
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

/**
 * Crea el asiento de una Nota de Crédito: invierte todos los
 * movimientos del asiento original de la factura.
 */
async function crearAsientoNotaCredito(
  tx: any,
  empresaId: string,
  usuarioId: string,
  asientoFacturaId: string,
  notaId: string,
  notaNumero: string,
  motivo: string,
  fecha: Date
): Promise<string> {
  const original = await tx.asientoContable.findUnique({
    where:   { id: asientoFacturaId },
    include: { movimientos: true },
  });

  if (!original || original.estado !== "confirmado") {
    throw new Error("El asiento de la factura no está disponible para reversar.");
  }

  const movimientosInversos = original.movimientos.map((m: any, idx: number) => ({
    cuenta_id:   m.cuenta_id,
    debe:        Number(m.haber),
    haber:       Number(m.debe),
    descripcion: m.descripcion ?? null,
    contacto_id: m.contacto_id ?? null,
    orden:       idx + 1,
  }));

  const nuevoAsiento = await tx.asientoContable.create({
    data: {
      empresa_id:           empresaId,
      numero:               0,
      fecha,
      concepto:             `${notaNumero} – ${motivo}`,
      tipo_origen:          "nota_credito",
      origen_id:            notaId,
      asiento_reversion_id: asientoFacturaId,
      usuario_id:           usuarioId,
      estado:               "confirmado",
      total_debe:           original.total_haber.toString(),
      total_haber:          original.total_debe.toString(),
      movimientos:          { create: movimientosInversos },
    },
    select: { id: true },
  });

  await tx.asientoContable.update({
    where: { id: asientoFacturaId },
    data:  { estado: "anulado" },
  });

  return nuevoAsiento.id;
}

/**
 * Crea el asiento de una Nota de Débito: cargo adicional al cliente
 * (venta) o al proveedor (compra).
 */
async function crearAsientoNotaDebito(
  tx: any,
  empresaId: string,
  usuarioId: string,
  tipoFactura: string,
  notaId: string,
  notaNumero: string,
  motivo: string,
  monto: Decimal,
  fecha: Date
): Promise<string> {
  type Mov = { cuenta_id: string; debe: number; haber: number; orden: number };
  let movimientos: Mov[];

  if (tipoFactura === "compra") {
    // Cargo adicional del proveedor → aumenta gasto y CxP
    const gastos = await buscarCuentaPorCodigo(tx, empresaId, "5.1.01");
    const cxp    = await buscarCuentaPorCodigo(tx, empresaId, "2.1.01");
    movimientos = [
      { cuenta_id: gastos.id, debe: monto.toNumber(), haber: 0,               orden: 1 },
      { cuenta_id: cxp.id,   debe: 0,               haber: monto.toNumber(), orden: 2 },
    ];
  } else {
    // Cargo adicional al cliente (venta / ticket_pos) → aumenta CxC e ingreso
    const cxc    = await buscarCuentaPorCodigo(tx, empresaId, "1.1.05");
    const ventas = await buscarCuentaPorCodigo(tx, empresaId, "4.1.01");
    movimientos = [
      { cuenta_id: cxc.id,    debe: monto.toNumber(), haber: 0,               orden: 1 },
      { cuenta_id: ventas.id, debe: 0,               haber: monto.toNumber(), orden: 2 },
    ];
  }

  const asiento = await tx.asientoContable.create({
    data: {
      empresa_id:  empresaId,
      numero:      0,
      fecha,
      concepto:    `${notaNumero} – ${motivo}`,
      tipo_origen: "nota_debito",
      origen_id:   notaId,
      usuario_id:  usuarioId,
      estado:      "confirmado",
      total_debe:  monto.toFixed(2),
      total_haber: monto.toFixed(2),
      movimientos: { create: movimientos },
    },
    select: { id: true },
  });

  return asiento.id;
}

// ── Servicio público ──────────────────────────────────────────

/**
 * Crea una Nota de Crédito o Débito sobre una factura existente.
 *
 * - Crédito: reversa el asiento de la factura + la anula.
 * - Débito:  genera asiento adicional por el monto indicado.
 */
export async function crearNota(dto: CrearNotaDto) {
  if (dto.tipo === "debito" && (!dto.monto || dto.monto <= 0)) {
    throw new Error("El monto de la nota de débito debe ser mayor a 0.");
  }

  return prisma.$transaction(async (tx) => {
    const factura = await tx.factura.findFirst({
      where:  { id: dto.factura_id, empresa_id: dto.empresa_id },
      select: { id: true, numero: true, tipo: true, total: true, estado: true, asiento_id: true },
    });
    if (!factura) throw new Error("Factura no encontrada.");

    const estadosPermitidos = ["emitida", "parcial", "vencida", "pagada"];
    if (!estadosPermitidos.includes(factura.estado)) {
      throw new Error(
        `No se puede emitir una nota sobre una factura en estado '${factura.estado}'.`
      );
    }

    const fecha  = dto.fecha ?? new Date();
    const numero = await generarNumeroNota(tx, dto.empresa_id, dto.tipo);
    const monto  =
      dto.tipo === "credito"
        ? new Decimal(factura.total.toString())
        : new Decimal(dto.monto!);

    // Crear nota sin asiento_id para obtener su id primero
    const nota = await tx.notaCreditoDebito.create({
      data: {
        empresa_id: dto.empresa_id,
        factura_id: dto.factura_id,
        tipo:       dto.tipo,
        numero,
        fecha,
        motivo:     dto.motivo,
        monto:      monto.toFixed(2),
        usuario_id: dto.usuario_id,
        asiento_id: null,
      },
      select: { id: true, numero: true, tipo: true, monto: true },
    });

    let asientoId: string | null = null;

    if (dto.tipo === "credito") {
      if (!factura.asiento_id) {
        throw new Error(
          "La factura no tiene asiento contable asociado. Anúlela directamente."
        );
      }
      asientoId = await crearAsientoNotaCredito(
        tx, dto.empresa_id, dto.usuario_id,
        factura.asiento_id, nota.id, nota.numero, dto.motivo, fecha
      );
      await tx.factura.update({ where: { id: dto.factura_id }, data: { estado: "anulada" } });
    } else {
      asientoId = await crearAsientoNotaDebito(
        tx, dto.empresa_id, dto.usuario_id,
        factura.tipo, nota.id, nota.numero, dto.motivo, monto, fecha
      );
    }

    if (asientoId) {
      await tx.notaCreditoDebito.update({
        where: { id: nota.id },
        data:  { asiento_id: asientoId },
      });
    }

    return { ...nota, asiento_id: asientoId };
  });
}

/**
 * Lista notas de crédito/débito de una empresa con filtros opcionales.
 */
export async function listarNotas(
  empresaId: string,
  filtros: {
    factura_id?: string;
    tipo?:       "credito" | "debito";
    page?:       number;
    pageSize?:   number;
  }
) {
  const { factura_id, tipo, page = 1, pageSize = 50 } = filtros;

  const where = {
    empresa_id: empresaId,
    ...(factura_id && { factura_id }),
    ...(tipo       && { tipo }),
  };

  const [total, notas] = await Promise.all([
    prisma.notaCreditoDebito.count({ where }),
    prisma.notaCreditoDebito.findMany({
      where,
      orderBy: [{ fecha: "desc" }],
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: {
        factura: { select: { numero: true, tipo: true } },
        usuario: { select: { nombre: true } },
      },
    }),
  ]);

  return { total, page, pageSize, notas };
}

/**
 * Obtiene una nota con su asiento y movimientos asociados.
 */
export async function obtenerNota(empresaId: string, notaId: string) {
  return prisma.notaCreditoDebito.findFirst({
    where:   { id: notaId, empresa_id: empresaId },
    include: {
      factura: {
        select: {
          numero: true,
          tipo: true,
          total: true,
          contacto: { select: { nombre: true, razon_social: true } },
        },
      },
      usuario: { select: { nombre: true } },
      asiento: {
        include: {
          movimientos: {
            include: { cuenta: { select: { codigo: true, nombre: true } } },
            orderBy:  { orden: "asc" },
          },
        },
      },
    },
  });
}
