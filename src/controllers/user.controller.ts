import { Request, Response, NextFunction } from "express";
import { Rol } from "@prisma/client";
import * as userService from "../services/user.service";
import { isValidEmail, isValidPassword, isValidUUID, isValidEnum } from "../lib/validators";

// Helper: garantiza que el usuario autenticado pertenece a una empresa.
// El admin de plataforma (empresa_id = null) no opera a través de estos endpoints.
function requireEmpresaId(req: Request, res: Response): string | null {
  if (!req.user!.empresaId) {
    res.status(403).json({ message: "Esta operación requiere un usuario de empresa" });
    return null;
  }
  return req.user!.empresaId;
}

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = requireEmpresaId(req, res);
    if (!empresaId) return;

    const users = await userService.listUsers(empresaId);
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = requireEmpresaId(req, res);
    if (!empresaId) return;

    const user = await userService.getUserById(empresaId, req.params.id as string);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = requireEmpresaId(req, res);
    if (!empresaId) return;

    const { nombre, email, password, rol } = req.body as {
      nombre?: string;
      email?: string;
      password?: string;
      rol?: Rol;
    };

    if (!nombre || !email || !password) {
      res.status(400).json({
        message: "nombre, email y contrasena son requeridos",
        request_id: req.requestId,
        endpoint_description: req.endpointDescription,
      });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ message: "El formato del email no es válido" });
      return;
    }

    if (!isValidPassword(password)) {
      res.status(400).json({ message: "La contraseña debe tener al menos 8 caracteres" });
      return;
    }

    if (rol && !isValidEnum(rol, ["gerente", "contador", "empleado"] as Rol[])) {
      res.status(400).json({ message: "Rol inválido. Valores permitidos: gerente, contador, empleado" });
      return;
    }

    const user = await userService.createUser(empresaId, { nombre, email, password, rol });
    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = requireEmpresaId(req, res);
    if (!empresaId) return;

    const { nombre, email, rol, avatar_url, activo } = req.body as {
      nombre?: string;
      email?: string;
      rol?: Rol;
      avatar_url?: string;
      activo?: boolean;
    };

    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ message: "ID de usuario inválido" });
      return;
    }

    if (email && !isValidEmail(email)) {
      res.status(400).json({ message: "El formato del email no es válido" });
      return;
    }

    if (rol && !isValidEnum(rol, ["gerente", "contador", "empleado"] as Rol[])) {
      res.status(400).json({ message: "Rol inválido. Valores permitidos: gerente, contador, empleado" });
      return;
    }

    const user = await userService.updateUser(
      empresaId,
      req.params.id as string,
      req.user!.userId,
      { nombre, email, rol, avatar_url, activo }
    );

    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function deactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const empresaId = requireEmpresaId(req, res);
    if (!empresaId) return;

    const user = await userService.deactivateUser(
      empresaId,
      req.params.id as string,
      req.user!.userId
    );
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}
