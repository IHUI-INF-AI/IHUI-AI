// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * mobile-rn / packages/app 深色模式前景/容器回归守门(blocking)。
 *
 * 四类真实事故(2026-09-23 Drawer/StudyBar/UserInfoCard/主 CTA 深色复核):
 *  R1 品牌底白字:同一 style 对象里 `backgroundColor: (tokens|tk).brand.DEFAULT` 配
 *     `color: (tokens|tk).surface.light` / `.text.primary` —— 深色下 brand.DEFAULT
 *     翻成 #FFFFFF,前景必须用 brand.foreground(深色翻黑),否则白底白字。
 *     **2026-09-23 补盲**:原判据只认 `tokens.` 前缀,而 packages/app 共享组件一律写 `tk.`,
 *     等于共享包全程不在 R1 视野内。实测补盲后现存违规 0 处(非放宽,是真无违规)。
 *  R2 硬编码浅色容器 ratchet:`backgroundColor: tokens.surface.light`(两态恒白)、
 *     `rgba(255,255,255,α≥0.5)`(近实心白)、className `bg-white`(非 dark: 变体)。
 *     每文件计数与 scripts/brand-foreground-baseline.json 的 `counts` 比对,只减不增。
 *     范围保持 apps/mobile-rn/src(基线按此口径建立,扩范围会误伤存量)。
 *  R3 纯白填充 ratchet(2026-09-23 立):`(backgroundColor|borderColor): (tokens|tk).brand.DEFAULT`
 *     在深色档案下就是**纯白**(实测压 #1A1A1A 卡面 17.4:1 = 用户报的"刺眼")。
 *     主 CTA 一律 `brand.DEFAULT` + `brand.foreground` **成对**(= web 的 --color-primary /
 *     --color-primary-foreground,AGENTS §4 品牌 CTA 同源)。曾为此另立的端内档 `brand.ctaFill`/
 *     `brand.ctaText` 已于 2026-09-24 删除 —— 它是"RN 自成一份主按钮色"的第二真相源,删档后
 *     深色主按钮随 web 走纯白(要调观感改 tokens.css 的 .dark --color-primary 一处,三端同动)。
 *     本条不拦存量(基线冻结),只拦"新增/回潮"。范围含 packages/app。
 *
 * 用法:
 *   node scripts/check-brand-foreground.mjs                  # 全量
 *   node scripts/check-brand-foreground.mjs --staged         # 只看暂存文件
 *   node scripts/check-brand-foreground.mjs --update-baseline # 收紧基线(人工确认后;拒绝与 --staged 同用)
 *   node scripts/check-brand-foreground.mjs --self-test      # 逻辑自检
 * 紧急跳过:HUSKY_SKIP_BRAND_FOREGROUND=1
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BASELINE_PATH = path.join(__dirname, 'brand-foreground-baseline.json')

const SKIP_ENV = 'HUSKY_SKIP_BRAND_FOREGROUND'
// 前缀 `tokens.`(apps/mobile-rn 端)与 `tk.`(packages/app 共享组件的别名)必须同时认,
// 否则共享包整片不在判据视野内 —— 这正是 2026-09-23 补的盲区。
const TKS = '(?:tokens|tk)'
const R1_BG = new RegExp(`backgroundColor:\\s*${TKS}\\.brand\\.DEFAULT\\b`)
const R1_BAD_FG = new RegExp(`color:\\s*${TKS}\\.(?:surface\\.light|text\\.primary)\\b`)
const STYLE_OBJ_START = /^\s{2}[A-Za-z_$][\w$]*:\s*\{/
const STYLE_OBJ_END = /^ {2}\}/
const R2_SURFACE_LIGHT = /backgroundColor:\s*tokens\.surface\.light\b/
const R2_RGBA_WHITE = /backgroundColor:\s*['"]rgba\(255,\s*255,\s*255,\s*(0?\.\d+|1)\)/
const R2_BG_WHITE_CLASS = /\bbg-white\b/
const R3_BRAND_FILL = new RegExp(`(?:backgroundColor|borderColor):\\s*${TKS}\\.brand\\.DEFAULT\\b`)
/** R1/R3 扫描范围:RN 端 + 跨端共享包(两者深色语义同一套 rn-tokens) */
const SCAN_DIRS = ['apps/mobile-rn/src', 'packages/app/src']
/** R2 基线口径范围(扩范围会误伤未登记的存量,故与 SCAN_DIRS 分开) */
const R2_DIR = 'apps/mobile-rn/src'

/** 从源码行提取 style 属性块(2 空格缩进的顶层样式对象),返回块文本数组 */
export function extractStyleChunks(lines) {
  const chunks = []
  let current = null
  for (const line of lines) {
    if (current === null) {
      if (STYLE_OBJ_START.test(line)) {
        // 单行闭合的对象({ 与 } 配平)自成一块,防止吞并后续样式
        const opens = (line.match(/\{/g) ?? []).length
        const closes = (line.match(/\}/g) ?? []).length
        if (opens > 0 && opens === closes) chunks.push(line)
        else current = [line]
      }
    } else {
      current.push(line)
      if (STYLE_OBJ_END.test(line)) {
        chunks.push(current.join('\n'))
        current = null
      }
    }
  }
  if (current !== null) chunks.push(current.join('\n'))
  return chunks
}

/** R1:块内(或单行)同时出现 brand.DEFAULT 背景 + 恒白前景 → 白底白字缺陷 */
export function findR1Violations(lines) {
  const violations = []
  for (const chunk of extractStyleChunks(lines)) {
    if (R1_BG.test(chunk) && R1_BAD_FG.test(chunk)) violations.push(chunk.split('\n')[0].trim())
  }
  for (const line of lines) {
    if (R1_BG.test(line) && R1_BAD_FG.test(line)) violations.push(line.trim())
  }
  return violations
}

/** R2:单文件「浅色容器」计数(surface.light 背景 / α≥0.5 白 rgba / 非 dark: 的 bg-white) */
export function countLightContainers(lines) {
  let count = 0
  for (const line of lines) {
    if (R2_SURFACE_LIGHT.test(line)) count++
    const rgba = line.match(R2_RGBA_WHITE)
    if (rgba && Number.parseFloat(rgba[1]) >= 0.5) count++
    if (R2_BG_WHITE_CLASS.test(line) && !line.includes('dark:bg-')) count++
  }
  return count
}

/** R3:单文件「brand.DEFAULT 作填充/描边」计数(深色下即纯白) */
export function countCtaFills(lines) {
  let count = 0
  for (const line of lines) if (R3_BRAND_FILL.test(line)) count++
  return count
}

function isR2Scope(rel) {
  return rel.replace(/\\/g, '/').startsWith(`${R2_DIR}/`)
}

function listTargetFiles() {
  // git ls-files 只取跟踪文件,避免扫到 gitignore 的临时副本
  const out = execFileSync('git', ['ls-files', ...SCAN_DIRS], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
    .split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f))
  return out.map((rel) => path.join(ROOT, rel))
}

function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
  })
    .split('\n')
    .filter((f) => SCAN_DIRS.some((d) => f.startsWith(`${d}/`) && /\.(ts|tsx)$/.test(f)))
  return out.map((rel) => path.join(ROOT, rel))
}

