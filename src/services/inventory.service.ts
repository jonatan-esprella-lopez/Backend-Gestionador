import { TipoItem } from "@prisma/client";
import prisma from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface InventoryFilters {
  search?:      string;
  categoria_id?: number;
  tipo_item?:   TipoItem;
  bajo_stock?:  boolean; // solo items con stock <= min_warning
  page?:        number;
  pageSize?:    number;
}

export interface RecetaIngredienteData {
  insumo_id: string;
  cantidad:  number;
}

export interface RecetaData {
  nombre?:      string;
  notas?:       string;
  ingredientes: RecetaIngredienteData[];
}

export interface CreateItemData {
  sku:           string;
  nombre:        string;
  tipo_item:     TipoItem;
  precio_costo:  number;
  precio_venta?: number;
  stock?:        number;
  min_warning?:  number;
  categoria_id?: number;
  imagen_url?:   string;
  receta?:       RecetaData; // solo válido si tipo_item = 'product'
}

export interface UpdateItemData {
  sku?:          string;
  nombre?:       string;
  precio_costo?: number;
  precio_venta?: number | null;
  min_warning?:  number;
  categoria_id?: number | null;
  imagen_url?:   string | null;
  activo?:       boolean;
  receta?:       RecetaData | null; // null = eliminar receta existente
}

export interface AdjustStockData {
  cantidad:  number;  // positivo = entrada, negativo = salida
  notas?:    string;
}

