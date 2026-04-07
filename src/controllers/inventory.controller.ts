import { Request, Response, NextFunction } from "express";
import { TipoItem } from "@prisma/client";
import * as invService from "../services/inventory.service";
import * as uploadService from "../services/upload.service";
import type { RecetaData } from "../services/inventory.service";
import { isValidUUID, isValidEnum, isNonNegativeNumber, isPositiveNumber, parsePositiveInt } from "../lib/validators";

// Los campos de texto/número llegan como strings desde FormData — los parseamos aquí
function parseFormBody(body: Record<string, any>) {
  return {
    sku:          typeof body.sku         === "string" ? body.sku.trim()           : undefined,
    nombre:       typeof body.nombre      === "string" ? body.nombre.trim()        : undefined,
    tipo_item:    typeof body.tipo_item   === "string" ? body.tipo_item            : undefined,
    precio_costo: body.precio_costo !== undefined      ? Number(body.precio_costo) : undefined,
    precio_venta: body.precio_venta !== undefined      ? Number(body.precio_venta) : undefined,
    stock:        body.stock        !== undefined      ? Number(body.stock)        : undefined,
    min_warning:  body.min_warning  !== undefined      ? Number(body.min_warning)  : undefined,
    categoria_id: body.categoria_id !== undefined      ? Number(body.categoria_id) : undefined,
    imagen_url:   typeof body.imagen_url  === "string" ? body.imagen_url           : undefined,
    receta:       typeof body.receta      === "string" ? JSON.parse(body.receta)   : body.receta,
  };
}

const TIPOS_ITEM_VALIDOS: TipoItem[] = ["product", "insumo"];

function qs(val: unknown): string | undefined {
  if (typeof val === "string") return val;
  if (Array.isArray(val) && typeof val[0] === "string") return val[0];
  return undefined;
}

// ─────────────────────────────────────────────────────────────
// GET /api/inventory
// Query: search, categoria_id, tipo_item, bajo_stock, page, pageSize
// ─────────────────────────────────────────────────────────────
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const { search, categoria_id, tipo_item, bajo_stock, page, pageSize } = req.query;

    const tipoItemVal = qs(tipo_item);
    if (tipoItemVal && !isValidEnum(tipoItemVal, TIPOS_ITEM_VALIDOS)) {
      res.status(400).json({ message: "tipo_item inválido. Valores: product, insumo" });
      return;
    }

    const result = await invService.listItems(empresaId, {
      search:       qs(search),
      categoria_id: parsePositiveInt(qs(categoria_id)),
      tipo_item:    tipoItemVal as TipoItem | undefined,
      bajo_stock:   qs(bajo_stock) === "true",
      page:         parsePositiveInt(qs(page)),
      pageSize:     parsePositiveInt(qs(pageSize)),
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/categories
// ─────────────────────────────────────────────────────────────
export async function listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const categories = await invService.listCategories(empresaId);
    res.status(200).json({ categories });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/:id
// ─────────────────────────────────────────────────────────────
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "ID de item inválido" });
      return;
    }
    const item = await invService.getItemById(empresaId, req.params.id as string);
    res.status(200).json({ item });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/inventory
// Acepta multipart/form-data. El archivo de imagen va en el campo "image".
// ─────────────────────────────────────────────────────────────
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    const { sku, nombre, tipo_item, precio_costo, precio_venta, stock, min_warning, categoria_id, receta } =
      parseFormBody(req.body);

    if (!sku || !nombre || !tipo_item || precio_costo === undefined) {
      res.status(400).json({ message: "sku, nombre, tipo_item y precio_costo son requeridos" });
      return;
    }

    if (!isValidEnum(tipo_item as TipoItem, TIPOS_ITEM_VALIDOS)) {
      res.status(400).json({ message: "tipo_item inválido. Valores: product, insumo" });
      return;
    }

    if (!isNonNegativeNumber(precio_costo)) {
      res.status(400).json({ message: "precio_costo debe ser un número no negativo" });
      return;
    }

    if (precio_venta !== undefined && !isNonNegativeNumber(precio_venta)) {
      res.status(400).json({ message: "precio_venta debe ser un número no negativo" });
      return;
    }

    // Subir imagen a R2 si se adjuntó un archivo
    let imagen_url: string | undefined;
    if (req.file) {
      imagen_url = await uploadService.uploadImage(req.file);
    }

    const item = await invService.createItem(empresaId, {
      sku,
      nombre,
      tipo_item:    tipo_item as TipoItem,
      precio_costo,
      precio_venta,
      stock,
      min_warning,
      categoria_id,
      imagen_url,
      receta,
    });

    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/inventory/:id
// Acepta multipart/form-data. El archivo de imagen va en el campo "image".
// ─────────────────────────────────────────────────────────────
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "ID de item inválido" });
      return;
    }

    const { sku, nombre, precio_costo, precio_venta, min_warning, categoria_id, activo, receta } =
      parseFormBody(req.body);

    // Subir nueva imagen a R2 si se adjuntó un archivo
    let imagen_url: string | undefined | null = req.body.imagen_url ?? undefined;
    if (req.file) {
      imagen_url = await uploadService.uploadImage(req.file);
    }

    const item = await invService.updateItem(empresaId, req.params.id as string, {
      sku,
      nombre,
      precio_costo,
      precio_venta,
      min_warning,
      categoria_id,
      imagen_url,
      activo,
      receta,
    });

    res.status(200).json({ item });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/inventory/:id/stock
// Body: { cantidad, notas? }
// cantidad positivo = entrada, negativo = salida
// ─────────────────────────────────────────────────────────────
export async function adjustStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "ID de item inválido" });
      return;
    }
    const { cantidad, notas } = req.body as { cantidad?: number; notas?: string };

    if (cantidad === undefined) {
      res.status(400).json({ message: "cantidad es requerida" });
      return;
    }

    const item = await invService.adjustStock(
      empresaId,
      req.params.id as string,
      req.user!.userId,
      { cantidad, notas }
    );

    res.status(200).json({ item });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/inventory/:id/produce
// Body: { cantidad, notas? }
// ─────────────────────────────────────────────────────────────
export async function produce(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "ID de item inválido" });
      return;
    }
    const { cantidad, notas } = req.body as { cantidad?: number; notas?: string };

    if (cantidad === undefined) {
      res.status(400).json({ message: "cantidad es requerida" });
      return;
    }

    const result = await invService.produce(
      empresaId,
      req.params.id as string,
      req.user!.userId,
      { cantidad, notas }
    );

    res.status(200).json(result);
  } catch (err: unknown) {
    // Enriquecer el error con faltantes si los hay
    if (err instanceof Error && (err as Error & { faltantes?: unknown }).faltantes) {
      const enriched = err as Error & { status?: number; faltantes?: unknown };
      res.status(enriched.status ?? 422).json({
        message:   enriched.message,
        faltantes: enriched.faltantes,
      });
      return;
    }
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/inventory/:id  (soft delete)
// ─────────────────────────────────────────────────────────────
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "ID de item inválido" });
      return;
    }
    await invService.deleteItem(empresaId, req.params.id as string);
    res.status(200).json({ message: "Item desactivado" });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/:id/kardex
// Query: page, pageSize
// ─────────────────────────────────────────────────────────────
export async function kardex(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = req.user!.empresaId!;
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "ID de item inválido" });
      return;
    }
    const page     = parsePositiveInt(qs(req.query.page))     ?? 1;
    const pageSize = parsePositiveInt(qs(req.query.pageSize)) ?? 50;

    const result = await invService.listKardex(empresaId, req.params.id as string, page, pageSize);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
