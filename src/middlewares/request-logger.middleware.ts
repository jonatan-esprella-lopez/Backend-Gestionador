import type { NextFunction, Request, Response } from "express";
import { logError, logInfo, logWarn, sanitizeValue } from "../lib/logger";

interface EndpointDefinition {
  method: string;
  path: RegExp;
  description: string;
}

const endpointDefinitions: EndpointDefinition[] = [
  { method: "GET", path: /^\/$/, description: "Verificacion raiz del servidor" },
  { method: "GET", path: /^\/api\/health$/, description: "Health check del backend" },
  { method: "POST", path: /^\/api\/auth\/register$/, description: "Registro de empresa y usuario administrador" },
  { method: "POST", path: /^\/api\/auth\/login$/, description: "Inicio de sesion" },
  { method: "POST", path: /^\/api\/auth\/refresh$/, description: "Rotacion de access token usando refresh token" },
  { method: "POST", path: /^\/api\/auth\/logout$/, description: "Cierre de sesion" },
  { method: "GET", path: /^\/api\/auth\/me$/, description: "Usuario autenticado segun access token" },
  { method: "GET", path: /^\/api\/users$/, description: "Listado de usuarios de la empresa" },
  { method: "GET", path: /^\/api\/users\/[^/]+$/, description: "Detalle de usuario por id" },
  { method: "POST", path: /^\/api\/users$/, description: "Creacion de usuario dentro de la empresa" },
  { method: "PATCH", path: /^\/api\/users\/[^/]+$/, description: "Actualizacion de usuario por id" },
  { method: "DELETE", path: /^\/api\/users\/[^/]+$/, description: "Desactivacion logica de usuario por id" },
];

function createRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `req_${timestamp}_${random}`;
}

function getEndpointDescription(method: string, path: string): string {
  const match = endpointDefinitions.find((endpoint) =>
    endpoint.method === method && endpoint.path.test(path)
  );

  return match?.description ?? "Endpoint no catalogado";
}

function getRequestSnapshot(req: Request) {
  const requestPath = req.requestPath ?? req.originalUrl.split("?")[0] ?? req.path;

  return {
    request_id: req.requestId,
    method: req.method,
    path: requestPath,
    original_url: req.originalUrl,
    endpoint_description: req.endpointDescription,
    ip: req.ip,
    user_agent: req.get("user-agent") ?? null,
    params: req.params,
    query: req.query,
    body: req.body,
    auth: {
      has_bearer_token: Boolean(req.headers.authorization?.startsWith("Bearer ")),
      cookie_names: Object.keys(req.cookies ?? {}),
      user_id: req.user?.userId ?? null,
      empresa_id: req.user?.empresaId ?? null,
      rol: req.user?.rol ?? null,
    },
  };
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  const requestId = createRequestId();
  const requestPath = req.originalUrl.split("?")[0] ?? req.path;

  req.requestId = requestId;
  req.requestPath = requestPath;
  req.endpointDescription = getEndpointDescription(req.method, requestPath);
  res.setHeader("x-request-id", requestId);

  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  let responsePreview: unknown;

  res.json = ((body: unknown) => {
    responsePreview = sanitizeValue(body);
    return originalJson(body);
  }) as Response["json"];

  res.send = ((body?: unknown) => {
    if (responsePreview === undefined) {
      responsePreview = sanitizeValue(body);
    }
    return originalSend(body);
  }) as Response["send"];

  logInfo("request:start", getRequestSnapshot(req) as Record<string, unknown>);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const payload = {
      request_id: req.requestId,
      method: req.method,
      path: req.requestPath,
      original_url: req.originalUrl,
      endpoint_description: req.endpointDescription,
      status_code: res.statusCode,
      duration_ms: Number(durationMs.toFixed(2)),
      user_id: req.user?.userId ?? null,
      empresa_id: req.user?.empresaId ?? null,
      response: responsePreview,
    };

    if (res.statusCode >= 500) {
      logError("request:finish", payload);
      return;
    }

    if (res.statusCode >= 400) {
      logWarn("request:finish", payload);
      return;
    }

    logInfo("request:finish", payload);
  });

  next();
}

export function logRequestError(req: Request, err: Error & { status?: number; code?: string }): void {
  logError("request:error", {
    request_id: req.requestId,
    method: req.method,
    path: req.requestPath,
    original_url: req.originalUrl,
    endpoint_description: req.endpointDescription,
    status_code: err.status ?? 500,
    error_name: err.name,
    error_message: err.message,
    error_code: err.code ?? null,
    error_meta: "meta" in err ? sanitizeValue((err as Error & { meta?: unknown }).meta) : null,
    error_cause: "cause" in err ? sanitizeValue((err as Error & { cause?: unknown }).cause) : null,
    stack: err.stack ?? null,
    request: getRequestSnapshot(req),
  });
}
