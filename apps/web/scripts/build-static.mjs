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
 *   - GitHub Pages CI(已有 GITHUB_PAGES=true,也可直接走本脚本,幂等)
 *   - 历史:Tauri 桌面端曾经 tauri.conf.json 的 beforeBuildCommand 消费本产物;2026-09-17 终极薄壳化后
 *     该字段为空串、build 直跑 tauri build,桌面端 = Tauri 薄壳 + 直连线上站点:frontendDist 指向
 *     src-tauri/shell 占位页,窗口 url 直接加载 https://aizhs.top/agents(V3 #72 拍板,桌面端不打包本地 web 产物),
 *     本产物已不是桌面端的分发源(另见 apps/desktop/scripts/ensure-web-out.mjs 头注)
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
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nextBin = path.join(webRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

// 静态导出必须排除的运行时路由目录(相对 app/):
// - cdn:小程序图标 CDN,直读 deploy/server-root,依赖 Node fs
// - uploads:用户上传文件,直读 apps/api/uploads/public,依赖 Node fs
const RUNTIME_ONLY_ROUTE_DIRS = ['cdn', 'uploads']

/**
 * 静态导出必须整体移出的**顶层文件**(2026-10-30 立)。
 *
 * 为什么:`proxy.ts`(Next 16 起 middleware 的正式名)承担源站直连守卫 + 后台鉴权 307 重定向,
 * 并在 2026-10-30 接上了逐请求 CSP nonce。它只能在服务端模式跑,而 Next 对
 * `output: 'export'` + middleware/proxy 是**硬报错**:
 *   "Middleware cannot be used with output: export"
 * 静态产物没有请求期,nonce 与鉴权在那一侧本就没有语义(与 cdn/uploads 那两个依赖 Node fs
 * 的运行时路由同理)。沿用既有的"构建期移出、finally 恢复"机制,不新增机制。
 *
 * ⚠️ 若将来 GH Pages / Tauri 侧也需要 CSP,正确做法是在托管层(nginx / Pages 的 `_headers`)
 * 配**静态**策略,而不是把 proxy 塞回静态构建 —— 那里没有 per-request 可言。
 */
const STATIC_EXCLUDED_TOP_FILES = ['proxy.ts']
/**
 * 静态导出必须整体移出的**动态路由页面**(相对 apps/web/,2026-11-03 立)。
 *
 * 为什么:`app/(main)/docs/[slug]/page.tsx` 的数据源是后端 docs 表
 * (`GET /api/docs` → `findDocs()` 只取 `status='published'`),当前库里 0 条 published;
 * 而 Next 对 `output: 'export'` + `generateStaticParams()` 返回空数组是**硬报错**:
 *   'Page "/docs/[slug]" returned an empty array from "generateStaticParams()".
 *    With "output: export", at least one route must be generated.'
 * (next/dist/build/static-paths/app.js:457-458;非 export 的服务端构建不触发该断言)
 *
 * 静态产物没有请求期,`dynamicParams = true` 的按需渲染在 `output: 'export'` 下本就
 * 没有语义(Next 官方 static-exports 指南把"dynamicParams: true"列为 unsupported),
 * 所以 docs 详情页只能待在服务端模式(生产 aizhs.top 走 next build + next start)。
 * 静态面沿用既有"构建期移出、finally 恢复"机制,只移出该段的 page.tsx(路由入口);
 * PageClient.tsx 留在原位继续参与 typecheck,不削弱编译面覆盖。
 *
 * ⚠️ 若将来 docs 详情要出现在 GH Pages/Tauri 静态产物里,正确做法是先在构建期拿到
 * **真实** slug 清单(例如发布侧生成 manifest),再把本行从移出面移除;不要用假 slug
 * 骗过 generateStaticParams 的空数组断言。
 */
const STATIC_EXCLUDED_ROUTE_FILES = [
  'app/(main)/docs/[slug]/page.tsx',
  /**
   * `app/dl/desktop/route.ts`(2026-11-04 立)是桌面安装包的**逐请求地域分流器**:
   * `GET /dl/desktop?file=<资产名>` → 读 `cf-ipcountry` 等地域头 + 拉当前 live release
   * 比字节等值 → `private, no-store` 302 到 Gitee 或 GitHub 其中一条腿。
   *
   * 它在静态导出下没有任何"构建期可定值"的输入:Next 对 `output: 'export'` 里用到
   * `request.url` / `request.headers` 的 route handler 硬报错
   *   'export const dynamic = "force-static"/export const revalidate not configured
   *    on route "/dl/desktop" with "output: export"'
   * 而 `force-static` 会把它固化成一个对**所有访客都相同**的 302 —— 这正是本仓
   * 2026-11-04 那条 route 头注里明令禁止的旧事故形态(把国内腿缓存/固化给海外)。
   * 静态产物(GH Pages / Tauri 壳)没有请求期,与 docs/[slug]、cdn/uploads 同类,
   * 故沿用既有"构建期移出、finally 恢复"机制,只移出该 route 入口文件。
   */
  'app/dl/desktop/route.ts',
]
/**
 * proxy.ts 的**反向依赖闭包**(直接/间接 import 它的源码,相对 apps/web/),静态导出期与 proxy 同批移出。
 *
 * `next build` 的 typecheck 覆盖 tsconfig.include 的**全部**文件(含 src/tests 与
 * 各 `__tests__` 目录),而 proxy.ts 在静态导出构建期已被移出 ⇒ 任何还留在原位的引用者
 * 都结构上必然 TS2307。
 *
 * 为什么从"手工清单"换成"按 import 图现算"(2026-11-03):
 *   原清单是 2026-10-31 09:36 按当时两枚测试写死的;同日 11:51 新增的
 *   src/tests/proxy-internal-prefix-block.test.ts 没人补进清单,Pages 的 build:static
 *   在 2026-11-03 报 `Cannot find module '../../proxy'`(与 2026-10-31 Build Docker run
 *   41150575611 同型)。"手工清单必然落后于新增"是本仓反复记过的失效型,故改为扫源码
 *   import 图现算:以后谁再写 `import { proxy } from '../proxy'`,它自动进移出面,
 *   不再依赖某个人记得回来加一行。
 */
const PROXY_SOURCE_REL = 'proxy.ts'
const SCAN_SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.next-static',
  '.static-excluded',
  '.turbo',
  'out',
  'e2e',
])
const CANDIDATE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']

