import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";
import prisma from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────

export interface UserPublic {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  avatar_url: string | null;
  activo: boolean;
  empresa_id: string | null;
  created_at: Date;
}

// Selección que excluye campos sensibles
const PUBLIC_SELECT = {
  id: true,
  nombre: true,
  email: true,
  rol: true,
  avatar_url: true,
  activo: true,
  empresa_id: true,
  created_at: true,
} as const;

function notFound() {
  return Object.assign(new Error("Usuario no encontrado"), { status: 404 });
}

function sameCompanyFilter(empresaId: string, userId: string) {
  return { id: userId, empresa_id: empresaId };
}

// ─────────────────────────────────────────────────────────────
// list — todos los usuarios de la empresa del admin
// ─────────────────────────────────────────────────────────────
export async function listUsers(empresaId: string): Promise<UserPublic[]> {
  return prisma.usuario.findMany({
    where: { empresa_id: empresaId },
    select: PUBLIC_SELECT,
    orderBy: { created_at: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────
// getById — un usuario de la empresa
// ─────────────────────────────────────────────────────────────
export async function getUserById(empresaId: string, userId: string): Promise<UserPublic> {
  const user = await prisma.usuario.findFirst({
    where: sameCompanyFilter(empresaId, userId),
    select: PUBLIC_SELECT,
  });

  if (!user) throw notFound();
  return user;
}

// ─────────────────────────────────────────────────────────────
// create — admin crea un usuario en su empresa
// ─────────────────────────────────────────────────────────────
export async function createUser(
  empresaId: string,
  data: { nombre: string; email: string; password: string; rol?: Rol }
): Promise<UserPublic> {
  const emailTaken = await prisma.usuario.findUnique({ where: { email: data.email } });
  if (emailTaken) {
    throw Object.assign(new Error("El email ya está registrado"), { status: 409 });
  }

  const password_hash = await bcrypt.hash(data.password, 12);

  return prisma.usuario.create({
    data: {
      nombre: data.nombre,
      email: data.email,
      password_hash,
      rol: data.rol ?? "operador",
      empresa_id: empresaId,
    },
    select: PUBLIC_SELECT,
  });
}

// ─────────────────────────────────────────────────────────────
// update — admin actualiza datos de un usuario de su empresa
// Un admin no puede cambiar su propio rol para evitar bloqueos
// ─────────────────────────────────────────────────────────────
export async function updateUser(
  empresaId: string,
  userId: string,
  requesterId: string,
  data: { nombre?: string; email?: string; rol?: Rol; avatar_url?: string; activo?: boolean }
): Promise<UserPublic> {
  const exists = await prisma.usuario.findFirst({
    where: sameCompanyFilter(empresaId, userId),
  });
  if (!exists) throw notFound();

  if (data.rol && userId === requesterId) {
    throw Object.assign(new Error("No puedes cambiar tu propio rol"), { status: 403 });
  }

  if (data.email && data.email !== exists.email) {
    const emailTaken = await prisma.usuario.findUnique({ where: { email: data.email } });
    if (emailTaken) {
      throw Object.assign(new Error("El email ya está registrado"), { status: 409 });
    }
  }

  return prisma.usuario.update({
    where: { id: userId },
    data,
    select: PUBLIC_SELECT,
  });
}

// ─────────────────────────────────────────────────────────────
// deactivate — soft delete: activo = false
// Un admin no puede desactivarse a sí mismo
// ─────────────────────────────────────────────────────────────
export async function deactivateUser(
  empresaId: string,
  userId: string,
  requesterId: string
): Promise<UserPublic> {
  if (userId === requesterId) {
    throw Object.assign(new Error("No puedes desactivar tu propia cuenta"), { status: 403 });
  }

  const exists = await prisma.usuario.findFirst({
    where: sameCompanyFilter(empresaId, userId),
  });
  if (!exists) throw notFound();

  return prisma.usuario.update({
    where: { id: userId },
    data: { activo: false },
    select: PUBLIC_SELECT,
  });
}
