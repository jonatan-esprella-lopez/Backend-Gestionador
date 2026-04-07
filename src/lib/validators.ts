// ============================================================
// validators.ts — Helpers de validación reutilizables
// ============================================================

// ── Email ────────────────────────────────────────────────────
// Verifica formato básico user@domain.tld
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

// ── UUID ─────────────────────────────────────────────────────
// Formato estándar: 8-4-4-4-12 hexadecimal
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

// ── Fecha ISO ────────────────────────────────────────────────
// Acepta YYYY-MM-DD o ISO 8601 completo
export function isValidDate(value: string): boolean {
  if (!value || typeof value !== "string") return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

// ── Número positivo ──────────────────────────────────────────
// Verifica que el valor sea un número finito mayor que 0
export function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value) && value > 0;
}

// ── Número no negativo ───────────────────────────────────────
export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && isFinite(value) && value >= 0;
}

// ── Entero positivo ──────────────────────────────────────────
export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

// ── Enum ─────────────────────────────────────────────────────
// Verifica que value es uno de los valores permitidos del enum
export function isValidEnum<T extends string>(value: unknown, validValues: T[]): value is T {
  return typeof value === "string" && validValues.includes(value as T);
}

// ── Password ─────────────────────────────────────────────────
// Mínimo 8 caracteres
export function isValidPassword(value: string): boolean {
  return typeof value === "string" && value.length >= 8;
}

// ── Número entero desde query string ─────────────────────────
// Parsea y valida que el string sea un entero positivo válido
export function parsePositiveInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) || n <= 0 ? undefined : n;
}

export function parsePositiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseFloat(value);
  return isNaN(n) || n <= 0 ? undefined : n;
}
