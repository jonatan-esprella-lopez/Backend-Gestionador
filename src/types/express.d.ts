import { Rol } from "@prisma/client";

// Extiende el tipo Request de Express para incluir el usuario autenticado
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        empresaId: string;
        rol: Rol;
        iat?: number;
        exp?: number;
      };
    }
  }
}
