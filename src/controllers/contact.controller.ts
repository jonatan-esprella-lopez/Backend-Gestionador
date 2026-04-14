import { Request, Response, NextFunction } from "express";
import * as service from "../services/contact.service";

// GET /api/contacts
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { q, es_cliente, es_proveedor, page, pageSize } = req.query as Record<string, string>;
    const resultado = await service.listarContactos(req.user!.empresaId!, {
      q:            q            || undefined,
      es_cliente:   es_cliente   !== undefined ? es_cliente   === "true" : undefined,
      es_proveedor: es_proveedor !== undefined ? es_proveedor === "true" : undefined,
      page:         page     ? parseInt(page,     10) : 1,
      pageSize:     pageSize ? parseInt(pageSize, 10) : 50,
    });
    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// POST /api/contacts
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const contacto = await service.crearContacto(req.user!.empresaId!, req.body);
    res.status(201).json({ contacto });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/contacts/:id
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const contacto = await service.actualizarContacto(
      req.user!.empresaId!,
      req.params.id as string,
      req.body
    );
    res.status(200).json({ contacto });
  } catch (err) {
    next(err);
  }
}
