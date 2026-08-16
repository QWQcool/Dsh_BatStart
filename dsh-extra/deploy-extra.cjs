#!/usr/bin/env node
/**
 * dsh-extra deploy — 一键把「伴侣插件 + 扩展预设 + oh-we-need 全局提示词」装进本地 DSH。
 *
 * 用途：
 *   git clone 后的新机器，或复制文件夹后的新机器，双击 启动DSH网页版.bat 时会自动调用本脚本。
 *   它把仓库 dsh-extra/ 里离线打包的内容部署到本机：
 *     1) presets/  -> <引擎>/config/agent-presets/（8 个扩展预设，含 minimal-win）
 *     2) plugins/  -> ~/.dsh/profiles/web/node_modules/（伴侣插件：插件市场/识图/文件改动追踪等）
 *     3) persona   -> 注入 ~/.dsh/profiles/web/cordis.patch.yml（oh-we-need 全局系统提示词）
 *     4) settings  -> 确保 ~/.dsh/settings.yaml 默认预设为 minimal-win
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
  let n = 0;
  for (const p of fs.readdirSync(src)) {
    const s = path.join(src, p);
    const d = path.join(PRESET_DST, p);
    if (fs.existsSync(d)) continue;
    fs.mkdirSync(d, { recursive: true });
    n += copyDir(s, d);
  }
  const names = fs.readdirSync(src).filter((x) => !x.startsWith("."));
  log("预设已就位: " + names.join(", "));
}

function deployPlugins() {
  const src = path.join(HERE, "plugins");
  if (!fs.existsSync(src)) { warn("plugins 目录不存在，跳过"); return; }
  fs.mkdirSync(PLUGIN_DST, { recursive: true });
  let n = 0;
  for (const p of fs.readdirSync(src)) {
    const s = path.join(src, p);
    const d = path.join(PLUGIN_DST, p);
    if (fs.existsSync(d)) continue;
    fs.mkdirSync(d, { recursive: true });
    n += copyDir(s, d);
  }
  log("伴侣插件已就位 -> " + PLUGIN_DST);
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
  const head = `# Your patch layer for this dsh profile, applied after every bundle layer:\n# a top-level YAML array of loader patch entries (id-targeted config\n# overrides, disables, and insert lists; \`!!js\` expressions allowed).\n`;
  fs.writeFileSync(PATCH_FILE, head + yaml.dump(patch, { lineWidth: -1 }), "utf8");
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
  deployPersona();
  deploySettings();
  log("部署完成 ✓");
}

main();
