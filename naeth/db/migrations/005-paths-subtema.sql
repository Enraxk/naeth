-- Migracion 005 · paths de `proyecto/origen` a `proyecto/subtema` (2026-07-21).
--
-- POR QUE: desde el Paso 10 la autoria vive en `memory.author`, asi que el origen
-- (code/chat) en el path quedo REDUNDANTE. El 2o nivel pasa a ser el SUBTEMA tematico
-- (en ingles). `proyecto/status` = punto de entrada del proyecto.
--
-- EL METODO: la clasificacion parecia semantica (239 notas a mano) y NO lo fue: los TAGS
-- ya contenian la taxonomia (la convencion "proyecto primero, luego subtema" llevaba meses
-- generandola). Este fichero es el mapeo tag->subtema + las excepciones. Cobertura 239/239.
-- El ORDEN de los WHEN es la PRIORIDAD: gana el primero que casa (ver los dos criterios
-- de desempate comentados en yogin y gridwatch).
--
-- EJECUTADO: 320 filas migradas, 0 sin clasificar. 2 notas obsoletas retiradas (tombstone),
-- meta+perfil fusionados en job-search, 2 notas movidas de naeth a skills/documents.
-- Backup previo de los paths viejos en la tabla `memory._path_backup` (id, old_path).
-- 5 filas NO vigentes (historial de `comfy`, versiones superseded, una probe de seguridad)
-- conservan su path viejo A PROPOSITO: no salen en el arbol y forzarlas seria inventar.
--
-- Este fichero deja las VISTAS `_map` y `_map2` (el mapeo). El UPDATE real esta al final.
SET search_path TO memory,public;

