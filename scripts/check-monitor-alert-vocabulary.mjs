#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出诊断信息 */
/**
 * check-monitor-alert-vocabulary.mjs — 监控告警词表「同值副本」门(编号 268,blocking,差值棘轮)。
 *
 * 立因(2026-10-31,admin 监控子页崩溃族 ③):
 *   `monitor_alerts.status/severity` 在库里是裸 varchar(20)(无 CHECK、无 TS 枚举),消费侧
 *   全靠各自抄一份词表 —— 实测同时存在三套(前端 active/acknowledged、error-dashboard
 *   open/resolved/ignored、库侧 firing/suppressed/resolved)。副本必然漂移(§0.6),而漂移的
 *   代价是渲染期 TypeError 崩表。canonical 已落在 `packages/types/src/monitor-vocabulary.ts`
 *   (2026-10-31 0d1c4ff9c2),本门给它装机器牙:**不许再出现第二份同值数组**。
 *
 * 判据(纯函数可复算,`--self-test` 钉住):
 *   PV1 canonical 自洽 —— canonical 文件里两条 `as const` 数组各 ≥2 个取值,否则 exit 2 未判定。
 *   PV2 差值棘轮 —— 扫 apps/ 与 packages/ 下的 .ts/.tsx(排除 tests/dist/node_modules/canonical),
 *       某文件「含某词表 ≥2 个取值(以带引号字面量出现)」记 1 份副本;副本数相对 **该文件 HEAD 面
 *       自身** 上涨 ⇒ 判红;存量只报数。取不到 HEAD 锚点 ⇒ 该文件全判(失效方向=多要一次定向说明)。
 *
 * 取材面纪律(同 70/77/173/213):全量判 **HEAD** / `--staged` 判**索引** / `--worktree` 仅人工;
 * 两面旗同给 / 取不到输入 ⇒ exit 2「未判定」(§0.3),既不记绿也不冒红。
 *
 * 为什么不是绝对零容忍:2026-10-31 现读 HEAD 已有多处字面量(库表默认值、告警服务、wallboard 等),
 * 直接挂绝对档 = 恒红门(§12e);差值棘轮只拦「本次带进来的第二份」。
 *
 * 用法:
 *   node scripts/check-monitor-alert-vocabulary.mjs             # 全量档(HEAD)
 *   node scripts/check-monitor-alert-vocabulary.mjs --staged    # 提交链档(索引)
 *   node scripts/check-monitor-alert-vocabulary.mjs --worktree  # 人工档(工作树)
 *   node scripts/check-monitor-alert-vocabulary.mjs --self-test
 * 应急跳过:HUSKY_SKIP_MONITOR_ALERT_VOCABULARY=1
 */
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, readWorktreeFile } from './lib/face-reader.mjs'

// ROOT 由脚本自身位置推导:本文件在 scripts/ 下 ⇒ 上一级才是仓库根(git pathspec 相对 cwd)。
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const CANONICAL = 'packages/types/src/monitor-vocabulary.ts'
const SCAN_PATHS = ['apps', 'packages']
const LISTS = [
  { name: 'status', symbol: 'MONITOR_ALERT_STATUSES' },
  { name: 'severity', symbol: 'MONITOR_ALERT_SEVERITIES' },
]

export function parseCanonical(text) {
  const lists = {}
  for (const { name, symbol } of LISTS) {
    const re = new RegExp(`export const ${symbol}\\s*=\\s*\\[([^\\]]*)\\]`)
    const m = re.exec(String(text ?? ''))
    if (!m) return { ok: false, why: `canonical 里找不到 ${symbol} 数组` }
    const values = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
    if (values.length < 2) return { ok: false, why: `${symbol} 取值不足 2 个` }
    lists[name] = values
  }
  return { ok: true, lists }
}

/**
 * 某文件「同值副本」份数 = 有几条词表在其中以字面量出现 ≥2 个取值。
 *
 * 收窄(2026-10-31 实测):severity 三值(info/warning/critical)与通用日志级别同名,
 * 全仓 149 个文件只是"打了两种日志级别"就会被判成副本 ⇒ 纯噪声。故 severity 档加同现前提:
 * 只有该文件同时出现 **status 词表 ≥1 个取值**(告警域锚点)时,severity 才计入副本。
 * 告警域的真实副本(status+severity 同时出现)照旧全抓。
 */
export function countVocabularyCopies(text, lists, { tie = { list: 'severity', requires: 'status' } } = {}) {
  const s = String(text ?? '')
  const present = {}
  for (const [name, values] of Object.entries(lists)) {
    present[name] = values.filter((v) => s.includes(`'${v}'`) || s.includes(`"${v}"`))
  }
  let copies = 0
  const hits = []
  for (const name of Object.keys(lists)) {
    const vals = present[name]
    if (vals.length < 2) continue
    if (tie && name === tie.list && (present[tie.requires] ?? []).length === 0) continue
    copies += 1
    hits.push(`${name}:${vals.join('/')}`)
  }
  return { copies, hits }
}

