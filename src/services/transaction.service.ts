import { TipoTransaccion, EstadoTransaccion } from "@prisma/client";
import prisma from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface TransactionFilters {
  tipo?:         TipoTransaccion;
  estado?:       EstadoTransaccion;
  categoria_id?: number;
  fecha_desde?:  string; // ISO date: YYYY-MM-DD
  fecha_hasta?:  string;
  page?:         number;
  pageSize?:     number;
}

export interface CreateTransactionData {
  fecha?:            string;
  descripcion:       string;
  monto:             number;
  tipo:              TipoTransaccion;
  categoria_id:      number;
  estado?:           EstadoTransaccion;
  fecha_vencimiento?: string;
}

export interface UpdateTransactionData {
  fecha?:            string;
  descripcion?:      string;
  monto?:            number;
  tipo?:             TipoTransaccion;
  categoria_id?:     number;
  estado?:           EstadoTransaccion;
  fecha_vencimiento?: string | null;
}

// ─────────────────────────────────────────────────────────────
// Helpers para Fechas y Partida Doble
// ─────────────────────────────────────────────────────────────

function notFound() {
  return Object.assign(new Error("Transacción no encontrada"), { status: 404 });
}

// Regla: pending y overdue requieren fecha_vencimiento
function validateFechas(estado: EstadoTransaccion | undefined, fechaEmision: Date, fechaVencimiento: string | null | undefined) {
  const estadoFinal = estado ?? "completed";
  
  if (estadoFinal !== "completed" && !fechaVencimiento) {
    throw Object.assign(
      new Error("fecha_vencimiento es requerida para transacciones pending u overdue"),
      { status: 400 }
    );
  }

  if (fechaVencimiento) {
    const venc = new Date(fechaVencimiento);
    // Para comparar solo fechas sin hora
    const emisionNormalizada = new Date(fechaEmision.toISOString().split("T")[0]);
    const vencNormalizada = new Date(venc.toISOString().split("T")[0]);
    
    if (vencNormalizada < emisionNormalizada) {
       throw Object.assign(
        new Error("La fecha de vencimiento no puede ser anterior a la fecha de emisión"),
        { status: 400 }
      );
    }
  }
}

// Genera registro de Partida Doble simulando crédito/débito automático en el Banco
async function procesarPartidaDoble(txId: string, preDbTransaction?: any) {
  const db = preDbTransaction || prisma;
  
  const tx = await db.transaccion.findUnique({
    where: { id: txId }
  });

  if (!tx || tx.estado !== "completed") return;

  // Ver si ya tiene extracto asociado
  const existe = await db.extractoBancario.findFirst({
    where: { transaccion_id: tx.id }
  });

  if (existe) return;

  // Buscar o crear cuenta bancaria (Caja/Efectivo)
  let cuenta = await db.cuentaBancaria.findFirst({
    where: { empresa_id: tx.empresa_id, activo: true },
    orderBy: { created_at: "asc" }
  });

  if (!cuenta) {
    cuenta = await db.cuentaBancaria.create({
      data: {
        empresa_id: tx.empresa_id,
        nombre: "Caja Principal",
        saldo_actual: 0
      }
    });
  }

  const montoImpacto = tx.tipo === "income" ? Number(tx.monto) : -Number(tx.monto);

  await db.extractoBancario.create({
    data: {
      empresa_id: tx.empresa_id,
      cuenta_id: cuenta.id,
      fecha: tx.fecha,
      descripcion: tx.descripcion,
      monto: montoImpacto,
      conciliado: true, // Creado automáticamente desde contabilidad
      transaccion_id: tx.id
    }
  });

  await db.cuentaBancaria.update({
    where: { id: cuenta.id },
    data: { saldo_actual: { increment: montoImpacto } }
  });
}

// Select público (excluye campos internos innecesarios)
const PUBLIC_SELECT = {
  id:                true,
  empresa_id:        true,
  usuario_id:        true,
  fecha:             true,
  descripcion:       true,
  monto:             true,
  tipo:              true,
  categoria_id:      true,
  estado:            true,
  fecha_vencimiento: true,
  created_at:        true,
  updated_at:        true,
  categoria: {
    select: { id: true, nombre: true, tipo: true },
  },
} as const;

