# Dsh_BatStart

一键启动 **DeepSeek Harness（DSH）网页版**：双击 `.bat`，即在浏览器打开 DSH 并启动本地服务器。**自包含、不依赖 DSH Desktop**——引擎就在本仓库的 `node_modules/` 里（缺失或落后于脚本钉住的 `0.1.0-rc.8` 时 `.bat` 自动 `npm install`）。

> 公式：`Model + Harness = Agent`。DSH 是 AI 智能体运行框架（对标 Claude Code / Codex），"一切皆插件"（模型 / 工具 / 预设 / 循环均可替换）。

## 前置要求

1. **Node.js**（在 `PATH` 中）：https://nodejs.org
2. 一个 **DeepSeek API Key**（https://platform.deepseek.com）→ 写入 `.env`（见下）
3. （可选）**智谱 AI Key**（识图插件用，免费视觉模型 `glm-4.6v-flash`）：https://open.bigmodel.cn

## 快速开始

1. 把仓库里的 `.env.example` 复制为 `.env`，填入你的 Key：
   - `DEEPSEEK_API_KEY=sk-xxxx`（必填）
   - `ZHIPUAI_API_KEY=你的智谱Key`（选填，开启识图）
2. 双击 `启动DSH网页版.bat`（或同名 ASCII 备用 `start-dsh-web.bat`）。
3. 脚本依次：检查引擎（缺失或版本落后则安装/升级到 `0.1.0-rc.8`）→ **部署 `dsh-extra`（伴侣插件 + 扩展预设 + 全局提示词，并装上自制的跨会话记忆 `dsh-trivium`）** → 启动本地服务器（独立窗口，端口 **3090**）→ 约 4 秒后自动打开 `http://127.0.0.1:3090`。
4. 端口已占用则只开浏览器，不重复启动。关闭命令行窗口即停止服务。

> 新机器（git clone 后）首次双击会联网安装引擎；安装与部署均为幂等，可反复运行。

## dsh-extra：离线插件 / 预设 / 全局提示词

`dsh-extra/` 把「桌面版多出来的东西」打包进仓库，`.bat` 第一次跑会部署到本机 `~/.dsh`。

| 目录/文件 | 内容 | 部署到哪 |
|---|---|---|
| `dsh-extra/plugins/` | 插件市场、识图、文件改动追踪、余额、侧边栏增强等 | `~/.dsh/profiles/web/node_modules/` |
| `dsh-extra/presets/` | 8 个扩展预设（含 Windows 极简 `minimal-win`、`router-standard` 等） | 引擎 `config/agent-presets/` |
| `dsh-extra/deploy-extra.cjs` | 部署脚本，跑过的会跳过 | — |
| **全局提示词** | **oh-we-need**（DeepSeek V4 思维链引导，`we need to ...` 句式）写入 web profile 的 `system-prompt.persona` | 每次会话全局生效 |

所以：**clone 后双击 `.bat` = 完整版**，不用另装 DSH Desktop，也不用再手动加记忆插件。识图、侧边栏这些在设置里按需开；识图默认用智谱免费模型，填 Key 即可。设置里会出现「Trivium 记忆」。

### oh-we-need 全局提示词

来源：[scp3500/oh-we-need](https://github.com/scp3500/oh-we-need)（MIT）。它把 DeepSeek V4 的内部思维链引导成「可执行、第一人称、任务分型」风格（核心句式 `we need to ...`），作为**部署级 persona** 注入：

- 位置：`~/.dsh/profiles/web/cordis.patch.yml` → `system-prompt` 插件的 `config.persona`
- 生效范围：所有会话、所有预设（agent 级 persona 未设置时即用此全局默认）
- 想改/关闭：编辑该文件的 `persona` 字段，或删除对应条目后重启；再次运行 `.bat` 会按仓库里 `deploy-extra.cjs` 的默认内容重新注入（修改 `deploy-extra.cjs` 中的 `OH_WE_NEED_PERSONA` 即可自定义）。

## 工作原理（简述）

`.bat` 执行（用 `%~dp0` 定位到仓库内的引擎，脱离具体机器路径）：

    node "<仓库>\node_modules\@deepseek-ai\dsh\lib\bin.js" web --port 3090

引擎在本仓库 `node_modules`，伴侣插件和预设在 `dsh-extra`。跨会话记忆 `dsh-trivium` 是另一个仓库，启动时按普通 DSH 插件装进本机 web profile。

## 预设

默认用 `minimal-win`（Windows 极简：rc.8 起为持久 PowerShell PTY + 编辑器）。Web UI 可切换 `standard` / `code`（界面名 **PTC 模式**）/ `minimal` / `minimal-win` / `router-standard` 等共 12 个（4 个官方 + 8 个来自 `dsh-extra/presets`）。

## 自带：跨会话记忆

启动时会装上自制插件 [dsh-trivium@0.4.1](https://www.npmjs.com/package/dsh-trivium)。每个工作区一个 `.dsh/trivium.tdb`，关掉窗口再开，项目约定还在。设置里会出现「Trivium 记忆」，会话标题栏「对话 / 轨迹」旁会出现「会话图」。本机若有 `Desktop/dsh-trivium` 源码则 junction 联调；否则从 npm 安装，已装的旧版会升到 `0.4.1`（适配 DSH `0.1.0-rc.8`）。

识图、侧边栏那些是可选的；记忆插件不是。

## 可选插件

`dsh-extra/plugins` 部署后，设置里可按需打开：插件市场、识图（`view_image`，默认智谱 `glm-4.6v-flash`）、文件改动追踪、余额、侧边栏增强。

## 故障排查

- 默认端口 3090；被占用可改 `.bat` 里的 `--port`。
- 浏览器没自动开：手动访问 `http://127.0.0.1:3090`。
- 报"未找到 node"：安装 Node.js 并确保在 `PATH`。
- 报"引擎安装失败"：检查网络（首次 clone 或升级引擎时需联网安装 `@deepseek-ai/dsh@0.1.0-rc.8`）。
- **升级 rc.8**：官方 SQLite 会话存储格式不兼容旧版，本地历史会话可能无法沿用；当新任务即可。
- 全局提示词没生效：确认 `.bat` 输出了 `[Dsh_BatStart] 部署伴侣插件...` 且 `deploy-extra.cjs` 无报错；检查 `~/.dsh/profiles/web/cordis.patch.yml` 是否含 `system-prompt` 条目。

## License

[MIT](LICENSE)
