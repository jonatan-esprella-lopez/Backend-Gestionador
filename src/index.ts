import "dotenv/config";

import cookieParser from "cookie-parser";
import cors from "cors";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import path from "path";

<<<<<<< HEAD
import { logInfo } from "./lib/logger";
import { requestLogger, logRequestError } from "./middlewares/request-logger.middleware";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
=======
import authRoutes        from "./routes/auth.routes";
import userRoutes        from "./routes/user.routes";
import transactionRoutes from "./routes/transaction.routes";
import inventoryRoutes      from "./routes/inventory.routes";
import reportRoutes         from "./routes/report.routes";
import bankAccountRoutes    from "./routes/bank-account.routes";
import reconciliationRoutes from "./routes/reconciliation.routes";
import companyRoutes        from "./routes/company.routes";

import { generalLimiter, authLimiter } from "./middlewares/rate-limit.middleware";
import { startOverdueJob }             from "./jobs/overdue.job";
>>>>>>> 69c78b365bf60b71168ec7474a886e2a9dc1f854

const app = express();
const PORT       = process.env.PORT       || 3000;
const API_PREFIX = process.env.API_PREFIX || "/api";

// ── Seguridad y parsers ────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ── Rate limiting ──────────────────────────────────────────
// Límite general para toda la API
app.use(`${API_PREFIX}`, generalLimiter);

// ── Rutas ──────────────────────────────────────────────────
// authLimiter más estricto solo en login y register
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`,        userRoutes);
app.use(`${API_PREFIX}/transactions`, transactionRoutes);
app.use(`${API_PREFIX}/inventory`,    inventoryRoutes);
app.use(`${API_PREFIX}/reports`,         reportRoutes);
app.use(`${API_PREFIX}/bank-accounts`,   bankAccountRoutes);
app.use(`${API_PREFIX}/reconciliation`,  reconciliationRoutes);
app.use(`${API_PREFIX}/companies`,       companyRoutes);

// ── Archivos estáticos (solo dev — en prod las imágenes van a R2) ──────────
app.use("/uploads", express.static(path.resolve("uploads")));

// ── Utilidades ─────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({ message: "Backend Gestionador API", status: "ok" });
});

app.get(`${API_PREFIX}/health`, (_req: Request, res: Response) => {
  res.status(200).json({
    status:    "ok",
    service:   "Backend Gestionador API",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 ────────────────────────────────────────────────────
app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    request_id: req.requestId,
    endpoint_description: req.endpointDescription,
  });
});

<<<<<<< HEAD
app.use((err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
  logRequestError(req, err);
=======
// ── Error handler ──────────────────────────────────────────
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
>>>>>>> 69c78b365bf60b71168ec7474a886e2a9dc1f854
  res.status(err.status ?? 500).json({
    message: err.message || "Error interno del servidor",
    request_id: req.requestId,
    endpoint_description: req.endpointDescription,
  });
});

// ── Arranque ───────────────────────────────────────────────
app.listen(PORT, () => {
<<<<<<< HEAD
  logInfo("server:start", {
    port: Number(PORT),
    api_prefix: API_PREFIX,
    url: `http://localhost:${PORT}`,
  });
=======
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  startOverdueJob();
>>>>>>> 69c78b365bf60b71168ec7474a886e2a9dc1f854
});
