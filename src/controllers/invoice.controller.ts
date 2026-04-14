import { Request, Response, NextFunction } from "express";
import * as service from "../services/invoice.service";

// GET /api/invoices
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tipo, estado, contacto_id, desde, hasta, page, pageSize } = req.query as Record<string, string>;

    const resultado = await service.listarFacturas(req.user!.empresaId!, {
      tipo:        tipo        as any ?? undefined,
      estado:      estado      as any ?? undefined,
      contacto_id: contacto_id         ?? undefined,
      desde:       desde       ? new Date(desde)        : undefined,
      hasta:       hasta       ? new Date(hasta)         : undefined,
      page:        page        ? parseInt(page, 10)      : 1,
      pageSize:    pageSize    ? parseInt(pageSize, 10)  : 50,
    });

    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// GET /api/invoices/:id
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const factura = await service.obtenerFactura(req.user!.empresaId!, req.params.id as string);
    if (!factura) {
      res.status(404).json({ error: "Factura no encontrada." });
      return;
    }
    res.status(200).json({ factura });
  } catch (err) {
    next(err);
  }
}

// POST /api/invoices
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const factura = await service.crearFactura({
      empresa_id:        req.user!.empresaId!,
      usuario_id:        req.user!.userId,
      tipo:              req.body.tipo,
      contacto_id:       req.body.contacto_id,
      fecha_emision:     new Date(req.body.fecha_emision),
      fecha_vencimiento: new Date(req.body.fecha_vencimiento),
      observaciones:     req.body.observaciones,
      lineas:            req.body.lineas,
      emitir:            req.body.emitir ?? true,
    });
    res.status(201).json({ factura });
  } catch (err) {
    next(err);
  }
}

// POST /api/invoices/:id/cancel
export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.anularFactura(
      req.user!.empresaId!,
      req.params.id as string,
      req.user!.userId,
      req.body.motivo
    );
    res.status(200).json({ factura: resultado });
  } catch (err) {
    next(err);
  }
}
