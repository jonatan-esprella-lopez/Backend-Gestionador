import bcrypt from "bcryptjs";
import { Rol } from "@prisma/client";
import prisma from "../lib/prisma";

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

export async function listUsers(empresaId: string): Promise<UserPublic[]> {
  return prisma.usuario.findMany({
    where: { empresa_id: empresaId },
    select: PUBLIC_SELECT,
    orderBy: { created_at: "asc" },
  });
}

export async function getUserById(empresaId: string, userId: string): Promise<UserPublic> {
  const user = await prisma.usuario.findFirst({
    where: sameCompanyFilter(empresaId, userId),
    select: PUBLIC_SELECT,
  });

  if (!user) {
    throw notFound();
  }

  return user;
}

export async function createUser(
  empresaId: string,
  data: { nombre: string; email: string; password: string; rol?: Rol }
): Promise<UserPublic> {
  // Solo se pueden crear roles de empresa — jamás admin o gerente via API
  const rolesPermitidos: Rol[] = ["contador", "empleado"];
  if (data.rol && !rolesPermitidos.includes(data.rol)) {
    throw Object.assign(
      new Error("Solo se pueden crear usuarios con rol 'contador' o 'empleado'"),
      { status: 400 }
    );
  }

  const emailTaken = await prisma.usuario.findUnique({ where: { email: data.email } });
  if (emailTaken) {
    throw Object.assign(new Error("El email ya esta registrado"), { status: 409 });
  }

  const password_hash = await bcrypt.hash(data.password, 12);

  return prisma.usuario.create({
    data: {
      nombre: data.nombre,
      email: data.email,
      password_hash,
      rol: data.rol ?? "empleado",
      empresa_id: empresaId,
    },
    select: PUBLIC_SELECT,
  });
}

export async function updateUser(
  empresaId: string,
  userId: string,
  requesterId: string,
  data: { nombre?: string; email?: string; rol?: Rol; avatar_url?: string; activo?: boolean }
): Promise<UserPublic> {
  const exists = await prisma.usuario.findFirst({
    where: sameCompanyFilter(empresaId, userId),
  });

  if (!exists) {
    throw notFound();
  }

  if (data.rol && userId === requesterId) {
    throw Object.assign(new Error("No puedes cambiar tu propio rol"), { status: 403 });
  }

  if (data.email && data.email !== exists.email) {
    const emailTaken = await prisma.usuario.findUnique({ where: { email: data.email } });
    if (emailTaken) {
      throw Object.assign(new Error("El email ya esta registrado"), { status: 409 });
    }
  }

  return prisma.usuario.update({
    where: { id: userId },
    data,
    select: PUBLIC_SELECT,
  });
}

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

  if (!exists) {
    throw notFound();
  }

  return prisma.usuario.update({
    where: { id: userId },
    data: { activo: false },
    select: PUBLIC_SELECT,
  });
}
