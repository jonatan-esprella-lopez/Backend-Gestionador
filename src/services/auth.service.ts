import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";
import prisma from "../lib/prisma";
import jwtConfig from "../config/jwt.config";

interface AccessTokenPayload extends JwtPayload {
  userId: string;
  empresaId: string;
  rol: Rol;
}

interface RefreshTokenPayload extends JwtPayload {
  userId: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    nombre: string;
    email: string;
    rol: Rol;
    empresa_id: string | null;
  };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function buildAccessToken(user: {
  id: string;
  empresa_id: string | null;
  rol: Rol;
}): string {
  return jwt.sign(
    { userId: user.id, empresaId: user.empresa_id, rol: user.rol },
    jwtConfig.access.secret,
    { expiresIn: jwtConfig.access.expiresIn }
  );
}

function buildRefreshToken(userId: string): string {
  return jwt.sign(
    { userId },
    jwtConfig.refresh.secret,
    { expiresIn: jwtConfig.refresh.expiresIn }
  );
}

async function saveRefreshToken(userId: string, refreshToken: string): Promise<void> {
  const hash = await bcrypt.hash(refreshToken, 12);
  const expiresAt = new Date(Date.now() + jwtConfig.refresh.expiresInMs);

  await prisma.usuario.update({
    where: { id: userId },
    data: {
      refresh_token_hash: hash,
      refresh_token_expires_at: expiresAt,
    },
  });
}

async function clearRefreshToken(userId: string): Promise<void> {
  await prisma.usuario.update({
    where: { id: userId },
    data: {
      refresh_token_hash: null,
      refresh_token_expires_at: null,
    },
  });
}

export async function register(
  nombre: string,
  email: string,
  password: string,
  nombreEmpresa: string,
  monedaCodigo = "USD"
): Promise<LoginResult> {
  const emailTaken = await prisma.usuario.findUnique({ where: { email } });
  if (emailTaken) {
    throw Object.assign(new Error("El email ya esta registrado"), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const empresa = await tx.empresa.create({
      data: { nombre: nombreEmpresa, moneda_codigo: monedaCodigo },
    });

    return tx.usuario.create({
      data: {
        nombre,
        email,
        password_hash: passwordHash,
        rol: "admin",
        empresa_id: empresa.id,
      },
    });
  });

  const accessToken = buildAccessToken(user);
  const refreshToken = buildRefreshToken(user.id);

  await saveRefreshToken(user.id, refreshToken);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      empresa_id: user.empresa_id,
    },
  };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.usuario.findUnique({ where: { email } });
  const invalidError = Object.assign(new Error("Credenciales invalidas"), { status: 401 });

  if (!user || !user.activo) {
    throw invalidError;
  }

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) {
    throw invalidError;
  }

  const accessToken = buildAccessToken(user);
  const refreshToken = buildRefreshToken(user.id);

  await saveRefreshToken(user.id, refreshToken);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      nombre: user.nombre,
      email: user.email,
      rol: user.rol,
      empresa_id: user.empresa_id,
    },
  };
}

export async function refresh(refreshToken: string | undefined): Promise<TokenPair> {
  const invalidError = Object.assign(new Error("Sesion invalida o expirada"), { status: 401 });

  if (!refreshToken) {
    throw invalidError;
  }

  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(refreshToken, jwtConfig.refresh.secret) as RefreshTokenPayload;
  } catch {
    throw invalidError;
  }

  const user = await prisma.usuario.findUnique({ where: { id: payload.userId } });

  if (!user || !user.activo || !user.refresh_token_hash) {
    throw invalidError;
  }

  const tokenMatches = await bcrypt.compare(refreshToken, user.refresh_token_hash);

  if (!tokenMatches) {
    await clearRefreshToken(user.id);
    throw Object.assign(
      new Error("Token comprometido detectado. Todas las sesiones han sido cerradas."),
      { status: 401 }
    );
  }

  const newAccessToken = buildAccessToken(user);
  const newRefreshToken = buildRefreshToken(user.id);

  await saveRefreshToken(user.id, newRefreshToken);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }

  try {
    const payload = jwt.verify(refreshToken, jwtConfig.refresh.secret) as RefreshTokenPayload;
    await clearRefreshToken(payload.userId);
  } catch {
    return;
  }
}
