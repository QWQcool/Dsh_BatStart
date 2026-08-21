#!/usr/bin/env node
/**
 * dsh-extra deploy — 一键把「伴侣插件 + 扩展预设 + oh-we-need 全局提示词」装进本地 DSH。
 *
 * 用途：
 *   git clone 后的新机器，或复制文件夹后的新机器，双击 启动DSH网页版.bat 时会自动调用本脚本。
 *   它把仓库 dsh-extra/ 里离线打包的内容部署到本机，并挂上自制记忆插件：
 *     1) presets/  -> <引擎>/config/agent-presets/（8 个扩展预设，含 minimal-win）
 *     2) plugins/  -> ~/.dsh/profiles/web/node_modules/（伴侣插件：插件市场/识图/文件改动追踪等）
 *     3) dsh-trivium -> ~/.dsh/profiles/web/node_modules/（跟 npm latest；本机若有 Desktop/dsh-trivium 源码则 junction）
 *     4) persona   -> 注入 ~/.dsh/profiles/web/cordis.patch.yml（oh-we-need 全局系统提示词）
 *     5) settings  -> 确保 ~/.dsh/settings.yaml 默认预设为 minimal-win
 * 全部幂等：已存在的内容跳过，可反复运行。
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const cp = require("child_process");

const HERE = __dirname;                       // <repo>/dsh-extra
const REPO = path.dirname(HERE);              // <repo>
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
const ENGINE_DIR = path.join(REPO, "node_modules", "@deepseek-ai", "dsh");
const PROFILE_WEB = path.join(DSH_HOME, "profiles", "web");
const PLUGIN_DST = path.join(PROFILE_WEB, "node_modules");
const PRESET_DST = path.join(ENGINE_DIR, "config", "agent-presets");
const PATCH_FILE = path.join(PROFILE_WEB, "cordis.patch.yml");
const SETTINGS_FILE = path.join(DSH_HOME, "settings.yaml");
const { viewVersion, viewVersionFrom, registryUrl, npmInstall } = require("./npm-registry.cjs");
const TRIVIUM_PKG = "dsh-trivium";
const TRIVIUM_FALLBACK = "0.4.3";
let TRIVIUM_VERSION = TRIVIUM_FALLBACK;
const PATCH_HEAD = `# Your patch layer for this dsh profile, applied after every bundle layer:\n# a top-level YAML array of loader patch entries (id-targeted config\n# overrides, disables, and insert lists; \`!!js\` expressions allowed).\n`;

// 自包含：从 dsh-extra/lib 加载 js-yaml（不依赖仓库 node_modules 是否已安装）
const yaml = require(path.join(HERE, "lib", "js-yaml"));

// oh-we-need：DeepSeek V4 思维链引导（we need to 句式），注入为部署级全局 persona
const OH_WE_NEED_PERSONA = `You are a helpful software engineer assistant. We need to follow this style for all internal reasoning (chain-of-thought):

1. **\`we need to ...\` / \`we need ...\` is the core pattern.** Either can open any sentence, not only the first. We need one concrete action per sentence.
2. **Interleave modal verbs:** I'll (next action) · I can (viable option) · I need (what must be done) · I should (what ought to be done) · I will (committed step) · I'm / I am (what I am about to do).
3. **Avoid \`let me ...\`.** We need to prefer \`we need to ...\` / \`we need ...\` for opening steps.
4. **Short and colloquial.** We need one sentence per step, decision-level summaries only, we / I perspective.
5. **Classify every task first.** We need to pick a stable end: build (produce, verify, fix) · fix (read, locate, minimal change, verify) · weak (classify first, then build or fix).
6. **Think tag.** We need each reasoning step written inside the thinking tag: \`<think>we need to ...</think>\`. Never output \`<think>\` tags or reasoning text in the final reply.
7. **Scope.** We need this to shape reasoning only. Final replies follow the user's language and tone.`;

function log(msg) { console.log("[dsh-extra] " + msg); }
function warn(msg) { console.warn("[dsh-extra][warn] " + msg); }

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const ent of fs.readdirSync(src)) {
    const s = path.join(src, ent);
    const d = path.join(dst, ent);
    // 跳过 .bin 等符号链接目录，避免复制失效链接
    if (ent === ".bin" || ent.endsWith(".link")) continue;
    const st = fs.lstatSync(s);
    if (st.isSymbolicLink()) {
      const target = fs.readlinkSync(s);
      try { fs.symlinkSync(target, d); n++; } catch (e) { /* already exists or no perm */ }
    } else if (st.isDirectory()) {
      n += copyDir(s, d);
    } else {
      if (!fs.existsSync(d)) { fs.copyFileSync(s, d); n++; }
    }
  }
  return n;
}

