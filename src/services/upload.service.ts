import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { r2, R2_BUCKET, R2_PUBLIC_URL, R2_CONFIGURED } from "../lib/r2";

const FOLDER    = "inventory";
const LOCAL_DIR = path.resolve("uploads", FOLDER);

/**
 * Sube un archivo de imagen.
 * - Si R2 está configurado → sube a Cloudflare R2 y devuelve la URL pública del CDN.
 * - Si no (dev/local)     → guarda en disco en /uploads/inventory/ y devuelve la URL local.
 */
export async function uploadImage(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
  const key = `${FOLDER}/${randomUUID()}${ext}`;

  if (R2_CONFIGURED && r2) {
    await r2.send(
      new PutObjectCommand({
        Bucket:      R2_BUCKET,
        Key:         key,
        Body:        file.buffer,
        ContentType: file.mimetype,
      })
    );
    return `${R2_PUBLIC_URL}/${key}`;
  }

  // Fallback local para desarrollo — URL relativa para que el proxy de Vite la sirva sin CORS
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  fs.writeFileSync(path.join(LOCAL_DIR, path.basename(key)), file.buffer);
  return `/uploads/${key}`;
}

/**
 * Elimina una imagen.
 * - R2: llama a DeleteObject.
 * - Local: elimina el archivo del disco.
 * No lanza error si la imagen no existe (idempotente).
 */
export async function deleteImage(publicUrl: string): Promise<void> {
  try {
    if (R2_CONFIGURED && r2) {
      const key = publicUrl.replace(`${R2_PUBLIC_URL}/`, "");
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } else {
      const filename = path.basename(publicUrl);
      const filePath = path.join(LOCAL_DIR, filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch {
    // No crítico — si falla el delete no bloqueamos la operación
  }
}
