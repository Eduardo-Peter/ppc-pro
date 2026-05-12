$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$pidFile = Join-Path $root '.ppc-pro-backend.pid'

function Write-Info {
  param([string]$Message)
  Write-Host "[PPC-Pro] $Message"
}

function Stop-BackendByPid {
  param([int]$ProcessId)
  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
    Stop-Process -Id $process.Id -Force -ErrorAction Stop
    return $true
  } catch {
    return $false
  }
}

$stopped = $false

if (Test-Path $pidFile) {
  $raw = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  $backendPid = 0
  if (-not [string]::IsNullOrWhiteSpace($raw) -and [int]::TryParse($raw.Trim(), [ref]$backendPid)) {
    if (Stop-BackendByPid -ProcessId $backendPid) {
      Write-Info "Backend encerrado (PID $backendPid)."
      $stopped = $true
    }
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
}

if (-not $stopped) {
  $fallback = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
    $_.CommandLine -like '*backend/index.js*' -or $_.CommandLine -like '*backend\\index.js*'
  } | Select-Object -First 1

  if ($fallback) {
    try {
      Stop-Process -Id $fallback.ProcessId -Force -ErrorAction Stop
      Write-Info "Backend encerrado (PID $($fallback.ProcessId))."
      $stopped = $true
    } catch {
      $stopped = $false
    }
  }
}

if (-not $stopped) {
  Write-Info 'Nenhum backend ativo encontrado.'
}
