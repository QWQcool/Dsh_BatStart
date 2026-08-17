@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
:: ============================================================
:: Dsh_BatStart — 一键启动 DeepSeek Harness 网页版（自包含，不依赖 DSH Desktop）
:: 双击即：启动本地服务器 + 在浏览器打开 http://127.0.0.1:3090
:: ============================================================
set "PORT=3090"
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "DSH_BIN=%SCRIPT_DIR%\node_modules\@deepseek-ai\dsh\lib\bin.js"

:: 1) 端口健康检查：已在运行则只开浏览器，不重复启动
set "RUNNING="
for /f "tokens=*" %%a in ('netstat -ano 2^>nul ^| findstr ":3090"') do set "RUNNING=1"
if defined RUNNING (
  echo [Dsh_BatStart] 检测到 %PORT% 已在运行，直接打开浏览器...
  start "" http://127.0.0.1:%PORT%
  goto :eof
)

:: 2) Node 运行时（优先 PATH 中的 node）
set "NODE_EXE="
where node >nul 2>&1 && set "NODE_EXE=node"
if not defined NODE_EXE (
  echo [错误] 未找到 node。请先安装 Node.js (https://nodejs.org) 并确保其在 PATH 中。
  pause
  goto :eof
)

:: 3) 读取同目录 .env（若存在）注入环境变量（含 API Key）
if exist "%SCRIPT_DIR%\.env" (
  echo [Dsh_BatStart] 读取 .env ...
  for /f "usebackq tokens=1,* delims==" %%a in ("%SCRIPT_DIR%\.env") do (
    if not "%%a"=="" if not "%%a:~0,1"=="#" set "%%a=%%b"
  )
)

:: 4) 引擎缺失则自动安装（仅首次，需联网；用国内镜像加速）
if not exist "%DSH_BIN%" (
  echo [Dsh_BatStart] 未找到本地 dsh 引擎，正在自动安装 @deepseek-ai/dsh ...
  pushd "%SCRIPT_DIR%"
  npm install @deepseek-ai/dsh --registry=https://registry.npmmirror.com 2>&1
  popd
)
if not exist "%DSH_BIN%" (
  echo [错误] 引擎安装失败。请检查网络，或手动执行：npm install @deepseek-ai/dsh
  pause
  goto :eof
)

:: 4.5) 部署 dsh-extra（伴侣插件 + 扩展预设 + oh-we-need 全局提示词，幂等）
if exist "%SCRIPT_DIR%\dsh-extra\deploy-extra.cjs" (
  echo [Dsh_BatStart] 部署伴侣插件 / 预设 / 全局提示词 ...
  "%NODE_EXE%" "%SCRIPT_DIR%\dsh-extra\deploy-extra.cjs"
)

:: 5) 启动本地服务器（独立窗口，关闭该窗口即停止服务）
echo [Dsh_BatStart] 正在启动 DSH 网页版（端口 %PORT%）...
start "DSH Web" cmd /k "%NODE_EXE% \"%DSH_BIN%\" web --port %PORT%"

:: 6) 稍候并打开浏览器
timeout /t 4 >nul
start "" http://127.0.0.1:%PORT%
goto :eof
