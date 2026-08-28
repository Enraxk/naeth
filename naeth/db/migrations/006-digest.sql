-- Migracion 006 · columna `digest` (2026-08-28). Fase 4 del plan del 28/08.
--
-- POR QUE: `memory_search` devolvia el CONTENIDO INTEGRO de cada resultado. Con una media de 2.686
-- caracteres por nota vigente, una busqueda de k=10 vuelca unos 27.000 caracteres de contexto para
-- que el agente decida cuales de las diez le servian. El digest es un resumen corto ESCRITO A MANO:
-- la busqueda pasa a dar el mapa y `memory_get` sigue trayendo el terreno.
--
-- EL TOPE, 300: medido, no elegido. Se redactaron 24 digests reales sobre una muestra estratificada
-- de 590 a 7.569 caracteres de nota y quedaron en 212-296 (mediana 267). Ver
-- docs/plan/fase-4-0-tope-y-prioridad.md, que documenta ademas el sesgo de anclaje que aparecio al
-- medir y por que se descarto el p90 de la primera pasada.
-- Se empieza APRETADO a proposito, por la asimetria: relajar el CHECK despues revalida las filas
-- existentes y todas pasan; apretarlo obligaria a reeditar a mano cada digest que lo violara.
--
-- NULLABLE A PROPOSITO: el backfill de las 470 vigentes va por tandas y tarda. Una columna NOT NULL
-- obligaria a terminarlo antes de poder desplegar nada.
--
-- ⚠ ORDEN DE APLICACION, Y NO ES COSMETICO: `finally` PRIMERO, el PC DESPUES.
-- El handoff de CENIT saca la lista de columnas del nodo ORIGEN (handoff.py, list_columns sobre
-- information_schema) y crea la tabla de staging en el DESTINO con `LIKE "memory"."memory"`
-- (sync.py, staging_ddl). Si el ORIGEN tiene `digest` y el DESTINO no, el `COPY IN` falla y se lleva
-- por delante el sync de la tabla `memory` ENTERA, no solo del digest. Al reves es benigno: la
-- columna de mas en el destino se queda a NULL.
-- En `finally` hay que levantar el `default_transaction_read_only` solo para esta sentencia con
-- PGOPTIONS, como se hizo con `fuzzystrmatch` el mismo 28/08, y comprobar despues que sigue en `on`.
--
-- ⚠ EL BACKFILL NO VIAJA EN EL SYNC. `MONOTONIC_MERGE_RULES` (sync.py) solo reconcilia `is_current`
-- y `embedding`; en el resto de columnas manda la fila local. Rellenar el digest de una fila que ya
-- existe en los dos nodos NO se propaga: cada tanda del backfill son DOS ejecuciones, una por nodo.

SET search_path TO memory,public;

ALTER TABLE memory ADD COLUMN IF NOT EXISTS digest text;

-- Idempotente: relanzar la migracion no duplica la restriccion ni falla.
ALTER TABLE memory DROP CONSTRAINT IF EXISTS memory_digest_len;
ALTER TABLE memory ADD CONSTRAINT memory_digest_len
    CHECK (digest IS NULL OR length(digest) <= 300);

-- Sin indice a proposito: el corpus son ~800 filas y la unica consulta que filtra por digest es el
-- recuento de "vigentes sin digest" del modo higiene. Un indice aqui seria deuda sin beneficio.

-- NOTA SOBRE EL ORDEN FISICO, que despista al comparar los dos nodos: `ALTER TABLE ADD COLUMN`
-- siempre anade AL FINAL, asi que en una base migrada `digest` es la ultima columna, mientras que
-- en una base creada desde schema.sql es la quinta. NO afecta al sync: `copy_out_command` y
-- `copy_in_command` nombran las columnas explicitamente y reciben la MISMA lista (la del origen),
-- asi que el orden fisico nunca entra en juego.
--
-- EJECUTADA el 28/08/2026 en los dos nodos, `finally` primero. Verificado en cada uno: la columna
-- existe y es nullable, el CHECK rechaza 301 caracteres, y en `finally` el `read_only` del rol
-- sigue en `on` (un CREATE TABLE normal alli sigue fallando). Y despues, `core handoff --from local
-- --to finally` paso sus 9 tablas con memory 790 -> 790: el sync no se rompio.
