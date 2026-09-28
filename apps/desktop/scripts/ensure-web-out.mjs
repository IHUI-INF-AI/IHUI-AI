#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 智汇AI (IHUI AI) 桌面端 — 条件构建前端产物(历史遗留件,现为手动问责/条件重建入口)
// 架构口径(2026-09-17 终极薄壳化,现行为准):桌面端 = Tauri 薄壳 + 直连线上站点:frontendDist 指向 src-tauri/shell 占位页,窗口 url 直接加载 https://aizhs.top/agents(V3 #72 拍板,桌面端不打包本地 web 产物)
// 桌面端 AI 版本由线上站点决定,本仓不可校验:线上不可用=桌面端一起不可用、无法本地降级、无法离线首屏(仅有薄壳占位页与 Rust 侧 offline:// 重连提示,本地无可渲染 UI)
// 本脚本不在构建链:tauri.conf.json 的 build.beforeBuildCommand 为空串、apps/desktop/package.json 的 build 直跑 tauri build,它仅是手动问责/条件重建入口。问责命令(从仓库根):pnpm --filter @ihui/desktop exec node scripts/ensure-web-out.mjs
// 手动调用时行为:apps/web/out 产物存在且源码不新于产物则跳过,否则(含产物缺失)触发 pnpm --filter @ihui/web build:static 重建。
// 强制重建:FORCE_FRONTEND_BUILD=1 node scripts/ensure-web-out.mjs;无条件跳过构建(只打印判定):TAURI_SKIP_FRONTEND=1 同上。
// 若未来回到内嵌 web 产物方案:必须同步改 tauri.conf.json 的 frontendDist/beforeBuildCommand 并把本脚本重新接回构建链(另见 apps/desktop/src-tauri/README.md)。
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
// 仅手动运行本脚本时注入;桌面端构建链(2026-09-17 薄壳化后)已不经过本脚本,GitHub Pages 直接跑
// build:static 同样不经过本脚本,行为不变。api 侧 CORS 已硬编码放行
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
  execSync('pnpm --filter @ihui/web build:static', {
    stdio: 'inherit',
    cwd: desktopRoot,
    windowsHide: true, // 防 Windows 弹可见控制台窗口
  });
} else {
  console.log('[desktop] 前端产物已最新 → 跳过前端构建,直接打包');
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
