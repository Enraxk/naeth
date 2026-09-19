---
name: naeth-tests
description: Cómo lanzar la suite del backend de Naeth (pytest vía docker compose, profile test) y cómo bajar después SOLO el db. Léela antes de ejecutar los tests del backend: hay cuatro trampas que cuestan caro (db retirado a propósito, NUNCA down, una sola suite a la vez, tarda). No aplica a los tests del front (naeth/web), que van con npm y están en el CLAUDE.md.
---

# Tests del backend de Naeth

72 tests en `naeth/app/tests/`. Se lanzan desde `naeth/`:

```
docker compose --profile test run --rm test
docker compose rm -sf db          # al terminar, y SOLO asi (ver el punto 2)
```

El compose exige `CENIT_DB_PASSWORD` y las dos `OIDC_*` aunque el servicio `test` no las use: la
interpolación se evalúa sobre el fichero entero. Para una tanda suelta basta pasarlas en dummy por
delante del comando; para trabajar de verdad, `up.ps1`, que las saca de SOPS.

⚠ Cuatro cosas que hay que saber **antes** de lanzarlos, y que cuestan caro descubrir:

1. **Levanta el servicio `db`, que está retirado a propósito.** `docker-compose.yml:14-16` lo
   documenta: sin el profile, cada `up.ps1` lo resucitaba y dejaba dos Postgres de Naeth vivos a la
   vez. `run --rm` borra el contenedor del test, pero **no** las dependencias que levantó por
   `depends_on`, así que el `db` se queda vivo: bájalo tú al terminar.
   (Ya no tiene `restart: unless-stopped`; se le quitó el 02/08/2026, `docker-compose.yml:37`.)
2. **Para bajarlo, `docker compose rm -sf db`. NUNCA `down`.** `docker compose --profile test down`
   **no baja solo el profile: baja la pila entera**, api y viewer incluidos, y se lleva la red por
   delante. Pasó el 22/08/2026 y dejó Naeth caído hasta levantarlo con `up.ps1`. El `--profile` del
   comando engaña: filtra qué se arranca, no qué se para.
3. **No se pueden correr dos suites a la vez.** `conftest.py` hace `DROP DATABASE naeth_test WITH
   (FORCE)` en fixture de sesión: dos ejecuciones concurrentes se tiran la base mutuamente y dan rojo
   falso. Con varias sesiones de Claude Code abiertas, esto pasa de verdad.
4. **Tarda.** El compose hace `pip install` en cada run: 20-40 s en caliente, minutos en frío. No es
   un comando para lanzar a la ligera ni para meter en un automatismo.
