# Paso 9 · Plan de despliegue de Naeth v1 en `finally`

**Proyecto Naeth** — runbook detallado para poner en marcha Naeth v1 sobre el sustrato
del Paso 5 (Postgres + pgvector) y el esquema del Paso 6, en el home server `finally`.

> **Orden de ejecución (replanteado el 2026-06-23)**: este paso (deploy VPS) se ejecuta
> el **último**. Antes van el **Paso 7** (Naeth en local Windows con MCP + túnel a este
> equipo) y el **Paso 8** (sincronización multi-master local↔VPS). Cuando se ejecute
> este runbook, el VPS deja de ser la única instancia: pasa a ser **un nodo más** que
> reconcilia con el local. Renombrado de `paso7-despliegue.md` a `paso9-despliegue-vps.md`.

**Fecha**: 2026-05-30 (runbook) · replanteado a "el último de la cola" el 2026-06-23
**Qué es v1**: el **visor de composición** ya construido, re-plataformado a FastAPI +
Postgres, accesible por `naeth.enraxk.dev` tras el túnel `enraxk` + Cloudflare Access.
Cubre: alta de memoria (síncrona) + cola de embeddings (async) + búsqueda híbrida +
estado del sistema. **No** v1 (roadmap): árbol navegable, CRUD completo, editor
Milkdown, grafo heptápodo, gestión de adjuntos por UI, login app-level completo.
**Reglas**: este documento es un plan. **No ejecuto nada en tu server**; lo corre tu
Claude Code de `finally` o tú, **fase a fase y con tu OK**. Comandos ilustrativos:
verificar antes de aplicar. Nunca imprimir secretos.

---

## 0. Topología objetivo

```
   navegador (cualquier parte)  ──HTTPS──▶  Cloudflare edge (Access: tu identidad + 2FA)
                                                  │  túnel enraxk (saliente, sin puertos abiertos)
                                                  ▼
   finally:  cloudflared ──▶ 127.0.0.1:8008  (Naeth API · FastAPI/uvicorn)
                                   │  red docker interna (sin puerto al host)
                                   ▼
                              Postgres + pgvector  ──▶  pgdata en volumen LUKS
                                   ▲
                              worker de embeddings (CPU)
                              assets (PDF/HTML/...) en disco LUKS
```

Principios del despliegue:

- **Postgres no se expone al host**: solo vive en la red interna del compose de Naeth.
- **API solo en loopback** (`127.0.0.1:8008`); el único acceso externo es el túnel.
- **Datos cifrados en reposo** (LUKS) y **con backup** antes de meter nada real.
- Secretos en `.env` con permisos `600`, patrón `X-Enraxk-Token` reusado.

---

## 1. Prerequisitos en el server (ANTES de exponer Naeth)

El informe de `finally` dejó tres huecos que hay que cerrar primero. Orden sugerido y
cada uno con su verificación. Nada de esto es de Naeth en sí, pero condiciona meter
datos reales.

### 1.1 Endurecimiento base (rápido, alto impacto)

El combo actual (UFW inactivo + CouchDB 5984 público + SSH con contraseña + sin
fail2ban) es la mayor exposición. Antes de añadir un servicio más:

```bash
# UFW: denegar entrante por defecto, permitir solo lo necesario
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                  # SSH (idealmente solo desde LAN)
# revisar qué hay publicado hoy y decidir qué cerrar:
sudo ss -tlnp
# CouchDB 5984 NO debería ser público: cerrarlo o bindearlo a loopback/LAN.
sudo ufw enable
sudo ufw status verbose

# fail2ban para SSH
sudo apt install fail2ban
sudo systemctl enable --now fail2ban

# SSH solo por clave (verificar PRIMERO que todos los usuarios reales tienen llave)
# en /etc/ssh/sshd_config:  PasswordAuthentication no
sudo sshd -t && sudo systemctl reload ssh

# actualizar cloudflared (avisa 2026.3.0 -> 2026.5.2)
# limpiar el squid-proxy en restart loop si no se usa
docker rm squid-proxy
```

> `⚠` No deshabilitar `PasswordAuthentication` sin confirmar que tienes acceso por
> clave funcionando, o te quedas fuera. Verificar en una segunda sesión SSH antes de
> cerrar la primera.

### 1.2 Cifrado en reposo (q2): volumen LUKS para los datos de Naeth

`finally` no tiene cifrado de disco. En vez de re-cifrar todo el sistema, crear un
**contenedor LUKS dedicado** para `pgdata` + `assets` de Naeth. Hay sitio de sobra
(214 GB libres).

