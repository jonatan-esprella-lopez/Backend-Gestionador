// ============================================================
// accounts-payable.service.ts — Cuentas por Pagar (CxP)
// Facturas de compra con saldo pendiente.
// ============================================================

import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

const ESTADOS_ABIERTOS = ["emitida", "parcial", "vencida"] as const;

type BucketAging = "corriente" | "1_30" | "31_60" | "61_90" | "90_mas";

function clasificarAging(fechaVencimiento: Date, hoy: Date): BucketAging {
  const dias = Math.floor(
    (hoy.getTime() - fechaVencimiento.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (dias <= 0)  return "corriente";
  if (dias <= 30) return "1_30";
  if (dias <= 60) return "31_60";
  if (dias <= 90) return "61_90";
  return "90_mas";
}

/**
 * Lista facturas de compra con saldo pendiente.
 * Con `aging = true` añade el bucket de antigüedad por factura
 * y el resumen acumulado por bucket.
 */
export async function listarCxP(
  empresaId: string,
  filtros: {
    aging?:       boolean;
    contacto_id?: string;
    page?:        number;
    pageSize?:    number;
  }
) {
  const { aging = false, contacto_id, page = 1, pageSize = 50 } = filtros;
  const hoy = new Date();

  const where = {
    empresa_id: empresaId,
    tipo:       "compra" as const,
    estado:     { in: [...ESTADOS_ABIERTOS] },
    ...(contacto_id && { contacto_id }),
  };

  const [total, facturas] = await Promise.all([
    prisma.factura.count({ where }),
    prisma.factura.findMany({
      where,
      orderBy: { fecha_vencimiento: "asc" },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      include: {
        contacto: { select: { id: true, nombre: true, nit: true, razon_social: true } },
      },
    }),
  ]);

  const buckets: Record<BucketAging, Decimal> = {
    corriente: new Decimal(0),
    "1_30":    new Decimal(0),
    "31_60":   new Decimal(0),
    "61_90":   new Decimal(0),
    "90_mas":  new Decimal(0),
  };

  const items = facturas.map((f) => {
    const bucket = clasificarAging(f.fecha_vencimiento, hoy);
    buckets[bucket] = buckets[bucket].plus(f.saldo_pendiente.toString());
    return {
      id:                f.id,
      numero:            f.numero,
      estado:            f.estado,
      contacto:          f.contacto,
      fecha_emision:     f.fecha_emision,
      fecha_vencimiento: f.fecha_vencimiento,
      total:             f.total.toString(),
      saldo_pendiente:   f.saldo_pendiente.toString(),
      ...(aging && { bucket }),
    };
  });

  const totalPendiente = facturas.reduce(
    (s, f) => s.plus(f.saldo_pendiente.toString()),
    new Decimal(0)
  );

  return {
    total,
    page,
    pageSize,
    total_pendiente: totalPendiente.toFixed(2),
    ...(aging && {
      aging: Object.fromEntries(
        Object.entries(buckets).map(([k, v]) => [k, v.toFixed(2)])
      ),
    }),
    facturas: items,
  };
}

/**
 * CxP agrupado por proveedor: total pendiente y facturas por contacto.
 */
export async function cxpPorProveedor(empresaId: string) {
  const facturas = await prisma.factura.findMany({
    where: {
      empresa_id: empresaId,
      tipo:       "compra",
      estado:     { in: [...ESTADOS_ABIERTOS] },
    },
    orderBy: [{ contacto: { nombre: "asc" } }, { fecha_vencimiento: "asc" }],
    include: {
      contacto: { select: { id: true, nombre: true, nit: true, razon_social: true } },
    },
  });

  const grouped = new Map<
    string,
    { contacto: typeof facturas[0]["contacto"]; total_pendiente: Decimal; facturas: any[] }
  >();

  for (const f of facturas) {
    if (!grouped.has(f.contacto_id)) {
      grouped.set(f.contacto_id, {
        contacto:        f.contacto,
        total_pendiente: new Decimal(0),
        facturas:        [],
      });
    }
    const g = grouped.get(f.contacto_id)!;
    g.total_pendiente = g.total_pendiente.plus(f.saldo_pendiente.toString());
    g.facturas.push({
      id:                f.id,
      numero:            f.numero,
      estado:            f.estado,
      fecha_vencimiento: f.fecha_vencimiento,
      saldo_pendiente:   f.saldo_pendiente.toString(),
    });
  }

  const proveedores = [...grouped.values()].map((g) => ({
    contacto:        g.contacto,
    total_pendiente: g.total_pendiente.toFixed(2),
    facturas:        g.facturas,
  }));

  const totalGeneral = proveedores.reduce(
    (s, p) => s.plus(p.total_pendiente),
    new Decimal(0)
  );

  return {
    total_proveedores: proveedores.length,
    total_pendiente:   totalGeneral.toFixed(2),
    proveedores,
  };
}