function deployPresets() {
  const src = path.join(HERE, "presets");
  if (!fs.existsSync(src)) { warn("presets 目录不存在，跳过"); return; }
  fs.mkdirSync(PRESET_DST, { recursive: true });
  // Extra presets are owned by this repo: always refresh into the engine so
  // engine upgrades pick up composition changes (e.g. rc.8 persistent pwsh).
  for (const p of fs.readdirSync(src)) {
    if (p.startsWith(".")) continue;
    const s = path.join(src, p);
    const d = path.join(PRESET_DST, p);
    fs.cpSync(s, d, { recursive: true, force: true });
  }
  const names = fs.readdirSync(src).filter((x) => !x.startsWith("."));
  log("预设已就位: " + names.join(", "));
}

function deployPlugins() {
  const src = path.join(HERE, "plugins");
  if (!fs.existsSync(src)) { warn("plugins 目录不存在，跳过"); return; }
  fs.mkdirSync(PLUGIN_DST, { recursive: true });
  // Companion plugins are owned by this repo: always refresh so vision prompt
  // / sidebar / market copies in ~/.dsh pick up warehouse edits. Skip .bin
  // and junctioned local checkouts (e.g. dsh-trivium) which are not in src.
  for (const p of fs.readdirSync(src)) {
    if (p.startsWith(".")) continue;
    const s = path.join(src, p);
    const d = path.join(PLUGIN_DST, p);
    fs.cpSync(s, d, { recursive: true, force: true });
  }
  const names = fs.readdirSync(src).filter((x) => !x.startsWith("."));
  log("伴侣插件已刷新: " + names.join(", ") + " -> " + PLUGIN_DST);
}

function deployPersona() {
  fs.mkdirSync(PROFILE_WEB, { recursive: true });
  // 幂等标记：persona 正文中的唯一子串（文本本身不含 "oh-we-need"）
  const MARK = "We need to follow this style for all internal reasoning";
  let patch = [];
  if (fs.existsSync(PATCH_FILE)) {
    try { patch = yaml.load(fs.readFileSync(PATCH_FILE, "utf8")) || []; }
    catch (e) { warn("解析 cordis.patch.yml 失败（保留原文，跳过 persona 注入）: " + e.message); return; }
  }
  patch = patch || [];
  // 先清理可能残留的重复 system-prompt 条目（保留最后一个）
  const seen = new Set();
  const dedup = [];
  for (const p of patch) {
    if (p && p.id === "system-prompt") {
      if (seen.has("system-prompt")) continue; // 重复的旧条目丢弃
      seen.add("system-prompt");
    }
    dedup.push(p);
  }
  patch = dedup;
  // 幂等：已有 persona 覆盖则跳过
  const has = patch.some((p) => p && p.id === "system-prompt" && p.config && String(p.config.persona || "").includes(MARK));
  if (!has) {
    patch.push({
      id: "system-prompt",
      name: "@deepseek-ai/dsh-system-prompt",
      config: { persona: OH_WE_NEED_PERSONA },
    });
    log("persona（oh-we-need）已注入 " + PATCH_FILE);
  } else {
    log("persona（oh-we-need）已注入，跳过");
  }
  // 无论是否追加，都把（去重后的）结果写回，避免历史重复条目残留
  writePatch(patch);
}

