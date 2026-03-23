import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";
import prisma from "../lib/prisma";
import jwtConfig from "../config/jwt.config";

// ─────────────────────────────────────────────────────────────
// Tipos internos
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────
// register
// Crea empresa + usuario admin en una sola transacción.
// El que registra es siempre admin de su empresa.
// ─────────────────────────────────────────────────────────────
export async function register(
  nombre: string,
  email: string,
  password: string,
  nombreEmpresa: string,
  monedaCodigo = "USD"
): Promise<LoginResult> {
  const emailTaken = await prisma.usuario.findUnique({ where: { email } });
  if (emailTaken) {
    throw Object.assign(new Error("El email ya está registrado"), { status: 409 });
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
        rol: "gerente",
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

// ─────────────────────────────────────────────────────────────
// login
// Verifica credenciales, genera ambos tokens y los persiste.
// ─────────────────────────────────────────────────────────────
export async function login(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.usuario.findUnique({ where: { email } });

  // Respuesta genérica para no revelar si el email existe o no
  const invalidErr = Object.assign(new Error("Credenciales inválidas"), { status: 401 });

  if (!user || !user.activo) throw invalidErr;

  const passwordOk = await bcrypt.compare(password, user.password_hash);
  if (!passwordOk) throw invalidErr;

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

// ─────────────────────────────────────────────────────────────
// refresh + rotación
//
// Flujo:
//   1. Verifica firma y expiración del refresh token JWT.
//   2. Carga el usuario y compara el token con el hash guardado.
//   3. Si NO coincide → token ya fue rotado y alguien lo reutilizó
//      → COMPROMISO: se invalidan todas las sesiones del usuario.
//   4. Si SÍ coincide → rotación: se generan nuevos tokens y
//      se reemplaza el hash en BD.
// ─────────────────────────────────────────────────────────────
export async function refresh(refreshToken: string | undefined): Promise<TokenPair> {
  const invalidErr = Object.assign(new Error("Sesión inválida o expirada"), { status: 401 });

  if (!refreshToken) throw invalidErr;

  // 1. Verificar firma y expiración
  let payload: RefreshTokenPayload;
  try {
    payload = jwt.verify(refreshToken, jwtConfig.refresh.secret) as RefreshTokenPayload;
  } catch {
    throw invalidErr;
  }

  // 2. Cargar usuario y su hash almacenado
  const user = await prisma.usuario.findUnique({ where: { id: payload.userId } });

  if (!user || !user.activo || !user.refresh_token_hash) throw invalidErr;

  const tokenMatches = await bcrypt.compare(refreshToken, user.refresh_token_hash);

  // 3. Detección de reutilización → compromiso confirmado
  if (!tokenMatches) {
    await clearRefreshToken(user.id);

    throw Object.assign(
      new Error("Token comprometido detectado. Todas las sesiones han sido cerradas."),
      { status: 401 }
    );
  }

  // 4. Rotación: nuevos tokens, nuevo hash en BD
  const newAccessToken = buildAccessToken(user);
  const newRefreshToken = buildRefreshToken(user.id);

  await saveRefreshToken(user.id, newRefreshToken);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ─────────────────────────────────────────────────────────────
// logout
// Invalida el refresh token en BD y limpia la cookie.
// Funciona incluso si el access token ya expiró: verifica
// solo la firma del refresh token para obtener el userId.
// ─────────────────────────────────────────────────────────────
export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;

  try {
    const payload = jwt.verify(refreshToken, jwtConfig.refresh.secret) as RefreshTokenPayload;
    await clearRefreshToken(payload.userId);
  } catch {
    // Token inválido o expirado: no hay sesión activa que invalidar
  }
}
