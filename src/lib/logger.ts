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

function writeLog(level: LogLevel, event: string, data: Record<string, unknown>): void {
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
    case "ERROR":
      console.error(serialized);
      return;
    case "WARN":
      console.warn(serialized);
      return;
    default:
      console.log(serialized);
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
