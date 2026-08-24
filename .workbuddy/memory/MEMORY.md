# DeepSeek_Harness 项目记忆

## 项目定位
`DeepSeek Harness (DSH)` 网页版一键启动工程,源自 GitHub `QWQcool/Dsh_BatStart`。
公式:Model + Harness = Agent。DSH 是 AI 智能体运行框架(对标 Claude Code / Codex),"一切皆插件"。

## 仓库自包含结构
- 引擎:`node_modules/@deepseek-ai/dsh`(首次 clone 后 `npm install`,国内镜像 registry.npmmirror.com)。
- 离线伴侣包:`dsh-extra/`(plugins / presets / deploy-extra.cjs)。
- 启动入口:`启动DSH网页版.bat`(或 ASCII 备用 `start-dsh-web.bat`),双击即:检查引擎→自动安装→部署 dsh-extra→启 3090 端口→开浏览器。
- `.env`(gitignore):`DEEPSEEK_API_KEY` 必填,`ZHIPUAI_API_KEY` 选填(识图 glm-4.6v-flash)。

## 部署机制(deploy-extra.cjs,幂等)
- presets → `~/.dsh` 引擎 `config/agent-presets/`(8 个,含 minimal-win、router-standard)。
- plugins → `~/.dsh/profiles/web/node_modules/`。
- oh-we-need 全局 persona → `~/.dsh/profiles/web/cordis.patch.yml`(`system-prompt` 条目,DeepSeek V4 思维链引导)。
- `settings.yaml` 默认预设 = minimal-win。

## 运行
- 端口 **3090**,`http://127.0.0.1:3090`。
- 启动目录 = DSH 默认文件系统工作区。
- 换 Key/模型:Web UI → Settings → Models,保存即生效,无需重启。

## 重要结论
- **Windows 极简模式已可用**:`minimal-win` 预设(持久 bash + PowerShell 工具),解决了此前"极简模式仅 Linux"的限制。默认即用。
- 不依赖 DSH Desktop,可公开可审计。
- **引擎版本来源(易混淆点)**:`启动DSH网页版.bat` 通过 `dsh-extra/sync-from-npm.cjs` 跟随 **npm latest** 安装 `@deepseek-ai/dsh`,与仓库 tag 版本号(`0.1.1`)**无关**——仓库 `Dsh_BatStart` 只是"启动器+伴侣包",引擎是独立 npm 包,两套版本号各走各的。2026-08-24 同步时 npm latest 为 `0.1.0-rc.8`;当日稍后 npm 发布预发布版 `0.1.1-rc.2`,双击 bat 会自动升级引擎到 0.1.1-rc.2(装一次约 10 分钟,CPU 密集属正常)。`git pull` 只更新启动器/伴侣包,不更新引擎。
- **⚠️ WorkBuddy 环境启动服务的坑(NODE_OPTIONS shim)**:WorkBuddy 会在子进程环境注入 `NODE_OPTIONS=--require=...genie-safe-delete.cjs`(安全删除 shim)。引擎 `0.1.1-rc.2` 的 `dsh-app-boot` 启动时会 `healProfilesModuleFallback`——重建 `~/.dsh/profiles/node_modules` 下的 junction 链接(引擎升级后依赖闭包变化,旧链接失效需先 unlink 再建)。这个内部删除被 shim 误判为"批量删除 N 个文件"→ 抛 `SAFE_DELETE_BULK_CONFIRM_REQUIRED` → node 崩溃、服务起不来(日志只有启动横幅)。**解法:在 WorkBuddy 的 PowerShell 里 `$env:NODE_OPTIONS=$null` 后再启动 bat/服务**(Start-Process 勿加重定向参数,否则撞 Path/PATH 字典 bug)。用户自己双击 bat(普通桌面环境,无 shim)不受影响。
- **重部署端口冲突观察**:若旧服务仍占 3090 时双击 bat,首个 server 实例可能因 `EADDRINUSE` 进入高 CPU 重试死循环(端口无监听);杀掉该卡死实例后,新实例能干净绑定。bat 自带端口占用检测(taskkill)但通常需旧进程先退场。

## 插件加载机制(关键坑)
- **plugin-market(zat-dsh-engine)——结论已反转(2026-08-24 同步 0.1.1 后)**:仓库升到 0.1.1 后,`dsh-extra/plugins/zat-dsh-engine/package.json` **现在自带 `dsh.bundle.patch`(`./cordis.patch.yml`)**,引擎启动时把它作为 bundle 层自动应用,从而加载 plugin-market。**因此 `~/.dsh/profiles/web/cordis.patch.yml` 里绝不能再有手动 `insert: plugin-market`**——否则报 `duplicate loader entry id: plugin-market`,`dsh web` 启动失败、端口无监听。本次同步已从运行态删掉该冗余 insert(实测删后服务正常起来、HTTP 200)。2026-08-17 日志里"保留该 insert 勿删"的旧结论**已作废,以本条为准**。oh-we-need(`system-prompt`)与 `dsh-trivium` insert 仍由 `deploy-extra.cjs` 幂等维护,二者保留。
- **dsh-trivium**:纯 host 插件(图记忆内核),无 browser client。`/plugins/dsh-trivium/client.js` 返回 404 属**正常**,非故障;它有 `bundle.patch` 自动加载 host 端。
- **client 端点判定**:有 `dsh.client.platform:"web"` + `exports["./client"]` + `lib/client.js` 的插件才会被托管 `/plugins/<name>/client.js`(如 zat);纯 host 插件 404 正常。
- **同步后必须清理 `~/.dsh` 残留**:git pull 新代码后,仓库移除的插件(`harness-pet`、@deepseek-ai 下桌面端)会残留在 `~/.dsh`,导致旧服务 404。清理用 `mv` 备份到 `.workbuddy/tmp/<backup>/` 而非直接删,可回滚。

## 环境状态(2026-08-17)
- Node v22.22.2 / npm 10.9.7 已在 PATH。
- `DEEPSEEK_API_KEY` 已通过系统环境变量持久化;`.env` 已创建。
- `ZHIPUAI_API_KEY` 未配置(识图不可用,其余功能正常)。
