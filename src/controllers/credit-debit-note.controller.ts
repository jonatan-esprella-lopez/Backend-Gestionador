import { Request, Response, NextFunction } from "express";
import * as svc from "../services/credit-debit-note.service";

export async function crear(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresa_id = req.user!.empresaId!;
    const usuario_id = req.user!.userId;
    const nota = await svc.crearNota({ empresa_id, usuario_id, ...req.body });
    res.status(201).json(nota);
  } catch (err) {
    next(err);
  }
}

export async function listar(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const resultado = await svc.listarNotas(req.user!.empresaId!, req.query as any);
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

export async function obtener(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const nota = await svc.obtenerNota(req.user!.empresaId!, req.params.id as string);
    if (!nota) {
      res.status(404).json({ message: "Nota no encontrada." });
      return;
    }
    res.json(nota);
  } catch (err) {
    next(err);
  }
}
