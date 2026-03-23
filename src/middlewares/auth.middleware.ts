import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Rol } from "@prisma/client";
import jwtConfig from "../config/jwt.config";

// ─────────────────────────────────────────────────────────────
// authenticate
// Verifica el access token del header Authorization.
// Si es válido, adjunta el payload a req.user y llama next().
// Uso: router.get("/ruta-protegida", authenticate, handler)
// ─────────────────────────────────────────────────────────────
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token de acceso requerido" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, jwtConfig.access.secret) as Request["user"];
    next();
  } catch {
    res.status(401).json({ message: "Token inválido o expirado" });
  }
}

// ─────────────────────────────────────────────────────────────
// authorize(...roles)
// Verifica que el usuario autenticado tenga uno de los roles
// indicados. Debe usarse DESPUÉS de authenticate.
// Uso: router.delete("/ruta", authenticate, authorize("admin"), handler)
// ─────────────────────────────────────────────────────────────
export function authorize(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({ message: "No tienes permiso para esta acción" });
      return;
    }
    next();
  };
}
