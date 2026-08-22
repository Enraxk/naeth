# Imagen comun para api, worker y viewer (Paso 7 §6). El comando lo fija el compose.

# ── Etapa 1: el visor v2 ────────────────────────────────────────────────────────────────
# El front se compila AQUI y no en la maquina que despliega. Anadido el 22/08/2026, cuando el
# visor v2 paso a produccion y el nodo `finally` se quedo sirviendo el v1: su Node era el 18, que
# Vite 8 ya no admite (pide >=20.19), y `dist/` no esta versionado, asi que no habia forma de que
# le llegara. Compilar en la imagen resuelve las dos cosas a la vez y no anade ningun paso al
# despliegue: `./up.sh --build` ya reconstruia la imagen.
#
# Las dependencias se copian ANTES que el codigo a proposito: asi un cambio en `src/` no invalida
# la capa del `npm ci`, que es la que tarda.
FROM node:22-slim AS front
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ── Etapa 2: la aplicacion ──────────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /srv

COPY app/requirements.txt /srv/app/requirements.txt
RUN pip install --no-cache-dir -r /srv/app/requirements.txt

COPY app /srv/app

# El build va a `/srv/viewer-build` y NO a `/srv/viewer`, que es donde el PC bind-montea su
# `web/dist`. Son dos rutas distintas porque cada nodo usa una:
#   - PC:      NAETH_VIEWER_DIR=/srv/viewer        -> el bind-mount, para iterar sin rebuild.
#   - finally: NAETH_VIEWER_DIR=/srv/viewer-build  -> lo que trae esta imagen.
# Si compartieran ruta, el bind-mount del compose base (que finally tambien aplica, porque el
# override no puede retirar UN volumen de la lista, solo resetearlos todos) montaria un directorio
# vacio encima del build y el visor se quedaria sin nada que servir.
COPY --from=front /web/dist /srv/viewer-build

# api: uvicorn app.api:app  ·  worker: python -m app.worker  (definido en compose)
EXPOSE 8000
