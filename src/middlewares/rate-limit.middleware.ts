import rateLimit from "express-rate-limit";

// ─────────────────────────────────────────────────────────────
// Límite general — todas las rutas de la API
// 100 peticiones por IP cada 15 minutos
// ─────────────────────────────────────────────────────────────
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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
