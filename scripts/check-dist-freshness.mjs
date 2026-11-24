#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * dist 新鲜度尺(2026-11-06 立,只读)。
 *
 * 立因(不是推断,是量出来的两次现场):
 *  ① `3540974` 00:31 入库 `body-audit` 仪器,00:33 那班真派发的转录里 `transport-audit` 有行而
 *     `body-audit` **0 行** —— 环境变量确实到了子进程,差的是 `@ihui/api-client` 的入口自述是
 *     `./dist/index.js`,盘上那份 dist 是 13:24 构建的旧件;`pnpm run build` 后才通电。
 *  ② 同班次派发模板是 `tsx apps/cli/src/index.ts` ⇒ **CLI 本体走源码**。所以"改动进没进执行面"
 *     取决于被改的那个包是 src 入口还是 dist 入口 —— 而这件事全仓没有任何一把尺量过,
 *     自主环把票落在 packages 下某包的 src 目录上时,结构上不知道自己改的那一份此刻根本没在跑。
 *
 * 判据取向:
 *  - 只判"该包的 src 是否比它的 dist 新"(滞后),入口形态由包自己 `package.json` 自述(main/exports),
 *    不在本器里维护第二份包清单(§0.6 单一真相源;清单会腐烂,自述不会)。
 *  - 三态:落后 / 不落后 / **未判定**(无 dist 且入口自述 dist、或两侧都取不到 ⇒ 不冒充"没问题",§0.3)。
 *  - 刻意**不接提交链**:现读存量不为零(`api-client` 此刻就滞后),按 §12e,升 blocking 的前置是
 *    存量归零;现在接进去只会造出一道人人跳的恒红门。本器是"量出来"这一步,派它的是调度侧读数与票面判定。
 *
 * 用法:
 *   node scripts/check-dist-freshness.mjs            # 逐包读数(落后者优先列出)
 *   node scripts/check-dist-freshness.mjs --json     # 机读
 *   node scripts/check-dist-freshness.mjs --max-age-min 120   # 阈值(缺省 0:任何滞后都点名)
 * 退出码:0 = 无滞后;1 = 有滞后(供调度侧决定要不要先构建);2 = 脚本自身取不到输入(未判定,不等于绿)。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

/** 入口自述里是否出现 dist 形态(只读包自己写的字段,不自持清单)。 */
export function entryPointsToDist(pkgJson) {
  const field =
    typeof pkgJson.main === 'string'
      ? pkgJson.main
      : typeof pkgJson.exports === 'string'
        ? pkgJson.exports
        : pkgJson.exports
          ? JSON.stringify(pkgJson.exports)
          : ''
  return /(^|["'/])dist\//.test(String(field))
}

/** 取某目录树下匹配后缀的最新 mtime;取不到 ⇒ null(不冒充 0)。 */
export function newestMtime(dir, exts, { maxDepth = 5 } = {}) {
  let best = 0
  let seen = 0
  const walk = (d, depth) => {
    if (depth > maxDepth) return
    let ents
    try {
      ents = readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p, depth + 1)
      else if (exts.some((x) => e.name.endsWith(x))) {
        seen++
        try {
          const t = statSync(p).mtimeMs
          if (t > best) best = t
        } catch {
          /* 单文件取不到 ⇒ 跳过该文件,不因此宣布整包未判定 */
        }
      }
    }
  }
  walk(dir, 0)
  return seen === 0 ? null : best
}

/**
 * 逐包判据(纯函数,夹具可在任意根上跑)。
 * 返回每包 `{pkg, state:'lag'|'ok'|'unjudged', lagMin, entry, note}`。
 */
export function scanDistFreshness(rootDir, { maxAgeMin = 0 } = {}) {
  const out = []
  let pkgs
  try {
    pkgs = readdirSync(join(rootDir, 'packages'))
  } catch (e) {
    return { rows: [], error: 'packages/ 取不到:' + String(e?.message ?? e) }
  }
  for (const p of pkgs.sort()) {
    const root = join(rootDir, 'packages', p)
    const pjPath = join(root, 'package.json')
    if (!existsSync(pjPath)) continue // 非包目录(空壳/工具目录),不计入分母
    let pkgJson
    try {
      pkgJson = JSON.parse(readFileSync(pjPath, 'utf8'))
    } catch {
      out.push({ pkg: p, state: 'unjudged', lagMin: null, entry: '', note: 'package.json 读不到' })
      continue
    }
    const entry =
      (typeof pkgJson.main === 'string' && pkgJson.main) ||
      (typeof pkgJson.exports === 'string' && pkgJson.exports) ||
      (pkgJson.exports ? JSON.stringify(pkgJson.exports).slice(0, 60) : '')
    const distDir = join(root, 'dist')
    const srcDir = join(root, 'src')
    const distNewest = existsSync(distDir)
      ? newestMtime(distDir, ['.js', '.mjs', '.cjs', '.d.ts'])
      : null
    const srcNewest = existsSync(srcDir)
      ? newestMtime(srcDir, ['.ts', '.tsx', '.js', '.mjs'])
      : null
    if (!entryPointsToDist(pkgJson)) {
      // 入口不指 dist ⇒ 这个包本来就被当源码消费(本仓 6 枚如此),滞后与否不影响执行面
      out.push({ pkg: p, state: 'ok', lagMin: 0, entry, note: '入口自述非 dist(源码消费)' })
      continue
    }
    if (distNewest === null || srcNewest === null) {
      out.push({
        pkg: p,
        state: 'unjudged',
        lagMin: null,
        entry,
        note: distNewest === null ? '入口自述 dist 而 dist 取不到' : 'src 取不到',
      })
      continue
    }
    const lagMin = Math.round((srcNewest - distNewest) / 60000)
    out.push({
      pkg: p,
      state: lagMin > maxAgeMin ? 'lag' : 'ok',
      lagMin,
      entry,
      note: lagMin > maxAgeMin ? `src 比 dist 新 ${lagMin} 分钟 ⇒ 不经构建不进执行面` : '',
    })
  }
  return { rows: out, error: null }
}

async function main() {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const mi = args.indexOf('--max-age-min')
  const maxAgeMin = mi >= 0 ? Number(args[mi + 1]) || 0 : 0
  const { rows, error } = scanDistFreshness(ROOT, { maxAgeMin })
  if (error) {
    console.error(`❌ 未判定:${error}(§0.3:取不到输入不记绿也不冒红)`)
    process.exit(2)
  }
  const lag = rows.filter((r) => r.state === 'lag')
  const undetermined = rows.filter((r) => r.state === 'unjudged')
  if (json) {
    console.info(JSON.stringify({ lag, undetermined, rows }, null, 0))
  } else {
    for (const r of [...lag, ...undetermined]) {
      console.info(`[${r.state === 'lag' ? '滞后' : '未判定'}] ${r.pkg} 入口=${r.entry} ${r.note}`)
    }
    console.info(
      `dist 新鲜度:判 ${rows.length} 枚包 / 滞后 ${lag.length} / 未判定 ${undetermined.length} / 阈值 ${maxAgeMin} 分钟(判定面=盘上 mtime 现读;入口形态取包自述,本器不自持清单)`,
    )
  }
  if (lag.length > 0) process.exit(1)
  if (undetermined.length > 0 && rows.length === undetermined.length) process.exit(2)
  process.exit(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = { entryPointsToDist, newestMtime, scanDistFreshness }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