/** 把 import 说明符解析成 apps/web 内的真实文件(只认相对路径与 `@/` 别名)。 */
function resolveSourceModule(specifier, fromAbs) {
  let base
  if (specifier.startsWith('@/')) base = path.join(webRoot, 'src', specifier.slice(2))
  else if (specifier.startsWith('.')) base = path.resolve(path.dirname(fromAbs), specifier)
  else return null
  return (
    CANDIDATE_SUFFIXES.map((suffix) => base + suffix).find(
      (p) => existsSync(p) && statSync(p).isFile(),
    ) ?? null
  )
}

/** 枚举 apps/web 下参与类型检查的 .ts/.tsx(含测试),供上面那张 import 图用。 */
function listSourceFiles() {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SCAN_SKIP_DIRS.has(entry.name)) walk(abs)
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(abs)
      }
    }
  }
  walk(webRoot)
  return files
}

function proxyDependentFiles() {
  const proxyAbs = path.join(webRoot, PROXY_SOURCE_REL)
  const sources = listSourceFiles()
  const dependents = new Set()
  // 从 proxy.ts 出发做反向闭包:直接引用它的文件先入集合,再反复收引用这些文件的文件
  // (测试 → helper → proxy 这种两跳引用也一并覆盖,不再靠人工登记)。
  let grew = true
  while (grew) {
    grew = false
    for (const abs of sources) {
      if (abs === proxyAbs || dependents.has(abs)) continue
      const text = readFileSync(abs, 'utf8')
      for (const m of text.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
        const target = resolveSourceModule(m[1], abs)
        if (target === proxyAbs || (target !== null && dependents.has(target))) {
          dependents.add(abs)
          grew = true
          break
        }
      }
    }
  }
  return [...dependents].map((abs) => path.relative(webRoot, abs).replaceAll('\\', '/')).sort()
}

const STATIC_EXCLUDED_FILES = [
  ...STATIC_EXCLUDED_TOP_FILES,
  ...STATIC_EXCLUDED_ROUTE_FILES,
  ...proxyDependentFiles(),
]
const appDir = path.join(webRoot, 'app')
const stashDir = path.join(webRoot, '.static-excluded')

/** 把被排除的单个文件移出原位(保留 mtime);嵌套路径自动建父目录。 */
function stashActiveFile(rel) {
  const active = path.join(webRoot, rel)
  if (!existsSync(active)) return
  const stashed = path.join(stashDir, rel)
  mkdirSync(path.dirname(stashed), { recursive: true })
  cpSync(active, stashed, { preserveTimestamps: true })
  rmSync(active, { force: true })
}

