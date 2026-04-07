import cron from "node-cron";
import prisma from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// markOverdueTransactions
// Marca como 'overdue' todas las transacciones 'pending'
// cuya fecha_vencimiento ya pasó.
// También exportada para poder llamarla manualmente si se necesita.
// ─────────────────────────────────────────────────────────────
export async function markOverdueTransactions(): Promise<number> {
  const result = await prisma.transaccion.updateMany({
    where: {
      estado: "pending",
      fecha_vencimiento: { lt: new Date() },
    },
    data: { estado: "overdue" },
  });

  return result.count;
}

// ─────────────────────────────────────────────────────────────
// startOverdueJob
// Ejecuta markOverdueTransactions todos los días a medianoche.
// Llamar una vez en el arranque de la app.
// ─────────────────────────────────────────────────────────────
export function startOverdueJob(): void {
  // Ejecutar inmediatamente al arrancar para corregir cualquier atraso
  markOverdueTransactions()
    .then((n) => n > 0 && console.log(`[overdue-job] ${n} transacciones marcadas como overdue al iniciar`))
    .catch((e) => console.error("[overdue-job] Error al iniciar:", e));

  // Luego cada día a medianoche (00:00)
  cron.schedule("0 0 * * *", async () => {
    try {
      const n = await markOverdueTransactions();
      if (n > 0) console.log(`[overdue-job] ${n} transacciones marcadas como overdue`);
    } catch (e) {
      console.error("[overdue-job] Error en ejecución programada:", e);
    }
  });
}