// ─────────────────────────────────────────────────────────────
// listTransactions
// ─────────────────────────────────────────────────────────────
export async function listTransactions(empresaId: string, filters: TransactionFilters = {}) {
  const {
    tipo,
    estado,
    categoria_id,
    fecha_desde,
    fecha_hasta,
    page     = 1,
    pageSize = 50,
  } = filters;

  const skip = (page - 1) * pageSize;

  const where = {
    empresa_id: empresaId,
    ...(tipo         && { tipo }),
    ...(estado       && { estado }),
    ...(categoria_id && { categoria_id }),
    ...(fecha_desde || fecha_hasta
      ? {
          fecha: {
            ...(fecha_desde && { gte: new Date(fecha_desde) }),
            ...(fecha_hasta && { lte: new Date(fecha_hasta) }),
          },
        }
      : {}),
  };

  const [data, total] = await prisma.$transaction([
    prisma.transaccion.findMany({
      where,
      select: PUBLIC_SELECT,
      orderBy: { fecha: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.transaccion.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

// ─────────────────────────────────────────────────────────────
// getTransactionById
// ─────────────────────────────────────────────────────────────
export async function getTransactionById(empresaId: string, id: string) {
  const tx = await prisma.transaccion.findFirst({
    where: { id, empresa_id: empresaId },
    select: PUBLIC_SELECT,
  });

  if (!tx) throw notFound();
  return tx;
}

// ─────────────────────────────────────────────────────────────
// createTransaction
// ─────────────────────────────────────────────────────────────
export async function createTransaction(
  empresaId: string,
  usuarioId: string | null,
  data: CreateTransactionData
) {
  const estado = data.estado ?? "completed";
  const fechaEmision = data.fecha ? new Date(data.fecha) : new Date();

  validateFechas(estado, fechaEmision, data.fecha_vencimiento);

  if (data.monto <= 0) {
    throw Object.assign(new Error("El monto debe ser mayor a 0"), { status: 400 });
  }

  // Verificar que la categoría pertenece a la empresa o es global
  const categoria = await prisma.categoriaTransaccion.findFirst({
    where: {
      id: data.categoria_id,
      OR: [{ empresa_id: empresaId }, { empresa_id: null }],
    },
  });

  if (!categoria) {
    throw Object.assign(new Error("Categoría no encontrada"), { status: 404 });
  }

  if (categoria.tipo !== data.tipo) {
    throw Object.assign(
      new Error(`La categoría '${categoria.nombre}' es de tipo '${categoria.tipo}', no '${data.tipo}'`),
      { status: 400 }
    );
  }

  const tx = await prisma.transaccion.create({
    data: {
      empresa_id:        empresaId,
      usuario_id:        usuarioId,
      fecha:             fechaEmision,
      descripcion:       data.descripcion,
      monto:             data.monto,
      tipo:              data.tipo,
      categoria_id:      data.categoria_id,
      estado,
      fecha_vencimiento: data.fecha_vencimiento ? new Date(data.fecha_vencimiento) : null,
    },
    select: PUBLIC_SELECT,
  });

  // Si es completed, registramos la partida doble automáticamente
  if (tx.estado === "completed") {
    await procesarPartidaDoble(tx.id);
  }

  return tx;
}

// ─────────────────────────────────────────────────────────────
// updateTransaction
// ─────────────────────────────────────────────────────────────
export async function updateTransaction(
  empresaId: string,
  id: string,
  data: UpdateTransactionData
) {
  const exists = await prisma.transaccion.findFirst({
    where: { id, empresa_id: empresaId },
  });

  if (!exists) throw notFound();

  // Resolver el estado final y fechas para validación
  const estadoFinal = data.estado ?? exists.estado;
  const fechaEmisionHipotetica = data.fecha ? new Date(data.fecha) : exists.fecha;
  const fechaVencFinal =
    "fecha_vencimiento" in data ? data.fecha_vencimiento : exists.fecha_vencimiento?.toISOString();

  validateFechas(estadoFinal, fechaEmisionHipotetica, fechaVencFinal);

  if (data.monto !== undefined && data.monto <= 0) {
    throw Object.assign(new Error("El monto debe ser mayor a 0"), { status: 400 });
  }

  // Si cambia la categoría, validarla
  if (data.categoria_id !== undefined) {
    const tipoFinal = data.tipo ?? exists.tipo;
    const categoria = await prisma.categoriaTransaccion.findFirst({
      where: {
        id: data.categoria_id,
        OR: [{ empresa_id: empresaId }, { empresa_id: null }],
      },
    });

    if (!categoria) {
      throw Object.assign(new Error("Categoría no encontrada"), { status: 404 });
    }

    if (categoria.tipo !== tipoFinal) {
      throw Object.assign(
        new Error(`La categoría '${categoria.nombre}' es de tipo '${categoria.tipo}', no '${tipoFinal}'`),
        { status: 400 }
      );
    }
  }

  const updatedTx = await prisma.transaccion.update({
    where: { id },
    data: {
      ...(data.descripcion      !== undefined && { descripcion: data.descripcion }),
      ...(data.monto            !== undefined && { monto: data.monto }),
      ...(data.tipo             !== undefined && { tipo: data.tipo }),
      ...(data.categoria_id     !== undefined && { categoria_id: data.categoria_id }),
      ...(data.estado           !== undefined && { estado: data.estado }),
      ...(data.fecha            !== undefined && { fecha: new Date(data.fecha) }),
      ...("fecha_vencimiento" in data && {
        fecha_vencimiento: data.fecha_vencimiento ? new Date(data.fecha_vencimiento) : null,
      }),
    },
    select: PUBLIC_SELECT,
  });

  // Si cambia a completed o si ya estaba completed y modificaron monto/tipo, 
  // idealmente podríamos reajustar los extractos. Para mantener integridad, 
  // confiamos en que procesarPartidaDoble al menos genere el extracto original 
  // si es que acaba de pasar a completed.
  if (updatedTx.estado === "completed") {
    await procesarPartidaDoble(updatedTx.id);
  }

  return updatedTx;
}

// ─────────────────────────────────────────────────────────────
// updateTransactionStatus
// Solo cambia el estado. Valida transiciones permitidas.
// ─────────────────────────────────────────────────────────────
export async function updateTransactionStatus(
  empresaId: string,
  id: string,
  estado: EstadoTransaccion
) {
  const exists = await prisma.transaccion.findFirst({
    where: { id, empresa_id: empresaId },
  });

  if (!exists) throw notFound();

  // pending/overdue → completed requiere que la fecha_vencimiento exista
  // completed → pending requiere fecha_vencimiento
  // Validar fechas
  validateFechas(estado, exists.fecha, exists.fecha_vencimiento?.toISOString());

  const txUpdated = await prisma.transaccion.update({
    where: { id },
    data: { estado },
    select: PUBLIC_SELECT,
  });

  if (txUpdated.estado === "completed") {
    await procesarPartidaDoble(txUpdated.id);
  }

  return txUpdated;
}

// ─────────────────────────────────────────────────────────────
// deleteTransaction (Asiento de Reversión)
// Mantiene inmaculado el historial contable generando contra-movimiento.
// ─────────────────────────────────────────────────────────────
export async function deleteTransaction(empresaId: string, id: string) {
  const exists = await prisma.transaccion.findFirst({
    where: { id, empresa_id: empresaId },
  });

  if (!exists) throw notFound();

  const tipoContrario = exists.tipo === "income" ? "expense" : "income";
  const descOriginal = exists.descripcion.substring(0, 150);

  await prisma.$transaction(async (tx) => {
    // 1. Marcar la original como anulada
    await tx.transaccion.update({
      where: { id },
      data: { descripcion: `[ANULADA] ${descOriginal}` }
    });

    // 2. Crear Asiento de Reversión para anular saldos
    const reversion = await tx.transaccion.create({
      data: {
        empresa_id: exists.empresa_id,
        usuario_id: exists.usuario_id,
        fecha: new Date(),
        descripcion: `REVERSIÓN: ${descOriginal}`,
        monto: exists.monto,
        tipo: tipoContrario,
        categoria_id: exists.categoria_id,
        estado: "completed", // La reversión se completa de inmediato
      }
    });

    // 3. Partida doble de la reversión (compensa la cuenta de banco automáticamente)
    await procesarPartidaDoble(reversion.id, tx);
  });
}

// ─────────────────────────────────────────────────────────────
// listCategories
// Devuelve categorías globales + las de la empresa
// ─────────────────────────────────────────────────────────────
export async function listCategories(empresaId: string) {
  return prisma.categoriaTransaccion.findMany({
    where: {
      OR: [{ empresa_id: null }, { empresa_id: empresaId }],
    },
    orderBy: [{ tipo: "asc" }, { nombre: "asc" }],
  });
}

// ─────────────────────────────────────────────────────────────
// getSummaryTransactions
// Endpoint analítico para agrupar en el Libro Menor
// ─────────────────────────────────────────────────────────────
export async function getSummaryTransactions(empresaId: string, month?: number, year?: number) {
  let dateFilter = {};
  if (year && month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    dateFilter = {
      fecha: {
        gte: startDate,
        lte: endDate,
      }
    };
  }

  const result = await prisma.transaccion.groupBy({
    by: ['tipo', 'estado', 'categoria_id'],
    _sum: {
      monto: true
    },
    where: {
      empresa_id: empresaId,
      ...dateFilter
    }
  });

  return result.map(r => ({
    tipo: r.tipo,
    estado: r.estado,
    categoria_id: r.categoria_id,
    total: r._sum.monto ? Number(r._sum.monto) : 0
  }));
}