// 2026-08-18 停用（main 已不再调用）：zat-dsh-engine 的 package.json 声明了
// dsh.bundle.patch（./cordis.patch.yml），引擎启动时会自动把它作为 bundle 层应用
// （include plugin-market）。若再把同一 patch 合并进 web profile，会触发
// duplicate loader entry id: plugin-market，导致 dsh web 启动失败、端口无监听。
function deployPluginPatches() {
  // 离线伴侣插件往往自带 cordis.patch.yml（用于向 Loader 注册自己），
  // 但 deployPlugins() 只复制目录，不会把插件级 patch 合并进 web profile。
  // 这里以插件市场 zat-dsh-engine 为例做幂等合并；其它插件如需自动启用可类推。
  const pluginPatchFiles = [
    { plugin: "zat-dsh-engine", file: path.join(HERE, "plugins", "zat-dsh-engine", "cordis.patch.yml") }
  ];
  if (!fs.existsSync(PATCH_FILE)) return;
  let patch = [];
  try { patch = yaml.load(fs.readFileSync(PATCH_FILE, "utf8")) || []; }
  catch (e) { warn("解析 cordis.patch.yml 失败，跳过插件 patch 合并: " + e.message); return; }
  patch = patch || [];
  let changed = false;
  for (const { plugin, file } of pluginPatchFiles) {
    if (!fs.existsSync(file)) continue;
    let pp = [];
    try { pp = yaml.load(fs.readFileSync(file, "utf8")) || []; }
    catch (e) { warn(`解析 ${plugin} 的 cordis.patch.yml 失败，跳过: ${e.message}`); continue; }
    for (const item of pp) {
      if (!item) continue;
      if (item.insert && Array.isArray(item.insert)) {
        let targetInsert = patch.find((p) => p && p.insert && Array.isArray(p.insert));
        if (!targetInsert) {
          targetInsert = { insert: [] };
          patch.push(targetInsert);
        }
        for (const row of item.insert) {
          if (row && row.id && !targetInsert.insert.some((r) => r && r.id === row.id)) {
            targetInsert.insert.push(row);
            log(`${plugin} 的 insert(${row.id}) 已合并到 web profile`);
            changed = true;
          }
        }
      } else if (item.id && !patch.some((p) => p && p.id === item.id)) {
        patch.push(item);
        log(`${plugin} 的 patch 条目(${item.id}) 已合并到 web profile`);
        changed = true;
      }
    }
  }
  if (changed) {
    writePatch(patch);
  }
}

function isLink(p) {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; }
}

function siblingTrivium() {
  const candidates = [
    path.join(os.homedir(), "Desktop", "dsh-trivium"),
    path.join(REPO, "..", "dsh-trivium"),
  ];
  const seen = new Set();
  for (const dir of candidates) {
    const key = path.resolve(dir);
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      if (pkg && pkg.name === TRIVIUM_PKG) return dir;
    } catch {
      // not a plugin checkout
    }
  }
  return null;
}

function writePatch(patch) {
  fs.writeFileSync(PATCH_FILE, PATCH_HEAD + yaml.dump(patch, { lineWidth: -1 }), "utf8");
}

function readPkgVersion(pkgFile) {
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
    return String(pkg && pkg.version || "");
  } catch {
    return "";
  }
}

