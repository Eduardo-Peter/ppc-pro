@echo off
setlocal

set "ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%scripts\open-ppc-pro.ps1"
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [PPC-Pro] Falha ao abrir. Pressione qualquer tecla para fechar.
  pause >nul
)

exit /b %EXIT_CODE%
