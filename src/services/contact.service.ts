// ============================================================
// contact.service.ts — Gestión de contactos (clientes / proveedores)
// ============================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CrearContactoDto {
  nombre:           string;
  telefono?:        string;
  email?:           string;
  es_cliente?:      boolean;
  es_proveedor?:    boolean;
  nit?:             string;
  razon_social?:    string;
  direccion_fiscal?:string;
  ciudad?:          string;
}

export type ActualizarContactoDto = Partial<CrearContactoDto> & { activo?: boolean };

const CONTACT_SELECT = {
  id:           true,
  nombre:       true,
  razon_social: true,
  nit:          true,
  telefono:     true,
  email:        true,
  es_cliente:   true,
  es_proveedor: true,
  activo:       true,
  ciudad:       true,
} as const;

export async function listarContactos(
  empresaId: string,
  filtros: {
    q?:           string;
    es_cliente?:  boolean;
    es_proveedor?:boolean;
    page?:        number;
    pageSize?:    number;
  }
) {
  const { q, es_cliente, es_proveedor, page = 1, pageSize = 50 } = filtros;

  const where = {
    empresa_id: empresaId,
    activo:     true,
    ...(es_cliente   !== undefined && { es_cliente }),
    ...(es_proveedor !== undefined && { es_proveedor }),
    ...(q && {
      OR: [
        { nombre:       { contains: q, mode: "insensitive" as const } },
        { razon_social: { contains: q, mode: "insensitive" as const } },
        { nit:          { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [total, contactos] = await Promise.all([
    prisma.contacto.count({ where }),
    prisma.contacto.findMany({
      where,
      orderBy: { nombre: "asc" },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
      select:  CONTACT_SELECT,
    }),
  ]);

  return { contactos, total, page, pageSize };
}

export async function crearContacto(empresaId: string, dto: CrearContactoDto) {
  return prisma.contacto.create({
    data: {
      empresa_id:       empresaId,
      nombre:           dto.nombre,
      telefono:         dto.telefono,
      email:            dto.email,
      es_cliente:       dto.es_cliente      ?? false,
      es_proveedor:     dto.es_proveedor    ?? false,
      nit:              dto.nit,
      razon_social:     dto.razon_social,
      direccion_fiscal: dto.direccion_fiscal,
      ciudad:           dto.ciudad          ?? "Cochabamba",
    },
    select: CONTACT_SELECT,
  });
}

export async function actualizarContacto(
  empresaId:   string,
  contactoId:  string,
  dto:         ActualizarContactoDto
) {
  const existe = await prisma.contacto.findFirst({
    where: { id: contactoId, empresa_id: empresaId },
  });
  if (!existe) throw new Error("Contacto no encontrado.");

  return prisma.contacto.update({
    where:  { id: contactoId },
    data:   dto,
    select: CONTACT_SELECT,
  });
}
