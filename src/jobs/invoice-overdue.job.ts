import cron from "node-cron";
import prisma from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// markOverdueInvoices
// Marca como 'vencida' todas las facturas en estado 'emitida' o
// 'parcial' cuya fecha_vencimiento ya pasó.
// ─────────────────────────────────────────────────────────────
export async function markOverdueInvoices(): Promise<number> {
  const result = await prisma.factura.updateMany({
    where: {
      estado:            { in: ["emitida", "parcial"] },
      fecha_vencimiento: { lt: new Date() },
    },
    data: { estado: "vencida" },
  });

  return result.count;
}

// ─────────────────────────────────────────────────────────────
// startInvoiceOverdueJob
// Ejecuta markOverdueInvoices todos los días a las 00:05.
// Llamar una vez en el arranque de la app.
// ─────────────────────────────────────────────────────────────
export function startInvoiceOverdueJob(): void {
  // Ejecutar inmediatamente al arrancar para corregir cualquier atraso
  markOverdueInvoices()
    .then((n) => n > 0 && console.log(`[invoice-overdue-job] ${n} facturas marcadas como vencidas al iniciar`))
    .catch((e) => console.error("[invoice-overdue-job] Error al iniciar:", e));

  cron.schedule("5 0 * * *", async () => {
    try {
      const n = await markOverdueInvoices();
      if (n > 0) console.log(`[invoice-overdue-job] ${n} facturas marcadas como vencidas`);
    } catch (e) {
      console.error("[invoice-overdue-job] Error en ejecución programada:", e);
    }
  });
}
