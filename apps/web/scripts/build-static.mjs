#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 静态导出构建入口(Tauri 桌面端 / GitHub Pages 使用)。
 *
 * 2026-08-04 生产切换:next.config.ts 的 output:'export' 改为显式环境变量控制,
 * 仅当 EXPORT_STATIC=true(或 GITHUB_PAGES=true)时启用静态导出。
 * 本脚本设置 EXPORT_STATIC=true 后调用 next build,供:
 *   - Tauri 桌面端(tauri.conf.json beforeBuildCommand)
 *   - GitHub Pages CI(已有 GITHUB_PAGES=true,也可直接走本脚本,幂等)
 * 生产服务端模式(next build + next start)不设 EXPORT_STATIC,走正常服务端构建。
 *
 * 2026-08-28 修复静态导出构建失败(output:'export' 与 force-dynamic 路由不兼容):
 * app/cdn 与 app/uploads 是运行时磁盘读取的 force-dynamic 路由,Next 静态导出
 * 在 Collecting page data 阶段直接报错。静态产物(Tauri WebView/GitHub Pages)
 * 无 Node 磁盘运行时,这两个路由本就无意义,故构建期间临时移出 app 目录,
 * 构建结束(无论成败)恢复原位。服务端构建(next build)不受影响。
 */
process.env.EXPORT_STATIC = 'true'
process.env.NEXT_TELEMETRY_DISABLED = '1'

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nextBin = path.join(webRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

// 静态导出必须排除的运行时路由目录(相对 app/):
// - cdn:小程序图标 CDN,直读 deploy/server-root,依赖 Node fs
// - uploads:用户上传文件,直读 apps/api/uploads/public,依赖 Node fs
const RUNTIME_ONLY_ROUTE_DIRS = ['cdn', 'uploads']
const appDir = path.join(webRoot, 'app')
const stashDir = path.join(webRoot, '.static-excluded')

/** 移出静态导出不兼容的路由目录;若上次构建崩溃遗留 stash,先恢复 */
function excludeRuntimeRoutes() {
  // 崩溃自愈:stash 残留且 app/ 下同名目录缺失 → 上次未恢复,先还原
  for (const name of RUNTIME_ONLY_ROUTE_DIRS) {
    const stashed = path.join(stashDir, name)
    const active = path.join(appDir, name)
    if (existsSync(stashed) && !existsSync(active)) {
      moveDir(stashed, active)
    }
  }
  mkdirSync(stashDir, { recursive: true })
  for (const name of RUNTIME_ONLY_ROUTE_DIRS) {
    const active = path.join(appDir, name)
    // 目录不存在则跳过(如路由被移除);缺失时 cpSync 会抛 ENOENT 导致 CI 构建全挂(2026-09-01 事故)
    if (!existsSync(active)) continue
    moveDir(active, path.join(stashDir, name))
  }
}

/** 恢复被移出的路由目录(幂等) */
function restoreRuntimeRoutes() {
  for (const name of RUNTIME_ONLY_ROUTE_DIRS) {
    const stashed = path.join(stashDir, name)
    const active = path.join(appDir, name)
    if (existsSync(stashed) && !existsSync(active)) {
      moveDir(stashed, active)
    }
  }
  if (existsSync(stashDir)) {
    try {
      rmSync(stashDir, { recursive: true })
    } catch {
      // 目录非空(异常状态)时保留,下次构建自愈逻辑会处理
    }
  }
}

/**
 * 移动目录。用 copy+remove 替代 renameSync(2026-08-31 改):
 * Windows 上部分安全软件(如火绒 HIPS)拦截 rename 系统调用导致构建失败
 * (EPERM),copy+remove 语义等价且不受拦截影响。cdn/uploads 仅含 catch-all
 * 路由文件(几 KB),复制成本可忽略,CI 与本地行为一致。
 */
function moveDir(src, dest) {
  // preserveTimestamps:必须保留原 mtime,否则构建后恢复的 cdn/uploads 时间戳变新,
  // ensure-web-out.mjs 的源码 mtime 比对永远判定"需要重建"→ 桌面端每次打包前端全量重跑(2026-09-04)
  cpSync(src, dest, { recursive: true, preserveTimestamps: true })
  rmSync(src, { recursive: true, force: true })
}

let exitCode = 1
excludeRuntimeRoutes()
try {
  // 2026-09-05: 弃用 --webpack。本机实测 --webpack 3/3 挂死(config 加载后 0 CPU 冻结,
  // distDir 从未创建,无存活子进程);Turbopack(Next 16 默认构建器)静态导出实测成功
  // (EXIT:0,.next-static/index.html 产出,全路由清单生成)。生产链路 build:desktop:saas 同用此路径。
  const r = spawnSync(process.execPath, ['--max-old-space-size=8192', nextBin, 'build'], {
    cwd: webRoot,
    stdio: 'inherit',
    shell: false,
    env: process.env,
  })

  if (r.error) {
    console.error('[build-static] 启动 next build 失败:', r.error.message)
  } else {
    exitCode = r.status ?? 1
  }

  // 2026-09-05: Turbopack + 自定义 distDir(.next-static)时,Next 16 把静态导出写入
  // distDir 而非约定的 out/(webpack 时代行为)。下游契约(CI verify "apps/web/out"、
  // 桌面 ensure-web-out.mjs outDir、GitHub Pages)都消费 out/,此处统一同步,
  // 否则 CI 静默用不到产物(desktop-v0.1.16 发布 verify 步骤失败实证)。
  // 2026-09-05 深夜复补:M3 收官提交误删此块致 release-desktop CI 全平台失败,现恢复。
  const staticDist = path.join(webRoot, '.next-static')
  const outDir = path.join(webRoot, 'out')
  if (exitCode === 0 && existsSync(path.join(staticDist, 'index.html'))) {
    rmSync(outDir, { recursive: true, force: true })
    cpSync(staticDist, outDir, { recursive: true })
    console.log('[build-static] 已同步 .next-static → out/(下游契约路径)')
  } else if (exitCode === 0) {
    console.error('[build-static] 错误: 构建成功但 .next-static/index.html 缺失(导出目录异常),拒绝放行以防陈旧 out/ 被打包')
    exitCode = 1
  }
} finally {
  restoreRuntimeRoutes()
}
process.exit(exitCode)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
