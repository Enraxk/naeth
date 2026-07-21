-- Migracion 003 · autoria explicita (Paso 10, replanteado sobre CENIT 2026-07-20).
-- Sustituye el `source_client text` de texto libre por un `author jsonb` con ejes
-- separados: product (clientInfo del protocolo, verificable), surface (endpoint por
-- superficie, verificable), zone (por donde entro), actor (humano/agente), y
-- vendor/model DECLARADOS por el agente (MCP no los transmite). Idempotente (IF NOT EXISTS).
--
-- `source_client` NO se retira: se congela como legado (es la prueba del origen de las
-- 321 notas viejas, junto al path). Ver db/migrations/004-authorship-backfill.sql.
--
-- ADD-only: `author` es una columna NUEVA (metadato que nunca existio). Rellenarla en las
-- filas viejas (backfill 004) es un UPDATE unico de migracion, seguro porque hoy solo hay
-- UN nodo (finally aun no desplegado). A partir de aqui, author llega ya bueno en la
-- escritura y no se muta.

ALTER TABLE memory ADD COLUMN IF NOT EXISTS author jsonb NOT NULL DEFAULT '{}';

-- Columnas generadas para filtrar/agrupar sin castigar el jsonb.
ALTER TABLE memory ADD COLUMN IF NOT EXISTS author_product text
    GENERATED ALWAYS AS (author->>'product') STORED;
ALTER TABLE memory ADD COLUMN IF NOT EXISTS author_surface text
    GENERATED ALWAYS AS (author->>'surface') STORED;
ALTER TABLE memory ADD COLUMN IF NOT EXISTS author_model text
    GENERATED ALWAYS AS (author->>'model') STORED;

CREATE INDEX IF NOT EXISTS memory_author_product_idx ON memory (author_product);
CREATE INDEX IF NOT EXISTS memory_author_surface_idx ON memory (author_surface);
CREATE INDEX IF NOT EXISTS memory_author_model_idx   ON memory (author_model);

-- memory_current es SELECT m.*; en una base preexistente la vista fija sus columnas al
-- crearse y NO ve las nuevas -> recrear para exponer author/author_*. (En schema.sql la
-- vista ya se define despues de las columnas, no hace falta alli.)
CREATE OR REPLACE VIEW memory_current AS
SELECT m.* FROM memory m
WHERE NOT EXISTS (SELECT 1 FROM tombstone t WHERE t.target_id = m.id AND t.target_kind = 'memory')
  AND NOT EXISTS (SELECT 1 FROM supersession s WHERE s.parent_id = m.id);
