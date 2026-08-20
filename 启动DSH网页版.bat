@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
set "PORT=3090"
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "DSH_BIN=%SCRIPT_DIR%\node_modules\@deepseek-ai\dsh\lib\bin.js"

:: 1) port check: if 3090 is occupied, kill the existing process and restart
::    with the latest config. This prevents stale services from serving
::    deleted plugins (e.g. harness-pet) after a config change.
set "RUNNING="
for /f "tokens=*" %%a in ('netstat -ano 2^>nul ^| findstr ":3090"') do set "RUNNING=1"
if defined RUNNING (
  curl -s -m 2 http://127.0.0.1:%PORT%/ >nul 2>&1
  if not errorlevel 1 (
    echo [Dsh_BatStart] port %PORT% has an existing service. Restarting to load the latest config.
  ) else (
    echo [Dsh_BatStart] port %PORT% is occupied but NOT responding. Removing stale process.
  )
  for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3090" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%p >nul 2>&1
  )
  ping -n 3 127.0.0.1 >nul
)

:: 2) locate node and resolve to full path of node.exe
set "NODE_EXE="
for /f "tokens=*" %%x in ('where node 2^>nul') do (
  if not defined NODE_EXE set "NODE_EXE=%%x"
)
if not defined NODE_EXE (
  for /d %%d in ("%USERPROFILE%\.workbuddy\binaries\node\versions\*") do (
    if exist "%%d\node.exe" set "NODE_EXE=%%d\node.exe"
  )
)
if not defined NODE_EXE (
  for /d %%d in ("%LOCALAPPDATA%\Programs\*") do (
    if exist "%%d\node.exe" set "NODE_EXE=%%d\node.exe"
  )
)
if not defined NODE_EXE (
  if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
)
if not defined NODE_EXE (
  echo [ERROR] node not found. Install Node.js or place node.exe at:
  echo   %USERPROFILE%\.workbuddy\binaries\node\versions\YOURVER\node.exe
  echo   %ProgramFiles%\nodejs\node.exe
  pause
  goto :eof
)
echo [Dsh_BatStart] Using Node: %NODE_EXE%

:: 3) load .env (API keys etc.) if present
if exist "%SCRIPT_DIR%\.env" (
  echo [Dsh_BatStart] loading .env
  for /f "usebackq tokens=1,* delims==" %%a in ("%SCRIPT_DIR%\.env") do (
    if not "%%a"=="" if not "%%a:~0,1"=="#" set "%%a=%%b"
  )
)

:: 4) install engine if missing (first run, needs network; npmmirror)
if not exist "%DSH_BIN%" (
  echo [Dsh_BatStart] dsh engine not found, installing @deepseek-ai/dsh
  pushd "%SCRIPT_DIR%"
  "%NODE_EXE%" -v >nul 2>&1
  npm install @deepseek-ai/dsh --registry=https://registry.npmmirror.com 2>&1
  popd
)
if not exist "%DSH_BIN%" (
  echo [ERROR] engine install failed. Check network or run: npm install @deepseek-ai/dsh
  pause
  goto :eof
)

:: 4.5) deploy dsh-extra (companion plugins / presets / oh-we-need / dsh-trivium, idempotent)
if exist "%SCRIPT_DIR%\dsh-extra\deploy-extra.cjs" (
  echo [Dsh_BatStart] deploying companion plugins / presets / global prompt / dsh-trivium
  "%NODE_EXE%" "%SCRIPT_DIR%\dsh-extra\deploy-extra.cjs"
)

:: 5) start server in a new window; its output is logged to dsh-server.log
echo [Dsh_BatStart] starting DSH web on port %PORT%
set "SERVER_LOG=%SCRIPT_DIR%\dsh-server.log"
if exist "%SERVER_LOG%" del "%SERVER_LOG%"
start "DSH Web" cmd /c ""%NODE_EXE%" "%DSH_BIN%" web --port %PORT% > "%SERVER_LOG%" 2>&1"

:: 6) wait, then self-check the port and open browser
echo [Dsh_BatStart] waiting for server to start
ping -n 7 127.0.0.1 >nul
set "UP="
netstat -ano 2>nul | findstr ":3090" >nul && set "UP=1"
if not defined UP (
  ping -n 4 127.0.0.1 >nul
  netstat -ano 2>nul | findstr ":3090" >nul && set "UP=1"
)
start "" "http://127.0.0.1:%PORT%"
echo.
echo [Dsh_BatStart] ============================================
if defined UP (
  echo  Service is UP and listening on port %PORT%. Browser opened.
) else (
  echo  WARNING: port %PORT% is NOT listening yet.
  echo  The server window may have failed to start.
  echo  Check dsh-server.log in this folder and send its content for help.
)
echo  The server window title is DSH Web. Close it to stop the service.
echo [Dsh_BatStart] ============================================
echo Press any key to close this window. The server window keeps running.
pause >nul
goto :eof
