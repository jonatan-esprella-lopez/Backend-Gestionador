-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('admin', 'operador', 'consulta');

-- CreateEnum
CREATE TYPE "TipoTransaccion" AS ENUM ('income', 'expense');

-- CreateEnum
CREATE TYPE "EstadoTransaccion" AS ENUM ('completed', 'pending', 'overdue');

-- CreateEnum
CREATE TYPE "TipoItem" AS ENUM ('product', 'insumo');

-- CreateEnum
CREATE TYPE "TipoMovimientoKardex" AS ENUM ('entrada', 'salida', 'ajuste', 'produccion_entrada', 'produccion_salida');

-- CreateEnum
CREATE TYPE "ReferenciaTipo" AS ENUM ('produccion_log', 'transaccion', 'ajuste_manual', 'importacion');

-- CreateEnum
CREATE TYPE "CanalContacto" AS ENUM ('whatsapp', 'messenger', 'telegram', 'otro');

-- CreateEnum
CREATE TYPE "EstadoChat" AS ENUM ('open', 'resolved', 'pending');

-- CreateEnum
CREATE TYPE "RemitenteChat" AS ENUM ('user', 'bot', 'agent');

-- CreateTable
CREATE TABLE "monedas" (
    "codigo" CHAR(3) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "simbolo" VARCHAR(5) NOT NULL,

    CONSTRAINT "monedas_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "empresa" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(255) NOT NULL DEFAULT 'MicroEmpresa S.A.',
    "moneda_codigo" CHAR(3) NOT NULL DEFAULT 'USD',
    "logo_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "rol" "Rol" NOT NULL DEFAULT 'admin',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_transaccion" (
    "id" SERIAL NOT NULL,
    "empresa_id" UUID,
    "nombre" VARCHAR(100) NOT NULL,
    "tipo" "TipoTransaccion" NOT NULL,

    CONSTRAINT "categorias_transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacciones" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "usuario_id" UUID,
    "fecha" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "tipo" "TipoTransaccion" NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "estado" "EstadoTransaccion" NOT NULL DEFAULT 'completed',
    "fecha_vencimiento" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "transacciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_inventario" (
    "id" SERIAL NOT NULL,
    "empresa_id" UUID,
    "nombre" VARCHAR(100) NOT NULL,

    CONSTRAINT "categorias_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "stock" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "min_warning" DECIMAL(15,3) NOT NULL DEFAULT 0,
    "precio_costo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "precio_venta" DECIMAL(15,2),
    "categoria_id" INTEGER,
    "imagen_url" TEXT,
    "tipo_item" "TipoItem" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recetas" (
    "id" SERIAL NOT NULL,
    "producto_id" UUID NOT NULL,
    "nombre" VARCHAR(255),
    "notas" TEXT,

    CONSTRAINT "recetas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receta_ingredientes" (
    "id" SERIAL NOT NULL,
    "receta_id" INTEGER NOT NULL,
    "insumo_id" UUID NOT NULL,
    "cantidad" DECIMAL(15,3) NOT NULL,

    CONSTRAINT "receta_ingredientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produccion_log" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "usuario_id" UUID,
    "cantidad" DECIMAL(15,3) NOT NULL,
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "produccion_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kardex" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "usuario_id" UUID,
    "tipo_movimiento" "TipoMovimientoKardex" NOT NULL,
    "cantidad" DECIMAL(15,3) NOT NULL,
    "stock_anterior" DECIMAL(15,3) NOT NULL,
    "stock_nuevo" DECIMAL(15,3) NOT NULL,
    "referencia_id" TEXT,
    "referencia_tipo" "ReferenciaTipo",
    "notas" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kardex_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flujos_webhook" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "trigger_keys" TEXT[],
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flujos_webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flujos_mensajes" (
    "id" SERIAL NOT NULL,
    "flujo_id" UUID NOT NULL,
    "contenido" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "flujos_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flujos_opciones" (
    "id" UUID NOT NULL,
    "flujo_id" UUID NOT NULL,
    "trigger_key" VARCHAR(20) NOT NULL,
    "etiqueta" VARCHAR(255) NOT NULL,
    "siguiente_flujo" UUID,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "flujos_opciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contactos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "telefono" VARCHAR(30),
    "email" VARCHAR(255),
    "canal" "CanalContacto" NOT NULL DEFAULT 'whatsapp',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contactos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "contacto_id" UUID NOT NULL,
    "estado" "EstadoChat" NOT NULL DEFAULT 'open',
    "no_leidos" INTEGER NOT NULL DEFAULT 0,
    "ultimo_mensaje" TEXT,
    "ultima_actividad" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_mensajes" (
    "id" UUID NOT NULL,
    "chat_id" UUID NOT NULL,
    "contenido" TEXT NOT NULL,
    "remitente" "RemitenteChat" NOT NULL,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_mensajes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_bancarias" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "banco" VARCHAR(255),
    "numero_cuenta" VARCHAR(50),
    "moneda_codigo" CHAR(3) NOT NULL DEFAULT 'USD',
    "saldo_actual" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cuentas_bancarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extractos_bancarios" (
    "id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(15,2) NOT NULL,
    "referencia_banco" VARCHAR(100),
    "conciliado" BOOLEAN NOT NULL DEFAULT false,
    "transaccion_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extractos_bancarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" SERIAL NOT NULL,
    "empresa_id" UUID NOT NULL,
    "clave" VARCHAR(100) NOT NULL,
    "valor" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_empresa_id_idx" ON "usuarios"("empresa_id");

-- CreateIndex
CREATE INDEX "categorias_transaccion_empresa_id_idx" ON "categorias_transaccion"("empresa_id");

-- CreateIndex
CREATE INDEX "transacciones_empresa_id_idx" ON "transacciones"("empresa_id");

-- CreateIndex
CREATE INDEX "transacciones_fecha_idx" ON "transacciones"("fecha");

-- CreateIndex
CREATE INDEX "transacciones_tipo_idx" ON "transacciones"("tipo");

-- CreateIndex
CREATE INDEX "transacciones_estado_idx" ON "transacciones"("estado");

-- CreateIndex
CREATE INDEX "transacciones_categoria_id_idx" ON "transacciones"("categoria_id");

-- CreateIndex
CREATE INDEX "transacciones_usuario_id_idx" ON "transacciones"("usuario_id");

-- CreateIndex
CREATE INDEX "categorias_inventario_empresa_id_idx" ON "categorias_inventario"("empresa_id");

-- CreateIndex
CREATE INDEX "inventario_empresa_id_idx" ON "inventario"("empresa_id");

-- CreateIndex
CREATE INDEX "inventario_sku_idx" ON "inventario"("sku");

-- CreateIndex
CREATE INDEX "inventario_tipo_item_idx" ON "inventario"("tipo_item");

-- CreateIndex
CREATE INDEX "inventario_stock_idx" ON "inventario"("stock");

-- CreateIndex
CREATE INDEX "inventario_categoria_id_idx" ON "inventario"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventario_empresa_id_sku_key" ON "inventario"("empresa_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "recetas_producto_id_key" ON "recetas"("producto_id");

-- CreateIndex
CREATE INDEX "receta_ingredientes_receta_id_idx" ON "receta_ingredientes"("receta_id");

-- CreateIndex
CREATE INDEX "receta_ingredientes_insumo_id_idx" ON "receta_ingredientes"("insumo_id");

-- CreateIndex
CREATE UNIQUE INDEX "receta_ingredientes_receta_id_insumo_id_key" ON "receta_ingredientes"("receta_id", "insumo_id");

-- CreateIndex
CREATE INDEX "produccion_log_empresa_id_idx" ON "produccion_log"("empresa_id");

-- CreateIndex
CREATE INDEX "produccion_log_producto_id_idx" ON "produccion_log"("producto_id");

-- CreateIndex
CREATE INDEX "produccion_log_created_at_idx" ON "produccion_log"("created_at");

-- CreateIndex
CREATE INDEX "kardex_empresa_id_idx" ON "kardex"("empresa_id");

-- CreateIndex
CREATE INDEX "kardex_item_id_idx" ON "kardex"("item_id");

-- CreateIndex
CREATE INDEX "kardex_tipo_movimiento_idx" ON "kardex"("tipo_movimiento");

-- CreateIndex
CREATE INDEX "kardex_created_at_idx" ON "kardex"("created_at");

-- CreateIndex
CREATE INDEX "flujos_webhook_empresa_id_idx" ON "flujos_webhook"("empresa_id");

-- CreateIndex
CREATE INDEX "flujos_mensajes_flujo_id_idx" ON "flujos_mensajes"("flujo_id");

-- CreateIndex
CREATE INDEX "flujos_opciones_flujo_id_idx" ON "flujos_opciones"("flujo_id");

-- CreateIndex
CREATE INDEX "contactos_empresa_id_idx" ON "contactos"("empresa_id");

-- CreateIndex
CREATE INDEX "contactos_telefono_idx" ON "contactos"("telefono");

-- CreateIndex
CREATE INDEX "contactos_canal_idx" ON "contactos"("canal");

-- CreateIndex
CREATE INDEX "chats_empresa_id_idx" ON "chats"("empresa_id");

-- CreateIndex
CREATE INDEX "chats_contacto_id_idx" ON "chats"("contacto_id");

-- CreateIndex
CREATE INDEX "chats_estado_idx" ON "chats"("estado");

-- CreateIndex
CREATE INDEX "chats_ultima_actividad_idx" ON "chats"("ultima_actividad" DESC);

-- CreateIndex
CREATE INDEX "chat_mensajes_chat_id_idx" ON "chat_mensajes"("chat_id");

-- CreateIndex
CREATE INDEX "chat_mensajes_created_at_idx" ON "chat_mensajes"("created_at");

-- CreateIndex
CREATE INDEX "cuentas_bancarias_empresa_id_idx" ON "cuentas_bancarias"("empresa_id");

-- CreateIndex
CREATE INDEX "extractos_bancarios_cuenta_id_idx" ON "extractos_bancarios"("cuenta_id");

-- CreateIndex
CREATE INDEX "extractos_bancarios_empresa_id_idx" ON "extractos_bancarios"("empresa_id");

-- CreateIndex
CREATE INDEX "extractos_bancarios_fecha_idx" ON "extractos_bancarios"("fecha");

-- CreateIndex
CREATE INDEX "extractos_bancarios_conciliado_idx" ON "extractos_bancarios"("conciliado");

-- CreateIndex
CREATE INDEX "configuracion_empresa_id_idx" ON "configuracion"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_empresa_id_clave_key" ON "configuracion"("empresa_id", "clave");

-- AddForeignKey
ALTER TABLE "empresa" ADD CONSTRAINT "empresa_moneda_codigo_fkey" FOREIGN KEY ("moneda_codigo") REFERENCES "monedas"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_transaccion" ADD CONSTRAINT "categorias_transaccion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacciones" ADD CONSTRAINT "transacciones_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_transaccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorias_inventario" ADD CONSTRAINT "categorias_inventario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categorias_inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recetas" ADD CONSTRAINT "recetas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "inventario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_ingredientes" ADD CONSTRAINT "receta_ingredientes_receta_id_fkey" FOREIGN KEY ("receta_id") REFERENCES "recetas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receta_ingredientes" ADD CONSTRAINT "receta_ingredientes_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produccion_log" ADD CONSTRAINT "produccion_log_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produccion_log" ADD CONSTRAINT "produccion_log_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "produccion_log" ADD CONSTRAINT "produccion_log_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kardex" ADD CONSTRAINT "kardex_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kardex" ADD CONSTRAINT "kardex_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kardex" ADD CONSTRAINT "kardex_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flujos_webhook" ADD CONSTRAINT "flujos_webhook_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flujos_mensajes" ADD CONSTRAINT "flujos_mensajes_flujo_id_fkey" FOREIGN KEY ("flujo_id") REFERENCES "flujos_webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flujos_opciones" ADD CONSTRAINT "flujos_opciones_flujo_id_fkey" FOREIGN KEY ("flujo_id") REFERENCES "flujos_webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flujos_opciones" ADD CONSTRAINT "flujos_opciones_siguiente_flujo_fkey" FOREIGN KEY ("siguiente_flujo") REFERENCES "flujos_webhook"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contactos" ADD CONSTRAINT "contactos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "contactos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_mensajes" ADD CONSTRAINT "chat_mensajes_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_moneda_codigo_fkey" FOREIGN KEY ("moneda_codigo") REFERENCES "monedas"("codigo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extractos_bancarios" ADD CONSTRAINT "extractos_bancarios_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_bancarias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extractos_bancarios" ADD CONSTRAINT "extractos_bancarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "extractos_bancarios" ADD CONSTRAINT "extractos_bancarios_transaccion_id_fkey" FOREIGN KEY ("transaccion_id") REFERENCES "transacciones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
