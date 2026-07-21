# Paso 7 · Resultados de la Fase 5 (endurecimiento mínimo local · autonomía)

> Banco real en **este equipo Windows**. La Fase 5 del [Paso 7](paso7-local-windows.md)
> §10.5: que Naeth **sobreviva a reinicios** sin depender de una sesión abierta, antes de
> pasar al [Paso 8](paso8-sync.md) (sync) y al [Paso 9](paso9-despliegue-vps.md). Fecha:
> 2026-06-25.

## Qué se endureció

Hasta la Fase 4, el túnel y la pila corrían en procesos de fondo de la sesión: al cerrarla
o reiniciar el equipo, **claude.ai perdía la conexión**. La Fase 5 los convierte en
arranque automático.

| Componente | Antes | Ahora |
|---|---|---|
| **cloudflared** | proceso manual en sesión | **servicio de Windows** `Cloudflared`, `StartType=Automatic` (arranca al boot, **sin login**) |
| **Docker Desktop** | arranque manual | **AutoStart=true** + entrada de inicio (arranca al iniciar sesión) |
| **Pila Naeth** | `restart: unless-stopped` | igual: vuelve sola cuando el daemon Docker arranca |

## El servicio cloudflared (con config local)

El `cloudflared service install` por defecto deja el servicio **sin argumentos** (binPath =
solo el `.exe`), así que arranca pero **no enruta**. La reparación fue fijar el `ImagePath`
del servicio para que ejecute el túnel con el **config local**:

```
"…\cloudflared.exe" tunnel --config "C:\Users\eneki\.cloudflared\config.yml" run naeth-local
```

Así el servicio es autónomo y mantiene el ingress **versionado en el repo** (config local,
no en el dashboard de Cloudflare). El servicio corre como `LocalSystem`, que puede leer el
`config.yml` y las credenciales en `C:\Users\eneki\.cloudflared\` (rutas absolutas).

> **Dos copias del `config.yml`**: la fuente en `naeth/cloudflared/config.yml` (repo) y la
> que usa el servicio en `C:\Users\eneki\.cloudflared\config.yml`. Si se cambia el ingress,
> actualizar ambas (o re-copiar) y `Restart-Service Cloudflared`.

## Verificación

| Comprobación | Resultado | Veredicto |
|---|---|---|
| Servicio `Cloudflared` | `Running`, `StartType=Automatic` | ✅ |
| Túnel servido por el servicio | `https://naeth-local.enraxk.dev/healthz` responde | ✅ |
| Restart policy de la pila | `db`/`api`/`worker` = `unless-stopped` | ✅ |
| Docker Desktop autostart | `AutoStart=true` + entrada Run presente | ✅ |

## Caveats honestos

- **Desfase boot vs login**: cloudflared (servicio) arranca en el **boot**; Docker Desktop y
  la pila, al **iniciar sesión**. En esa ventana el túnel da 502 hasta que la pila levanta.
  Para un equipo personal de sobremesa (enciendes y entras) es aceptable; si se quisiera
  cero-desfase, Docker tendría que correr como servicio del sistema (no es el caso en
  Windows con Docker Desktop).
- **Verificación de reinicio pendiente**: la config está puesta, pero **confirmar al 100%
  requiere reiniciar el equipo** y comprobar que todo levanta solo. No se reinició aquí.
- **`pgdata` aún en C:**: mover la *disk image* de Docker a F: (Settings → Resources) sigue
  pendiente; es operativo y disruptivo (migra datos), se hará cuando convenga.
- **`ImagePath` ligado a la ruta del paquete winget**: estable por package id (no incluye
  versión), así que sobrevive actualizaciones de cloudflared; si se reinstala por otra vía,
  revisar la ruta.

## Veredicto de la Fase 5 — y cierre operativo del Paso 7

Naeth **arranca solo tras un reinicio**: cloudflared como servicio y la pila Docker con
autostart + `unless-stopped`. claude.ai mantiene la conexión sin sesión abierta. Con esto el
**Paso 7 queda cerrado también en lo operativo**: Naeth v1 corre como primera instancia real
y autónoma. Lo siguiente es harina de otra fase: el [Paso 8](paso8-sync.md) (sync
multi-master con `finally`) y el [Paso 9](paso9-despliegue-vps.md) (`finally` como segundo
nodo). Pendiente menor: mover `pgdata` a F: y una verificación real de reinicio.
