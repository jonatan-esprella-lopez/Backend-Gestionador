import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import jwtConfig from "../config/jwt.config";

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { nombre, email, password, nombre_empresa, moneda_codigo } = req.body as {
      nombre?: string;
      email?: string;
      password?: string;
      nombre_empresa?: string;
      moneda_codigo?: string;
    };

    if (!nombre || !email || !password || !nombre_empresa) {
      res.status(400).json({
        message: "nombre, email, contrasena y nombre_empresa son requeridos",
        request_id: req.requestId,
        endpoint_description: req.endpointDescription,
      });
      return;
    }

    const { accessToken, refreshToken, user } = await authService.register(
      nombre,
      email,
      password,
      nombre_empresa,
      moneda_codigo
    );

    res.cookie("refresh_token", refreshToken, jwtConfig.cookie);
    res.status(201).json({ access_token: accessToken, user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({
        message: "Email y contrasena son requeridos",
        request_id: req.requestId,
        endpoint_description: req.endpointDescription,
      });
      return;
    }

    const { accessToken, refreshToken, user } = await authService.login(email, password);

    res.cookie("refresh_token", refreshToken, jwtConfig.cookie);
    res.status(200).json({ access_token: accessToken, user });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { accessToken, refreshToken } = await authService.refresh(
      req.cookies.refresh_token as string | undefined
    );

    res.cookie("refresh_token", refreshToken, jwtConfig.cookie);
    res.status(200).json({ access_token: accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(req.cookies.refresh_token as string | undefined);

    res.clearCookie("refresh_token", jwtConfig.cookie);
    res.status(200).json({ message: "Sesion cerrada exitosamente" });
  } catch (err) {
    next(err);
  }
}

export function me(req: Request, res: Response): void {
  res.status(200).json({ user: req.user });
}
