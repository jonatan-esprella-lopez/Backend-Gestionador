-- CreateEnum
CREATE TYPE "TipoCuentaContable" AS ENUM ('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto');

-- CreateEnum
CREATE TYPE "NaturalezaCuenta" AS ENUM ('deudora', 'acreedora');

-- CreateEnum
CREATE TYPE "TipoImpuesto" AS ENUM ('trasladado', 'retenido');

-- CreateEnum
CREATE TYPE "OrigenAsiento" AS ENUM ('factura', 'pago', 'ajuste', 'apertura', 'cierre', 'reversion', 'pos', 'nota_credito', 'nota_debito');

-- CreateEnum
CREATE TYPE "EstadoAsiento" AS ENUM ('borrador', 'confirmado', 'anulado');

-- CreateEnum
CREATE TYPE "TipoFactura" AS ENUM ('venta', 'compra', 'ticket_pos');

-- CreateEnum
CREATE TYPE "EstadoFactura" AS ENUM ('borrador', 'emitida', 'parcial', 'pagada', 'anulada', 'vencida');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('efectivo', 'transferencia', 'cheque', 'qr', 'tarjeta', 'otro');

-- CreateEnum
CREATE TYPE "TipoNota" AS ENUM ('credito', 'debito');

-- AlterTable
ALTER TABLE "chats" ADD COLUMN     "flujo_activo_id" UUID;

-- AlterTable
ALTER TABLE "contactos" ADD COLUMN     "ciudad" VARCHAR(100) DEFAULT 'Cochabamba',
ADD COLUMN     "dias_credito" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "direccion_fiscal" TEXT,
ADD COLUMN     "email_facturacion" VARCHAR(150),
ADD COLUMN     "es_cliente" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "es_proveedor" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "limite_credito" DECIMAL(18,2),
ADD COLUMN     "nit" VARCHAR(20),
ADD COLUMN     "pais" VARCHAR(2) NOT NULL DEFAULT 'BO',
ADD COLUMN     "razon_social" VARCHAR(200);

-- AlterTable
ALTER TABLE "cuentas_bancarias" ADD COLUMN     "cuenta_contable_id" UUID;

-- AlterTable
ALTER TABLE "empresa" ADD COLUMN     "ciudad" VARCHAR(100) DEFAULT 'Cochabamba',
ADD COLUMN     "moneda_funcional" VARCHAR(3) NOT NULL DEFAULT 'BOB';

