type LogLevel = "INFO" | "WARN" | "ERROR";

const REDACTED_KEYS = new Set([
  "password",
  "password_hash",
  "authorization",
  "cookie",
  "access_token",
  "refresh_token",
  "refresh_token_hash",
  "jwt_access_secret",
  "jwt_refresh_secret",
]);

const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 10;
const MAX_OBJECT_KEYS = 20;
const MAX_STRING_LENGTH = 280;

function truncateString(value: string): string {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_STRING_LENGTH)}...`;
}

function sanitizeKeyValue(key: string, value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (REDACTED_KEYS.has(key.toLowerCase())) {
    return "[REDACTED]";
  }

  return sanitizeValue(value, depth, seen);
}

export function sanitizeValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: truncateString(value.stack ?? ""),
    };
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer length=${value.length}]`;
  }

  if (depth >= MAX_DEPTH) {
    return "[MaxDepth]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);

    const output: Record<string, unknown> = {};
    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);

    for (const [key, entryValue] of entries) {
      output[key] = sanitizeKeyValue(key, entryValue, depth + 1, seen);
    }

    return output;
  }

  return String(value);
}

// ─── ANSI color helpers ──────────────────────────────────────────────────────
const IS_DEV = process.env.NODE_ENV !== "production";

const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  red:     "\x1b[31m",
  cyan:    "\x1b[36m",
  magenta: "\x1b[35m",
  blue:    "\x1b[34m",
  gray:    "\x1b[90m",
  white:   "\x1b[37m",
};

function statusColor(code: number): string {
  if (code >= 500) return C.red + C.bold;
  if (code >= 400) return C.yellow + C.bold;
  if (code >= 300) return C.cyan;
  return C.green;
}

function methodColor(method: string): string {
  switch (method) {
    case "GET":    return C.blue + C.bold;
    case "POST":   return C.green + C.bold;
    case "PATCH":  return C.yellow + C.bold;
    case "PUT":    return C.yellow + C.bold;
    case "DELETE": return C.red + C.bold;
    default:       return C.white + C.bold;
  }
}

function levelColor(level: LogLevel): string {
  switch (level) {
    case "ERROR": return C.red + C.bold;
    case "WARN":  return C.yellow + C.bold;
    default:      return C.green + C.bold;
  }
}

function prettyLog(level: LogLevel, event: string, data: Record<string, unknown>): void {
  const time = new Date().toLocaleTimeString("es", { hour12: false });
  const levelTag = `${levelColor(level)}${level.padEnd(5)}${C.reset}`;

  // ── Request start: single compact line ───────────────────────────────────
  if (event === "request:start") {
    const method  = String(data.method  ?? "");
    const path    = String(data.path    ?? "");
    const reqId   = String(data.request_id ?? "").slice(-8);
    const auth    = data.auth as Record<string, unknown> | undefined;
    const rol     = String(auth?.rol ?? "-");
    console.log(
      `${C.gray}${time}${C.reset} ${levelTag}` +
      `  ${methodColor(method)}${method.padEnd(7)}${C.reset}` +
      `  ${C.white}${path}${C.reset}` +
      `  ${C.gray}[${reqId}]${C.reset}` +
      `  ${C.magenta}${rol}${C.reset}`
    );
    return;
  }

  // ── Request finish: compact line with status + duration ──────────────────
  if (event === "request:finish") {
    const method   = String(data.method      ?? "");
    const path     = String(data.path        ?? "");
    const status   = Number(data.status_code ?? 0);
    const dur      = String(data.duration_ms ?? "?");
    const reqId    = String(data.request_id  ?? "").slice(-8);
    const userId   = String(data.user_id     ?? "-").slice(0, 8);

    const statusStr = `${statusColor(status)}${status}${C.reset}`;
    const durStr    = `${C.cyan}${dur}ms${C.reset}`;

    // Show response body only on errors
    const response = data.response as Record<string, unknown> | undefined;
    let extra = "";
    if (status >= 400 && response?.message) {
      extra = `  ${C.red}→ ${response.message}${C.reset}`;
    } else if (status >= 200 && status < 300 && response) {
      // Just show collection size if it's a list
      const resp = response as Record<string, unknown>;
      if (typeof resp.total === "number") {
        extra = `  ${C.gray}(${resp.total} items)${C.reset}`;
      }
    }

    console.log(
      `${C.gray}${time}${C.reset} ${levelTag}` +
      `  ${methodColor(method)}${method.padEnd(7)}${C.reset}` +
      `  ${C.white}${path}${C.reset}` +
      `  ${statusStr}` +
      `  ${durStr}` +
      `  ${C.gray}[${reqId}] u:${userId}${C.reset}` +
      extra
    );
    return;
  }

  // ── Generic events (whatsapp:qr, auth failures, etc.) ────────────────────
  const extras = Object.entries(data)
    .filter(([k]) => !["timestamp", "level", "event"].includes(k))
    .map(([k, v]) => `${C.gray}${k}${C.reset}=${C.cyan}${JSON.stringify(v)}${C.reset}`)
    .join("  ");

  console.log(`${C.gray}${time}${C.reset} ${levelTag}  ${C.magenta}${event}${C.reset}  ${extras}`);
}

function writeLog(level: LogLevel, event: string, data: Record<string, unknown>): void {
  if (IS_DEV) {
    prettyLog(level, event, data);
    return;
  }

  // Production: structured JSON (unchanged)
  const sanitizedData = sanitizeValue(data);
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...(
      typeof sanitizedData === "object" && sanitizedData !== null
        ? (sanitizedData as Record<string, unknown>)
        : { data: sanitizedData }
    ),
  };

  const serialized = JSON.stringify(entry);
  switch (level) {
    case "ERROR": console.error(serialized); return;
    case "WARN":  console.warn(serialized);  return;
    default:      console.log(serialized);
  }
}

export function logInfo(event: string, data: Record<string, unknown>): void {
  writeLog("INFO", event, data);
}

export function logWarn(event: string, data: Record<string, unknown>): void {
  writeLog("WARN", event, data);
}

export function logError(event: string, data: Record<string, unknown>): void {
  writeLog("ERROR", event, data);
}