export function isExcludedPath(path) {
  const p = String(path).replace(/\\/g, '/')
  if (p === CANONICAL) return true
  if (/(^|\/)(node_modules|dist|build|\.next)\//.test(p)) return true
  if (/(^|\/)(tests?|__tests__)\//i.test(p)) return true
  if (/\.(test|spec)\.[cm]?[jt]sx?$/i.test(p)) return true
  return false
}

function readFace(face) {
  let canonicalText = null
  try {
    // 内容一律走取材层(门 118):HEAD/索引走 catBatch,工作树走 readWorktreeFile ——
    // 不许自己 git show / 裸 readFileSync(那两型都会被判半接线)。
    if (face === 'worktree') {
      canonicalText = readWorktreeFile(ROOT, CANONICAL)
    } else {
      const spec = face === 'head' ? `HEAD:${CANONICAL}` : `:${CANONICAL}`
      canonicalText = catBatch(ROOT, [spec]).get(spec) ?? null
    }
  } catch (e) {
    return { ok: false, why: `${face} 面读不到 canonical(${e?.message ?? e})` }
  }
  // catBatch/readWorktreeFile 取不到一律回 null(不是 undefined)⇒ 严格比较即可。
  if (canonicalText === null) return { ok: false, why: `${face} 面读不到 canonical` }
  const parsed = parseCanonical(canonicalText)
  if (!parsed.ok) return { ok: false, why: `${face} 面 canonical 不自洽:${parsed.why}` }

  const allValues = Object.values(parsed.lists).flat()
  // git grep -E 走 POSIX ERE:不支持 (?:…),用普通捕获组;引号单双都要认。
  const pattern = `['"](${allValues.join('|')})['"]`
  // git grep 的选项必须排在 pattern 之前(--cached 放后面会被当修订号)
  const grepArgs =
    face === 'staged'
      ? ['grep', '-n', '-I', '-E', '--cached', pattern, '--', ...SCAN_PATHS]
      : face === 'head'
        ? ['grep', '-n', '-I', '-E', pattern, 'HEAD', '--', ...SCAN_PATHS]
        : ['grep', '-n', '-I', '-E', pattern, '--', ...SCAN_PATHS]
  let out = ''
  try {
    out = gitRaw(grepArgs, ROOT, { timeout: 180000 })
  } catch (e) {
    // git grep 无命中 ⇒ exit 1(合法空集);其余退出码 = 取不到输入
    if (typeof e?.status === 'number' && e.status === 1) out = ''
    else return { ok: false, why: `${face} 面扫描失败(${e?.message ?? e})` }
  }

  const perFile = new Map()
  for (const line of out.split(/\r?\n/)) {
    if (!line) continue
    // 只有 <rev> 形态(git grep <pattern> HEAD -- …)才带 "HEAD:" 前缀;--cached/工作树不带,
    // 对它们剥前缀会把真实路径吃掉(实测 staged 档曾把路径读成行号 653)。
    const body = face === 'head' ? line.replace(/^[^:]+:/, '') : line
    const idx = body.indexOf(':')
    if (idx <= 0) continue
    const path = body.slice(0, idx)
    const text = body.slice(idx + 1)
    if (isExcludedPath(path)) continue
    const cur = perFile.get(path) ?? ''
    perFile.set(path, cur ? `${cur}\n${text}` : text)
  }

  const copies = new Map()
  for (const [path, text] of perFile) {
    const c = countVocabularyCopies(text, parsed.lists)
    if (c.copies > 0) copies.set(path, c)
  }
  return { ok: true, lists: parsed.lists, copies }
}

function main(argv) {
  if (process.env.HUSKY_SKIP_MONITOR_ALERT_VOCABULARY === '1') {
    console.log('⏭  HUSKY_SKIP_MONITOR_ALERT_VOCABULARY=1 — 跳过监控告警词表同值副本门')
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  if (staged && worktree) {
    console.error('❌ 两面旗同给(--staged 与 --worktree)⇒ 无法判定取材面,exit 2')
    return 2
  }
  const face = staged ? 'staged' : worktree ? 'worktree' : 'head'
  const cur = readFace(face)
  if (!cur.ok) {
    console.error(`❌ 未判定(§0.3):${cur.why}`)
    return 2
  }
  if (face === 'head') {
    // 全量档只报数:HEAD 面存量不是「本次带进来的」,按绝对档判就是恒红门(§12e);
    // 真正的拦截在提交链(--staged,差值棘轮,锚点 = 本面自身)。
    console.log(
      `face=head · canonical=${CANONICAL} · 存量副本文件 ${cur.copies.size} 个(只报数;提交链按 --staged 差值棘轮判新增)`,
    )
    return 0
  }
  const anchor = readFace('head')
  if (!anchor.ok) {
    // 取不到 HEAD 锚点 ⇒ 无法算差值 ⇒ 按全判(失效方向=多要一次定向说明)
    console.error(`⚠️  未判定 HEAD 锚点:${anchor.why} ⇒ 本档按全判(所有副本人赃并获)`)
    anchor.copies = new Map()
    anchor.ok = true
    anchor.fallback = true
  }

  const red = []
  let stock = 0
  for (const [path, info] of cur.copies) {
    const before = anchor.copies.get(path)?.copies ?? 0
    if (info.copies > before) red.push({ path, before, after: info.copies, hits: info.hits })
  }
  for (const [path, info] of anchor.copies) {
    if ((cur.copies.get(path)?.copies ?? 0) <= info.copies) stock += 1
  }

  console.log(
    `face=${face} · canonical=${CANONICAL} · 词表 ${LISTS.map((l) => `${l.name}=[${cur.lists[l.name].join(',')}]`).join(' ')}`,
  )
  console.log(
    `ℹ 存量副本文件 ${stock} 个(HEAD 面自身已有,只报数);本轮新增 ${red.length} 个${anchor.fallback ? '(锚点未判定 ⇒ 全判)' : ''}`,
  )
  if (red.length) {
    console.error('❌ 新增同值副本(第二份必然漂移,§0.6):')
    for (const r of red) {
      console.error(`   - ${r.path}: ${r.before} → ${r.after} 份 [${r.hits.join(', ')}]`)
    }
    console.error(
      '   修法:删掉本文件的同值数组,改 import @ihui/types 的 MONITOR_ALERT_SEVERITIES/STATUSES(canonical 唯一份);',
    )
    console.error('   展示元数据(颜色/图标/文案)留在本地不算副本。')
    return 1
  }
  console.log('✅ 监控告警词表无新增同值副本')
  return 0
}

function selfTest() {
  let pass = 0
  let fail = 0
  const ok = (name, cond) => {
    if (cond) {
      pass += 1
      console.log(`  ✅ ${name}`)
    } else {
      fail += 1
      console.error(`  ❌ ${name}`)
    }
  }
  const good = `export const MONITOR_ALERT_STATUSES = ['firing', 'suppressed', 'resolved'] as const
export const MONITOR_ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const`
  const p1 = parseCanonical(good)
  ok('PV1a 正常 canonical ⇒ 两表都解析出', p1.ok && p1.lists.status.length === 3 && p1.lists.severity.length === 3)
  ok('PV1b 缺数组 ⇒ 不通过并点名', !parseCanonical("export const MONITOR_ALERT_STATUSES = ['a','b'] as const").ok)
  ok('PV1c 取值不足 2 个 ⇒ 不通过', !parseCanonical("export const MONITOR_ALERT_STATUSES = ['a'] as const\nexport const MONITOR_ALERT_SEVERITIES = ['x','y'] as const").ok)

  const lists = p1.lists
  const c1 = countVocabularyCopies(`// 'info' 'warning' 'critical' —— 只是日志级别`, lists)
  ok('PV2a 仅 generic severity(无 status 同现)⇒ 不算副本(实测全仓 149 文件噪声)', c1.copies === 0)
  const c2 = countVocabularyCopies("const s = 'firing'", lists)
  ok('PV2b 只有一个取值(如库表默认值)⇒ 不算副本', c2.copies === 0)
  const c3 = countVocabularyCopies("if (s === 'firing' || s === 'suppressed') {}", lists)
  ok('PV2c 两个状态字面量 ⇒ status 副本 1 份', c3.copies === 1)
  const c3b = countVocabularyCopies("'firing' ... 'info' 'warning'", lists)
  ok('PV2c2 status 同现 ⇒ 即使 status 只有 1 值,severity 也计入(1 份)', c3b.copies === 1 && c3b.hits[0].startsWith('severity:'))
  const c3c = countVocabularyCopies("'firing' 'suppressed' ... 'info' 'warning'", lists)
  ok('PV2c3 告警域真副本(status+severity 各 ≥2)⇒ 2 份', c3c.copies === 2)
  const c4 = countVocabularyCopies(good, lists)
  ok('PV2d canonical 自身文本 ⇒ 两份副本(由调用方按 isExcludedPath 排除)', c4.copies === 2)

  ok('EX1 canonical/tests/dist 不计入', isExcludedPath(CANONICAL) && isExcludedPath('apps/web/src/__tests__/x.ts') && isExcludedPath('packages/database/dist/schema/monitor.d.ts') && isExcludedPath('apps/web/a.test.tsx'))
  ok('EX2 生产文件不排除', !isExcludedPath('apps/web/src/lib/admin/monitor-alert-vocabulary.ts'))

  console.log(`\n自检:pass ${pass} / fail ${fail}`)
  return fail === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main(process.argv.slice(2)))

export const __test__ = { parseCanonical, countVocabularyCopies, isExcludedPath }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