-- CreateTable
CREATE TABLE "cuentas_contables" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo" "TipoCuentaContable" NOT NULL,
    "naturaleza" "NaturalezaCuenta" NOT NULL,
    "cuenta_padre_id" UUID,
    "nivel" INTEGER NOT NULL,
    "permite_asiento" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cuentas_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasas_impuesto" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "tipo" "TipoImpuesto" NOT NULL,
    "cuenta_debito_id" UUID,
    "cuenta_credito_id" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasas_impuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asientos_contables" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "concepto" VARCHAR(300) NOT NULL,
    "tipo_origen" "OrigenAsiento" NOT NULL,
    "origen_id" UUID,
    "asiento_reversion_id" UUID,
    "usuario_id" UUID NOT NULL,
    "estado" "EstadoAsiento" NOT NULL DEFAULT 'borrador',
    "total_debe" DECIMAL(18,2) NOT NULL,
    "total_haber" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asientos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimientos_contables" (
    "id" UUID NOT NULL,
    "asiento_id" UUID NOT NULL,
    "cuenta_id" UUID NOT NULL,
    "debe" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "descripcion" VARCHAR(300),
    "contacto_id" UUID,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "movimientos_contables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "tipo" "TipoFactura" NOT NULL,
    "numero" VARCHAR(30) NOT NULL,
    "contacto_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "fecha_emision" DATE NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "moneda_codigo" VARCHAR(3) NOT NULL DEFAULT 'BOB',
    "subtotal" DECIMAL(18,2) NOT NULL,
    "total_impuestos" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "saldo_pendiente" DECIMAL(18,2) NOT NULL,
    "estado" "EstadoFactura" NOT NULL DEFAULT 'borrador',
    "observaciones" TEXT,
    "codigo_autorizacion" VARCHAR(50),
    "codigo_control" VARCHAR(100),
    "fecha_limite_emision" DATE,
    "numero_autorizacion_cufe" VARCHAR(100),
    "asiento_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facturas_lineas" (
    "id" UUID NOT NULL,
    "factura_id" UUID NOT NULL,
    "item_id" UUID,
    "descripcion" VARCHAR(300) NOT NULL,
    "cantidad" DECIMAL(18,4) NOT NULL,
    "precio_unitario" DECIMAL(18,4) NOT NULL,
    "subtotal_linea" DECIMAL(18,2) NOT NULL,
    "tasa_impuesto_id" UUID,
    "monto_impuesto" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_linea" DECIMAL(18,2) NOT NULL,
    "cuenta_ingreso_gasto_id" UUID,
    "orden" INTEGER NOT NULL,

    CONSTRAINT "facturas_lineas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "factura_id" UUID NOT NULL,
    "cuenta_bancaria_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "referencia" VARCHAR(100),
    "observaciones" TEXT,
    "asiento_id" UUID,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notas_credito_debito" (
    "id" UUID NOT NULL,
    "empresa_id" UUID NOT NULL,
    "factura_id" UUID NOT NULL,
    "tipo" "TipoNota" NOT NULL,
    "numero" VARCHAR(30) NOT NULL,
    "fecha" DATE NOT NULL,
    "motivo" VARCHAR(300) NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "asiento_id" UUID,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notas_credito_debito_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cuentas_contables_empresa_id_tipo_idx" ON "cuentas_contables"("empresa_id", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_contables_empresa_id_codigo_key" ON "cuentas_contables"("empresa_id", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tasas_impuesto_empresa_id_codigo_key" ON "tasas_impuesto"("empresa_id", "codigo");

-- CreateIndex
CREATE INDEX "asientos_contables_empresa_id_fecha_idx" ON "asientos_contables"("empresa_id", "fecha");

-- CreateIndex
CREATE INDEX "asientos_contables_tipo_origen_origen_id_idx" ON "asientos_contables"("tipo_origen", "origen_id");

-- CreateIndex
CREATE UNIQUE INDEX "asientos_contables_empresa_id_numero_key" ON "asientos_contables"("empresa_id", "numero");

-- CreateIndex
CREATE INDEX "movimientos_contables_cuenta_id_idx" ON "movimientos_contables"("cuenta_id");

-- CreateIndex
CREATE INDEX "movimientos_contables_contacto_id_idx" ON "movimientos_contables"("contacto_id");

-- CreateIndex
CREATE INDEX "facturas_empresa_id_estado_idx" ON "facturas"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "facturas_contacto_id_idx" ON "facturas"("contacto_id");

-- CreateIndex
CREATE INDEX "facturas_fecha_vencimiento_idx" ON "facturas"("fecha_vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "facturas_empresa_id_tipo_numero_key" ON "facturas"("empresa_id", "tipo", "numero");

-- CreateIndex
CREATE INDEX "facturas_lineas_factura_id_idx" ON "facturas_lineas"("factura_id");

-- CreateIndex
CREATE INDEX "pagos_factura_id_idx" ON "pagos"("factura_id");

-- CreateIndex
CREATE INDEX "pagos_empresa_id_fecha_idx" ON "pagos"("empresa_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "notas_credito_debito_empresa_id_tipo_numero_key" ON "notas_credito_debito"("empresa_id", "tipo", "numero");

-- CreateIndex
CREATE INDEX "contactos_empresa_id_es_cliente_idx" ON "contactos"("empresa_id", "es_cliente");

-- CreateIndex
CREATE INDEX "contactos_empresa_id_es_proveedor_idx" ON "contactos"("empresa_id", "es_proveedor");

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_flujo_activo_id_fkey" FOREIGN KEY ("flujo_activo_id") REFERENCES "flujos_webhook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_bancarias" ADD CONSTRAINT "cuentas_bancarias_cuenta_contable_id_fkey" FOREIGN KEY ("cuenta_contable_id") REFERENCES "cuentas_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuentas_contables" ADD CONSTRAINT "cuentas_contables_cuenta_padre_id_fkey" FOREIGN KEY ("cuenta_padre_id") REFERENCES "cuentas_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasas_impuesto" ADD CONSTRAINT "tasas_impuesto_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasas_impuesto" ADD CONSTRAINT "tasas_impuesto_cuenta_debito_id_fkey" FOREIGN KEY ("cuenta_debito_id") REFERENCES "cuentas_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasas_impuesto" ADD CONSTRAINT "tasas_impuesto_cuenta_credito_id_fkey" FOREIGN KEY ("cuenta_credito_id") REFERENCES "cuentas_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asientos_contables" ADD CONSTRAINT "asientos_contables_asiento_reversion_id_fkey" FOREIGN KEY ("asiento_reversion_id") REFERENCES "asientos_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_asiento_id_fkey" FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "cuentas_contables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimientos_contables" ADD CONSTRAINT "movimientos_contables_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "contactos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_contacto_id_fkey" FOREIGN KEY ("contacto_id") REFERENCES "contactos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas" ADD CONSTRAINT "facturas_asiento_id_fkey" FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_lineas" ADD CONSTRAINT "facturas_lineas_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_lineas" ADD CONSTRAINT "facturas_lineas_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_lineas" ADD CONSTRAINT "facturas_lineas_tasa_impuesto_id_fkey" FOREIGN KEY ("tasa_impuesto_id") REFERENCES "tasas_impuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facturas_lineas" ADD CONSTRAINT "facturas_lineas_cuenta_ingreso_gasto_id_fkey" FOREIGN KEY ("cuenta_ingreso_gasto_id") REFERENCES "cuentas_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_cuenta_bancaria_id_fkey" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "cuentas_bancarias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_asiento_id_fkey" FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito_debito" ADD CONSTRAINT "notas_credito_debito_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito_debito" ADD CONSTRAINT "notas_credito_debito_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "facturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito_debito" ADD CONSTRAINT "notas_credito_debito_asiento_id_fkey" FOREIGN KEY ("asiento_id") REFERENCES "asientos_contables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notas_credito_debito" ADD CONSTRAINT "notas_credito_debito_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
