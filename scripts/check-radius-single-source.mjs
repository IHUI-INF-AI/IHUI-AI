#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 圆角单一源头守门(全 8 端)。
 *
 * 堵的是两类静默漂移:
 *  A. 表漂移 —— radius.js(唯一真相源)/ tokens.css --radius-* / miniapp-taro app.css --radius-* /
 *     tailwind-preset.js 四处档位值不一致(历史上 v3 preset 的 rounded-sm=2px 与 web v4 的 sm=4px
 *     同名不同值,正是"手机上圆角和全局设定不统一"的根因之一)。
 *  B. 取用漂移 —— 端内写死数字/偏档值,绕开档位表(RN StyleSheet 数字、CSS px/rpx 字面量、
 *     rounded-[任意值]、每文件自定 *_RADIUS 常量)。全仓实测曾达 1292 处 RN 数字 + 509 处 taro
 *     任意值 + 495 处 CSS 字面量,档位形同虚设。
 *
 * 判据:
 *  A 任一档值不一致或 preset 重新内联字面量表 → 红(恒扫,不受 --staged 影响)。
 *  B1 TS/TSX `border(Top|Bottom)?(Left|Right)?Radius: <数字|rpx(N)>` → 必须写 rnRadius.<step>
 *  B2 TS/TSX 本地 `const *RADIUS* = <数字>` → 必须引用档位
 *  B3 CSS/SCSS/HTML `border-radius: <px|rpx|rem 字面量>` → 必须写 var(--radius-*)
 *  B4 `rounded-[...]` 任意值 → 必须换档位类(或 var(--radius-*))
 *     唯一放行:`0` / `none` / `inherit` / 同行或紧邻上行含 `radius-exempt:` 标记(真圆、头像、
 *     装饰点、胶囊等几何圆按 AGENTS §4 豁免清单本就不该方档化,但必须写明原因,不得静默)。
 *  B 走基线棘轮:scripts/radius-single-source-baseline.json 之外的新增违规即红,存量只减不增。
 *
 * 用法:
 *   node scripts/check-radius-single-source.mjs              # 全量审计(基线外新增即红)
 *   node scripts/check-radius-single-source.mjs --staged     # pre-commit:只扫暂存文件
 *   node scripts/check-radius-single-source.mjs --self-test  # 判据正反例取证
 *   node scripts/check-radius-single-source.mjs --update-baseline  # 清理后下调基线(须人工确认)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE_FILE = join(ROOT, 'scripts/radius-single-source-baseline.json')
const isStaged = process.argv.includes('--staged')
const SELF_TEST = process.argv.includes('--self-test')
const UPDATE_BASELINE = process.argv.includes('--update-baseline')

/** 扫描范围:每端源码目录 */
const SCAN_DIRS = [
  'apps/web/app',
  'apps/web/src',
  'apps/miniapp-taro/src',
  'apps/mobile-rn/app',
  'apps/mobile-rn/src',
  'apps/mobile-rn/components',
  'packages/app/src',
  'packages/ui-react/src',
  'packages/ui-native/src',
  'packages/shared/src',
  'apps/extension/src',
  'apps/extension/entrypoints',
  'apps/desktop/src-tauri/offline',
  'apps/cli/src',
]
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'android', 'ios', '.expo', 'coverage', '.output', 'web-build', '__tests__', 'tests', 'e2e', 'test'])
/** 档位表自身的定义处(tokens.css / app.css 的 --radius-* 行)不参与 B3 判定 */
const TABLE_FILES = /styles[\\/]tokens\.css$/

const require_ = createRequire(import.meta.url)

function loadTable() {
  // radius.js 是 ESM;用 import() 取真实档位表(守门不复制常量,否则守门自己就成了第二份真相)
  // Windows 下绝对路径必须经 pathToFileURL,否则 ERR_UNSUPPORTED_ESM_URL_SCHEME(协议 'd:')
  return import(pathToFileURL(join(ROOT, 'packages/design-tokens/src/radius.js')).href)
}

function* walk(dir) {
  let es
  try {
    es = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of es) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(p)
    } else yield p
  }
}

