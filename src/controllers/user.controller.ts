import { Request, Response, NextFunction } from "express";
import { Rol } from "@prisma/client";
import * as userService from "../services/user.service";

// ─────────────────────────────────────────────────────────────
// GET /api/users
// ─────────────────────────────────────────────────────────────
export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await userService.listUsers(req.user!.empresaId);
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/users/:id
// ─────────────────────────────────────────────────────────────
export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.getUserById(req.user!.empresaId, req.params.id as string);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/users
// Body: { nombre, email, password, rol? }
// ─────────────────────────────────────────────────────────────
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, email, password, rol } = req.body as {
      nombre?: string;
      email?: string;
      password?: string;
      rol?: Rol;
    };

    if (!nombre || !email || !password) {
      res.status(400).json({ message: "nombre, email y contraseña son requeridos" });
      return;
    }

    const user = await userService.createUser(req.user!.empresaId, { nombre, email, password, rol });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/users/:id
// Body: { nombre?, email?, rol?, avatar_url?, activo? }
// ─────────────────────────────────────────────────────────────
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, email, rol, avatar_url, activo } = req.body as {
      nombre?: string;
      email?: string;
      rol?: Rol;
      avatar_url?: string;
      activo?: boolean;
    };

    const user = await userService.updateUser(
      req.user!.empresaId,
      req.params.id as string,
      req.user!.userId,
      { nombre, email, rol, avatar_url, activo }
    );

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/users/:id  (soft delete → activo = false)
// ─────────────────────────────────────────────────────────────
export async function deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await userService.deactivateUser(
      req.user!.empresaId,
      req.params.id as string,
      req.user!.userId
    );
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}
