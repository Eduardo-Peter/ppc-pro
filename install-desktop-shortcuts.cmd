@echo off
setlocal

set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\install-desktop-shortcuts.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [PPC-Pro] Falha ao criar atalhos. Pressione qualquer tecla para fechar.
  pause >nul
)

exit /b %EXIT_CODE%