CREATE OR REPLACE VIEW _map AS
SELECT id, path, title, tags,
       split_part(path,'/',1) AS proj,
       CASE split_part(path,'/',1)

  WHEN 'inkerlum' THEN CASE
    WHEN tags && ARRAY['prosa','voz','protocolo','craft','skill'] THEN 'prose'
    WHEN tags && ARRAY['roadmap'] THEN 'status'
    WHEN tags && ARRAY['refundacion','arquitectura','ciclo','estructura','herramientas','visualizacion','investigacion','metodo','plan'] THEN 'structure'
    WHEN tags && ARRAY['magia','leyes','combustible','coste','coste-desplazado','robo-capas','canalizacion','corrupcion','comprension','irreversible','puente','posesion','sembrado','entorno','futuro','origen','entidad','capacidad'] THEN 'magic'
    WHEN tags && ARRAY['anomalia','juicio','reloj','lectura','acceso','precio','memorias','remanentes'] THEN 'anomaly'
    WHEN tags && ARRAY['fundamental','deseo','deseo-interior','memoria','alma','muerte','nacimiento','jerarquia-del-ser','soulless','estados','autoconocimiento','capas','tiempo','ciclos','doble-regimen','transito','identidad'] THEN 'foundations'
    WHEN tags && ARRAY['era-1','era-2','era-3','era-4','cronologia','fragmentacion','cataclismo','duracion','olvido','selladores','tono','presente','descubrimiento','especializacion'] THEN 'eras'
    WHEN tags && ARRAY['mundo','mundo-ser','tierra-unica','mapa','biomas','aguas','criaturas','bestiario','secreto'] THEN 'world'
    WHEN tags && ARRAY['sociedad','errantes','vocaciones','cultura','conflicto'] THEN 'society'
    ELSE NULL END

  WHEN 'gridwatch' THEN CASE
    WHEN tags && ARRAY['equity','keep','mac','apuesta','laboral','seguridad-social','historico','fiscal'] THEN 'contract'
    WHEN tags && ARRAY['mapa','estado'] THEN 'status'
    WHEN tags && ARRAY['ed','email','estilo','eneko-style','reunion','transcripcion','follow-up','docs'] THEN 'comms'
    -- commercial ANTES que research: las cuentas concretas (ESB/UKPN/DSOs) mandan sobre
    -- el hecho de que se investigaran; si no, el tag 'investigacion' se lo come todo.
    WHEN tags && ARRAY['esb','ukpn','dso','comercial','dubai','enterprise-ireland','irlanda','españa','endesa','iberdrola','naturgy','cnmc','engie','cim','estrategia'] THEN 'commercial'
    WHEN tags && ARRAY['competencia','investigacion','m&a','funding','inversion','inversión','market-intelligence','capacidades','eurostars','horizon','eic','seai','dtif','plexigrid','gridspertise','sentrisense','ubicquia','heimdall','abb','siemens','schneider','ge-vernova'] THEN 'research'
    WHEN tags && ARRAY['grd-71','grd-72','azure','aws','dotnet','react','expo','mobile','iot','ingesta','runtime','auditoria','seguridad','epica','operational-intelligence','cleanup','equipo'] THEN 'tech'
    ELSE NULL END

  WHEN 'yogin' THEN CASE
    WHEN tags && ARRAY['mapa'] THEN 'status'
    -- client ANTES que billing: una conversacion con Vicky es de la clienta aunque
    -- hable de dinero; si no, los tags de pagos se llevan 16 de 22 notas.
    WHEN tags && ARRAY['vicky','cliente','feedback','audios','triage','worklog','alcance','entregables','campaña','junio','julio','preventa','pitch','desglose'] THEN 'client'
    WHEN tags && ARRAY['billing','pagos','facturacion','bono','precio','tarifa','fiscal','bizum','openbanking','psd2','oferta','ofertas','comercial','estimacion','garantia'] THEN 'billing'
    WHEN tags && ARRAY['oauth','google','config','node','codigo','reutilizacion','backend','arquitectura','pdf','pencil'] THEN 'tech'
    WHEN tags && ARRAY['bugs','rediseño','ui','teacher','usuarios','fichas','duplicados','free-plus','publicacion','decisiones','plan'] THEN 'product'
    ELSE NULL END

  WHEN 'cenit' THEN CASE
    WHEN tags && ARRAY['vision','plan','fases'] THEN 'status'
    WHEN tags && ARRAY['fase0','fase1','fase2','fase3','fase4','fase5','build','cutover','reconciler','migracion'] THEN 'build'
    WHEN tags && ARRAY['seguridad','endurecimiento','hardening','waf','secretos','oauth2-proxy','identidad','pocket-id'] THEN 'security'
    WHEN tags && ARRAY['contrato-modulo','manifest','modular','nucleo','panel','arquitectura','diagrama','paso8','multinodo','despliegue','exposicion'] THEN 'design'
    WHEN tags && ARRAY['finally','vps','postgres','replicacion','cloudflared','limpieza','retirado','comfy','ops','tooling','excalidraw','skill','idioma','convencion','cross-lingual','python','421'] THEN 'infra'
    ELSE NULL END

  WHEN 'naeth' THEN CASE
    -- REUBICACION: estas no son de Naeth, son de estilo de documentos -> skills/documents
    WHEN tags && ARRAY['eneko-style','gamma','docx','pdf','presentaciones','paleta'] THEN '__MOVE__skills/documents'
    WHEN tags && ARRAY['autoria','paso10','oidcproxy','identidad'] THEN 'authorship'
    WHEN tags && ARRAY['visor','editor','paso4','paleta'] THEN 'viewer'
    WHEN tags && ARRAY['convencion','esquema','slugs','tags','path','paths','tool-search','tool_search','fuente-de-verdad','vault','deprecacion','memoria','preference'] THEN 'conventions'
    WHEN tags && ARRAY['seguridad','centralizacion'] THEN 'security'
    WHEN tags && ARRAY['grafo','relaciones','tests','mcp','connector','reconexion','infra','stack'] THEN 'core'
    WHEN tags && ARRAY['estado','roadmap','pendiente','pendientes','resuelto'] THEN 'status'
    ELSE NULL END

  WHEN 'job-search' THEN CASE
    WHEN tags && ARRAY['ofertas','descartada','aubay','intergo','itc-infotech','lynx-analytics','qaracter','revolut','mlean','eagle-eye'] THEN 'offers'
    WHEN tags && ARRAY['cv','stack','java','frontend','typescript','perfil','manfred','carrera','salario'] THEN 'profile'
    WHEN tags && ARRAY['linkedin','estrategia','comunicación','candidaturas','análisis','gmail','claude'] THEN 'strategy'
    ELSE 'profile' END

  WHEN 'formacion' THEN CASE
    WHEN tags && ARRAY['jon','tania','pedagogia','plan-docente','plan','s1','s2'] THEN 'students'
    WHEN tags && ARRAY['examen','ra1','ra2','rubrica','acceso-datos','cursos','pdf','estructura'] THEN 'materials'
    WHEN tags && ARRAY['gamma','canva','tooling','codex','git','debug','limpieza'] THEN 'tools'
    ELSE 'status' END

  WHEN 'skills' THEN CASE
    WHEN tags && ARRAY['chat-close','cierre','workflow','mockups','entregables','reportes','craft-ui','naeth','yogin'] THEN 'workflow'
    ELSE 'documents' END

  WHEN 'yosoysanas' THEN CASE
    WHEN tags && ARRAY['mapa','roadmap','plan-v2','pendiente'] THEN 'status'
    WHEN tags && ARRAY['seo','santras','linkedin'] THEN 'seo'
    WHEN tags && ARRAY['logo','hero','arte','faux-sanskrit','tipografia'] THEN 'design'
    ELSE 'tech' END

  WHEN 'personal' THEN CASE
    WHEN tags && ARRAY['salud','deporte'] THEN 'health'
    WHEN tags && ARRAY['gaming','gamedev','servicios','madrid'] THEN 'leisure'
    ELSE 'people' END

  WHEN 'caja-pc' THEN CASE
    WHEN tags && ARRAY['brief','discovery','calendario'] THEN 'status'
    ELSE 'design' END

  WHEN 'infra' THEN CASE
    WHEN tags && ARRAY['stack','herramientas'] THEN 'stack'
    ELSE 'cleanup' END

  WHEN 'fiscal' THEN CASE
    WHEN tags && ARRAY['adeia','gestoria'] THEN 'status'
    ELSE 'research' END

  WHEN 'eneko' THEN 'method'
  WHEN 'fplibre' THEN 'status'
  WHEN 'whisper' THEN 'status'
  WHEN 'gtfu' THEN 'status'
  WHEN 'ucraftengine' THEN 'status'
  WHEN 'portfolio' THEN 'status'
  WHEN 'perfil' THEN 'profile'      -- se fusiona en job-search
  WHEN 'meta' THEN CASE             -- se fusiona en job-search
    WHEN tags && ARRAY['ofertas','descartada','revolut','mlean','eagle-eye'] THEN 'offers'
    WHEN tags && ARRAY['linkedin','estrategia','comunicación','candidaturas','análisis','gmail','claude','planificacion','formato','chart-display','interaccion','preferencia'] THEN 'strategy'
    ELSE 'profile' END
  WHEN 'Tests' THEN 'RETIRAR'
  ELSE NULL END AS subtema
