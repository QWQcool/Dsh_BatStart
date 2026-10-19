#!/usr/bin/env node
/**
 * dsh-trivium installer for the `web` profile (bat fallback path).
 *
 * The official desktop client owns its own `desktop` profile, so this script
 * only prepares the profile the bat launcher boots:
 *
 *   1) dsh-trivium -> ~/.dsh/profiles/web/node_modules/
 *      - local checkout (Desktop/dsh-trivium) is junctioned when present, so
 *        edits are live; otherwise the npm latest release is installed
 *   2) cordis.patch.yml -> insert the dsh-trivium loader entry
 *
 * The repo no longer ships companion plugins, presets or a global persona.
 * Idempotent: safe to run on every launch.
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const HERE = __dirname;                       // <repo>/dsh-extra
const REPO = path.dirname(HERE);              // <repo>
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
const ENGINE_DIR = path.join(REPO, "node_modules", "@deepseek-ai", "dsh");
const PROFILE_WEB = path.join(DSH_HOME, "profiles", "web");
const PLUGIN_DST = path.join(PROFILE_WEB, "node_modules");
const PATCH_FILE = path.join(PROFILE_WEB, "cordis.patch.yml");
const { viewVersion, viewVersionFrom, registryUrl, npmInstall } = require("./npm-registry.cjs");

const TRIVIUM_PKG = "dsh-trivium";
// First release that speaks session format v4 (producer-owned message sources)
// and listens to agent/created; older builds break every turn on 0.2.x.
const TRIVIUM_FALLBACK = "0.4.21";

const PATCH_HEAD = `# Your patch layer for this dsh profile, applied after every bundle layer:\n# a top-level YAML array of loader patch entries (id-targeted config\n# overrides, disables, and insert lists; \`!!js\` expressions allowed).\n`;

const yaml = require(path.join(HERE, "lib", "js-yaml"));

function log(msg) { console.log("[trivium] " + msg); }
function warn(msg) { console.warn("[trivium][warn] " + msg); }

function readPkgVersion(pkgFile) {
  try {
    return String(JSON.parse(fs.readFileSync(pkgFile, "utf8")).version || "");
  } catch {
    return "";
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

function installNpmTrivium(dst, version) {
  log("正在 npm 安装 " + TRIVIUM_PKG + "@" + version);
  const inst = npmInstall(
    ["install", TRIVIUM_PKG + "@" + version, "--save", "--no-audit", "--no-fund", "--legacy-peer-deps"],
    { cwd: PROFILE_WEB }
  );
  if (!inst.ok) {
    const r = inst.result;
    warn("npm 安装 dsh-trivium 失败: " + String((r && (r.stderr || r.stdout)) || "unknown").slice(0, 800));
    return false;
  }
  log("安装源 " + inst.registry);
  if (!fs.existsSync(path.join(dst, "package.json"))) {
    warn("npm 安装后仍找不到 " + path.join(dst, "package.json"));
    return false;
  }
  log(TRIVIUM_PKG + "@" + version + " 已安装 -> " + dst);
  return true;
}

function hostPeerDir(name) {
  const rel = String(name).split("/");
  const candidates = [
    path.join(REPO, "node_modules", ...rel),
    path.join(PLUGIN_DST, ...rel),
    path.join(DSH_HOME, "profiles", "node_modules", ...rel),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "package.json"))) return dir;
  }
  return null;
}

function removeLinkOrTree(target) {
  try { fs.lstatSync(target); } catch { return; }
  if (isLink(target)) {
    try { fs.rmdirSync(target); } catch { try { fs.unlinkSync(target); } catch { /* ignore */ } }
    return;
  }
  fs.rmSync(target, { recursive: true, force: true });
}

function junctionPeer(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (isLink(to)) {
    try {
      if (fs.readlinkSync(to) === from) return true;
    } catch { /* recreate */ }
    removeLinkOrTree(to);
  } else if (fs.existsSync(path.join(to, "package.json"))) {
    removeLinkOrTree(to);
  } else if (fs.existsSync(to)) {
    warn("拒绝覆盖非 junction 路径 " + to);
    return false;
  }
  try {
    fs.symlinkSync(from, to, process.platform === "win32" ? "junction" : "dir");
    return true;
  } catch (e) {
    warn("junction peer 失败 " + to + ": " + e.message);
    return false;
  }
}

/**
 * Local source junction must share the host's dsh-llm / dsh-tools instances
 * (BlockAssembler instanceof). npm-installed copies resolve from the host and
 * are left untouched.
 */
