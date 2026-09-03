#!/usr/bin/env node
// 智汇AI (IHUI AI) 桌面端 — 条件构建前端产物 (tauri beforeBuildCommand)
// 根治打包慢问题:tauri build 每次强制重跑整份前端(882 页)是耗时主因。
// 本脚本按需构建:仅当 web/out 缺失,或 web 源码比产物更新时,才执行前端静态导出;
// 否则直接跳过(仅打包 Tauri 配置/Rust 增量,通常几秒内完成)。
// 强制重建:FORCE_FRONTEND_BUILD=1 node scripts/ensure-web-out.mjs
import { existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, '..'); // apps/desktop
const webRoot = path.resolve(desktopRoot, '../web'); // apps/web
const outDir = path.join(webRoot, 'out');
const outProbe = path.join(outDir, 'index.html');

// 扫描时跳过的超大/非源码目录
const EXCLUDE = new Set(['node_modules', '.next', '.git', '.turbo', 'out']);

function newestMtime(root) {
  if (!existsSync(root)) return 0;
  let max = 0;
  const stack = [root];
  while (stack.length) {
    const cur = stack.pop();
    let st;
    try { st = statSync(cur); } catch { continue; }
    if (st.isDirectory()) {
      if (EXCLUDE.has(path.basename(cur))) continue;
      let ents;
      try { ents = readdirSync(cur, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) stack.push(path.join(cur, e.name));
    } else if (st.isFile() && st.mtimeMs > max) {
      max = st.mtimeMs;
    }
  }
  return max;
}

function rootFileMtime(...names) {
  let max = 0;
  for (const n of names) {
    const p = path.join(webRoot, n);
    if (existsSync(p)) max = Math.max(max, statSync(p).mtimeMs);
  }
  return max;
}

function shouldBuild() {
  if (process.env.TAURI_SKIP_FRONTEND === '1') {
    console.log('[desktop] TAURI_SKIP_FRONTEND=1 → 强制跳过前端构建,直接用现有 web/out');
    return false;
  }
  if (process.env.FORCE_FRONTEND_BUILD === '1') {
    console.log('[desktop] FORCE_FRONTEND_BUILD=1 → 强制重建前端');
    return true;
  }
  if (!existsSync(outProbe)) {
    console.log('[desktop] web/out 产物缺失 → 全量构建前端');
    return true;
  }
  const srcMtime = Math.max(
    newestMtime(path.join(webRoot, 'app')),
    newestMtime(path.join(webRoot, 'src')),
    newestMtime(path.join(webRoot, 'public')),
    rootFileMtime(
      'next.config.mjs', 'next.config.ts', 'next.config.js',
      'middleware.ts', 'package.json', 'pnpm-lock.yaml',
      'tailwind.config.ts', 'tailwind.config.js',
      'postcss.config.mjs', 'postcss.config.js', 'scripts/build-static.mjs'
    )
  );
  const outMtime = newestMtime(outDir);
  return outMtime < srcMtime;
}

if (shouldBuild()) {
  console.log('[desktop] 检测到前端源码比产物更新 → 重建前端...');
  execSync('pnpm --filter @ihui/web build:static', { stdio: 'inherit', cwd: desktopRoot });
} else {
  console.log('[desktop] 前端产物已最新 → 跳过前端构建,直接打包');
}