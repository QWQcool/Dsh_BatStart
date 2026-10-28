# Dsh_BatStart

**官方桌面端为主，本仓库只保留两件事：`dsh-trivium` 记忆插件 + Windows 兜底启动脚本。**

仓库：https://github.com/QWQcool/Dsh_BatStart

> 2026-10 起定位变更：DeepSeek 官方已提供 Windows / macOS 桌面客户端（内置 Node / pnpm / Python 运行时，自带插件管理），
> 原先「一键装引擎 + 起服务 + 开浏览器」的价值已被官方覆盖，本仓库不再重复实现。
> 仅保留官方没有的部分：跨会话记忆插件 `dsh-trivium`，以及无桌面端环境（纯净机、远程、CI）用的 bat 兜底启动。

## 一、主路径：官方桌面端（推荐）

1. 打开 https://www.deepseek.com/harness → **Download Desktop** → Windows (64-bit)
   （直链：`https://download.deepseek.com/desktop/dsh-latest-windows-x64.exe`）
2. 安装并启动。桌面端会自带 `dsh` 运行时，**不需要另装 Node / pnpm**。
3. 桌面端使用独立的 profile：`~/.dsh/profiles/desktop`，与 bat 用的 `web` profile 互不影响。

> ⚠️ 网上自称 "DSH Desktop" 的站点（dsharness.app、deepseekagent.io、各类 GitHub 壳）多为社区项目，
> 有的还内置 `0.1.1-rc.2` 旧内核。**认官方只认 `deepseek.com/harness`。**

已验证事实（0.2.1-rc.3）：

| 项目 | 结果 |
|---|---|
| 内嵌运行时 | Node 24.21.0 / pnpm 11.28.5 / Python 3.12.14 |
| 默认 HTTP 端口 | 不占用（Electron 走 IPC），不会和 bat 的 3090 冲突 |
| profile | `~/.dsh/profiles/desktop`，可编辑 `cordis.patch.yml` |
| 本地路径插件 | 引擎侧支持（`dsh plugin add <目录>` → pnpm `link:`） |
| profile 写入 | **CLI 拒绝**：`profile "desktop" is managed exclusively by the Electron application` |

因此桌面端的插件安装**只能走应用内插件页**（或等插件发布到 npm 后从插件页安装）。

### 版本对齐（2026-10-28）

| 组件 | 版本 | 来源 |
|---|---|---|
| 官方桌面端 | **0.2.1-rc.3** | `download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml`（`channel: nightly`） |
| 桌面端内嵌引擎 | 0.2.1-rc.3 | 随安装包 |
| 兜底 bat 引擎 | **0.2.1-rc.4** | npm `next`（`DSH_CHANNEL=next`） |
| npm `latest` | 0.2.1-rc.2 | 稳定线，落后于桌面端 |

两者同属 `0.2.1` 线；**桌面 feed 比 npm `next` 慢一个补丁**，所以 bat 会略微超前，属预期。
升级桌面端时用应用内更新，或直接装 feed 里的 `deepseek-harness-<ver>-win-x64.exe`。

> ⚠️ 桌面端和 bat 共用 `~/.dsh`。**同一个工作区的 `.dsh/trivium.tdb` 不能被两个进程同时打开**，
> 否则记忆工具会报「数据库已锁定」。二选一：要么用桌面端，要么用 bat，别同时开同一个项目。

## 二、兜底路径：bat 启动（可选）

双击 **`dsh_web.bat`**：

1. 查 npm 的 `DSH_CHANNEL`（默认 **next**，与桌面端同一条线；可改 `latest` / `alpha`）
2. 本机引擎落后则清 `node_modules` 重装，随后把 `package.json` 的依赖版本回写成实际安装版
3. 安装 `dsh-trivium` 到 `~/.dsh/profiles/web`（本机有 `Desktop/dsh-trivium` 源码时用 junction，改动即时生效）
4. 在 **3090** 起服务并打开浏览器

```bat
:: 需要跟 npm latest（当前 0.2.1-rc.2，比 next 的 0.2.1-rc.4 旧）时
set DSH_CHANNEL=latest
dsh_web.bat
```

关掉标题为 `DSH Web` 的窗口即停止服务；3090 被占用会先杀旧进程再启动。

> 早期仓库同时提供中文名与 ASCII 名（`start-dsh-web.bat`）两份内容完全相同的脚本，
> 2026-10 起合并为单个；2026-10-28 更名为 **`dsh_web.bat`**（纯 ASCII，避免中文文件名在部分终端 / CI 下乱码）。

## 三、`dsh-trivium`（唯一保留的插件）

跨会话图记忆：每个工作区一份 `.dsh/trivium.tdb`，四工具 `ctx_find` / `ctx_read` / `ctx_remember` / `ctx_link`，
会话起始注入 ≤400 token 短地图，设置页有「Trivium 记忆」，标题栏可开「芯片 / 会话层」。

### 0.2.x 适配（本仓库源码 `Desktop/dsh-trivium` 已完成）

