@echo off
setlocal

set "ROOT=%~dp0"
set "EDITOR=%ROOT%outputs\representative-greeting-editor.html"
set "NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "URL=http://127.0.0.1:4185/representative-greeting-editor.html?v=20260725-server-restored"

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
if not exist "%NODE%" (
  echo Editor runtime was not found.
  exit /b 1
)
"%NODE%" "%ROOT%tools\start-editor-server.mjs" 4185
exit /b %errorlevel%

:failed
echo Editor server could not be started.
pause
exit /b 1

:done
endlocal