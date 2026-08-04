# up.ps1 - levanta Naeth como modulo `memory` de CENIT (Fase 4).
# Inyecta los secretos del nucleo (CENIT_DB_PASSWORD, OIDC_*) desde SOPS al vuelo.
param([switch]$Build, [switch]$Down)
$ErrorActionPreference = 'Stop'
$here  = Split-Path -Parent $MyInvocation.MyCommand.Path
# La ruta al repo del nucleo es local a cada maquina, asi que vive en el entorno, no aqui:
#   [Environment]::SetEnvironmentVariable("CENIT_PATH", "<ruta al repo CENIT>", "User")
$cenit = $env:CENIT_PATH
if (-not $cenit -or -not (Test-Path (Join-Path $cenit "secrets\load-age-key.ps1"))) {
    throw "No encuentro el repo de CENIT (CENIT_PATH = '$cenit'). Definelo con: [Environment]::SetEnvironmentVariable('CENIT_PATH', '<ruta>', 'User') y abre una consola nueva."
}
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
Set-Location $here
. "$cenit\secrets\load-age-key.ps1"

if ($Down) { $ErrorActionPreference = 'Continue'; docker compose down; $env:SOPS_AGE_KEY = $null; return }

foreach ($f in @("cenit-data.enc.env", "naeth-oidc.enc.env")) {
    foreach ($line in (sops -d (Join-Path $cenit "secrets\$f"))) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { Set-Item -Path ("Env:" + $Matches[1]) -Value $Matches[2] }
    }
}
$env:SOPS_AGE_KEY = $null

# docker compose escribe el progreso del build a stderr; con ErrorActionPreference=Stop (que
# deja load-age-key) PowerShell lo trata como error terminante y aborta. Reset a Continue.
$ErrorActionPreference = 'Continue'
if ($Build) { docker compose up -d --build } else { docker compose up -d }

$env:CENIT_DB_PASSWORD = $null; $env:OIDC_CLIENT_ID = $null; $env:OIDC_CLIENT_SECRET = $null
Write-Host "Naeth (modulo memory) levantado. DSN -> modules-db; auth -> OIDCProxy/Pocket-ID." -ForegroundColor Green
