# Dsh_BatStart

一键启动 **DeepSeek Harness（DSH）网页版**：双击 `.bat`，即在浏览器打开 DSH 并启动本地服务器。**自包含、不依赖 DSH Desktop**——引擎就在本仓库的 `node_modules/` 里。

> 公式：`Model + Harness = Agent`。DSH 是 AI 智能体运行框架（对标 Claude Code / Codex），"一切皆插件"（模型 / 工具 / 预设 / 循环均可替换）。

## 前置要求

1. **Node.js**（在 `PATH` 中）：https://nodejs.org
2. 一个 **DeepSeek API Key**（https://platform.deepseek.com）→ 写入 `.env`（见下）
3. （可选）**智谱 AI Key**（识图插件用，免费视觉模型 `glm-4.6v-flash`）：https://open.bigmodel.cn

> 本仓库已自带 dsh 引擎（`node_modules/@deepseek-ai/dsh`）。若仓库里没有（例如全新 git clone），`.bat` 会在首次运行时自动 `npm install` 拉取。

## 快速开始

1. 把仓库里的 `.env.example` 复制为 `.env`，填入你的 Key：
   - `DEEPSEEK_API_KEY=sk-xxxx`（必填）
   - `ZHIPUAI_API_KEY=你的智谱Key`（选填，开启识图）
2. 双击 `启动DSH网页版.bat`（或同名 ASCII 备用 `start-dsh-web.bat`）。
3. 脚本用仓库自带引擎启动本地服务器（独立窗口，端口 **3090**），约 4 秒后自动打开 `http://127.0.0.1:3090`。
4. 端口已占用则只开浏览器，不重复启动。关闭命令行窗口即停止服务。

## 工作原理（简述）

`.bat` 执行（用 `%~dp0` 定位到仓库内的引擎，脱离具体机器路径）：

    node "<仓库>\node_modules\@deepseek-ai\dsh\lib\bin.js" web --port 3090

引擎 / 插件 / 预设都在仓库内，因此本仓库即可用、可公开、可审计。

## 预设

默认用 `minimal-win`（Windows 极简：持久 bash + PowerShell 工具）。Web UI 可切换 `standard` / `code` / `minimal` / `minimal-win` / `router-standard` 等共 12 个。

## 可选插件

仓库自带的 `web` profile 已包含插件市场、识图、文件改动追踪等伴侣插件，开箱即用，在 Web UI 的 `设置` 中按需启用。识图默认指向智谱免费模型，填入智谱 Key 即可。

## 故障排查

- 默认端口 3090；被占用可改 `.bat` 里的 `--port`。
- 浏览器没自动开：手动访问 `http://127.0.0.1:3090`。
- 报"未找到 node"：安装 Node.js 并确保在 `PATH`。
- 报"引擎安装失败"：检查网络（首次 clone 后需联网自动安装 dsh）。

## License

[MIT](LICENSE)