Opción A, partición/volumen LV dedicado (si hay espacio sin asignar en `ubuntu-vg`):

```bash
# crear un LV nuevo y cifrarlo
sudo lvcreate -L 50G -n naeth-data ubuntu-vg
sudo cryptsetup luksFormat /dev/ubuntu-vg/naeth-data      # AES-256-XTS por defecto
sudo cryptsetup open /dev/ubuntu-vg/naeth-data naeth-data
sudo mkfs.ext4 /dev/mapper/naeth-data
sudo mkdir -p /srv/naeth/data
sudo mount /dev/mapper/naeth-data /srv/naeth/data
```

Opción B, fichero-contenedor LUKS (si no quieres tocar LVM):

```bash
sudo fallocate -l 50G /srv/naeth.img
sudo cryptsetup luksFormat /srv/naeth.img
sudo cryptsetup open /srv/naeth.img naeth-data
sudo mkfs.ext4 /dev/mapper/naeth-data
sudo mkdir -p /srv/naeth/data && sudo mount /dev/mapper/naeth-data /srv/naeth/data
```

**Apertura en arranque**: para un homelab, lo más simple es desbloqueo manual tras
reboot (entras por SSH y haces `cryptsetup open` + `mount`), o keyfile en disco
cifrado del sistema (menos seguro), o TPM/`systemd-cryptenrol` (más avanzado). Decisión
tuya; recomiendo empezar con desbloqueo manual y un pequeño script. `⚠ a decidir`.

Sobre `/srv/naeth/data` colgarán `pgdata/` y `assets/`. Si el LUKS no está montado, el
compose de Naeth no debe arrancar (montar como dependencia).

### 1.3 Backups (crítico, no hay ninguno)

Antes de datos reales: backup cifrado de `pgdata` y de los `assets`. `restic` cifra por
defecto.

```bash
sudo apt install restic
# repositorio restic (destino: otro disco, NAS, o almacenamiento remoto; NO el mismo volumen)
restic init --repo /ruta/backup/naeth     # define RESTIC_PASSWORD en .env 600

# dump lógico de Postgres + subida a restic, por cron diario
# /usr/local/bin/naeth-backup.sh  (ilustrativo)
#   docker exec naeth-db pg_dump -U naeth naeth | restic backup --repo ... --stdin --stdin-filename naeth.sql
#   restic backup --repo ... /srv/naeth/data/assets
#   restic forget --keep-daily 7 --keep-weekly 4 --prune
```

Cron: `0 4 * * * /usr/local/bin/naeth-backup.sh`. **Probar un restore** antes de
confiar. El mismo patrón conviene para el CouchDB del stack viejo, que tampoco tiene
backup.

---

## 2. El stack de Naeth (docker-compose)

Estructura en el server (sobre el volumen LUKS para los datos):

```
/opt/naeth/                 # código y compose (puede ir en disco normal)
  docker-compose.yml
  .env                      # secretos, permisos 600
  api/                      # FastAPI (núcleo + visor re-plataformado)
  worker/                   # worker de embeddings
  db/postgresql.tuning.conf
/srv/naeth/data/            # VOLUMEN LUKS
  pgdata/                   # datos de Postgres
  assets/                   # binarios de adjuntos (q6)
```

`docker-compose.yml` (ilustrativo, se concreta al construir):

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    shm_size: 8gb                       # crítico para el build paralelo de HNSW
    environment:
      POSTGRES_USER: naeth
      POSTGRES_DB: naeth
      POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
    volumes:
      - /srv/naeth/data/pgdata:/var/lib/postgresql/data
      - ./db/postgresql.tuning.conf:/etc/postgresql/conf.d/tuning.conf:ro
    networks: [naeth-internal]
    # SIN ports: no se expone al host
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U naeth"]
      interval: 10s
      retries: 6

  api:
    build: ./api
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:8008:8000"           # solo loopback; el tunel mapea aqui
    depends_on:
      db: { condition: service_healthy }
    networks: [naeth-internal]

  worker:
    build: ./worker
    restart: unless-stopped
    env_file: .env
    depends_on:
      db: { condition: service_healthy }
    networks: [naeth-internal]

networks:
  naeth-internal:
    driver: bridge
