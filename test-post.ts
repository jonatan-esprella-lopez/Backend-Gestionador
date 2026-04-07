import prisma from "./src/lib/prisma";
import * as jwt from "jsonwebtoken";

const EMPRESA_ID = "69c54b69-bc63-41de-ac9b-b69df536293c";

const user = await prisma.usuario.findFirst({ where: { empresa_id: EMPRESA_ID } });
if (!user) throw new Error("No user");

const token = jwt.sign(
  { userId: user.id, empresaId: EMPRESA_ID, rol: user.rol },
  "gestionador_access_dev_2026",
  { expiresIn: "30m" }
);
const h = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

// ── 1. Estado ────────────────────────────────────────────────
const ws = await (await fetch("http://localhost:3000/api/whatsapp/status", { headers: h })).json() as {
  state: string; phone: string | null; qr: string | null;
};
console.log("━━━ ESTADO WA ━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(" Estado: ", ws.state);
console.log(" Teléfono:", ws.phone ?? "(ninguno)");
console.log(" QR:     ", ws.qr ? "Disponible" : "No");

if (ws.state === "qr_pending" && ws.qr) {
  const { writeFileSync } = await import("fs");
  const html = `<!DOCTYPE html><html><body style="background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<div style="text-align:center"><h1 style="color:#25D366;font-family:sans-serif">📱 Escanea con WhatsApp</h1>
<img src="${ws.qr}" style="width:400px;height:400px;border:12px solid #25D366;border-radius:16px"/>
<p style="color:#aaa;font-family:sans-serif">WhatsApp → Dispositivos vinculados → Vincular un dispositivo</p></div></body></html>`;
  writeFileSync("qr.html", html);
  console.log("\n✅ QR guardado en qr.html");
  console.log(" → Abre: " + process.cwd().replace(/\\/g, "/") + "/qr.html");
  await prisma.$disconnect();
  process.exit(0);
}

if (ws.state !== "connected") {
  console.log("\n⚠️  No conectado. Ejecuta: POST /api/whatsapp/connect");
  await prisma.$disconnect();
  process.exit(1);
}

// ── 2. Enviar mensaje directo a 59176937173 ──────────────────
console.log("\n━━━ ENVIANDO MENSAJE ━━━━━━━━━━━━━━━━━━━━━");
const numero = "59176937173";
const sr = await fetch("http://localhost:3000/api/whatsapp/messages", {
  method: "POST",
  headers: h,
  body: JSON.stringify({
    to: numero,
    message: "Hola! Prueba desde backend ContablePro 🎉 " + new Date().toLocaleTimeString(),
  }),
});
const sb = await sr.json() as { message?: string };
console.log(" HTTP status:", sr.status);
console.log(" Respuesta:  ", JSON.stringify(sb));

if (sr.status === 200) {
  console.log("\n✅ Mensaje enviado correctamente a", numero);
} else {
  console.log("\n❌ Falló el envío:", sb.message);
}

// ── 3. GET - verificar en BD ─────────────────────────────────
console.log("\n━━━ VERIFICANDO EN BD ━━━━━━━━━━━━━━━━━━━━");
const contacto = await prisma.contacto.findFirst({
  where: { empresa_id: EMPRESA_ID, telefono: { contains: "76937173" } },
});

if (!contacto) {
  console.log(" ⚠️  El contacto 76937173 no está en la BD.");
  console.log("    (Los mensajes directos no crean contacto/chat - solo envía por WA)");
  console.log("    El contacto se crea cuando ELLOS te respondan.");
} else {
  console.log(" Contacto:", contacto.nombre, "(" + contacto.telefono + ")");
  const chat = await prisma.chat.findFirst({
    where: { empresa_id: EMPRESA_ID, contacto_id: contacto.id },
    include: { mensajes: { orderBy: { created_at: "desc" }, take: 10 } },
  });
  if (chat) {
    console.log(" Chat ID:", chat.id);
    console.log(" Mensajes:");
    for (const m of chat.mensajes.reverse()) {
      const quien = m.remitente === "agent" ? "🧑 Agente" : m.remitente === "bot" ? "🤖 Bot" : "👤 Ellos";
      console.log(`   [${m.created_at.toLocaleTimeString()}] ${quien}: ${m.contenido.slice(0, 100)}`);
    }
  }
}

await prisma.$disconnect();
