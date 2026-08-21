"use strict";
/**
 * npm registry helpers for BatStart.
 *
 * Installs still prefer the repo .npmrc (npmmirror, faster in CN). Version
 * checks use registry.npmjs.org first so a just-published package is visible
 * before the mirror catches up; install falls back to npmjs.org on ETARGET.
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const REPO = path.dirname(__dirname);
const OFFICIAL = "https://registry.npmjs.org";

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function registryUrl() {
  try {
    const txt = fs.readFileSync(path.join(REPO, ".npmrc"), "utf8");
    const m = txt.match(/^\s*registry\s*=\s*(\S+)/m);
    if (m) return m[1].replace(/\/$/, "");
  } catch { /* no .npmrc */ }
  return "https://registry.npmmirror.com";
}

function installRegistries() {
  const out = [];
  const configured = registryUrl();
  if (configured) out.push(configured);
  if (!out.includes(OFFICIAL)) out.push(OFFICIAL);
  return out;
}

function parseVersionStdout(stdout, status) {
  if (status !== 0) return "";
  const lines = String(stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return [...lines].reverse().find((s) => /^[0-9]/.test(s)) || "";
}

function viewVersionFrom(registry, pkg, timeoutMs) {
  const r = cp.spawnSync(
    npmCmd(),
    ["view", pkg, "version", "--registry=" + registry],
    {
      cwd: REPO,
      encoding: "utf8",
      timeout: timeoutMs || 15000,
      shell: process.platform === "win32",
      windowsHide: true,
    }
  );
  return parseVersionStdout(r.stdout, r.status);
}

/**
 * dist-tag `latest`. Prefers npmjs.org so a freshly published version is not
 * missed while npmmirror is still stale.
 */
function viewVersion(pkg, timeoutMs) {
  const t = timeoutMs || 15000;
  const official = viewVersionFrom(OFFICIAL, pkg, t);
  const configured = registryUrl();
  if (!official) return viewVersionFrom(configured, pkg, t);
  return official;
}

function npmInstall(args, opts) {
  const spawnOpts = {
    encoding: "utf8",
    shell: process.platform === "win32",
    windowsHide: true,
    ...opts,
  };
  if (opts && Object.prototype.hasOwnProperty.call(opts, "shell")) {
    spawnOpts.shell = opts.shell;
  }
  let last = null;
  for (const reg of installRegistries()) {
    const r = cp.spawnSync(npmCmd(), [...args, "--registry=" + reg], spawnOpts);
    last = r;
    if (r.status === 0) return { ok: true, registry: reg, result: r };
  }
  return { ok: false, registry: null, result: last };
}

module.exports = {
  OFFICIAL,
  REPO,
  registryUrl,
  installRegistries,
  viewVersion,
  viewVersionFrom,
  npmInstall,
};
