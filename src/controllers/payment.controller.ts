import { Request, Response, NextFunction } from "express";
import * as service from "../services/payment.service";

// GET /api/payments
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { factura_id, desde, hasta, page, pageSize } = req.query as Record<string, string>;

    const resultado = await service.listarPagos(req.user!.empresaId!, {
      factura_id: factura_id  ?? undefined,
      desde:      desde       ? new Date(desde)        : undefined,
      hasta:      hasta       ? new Date(hasta)         : undefined,
      page:       page        ? parseInt(page, 10)      : 1,
      pageSize:   pageSize    ? parseInt(pageSize, 10)  : 50,
    });

    res.status(200).json(resultado);
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/:id
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pago = await service.obtenerPago(req.user!.empresaId!, req.params.id as string);
    if (!pago) {
      res.status(404).json({ error: "Pago no encontrado." });
      return;
    }
    res.status(200).json({ pago });
  } catch (err) {
    next(err);
  }
}

// POST /api/payments
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await service.registrarPago({
      empresa_id:         req.user!.empresaId!,
      usuario_id:         req.user!.userId,
      factura_id:         req.body.factura_id,
      cuenta_bancaria_id: req.body.cuenta_bancaria_id,
      fecha:              new Date(req.body.fecha),
      monto:              req.body.monto,
      metodo:             req.body.metodo,
      referencia:         req.body.referencia,
      observaciones:      req.body.observaciones,
    });
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}
