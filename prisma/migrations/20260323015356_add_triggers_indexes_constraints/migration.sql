-- ============================================================
-- MIGRACIÓN: Triggers, Índices Parciales, GIN y CHECK constraints
-- ============================================================
-- Elementos que Prisma no puede generar desde el schema:
--   1. fn_set_updated_at()  → trigger updated_at a nivel BD
--   2. fn_sync_chat_stats() → sincroniza chats.no_leidos y ultimo_mensaje
--   3. Índices únicos parciales en categorias_transaccion y categorias_inventario
--   4. Índice GIN en flujos_webhook.trigger_keys
--   5. CHECK constraint en transacciones.fecha_vencimiento
-- ============================================================


-- ============================================================
-- 1. FUNCIÓN GENÉRICA: updated_at automático
--    Seguro extra para UPDATE directos que bypaseen Prisma.
--    Prisma ya maneja @updatedAt en operaciones normales.
-- ============================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_empresa_updated_at
    BEFORE UPDATE ON empresa
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_transacciones_updated_at
    BEFORE UPDATE ON transacciones
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_inventario_updated_at
    BEFORE UPDATE ON inventario
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_flujos_webhook_updated_at
    BEFORE UPDATE ON flujos_webhook
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_contactos_updated_at
    BEFORE UPDATE ON contactos
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_cuentas_updated_at
    BEFORE UPDATE ON cuentas_bancarias
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_configuracion_updated_at
    BEFORE UPDATE ON configuracion
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();


-- ============================================================
-- 2. FUNCIÓN: Sincronización automática de estadísticas de chat
--
--    INSERT en chat_mensajes:
--      → actualiza chats.ultimo_mensaje con el contenido nuevo
--      → actualiza chats.ultima_actividad con el timestamp
--      → incrementa chats.no_leidos si remitente='user' y no leído
--
--    UPDATE leido en chat_mensajes (false → true):
--      → decrementa chats.no_leidos si el mensaje era de 'user'
-- ============================================================
CREATE OR REPLACE FUNCTION fn_sync_chat_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE chats
        SET
            ultimo_mensaje   = NEW.contenido,
            ultima_actividad = NEW.created_at,
            no_leidos        = no_leidos + CASE
                                   WHEN NEW.remitente = 'user' AND NOT NEW.leido
                                   THEN 1
                                   ELSE 0
                               END
        WHERE id = NEW.chat_id;

    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.leido = FALSE AND NEW.leido = TRUE AND NEW.remitente = 'user' THEN
            UPDATE chats
            SET no_leidos = GREATEST(0, no_leidos - 1)
            WHERE id = NEW.chat_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_chat_mensajes_stats
    AFTER INSERT OR UPDATE OF leido ON chat_mensajes
    FOR EACH ROW EXECUTE FUNCTION fn_sync_chat_stats();


-- ============================================================
-- 3. ÍNDICES ÚNICOS PARCIALES — Categorías
--    Prisma no soporta índices con cláusula WHERE.
--
--    Regla:
--      - Globales (empresa_id IS NULL): único por (nombre, tipo/nombre)
--      - Por empresa (empresa_id IS NOT NULL): único por (empresa_id, nombre, tipo)
-- ============================================================
CREATE UNIQUE INDEX idx_cat_tx_global
    ON categorias_transaccion(nombre, tipo)
    WHERE empresa_id IS NULL;

CREATE UNIQUE INDEX idx_cat_tx_empresa
    ON categorias_transaccion(empresa_id, nombre, tipo)
    WHERE empresa_id IS NOT NULL;

CREATE UNIQUE INDEX idx_cat_inv_global
    ON categorias_inventario(nombre)
    WHERE empresa_id IS NULL;

CREATE UNIQUE INDEX idx_cat_inv_empresa
    ON categorias_inventario(empresa_id, nombre)
    WHERE empresa_id IS NOT NULL;


-- ============================================================
-- 4. ÍNDICE GIN — flujos_webhook.trigger_keys
--    Para búsquedas eficientes dentro del array TEXT[].
--    Uso: WHERE trigger_keys @> ARRAY['hola']
-- ============================================================
CREATE INDEX idx_flujos_trigger_gin
    ON flujos_webhook USING GIN(trigger_keys);


-- ============================================================
-- 5. CHECK CONSTRAINT — transacciones.fecha_vencimiento
--    Impide insertar pending/overdue sin fecha de vencimiento.
-- ============================================================
ALTER TABLE transacciones
    ADD CONSTRAINT chk_fecha_vencimiento
    CHECK (estado = 'completed' OR fecha_vencimiento IS NOT NULL);