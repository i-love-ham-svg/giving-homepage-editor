@echo off
setlocal

set "ROOT=%~dp0"
set "EDITOR=%ROOT%outputs\representative-greeting-editor.html"
set "NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "URL=http://127.0.0.1:43185/representative-greeting-editor.html?v=20260803-sacwc-delivery"

if not exist "%EDITOR%" (
  echo Editor file was not found:
  echo %EDITOR%
  pause
  exit /b 1
)

if /I "%~1"=="--file" goto file_open
if /I "%~1"=="--no-open" goto server_no_open
goto server_open

:file_open
start "" "%EDITOR%"
goto done

:server_open
call :start_server
if errorlevel 1 goto failed
start "" "%URL%"
goto done

:server_no_open
call :start_server
if errorlevel 1 goto failed
goto done

:start_server
if exist "%NODE%" (
  "%NODE%" "%ROOT%tools\start-editor-server.mjs" 43185
  exit /b %errorlevel%
)
where node.exe >nul 2>nul
if not errorlevel 1 (
  node.exe "%ROOT%tools\start-editor-server.mjs" 43185
  exit /b %errorlevel%
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%ROOT%tools\start-editor-server.ps1" -Port 43185
exit /b %errorlevel%

:failed
echo Editor server could not be started.
pause
exit /b 1

:done
endlocal
