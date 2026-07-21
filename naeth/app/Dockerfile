# Imagen comun para api y worker (Paso 7 §6). El comando lo fija el compose.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

WORKDIR /srv

COPY app/requirements.txt /srv/app/requirements.txt
RUN pip install --no-cache-dir -r /srv/app/requirements.txt

COPY app /srv/app

# api: uvicorn app.api:app  ·  worker: python -m app.worker  (definido en compose)
EXPOSE 8000