function versionBehind(have, want) {
  const a = String(have || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const b = String(want || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] || 0;
    const y = b[i] || 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

function forceTriviumFromNpm() {
  return /^(1|true|yes)$/i.test(String(process.env.DSH_TRIVIUM_FROM_NPM || ""));
}

function resolveTriviumWant() {
  const v = viewVersion(TRIVIUM_PKG, 12000);
  if (v) {
    const mirror = viewVersionFrom(registryUrl(), TRIVIUM_PKG, 8000);
    if (mirror && mirror !== v) {
      log("npmjs latest " + TRIVIUM_PKG + " = " + v + "（镜像仍是 " + mirror + "，安装时会回退到 npmjs.org）");
    } else {
      log("npm latest " + TRIVIUM_PKG + " = " + v);
    }
    return v;
  }
  warn("npm view " + TRIVIUM_PKG + " 失败，回退 " + TRIVIUM_FALLBACK);
  return TRIVIUM_FALLBACK;
}

function installNpmTrivium(dst) {
  log("正在 npm 安装 " + TRIVIUM_PKG + "@" + TRIVIUM_VERSION);
  const inst = npmInstall(
    ["install", TRIVIUM_PKG + "@" + TRIVIUM_VERSION, "--save", "--no-audit", "--no-fund", "--legacy-peer-deps"],
    { cwd: PROFILE_WEB }
  );
  if (!inst.ok) {
    const r = inst.result;
    warn("npm 安装 dsh-trivium 失败: " + String((r && (r.stderr || r.stdout)) || "unknown").slice(0, 800));
    return false;
  }
  log("安装源 " + inst.registry);
  const pkgFile = path.join(dst, "package.json");
  if (!fs.existsSync(pkgFile)) {
    warn("npm 安装 dsh-trivium 后仍找不到 " + pkgFile);
    return false;
  }
  log("dsh-trivium@" + TRIVIUM_VERSION + " 已安装 -> " + dst);
  return true;
}

// dsh-trivium 通过 junction 直连本地源码时，源码文件夹必须自带 peer 依赖
// （@deepseek-ai/dsh-llm / @deepseek-ai/dsh-tools 等）。若源码 .npmrc 有
// omit=peer / legacy-peer-deps=true，node_modules/@deepseek-ai 会是空的，
// DSH 启动加载插件树时直接 ERR_MODULE_NOT_FOUND 崩溃。这里校验缺失并自动补装。
function ensureTriviumPeerDeps(dir) {
  const real = fs.realpathSync(dir);
  let peers = {};
  try {
    peers = JSON.parse(fs.readFileSync(path.join(real, "package.json"), "utf8")).peerDependencies || {};
  } catch (e) {
    warn("读取 dsh-trivium peerDependencies 失败，跳过校验: " + e.message);
    return true;
  }
  const specs = Object.entries(peers).map(([name, ver]) => name + "@" + ver);
  if (!specs.length) return true;
  const missing = specs.filter((spec) => {
    const name = spec.lastIndexOf("@") > 0 ? spec.slice(0, spec.lastIndexOf("@")) : spec;
    return !fs.existsSync(path.join(real, "node_modules", name, "package.json"));
  });
  if (!missing.length) {
    log("dsh-trivium peer 依赖齐全（" + specs.join(", ") + "）");
    return true;
  }
  log("dsh-trivium 缺 peer 依赖，正在补装: " + missing.join(", "));
  const inst = npmInstall(
    ["install", "--no-save", "--include=peer", "--legacy-peer-deps=false", ...missing],
    { cwd: real, shell: false }
  );
  if (!inst.ok) {
    const r = inst.result;
    warn("补装 dsh-trivium peer 依赖失败: " + String((r && (r.stderr || r.stdout)) || "unknown").slice(0, 800));
    return false;
  }
  log("dsh-trivium peer 依赖已补装（" + missing.join(", ") + "）");
  return true;
}

function ensureTriviumPackage() {
  const dst = path.join(PLUGIN_DST, TRIVIUM_PKG);
  const pkgFile = path.join(dst, "package.json");
  fs.mkdirSync(PLUGIN_DST, { recursive: true });
  const fromNpm = forceTriviumFromNpm();

  let ok = false;
  if (fs.existsSync(pkgFile) && isLink(dst) && !fromNpm) {
    const have = readPkgVersion(pkgFile);
    if (have !== TRIVIUM_VERSION) {
      log("dsh-trivium 已 junction -> 本地源码（" + have + "），npm latest 是 " + TRIVIUM_VERSION + "；本机走源码不改。其他使用者没有 Desktop/dsh-trivium 时会跟 npm");
    } else {
      log("dsh-trivium 已 junction -> 本地源码（" + have + "），与 npm latest 一致，跳过 npm");
    }
    ok = true;
  } else if (fromNpm && fs.existsSync(pkgFile) && isLink(dst)) {
    const sibling = siblingTrivium();
    try { fs.rmdirSync(dst); } catch (e) { warn("无法拆掉 trivium junction: " + e.message); }
    log("DSH_TRIVIUM_FROM_NPM=1，改为从 npm 安装");
    ok = installNpmTrivium(dst);
    if (!ok && sibling) {
      try {
        fs.symlinkSync(sibling, dst, process.platform === "win32" ? "junction" : "dir");
        warn("npm 安装失败，已恢复 junction -> " + sibling);
        ok = true;
      } catch (e) {
        warn("恢复 junction 也失败: " + e.message);
      }
    }
  } else if (fs.existsSync(pkgFile)) {
    const have = readPkgVersion(pkgFile);
    if (have === TRIVIUM_VERSION) {
      log("dsh-trivium@" + have + " 已是 npm latest，跳过安装");
      ok = true;
    } else {
      log("dsh-trivium@" + have + " 与 npm latest " + TRIVIUM_VERSION + " 不同，改为 npm 安装");
      ok = installNpmTrivium(dst);
    }
  } else {
    const sibling = siblingTrivium();
    if (!fromNpm && sibling) {
      try {
        fs.symlinkSync(sibling, dst, process.platform === "win32" ? "junction" : "dir");
        log("dsh-trivium 已 junction -> " + sibling);
        ok = true;
      } catch (e) {
        warn("junction dsh-trivium 失败，改从 npm 安装: " + e.message);
        ok = installNpmTrivium(dst);
      }
    } else {
      if (fromNpm) log("DSH_TRIVIUM_FROM_NPM=1，从 npm 安装（不 junction 本地源码）");
      ok = installNpmTrivium(dst);
      if (!ok && sibling) {
        try {
          fs.symlinkSync(sibling, dst, process.platform === "win32" ? "junction" : "dir");
          warn("npm 安装失败，已恢复 junction -> " + sibling);
          ok = true;
        } catch (e) {
          warn("恢复 junction 也失败: " + e.message);
        }
      }
    }
  }

  // 无论 junction 还是 npm 路径，都校验/补装 peer 依赖，防止启动崩溃
  if (ok) ensureTriviumPeerDeps(dst);
  return ok;
}

function ensureTriviumInsert() {
  fs.mkdirSync(PROFILE_WEB, { recursive: true });
  let patch = [];
  if (fs.existsSync(PATCH_FILE)) {
    try { patch = yaml.load(fs.readFileSync(PATCH_FILE, "utf8")) || []; }
    catch (e) { warn("解析 cordis.patch.yml 失败，跳过 dsh-trivium insert: " + e.message); return; }
  }
  patch = patch || [];
  const already = patch.some((p) => p && Array.isArray(p.insert) && p.insert.some((r) => r && r.id === "dsh-trivium"));
  if (already) {
    log("dsh-trivium 已挂到 Loader，跳过 insert");
    return;
  }
  // 只用 profile patch 的 insert，不写入 dsh.profile.bundles。
  // 包自带 bundle.patch；两边同时挂会 duplicate id: dsh-trivium。
  let targetInsert = patch.find((p) => p && Array.isArray(p.insert));
  if (!targetInsert) {
    targetInsert = { insert: [] };
    patch.push(targetInsert);
  }
  targetInsert.insert.push({
    id: "dsh-trivium",
    name: "dsh-trivium",
    config: {
      autoRecall: false,
      extractEnabled: true,
      writeApproval: false,
      mapTokenBudget: 400,
      expandDepth: 1,
      topK: 8,
    },
  });
  writePatch(patch);
  log("dsh-trivium 已 insert 到 " + PATCH_FILE);
}

function deployTrivium() {
  TRIVIUM_VERSION = resolveTriviumWant();
  if (!ensureTriviumPackage()) return;
  ensureTriviumInsert();
}

function pkgOnDisk(name) {
  const rel = String(name).split("/");
  const candidates = [
    path.join(PLUGIN_DST, ...rel, "package.json"),
    path.join(REPO, "node_modules", ...rel, "package.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function reportLoadedPlugins() {
  log("—— 已挂载插件 ——");
  let bundles = [];
  try {
    bundles = JSON.parse(fs.readFileSync(path.join(PROFILE_WEB, "package.json"), "utf8")).dsh?.profile?.bundles || [];
  } catch { /* no profile yet */ }
  for (const name of bundles) {
    if (String(name).startsWith("@deepseek-ai/dsh-base") || String(name).startsWith("@deepseek-ai/dsh-web-app")) continue;
    const ver = readPkgVersion(pkgOnDisk(name));
    log("  bundle  " + name + (ver ? " @" + ver : "  MISSING on disk"));
  }
  let patch = [];
  try { patch = yaml.load(fs.readFileSync(PATCH_FILE, "utf8")) || []; } catch { /* none */ }
  const seen = new Set();
  for (const p of patch) {
    if (!p || !Array.isArray(p.insert)) continue;
    for (const row of p.insert) {
      if (!row || !row.name || seen.has(row.id || row.name)) continue;
      seen.add(row.id || row.name);
      const ver = readPkgVersion(pkgOnDisk(row.name));
      log("  insert  " + (row.id || "?") + " (" + row.name + ")" + (ver ? " @" + ver : "  MISSING on disk"));
    }
  }
  const slotsInject = path.join(PLUGIN_DST, "dsh-better-sidebar", "package.json");
  try {
    const inj = JSON.parse(fs.readFileSync(slotsInject, "utf8")).dsh?.client?.inject || [];
    if (inj.includes("@deepseek-ai/dsh-client-ui-slots")) {
      const have = fs.existsSync(path.join(REPO, "node_modules", "@deepseek-ai", "dsh-client-ui-slots", "package.json"));
      if (!have) {
        warn("dsh-better-sidebar 仍 inject @deepseek-ai/dsh-client-ui-slots，当前引擎未带此包（等插件作者适配 0.1.1，不阻止启动）");
      }
    }
  } catch { /* sidebar not deployed */ }
}

function deploySettings() {
  fs.mkdirSync(DSH_HOME, { recursive: true });
  let cfg = {};
  if (fs.existsSync(SETTINGS_FILE)) {
    try { cfg = yaml.load(fs.readFileSync(SETTINGS_FILE, "utf8")) || {}; } catch (e) { warn("解析 settings.yaml 失败: " + e.message); }
  }
  if (!cfg["agent-presets"]) cfg["agent-presets"] = {};
  if (cfg["agent-presets"].default !== "minimal-win") {
    cfg["agent-presets"].default = "minimal-win";
    fs.writeFileSync(SETTINGS_FILE, yaml.dump(cfg, { lineWidth: -1 }), "utf8");
    log("默认预设已设为 minimal-win");
  } else {
    log("默认预设已是 minimal-win，跳过");
  }
}

function main() {
  log("开始部署（目标 DSH_HOME=" + DSH_HOME + "）...");
  deployPresets();
  deployPlugins();
  deployTrivium();
  deployPersona();
  deploySettings();
  reportLoadedPlugins();
  log("部署完成 ✓");
}

main();
