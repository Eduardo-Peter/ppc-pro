param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pidFile = Join-Path $root '.ppc-pro-backend.pid'
$setupFlag = Join-Path $root '.ppc-pro-initialized'
$dbPath = Join-Path $root 'backend\prisma\dev.db'
$outLog = Join-Path $root 'tmp_backend_out.log'
$errLog = Join-Path $root 'tmp_backend_err.log'

function Write-Info {
  param([string]$Message)
  Write-Host "[PPC-Pro] $Message"
}

function Test-BackendHealth {
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/health' -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

function Get-PidFromFile {
  if (-not (Test-Path $pidFile)) { return $null }
  $raw = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
  $parsed = 0
  if ([int]::TryParse($raw.Trim(), [ref]$parsed)) {
    return $parsed
  }
  return $null
}

function Is-ProcessRunning {
  param([int]$ProcessId)
  try {
    $null = Get-Process -Id $ProcessId -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

function Open-App {
  if ($NoBrowser) { return }
  Start-Process 'http://localhost:3000'
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js nao encontrado. Instale Node.js 18+ para usar o launcher."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm nao encontrado. Reinstale Node.js e tente novamente."
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Info 'Primeira execucao: instalando dependencias (npm install)...'
  Push-Location $root
  try {
    npm install
    if ($LASTEXITCODE -ne 0) { throw "Falha no npm install." }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $setupFlag)) {
  $dbAlreadyExisted = Test-Path $dbPath
  Write-Info 'Primeira configuracao: preparando banco de dados...'
  Push-Location $root
  try {
    npm run db:generate
    if ($LASTEXITCODE -ne 0) { throw "Falha no db:generate." }

    npm run db:push
    if ($LASTEXITCODE -ne 0) { throw "Falha no db:push." }

    if (-not $dbAlreadyExisted) {
      Write-Info 'Carregando dados iniciais (db:seed)...'
      npm run db:seed
      if ($LASTEXITCODE -ne 0) { throw "Falha no db:seed." }
    }
  } finally {
    Pop-Location
  }
  Set-Content -Path $setupFlag -Value (Get-Date -Format 's') -Encoding ASCII
}

if (Test-BackendHealth) {
  Write-Info 'Sistema ja esta em execucao.'
  Open-App
  exit 0
}

$existingPid = Get-PidFromFile
if ($existingPid -and (Is-ProcessRunning -ProcessId $existingPid)) {
  Write-Info "Backend em PID $existingPid sem resposta de health. Reiniciando..."
  Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 700
}

Write-Info 'Iniciando backend em segundo plano...'
$process = Start-Process `
  -FilePath 'node' `
  -ArgumentList 'backend/index.js' `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -PassThru

Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII

for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 1
  if (Test-BackendHealth) {
    Write-Info 'Backend pronto.'
    Open-App
    exit 0
  }
}

Write-Host ''
Write-Host '[PPC-Pro] Erro: backend nao ficou pronto a tempo.' -ForegroundColor Red
if (Test-Path $errLog) {
  Write-Host '[PPC-Pro] Ultimas linhas do log de erro:' -ForegroundColor Yellow
  Get-Content $errLog -Tail 20
}
exit 1
