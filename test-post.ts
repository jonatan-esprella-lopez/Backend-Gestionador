import * as jwt from "jsonwebtoken";
import prisma from "./src/lib/prisma";

async function run() {
  const user = await prisma.usuario.findFirst({ where: { rol: "admin" } });
  if (!user) throw new Error("No admin user found");

  const chat = await prisma.chat.findFirst({ where: { empresa_id: user.empresa_id }});
  if (!chat) throw new Error("No chat found");

  const token = jwt.sign(
    { userId: user.id, empresaId: user.empresa_id, rol: user.rol },
    process.env.JWT_ACCESS_SECRET || "gestionador_access_dev_2026",
    { expiresIn: "10m" }
  );

  const res = await fetch(`http://localhost:3000/api/whatsapp/chats/${chat.id}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ message: "Test info error" })
  });
  
  const text = await res.text();
  console.log("STATUS:", res.status);
  console.log("RESPONSE:", text);
}

run().catch(console.error);
