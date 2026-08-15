@echo off
chcp 65001 >nul 2>&1
setlocal

:: ============================================================
::  DeepSeek Harness 网页版 · 一键启动
::  双击本文件 = 启动本地服务器 + 在浏览器打开 DSH Web UI
::  插件/预设与桌面版 (DSH Desktop) 完全一致
::  （共用同一份引擎与 ~/.dsh 配置，含 zat-dsh-engine 插件市场）
:: ============================================================

set "DSH_PORT=3090"

:: --- Node 运行时：优先用 DSH Desktop 自带的 node（免装 Node、跨机器可移植），
::     缺失时回退到 WorkBuddy 管理的 node ---
if exist "C:\Program Files\DSH Desktop\resources\node\node.exe" (
  set "NODE_EXE=C:\Program Files\DSH Desktop\resources\node\node.exe"
) else (
  set "NODE_EXE=C:\Users\Administrator\.workbuddy\binaries\node\versions\22.22.2\node.exe"
)

:: --- DSH Desktop 引擎入口（与桌面版同一份，保证插件一致）---
set "DSH_BIN=C:\Program Files\DSH Desktop\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js"

:: --- DeepSeek API Key：优先用系统环境变量；其次读同目录 .env（已被 .gitignore 排除，不会入库）；
::     都没有则在启动后于 Web UI 的 Settings → Models 手动填写。切勿把真实 Key 写死进本文件再提交！---
if not defined DEEPSEEK_API_KEY (
  if exist "%~dp0.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
      if /i "%%A"=="DEEPSEEK_API_KEY" set "DEEPSEEK_API_KEY=%%B"
    )
  )
)

:: --- 健康检查：端口已被占用说明服务已在运行，直接打开浏览器 ---
powershell -NoProfile -Command "try{(Invoke-WebRequest -Uri 'http://127.0.0.1:%DSH_PORT%' -UseBasicParsing -TimeoutSec 3).StatusCode}catch{Write-Host '000'}" > "%TEMP%\dsh_health.txt" 2>nul
set /p DSH_CODE=<"%TEMP%\dsh_health.txt"
if "%DSH_CODE%"=="200" (
  echo [DSH] 端口 %DSH_PORT% 已有服务在运行，直接打开浏览器。
  start http://127.0.0.1:%DSH_PORT%
  goto :end
)

:: --- 校验引擎是否存在 ---
if not exist "%DSH_BIN%" (
  echo [错误] 未找到 DSH Desktop 引擎：
  echo   %DSH_BIN%
  echo.
  echo 请确认已安装 DSH Desktop（pig1et7 打包版）。
  echo 或把 DSH_BIN 改成你本机 node_modules\@deepseek-ai\dsh\lib\bin.js 的路径。
  pause
  goto :end
)

:: --- 启动服务器（独立窗口；关闭该窗口即可停止服务）---
echo [DSH] 正在启动 DeepSeek Harness Web（端口 %DSH_PORT%）...
start "DeepSeek Harness Web" "%NODE_EXE%" "%DSH_BIN%" web --port %DSH_PORT%

:: --- 等待服务就绪后打开浏览器 ---
timeout /t 4 >nul
echo [DSH] 正在打开浏览器 http://127.0.0.1:%DSH_PORT% ...
start http://127.0.0.1:%DSH_PORT%

:end
endlocal