```

`db/postgresql.tuning.conf` (para 62 GB RAM, ajustar):

```conf
shared_buffers = 8GB
effective_cache_size = 24GB
work_mem = 64MB
maintenance_work_mem = 2GB             # builds HNSW grandes en RAM (Paso 5)
max_parallel_maintenance_workers = 4
max_parallel_workers = 8
max_worker_processes = 12
```

`.env` (permisos `600`, valores NO en este doc):

```
POSTGRES_PASSWORD=...        # nuevo, no reutilizar el del stack viejo
NAETH_API_TOKEN=...          # patron X-Enraxk-Token
RESTIC_PASSWORD=...          # para los backups
EMBED_MODEL=BAAI/bge-small-en-v1.5
```

---

## 3. Exposición por Cloudflare (q1)

El túnel `enraxk` ya existe y su ingress se gestiona en el **dashboard de Zero Trust**
(no en el server). Pasos en Cloudflare:

1. **Zero Trust → Networks → Tunnels → `enraxk` → Public Hostnames → Add a public
   hostname**:
   - Subdomain `naeth`, domain `enraxk.dev`.
   - Service: `HTTP` → `localhost:8008`.
2. **Zero Trust → Access → Applications → Add (Self-hosted)**:
   - Application domain: `naeth.enraxk.dev`.
   - Policy: Allow solo tu identidad (tu email) con **2FA / OTP**. Esto da el login
     "desde cualquier navegador del mundo" con auth fuerte, sin abrir puertos.
3. (Opcional, defensa en profundidad) añadir luego sesión app-level (argon2) en la API.

No hace falta tocar nada de red en `finally`: el túnel sale hacia Cloudflare.

---

## 4. Arranque y migraciones

1. Montar el volumen LUKS (`cryptsetup open` + `mount`) antes de levantar el compose.
2. `docker compose up -d db` y esperar healthy.
3. Inicializar el esquema (Paso 6): `CREATE EXTENSION vector;` + DDL de `memory`,
   `relation`, `attachment`, `job`, la vista `memory_current`, los índices (con el
   tuning de build). Vía script SQL o Alembic.
4. `docker compose up -d api worker`.
5. Smoke test (ver §5).

---

## 5. Verificación post-despliegue

- `docker compose ps` todos healthy; `db` sin puerto publicado (`ss -tlnp` no muestra 5432).
- API local: `curl -s -H "X-Enraxk-Token: ..." http://127.0.0.1:8008/api/status`.
- Alta + recall: escribir una memoria, comprobar que aparece y que la búsqueda híbrida
  responde con latencia baja.
- Cola: la memoria nueva genera un `job(embed)`; el worker la procesa; el visor muestra
  el desfase bajando a 0.
- Acceso externo: abrir `https://naeth.enraxk.dev` desde fuera; Cloudflare Access pide
  identidad/2FA; tras autenticar, carga el visor.
- Backup: ejecutar `naeth-backup.sh` a mano una vez y **probar un restore** en un
  contenedor de prueba.

---

## 6. Checklist de "producción casera"

- [ ] UFW activo, CouchDB no público, fail2ban activo, SSH solo-clave.
- [ ] Volumen LUKS montado, `pgdata` y `assets` dentro.
- [ ] Backups cifrados (restic) por cron, con restore probado.
- [ ] Postgres sin puerto al host; API solo en loopback.
- [ ] Cloudflare Access con 2FA sobre `naeth.enraxk.dev`.
- [ ] `.env` con permisos `600`, secretos nuevos (no reutilizados).
- [ ] cloudflared actualizado.

---

## 7. Orden de ejecución recomendado (cada fase, con tu OK)

1. **Endurecimiento base** (§1.1) — barato, reduce exposición ya.
2. **LUKS + backups** (§1.2, §1.3) — prerequisito de datos reales.
3. **Esqueleto del stack** (§2) — compose + .env + tuning, sin datos.
4. **DDL del esquema** (§4) — crear tablas e índices.
5. **Construir la API v1** (visor re-plataformado) y el worker — aquí entra el código.
6. **Exponer** (§3) — hostname + Access.
7. **Verificar** (§5) y marcar el checklist (§6).

---

## 8. Lo que NO cubre este plan (roadmap posterior a v1)

- Árbol navegable, CRUD completo, editor Milkdown, grafo heptápodo, gestión de adjuntos
  por UI, login app-level completo. Se construyen encima de la v1.
- Verificación de recall real de pgvector con embeddings reales (Paso 5 §caveat).
- Migración de datos del stack viejo (Enraxk.dat / CouchDB) a Naeth, si se quiere.

---

**Fin del Paso 7.** Con esto, el camino de papel a Naeth funcionando está completo:
sustrato (5), esquema (6) y despliegue (7). El siguiente movimiento real es construir,
fase a fase del §7, empezando por el endurecimiento del server.
