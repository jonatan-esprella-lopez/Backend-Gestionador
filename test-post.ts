import prisma from "./src/lib/prisma";
import * as jwt from "jsonwebtoken";

const EMPRESA_ID = "69c54b69-bc63-41de-ac9b-b69df536293c";

async function main() {
  const user = await prisma.usuario.findFirst({ where: { empresa_id: EMPRESA_ID } });
  if (!user) throw new Error("No user");

  const token = jwt.sign(
    { userId: user.id, empresaId: EMPRESA_ID, rol: user.rol },
    "gestionador_access_dev_2026",
    { expiresIn: "30m" }
  );
  const h = { Authorization: "Bearer " + token, "Content-Type": "application/json" };

  console.log("\n━━━ BUSCANDO CHAT PARA DEPURAR ━━━");
  const chat = await prisma.chat.findFirst({
    where: { empresa_id: EMPRESA_ID, contacto: { telefono: { not: null } } },
    include: { contacto: true }
  });

  if (!chat) {
    console.log("❌ No se encontró ningún chat con teléfono registrado.");
    return;
  }
  
  console.log("Chat encontrado!");
  console.log("ID Chat:", chat.id);
  console.log("Contacto:", chat.contacto.nombre);
  console.log("Teléfono:", chat.contacto.telefono);

  console.log("\n━━━ ENVIANDO MENSAJE DESDE INTERFAZ CHATS ━━━");
  const sr = await fetch(`http://localhost:3000/api/whatsapp/chats/${chat.id}/messages`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      message: "🚀 TEST final de mensajería (a través de la UI) " + new Date().toLocaleTimeString(),
    }),
  });

  const sb = await sr.json();
  console.log("HTTP status:", sr.status);
  console.log("wa_sent:", sb.wa_sent);
  console.log("wa_error:", sb.wa_error);
  console.log("\nSi 'wa_sent' es true, significa que WhatsApp lo ha mandado con éxito desde el servidor local.");
    
  await prisma.$disconnect();
}

main().catch(console.error);
