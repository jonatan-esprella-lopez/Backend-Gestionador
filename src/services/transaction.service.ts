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
// Helpers
// ─────────────────────────────────────────────────────────────

function notFound() {
  return Object.assign(new Error("Transacción no encontrada"), { status: 404 });
}

// Regla: pending y overdue requieren fecha_vencimiento
function validateFechaVencimiento(estado: EstadoTransaccion | undefined, fechaVencimiento: string | null | undefined) {
  const estadoFinal = estado ?? "completed";
  if (estadoFinal !== "completed" && !fechaVencimiento) {
    throw Object.assign(
      new Error("fecha_vencimiento es requerida para transacciones pending u overdue"),
      { status: 400 }
    );
  }
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

  validateFechaVencimiento(estado, data.fecha_vencimiento);

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

  return prisma.transaccion.create({
    data: {
      empresa_id:        empresaId,
      usuario_id:        usuarioId,
      fecha:             data.fecha ? new Date(data.fecha) : new Date(),
      descripcion:       data.descripcion,
      monto:             data.monto,
      tipo:              data.tipo,
      categoria_id:      data.categoria_id,
      estado,
      fecha_vencimiento: data.fecha_vencimiento ? new Date(data.fecha_vencimiento) : null,
    },
    select: PUBLIC_SELECT,
  });
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

  // Resolver el estado final para validar fecha_vencimiento
  const estadoFinal = data.estado ?? exists.estado;
  const fechaVencFinal =
    "fecha_vencimiento" in data ? data.fecha_vencimiento : exists.fecha_vencimiento?.toISOString();

  validateFechaVencimiento(estadoFinal, fechaVencFinal);

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

  return prisma.transaccion.update({
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
  if (estado !== "completed" && !exists.fecha_vencimiento) {
    throw Object.assign(
      new Error("No se puede pasar a pending/overdue sin fecha_vencimiento. Usa PATCH /transactions/:id para actualizar ambos."),
      { status: 400 }
    );
  }

  return prisma.transaccion.update({
    where: { id },
    data: { estado },
    select: PUBLIC_SELECT,
  });
}

// ─────────────────────────────────────────────────────────────
// deleteTransaction
// ─────────────────────────────────────────────────────────────
export async function deleteTransaction(empresaId: string, id: string) {
  const exists = await prisma.transaccion.findFirst({
    where: { id, empresa_id: empresaId },
  });

  if (!exists) throw notFound();

  await prisma.transaccion.delete({ where: { id } });
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