function readLines(file) {
  return readFileSync(file, 'utf8').split('\n')
}

function run(options) {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭ ${SKIP_ENV}=1,跳过 mobile-rn 前景/容器守门`)
    return 0
  }
  // 基线是全量口径:与 --staged 同用会拿"暂存子集"覆盖整份基线,把未暂存文件的
  // 存量清零 → 下次全量恒红或误拦(与 scan-hardcoded-zh 同一条护栏)。
  if (options.updateBaseline && options.staged) {
    console.error('❌ --update-baseline 不得与 --staged 同用(基线须按全量口径收紧)')
    return 1
  }
  const all = listTargetFiles()
  const files = options.staged ? stagedFiles().filter((f) => all.includes(f)) : all
  if (options.staged && files.length === 0) {
    console.log('⏭ 暂存区无 apps/mobile-rn/src 或 packages/app/src 文件,跳过')
    return 0
  }

  const r1 = []
  const counts = {}
  const ctaCounts = {}
  for (const file of files) {
    if (!existsSync(file)) continue
    const lines = readLines(file)
    const rel = path.relative(ROOT, file).replace(/\\/g, '/')
    for (const v of findR1Violations(lines)) r1.push(`${rel} → ${v}`)
    if (isR2Scope(rel)) {
      const c = countLightContainers(lines)
      if (c > 0) counts[rel] = c
    }
    const cc = countCtaFills(lines)
    if (cc > 0) ctaCounts[rel] = cc
  }

  if (options.updateBaseline) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ counts, ctaCounts }, null, 2)}\n`)
    const sum = (o) => `${Object.keys(o).length} 文件 / ${Object.values(o).reduce((a, b) => a + b, 0)} 处`
    console.log(`✅ 基线已更新:R2 ${sum(counts)};R3 ${sum(ctaCounts)}`)
    return 0
  }

  let failed = false
  if (r1.length > 0) {
    failed = true
    console.error(`❌ R1 品牌底白字(brand.DEFAULT 背景 + surface.light/text.primary 前景,深色下白底白字):${r1.length} 处`)
    for (const v of r1) console.error(`   ${v}`)
  }

  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : {}
  const r2 = []
  for (const [file, count] of Object.entries(counts)) {
    const allowed = baseline.counts?.[file] ?? 0
    if (count > allowed) r2.push(`${file}: ${count} > 基线 ${allowed}`)
  }
  if (r2.length > 0) {
    failed = true
    console.error(`❌ R2 新增硬编码浅色容器(基线棘轮,只减不增):${r2.length} 文件`)
    for (const v of r2) console.error(`   ${v}`)
  }

  const r3 = []
  for (const [file, count] of Object.entries(ctaCounts)) {
    const allowed = baseline.ctaCounts?.[file] ?? 0
    if (count > allowed) r3.push(`${file}: ${count} > 基线 ${allowed}`)
  }
  if (r3.length > 0) {
    failed = true
    console.error(`❌ R3 新增纯白填充(brand.DEFAULT 深色档案=纯白,基线棘轮只减不增):${r3.length} 文件`)
    for (const v of r3) console.error(`   ${v}`)
  }

  if (failed) {
    console.error(
      [
        '',
        '  💡 修复:容器背景用 tokens.surface.card / surface.muted / surface.inputBg;',
        '     品牌底(brand.DEFAULT)上的文字用 tokens.brand.foreground(深色自动翻黑);',
        '     主 CTA / 选中态胶囊一律 brand.DEFAULT + brand.foreground 成对(= web 的 --color-primary',
        '     + --color-primary-foreground,AGENTS §4),不要逐处硬写颜色;',
        '     ⚠️ brand.ctaFill / ctaText 已于 2026-09-24 删除(消掉 RN 第二份主按钮色真相源),',
        '        不得按旧文档把它加回来 —— 对已删键的引用由守门 90 R3 判红;',
        '     覆盖在图片/彩色底上的白色前景属合法,基线棘轮只拦「比基线更多」。',
        '     收紧基线(人工确认后,全量口径):node scripts/check-brand-foreground.mjs --update-baseline',
        '     自检:node scripts/check-brand-foreground.mjs --self-test',
        `     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
        '',
      ].join('\n'),
    )
    return 1
  }
  console.log(
    `✅ mobile-rn/共享包 前景/容器守门通过(${files.length} 文件,R1=0,R2/R3 全部 ≤ 基线;R3 存量 ${Object.values(ctaCounts).reduce((a, b) => a + b, 0)} 处)`,
  )
  return 0
}

function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`❌ self-test 失败: ${msg}`)
      process.exit(1)
    }
  }
  // R1 正例:同一块内 brand 背景 + 恒白前景
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tokens.brand.DEFAULT,', '    color: tokens.surface.light,', '  },']).length === 1,
    'R1 应命中同块 brand 背景 + surface.light 前景',
  )
  // R1 正例:text.primary 前景同样恒白(深色)
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tokens.brand.DEFAULT,', '  },', '  btnText: {', '    color: tokens.text.primary,', '  },']).length === 0,
    'R1 不应跨块命中(text.primary 在另一块)',
  )
  // R1 反例:brand.foreground 是正确前景
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tokens.brand.DEFAULT,', '    color: tokens.brand.foreground,', '  },']).length === 0,
    'R1 不应命中 brand.foreground',
  )
  // R2 计数
  assert(countLightContainers(['    backgroundColor: tokens.surface.light,']) === 1, 'R2 surface.light 计 1')
  assert(countLightContainers(["    backgroundColor: 'rgba(255,255,255,0.6)',"]) === 1, 'R2 α=0.6 计 1')
  assert(countLightContainers(["    backgroundColor: 'rgba(255, 255, 255, 0.18)',"]) === 0, 'R2 α=0.18 是淡出层不计')
  assert(countLightContainers(['<View className="flex-1 bg-white">']) === 1, 'R2 className bg-white 计 1(Drawer 事故形态)')
  assert(countLightContainers(['<View className="bg-white dark:bg-gray-900">']) === 0, 'R2 dark: 变体不计')
  assert(countLightContainers(['  tabActive: {', '    backgroundColor: tokens.brand.DEFAULT,', '  },']) === 0, 'R2 brand 背景不计')
  // 块提取:未闭合块也应产出
  assert(extractStyleChunks(['  a: {', '    x: 1,']).length === 1, '未闭合块仍应提取')
  // R1 补盲:packages/app 共享组件一律写 `tk.`,原判据只认 tokens. → 共享包整片不可见
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tk.brand.DEFAULT,', '    color: tk.surface.light,', '  },']).length === 1,
    'R1 应命中 tk. 前缀(共享包补盲)',
  )
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tk.brand.DEFAULT,', '    color: tk.text.primary,', '  },']).length === 1,
    'R1 应命中 tk. 前缀 + text.primary 前景',
  )
  assert(
    findR1Violations(['  btn: {', '    backgroundColor: tk.brand.DEFAULT,', '    color: tk.brand.foreground,', '  },']).length === 0,
    'R1 不应命中 tk.brand.foreground(正确前景)',
  )
  // R3:brand.DEFAULT 填充/描边计数(与前景是否成对由 R1 管;退役档名 ctaFill 不计数,引用它即守门 90 的悬空红)
  assert(countCtaFills(['    backgroundColor: tokens.brand.DEFAULT,']) === 1, 'R3 tokens.brand.DEFAULT 背景计 1')
  assert(countCtaFills(['    borderColor: tk.brand.DEFAULT,']) === 1, 'R3 tk.brand.DEFAULT 描边计 1')
  assert(countCtaFills(['    backgroundColor: tokens.brand.ctaFill,']) === 0, 'R3 不计数退役档名 ctaFill(它已不存在,引用即守门 90 的悬空红)')
  assert(countCtaFills(['    color: tokens.brand.foreground,']) === 0, 'R3 不计前景色')
  assert(countCtaFills(['    backgroundColor: tokens.brand.DEFAULTISH,']) === 0, 'R3 边界:同前缀字段不得误计')
  console.log('✅ check-brand-foreground self-test 全部通过')
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  const options = {
    staged: argv.includes('--staged'),
    updateBaseline: argv.includes('--update-baseline'),
  }
  const code = argv.includes('--self-test') ? selfTest() : run(options)
  process.exit(code)
}

export const __test__ = { extractStyleChunks, findR1Violations, countLightContainers, countCtaFills }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
