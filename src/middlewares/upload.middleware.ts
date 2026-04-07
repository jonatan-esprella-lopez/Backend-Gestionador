import multer from "multer";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Middleware multer para subida de imágenes.
 * - Almacena en memoria (sin tocar disco) para luego subirlo a R2.
 * - Acepta solo JPG, PNG y WebP.
 * - Límite de 5 MB por archivo.
 * - El campo del form debe llamarse "image".
 */
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Formato de imagen no permitido. Use JPG, PNG o WebP"));
    }
  },
}).single("image");
