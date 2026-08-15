# Dsh_BatStart

一键启动 **DeepSeek Harness（DSH）网页版**：双击 `.bat`，即在浏览器打开 DSH 并启动本地服务器。**插件与桌面版（DSH Desktop）完全一致**——同一份引擎、同一份 `~/.dsh` 配置、同样的预设与伴侣插件。

> 公式：`Model + Harness = Agent`。DSH 是 AI 智能体运行框架（对标 Claude Code / Codex），"一切皆插件"（模型 / 工具 / 预设 / 循环均可替换）。

---

## 这是什么 / 不是什么

- **是**：一个启动脚本，调用已安装的 [DSH Desktop](https://github.com/myYangyunfan/dsh_desktop) 引擎，以 `web` 模式在浏览器里跑 DSH。
- **不是**：本仓库**不含**引擎本体、Node、插件或配置（它们由 DSH Desktop 提供）。所以仓库很轻、可公开、可审计。
- 为什么不做成 `.exe`：浏览器版更轻、跨平台、易审查；桌面版独占的原生能力（系统托盘 / 关闭隐藏 / 系统通知 / 自更新等）不在浏览器范畴内——那也是"网页版 vs 桌面版"唯一追不上的差距。

---

## 前置要求（必须）

1. **安装 [DSH Desktop](https://github.com/myYangyunfan/dsh_desktop)**（默认路径 `C:\Program Files\DSH Desktop`）。
   它会写入：引擎、自带 Node、以及 `~/.dsh` 的 `web` profile 与一整套伴侣插件（含插件市场、识图、文件改动追踪等）。
   - 换机器 / 公司机：装好 DSH Desktop 后，把本仓库的 `.bat` 拷过去（或 `git clone`）双击即用。
2. 一个 **DeepSeek API Key**（在 [platform.deepseek.com](https://platform.deepseek.com) 获取）。

---

## 快速开始（人类用户）

1. 双击 `启动DSH网页版.bat`（或同名的 ASCII 备用 `start-dsh-web.bat`）。
2. 脚本会依次：设置 Key → 用 DSH Desktop 自带 Node 启动本地服务器（独立命令行窗口，端口 **3090**）→ 约 4 秒后自动在默认浏览器打开 `http://127.0.0.1:3090`。
3. 若 3090 已被占用（服务已在跑），脚本只打开浏览器、不重复启动。
4. 关闭那个命令行窗口 = 停止服务。

---

## 给 AI 助手的上手说明（他人 `git clone` 后让 AI 跑起来）

如果你是 AI 助手，帮助一位新用户在本机部署，请按以下步骤：

1. **确认已安装 DSH Desktop**（默认路径 `C:\Program Files\DSH Desktop`）。未安装则引导用户去 https://github.com/myYangyunfan/dsh_desktop 下载安装（首次运行会写好 `web` profile 与伴侣插件）。
2. **确认有 DeepSeek API Key**，优先级从高到低：
   - 系统环境变量 `DEEPSEEK_API_KEY`；
   - 仓库根目录 `.env` 写 `DEEPSEEK_API_KEY=sk-xxxx`（已被 `.gitignore` 排除，切勿提交）；
   - 或让用户稍后在 Web UI 的 `设置 → 模型` 里手动填。
3. **双击 `启动DSH网页版.bat`**（或命令行 `cmd /c 启动DSH网页版.bat`）。
4. **验证**：浏览器打开 `http://127.0.0.1:3090` 返回 200，且 `/plugins/zat-dsh-engine/client.js` 可访问（说明插件市场已挂载）。
5. **可选**：按下方"可选插件"配置识图（接智谱免费视觉模型）。

> 不要尝试把引擎/node 打进仓库；本仓库只负责"启动 + 文档"，引擎由 DSH Desktop 提供。

---

## DeepSeek API Key 配置（三选一）

1. **系统环境变量** `DEEPSEEK_API_KEY`（推荐、最安全）。
2. 仓库根目录 **`.env`**：`DEEPSEEK_API_KEY=sk-xxxx`（已 gitignore）。
3. 不配置：启动后到 Web UI `设置 → 模型` 手动填。

> ⚠️ 安全：仓库**绝不**提交任何真实 Key。`.bat` 内无硬编码 Key；`.env` 已被忽略。若你曾把 Key 写进文件，请去 DeepSeek 后台轮换。

---

## 预设（Presets）

DSH 通过 `agent.cordis.yml` 组合插件。`.bat` 默认用 **`minimal-win`** 预设（Windows 极简模式：持久 `bash` + `dsh-tool-pwsh` PowerShell 工具）。

可在 Web UI 的预设切换处选择：`standard` / `code` / `minimal` / `minimal-win` / `router-standard` / `anchored-standard` / `zero-anchored-standard` / `warmupbetter` 等共 12 个（已随桌面版装入）。

---

## 可选插件

### 1. 识图 `dsh-vision` → 接**智谱免费 `glm-4.6v-flash`**（推荐，零本地部署）

`dsh-vision` 已内置，且**默认就指向智谱免费视觉模型**（`baseURL: https://open.bigmodel.cn/api/paas/v4`，`model: glm-4.6v-flash`）。你只需补一个智谱 Key：

1. 注册并创建免费 Key：
   - 国内：[智谱开放平台 open.bigmodel.cn](https://open.bigmodel.cn)（需手机号）；
   - 国际（免国内手机号）：[z.ai](https://api.z.ai)（注册后用国际版地址）。
2. 在 DSH Web UI → `设置` → 找到「**识图插件（view_image）**」分区 → 填：
   - **API 地址**：`https://open.bigmodel.cn/api/paas/v4`（国际版用 `https://api.z.ai/api/paas/v4`）
   - **API 密钥**：你的智谱 Key（也可设环境变量 `ZHIPUAI_API_KEY` / `DSH_VISION_API_KEY`，留空则从环境变量读）
   - **模型**：`glm-4.6v-flash`（默认已填，可改 `glm-4.6v` 等）
3. 之后会话中 agent 调用 `view_image` 工具，即可让纯文本模型"看图"（图片走你配的 VLM，可不出本机若用本地 Ollama）。

**对比本地部署（Ollama + qwen3-vl）**：智谱免费版无需本地 GPU / 模型下载、延迟更低、开箱即用；代价是图片会传到云端（隐私）且并发限制 1。本地桥的地址写法见插件提示（`http://localhost:11434/v1`，密钥留空）。

### 2. 文件改动追踪 `dsh-file-changes`（已装、需用 DSH Desktop 同步）

- 服务端追踪器 + 客户端「文件」面板：列出本会话 agent 改动过的文件（行级 diff），可逐文件或一键还原。
- 已随 DSH Desktop 装入 `web` profile；本仓库维护时确认其 peer 依赖 `zod` 已就位（否则服务端追踪器加载失败，仅 UI 面板可见但无法还原）。
- 用途：手滑"后悔药"，不影响核心使用。

### 3. 插件市场 `zat-dsh-engine`（已挂载）

Web UI 内可直接浏览 / 安装社区插件（数百个）。`~/.dsh/profiles/web` 的 `cordis.patch.yml` 已注入全部伴侣插件。

---

## 端口与故障排查

- 默认端口 **3090**。被占用：改 `.bat` 里的 `--port 3090`，或先停掉占用进程。
- 启动后浏览器没自动开：手动访问 `http://127.0.0.1:3090`。
- 报错 "DSH Desktop 未找到"：确认装在默认路径；或改 `.bat` 里的 `DSH_BIN` / `DSH_NODE` 路径。
- 插件/预设不显示：确认 DSH Desktop 首次运行已同步 `web` profile（`~/.dsh/profiles/web`）。

---

## 目录结构

```
Dsh_BatStart/
├─ 启动DSH网页版.bat      # 主启动脚本（中文名，双击用）
├─ start-dsh-web.bat      # 同名 ASCII 版（备用，防止个别系统对中文文件名双击异常）
├─ README.md              # 本文件
├─ 使用指引.md           # 中文图文上手
├─ .gitignore            # 排除密钥/依赖/本地数据
└─ .npmrc                # 国内 npm 镜像（可选）
```

> 引擎、Node、插件、配置均不在仓库内（由 DSH Desktop 提供），故仓库轻量、可公开。

---

## 工作原理（简述）

`.bat` 本质执行：

```bat
node "<DSH Desktop>\resources\app\node_modules\@deepseek-ai\dsh\lib\bin.js" web --port 3090
```

并把 API Key 注入环境变量、用 DSH Desktop 自带 Node 运行、启动后 `start` 浏览器。`dsh web` = 以 `web` profile 启动，`web` profile 的 `cordis.patch.yml` 注入全部伴侣插件（含插件市场、识图、文件改动追踪等）。