FROM memory_current;

-- ============================================================
-- EXCEPCIONES: correcciones manuales sobre el mapeo por tags (revision nota a nota
-- de inkerlum con Eneko, 2026-07-21). La regla general va por tags; esto es la lista
-- corta, explicita y auditable de lo que los tags no acertaron.
-- Criterios de Eneko: el tiempo es un FUNDAMENTO; el transito es de la ANOMALIA;
-- la estructura social de la Era I se queda en ERAS.
-- ============================================================
CREATE OR REPLACE VIEW _map2 AS
SELECT id, path, title, tags, proj,
  CASE
    WHEN title LIKE '%el Juicio de la Anomalía%'              THEN 'anomaly'
    WHEN title LIKE '%el alma y el soulless%'                 THEN 'foundations'
    WHEN title LIKE '%consecuencias del deseo interior%'      THEN 'foundations'
    WHEN title LIKE '%precisiones de la jerarquía del ser%'   THEN 'foundations'
    WHEN title LIKE '%reciclaje de almas y deseos%'           THEN 'foundations'
    WHEN title LIKE '%doble régimen temporal%'                THEN 'foundations'
    WHEN title LIKE '%el mundo-ser%'                          THEN 'world'
    WHEN title LIKE '%el olvido y los selladores%'            THEN 'eras'
    WHEN title LIKE '%la cohesión como poder%'                THEN 'eras'
    WHEN title LIKE '%las vocaciones (qué son%'               THEN 'society'
    ELSE subtema
  END AS subtema
FROM _map;

-- ============================================================
-- EL UPDATE (lo que se ejecuto el 2026-07-21). Las vistas de arriba son el mapeo.
-- Para re-ejecutar en otro nodo: aplicar este fichero entero.
-- ============================================================
-- 0) Backup reversible de los paths actuales.
DROP TABLE IF EXISTS _path_backup;
CREATE TABLE _path_backup AS SELECT id, path AS old_path, now() AS backed_up_at FROM memory;

BEGIN;
-- 1) Reubicaciones explicitas (naeth -> skills/documents: no eran de Naeth).
UPDATE memory m SET path = replace(x.subtema,'__MOVE__','')
FROM _map2 x WHERE x.id = m.id AND x.subtema LIKE '__MOVE__%';

-- 2) Fusion meta+perfil -> job-search, y el resto: proyecto/subtema.
UPDATE memory m SET path =
    (CASE WHEN x.proj IN ('meta','perfil') THEN 'job-search' ELSE x.proj END) || '/' || x.subtema
FROM _map2 x
WHERE x.id = m.id AND x.subtema IS NOT NULL
  AND x.subtema NOT LIKE '__MOVE__%' AND x.subtema <> 'RETIRAR';
COMMIT;

-- 3) Las marcadas RETIRAR se tombstonean por la tool MCP (append-only), no aqui.
-- 4) Verificacion.
SELECT count(*) FILTER (WHERE path LIKE '%/code' OR path LIKE '%/chat') AS con_path_viejo,
       count(*) FILTER (WHERE path IS NULL)                             AS sin_path,
       count(*)                                                          AS vigentes
FROM memory_current;

-- ROLLBACK (si hiciera falta):
--   UPDATE memory m SET path = b.old_path FROM _path_backup b WHERE b.id = m.id;