const STAGED_SET = (() => {
  if (!isStaged) return null
  try {
    return new Set(
      execFileSync(process.execPath === '' ? 'git' : 'git', ['diff', '--cached', '--name-only'], { cwd: ROOT, encoding: 'utf8', windowsHide: true })
        .split('\n')
        .filter(Boolean)
        .map((f) => f.replaceAll('\\', '/')),
    )
  } catch {
    return null
  }
})()

const isCss = (f) => /\.(css|scss|less)$/.test(f)
const isJsx = (f) => /\.(tsx|jsx|ts)$/.test(f) && !/\.d\.ts$/.test(f)
const isDoc = (f) => /\.(md|json|snap|svg)$/.test(f)
const skipped = (rel) => rel.split('/').some((seg) => SKIP_DIRS.has(seg)) || /\.(test|spec)\.[jt]sx?$/.test(rel)

/** 从 CSS 文本里抽 --radius-* 定义(用于 A 表对账) */
export function readCssRadius(fileText) {
  const map = {}
  const re = /^\s*(--radius(?:-(?:xs|sm|md|lg|xl|2xl))?)\s*:\s*([0-9.]+)(rem|px)\s*;/gm
  let m
  while ((m = re.exec(fileText))) {
    const px = m[3] === 'rem' || m[3] === 'em' ? Number(m[2]) * 16 : Number(m[2])
    map[m[1]] = Number.isFinite(px) ? px : null
  }
  return map
}

