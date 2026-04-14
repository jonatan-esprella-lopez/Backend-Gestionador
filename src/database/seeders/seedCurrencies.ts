import "dotenv/config";
import prisma from "../../lib/prisma";

const currencies = [
  { codigo: "USD", nombre: "Dolar Estadounidense", simbolo: "$" },
  { codigo: "EUR", nombre: "Euro", simbolo: "EUR" },
  { codigo: "MXN", nombre: "Peso Mexicano", simbolo: "$" },
  { codigo: "BOB", nombre: "Boliviano", simbolo: "Bs" },
] as const;

async function main() {
  await prisma.moneda.createMany({
    data: currencies.map((currency) => ({ ...currency })),
    skipDuplicates: true,
  });

  console.log(`Monedas registradas: ${currencies.length}`);
}

main()
  .catch((error) => {
    console.error("Error sembrando monedas:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