export interface ProduceData {
  cantidad: number;
  notas?:   string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function notFound() {
  return Object.assign(new Error("Item de inventario no encontrado"), { status: 404 });
}

// Valida que todos los insumo_id existan en la empresa y sean tipo 'insumo'
async function validateIngredientes(empresaId: string, ingredientes: RecetaIngredienteData[]) {
  for (const ing of ingredientes) {
    if (ing.cantidad <= 0) {
      throw Object.assign(
        new Error(`La cantidad del ingrediente debe ser mayor a 0`),
        { status: 400 }
      );
    }
    const insumo = await prisma.inventarioItem.findFirst({
      where: { id: ing.insumo_id, empresa_id: empresaId, tipo_item: "insumo", activo: true },
    });
    if (!insumo) {
      throw Object.assign(
        new Error(`Insumo '${ing.insumo_id}' no encontrado o no es de tipo insumo`),
        { status: 404 }
      );
    }
  }
}

const PUBLIC_SELECT = {
  id:           true,
  empresa_id:   true,
  sku:          true,
  nombre:       true,
  stock:        true,
  min_warning:  true,
  precio_costo: true,
  precio_venta: true,
  tipo_item:    true,
  imagen_url:   true,
  activo:       true,
  created_at:   true,
  updated_at:   true,
  categoria: {
    select: { id: true, nombre: true },
  },
  receta: {
    select: {
      id:       true,
      nombre:   true,
      notas:    true,
      ingredientes: {
        select: {
          id:       true,
          cantidad: true,
          insumo: {
            select: { id: true, sku: true, nombre: true, stock: true },
          },
        },
      },
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────
// listItems
// ─────────────────────────────────────────────────────────────
export async function listItems(empresaId: string, filters: InventoryFilters = {}) {
  const {
    search,
    categoria_id,
    tipo_item,
    bajo_stock,
    page     = 1,
    pageSize = 50,
  } = filters;

  const skip = (page - 1) * pageSize;

  const where = {
    empresa_id: empresaId,
    activo:     true,
    ...(tipo_item    && { tipo_item }),
    ...(categoria_id && { categoria_id }),
    ...(search && {
      OR: [
        { nombre: { contains: search, mode: "insensitive" as const } },
        { sku:    { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  // bajo_stock no se puede hacer con un campo dinámico via Prisma fácilmente,
  // se filtra post-query solo si está activo para mantener la query simple.
  const [data, total] = await prisma.$transaction([
    prisma.inventarioItem.findMany({
      where,
      select:  PUBLIC_SELECT,
      orderBy: { nombre: "asc" },
      skip,
      take:    pageSize,
    }),
    prisma.inventarioItem.count({ where }),
  ]);

  // Filtro bajo_stock en memoria (stock <= min_warning)
  const filtered = bajo_stock
    ? data.filter((item) => Number(item.stock) <= Number(item.min_warning))
    : data;

  return {
    data:     filtered,
    total:    bajo_stock ? filtered.length : total,
    page,
    pageSize,
  };
}

// ─────────────────────────────────────────────────────────────
// getItemById
// ─────────────────────────────────────────────────────────────
export async function getItemById(empresaId: string, id: string) {
  const item = await prisma.inventarioItem.findFirst({
    where:  { id, empresa_id: empresaId },
    select: PUBLIC_SELECT,
  });

  if (!item) throw notFound();
  return item;
}

// ─────────────────────────────────────────────────────────────
// createItem
// ─────────────────────────────────────────────────────────────
export async function createItem(empresaId: string, data: CreateItemData) {
  if (data.precio_costo < 0) {
    throw Object.assign(new Error("precio_costo no puede ser negativo"), { status: 400 });
  }

  if (data.precio_venta !== undefined && data.precio_venta !== null && data.precio_venta < 0) {
    throw Object.assign(new Error("precio_venta no puede ser negativo"), { status: 400 });
  }

  // SKU único por empresa
  const skuTaken = await prisma.inventarioItem.findFirst({
    where: { empresa_id: empresaId, sku: data.sku },
  });
  if (skuTaken) {
    throw Object.assign(new Error(`El SKU '${data.sku}' ya existe en esta empresa`), { status: 409 });
  }

  // Validar categoría si se provee
  if (data.categoria_id !== undefined) {
    const cat = await prisma.categoriaInventario.findFirst({
      where: {
        id: data.categoria_id,
        OR: [{ empresa_id: empresaId }, { empresa_id: null }],
      },
    });
    if (!cat) {
      throw Object.assign(new Error("Categoría de inventario no encontrada"), { status: 404 });
    }
  }

  // Receta solo válida en productos
  if (data.receta && data.tipo_item !== "product") {
    throw Object.assign(
      new Error("La receta solo puede asignarse a items de tipo 'product'"),
      { status: 400 }
    );
  }

  // Validar ingredientes de receta si se proveen
  if (data.receta?.ingredientes?.length) {
    await validateIngredientes(empresaId, data.receta.ingredientes);
  }

  const stockInicial = data.stock ?? 0;

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventarioItem.create({
      data: {
        empresa_id:   empresaId,
        sku:          data.sku,
        nombre:       data.nombre,
        tipo_item:    data.tipo_item,
        precio_costo: data.precio_costo,
        precio_venta: data.precio_venta ?? null,
        stock:        stockInicial,
        min_warning:  data.min_warning ?? 0,
        categoria_id: data.categoria_id ?? null,
        imagen_url:   data.imagen_url ?? null,
      },
      select: PUBLIC_SELECT,
    });

    // Crear receta si se proveyó
    if (data.receta) {
      await tx.receta.create({
        data: {
          producto_id: item.id,
          nombre:      data.receta.nombre ?? null,
          notas:       data.receta.notas  ?? null,
          ingredientes: {
            create: data.receta.ingredientes.map((ing) => ({
              insumo_id: ing.insumo_id,
              cantidad:  ing.cantidad,
            })),
          },
        },
      });
    }

    // Registrar en Kardex si se ingresó stock inicial
    if (stockInicial > 0) {
      await tx.kardex.create({
        data: {
          empresa_id:      empresaId,
          item_id:         item.id,
          tipo_movimiento: "entrada",
          cantidad:        stockInicial,
          stock_anterior:  0,
          stock_nuevo:     stockInicial,
          referencia_tipo: "importacion",
          notas:           "Stock inicial al crear item",
        },
      });
    }

    // Refetch con receta incluida
    return tx.inventarioItem.findUniqueOrThrow({
      where:  { id: item.id },
      select: PUBLIC_SELECT,
    });
  });
}

// ─────────────────────────────────────────────────────────────
// updateItem
// ─────────────────────────────────────────────────────────────
export async function updateItem(empresaId: string, id: string, data: UpdateItemData) {
  const exists = await prisma.inventarioItem.findFirst({
    where: { id, empresa_id: empresaId },
  });
  if (!exists) throw notFound();

  if (data.precio_costo !== undefined && data.precio_costo < 0) {
    throw Object.assign(new Error("precio_costo no puede ser negativo"), { status: 400 });
  }

  if (data.precio_venta !== undefined && data.precio_venta !== null && data.precio_venta < 0) {
    throw Object.assign(new Error("precio_venta no puede ser negativo"), { status: 400 });
  }

  // Si cambia el SKU, verificar que no esté tomado
  if (data.sku && data.sku !== exists.sku) {
    const skuTaken = await prisma.inventarioItem.findFirst({
      where: { empresa_id: empresaId, sku: data.sku },
    });
    if (skuTaken) {
      throw Object.assign(new Error(`El SKU '${data.sku}' ya existe en esta empresa`), { status: 409 });
    }
  }

  // Receta solo válida en productos
  if (data.receta !== undefined && exists.tipo_item !== "product") {
    throw Object.assign(
      new Error("La receta solo puede asignarse a items de tipo 'product'"),
      { status: 400 }
    );
  }

  if (data.receta?.ingredientes?.length) {
    await validateIngredientes(empresaId, data.receta.ingredientes);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.inventarioItem.update({
      where:  { id },
      data: {
        ...(data.sku          !== undefined && { sku: data.sku }),
        ...(data.nombre       !== undefined && { nombre: data.nombre }),
        ...(data.precio_costo !== undefined && { precio_costo: data.precio_costo }),
        ...("precio_venta"    in data       && { precio_venta: data.precio_venta }),
        ...(data.min_warning  !== undefined && { min_warning: data.min_warning }),
        ...("categoria_id"    in data       && { categoria_id: data.categoria_id }),
        ...("imagen_url"      in data       && { imagen_url: data.imagen_url }),
        ...(data.activo       !== undefined && { activo: data.activo }),
      },
    });

    // Actualizar receta si se envió
    if ("receta" in data) {
      // Eliminar receta existente (cascada elimina los ingredientes)
      await tx.receta.deleteMany({ where: { producto_id: id } });

      // Crear nueva si no es null
      if (data.receta) {
        await tx.receta.create({
          data: {
            producto_id: id,
            nombre:      data.receta.nombre ?? null,
            notas:       data.receta.notas  ?? null,
            ingredientes: {
              create: data.receta.ingredientes.map((ing) => ({
                insumo_id: ing.insumo_id,
                cantidad:  ing.cantidad,
              })),
            },
          },
        });
      }
    }

    return tx.inventarioItem.findUniqueOrThrow({
      where:  { id: updated.id },
      select: PUBLIC_SELECT,
    });
  });
}

// ─────────────────────────────────────────────────────────────
// adjustStock
// Ajuste manual de stock (+/-). Registra en Kardex.
// ─────────────────────────────────────────────────────────────
export async function adjustStock(
  empresaId: string,
  id: string,
  usuarioId: string | null,
  data: AdjustStockData
) {
  if (data.cantidad === 0) {
    throw Object.assign(new Error("La cantidad del ajuste no puede ser 0"), { status: 400 });
  }

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventarioItem.findFirst({
      where: { id, empresa_id: empresaId },
    });
    if (!item) throw notFound();

    const stockAnterior = Number(item.stock);
    const stockNuevo    = stockAnterior + data.cantidad;

    if (stockNuevo < 0) {
      throw Object.assign(
        new Error(`Stock insuficiente. Stock actual: ${stockAnterior}, ajuste solicitado: ${data.cantidad}`),
        { status: 422 }
      );
    }

    const updated = await tx.inventarioItem.update({
      where:  { id },
      data:   { stock: stockNuevo },
      select: PUBLIC_SELECT,
    });

    await tx.kardex.create({
      data: {
        empresa_id:      empresaId,
        item_id:         id,
        usuario_id:      usuarioId,
        tipo_movimiento: data.cantidad > 0 ? "entrada" : "salida",
        cantidad:        data.cantidad,
        stock_anterior:  stockAnterior,
        stock_nuevo:     stockNuevo,
        referencia_tipo: "ajuste_manual",
        notas:           data.notas ?? null,
      },
    });

    return updated;
  });
}

// ─────────────────────────────────────────────────────────────
// produce
// Ejecuta una orden de producción:
//   1. Verifica que el item es de tipo 'product' y tiene receta
//   2. Verifica stock suficiente en cada insumo
//   3. Descuenta insumos, suma producto, registra en Kardex y ProduccionLog
// ─────────────────────────────────────────────────────────────
export async function produce(
  empresaId: string,
  id: string,
  usuarioId: string | null,
  data: ProduceData
) {
  if (data.cantidad <= 0) {
    throw Object.assign(new Error("La cantidad a producir debe ser mayor a 0"), { status: 400 });
  }

  return prisma.$transaction(async (tx) => {
    // 1. Cargar producto con receta e ingredientes
    const producto = await tx.inventarioItem.findFirst({
      where: { id, empresa_id: empresaId },
      include: {
        receta: {
          include: {
            ingredientes: {
              include: { insumo: true },
            },
          },
        },
      },
    });

    if (!producto) throw notFound();

    if (producto.tipo_item !== "product") {
      throw Object.assign(new Error("Solo se puede producir items de tipo 'product'"), { status: 400 });
    }

    if (!producto.receta || producto.receta.ingredientes.length === 0) {
      throw Object.assign(
        new Error("Este producto no tiene una receta definida"),
        { status: 422 }
      );
    }

    // 2. Verificar stock de cada insumo
    const faltantes: Array<{ insumo: string; requerido: number; disponible: number }> = [];

    for (const ingrediente of producto.receta.ingredientes) {
      const requerido   = Number(ingrediente.cantidad) * data.cantidad;
      const disponible  = Number(ingrediente.insumo.stock);

      if (disponible < requerido) {
        faltantes.push({
          insumo:     ingrediente.insumo.nombre,
          requerido,
          disponible,
        });
      }
    }

    if (faltantes.length > 0) {
      throw Object.assign(
        new Error("Stock insuficiente para completar la producción"),
        { status: 422, faltantes }
      );
    }

    // 3. Descontar insumos y registrar en Kardex
    for (const ingrediente of producto.receta.ingredientes) {
      const cantidadADescontar = Number(ingrediente.cantidad) * data.cantidad;
      const stockAnterior      = Number(ingrediente.insumo.stock);
      const stockNuevo         = stockAnterior - cantidadADescontar;

      await tx.inventarioItem.update({
        where: { id: ingrediente.insumo_id },
        data:  { stock: stockNuevo },
      });

      await tx.kardex.create({
        data: {
          empresa_id:      empresaId,
          item_id:         ingrediente.insumo_id,
          usuario_id:      usuarioId,
          tipo_movimiento: "produccion_salida",
          cantidad:        -cantidadADescontar,
          stock_anterior:  stockAnterior,
          stock_nuevo:     stockNuevo,
          referencia_tipo: "produccion_log",
          notas:           `Producción de ${data.cantidad} × ${producto.nombre}`,
        },
      });
    }

    // 4. Sumar al producto producido y registrar en Kardex
    const stockAnteriorProducto = Number(producto.stock);
    const stockNuevoProducto    = stockAnteriorProducto + data.cantidad;

    const productoActualizado = await tx.inventarioItem.update({
      where:  { id },
      data:   { stock: stockNuevoProducto },
      select: PUBLIC_SELECT,
    });

    // 5. Log de producción
    const log = await tx.produccionLog.create({
      data: {
        empresa_id:  empresaId,
        producto_id: id,
        usuario_id:  usuarioId,
        cantidad:    data.cantidad,
        notas:       data.notas ?? null,
      },
    });

    await tx.kardex.create({
      data: {
        empresa_id:      empresaId,
        item_id:         id,
        usuario_id:      usuarioId,
        tipo_movimiento: "produccion_entrada",
        cantidad:        data.cantidad,
        stock_anterior:  stockAnteriorProducto,
        stock_nuevo:     stockNuevoProducto,
        referencia_id:   log.id,
        referencia_tipo: "produccion_log",
        notas:           data.notas ?? null,
      },
    });

    return { producto: productoActualizado, log };
  });
}

// ─────────────────────────────────────────────────────────────
// deleteItem (soft delete: activo = false)
// ─────────────────────────────────────────────────────────────
export async function deleteItem(empresaId: string, id: string) {
  const exists = await prisma.inventarioItem.findFirst({
    where: { id, empresa_id: empresaId },
  });
  if (!exists) throw notFound();

  await prisma.inventarioItem.update({
    where: { id },
    data:  { activo: false },
  });
}

// ─────────────────────────────────────────────────────────────
// listKardex — historial de movimientos de un item
// ─────────────────────────────────────────────────────────────
export async function listKardex(empresaId: string, itemId: string, page = 1, pageSize = 50) {
  const exists = await prisma.inventarioItem.findFirst({
    where: { id: itemId, empresa_id: empresaId },
  });
  if (!exists) throw notFound();

  const skip = (page - 1) * pageSize;

  const [data, total] = await prisma.$transaction([
    prisma.kardex.findMany({
      where:   { empresa_id: empresaId, item_id: itemId },
      orderBy: { created_at: "desc" },
      skip,
      take:    pageSize,
      select: {
        id:              true,
        tipo_movimiento: true,
        cantidad:        true,
        stock_anterior:  true,
        stock_nuevo:     true,
        referencia_id:   true,
        referencia_tipo: true,
        notas:           true,
        created_at:      true,
        usuario: { select: { id: true, nombre: true } },
      },
    }),
    prisma.kardex.count({ where: { empresa_id: empresaId, item_id: itemId } }),
  ]);

  return { data, total, page, pageSize };
}

// ─────────────────────────────────────────────────────────────
// listCategories — categorías de inventario (global + empresa)
// ─────────────────────────────────────────────────────────────
export async function listCategories(empresaId: string) {
  return prisma.categoriaInventario.findMany({
    where: {
      OR: [{ empresa_id: null }, { empresa_id: empresaId }],
    },
    orderBy: { nombre: "asc" },
  });
}
