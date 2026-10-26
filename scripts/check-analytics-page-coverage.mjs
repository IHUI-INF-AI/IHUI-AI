#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-analytics-page-coverage.mjs —— 埋点覆盖面只读尺(2026-10-26 立,不进提交链、不进守护巡检轮)。
 *
 * 判什么:仓内**声明过**的页面(分母)与 `visit_logs` 窗口内**真出现过**的 url(分子)对齐,
 * 每个端给出 zeroVisit(声明了却没被记到)与 unexpected(被记到但清单里没有)。
 * 立因:「所有页面都有埋点」不能靠"我记得都接上了"这句话成立 —— 漏埋一页在监控面上的
 * 表现与"那页没人访问"逐字同形,只有把分母摆出来才看得见。
 *
 * 取材面纪律(守门 118):清单经 `scripts/lib/face-reader.mjs` 的 catBatch 取**被审面**
 * (默认 HEAD blob,`--staged` 取索引 blob),不读工作树 —— 读磁盘会把别人在飞的副本
 * 算成"仓里声明过的页面"。路径清单同样来自 `git ls-tree` / `git ls-files`。
 *
 * 为什么它不进提交链:观测面要读数据库(判机器状态),按 AGENTS §12e 那是恒红门形态。
 * 红了也不自动定责:zeroVisit 只说明"没人打开过",不等价于"没埋点"(四端都是单点挂载);
 * 能当缺陷读的是**清单外**那一向(观测面比声明面宽 ⇒ 死链或脏 url 候选)。
 *
 * 用法:
 *   node --env-file=apps/api/.env scripts/check-analytics-page-coverage.mjs            # 近 7 日
 *   node --env-file=apps/api/.env scripts/check-analytics-page-coverage.mjs --days 30
 *   node scripts/check-analytics-page-coverage.mjs --staged                            # 判索引面清单
 *   node scripts/check-analytics-page-coverage.mjs --inventory-only                    # 只算分母
 *   node scripts/check-analytics-page-coverage.mjs --json
 * 退出码:0 = 给出结论(缺口只报数)/ 2 = 未判定(清单或观测面取不到,绝不用 0 冒充"没缺口")
 */

import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { catBatch } from './lib/face-reader.mjs'
import {
  buildCoverage,
  extensionRoutesFromSource,
  miniappPagesFromConfig,
  rnScreensFromSource,
  webRouteFromFilePath,
} from './lib/analytics-coverage.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 三件"页面清单来源"文件(web 那一端走目录清单,不用单文件)。 */
export const SOURCES = {
  mp: 'apps/miniapp-taro/src/app.config.ts',
  rn: 'apps/mobile-rn/src/navigation/RootNavigator.tsx',
  ex: 'apps/extension/entrypoints/sidepanel/SidepanelApp.tsx',
}

function gitText(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      maxBuffer: 64000000,
      stdio: ['ignore', 'pipe', 'ignore'],
      cwd: ROOT,
    })
  } catch {
    return null
  }
}

/** 被审面上的 web 页面文件(HEAD 用 ls-tree,索引面用 ls-files);取不到 ⇒ null。 */
function webPageFiles(face) {
  const out = gitText(
    face === 'staged'
      ? ['ls-files', '--', 'apps/web/app']
      : ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'apps/web/app'],
  )
  if (out === null) return null
  return out
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /(^|\/)page\.tsx?$/.test(l))
    .map((l) => l.replace('apps/web/app/', ''))
}

/** 分母 = 四端声明清单;任一件输入在被审面取不到 ⇒ missing 非空,由调用方落"未判定"。 */
function collectInventory(face) {
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const pages = webPageFiles(face)
  if (pages === null) return { missing: ['git ls-tree/ls-files(apps/web/app)'] }
  const specs = [...Object.values(SOURCES), ...pages.map((rel) => 'apps/web/app/' + rel)].map(
    (rel) => prefix + rel,
  )
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 28 })
  const textOf = (rel) => got.get(prefix + rel) ?? null

  const missing = []
  const mpText = textOf(SOURCES.mp)
  const rnText = textOf(SOURCES.rn)
  const exText = textOf(SOURCES.ex)
  if (mpText === null) missing.push(SOURCES.mp)
  if (rnText === null) missing.push(SOURCES.rn)
  if (exText === null) missing.push(SOURCES.ex)

  const web = [...new Set(pages.map((rel) => webRouteFromFilePath(rel)).filter(Boolean))].sort()

  return {
    web,
    mp: mpText === null ? [] : miniappPagesFromConfig(mpText),
    rn: rnText === null ? [] : rnScreensFromSource(rnText),
    ex: exText === null ? [] : extensionRoutesFromSource(exText),
    missing,
  }
}

/**
 * 解析 postgres 驱动。根 node_modules 里那个同名目录是空的(pnpm 隔离式链接的残留),
 * 真包只在 apps/api 下 ⇒ 必须显式从那儿 resolve;两处都取不到 ⇒ null。
 */
