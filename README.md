# Dsh_BatStart

一键启动 **DeepSeek Harness（DSH）网页版**：双击 `.bat`，即在浏览器打开 DSH 并启动本地服务器。插件与桌面版（DSH Desktop）完全一致——同一份引擎、同一份 `~/.dsh` 配置、同样的预设与伴侣插件。

> 公式：`Model + Harness = Agent`。DSH 是 AI 智能体运行框架（对标 Claude Code / Codex），"一切皆插件"（模型 / 工具 / 预设 / 循环均可替换）。

## 前置要求

1. 安装 [DSH Desktop](https://github.com/myYangyunfan/dsh_desktop)（默认路径 `C:\Program Files\DSH Desktop`）。
2. 一个 DeepSeek API Key（[platform.deepseek.com](https://platform.deepseek.com)）。

## 快速开始

1. 双击 `启动DSH网页版.bat`（或同名 ASCII 备用 `start-dsh-web.bat`）。
2. 脚本用 DSH Desktop 自带 Node 启动本地服务器（独立窗口，端口 **3090**），约 4 秒后自动打开 `http://127.0.0.1:3090`。
3. 端口已占用则只开浏览器、不重复启动。关闭命令行窗口即停止服务。

## DeepSeek API Key（三选一，按优先级）

1. 系统环境变量 `DEEPSEEK_API_KEY`（推荐）。
2. 仓库根目录 `.env`：`DEEPSEEK_API_KEY=sk-xxxx`（已 gitignore，切勿提交）。
3. 不配置：启动后到 Web UI `设置 → 模型` 手动填。

> ⚠️ 仓库绝不提交任何真实 Key。`.bat` 内无硬编码 Key。

## 预设

默认用 `minimal-win`（Windows 极简：持久 bash + PowerShell 工具）。Web UI 可切换 `standard` / `code` / `minimal` / `minimal-win` / `router-standard` 等共 12 个（随桌面版装入）。

## 可选插件

DSH Desktop 自带插件市场、识图、文件改动追踪等伴侣插件，开箱即用，在 Web UI 的 `设置` 中按需启用。高级配置步骤见本仓库的本地笔记（不入库）。

## 故障排查

- 默认端口 3090；被占用可改 `.bat` 里的 `--port`。
- 浏览器没自动开：手动访问 `http://127.0.0.1:3090`。
- 报 "DSH Desktop 未找到"：确认装在默认路径，或改 `.bat` 里的 `DSH_BIN` / `DSH_NODE`。

## 文件

```
Dsh_BatStart/
├─ 启动DSH网页版.bat   # 主启动脚本（双击用）
├─ start-dsh-web.bat   # ASCII 同名备用
├─ README.md           # 本文件
├─ 使用指引.md        # 中文上手
├─ .gitignore
└─ .npmrc              # 国内 npm 镜像（可选）
```

> 引擎 / Node / 插件 / 配置均由 DSH Desktop 提供，本仓库只负责启动 + 文档，因此轻量、可公开、可审计。

## 工作原理

`.bat` 执行（用 DSH Desktop 自带 Node）：

```bat
node "<DSH Desktop>\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js" web --port 3090
```

并把 API Key 注入环境变量、启动后 `start` 浏览器。`dsh web` = 以 `web` profile 启动，该 profile 的 `cordis.patch.yml` 注入全部伴侣插件。

## License

[MIT](LICENSE)
