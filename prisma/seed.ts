// ============================================================
// SEED — Datos iniciales del sistema
//
// Uso: npm run seed
//
// Crea:
//   1. Superusuario admin de plataforma (empresa_id = null)
//   2. Categorías globales de transacciones (empresa_id = null)
// ============================================================

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Credenciales del admin de plataforma ──────────────────
const ADMIN_EMAIL    = "admin@gestionador.com";
const ADMIN_PASSWORD = "Admin1234!";
const ADMIN_NOMBRE   = "Administrador";

// ── Monedas ISO 4217 ──────────────────────────────────────
const MONEDAS = [
  { codigo: "USD", nombre: "Dólar estadounidense", simbolo: "$"  },
  { codigo: "EUR", nombre: "Euro",                 simbolo: "€"  },
  { codigo: "MXN", nombre: "Peso mexicano",        simbolo: "$"  },
  { codigo: "COP", nombre: "Peso colombiano",      simbolo: "$"  },
  { codigo: "PEN", nombre: "Sol peruano",          simbolo: "S/" },
  { codigo: "ARS", nombre: "Peso argentino",       simbolo: "$"  },
  { codigo: "CLP", nombre: "Peso chileno",         simbolo: "$"  },
  { codigo: "BRL", nombre: "Real brasileño",       simbolo: "R$" },
  { codigo: "BOB", nombre: "Boliviano",            simbolo: "Bs" },
  { codigo: "VES", nombre: "Bolívar venezolano",   simbolo: "Bs" },
];

// ── Categorías globales ───────────────────────────────────
const GLOBAL_CATEGORIES = [
  // income
  { nombre: "Ventas",            tipo: "income"  as const },
  { nombre: "Servicios",         tipo: "income"  as const },
  { nombre: "Otros ingresos",    tipo: "income"  as const },
  // expense
  { nombre: "Compras",           tipo: "expense" as const },
  { nombre: "Nómina",            tipo: "expense" as const },
  { nombre: "Alquiler",          tipo: "expense" as const },
  { nombre: "Servicios Públicos",tipo: "expense" as const },
  { nombre: "Otros gastos",      tipo: "expense" as const },
];

async function seedMonedas() {
  let created = 0;

  for (const moneda of MONEDAS) {
    const exists = await prisma.moneda.findUnique({ where: { codigo: moneda.codigo } });
    if (!exists) {
      await prisma.moneda.create({ data: moneda });
      created++;
    }
  }

  console.log(created > 0
    ? `✓  ${created} monedas creadas.`
    : `⚠  Monedas ya existen. Omitidas.`
  );
}

async function seedAdmin() {
  const existing = await prisma.usuario.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    console.log(`⚠  Admin "${ADMIN_EMAIL}" ya existe. Omitido.`);
    return;
  }

  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  const admin = await prisma.usuario.create({
    data: {
      nombre:        ADMIN_NOMBRE,
      email:         ADMIN_EMAIL,
      password_hash,
      rol:           "admin",
      empresa_id:    null,
    },
  });

  console.log(`✓  Admin creado: ${admin.email} (id: ${admin.id})`);
  console.log(`   Cambia la contraseña después del primer login.`);
}

async function seedCategories() {
  let created = 0;

  for (const cat of GLOBAL_CATEGORIES) {
    const exists = await prisma.categoriaTransaccion.findFirst({
      where: { nombre: cat.nombre, tipo: cat.tipo, empresa_id: null },
    });

    if (!exists) {
      await prisma.categoriaTransaccion.create({
        data: { nombre: cat.nombre, tipo: cat.tipo, empresa_id: null },
      });
      created++;
    }
  }

  if (created > 0) {
    console.log(`✓  ${created} categorías globales creadas.`);
  } else {
    console.log(`⚠  Categorías globales ya existen. Omitidas.`);
  }
}

async function main() {
  await seedMonedas();
  await seedAdmin();
  await seedCategories();
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
