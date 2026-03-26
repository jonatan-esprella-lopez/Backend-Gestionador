-- ============================================================
-- update_roles
-- Redefine el enum Rol: admin | gerente | contador | empleado
-- Migra datos existentes:
--   admin    → gerente   (eran admins de empresa, no de plataforma)
--   operador → empleado
--   consulta → empleado
-- Hace empresa_id nullable (NULL solo para rol=admin de plataforma)
-- Agrega CHECK constraint para garantizar la invariante
-- ============================================================

-- 1. Eliminar el default actual antes de cambiar el tipo
ALTER TABLE "usuarios" ALTER COLUMN "rol" DROP DEFAULT;

-- 2. Convertir la columna a texto para poder migrar los valores
ALTER TABLE "usuarios" ALTER COLUMN "rol" TYPE TEXT;

-- 3. Migrar valores del enum anterior al nuevo
UPDATE "usuarios" SET "rol" = 'gerente'  WHERE "rol" = 'admin';
UPDATE "usuarios" SET "rol" = 'empleado' WHERE "rol" IN ('operador', 'consulta');

-- 4. Crear el nuevo tipo enum
CREATE TYPE "Rol_new" AS ENUM ('admin', 'gerente', 'contador', 'empleado');

-- 5. Convertir la columna al nuevo enum
ALTER TABLE "usuarios"
  ALTER COLUMN "rol" TYPE "Rol_new" USING "rol"::"Rol_new";

-- 6. Establecer el nuevo default
ALTER TABLE "usuarios"
  ALTER COLUMN "rol" SET DEFAULT 'empleado'::"Rol_new";

-- 7. Eliminar el enum anterior y renombrar el nuevo
DROP TYPE "Rol";
ALTER TYPE "Rol_new" RENAME TO "Rol";

-- 8. Hacer empresa_id nullable
--    (NULL permitido únicamente para rol = 'admin' de plataforma)
ALTER TABLE "usuarios" ALTER COLUMN "empresa_id" DROP NOT NULL;

-- 9. Agregar CHECK constraint: invariante rol ↔ empresa_id
ALTER TABLE "usuarios"
  ADD CONSTRAINT "usuarios_rol_empresa_check"
  CHECK (
    ("rol"::text = 'admin' AND "empresa_id" IS NULL) OR
    ("rol"::text != 'admin' AND "empresa_id" IS NOT NULL)
  );
