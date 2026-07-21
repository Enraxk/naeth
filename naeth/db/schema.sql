-- Naeth v1 · Esquema canonico (Paso 6, revisado 2026-06-24 para multi-master).
--
-- ADD-only puro: nada se borra ni se actualiza in-place salvo (a) el relleno async
-- del embedding y (b) la recomputacion de is_current (ambas mutaciones LOCALES, no
-- sincronizadas). El reemplazo vive en `supersession`, el borrado en `tombstone`.
--
-- La dimension del vector es por-nodo: este archivo usa el placeholder __EMBED_DIM__
-- que el arranque sustituye por EMBED_DIM (384 = e5-small local en Fase 1; 1024 = bge-m3).
-- Ver entrypoint de db/ y app/embeddings.py.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- 2. Tabla nucleo: memory (fila inmutable, una por version)
-- ============================================================
CREATE TABLE IF NOT EXISTS memory (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content_hash  text NOT NULL,                       -- sha256 del contenido (dedup/idempotencia)
    title         text,
    content       text NOT NULL,
    memory_type   text NOT NULL DEFAULT 'observation', -- observation|decision|learning|error|...
    tags          text[] NOT NULL DEFAULT '{}',
    path          text,                                -- jerarquia logica para el arbol
    metadata      jsonb NOT NULL DEFAULT '{}',
    embedding     vector(__EMBED_DIM__),               -- por-nodo; NULL hasta que la cola lo rellena; NO se sincroniza
    tsv           tsvector GENERATED ALWAYS AS (
                      to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,''))
                  ) STORED,
    source_client text NOT NULL DEFAULT 'web',         -- LEGADO (Paso 10): congelado, ya no es la fuente de verdad
    author        jsonb NOT NULL DEFAULT '{}',          -- autoria explicita (Paso 10): product|surface|zone|actor|vendor|model|model_source|client_raw
    author_product text GENERATED ALWAYS AS (author->>'product') STORED,  -- de clientInfo (verificable)
    author_surface text GENERATED ALWAYS AS (author->>'surface') STORED,  -- del endpoint por superficie (verificable)
    author_model   text GENERATED ALWAYS AS (author->>'model')   STORED,  -- DECLARADO por el agente
    created_at    timestamptz NOT NULL DEFAULT now(),
    valid_from    timestamptz NOT NULL DEFAULT now(),
    is_current    boolean NOT NULL DEFAULT true        -- CACHE derivada local; NO se sincroniza
);

-- ============================================================
-- 3. supersession (versionado, append-only, multi-padre)
-- ============================================================
CREATE TABLE IF NOT EXISTS supersession (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id      uuid NOT NULL REFERENCES memory(id),
    parent_id     uuid NOT NULL REFERENCES memory(id),
    created_at    timestamptz NOT NULL DEFAULT now(),
    source_client text NOT NULL DEFAULT 'web'
);