| 变更 | 说明 |
|---|---|
| 事件 `agent/session-start` → `agent/created` | DSH 0.1.6 起改名。插件现在同时监听两者（带去重集合），否则「待抽取重放 / sidecar 同步 / 情节层尾部」在 0.2.x 上完全不执行 |
| 消息来源 `kind: "plugin"` → `kind: "plugin:dsh-trivium"` | **会话格式 v4 的核心破坏**：v4 不再有共享的 `plugin` kind，第三方生产者必须是 `plugin:<name>` 且删掉 `plugin` 字段。写旧形状会让整轮对话直接失败：`format v4 message requires a producer-owned source kind` |
| peer 范围 `<0.2.0` → `<0.3.0` | 0.2.1 起插件兼容性先看 `engines.dsh`、无则看 peer；旧范围会被安装器和启动器判定为 `incompatible` 并拒载 |
| `webServer` / 工具 / `session/event` / `pre-step` | 0.2.1 上实测不变，路由与客户端注入均正常 |

适配版本 **`dsh-trivium@0.4.21` 已发布到 npm**，兼容 0.2.x；0.4.20 及更早只支持 `<0.2.0`。

实测（0.2.1-rc.2，真实模型调用）：`ctx_remember` 写入成功、会话起始短地图注入 105 tokens、
`compaction/idle` 抽取流水线正常、新会话可跨会话召回。

### 桌面端怎么装这个插件

1. 应用内 **插件** 页 → **添加插件**，输入 `dsh-trivium@0.4.21`，或直接填本地源码目录
   （`C:\Users\<你>\Desktop\dsh-trivium`，界面明确支持本地目录路径）。
2. **关键一步**：桌面端安装只把包写进 `~/.dsh/profiles/desktop/package.json` 的 `dependencies`，
   **不会加进 `dsh.profile.bundles`**，所以重开应用后插件不会挂载（设置里看不到「Trivium 记忆」）。
   需要在该文件的 `dsh.profile.bundles` 数组里补一行 `"dsh-trivium"`：

   ```json
   "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-trivium"]
   ```
3. 重启应用 → 设置左侧应出现 **Trivium 记忆**。该 `bundles` 条目在应用重启后保留。

> 桌面 profile 由 Electron 独占，CLI 会报 `profile "desktop" is managed exclusively by the Electron application`，
> 所以第 2 步只能手改文件，不能用 `dsh plugin` 命令。
>
> 需要绕过兼容性闸门时，官方给了显式豁免：
> `dsh plugin --profile <profile> allow-version <pkg@ver> --dsh-version <ver> --accept-risk`

## 四、已移除的内容（迁移说明）

以下内容曾由本仓库离线分发，现已删除（官方已覆盖或与 0.2.x 不兼容）：

| 移除项 | 原因 |
|---|---|
| `dsh-extra/plugins/`（插件市场、识图、改动追踪、余额、侧边栏增强等 7 个） | 官方插件页 + 索引源「发现」页已覆盖；`zat-dsh-engine` 与官方插件市场重复 |
| `dsh-extra/presets/`（8 个扩展预设） | 官方 Agent Preset 体系已成熟；`minimal-win` 等为旧版补丁 |
| oh-we-need 全局 persona | 个人偏好，不再随仓库注入（`~/.dsh/profiles/web/cordis.patch.yml` 中的旧条目已清除） |
| `deploy-extra.cjs` | 由 `install-trivium.cjs` 取代 |

## 五、故障排查

| 现象 | 处理 |
|---|---|
| 桌面端装了插件但没生效 | 先查 `~/.dsh/profiles/desktop/package.json` 的 `dsh.profile.bundles` 是否含该包；只进 `dependencies` 不会挂载（见「桌面端怎么装这个插件」第 2 步） |
| 对话报 `format v4 message requires a producer-owned source kind` | 插件还在用旧的 `kind: "plugin"` 来源。升级到 `dsh-trivium@0.4.21+` |
| `installation rejected: ... incompatible with dsh` | 插件 peer 范围没覆盖当前引擎。用已适配版，或按提示 `allow-version ... --accept-risk` 显式承担风险 |
| 浏览器显示 `dsh web authentication required` | 必须用带 `?token=` 的链接打开（`dsh-server.log` 里的 `dsh web: http://...` 那一行，token 一次性）。`dsh_web.bat` 已自动读取并打开；手动敲裸地址必然 401 |
| 白屏 / `Failed to load plugins` | Ctrl+F5 强刷；确认没有残留旧插件（`~/.dsh/profiles/<profile>/node_modules` 应只剩需要的包） |
| 升级后旧会话打不开 | 0.1.5 起会话格式 V3 只升不降，当新任务即可 |
| 报「未找到 node」 | 只影响 bat 兜底路径：安装 Node.js 或放到 `%USERPROFILE%\.workbuddy\binaries\node\versions\*\node.exe` |
| bat 引擎安装失败 | 检查网络；脚本按 `DSH_CHANNEL` 查 npmjs，镜像未同步时回退官方源 |

## License

[MIT](LICENSE)