/** 回填被排除的单个文件(幂等;active 已存在则不覆盖)。 */
function restoreStashedFile(rel) {
  const stashed = path.join(stashDir, rel)
  const active = path.join(webRoot, rel)
  if (!existsSync(stashed) || existsSync(active)) return
  mkdirSync(path.dirname(active), { recursive: true })
  cpSync(stashed, active, { preserveTimestamps: true })
  rmSync(stashed, { force: true })
}

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
  // 文件(proxy.ts + 依赖它的测试):崩溃自愈同上,先还原再移出
  for (const rel of STATIC_EXCLUDED_FILES) restoreStashedFile(rel)
  for (const rel of STATIC_EXCLUDED_FILES) stashActiveFile(rel)
  for (const name of RUNTIME_ONLY_ROUTE_DIRS) {
    const active = path.join(appDir, name)
    // 目录不存在则跳过(如路由被移除);缺失时 cpSync 会抛 ENOENT 导致 CI 构建全挂(2026-09-01 事故)
    if (!existsSync(active)) continue
    moveDir(active, path.join(stashDir, name))
  }
}

/** 恢复被移出的路由目录(幂等) */
function restoreRuntimeRoutes() {
  for (const rel of STATIC_EXCLUDED_FILES) restoreStashedFile(rel)
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
  // 会让 apps/desktop/scripts/ensure-web-out.mjs 的源码 mtime 比对永远判定"需要重建"→ 前端全量重跑(2026-09-04)
  // 该脚本不在桌面端构建链(tauri.conf.json 的 build.beforeBuildCommand 为空串、build 直跑 tauri build),
  // 它仅是手动问责/条件重建入口 —— 但保留 mtime 这一条对手动调用仍然成立,不得因"不在构建链"而删。
  cpSync(src, dest, { recursive: true, preserveTimestamps: true })
  rmSync(src, { recursive: true, force: true })
}

let exitCode = 1
excludeRuntimeRoutes()
try {
  // 2026-09-05: 弃用 --webpack。本机实测 --webpack 3/3 挂死(config 加载后 0 CPU 冻结,
  // distDir 从未创建,无存活子进程);Turbopack(Next 16 默认构建器)静态导出实测成功
  // (EXIT:0,.next-static/index.html 产出,全路由清单生成)。生产链路 build:desktop:saas 同用此路径。
  // 2026-09-14:静态导出改走 --webpack——Turbopack(Next 16 默认构建器)在当前
  // 代码树对 output:export 的 middleware/server-actions 路径确定性 panic
  // ("Cell AssetIdent no longer exists in task",两次清 .next-static 缓存后同
  // TaskId 复现,上游 bug);server 模式构建(next build 默认 turbopack)不受影响。
  // webpack 构建静态导出产物供 Tauri/GH Pages,行为等价且确定性通过。
  const r = spawnSync(process.execPath, ['--max-old-space-size=8192', nextBin, 'build', '--webpack'], {
    cwd: webRoot,
    stdio: 'inherit',
    shell: false,
    env: process.env,
    windowsHide: true, // 防 Windows 弹可见控制台窗口
  })

  if (r.error) {
    console.error('[build-static] 启动 next build 失败:', r.error.message)
  } else {
    exitCode = r.status ?? 1
  }

  // 2026-09-05: Turbopack + 自定义 distDir(.next-static)时,Next 16 把静态导出写入
  // distDir 而非约定的 out/(webpack 时代行为)。下游契约(CI verify "apps/web/out"、
  // GitHub Pages;以及 apps/desktop/scripts/ensure-web-out.mjs 被手动调用时的 outDir)都消费 out/,此处统一同步,
  // 否则 CI 静默用不到产物(desktop-v0.1.16 发布 verify 步骤失败实证)。
  // 注:ensure-web-out.mjs 不在桌面端构建链(beforeBuildCommand 为空串),把它列进消费方只是"手动调用"那一档。
  // 2026-09-05 深夜复补:M3 收官提交误删此块致 release-desktop CI 全平台失败,现恢复。
  const staticDist = path.join(webRoot, '.next-static')
  const outDir = path.join(webRoot, 'out')
  if (exitCode === 0 && existsSync(path.join(staticDist, 'index.html'))) {
    rmSync(outDir, { recursive: true, force: true })
    cpSync(staticDist, outDir, { recursive: true })
    console.log('[build-static] 已同步 .next-static → out/(下游契约路径)')
  } else if (exitCode === 0) {
    console.error(
      '[build-static] 错误: 构建成功但 .next-static/index.html 缺失(导出目录异常),拒绝放行以防陈旧 out/ 被打包',
    )
    exitCode = 1
  }
} finally {
  restoreRuntimeRoutes()
}
process.exit(exitCode)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
