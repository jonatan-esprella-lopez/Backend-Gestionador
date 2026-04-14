// ─────────────────────────────────────────────────────────────
// it-mensual.job.ts
// Impuesto a las Transacciones (IT) — Bolivia, 3% sobre ingresos brutos.
//
// Se ejecuta el día 1 de cada mes a las 00:10.
// Calcula el IT sobre el total de facturas de venta del mes anterior
// (tipo IN ['venta', 'ticket_pos'], estado IN ['emitida', 'parcial', 'pagada'])
// y genera un asiento contable por empresa:
//   Db 5.2.06 Impuesto a las Transacciones (IT)
//   Cr 2.1.04 IT por Pagar
// ─────────────────────────────────────────────────────────────

import cron from "node-cron";
import Decimal from "decimal.js";
import prisma from "../lib/prisma";

const TASA_IT = new Decimal("0.03");

async function buscarCuentaPorCodigo(empresaId: string, codigo: string): Promise<string | null> {
  const cuenta = await prisma.cuentaContable.findFirst({
    where:  { empresa_id: empresaId, codigo, activo: true },
    select: { id: true },
  });
  return cuenta?.id ?? null;
}

// ─────────────────────────────────────────────────────────────
// calcularITMensual
// Procesa el IT del mes anterior para todas las empresas activas.
// Devuelve el número de asientos generados.
// ─────────────────────────────────────────────────────────────
export async function calcularITMensual(): Promise<number> {
  const ahora     = new Date();
  const mesPasado = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
  const finMes    = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59);

  const empresas = await prisma.empresa.findMany({ select: { id: true, nombre: true } });

  let asientosCreados = 0;

  for (const empresa of empresas) {
    try {
      // Sumar total de ingresos brutos del mes anterior
      const resultado = await prisma.factura.aggregate({
        where: {
          empresa_id:    empresa.id,
          tipo:          { in: ["venta", "ticket_pos"] },
          estado:        { in: ["emitida", "parcial", "pagada"] },
          fecha_emision: { gte: mesPasado, lte: finMes },
        },
        _sum: { total: true },
      });

      const ingresosBrutos = new Decimal(resultado._sum.total?.toString() ?? "0");
      if (ingresosBrutos.lte(0)) continue;

      const montoIT = ingresosBrutos.times(TASA_IT).toDecimalPlaces(2);

      const [cuentaIT, cuentaITPorPagar] = await Promise.all([
        buscarCuentaPorCodigo(empresa.id, "5.2.06"),
        buscarCuentaPorCodigo(empresa.id, "2.1.04"),
      ]);

      if (!cuentaIT || !cuentaITPorPagar) {
        console.warn(
          `[it-mensual-job] Empresa ${empresa.nombre}: cuentas 5.2.06 o 2.1.04 no configuradas. Omitiendo.`
        );
        continue;
      }

      // Verificar que no exista ya un asiento IT para este mes/empresa
      const mesLabel = `${mesPasado.getFullYear()}-${String(mesPasado.getMonth() + 1).padStart(2, "0")}`;
      const concepto = `IT 3% sobre ingresos brutos – ${mesLabel}`;

      const yaExiste = await prisma.asientoContable.findFirst({
        where: { empresa_id: empresa.id, concepto, tipo_origen: "ajuste" },
        select: { id: true },
      });
      if (yaExiste) continue;

      await prisma.asientoContable.create({
        data: {
          empresa_id:  empresa.id,
          numero:      0,
          fecha:       new Date(ahora.getFullYear(), ahora.getMonth(), 1),
          concepto,
          tipo_origen: "ajuste",
          usuario_id:  await obtenerUsuarioSistema(empresa.id),
          estado:      "confirmado",
          total_debe:  montoIT.toFixed(2),
          total_haber: montoIT.toFixed(2),
          movimientos: {
            create: [
              { cuenta_id: cuentaIT,         debe: montoIT.toNumber(), haber: 0,                  orden: 1 },
              { cuenta_id: cuentaITPorPagar, debe: 0,                  haber: montoIT.toNumber(), orden: 2 },
            ],
          },
        },
      });

      console.log(
        `[it-mensual-job] ${empresa.nombre}: IT ${montoIT.toFixed(2)} BOB sobre ${ingresosBrutos.toFixed(2)} BOB`
      );
      asientosCreados++;
    } catch (e) {
      console.error(`[it-mensual-job] Error procesando empresa ${empresa.nombre}:`, e);
    }
  }

  return asientosCreados;
}

/**
 * Obtiene el id del primer gerente de la empresa para asignar el asiento.
 * Fallback: lanza error si no hay usuarios en la empresa.
 */
async function obtenerUsuarioSistema(empresaId: string): Promise<string> {
  const usuario = await prisma.usuario.findFirst({
    where:  { empresa_id: empresaId, rol: "gerente" },
    select: { id: true },
  });
  if (!usuario) throw new Error(`No se encontró usuario gerente para empresa ${empresaId}.`);
  return usuario.id;
}

// ─────────────────────────────────────────────────────────────
// startITMensualJob
// Ejecuta el cálculo del IT el día 1 de cada mes a las 00:10.
// ─────────────────────────────────────────────────────────────
export function startITMensualJob(): void {
  cron.schedule("10 0 1 * *", async () => {
    try {
      const n = await calcularITMensual();
      console.log(`[it-mensual-job] ${n} asientos de IT generados.`);
    } catch (e) {
      console.error("[it-mensual-job] Error en ejecución programada:", e);
    }
  });

  console.log("[it-mensual-job] Job de IT mensual registrado (ejecuta el 1° de cada mes a las 00:10).");
}
