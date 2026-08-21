# Dsh_BatStart

一键启动 **DeepSeek Harness（DSH）网页版**：双击 `.bat`，浏览器打开本地服务。**自包含、不依赖 DSH Desktop**。

引擎 **不进 git**。每次启动向 **npmjs.org** 查询 [`@deepseek-ai/dsh`](https://www.npmjs.com/package/@deepseek-ai/dsh) 的 `latest`，本机落后则自动升级（国内镜像未同步时回退到 npmjs 安装）。别人 clone 后同样直接跟 npm，不必等本仓库先推一版。

当前引擎线是 **0.1.1 预览**（含官方 **Flash Vision**）。仓库里的 `package.json` 只记录你本机刚装上的版本，方便拥有者 git 提交；克隆用户仍自己查 npm。

> 公式：`Model + Harness = Agent`。DSH 是 AI 智能体运行框架（对标 Claude Code / Codex），「一切皆插件」（模型 / 工具 / 预设 / 循环均可替换）。

仓库：https://github.com/QWQcool/Dsh_BatStart

## 前置要求

1. **Node.js**（在 `PATH` 中）：https://nodejs.org
2. 一个 **DeepSeek API Key**（https://platform.deepseek.com）→ 写入 `.env`
3. （可选）**智谱 AI Key**（外部识图插件用，免费视觉模型 `glm-4.6v-flash`）：https://open.bigmodel.cn

## 快速开始

1. 把 `.env.example` 复制为 `.env`，填入 Key：
   - `DEEPSEEK_API_KEY=sk-xxxx`（必填）
   - `ZHIPUAI_API_KEY=你的智谱Key`（选填，开启外部识图）
2. 双击 `启动DSH网页版.bat`（或 ASCII 备用 `start-dsh-web.bat`）。
3. 脚本依次：查 npm 引擎 `latest`（落后则清 `node_modules` 重装）→ 部署 `dsh-extra`（伴侣插件 + 预设 + 全局提示词 + 记忆插件 `dsh-trivium`）并打印已挂载插件 → 在 **3090** 起服务 → 打开 `http://127.0.0.1:3090`。
4. 端口已被占用时会**杀掉旧进程再启动**（避免还在跑已删插件的旧服务）。关掉标题为 `DSH Web` 的窗口即停止服务。

> 新机器（git clone 后）首次双击会联网装引擎。可反复运行。

## 模型与识图

- **对话 / 编码**：设置 → Models 里选官方 DeepSeek 模型；只配 `DEEPSEEK_API_KEY` 即可聊。
- **官方 Flash Vision**（0.1.1+）：模型选择器里的 `DeepSeek-V4-Flash-Vision-Exp`。聊天里**粘贴 / 附件**图片直接进对话，走 DSH 原生多模态。
- **外部识图插件**（可选）：设置里的 `view_image`，默认智谱 `glm-4.6v-flash`。给本地路径、URL、或纯文本模型看图用。

两条路**同时保留**，不会互相卸载。

## dsh-extra：伴侣插件 / 预设 / 全局提示词

`dsh-extra/` 把桌面版多出来的能力打进仓库，每次启动部署到本机 `~/.dsh`（插件目录会刷新，不是「有了就跳过」）。

| 目录/文件 | 内容 | 部署到哪 |
|---|---|---|
| `dsh-extra/plugins/` | 插件市场、识图、文件改动追踪、余额、侧边栏增强等 | `~/.dsh/profiles/web/node_modules/` |
| `dsh-extra/presets/` | 8 个扩展预设（含 Windows 极简 `minimal-win`、`router-standard` 等） | 引擎 `config/agent-presets/` |
| `dsh-extra/sync-from-npm.cjs` | 每次启动跟 npm 升引擎 | — |
| `dsh-extra/deploy-extra.cjs` | 部署伴侣内容 + 打印已挂载插件 | — |
| **全局提示词** | **oh-we-need**（DeepSeek V4 思维链引导，`we need to ...`）写入 `system-prompt.persona` | 每次会话全局生效 |

**clone 后双击 `.bat` = 完整版**，不用另装 DSH Desktop。伴侣插件已按 **0.1.1 网页客户端**改过（不再引用已删除的 `@deepseek-ai/dsh-client-web-react`），避免白屏 `Failed to load plugins`。

### oh-we-need 全局提示词

来源：[scp3500/oh-we-need](https://github.com/scp3500/oh-we-need)（MIT）。作为部署级 persona 注入：

- 位置：`~/.dsh/profiles/web/cordis.patch.yml` → `system-prompt` 的 `config.persona`
- 范围：所有会话、所有预设（agent 级 persona 未设时用此默认）
- 想改/关闭：改该文件，或改 `deploy-extra.cjs` 里的 `OH_WE_NEED_PERSONA` 后重新双击

## 工作原理（简述）

```
node "<仓库>\node_modules\@deepseek-ai\dsh\lib\bin.js" web --port 3090
```

引擎在本仓库 `node_modules`，伴侣插件和预设在 `dsh-extra`。跨会话记忆 [dsh-trivium](https://www.npmjs.com/package/dsh-trivium) 是另一个仓库，启动时按普通 DSH 插件装进本机 web profile。

## 预设

默认 `minimal-win`（Windows 极简：rc.8 起为持久 PowerShell PTY + 编辑器）。Web UI 可切换 `standard` / `code`（界面名 **PTC 模式**）/ `minimal` / `minimal-win` / `router-standard` 等共 12 个（4 个官方 + 8 个来自 `dsh-extra/presets`）。

## 自带：跨会话记忆

启动时安装 [dsh-trivium](https://www.npmjs.com/package/dsh-trivium)（跟 npm latest）。本机若有 `Desktop/dsh-trivium` 源码则 **junction** 过去，方便改插件后立刻跑测；没有该文件夹的用户只走 npm。每个工作区一个 `.dsh/trivium.tdb`。设置里会出现「Trivium 记忆」，标题栏「对话 / 轨迹」旁会出现「会话图」。

识图、侧边栏是可选的；记忆插件会默认装上。

## 可选插件

设置里可按需打开：插件市场、识图（外部 `view_image`）、文件改动追踪、余额、侧边栏增强。

## 故障排查

- 默认端口 3090；被占用会先杀再启。可改 `.bat` 里的 `--port`。
- 浏览器没自动开：手动访问 `http://127.0.0.1:3090`。
- 报「未找到 node」：安装 Node.js 并确保在 `PATH`。
- 报「引擎安装失败」：检查网络。跟的是 npmjs 上的 `@deepseek-ai/dsh` / `dsh-trivium` `latest`。升级引擎会清掉 `node_modules` 再装（原地 upgrade 会卡住）。
- **白屏 Failed to load plugins**：先 **Ctrl+F5** 强刷，避免缓存旧 `client.js`。本仓库伴侣插件已适配 0.1.1；侧边栏若仍等上游更新，不挡主界面。
- **升级预览版**：rc.8 起官方 SQLite 会话格式不兼容旧版，升引擎后旧历史可能打不开，当新任务即可。
- 全局提示词没生效：确认 `.bat` 跑过 `deploy-extra.cjs`；检查 `~/.dsh/profiles/web/cordis.patch.yml` 是否含 `system-prompt`。
- `Cannot find package '@deepseek-ai/dsh-llm'`（来自 `Desktop/dsh-trivium`）：本地源码缺 peer。脚本会自动补装；也可：
  `cd Desktop/dsh-trivium && npm install --no-save --include=peer --legacy-peer-deps=false`

## License

[MIT](LICENSE)
