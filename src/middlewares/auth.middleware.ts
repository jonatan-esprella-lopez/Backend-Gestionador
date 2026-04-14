import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { Rol } from "@prisma/client";
import jwtConfig from "../config/jwt.config";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      message: "Token de acceso requerido",
      request_id: req.requestId,
      endpoint_description: req.endpointDescription,
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    req.user = jwt.verify(token, jwtConfig.access.secret) as Request["user"];
    next();
  } catch {
    res.status(401).json({
      message: "Token invalido o expirado",
      request_id: req.requestId,
      endpoint_description: req.endpointDescription,
    });
  }
}

export function authorize(...roles: Rol[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.rol)) {
      res.status(403).json({
        message: "No tienes permiso para esta accion",
        request_id: req.requestId,
        endpoint_description: req.endpointDescription,
      });
      return;
    }

    next();
  };
}
