# Applies supabase/setup_all.sql to the database in DATABASE_URL (from .env).
# Usage:  powershell -ExecutionPolicy Bypass -File supabase/apply-migrations.ps1
#
# Requires psql (PostgreSQL client). On this machine it is at:
#   C:\Program Files\PostgreSQL\18\bin\psql.exe

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $projectRoot '.env'
$sqlFile = Join-Path $PSScriptRoot 'setup_all.sql'

if (-not (Test-Path $envFile)) { throw "Missing .env at $envFile" }
if (-not (Test-Path $sqlFile)) { throw "Missing $sqlFile - run the generator or copy it in." }

# Read DATABASE_URL from .env (do NOT print it - it contains the DB password)
$dbUrl = $null
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*DATABASE_URL\s*=\s*(.+?)\s*$') { $dbUrl = $Matches[1] }
}
if (-not $dbUrl) { throw 'DATABASE_URL not found in .env' }
if ($dbUrl -match '\[YOUR-PASSWORD\]') { throw 'Replace [YOUR-PASSWORD] in .env with your real database password first.' }

$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) { $psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe' }
if (-not (Test-Path $psql)) { throw "psql not found at $psql" }

Write-Host "Applying $sqlFile ..."
& $psql $dbUrl -v ON_ERROR_STOP=1 -f $sqlFile
if ($LASTEXITCODE -ne 0) { throw "psql exited with code $LASTEXITCODE" }

Write-Host 'Verifying tables ...'
& $psql $dbUrl -v ON_ERROR_STOP=1 -c "select table_name from information_schema.tables where table_schema='public' order by table_name;"
if ($LASTEXITCODE -ne 0) { throw "Verification failed with code $LASTEXITCODE" }

Write-Host 'Done.'
