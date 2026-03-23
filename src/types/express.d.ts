import { Rol } from "@prisma/client";

// Extiende el tipo Request de Express para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        empresaId: string | null; // null para admin de plataforma
        rol: Rol;
        iat?: number;
        exp?: number;
      };
    }
  }
}
