-- Migracion 004 · backfill de autoria del historico (Paso 10).
--
-- Rellena `author` de las notas ANTERIORES a la captura (author = '{}') derivandolo de
-- las dos senales que el historico si conserva: el `path` (chat/code, tu convencion, que
-- acierta el origen en 320/321) y el `source_client` legado (actor humano vs agente, y
-- zona loopback vs publico).
--
-- ADD-only: `author` es una columna NUEVA (metadato que nunca existio). Este UPDATE es un
-- evento UNICO de migracion, seguro porque hoy solo hay UN nodo (finally no desplegado) y
-- hay backup del 17/07. NO se repite: a partir de aqui author llega ya bueno en la escritura.
--
-- El MODELO del historico es irrecuperable (MCP nunca lo transmitio): queda como
-- 'unknown_legacy'. No se infiere: inventar autoria es peor que no tenerla.
--
-- Idempotente: solo toca filas con author = '{}' (no repisa lo ya capturado).

UPDATE memory SET author = jsonb_build_object(
    'product',
        CASE WHEN source_client = 'web'         THEN 'naeth-web'
             WHEN path LIKE '%/chat'            THEN 'claude-ai'
             WHEN path LIKE '%/code'            THEN 'claude-code'
             WHEN path LIKE '%claude-ai%'       THEN 'claude-ai'
             ELSE 'unknown' END,
    'surface',      NULL,                                    -- nunca se capturo
    'zone',
        CASE WHEN source_client = 'mcp:local' THEN 'loopback' ELSE 'public' END,
    'actor',
        CASE WHEN source_client = 'web' THEN 'human' ELSE 'agent' END,
    'vendor',
        CASE WHEN source_client = 'web' THEN NULL ELSE 'anthropic' END,
    'model',        NULL,                                    -- irrecuperable
    'model_source', CASE WHEN source_client = 'web' THEN 'human' ELSE 'unknown_legacy' END,
    'client_raw',   jsonb_build_object('legacy_source_client', source_client)
)
WHERE author = '{}'::jsonb;
