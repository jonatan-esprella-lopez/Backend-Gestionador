import rateLimit from "express-rate-limit";

// ─────────────────────────────────────────────────────────────
// Límite general — todas las rutas de la API
// Dev: 500/15min (StrictMode duplica effects + múltiples stores)
// Prod: 200/15min (ERP de uso interno, sesiones de trabajo activas)
// ─────────────────────────────────────────────────────────────
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "production" ? 200 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas peticiones. Intenta de nuevo en 15 minutos." },
});

// ─────────────────────────────────────────────────────────────
// Límite de autenticación — /api/auth/login y /api/auth/register
// 10 intentos por IP cada 15 minutos
// Previene fuerza bruta sobre credenciales
// ─────────────────────────────────────────────────────────────
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos." },
});

// ─────────────────────────────────────────────────────────────
// Límite WhatsApp — rutas de polling frecuente (chats, mensajes)
// 1000 peticiones por IP cada 15 minutos (~1 req/s sostenido)
// Se aplica ANTES del generalLimiter en esas rutas específicas
// ─────────────────────────────────────────────────────────────
export const whatsappLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Demasiadas peticiones a WhatsApp. Intenta de nuevo en 15 minutos." },
});
