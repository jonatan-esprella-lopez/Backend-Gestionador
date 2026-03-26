import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "../lib/r2";

const FOLDER = "inventory";

/**
 * Sube un archivo de imagen a Cloudflare R2 y devuelve la URL pública.
 * La key tiene formato: inventory/<uuid>.<ext>
 */
export async function uploadImage(file: Express.Multer.File): Promise<string> {
  const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
  const key = `${FOLDER}/${randomUUID()}${ext}`;

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

/**
 * Elimina una imagen de R2 a partir de su URL pública.
 * No lanza error si la imagen no existe (idempotente).
 */
export async function deleteImage(publicUrl: string): Promise<void> {
  try {
    const key = publicUrl.replace(`${R2_PUBLIC_URL}/`, "");
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch {
    // No crítico — si falla el delete en R2 no bloqueamos la operación
  }
}
