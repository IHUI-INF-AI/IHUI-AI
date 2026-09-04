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

// 2026-09-04 桌面端 SaaS 化:REST/SSE/AI 全部连线上生产后端(与 WS 对齐,
// 消除"REST 走本地库、WS 连线上"的分裂状态)。NEXT_PUBLIC_* 在 next build
// 静态导出时内联进产物,必须在构建前注入(进程环境变量优先于 web/.env)。
// 覆盖方式:DESKTOP_API_BASE_URL / DESKTOP_STREAM_API_BASE_URL / DESKTOP_AI_SERVICE_URL
// (如本地联调时指向 127.0.0.1),或直接预设对应 NEXT_PUBLIC_* 变量。
// 仅桌面端构建路径(tauri beforeBuildCommand)注入;GitHub Pages 直接跑
// build:static 不经过本脚本,行为不变。api 侧 CORS 已硬编码放行
// http://tauri.localhost / tauri://localhost(server.ts DESKTOP_ORIGINS)。
const DESKTOP_ENV_DEFAULTS = {
  NEXT_PUBLIC_API_BASE_URL: process.env.DESKTOP_API_BASE_URL ?? 'https://api.aizhs.top',
  NEXT_PUBLIC_STREAM_API_BASE_URL:
    process.env.DESKTOP_STREAM_API_BASE_URL ?? 'https://api.aizhs.top',
  NEXT_PUBLIC_AI_SERVICE_URL: process.env.DESKTOP_AI_SERVICE_URL ?? 'https://ai.aizhs.top',
};
for (const [k, v] of Object.entries(DESKTOP_ENV_DEFAULTS)) {
  if (!process.env[k]) {
    process.env[k] = v;
    console.log(`[desktop] 注入 ${k}=${v}`);
  }
}

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
      'postcss.config.mjs', 'postcss.config.js', 'scripts/build-static.mjs',
      'scripts/ensure-web-out.mjs' // 本脚本注入 NEXT_PUBLIC_* 影响产物,变更需触发重建
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