async function loadPostgres() {
  try {
    const req = createRequire(path.join(ROOT, 'apps/api/package.json'))
    const mod = await import(pathToFileURL(req.resolve('postgres')).href)
    return mod.default ?? mod
  } catch {
    try {
      const mod = await import('postgres')
      return mod.default ?? mod
    } catch {
      return null
    }
  }
}

/** 观测面:窗口内出现过的 url 去重。连不上库 / 缺 DATABASE_URL ⇒ null(交调用方判"未判定")。 */
async function fetchObserved(days) {
  const url = process.env.DATABASE_URL
  if (!url) return null
  const postgres = await loadPostgres()
  if (!postgres) return null
  let sql
  try {
    sql = postgres(url, { max: 1 })
    const rows = await sql`
      select distinct url from visit_logs
      where created_at >= now() - make_interval(days => ${days}::int)
    `
    return rows.map((r) => r.url).filter((u) => typeof u === 'string' && u.length > 0)
  } catch {
    return null
  } finally {
    if (sql) await sql.end({ timeout: 5 }).catch(() => {})
  }
}

function printReport(inv, report, { face, days, inventoryOnly, json }) {
  if (json) {
    console.log(
      JSON.stringify(
        {
          face: `${face === 'staged' ? '索引 blob' : 'HEAD blob'} + ${
            inventoryOnly ? '未判定观测面' : 'visit_logs'
          }`,
          days: inventoryOnly ? null : days,
          declaredTotals: {
            web: inv.web.length,
            rn: inv.rn.length,
            mp: inv.mp.length,
            ex: inv.ex.length,
          },
          ends: report,
        },
        null,
        2,
      ),
    )
    return
  }
  console.log(
    `埋点覆盖面(清单面=${face === 'staged' ? '索引 blob' : 'HEAD blob'},窗口 ${
      inventoryOnly ? '—' : days
    } 日,分子=visit_logs 去重 url)`,
  )
  for (const end of ['web', 'rn', 'mp', 'ex']) {
    const r = report[end]
    const pct = r.declared > 0 ? Math.round((r.seen / r.declared) * 100) : 0
    console.log(
      `  ${end}: 声明 ${r.declared} · 窗口内被记到 ${r.seen}(${pct}%)· 观测键 ${r.observations}` +
        ` · 零访问 ${r.zeroVisit.length} · 清单外 ${r.unexpected.length}`,
    )
    if (r.zeroVisit.length > 0)
      console.log(`      零访问样例(最多 8):${r.zeroVisit.slice(0, 8).join(', ')}`)
    if (r.unexpected.length > 0)
      console.log(`      清单外样例(最多 8):${r.unexpected.slice(0, 8).join(', ')}`)
  }
  if (inventoryOnly) console.log('  ⓘ 本轮只算分母(--inventory-only);观测面未判定。')
  console.log(
    '读法:zeroVisit = 声明过但窗口内没人打开,不等价于"没埋点"(四端都是单点挂载:web 根布局 ' +
      'GlobalShell→VisitTracker、RN NavigationContainer→reportScreenView、小程序 app.tsx→' +
      'startPageViewTracking、插件 popup/sidepanel 入口→reportExtensionView);清单外 = 被记到但清单里没有' +
      ' ⇒ 死链或脏 url 候选,这一向才是"观测面比声明面宽"的信号。',
  )
  console.log('结论:缺口只报数,判红权在人(本尺不进提交链;AGENTS §12e)。')
}

async function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const inventoryOnly = args.includes('--inventory-only')
  const face = args.includes('--staged') ? 'staged' : 'head'
  const daysIdx = args.indexOf('--days')
  const days = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 7
  if (!Number.isInteger(days) || days <= 0 || days > 365) {
    console.error('❌ --days 需要 1..365 的整数')
    process.exit(2)
  }

  const inv = collectInventory(face)
  if (inv.missing.length > 0) {
    console.error(
      `❌ 未判定:清单来源在 ${face === 'staged' ? '索引面' : 'HEAD 面'} 上取不到(${inv.missing.join(
        ', ',
      )})`,
    )
    process.exit(2)
  }

  const observed = inventoryOnly ? null : await fetchObserved(days)
  if (!inventoryOnly && observed === null) {
    console.error(
      '❌ 未判定:观测面取不到(DATABASE_URL 缺失、postgres 驱动不可解析或查询失败)。' +
        '不回落成"零缺口"—— 那是把"没判"写成"判过"(AGENTS §0.3)。',
    )
    process.exit(2)
  }

  printReport(inv, buildCoverage(inv, observed ?? []), { face, days, inventoryOnly, json })
  process.exit(0)
}

export const __test__ = { SOURCES, webPageFiles, collectInventory, ROOT }

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ 未判定:${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