-- ============================================================
-- 4. tombstone (borrados, append-only, unificada memory+relation)
-- ============================================================
CREATE TABLE IF NOT EXISTS tombstone (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id     uuid NOT NULL,
    target_kind   text NOT NULL CHECK (target_kind IN ('memory', 'relation')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    source_client text NOT NULL DEFAULT 'web'
);

-- ============================================================
-- 5. relation (aristas explicitas del grafo)
-- ============================================================
CREATE TABLE IF NOT EXISTS relation (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id     uuid NOT NULL REFERENCES memory(id),
    target_id     uuid NOT NULL REFERENCES memory(id),
    predicate     text NOT NULL,                       -- links_to|depends_on|...
    metadata      jsonb NOT NULL DEFAULT '{}',
    source_client text NOT NULL DEFAULT 'web',
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. attachment (binarios fuera de la BD; sidecar memory aparte)
-- ============================================================
CREATE TABLE IF NOT EXISTS attachment (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id      uuid NOT NULL REFERENCES memory(id),  -- el sidecar que lo representa
    filename       text NOT NULL,
    mime           text,
    size_bytes     bigint,
    sha256         text NOT NULL,                        -- content-addressed (sync de binarios)
    storage_path   text NOT NULL,                        -- ruta en el volumen de assets (E:\naeth\assets)
    extracted_text text,
    source_client  text NOT NULL DEFAULT 'web',
    created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. job (cola async de escritura) — LOCAL, no se sincroniza
-- ============================================================
CREATE TABLE IF NOT EXISTS job (
    id          bigserial PRIMARY KEY,
    kind        text NOT NULL,                          -- embed|extract|...
    memory_id   uuid REFERENCES memory(id),
    status      text NOT NULL DEFAULT 'pending',        -- pending|processing|done|error
    attempts    int NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now(),
    started_at  timestamptz,
    finished_at timestamptz,
    error       text
);

-- ============================================================
-- OAuth (Fase 3b) — LOCAL, no se sincroniza (estado de autorizacion del nodo)
-- ============================================================
CREATE TABLE IF NOT EXISTS oauth_client (
    client_id   text PRIMARY KEY,
    client_data jsonb NOT NULL,                 -- OAuthClientInformationFull serializado
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oauth_pending (
    id         text PRIMARY KEY,
    client_id  text NOT NULL,
    params     jsonb NOT NULL,                  -- AuthorizationParams serializado
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oauth_code (
    code       text PRIMARY KEY,
    client_id  text NOT NULL,
    code_data  jsonb NOT NULL,                  -- AuthorizationCode serializado
    used       boolean NOT NULL DEFAULT false,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS oauth_token (
    token        text PRIMARY KEY,
    kind         text NOT NULL CHECK (kind IN ('access', 'refresh')),
    client_id    text NOT NULL,
    token_data   jsonb NOT NULL,                -- AccessToken/RefreshToken serializado
    paired_token text,
    revoked      boolean NOT NULL DEFAULT false,
    expires_at   timestamptz,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_token_kind_idx ON oauth_token (kind) WHERE NOT revoked;

-- ============================================================
-- Vista de lo vigente (la verdad, derivada de las tablas-evento).
-- is_current cachea exactamente este predicado para los indices parciales.
-- ============================================================
CREATE OR REPLACE VIEW memory_current AS
SELECT m.* FROM memory m
WHERE NOT EXISTS (SELECT 1 FROM tombstone t WHERE t.target_id = m.id AND t.target_kind = 'memory')
  AND NOT EXISTS (SELECT 1 FROM supersession s WHERE s.parent_id = m.id);

-- ============================================================
-- 8. Indices
-- ============================================================
-- semantico: HNSW solo sobre lo vigente y ya embebido (usa la cache is_current).
-- Defaults de pgvector m=16, ef_construction=64 (lo que la Fase 1 mide).
CREATE INDEX IF NOT EXISTS memory_embedding_hnsw ON memory
    USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL AND is_current;
-- texto completo
CREATE INDEX IF NOT EXISTS memory_tsv_gin   ON memory USING gin (tsv);
-- etiquetas
CREATE INDEX IF NOT EXISTS memory_tags_gin  ON memory USING gin (tags);
-- autoria (Paso 10): filtrar/agrupar por producto, superficie y modelo
CREATE INDEX IF NOT EXISTS memory_author_product_idx ON memory (author_product);
CREATE INDEX IF NOT EXISTS memory_author_surface_idx ON memory (author_surface);
CREATE INDEX IF NOT EXISTS memory_author_model_idx   ON memory (author_model);
-- arbol / jerarquia y orden temporal
CREATE INDEX IF NOT EXISTS memory_path_idx       ON memory (path);
CREATE INDEX IF NOT EXISTS memory_created_at_idx ON memory (created_at);
-- tablas-evento (vigencia y sync)
CREATE INDEX IF NOT EXISTS supersession_parent_idx ON supersession (parent_id);
CREATE INDEX IF NOT EXISTS supersession_child_idx  ON supersession (child_id);
CREATE INDEX IF NOT EXISTS tombstone_target_idx    ON tombstone (target_id);
-- recorrido del grafo
CREATE INDEX IF NOT EXISTS relation_source_idx ON relation (source_id);
CREATE INDEX IF NOT EXISTS relation_target_idx ON relation (target_id);
-- cola
CREATE INDEX IF NOT EXISTS job_pending_idx ON job (status) WHERE status = 'pending';
