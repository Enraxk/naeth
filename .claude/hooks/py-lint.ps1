# py-lint.ps1
# Hook PostToolUse de Claude Code (Naeth). Se dispara tras cada Edit/Write.
#
# Comprueba el fichero Python recien editado con ruff y BLOQUEA el turno si
# encuentra un error real. La idea es la misma que fix-style: una verificacion
# mecanica vive en un hook, no en "que el modelo se acuerde".
#
# Por que ruff via uvx y no `python -m py_compile`:
#   - py_compile solo ve errores de SINTAXIS, que casi nunca son el fallo real.
#   - py_compile ESCRIBE __pycache__/*.pyc dentro de app/, que es bind-mount a
#     los contenedores, cuyo Dockerfile pone PYTHONDONTWRITEBYTECODE=1 justo
#     para evitarlo. Un verificador no debe ensuciar el arbol que verifica.
#   - el Python local es 3.11 y el contenedor corre 3.12: validar con el
#     interprete equivocado da falsos positivos.
# ruff no escribe nada, no depende del interprete local y tarda ~0,1 s en caliente.
#
# Reglas elegidas (y por que solo estas):
#   F821  nombre indefinido    <- el error que un LLM comete de verdad:
#                                 helper alucinado, variable renombrada a medias
#   F811  redefinicion         <- la otra mitad de un refactor incompleto
#   E9    errores de sintaxis  <- incluye lo que habria dado py_compile
# F401 (import sin usar) queda FUERA a proposito: es ruido y no rompe nada;
# no merece detener un turno.

$ErrorActionPreference = "SilentlyContinue"

# Claude Code pasa el evento como JSON por stdin
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try { $evt = $raw | ConvertFrom-Json } catch { exit 0 }
$file = $evt.tool_input.file_path
if (-not $file) { $file = $evt.tool_response.filePath }
if (-not $file) { exit 0 }
if (-not (Test-Path -LiteralPath $file)) { exit 0 }

# Solo Python, y solo el codigo del modulo (no tests ni scripts sueltos del repo)
if ([IO.Path]::GetExtension($file).ToLowerInvariant() -ne ".py") { exit 0 }
$full = (Resolve-Path -LiteralPath $file).Path
if ($full -notmatch '\\naeth\\app\\') { exit 0 }

# Si uvx no esta disponible, no bloqueamos: un hook no debe frenar el trabajo
# por una herramienta que falta en la maquina.
if (-not (Get-Command uvx -ErrorAction SilentlyContinue)) { exit 0 }

$out = & uvx ruff check --select F821,F811,E9 --quiet -- $full 2>&1
$rc = $LASTEXITCODE

if ($rc -eq 0) { exit 0 }

# rc distinto de 0 sin salida = fallo de la propia herramienta (red, cache...).
# No es un problema del codigo: avisamos sin bloquear.
if (-not $out) {
    [Console]::Error.WriteLine("py-lint: ruff no pudo ejecutarse (rc=$rc). No se ha verificado el fichero.")
    exit 1
}

# exit 2 = bloqueo. stderr se le devuelve al modelo como mensaje de error.
[Console]::Error.WriteLine("ruff ha encontrado errores en el fichero que acabas de editar:")
[Console]::Error.WriteLine(($out | Out-String).Trim())
[Console]::Error.WriteLine("")
[Console]::Error.WriteLine("F821 = nombre indefinido (helper o variable que no existe), F811 = redefinicion, E9 = sintaxis.")
[Console]::Error.WriteLine("Arreglalo antes de seguir: en Naeth un fallo silencioso se propaga a todas las sesiones.")
exit 2