function ensureTriviumPeerDeps(dir) {
  const real = fs.realpathSync(dir);
  const sibling = siblingTrivium();
  if (!sibling || path.resolve(real) !== path.resolve(sibling)) {
    log("dsh-trivium 为 npm 包，peer 走宿主，不嵌套补装");
    return true;
  }
  let peers = {};
  try {
    peers = JSON.parse(fs.readFileSync(path.join(real, "package.json"), "utf8")).peerDependencies || {};
  } catch (e) {
    warn("读取 dsh-trivium peerDependencies 失败，跳过校验: " + e.message);
    return true;
  }
  let ok = true;
  for (const name of Object.keys(peers)) {
    const from = hostPeerDir(name);
    const to = path.join(real, "node_modules", name);
    if (!from) {
      warn("宿主找不到 peer " + name + "，启动可能缺模块");
      ok = false;
      continue;
    }
    if (!junctionPeer(from, to)) ok = false;
    else log("peer " + name + " -> " + from);
  }
  return ok;
}

function ensureTriviumPackage() {
  const dst = path.join(PLUGIN_DST, TRIVIUM_PKG);
  const pkgFile = path.join(dst, "package.json");
  fs.mkdirSync(PLUGIN_DST, { recursive: true });
  const fromNpm = forceTriviumFromNpm();
  const sibling = siblingTrivium();
  let ok = false;

  if (!fromNpm && sibling) {
    if (fs.existsSync(pkgFile) && isLink(dst)) {
      const have = readPkgVersion(pkgFile);
      log("dsh-trivium 已 junction -> 本地源码（" + have + "）");
      ok = true;
    } else {
      if (fs.existsSync(pkgFile)) removeLinkOrTree(dst);
      try {
        fs.symlinkSync(sibling, dst, process.platform === "win32" ? "junction" : "dir");
        log("dsh-trivium 已 junction -> " + sibling);
        ok = true;
      } catch (e) {
        warn("junction dsh-trivium 失败，改从 npm 安装: " + e.message);
      }
    }
  }

  if (!ok) {
    const want = resolveTriviumWant();
    if (fs.existsSync(pkgFile) && readPkgVersion(pkgFile) === want && !isLink(dst)) {
      log("dsh-trivium@" + want + " 已是 npm latest，跳过安装");
      ok = true;
    } else {
      ok = installNpmTrivium(dst, want);
    }
  }

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
  // Only the profile patch insert is used. The package also ships a
  // bundle.patch; mounting both raises duplicate id: dsh-trivium.
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
  fs.writeFileSync(PATCH_FILE, PATCH_HEAD + yaml.dump(patch, { lineWidth: -1 }), "utf8");
  log("dsh-trivium 已 insert 到 " + PATCH_FILE);
}

function engineVersion() {
  return readPkgVersion(path.join(ENGINE_DIR, "package.json"));
}

function reportIncompatiblePeers() {
  const pkg = path.join(PLUGIN_DST, TRIVIUM_PKG, "package.json");
  const engine = engineVersion();
  if (!engine) return;
  let peers = {};
  try { peers = JSON.parse(fs.readFileSync(pkg, "utf8")).peerDependencies || {}; }
  catch { return; }
  const minor = engine.split(".").slice(0, 2).join(".");
  const ranges = Object.values(peers).join(" ");
  if (minor === "0.2" && /<\s*0\.2\.0/.test(ranges) && !/>=\s*0\.1\.1-rc\.2\s*<0\.3\.0/.test(ranges)) {
    warn("已装的 dsh-trivium 声明只兼容 <0.2.0，而引擎是 " + engine
      + "：宿主会拒载该插件。用本地源码 junction（启动脚本自动做），或升级到已适配 0.2.x 的 dsh-trivium。");
  }
}

function main() {
  log("准备 web profile（DSH_HOME=" + DSH_HOME + "）...");
  const ok = ensureTriviumPackage();
  if (ok) ensureTriviumInsert();
  reportIncompatiblePeers();
  const ver = readPkgVersion(path.join(PLUGIN_DST, TRIVIUM_PKG, "package.json"));
  log("—— 已挂载插件 ——");
  log("  insert  dsh-trivium (" + TRIVIUM_PKG + ")" + (ver ? " @" + ver : "  MISSING on disk"));
  if (engineVersion()) log("  引擎    @deepseek-ai/dsh@" + engineVersion());
  log(ok ? "完成 ✓" : "未完成（记忆插件不可用，其余启动流程不受影响）");
}

main();
