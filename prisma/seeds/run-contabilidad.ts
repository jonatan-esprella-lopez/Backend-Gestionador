import { Client } from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(__dirname, "../../.env") });

export async function seedContabilidad() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const sql = readFileSync(resolve(__dirname, "contabilidad_raw.sql"), "utf-8");

  console.log("Ejecutando contabilidad_raw.sql...");
  await client.query(sql);
  console.log("✓ Contabilidad SQL ejecutado correctamente.");

  await client.end();
}

// Permite ejecutarse de forma independiente: tsx prisma/seeds/run-contabilidad.ts
if (require.main === module) {
  seedContabilidad().catch((e) => {
    console.error("Error:", e.message);
    process.exit(1);
  });
}
