#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * check-nav-dead-links.mjs — 侧边栏导航死链静态检查(2026-09-02)
 *
 * 背景:全量路由预热(scripts/warm-dev-routes.mjs --all,184 条)实测发现
 *   `/configs` 与 `/models/market` 返回 404 —— nav-data.ts 注册了导航项,
 *   但 apps/web/app 下并没有对应 page 文件(幽灵链接,用户点了必 404)。
 *   这类问题静态可查,不必等到运行时预热才发现。
 *
 * 原理:
 *   1. 正则解析 nav-data.ts 的全部 href(与侧边栏单一来源同步,清单不漂移)
 *   2. 递归收集 apps/web/app 下各级目录的 page 文件(tsx/ts/jsx/js/mdx)推导可用路由
 *      - 跳过 (group) 路由组与 _private 私有目录(不占 URL 段)
 *      - [param] / [...slug] 动态段按通配匹配
 *   3. href 无匹配页面 → 死链,exit 1
 *
 * 用法(被调用即扫;取不到输入即 exit 2 点名):
 *   node scripts/check-nav-dead-links.mjs            # 检查并输出结果,死链则 exit 1
 *   pnpm check:nav-dead-links
 *   node scripts/check-nav-dead-links.mjs --nav-data <file> --app-dir <dir>   # 取证/测试用
 *
 * 退出码(三态,AGENTS.md §0.3):
 *   0 = 无死链;1 = 有死链;2 = 未判定(nav-data 读不到 / 解析不到 href / 页面目录读不到 / 无 page 文件)
 *
 * 注意:API 侧同名路径(如 apps/api 的 GET /configs)是后端接口,与 web 页面
 *   路由不同上下文,不参与本检查。
 */

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const DEFAULT_NAV_DATA = path.join(REPO_ROOT, 'apps', 'web', 'src', 'components', 'sidebar', 'nav-data.ts')
const DEFAULT_APP_DIR = path.join(REPO_ROOT, 'apps', 'web', 'app')
const PAGE_RE = /^page\.(tsx|ts|jsx|js|mdx)$/

/** 从 nav-data.ts 解析全部 href(去重、仅保留站内绝对路径);读不到即抛,由 main 转 exit 2 */
function loadSidebarHrefs(navData) {
  const src = readFileSync(navData, 'utf8')
  const hrefs = [...src.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1])
  return [...new Set(hrefs)].filter((h) => h.startsWith('/'))
}

/** 递归收集所有 page 文件;目录读不到即抛,由 main 转 exit 2 */
function collectPageFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectPageFiles(full))
    else if (PAGE_RE.test(entry.name)) out.push(full)
  }
  return out
}

/** 页面目录 → URL 路由模式(剔除路由组与私有目录) */
function toRoutePattern(relDir) {
  const segments = relDir.split(/[\\/]/).filter(Boolean)
  const kept = segments.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('_'))
  return '/' + kept.join('/')
}

/** 取 `--flag value` 形式的参数值;缺 value 返回 null */
function flagValue(argv, name) {
  const i = argv.indexOf(name)
  if (i < 0) return null
  const v = argv[i + 1]
  return v && !v.startsWith('--') ? v : null
}

function main() {
  const argv = process.argv.slice(2)
  const navDataArg = flagValue(argv, '--nav-data')
  const appDirArg = flagValue(argv, '--app-dir')
  const navData = navDataArg ? path.resolve(navDataArg) : DEFAULT_NAV_DATA
  const appDir = appDirArg ? path.resolve(appDirArg) : DEFAULT_APP_DIR

  let hrefs
  try {
    hrefs = loadSidebarHrefs(navData)
  } catch (e) {
    console.error(
      `❌ check-nav-dead-links: 读不到导航数据 ${navData} —— 未判定(exit 2):${e?.message ?? e}`,
    )
    process.exit(2)
  }
  if (hrefs.length === 0) {
    console.error(
      `❌ check-nav-dead-links: 未从 ${navData} 解析到任何 href,扫描面为空 —— 未判定(exit 2)`,
    )
    process.exit(2)
  }

  let pageFiles
  try {
    pageFiles = collectPageFiles(appDir)
  } catch (e) {
    console.error(
      `❌ check-nav-dead-links: 读不到页面目录 ${appDir} —— 未判定(exit 2):${e?.message ?? e}`,
    )
    process.exit(2)
  }
  if (pageFiles.length === 0) {
    console.error(
      `❌ check-nav-dead-links: ${appDir} 下无任何 page 文件,扫描面为空 —— 未判定(exit 2)`,
    )
    process.exit(2)
  }

  const available = new Set()
  for (const file of pageFiles) {
    const relDir = path.dirname(file).slice(appDir.length).replace(/^[\\/]/, '')
    available.add(toRoutePattern(relDir).replace(/\/$/, '') || '/')
  }

  // 动态段 → 正则: [id] 匹配单段, [[...slug]] / [...slug] 匹配一段及以上
  const patterns = [...available].map((raw) => ({
    raw,
    re: new RegExp(
      '^' +
        raw
          .replace(/\[\[?\.\.\.[^\]]+\]\]?/g, '.+')
          .replace(/\[[^\]]+\]/g, '[^/]+')
          .replace(/\//g, '\\/') +
        '$',
    ),
  }))

  const dead = hrefs.filter((href) => {
    const clean = href.replace(/\/$/, '') || '/'
    return !patterns.some((p) => p.re.test(clean))
  })

  console.log(`侧边栏 href: ${hrefs.length} 条`)
  console.log(`可用页面路由: ${available.size} 条(${appDir} 下 page 文件 ${pageFiles.length} 个)`)

  if (dead.length === 0) {
    console.log('\n✅ 无死链:全部侧边栏导航均有对应页面')
    process.exit(0)
  }

  console.log(`\n❌ 发现 ${dead.length} 条死链(导航有入口但页面不存在):`)
  for (const d of dead) console.log('   ' + d)
  console.log('\n修复建议:删除 nav-data.ts 中对应导航项,或补建 apps/web/app 下页面。')
  process.exit(1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()

export const __test__ = {
  DEFAULT_NAV_DATA,
  DEFAULT_APP_DIR,
  PAGE_RE,
  loadSidebarHrefs,
  collectPageFiles,
  toRoutePattern,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌​‌​‌​‌‍
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
