# py-lint.ps1
# Hook PostToolUse de Claude Code (Naeth). Se dispara tras cada Edit/Write.
#
# Dos comprobaciones sobre el fichero Python recien editado, con ruff, y con dos
# durezas distintas a proposito:
#   1. BLOQUEA el turno (exit 2) si hay un error real: F821, F811, E9.
#   2. AVISA sin bloquear si faltan docstrings (D100-D103) o un Args: esta
#      incompleto (D417), segun la guia de documentacion (Google, Notes: al
#      final). El aviso entra al contexto del modelo como additionalContext.
# La idea es la misma que fix-style: una verificacion mecanica vive en un hook,
# no en "que el modelo se acuerde".
#
# POR QUE LA PARTE D NACE EN AVISO Y NO EN BLOQUEO (decidido el 10/09/2026,
# plan de fase 2 de CodeDoc Archive, sub-fase 1): ruff mira el fichero entero,
# y el 11/09 mcp_server.py tenia 27 funciones sin docstring. Un hook que
# bloqueara por eso impediria tocar el fichero justo para documentarlas. Pasa a
# bloqueo en la sub-fase 3, cuando naeth/app y cenit_core esten a cero. Es el
# mismo camino de warn a strict que siguio el digest (mcp_server.py, _enforce_digest).
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
# Reglas que bloquean (y por que solo estas):
#   F821  nombre indefinido    <- el error que un LLM comete de verdad:
#                                 helper alucinado, variable renombrada a medias
#   F811  redefinicion         <- la otra mitad de un refactor incompleto
#   E9    errores de sintaxis  <- incluye lo que habria dado py_compile
# F401 (import sin usar) queda FUERA a proposito: es ruido y no rompe nada;
# no merece detener un turno.
#
# Reglas que avisan:
#   D100 modulo, D101 clase, D102 metodo, D103 funcion publica sin docstring
#   D417 un parametro que no aparece en Args: (convencion google)
# Los tests quedan fuera de la parte D: una funcion test_ no lleva docstring.

$ErrorActionPreference = "SilentlyContinue"
[Console]::OutputEncoding = [Text.Encoding]::UTF8

# Claude Code pasa el evento como JSON por stdin
$raw = [Console]::In.ReadToEnd()
if (-not $raw) { exit 0 }

try { $evt = $raw | ConvertFrom-Json } catch { exit 0 }
$file = $evt.tool_input.file_path
if (-not $file) { $file = $evt.tool_response.filePath }
if (-not $file) { exit 0 }
if (-not (Test-Path -LiteralPath $file)) { exit 0 }

# Solo Python, y solo el codigo del modulo
if ([IO.Path]::GetExtension($file).ToLowerInvariant() -ne ".py") { exit 0 }
$full = (Resolve-Path -LiteralPath $file).Path
if ($full -notmatch '\\naeth\\app\\') { exit 0 }

# Si uvx no esta disponible, no bloqueamos: un hook no debe frenar el trabajo
# por una herramienta que falta en la maquina.
if (-not (Get-Command uvx -ErrorAction SilentlyContinue)) { exit 0 }

$out = & uvx ruff check --select F821,F811,E9 --quiet -- $full 2>&1
$rc = $LASTEXITCODE

if ($rc -ne 0) {
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
}

# ---- Parte D: docstrings, en modo aviso -----------------------------------
if ($full -match '\\tests\\') { exit 0 }

$dout = & uvx ruff check --select D100,D101,D102,D103,D417 `
    --config "lint.pydocstyle.convention='google'" `
    --output-format concise --quiet -- $full 2>&1
$drc = $LASTEXITCODE
if ($drc -eq 0 -or -not $dout) { exit 0 }

$lines = @(($dout | Out-String).Trim() -split "`r?`n" | Where-Object { $_ -match ':\d+:\d+: D\d{3}' })
if ($lines.Count -eq 0) { exit 0 }
$show = $lines | Select-Object -First 12 | ForEach-Object { $_ -replace '^.*\\naeth\\', 'naeth\' }
$resto = $lines.Count - $show.Count
$msg = "py-lint (aviso, no bloquea): en este fichero hay $($lines.Count) simbolo(s) sin docstring o con Args: incompleto segun la guia (F:\src\Naeth\docs\guia-documentacion.md). " +
       "Si has tocado alguno, documentalo en este mismo turno: resumen de una linea, Args: solo lo que la firma no explica, Returns:, y Notes: al final con el porque.`n" +
       (($show) -join "`n")
if ($resto -gt 0) { $msg += "`n... y $resto mas" }

$payload = @{ hookSpecificOutput = @{ hookEventName = "PostToolUse"; additionalContext = $msg } }
Write-Output ($payload | ConvertTo-Json -Compress -Depth 4)
exit 0
