-- ============================================================
-- RAW SQL POST-MIGRACIÓN — Módulo de Contabilidad
-- Bolivia / Cochabamba
--
-- Ejecutar DESPUÉS de `pnpm prisma migrate dev` cuando se
-- incorpore el schema contable.
--
-- Incluye:
--   1. Trigger: numeración secuencial de asientos por empresa
--   2. CHECK: asiento debe cuadrar (debe = haber) al confirmar
--   3. CHECK: movimiento no puede tener debe Y haber > 0
--   4. Trigger: validar que la cuenta acepta asientos (es hoja)
--   5. Trigger: sincronizar saldo_pendiente y estado de Factura
--   6. Índices adicionales de performance
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TRIGGER: numeración secuencial de asientos por empresa
--    El trigger asigna el siguiente número antes del INSERT.
--    Usa MAX(numero) — para alta concurrencia migrar a SEQUENCE.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_next_asiento_numero()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = 0 THEN
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
    FROM asientos_contables
    WHERE empresa_id = NEW.empresa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_next_asiento_numero ON asientos_contables;
CREATE TRIGGER trg_next_asiento_numero
  BEFORE INSERT ON asientos_contables
  FOR EACH ROW EXECUTE FUNCTION fn_next_asiento_numero();

-- ─────────────────────────────────────────────────────────────
-- 2. CHECK: asiento confirmado debe tener total_debe = total_haber
-- ─────────────────────────────────────────────────────────────
ALTER TABLE asientos_contables
  DROP CONSTRAINT IF EXISTS chk_asiento_cuadrado;

ALTER TABLE asientos_contables
  ADD CONSTRAINT chk_asiento_cuadrado
  CHECK (
    estado != 'confirmado'
    OR total_debe = total_haber
  );

-- ─────────────────────────────────────────────────────────────
-- 3. CHECK: un movimiento no puede tener debe > 0 Y haber > 0
--    (uno de los dos debe ser 0)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE movimientos_contables
  DROP CONSTRAINT IF EXISTS chk_movimiento_exclusivo;

ALTER TABLE movimientos_contables
  ADD CONSTRAINT chk_movimiento_exclusivo
  CHECK (
    (debe > 0 AND haber = 0)
    OR (haber > 0 AND debe = 0)
  );

-- ─────────────────────────────────────────────────────────────
-- 4. TRIGGER: solo cuentas con permite_asiento = true pueden
--    recibir movimientos contables
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validar_cuenta_hoja()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT (
    SELECT permite_asiento
    FROM cuentas_contables
    WHERE id = NEW.cuenta_id
  ) THEN
    RAISE EXCEPTION
      'La cuenta % no permite asientos directos. Solo se pueden registrar movimientos en cuentas hoja.',
      NEW.cuenta_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_cuenta_hoja ON movimientos_contables;
CREATE TRIGGER trg_validar_cuenta_hoja
  BEFORE INSERT OR UPDATE ON movimientos_contables
  FOR EACH ROW EXECUTE FUNCTION fn_validar_cuenta_hoja();

-- ─────────────────────────────────────────────────────────────
-- 5. TRIGGER: mantener saldo_pendiente y estado de Factura
--    Se dispara en INSERT / UPDATE / DELETE de pagos.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_factura_saldo()
RETURNS TRIGGER AS $$
DECLARE
  v_factura_id    UUID;
  v_total_pagado  DECIMAL(18,2);
  v_total_factura DECIMAL(18,2);
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT COALESCE(SUM(monto), 0)
    INTO v_total_pagado
    FROM pagos
   WHERE factura_id = v_factura_id;

  SELECT total
    INTO v_total_factura
    FROM facturas
   WHERE id = v_factura_id;

  UPDATE facturas
     SET saldo_pendiente = v_total_factura - v_total_pagado,
         estado = CASE
           WHEN v_total_pagado >= v_total_factura THEN 'pagada'::"EstadoFactura"
           WHEN v_total_pagado > 0               THEN 'parcial'::"EstadoFactura"
           ELSE estado
         END,
         updated_at = NOW()
   WHERE id = v_factura_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_factura_saldo ON pagos;
CREATE TRIGGER trg_sync_factura_saldo
  AFTER INSERT OR UPDATE OR DELETE ON pagos
  FOR EACH ROW EXECUTE FUNCTION fn_sync_factura_saldo();

-- ─────────────────────────────────────────────────────────────
-- 6. ÍNDICES DE PERFORMANCE — Libro Mayor
-- ─────────────────────────────────────────────────────────────

-- Covering index para la query del Libro Mayor (SUM OVER)
CREATE INDEX IF NOT EXISTS idx_mov_cuenta_debe_haber
  ON movimientos_contables (cuenta_id)
  INCLUDE (debe, haber);

-- Asientos confirmados ordenados por empresa + fecha (Libro Mayor)
CREATE INDEX IF NOT EXISTS idx_asiento_empresa_fecha_conf
  ON asientos_contables (empresa_id, fecha DESC)
  WHERE estado = 'confirmado';

-- Facturas por contacto (auxiliar CxC / CxP)
CREATE INDEX IF NOT EXISTS idx_facturas_contacto_estado
  ON facturas (contacto_id, estado)
  WHERE saldo_pendiente > 0;

-- Aging: facturas vencidas por empresa
CREATE INDEX IF NOT EXISTS idx_facturas_vencimiento
  ON facturas (empresa_id, fecha_vencimiento)
  WHERE estado IN ('emitida', 'parcial', 'vencida');
