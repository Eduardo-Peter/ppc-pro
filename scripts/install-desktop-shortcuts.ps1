$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$desktop = [Environment]::GetFolderPath('Desktop')

$openCmd = Join-Path $root 'open-ppc-pro.cmd'
$stopCmd = Join-Path $root 'stop-ppc-pro.cmd'

if (-not (Test-Path $openCmd)) {
  throw "Arquivo nao encontrado: $openCmd"
}
if (-not (Test-Path $stopCmd)) {
  throw "Arquivo nao encontrado: $stopCmd"
}

$wsh = New-Object -ComObject WScript.Shell

$openShortcutPath = Join-Path $desktop 'PPC-Pro.lnk'
$openShortcut = $wsh.CreateShortcut($openShortcutPath)
$openShortcut.TargetPath = $openCmd
$openShortcut.WorkingDirectory = $root
$openShortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
$openShortcut.Save()

$stopShortcutPath = Join-Path $desktop 'PPC-Pro - Stop.lnk'
$stopShortcut = $wsh.CreateShortcut($stopShortcutPath)
$stopShortcut.TargetPath = $stopCmd
$stopShortcut.WorkingDirectory = $root
$stopShortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,132"
$stopShortcut.Save()

Write-Host "[PPC-Pro] Atalhos criados na area de trabalho."
