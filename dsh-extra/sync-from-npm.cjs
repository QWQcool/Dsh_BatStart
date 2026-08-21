#!/usr/bin/env node
/**
 * Follow npm on every BatStart launch.
 *
 * Queries dist-tag `latest` for @deepseek-ai/dsh (what `npm install @deepseek-ai/dsh`
 * would install). If local node_modules differs, wipes node_modules and reinstalls
 * that exact version — in-place upgrades of this monorepo hang on peer resolution.
 *
 * Also rewrites the repo package.json dependency to the installed version so the
 * owner can `git add package.json` when they want the remote to record it.
 * Other machines do not wait for that commit: they hit npm themselves next start.
 *
 * Offline / npm down: keep the existing engine and continue (exit 0 if it exists).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { registryUrl, viewVersion, viewVersionFrom, npmInstall, REPO } = require("./npm-registry.cjs");

const PKG = "@deepseek-ai/dsh";
const DSH_DIR = path.join(REPO, "node_modules", "@deepseek-ai", "dsh");
const DSH_BIN = path.join(DSH_DIR, "lib", "bin.js");
const PKG_JSON = path.join(REPO, "package.json");

function log(msg) { console.log("[dsh-sync] " + msg); }
function warn(msg) { console.warn("[dsh-sync][warn] " + msg); }

function localVersion() {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(DSH_DIR, "package.json"), "utf8")).version || "");
  } catch {
    return "";
  }
}

function engineOk() {
  return fs.existsSync(DSH_BIN);
}

function writePackageJson(version) {
  let pkg = {
    name: "dsh-batstart",
    private: true,
    description: "One-click DeepSeek Harness web launcher (Windows). Engine version is synced from npm on each start.",
    license: "MIT",
    dependencies: {},
  };
  try { pkg = { ...pkg, ...JSON.parse(fs.readFileSync(PKG_JSON, "utf8")) }; } catch { /* first run */ }
  pkg.dependencies = pkg.dependencies || {};
  if (pkg.dependencies[PKG] === version) return;
  pkg.dependencies[PKG] = version;
  fs.writeFileSync(PKG_JSON, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  log("package.json -> " + PKG + "@" + version + " (owner can git commit this; other clones still query npm themselves)");
}

function installEngine(version) {
  log("npm install " + PKG + "@" + version);
  const inst = npmInstall(
    ["install", PKG + "@" + version, "--no-audit", "--no-fund"],
    { cwd: REPO, stdio: "inherit" }
  );
  if (inst.ok) log("安装源 " + inst.registry);
  return inst.ok && engineOk();
}

function cleanNodeModules() {
  const dir = path.join(REPO, "node_modules");
  const lock = path.join(REPO, "package-lock.json");
  log("removing node_modules for a clean install (in-place upgrades hang on this package graph)");
  try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); }
  catch (e) { warn("could not fully remove node_modules: " + e.message); }
  try { if (fs.existsSync(lock)) fs.unlinkSync(lock); } catch { /* ignore */ }
}

function main() {
  const have = localVersion();
  log("local " + PKG + " = " + (have || "(missing)"));

  const want = viewVersion(PKG, 15000);
  if (!want) {
    warn("npm view failed (offline?). Keep local engine.");
    if (!engineOk()) {
      warn("no local engine either. First run needs network.");
      process.exit(1);
    }
    process.exit(0);
  }
  const mirror = viewVersionFrom(registryUrl(), PKG, 8000);
  if (mirror && mirror !== want) {
    log("npmjs latest " + PKG + " = " + want + " (mirror still " + mirror + ")");
  } else {
    log("npm latest " + PKG + " = " + want);
  }

  if (have === want && engineOk()) {
    log("engine up to date");
    writePackageJson(want);
    process.exit(0);
  }

  if (have) log("upgrading " + have + " -> " + want);
  else log("installing first copy " + want);

  if (have && have !== want) cleanNodeModules();
  if (!installEngine(want)) {
    warn("npm install failed");
    if (!engineOk()) process.exit(1);
    warn("previous engine still present; starting with " + (localVersion() || have));
    process.exit(0);
  }
  writePackageJson(want);
  log("engine ready " + PKG + "@" + localVersion());
}

main();
