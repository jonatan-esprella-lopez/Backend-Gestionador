import { Request, Response, NextFunction } from "express";
import * as authService from "../services/auth.service";
import jwtConfig from "../config/jwt.config";

// ─────────────────────────────────────────────────────────────
// POST /api/auth/register
// Body: { nombre, email, password, nombre_empresa, moneda_codigo? }
// Respuesta: { access_token, user }  +  cookie refresh_token
// ─────────────────────────────────────────────────────────────
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
      res.status(400).json({ message: "nombre, email, contraseña y nombre_empresa son requeridos" });
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

// ─────────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// Respuesta: { access_token, user }  +  cookie refresh_token
// ─────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ message: "Email y contraseña son requeridos" });
      return;
    }

    const { accessToken, refreshToken, user } = await authService.login(email, password);

    res.cookie("refresh_token", refreshToken, jwtConfig.cookie);
    res.status(200).json({ access_token: accessToken, user });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// Cookie: refresh_token
// Respuesta: { access_token }  +  cookie refresh_token rotado
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// POST /api/auth/logout
// Cookie: refresh_token (opcional — si expiró también funciona)
// Respuesta: 200 + limpia la cookie
// ─────────────────────────────────────────────────────────────
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.logout(req.cookies.refresh_token as string | undefined);

    res.clearCookie("refresh_token", jwtConfig.cookie);
    res.status(200).json({ message: "Sesión cerrada exitosamente" });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/auth/me
// Header: Authorization: Bearer <access_token>
// Respuesta: { user } extraído del token (sin tocar la BD)
// ─────────────────────────────────────────────────────────────
export function me(req: Request, res: Response): void {
  res.status(200).json({ user: req.user });
}