/** B 判据:单文件 → 违规点列表。纯函数,自检直接复用 */
export function scanText(rel, text, table) {
  const bad = []
  const lines = text.split('\n')
  const steps = Object.entries(table.RADIUS_STEPS).map(([, v]) => v)
  const marked = (i) => /radius-exempt/.test(lines[i]) || (i > 0 && /radius-exempt/.test(lines[i - 1]))
  lines.forEach((line, i) => {
    const t = line.trim()
    if (/^(\/\/|\*|\/\*|<!--|#\s|;;)/.test(t)) return
    if (isCss(rel) || /\.html$/.test(rel)) {
      if (TABLE_FILES.test(rel)) return
      const m = /^(\s*border(?:-top|-bottom)?(?:-left|-right)?-radius\s*:\s*)([^;}\n]+)/.exec(line)
      if (m) {
        const val = m[2].trim()
        if (/var\(--radius|inherit|none/.test(val)) return
        const parts = val.split(/\s+/)
        for (const part of parts) {
          if (part === '0' || part === '0px' || part === '0rem') continue
          const mm = /^([0-9.]+)(rpx|px|rem|em)$/.exec(part)
          if (!mm) {
            if (/50%|9999px/.test(part) && !marked(i)) bad.push({ line: i + 1, rule: 'B3-circle', raw: part, hint: '真圆/胶囊须加 /* radius-exempt: 原因 */' })
            continue
          }
          const px = mm[2] === 'rpx' ? Number(mm[1]) / 2 : mm[2] === 'px' ? Number(mm[1]) : Number(mm[1]) * 16
          if (steps.includes(px) && !marked(i)) bad.push({ line: i + 1, rule: 'B3', raw: part, hint: `应写 var(--radius-*)(${table.stepOf(px) || px})` })
          else if (!steps.includes(px) && !marked(i)) bad.push({ line: i + 1, rule: 'B3-off', raw: part, hint: `偏档字面量;就近档位 = ${table.nearest(px)}` })
        }
      }
      const mh = /style=|border-radius/.test(line) && !isCss(rel) ? null : null
      void mh
      const arb = /\brounded(?:-[a-z0-9]+)*-\[([^\]]+)\]/g
      let a
      while ((a = arb.exec(line))) {
        if (/var\(--radius/.test(a[1]) || marked(i)) continue
        bad.push({ line: i + 1, rule: 'B4', raw: a[0], hint: '任意值须换档位类 rounded-<step>' })
      }
      return
    }
    if (!isJsx(rel)) return
    // RN / 内联 style
    const re = new RegExp(`\\bborder(?:Top|Bottom)?(?:Left|Right)?Radius\\s*:\\s*(${['rpx\\(\\s*[0-9.]+\\s*\\)', '-?[0-9.]+'].join('|')})`)
    const m = re.exec(line)
    if (m) {
      const raw = m[1]
      const px = raw.startsWith('rpx(') ? Number(raw.slice(4, -1)) / 2 : Number(raw)
      if (px === 0) return
      if (marked(i)) return
      const step = table.stepOf(px)
      const target = step === null ? `档位表无 ${px}px,就近 ${table.nearest(px)}` : step === '2xl' ? "rnRadius['2xl']" : `rnRadius.${step}`
      if (raw.startsWith('rpx(')) bad.push({ line: i + 1, rule: 'B1-rpx', raw, hint: `换算后 ${px}px → ${target}` })
      else bad.push({ line: i + 1, rule: 'B1', raw, hint: `应写 ${target}(几何圆请加 radius-exempt)` })
    }
    const mc = /^\s*(?:const|let)\s+([A-Za-z0-9_]*(?:RADIUS|Radius)[A-Za-z0-9_]*)\s*=\s*([0-9.]+)(?![0-9.]*\s*\/)/.exec(line)
    if (mc && !marked(i)) bad.push({ line: i + 1, rule: 'B2', raw: `${mc[1]}=${mc[2]}`, hint: '本地圆角常量应直接引用 rnRadius.<step>' })
    const arb = /\brounded(?:-[a-z0-9]+)*-\[([^\]]+)\]/g
    let a
    while ((a = arb.exec(line))) {
      if (/var\(--radius/.test(a[1]) || marked(i)) continue
      bad.push({ line: i + 1, rule: 'B4', raw: a[0], hint: '任意值须换档位类 rounded-<step>' })
    }
  })
  return bad
}

/** A 判据:四处档位表值一致性。返回红线列表 */
export async function checkTableConsistency() {
  const mod = await loadTable()
  const errors = []
  const table = { ...mod.RADIUS_STEPS }
  // 1) tokens.css
  const tokensCss = readFileSync(join(ROOT, 'packages/design-tokens/src/styles/tokens.css'), 'utf8')
  const cssMap = readCssRadius(tokensCss)
  const expectCss = { '--radius': table.DEFAULT, '--radius-xs': table.xs, '--radius-sm': table.sm, '--radius-md': table.md, '--radius-lg': table.lg, '--radius-xl': table.xl, '--radius-2xl': table['2xl'] }
  for (const [k, v] of Object.entries(expectCss)) {
    if (cssMap[k] === undefined) { errors.push(`tokens.css 缺少 ${k} 定义(应为 ${v}px)`); continue }
    if (Math.abs(cssMap[k] - v) > 0.001) errors.push(`tokens.css ${k}=${cssMap[k]}px 与 radius.js ${v}px 漂移`)
  }
  // 2) miniapp-taro app.css(端内同步块)
  const appCssPath = join(ROOT, 'apps/miniapp-taro/src/app.css')
  if (existsSync(appCssPath)) {
    const appMap = readCssRadius(readFileSync(appCssPath, 'utf8'))
    for (const [k, v] of Object.entries(expectCss)) {
      if (appMap[k] === undefined) continue // 端内可只同步子集
      if (Math.abs(appMap[k] - v) > 0.001) errors.push(`miniapp-taro app.css ${k}=${appMap[k]}px 与 radius.js ${v}px 漂移`)
    }
  }
  // 3) tailwind preset 必须引用 RADIUS_REM,不得重新内联字面量表
  const preset = readFileSync(join(ROOT, 'packages/design-tokens/src/tailwind-preset.js'), 'utf8')
  if (!/borderRadius:\s*RADIUS_REM\s*,?/.test(preset)) errors.push('tailwind-preset.js 的 borderRadius 必须写 `borderRadius: RADIUS_REM`,不得重新内联档位字面量')
  return { errors, table }
}

function loadBaseline() {
  try {
    const j = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'))
    return new Set((j.sites || []).map((s) => `${s.file}::${s.rule}::${s.raw}`))
  } catch {
    return new Set()
  }
}

async function selfTest() {
  const table = {
    RADIUS_STEPS: { xs: 2, sm: 4, DEFAULT: 8, md: 6, lg: 8, xl: 12, '2xl': 16 },
    stepOf: (px) => ({ 2: 'xs', 4: 'sm', 6: 'md', 8: 'lg', 12: 'xl', 16: '2xl' })[px] || null,
    nearest: (px) => [2, 4, 6, 8, 12, 16].reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a)),
  }
  const cases = [
    { name: 'B1 RN 数字字面量必拦', f: 'packages/app/src/x.tsx', s: 'const st = { a: { borderRadius: 8 } }', red: true },
    { name: 'B1 rnRadius 引用放行', f: 'packages/app/src/x.tsx', s: 'const st = { a: { borderRadius: rnRadius.lg } }', red: false },
    { name: 'B1 0 放行', f: 'packages/app/src/x.tsx', s: 'const st = { a: { borderRadius: 0 } }', red: false },
    { name: 'B1 几何圆带标记放行', f: 'packages/app/src/x.tsx', s: 'const st = { a: { borderRadius: 24 } } // radius-exempt: 48dp 头像正圆', red: false },
    { name: 'B1 rpx 绕档必拦', f: 'apps/mobile-rn/src/x.tsx', s: 'const st = { a: { borderRadius: rpx(16) } }', red: true },
    { name: 'B2 本地常量必拦', f: 'apps/mobile-rn/src/x.tsx', s: 'const CARD_RADIUS = 12', red: true },
    { name: 'B2 引用档位放行', f: 'apps/mobile-rn/src/x.tsx', s: 'const CARD_RADIUS = rnRadius.xl', red: false },
    { name: 'B3 CSS 字面量必拦', f: 'apps/miniapp-taro/src/a.css', s: '  border-radius: 24rpx;', red: true },
    { name: 'B3 CSS var 放行', f: 'apps/miniapp-taro/src/a.css', s: '  border-radius: var(--radius-xl);', red: false },
    { name: 'B3 圆形无标记必拦', f: 'apps/web/app/x.css', s: '  border-radius: 50%;', red: true },
    { name: 'B3 圆形带标记放行', f: 'apps/web/app/x.css', s: '  border-radius: 50%; /* radius-exempt: 头像 */', red: false },
    { name: 'B3 注释行放行', f: 'apps/web/app/x.css', s: '  /* border-radius: 24rpx; */', red: false },
    { name: 'B3 tokens.css 自身定义行放行', f: 'packages/design-tokens/src/styles/tokens.css', s: '  border-radius: 8px;', red: false },
    { name: 'B4 任意值必拦', f: 'apps/miniapp-taro/src/a.tsx', s: '<View className="rounded-[24rpx]" />', red: true },
    { name: 'B4 var 形式放行', f: 'apps/miniapp-taro/src/a.tsx', s: '<View className="rounded-[var(--radius-lg)]" />', red: false },
    { name: '档位类放行', f: 'apps/web/src/a.tsx', s: '<div className="rounded-lg p-2" />', red: false },
  ]
  let fail = 0
  for (const c of cases) {
    const bad = scanText(c.f, c.s, table)
    const hit = bad.length > 0
    const ok = hit === c.red
    console.log(ok ? '✅' : '❌', c.name, ok ? `(${bad.length} 违规)` : `→ 期望${c.red ? '红' : '绿'},实际${hit ? '红' : '绿'} ${JSON.stringify(bad.map((b) => b.rule))}`)
    if (!ok) fail++
  }
  // A 表对账:CSS 值漂移必须识别
  const css = '--radius: 0.5rem;\n  --radius-xs: 0.125rem;\n  --radius-sm: 0.3rem;\n'
  const map = readCssRadius(css)
  const driftOk = Math.abs(map['--radius-sm'] - 4.8) < 0.01
  console.log(driftOk ? '✅' : '❌', 'A 判据能读出 CSS 漂移值 sm=4.8px', driftOk ? '' : JSON.stringify(map))
  if (!driftOk) fail++
  // A 判据端到端:真实仓四处档位表必须一致(此例同时钉住 Windows 下 import() 必须走 pathToFileURL 的回归)
  let tableErr = []
  try {
    tableErr = (await checkTableConsistency()).errors
  } catch (e) {
    tableErr = [`checkTableConsistency 抛错:${e?.message || e}`]
  }
  console.log(tableErr.length === 0 ? '✅' : '❌', 'A 判据端到端:真实档位表四处一致', tableErr.length ? '→ ' + tableErr.join(' | ') : '')
  if (tableErr.length) fail++
  console.log(fail ? `\n${fail}/${cases.length + 2} 例失败` : `\n全部 ${cases.length + 2} 例通过`)
  process.exit(fail ? 1 : 0)
}

