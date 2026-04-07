import prisma from "../lib/prisma";

const PUBLIC_SELECT = {
  id:            true,
  nombre:        true,
  moneda_codigo: true,
  logo_url:      true,
  created_at:    true,
  updated_at:    true,
  moneda: { select: { nombre: true, simbolo: true } },
} as const;

// ─────────────────────────────────────────────────────────────
// getCompany
// ─────────────────────────────────────────────────────────────
export async function getCompany(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({
    where:  { id: empresaId },
    select: PUBLIC_SELECT,
  });

  if (!empresa) {
    throw Object.assign(new Error("Empresa no encontrada"), { status: 404 });
  }

  return empresa;
}

// ─────────────────────────────────────────────────────────────
// updateCompany
// Solo gerente puede actualizar nombre, logo y moneda.
// ─────────────────────────────────────────────────────────────
export async function updateCompany(
  empresaId: string,
  data: { nombre?: string; logo_url?: string | null; moneda_codigo?: string }
) {
  if (data.moneda_codigo) {
    const moneda = await prisma.moneda.findUnique({ where: { codigo: data.moneda_codigo } });
    if (!moneda) {
      throw Object.assign(
        new Error(`Moneda '${data.moneda_codigo}' no encontrada`),
        { status: 404 }
      );
    }
  }

  return prisma.empresa.update({
    where: { id: empresaId },
    data: {
      ...(data.nombre        !== undefined && { nombre: data.nombre }),
      ...("logo_url"         in data       && { logo_url: data.logo_url }),
      ...(data.moneda_codigo !== undefined && { moneda_codigo: data.moneda_codigo }),
    },
    select: PUBLIC_SELECT,
  });
}