async function main() {
  if (SELF_TEST) {
    await selfTest()
    return 0
  }
  const { errors: tableErrors, table: rawTable } = await checkTableConsistency()
  const mod = await loadTable()
  const table = {
    RADIUS_STEPS: rawTable,
    stepOf: (px) => Object.keys(rawTable).find((k) => rawTable[k] === px && k !== 'DEFAULT') || null,
    nearest: (px) => [...new Set(Object.values(rawTable))].reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a)),
    mod,
  }
  const files = []
  if (isStaged && STAGED_SET) {
    for (const f of STAGED_SET) if (!skipped(f) && !isDoc(f)) files.push(f)
  } else {
    for (const d of SCAN_DIRS) for (const abs of walk(join(ROOT, d))) {
      const rel = relative(ROOT, abs).replaceAll('\\', '/')
      if (skipped(rel) || isDoc(rel) || /(^|\/)\.d\.ts$/.test(rel)) continue
      files.push(rel)
    }
  }
  const violations = []
  for (const rel of files) {
    let text
    try {
      text = readFileSync(join(ROOT, rel), 'utf8')
    } catch {
      continue
    }
    for (const v of scanText(rel, text, table)) violations.push({ file: rel, ...v })
  }
  const baseline = loadBaseline()
  const fresh = violations.filter((v) => !baseline.has(`${v.file}::${v.rule}::${v.raw}`))
  const healed = [...baseline].filter((k) => !violations.some((v) => `${v.file}::${v.rule}::${v.raw}` === k))

  if (UPDATE_BASELINE) {
    const sites = violations.map((v) => ({ file: v.file, rule: v.rule, raw: v.raw })).sort((a, b) => `${a.file}${a.rule}${a.raw}`.localeCompare(`${b.file}${b.rule}${b.raw}`))
    writeFileSync(BASELINE_FILE, `${JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), note: '存量圆角取用未迁移清单,只减不增;修一处删一行(禁止为过门而新增)', sites }, null, 2)}\n`)
    console.log(`[radius-guard] 基线已下调:${sites.length} 处存量`)
    return 0
  }

  console.log(`[radius-guard] 扫描 ${files.length} 文件 | 违规 ${violations.length} 处(基线内 ${violations.length - fresh.length} / 新增 ${fresh.length})| 基线已修 ${healed.length} 处`)
  if (tableErrors.length) {
    console.error('\n❌ 档位表漂移(单一源头被破,必须修):')
    for (const e of tableErrors) console.error('   -', e)
  }
  if (fresh.length) {
    const byRule = {}
    for (const v of fresh) byRule[v.rule] = (byRule[v.rule] || 0) + 1
    console.error(`\n❌ 新增 ${fresh.length} 处绕开圆角档位表(${Object.entries(byRule).map(([k, n]) => `${k}×${n}`).join(', ')}):`)
    for (const v of fresh.slice(0, 40)) console.error(`   ${v.file}:${v.line}  [${v.rule}] ${v.raw}  → ${v.hint}`)
    if (fresh.length > 40) console.error(`   ...另有 ${fresh.length - 40} 处`)
  }
  if (healed.length && !isStaged) console.log(`💡 ${healed.length} 处存量已修,可跑 node scripts/check-radius-single-source.mjs --update-baseline 下调基线`)
  const red = tableErrors.length > 0 || fresh.length > 0
  if (!red) console.log('✅ 圆角单一源头对账通过(档位表一致,无新增绕档取用)')
  return red ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then((code) => process.exit(code)).catch((e) => {
    console.error(`❌ 守门自身异常:${e?.stack || e}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
