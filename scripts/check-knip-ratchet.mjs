#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * Knip 棘轮门禁(ratchet)。
 *
 * 背景(2026-09-10 立):
 *   仓库历史死代码债规模很大(实测约 1000+ 未引用文件 / 1500+ 未用导出 / 1200+ 未用导出类型),
 *   外加框架装载型依赖(Taro plugin-*、@capacitor/*、expo-*、pino-pretty、tailwindcss-*、
 *   babel preset 等)全靠配置文件加载,knip 无法静态看到 → 结构性误报。
 *   直接 `knip`(发现问题即 exit 1)的结果是:门禁长期恒红、零信号,真实的新增死代码被淹没在
 *   历史噪声里。而一次性清空 1000+ 文件既有误删动态入口(Next route handler / Taro 页面 /
 *   扩展 entrypoints)的风险,也远超单次改动范围。
 *
 *   故改为「棘轮」:不要求一次清零历史债,但**禁止新增**。
 *     - 当前各项计数 <= 基线 → 通过(exit 0),并提示可收紧基线;
 *     - 任一项 > 基线 → 失败(exit 1),打印增量明细与修复指引。
 *
 * 2026-11-20 升级为「清单级差值棘轮」(计数棘轮的根本缺陷实测暴露后):
 *   计数基线的容差恒为 0,而 knip 跨平台会抖 1-2 项 ⇒ 要么恒红、要么放宽容差;
 *   放宽之后又看不见真新增。更致命的是**存量替换**:清 3 个旧死导出、新进 3 个新的,
 *   计数不变 ⇒ 门判绿而新债已入库。
 *   现值形态:基线里存每个未用符号的稳定键(文件::符号,不含行号),判定只问
 *   「当前面里不在基线清单的项」—— 新增即红,存量只报数,清偿了只提示收紧。
 *
 * 用法:
 *   node scripts/check-knip-ratchet.mjs             # 校验(CI 用)
 *   node scripts/check-knip-ratchet.mjs --update    # 用当前状态重写 knip-baseline.json(须干净面)
 *   node scripts/check-knip-ratchet.mjs --print     # 只打印当前计数与清单项数,不校验、不写基线
 *   node scripts/check-knip-ratchet.mjs --update-from <json> --provenance "<说明>"
 *                                                   # 用别处(干净 HEAD 树)量出的 knip JSON 写基线
 *
 * 环境变量:
 *   KNIP_RATCHET_TOLERANCE   每类允许的新增项数(默认 0)。仅在确认跨平台抖动时临时放宽。
 *
 * 说明:计数取自 `knip --reporter json` 的 issues 聚合,与终端报告的分节数字同源。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitRaw, readWorktreeFile } from './lib/face-reader.mjs'
import { classifyFace, detectConfigLoadFailures, diffItems, expandItems, provenanceNote } from './lib/knip-ratchet-face.mjs'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const BASELINE_PATH = join(ROOT, 'knip-baseline.json')
const KNIP_BIN = join(ROOT, 'node_modules', 'knip', 'bin', 'knip.js')

/**
 * 静态分析专用的环境供给 —— **口径单源就在这里**,CI 的 knip.yml 只是镜像(见该文件 env 段)。
 *
 * 为什么由棘轮自己供:这几个值只用于"让配置文件可被加载",不连库、不打包、不进产物;
 * 而对应的三处配置在缺值时都是**故意 fail-closed 抛错**的(判据本身正确,不能改弱):
 *   · packages/database/drizzle.config.ts —— 缺 DATABASE_URL 拒绝加载(旧默认指向 8810 生产隧道口)
 *   · apps/mobile-rn/app.config.js —— 缺微信支付三值拒绝加载(静态分析器用 dummy config 调用它)
 *   · apps/mobile-rn/metro.config.cjs —— nativewind 的 configPath 默认相对 cwd;已改为 __dirname,
 *     本条不再需要 env,保留说明是为了记录"为什么曾经从仓库根跑不动"
 * 供给值与真实值刻意不同形(库名带 _knip_static、域名用 .invalid),免得有人误把它当可用配置;
 * 真实构建(EAS/CI 打包)由各自 env 注入,与本常量无关。
 */
const STATIC_ANALYSIS_ENV = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/ihui_knip_static',
  WX_ANDROID_PACKAGE: 'zh.ai.sq',
  WX_APP_APPID: 'wx0123456789abcdef',
  EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK: 'https://static-analysis.invalid/app/',
}

// 与 knip json reporter 的 issue 字段一一对应;顺序即输出顺序
const CATEGORIES = [
  'files',
  'exports',
  'types',
  'duplicates',
  'enumMembers',
  'namespaceMembers',
  'dependencies',
  'devDependencies',
  'optionalPeerDependencies',
  'unlisted',
  'binaries',
  'unresolved',
]

const CATEGORY_LABEL = {
  files: '未引用文件',
  exports: '未用导出',
  types: '未用导出类型',
  duplicates: '重复导出',
  enumMembers: '未用枚举成员',
  namespaceMembers: '未用命名空间成员',
  dependencies: '未用依赖',
  devDependencies: '未用开发依赖',
  optionalPeerDependencies: '未用可选 peer 依赖',
  unlisted: '未声明依赖',
  binaries: '未声明二进制',
  unresolved: '无法解析的导入',
}

function runKnipJson() {
  if (!existsSync(KNIP_BIN)) {
    console.error(`[knip-ratchet] ❌ 未找到 knip:${KNIP_BIN}(请先 pnpm install)`)
    process.exit(2)
  }
  const env = { ...process.env, CODEBUDDY_SAFE_DELETE_ENABLED: '0' }
  // 只补空缺:显式导出的值优先(本机想量特定库/特定 appId 时不必改脚本)
  for (const [k, v] of Object.entries(STATIC_ANALYSIS_ENV)) if (!env[k]) env[k] = v
  const result = spawnSync(process.execPath, [KNIP_BIN, '--reporter', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    // 保持与本仓库其它守门脚本一致的删除守护豁免(pnpm/knip 内部可能创建临时目录)
    env,
    windowsHide: true,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) {
    console.error(`[knip-ratchet] ❌ 无法启动 knip:${result.error.message}`)
    process.exit(2)
  }
  // 判据顺序不能反:先问"这次到底量全了没有",再读 JSON —— knip 在插件配置加载失败时
  // 只把该配置从入口面摘掉、进程仍 exit 0,JSON 照出。只读 JSON 会把"少了一整块面"
  // 当成绿读数(2026-11-04 实测:干净检出上 5 处同时失败,而棘轮一路判绿/判红都与此无关)。
  const loadFailures = detectConfigLoadFailures(result.stderr)
  if (loadFailures.length > 0) {
    console.error(
      `[knip-ratchet] ❌ ${loadFailures.length} 个 knip 插件配置加载失败 ⇒ 本次读数是被降级的面,不可比:`,
    )
    for (const f of loadFailures) {
      console.error(`[knip-ratchet]    · ${f.path}`)
      console.error(`[knip-ratchet]      ${f.cause}`)
    }
    console.error('[knip-ratchet]    按 cause 修,不要放过 —— knip 侧"没报错"只代表它没算那一块:')
    console.error(
      "[knip-ratchet]      · File './.wxt/tsconfig.json' not found ⇒ 在 apps/extension 下跑 `wxt prepare`(CI 有独立步骤)",
    )
    console.error(
      `[knip-ratchet]      · 缺 env 类 ⇒ 本脚本已供 ${Object.keys(STATIC_ANALYSIS_ENV).join(' / ')};` +
        ' 仍失败说明该配置读的是别的值,按 cause 补进 STATIC_ANALYSIS_ENV',
    )
    console.error(
      '[knip-ratchet]      · 路径解析类 ⇒ 配置文件不得依赖 process.cwd()(参照 apps/mobile-rn/metro.config.cjs 用 __dirname)',
    )
    process.exit(2)
  }
  const stdout = result.stdout ?? ''
  const start = stdout.indexOf('{')
  if (start < 0) {
    console.error('[knip-ratchet] ❌ knip 未产出 JSON。stderr 摘要:')
    console.error((result.stderr ?? '').slice(0, 2000))
    process.exit(2)
  }
  try {
    return JSON.parse(stdout.slice(start))
  } catch (e) {
    console.error(`[knip-ratchet] ❌ knip JSON 解析失败:${e.message}`)
    process.exit(2)
  }
}

function countByCategory(report) {
  const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0]))
  for (const issue of report.issues ?? []) {
    for (const c of CATEGORIES) {
      const arr = issue[c]
      if (Array.isArray(arr)) counts[c] += arr.length
    }
  }
  return counts
}

function total(counts) {
  return Object.values(counts).reduce((a, b) => a + b, 0)
}

const args = new Set(process.argv.slice(2))
const tolerance = Number.parseInt(process.env.KNIP_RATCHET_TOLERANCE ?? '0', 10) || 0

/** 取带值选项(如 `--update-from <file>`);缺失返回 null。 */
function argValue(flag) {
  const argv = process.argv.slice(2)
  const i = argv.indexOf(flag)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}

/**
 * 口径闸门(2026-09-26 立):`knip` 读磁盘,而基线锚点是**内容**读数 —— 本机共享工作树常年
 * 带着并发会话的未提交改动,此时量到的数与 CI(干净检出)结构上不可比:拿它判红会误伤,
 * 拿它 `--update` 更糟(数被永久记偏)。实测教训就在本文件的历史里:今天有一枚 `--update`
 * 把基线从 3781 抬到 4314,量它的那份树当时并不干净。
 * 判据本身拆到 `scripts/lib/knip-ratchet-face.mjs`(纯函数,镜像测试直接喂构造面)。
 */
function dirtyPathCount() {
  // 先分清"这里是不是 git 检出"与"git 问不到":前者是本仓做 HEAD 干净验证用的隔离树
  // (git archive 出去、无 .git),它的内容就是被量面;只有后者才是无法判定。
  // 混成一种,这道闸门就会恰好挡住唯一正确的基线记录方式。
  try {
    gitRaw(['rev-parse', '--is-inside-work-tree'], ROOT, { timeout: 30_000 })
  } catch {
    return { insideRepo: false, dirty: 0, paths: [] }
  }
  try {
    // gitRaw 已自带 `-c safe.directory=*` 与 `-C <root>`,此处不再重复传
    const out = gitRaw(['status', '--porcelain'], ROOT, { timeout: 60_000 })
    const paths = out.split('\n').filter((l) => l.trim() !== '')
    return { insideRepo: true, dirty: paths.length, paths }
  } catch {
    return { insideRepo: true, dirty: null, paths: [] } // 问不到条数 ⇒ 判"无法判定",不猜可比
  }
}

/**
 * 脏路径点名(2026-10-23 立):判据只报"有 N 个未提交改动"时,"那 N 个到底是什么"
 * 要人去做一次考古 —— 实测 CI 那条 "1 个未提交改动" 的真凶是 pnpm 在 Linux 上把
 * storeDir 的 Windows 绝对路径当相对路径,在检出里造出 `D:/` 目录;从条数本身看不出来。
 * 这里只加取证、不改判定:判定仍由 classifyFace 出,退出码一字不动。
 */
function printDirtyPaths(paths, limit = 15) {
  if (!Array.isArray(paths) || paths.length === 0) return
  console.error(`[knip-ratchet]    脏面取证(git status --porcelain,共 ${paths.length} 行,前 ${Math.min(limit, paths.length)} 行):`)
  for (const line of paths.slice(0, limit)) console.error(`[knip-ratchet]      ${line}`)
  if (paths.length > limit) {
    console.error(`[knip-ratchet]      …另有 ${paths.length - limit} 行未打印(完整清单:git status --porcelain)`)
  }
}

const { insideRepo, dirty, paths: dirtyPaths } = dirtyPathCount()
const isolated = insideRepo === false
const face = classifyFace({
  ci: process.env.CI === 'true' || process.env.CI === '1',
  dirtyCount: dirty,
  insideRepo,
})
const forced = args.has('--allow-dirty')
// `--update-from` 的读数来自别处的 JSON(典型:git archive 出的干净 HEAD 树里跑的 knip),
// 与本机工作树的脏与否无关;它的可比性由 --provenance 的必填说明承担。故不受脏面闸门拦截。
if (face.verdict !== 'comparable' && !forced && !args.has('--print') && !args.has('--update-from')) {
  console.error(`[knip-ratchet] ❌ 口径不可比(${face.verdict}):${face.reason}`)
  printDirtyPaths(dirtyPaths)
  console.error('[knip-ratchet]    问责面是 CI 的干净检出;本机只想看数请跑 --print(不判、不写基线)。')
  console.error('[knip-ratchet]    确需在当前状态下写基线:`--update --allow-dirty`(会把 DIRTY 出处写进基线的 recordedFrom,不静默)。')
  process.exit(2)
}


// ---------------------------------------------------------------- 人工写基线(两条通道)
/**
 * `--update-from <json> --provenance <说明>`:用**别处量出来的 knip JSON**写基线。
 * 这条通道存在的唯一理由:基线必须来自干净面,而本机是常年几百个未提交改动的共享工作树
 * (`--update` 会被脏面闸门拦下)。正确做法是 `git archive <sha>` 出只读树、接好依赖、在其中
 * 跑一次 `knip --reporter json`,再把那份 JSON 交给这里。
 * 因此它**不校验配置加载完整性**(stderr 不在 JSON 里) —— 由 --provenance 的必填说明自证,
 * 说明会逐字写进基线的 recordedFrom,供审查追溯。
 */
function buildBaselinePayload({ fromItems, fromCounts, recordedFrom: fromNote }) {
  return {
    // 说明:这是「允许存在的历史债上限」。只允许通过修复来收紧(重新 --update),
    // 不允许为了过门禁而放大——放大会在 PR 审查中被看见。
    note: 'Knip 棘轮基线(差值棘轮形态):counts 只作报数;判定看 items——当前面里凡是基线 items 没有的符号一律判红(只拦新增,存量不判)。',
    recordedFrom: fromNote,
    generatedAt: new Date().toISOString(),
    total: total(fromCounts),
    counts: fromCounts,
    items: fromItems,
  }
}

const updateFrom = argValue('--update-from')
if (updateFrom) {
  const provenance = argValue('--provenance')
  if (!provenance || provenance.trim().length < 8) {
    console.error(
      '[knip-ratchet] ❌ --update-from 必须同时给 --provenance "<这份 JSON 从哪量出来的,含 sha/环境>"(≥8 字)。' +
        '该说明会逐字写进基线 recordedFrom,是这条通道唯一的可比性凭据。',
    )
    process.exit(2)
  }
  let raw
  try {
    raw = readFileSync(updateFrom, 'utf8')
  } catch (e) {
    console.error(`[knip-ratchet] ❌ 读不到 --update-from 指定的 JSON:${updateFrom}(${e.message})`)
    process.exit(2)
  }
  let reportFrom
  try {
    reportFrom = JSON.parse(raw)
  } catch (e) {
    console.error(`[knip-ratchet] ❌ --update-from 的 JSON 解析失败:${e.message}`)
    process.exit(2)
  }
  if (!Array.isArray(reportFrom?.issues)) {
    console.error('[knip-ratchet] ❌ --update-from 的 JSON 不是 `knip --reporter json` 的产物(缺 issues 数组)')
    process.exit(2)
  }
  const fromCounts = countByCategory(reportFrom)
  const fromItems = expandItems(reportFrom, CATEGORIES)
  const payload = buildBaselinePayload({
    fromItems,
    fromCounts,
    recordedFrom: `recordedFrom: manual-json(${updateFrom.split(/[\\/]/).pop()}) —— ${provenance.trim()}`,
  })
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`[knip-ratchet] 已从外部 JSON 写入基线(total=${payload.total},来源:${provenance.trim()})`)
  console.log('[knip-ratchet] 请把 knip-baseline.json 一并提交(它是门禁的一部分)。')
  process.exit(0)
}

// 到这里才真正跑 knip:--update-from 的读数来自外部 JSON,不该为它白跑一遍全仓扫描。
const report = runKnipJson()
const counts = countByCategory(report)
// 清单是判定面,计数只作报数(见 expandItems 的注释:计数维容差恒 0 挡不住"存量替换")
const items = expandItems(report, CATEGORIES)
const currentTotal = total(counts)

if (args.has('--print')) {
  console.log(`[knip-ratchet] 当前计数 total=${currentTotal}`)
  for (const c of CATEGORIES) {
    const symCount = Object.values(items[c] ?? {}).reduce((a, arr) => a + arr.length, 0)
    console.log(`  ${c.padEnd(24)} ${String(counts[c]).padStart(6)} 清单项=${symCount}`)
  }
  process.exit(0)
}

// BUG-43③:基线缺失时**自动生成**基线并 exit 0 ⇒ 删基线重跑一次就把门槛抬到当前值。
// 基线不在位 = 拿不到比较基准 ⇒ 未判定(exit 2),绝不自动生成放行;只有显式 --update 才是人工动作。
if (!existsSync(BASELINE_PATH)) {
  console.error(
    '[knip-ratchet] ❌ 未判定:基线 knip-baseline.json 不在位 ⇒ 无法判定(不得自动生成基线把门槛抬到当前值);' +
      '请先人工核对当前计数,再显式运行 node scripts/check-knip-ratchet.mjs --update 生成并提交。',
  )
  process.exit(2)
}

if (args.has('--update')) {
  const payload = buildBaselinePayload({
    fromItems: items,
    fromCounts: counts,
    // 出处必须随数走:同一组数字从脏树量出来和从干净检出量出来不是一回事(见 classifyFace)。
    recordedFrom: provenanceNote({
      comparable: face.verdict === 'comparable',
      dirtyCount: dirty,
      forced,
      isolated,
    }),
  })
  writeFileSync(BASELINE_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`[knip-ratchet] 已更新基线 → knip-baseline.json(total=${currentTotal})`)
  console.log('[knip-ratchet] 请把该文件一并提交(它是门禁的一部分)。')
  process.exit(0)
}

const baseline = JSON.parse(readWorktreeFile(ROOT, 'knip-baseline.json') ?? '')
const baseCounts = baseline.counts ?? {}
// 基线形态决定判据:items 在位 = 差值棘轮(只拦新增);缺 items = 老形态,只能按计数判(存量会误红)。
const baseItems = baseline.items && typeof baseline.items === 'object' ? baseline.items : null
const itemDiff = baseItems ? diffItems(items, baseItems) : null

if (!baseItems) {
  console.error(
    '[knip-ratchet] ⚠️ 基线尚未升级到「清单形态」(无 items 字段)⇒ 本次只能按计数判定,' +
      '在役文件里的历史存量会把结果判成红。升级方式:干净面跑 knip --reporter json,' +
      '再 `--update-from <json> --provenance "<sha 与环境>"`。',
  )
}

console.log('[knip-ratchet] 类别                    当前    基线    增量')
const regressions = []
const addedByCat = []
for (const c of CATEGORIES) {
  const cur = counts[c] ?? 0
  const base = baseCounts[c] ?? 0
  const delta = cur - base
  const added = itemDiff ? (itemDiff.added[c] ?? []) : []
  const flag = itemDiff ? (added.length > tolerance ? ' ❌' : '') : delta > tolerance ? ' ❌' : ''
  console.log(
    `[knip-ratchet] ${c.padEnd(24)} ${String(cur).padStart(5)} ${String(base).padStart(7)} ${String(
      delta >= 0 ? `+${delta}` : delta,
    ).padStart(7)}  新增项=${itemDiff ? added.length : '-'}${flag}`,
  )
  if (itemDiff) {
    if (added.length > 0) addedByCat.push({ c, added })
  } else if (delta > tolerance) regressions.push({ c, cur, base, delta })
}

const addedTotal = addedByCat.reduce((a, x) => a + x.added.length, 0)
const resolvedTotal = itemDiff
  ? Object.values(itemDiff.resolved).reduce((a, arr) => a + arr.length, 0)
  : 0

if (itemDiff && addedTotal > tolerance) {
  console.error('')
  console.error(
    `[knip-ratchet] ❌ 本次新增死代码/依赖问题 ${addedTotal} 项(基线里没有的符号;存量 ${resolvedTotal} 项已清偿不判):`,
  )
  for (const { c, added } of addedByCat) {
    console.error(`[knip-ratchet]    · ${CATEGORY_LABEL[c] ?? c}(${c}) +${added.length}:`)
    const shown = added.slice(0, 12)
    for (const a of shown) console.error(`[knip-ratchet]        ${a.file} :: ${a.key}`)
    if (added.length > shown.length) console.error(`[knip-ratchet]        …另有 ${added.length - shown.length} 项`)
  }
  console.error('[knip-ratchet]    修复:删除/内联上述符号,或为其补上真实消费方;框架装载型依赖补 knip.jsonc 的')
  console.error('[knip-ratchet]    ignoreDependencies / ignoreBinaries(附理由)。')
  console.error('[knip-ratchet]    门禁只拦「新增」:历史存量已在基线清单里,不需要你承受。')
  process.exit(1)
}

if (!itemDiff && regressions.length > 0) {
  console.error('')
  console.error(
    `[knip-ratchet] ❌ 检出新增死代码/依赖问题(共 ${regressions.length} 类超出计数基线,容差 ${tolerance}):`,
  )
  for (const r of regressions) {
    console.error(
      `[knip-ratchet]    · ${CATEGORY_LABEL[r.c] ?? r.c}(${r.c}):${r.base} → ${r.cur} (+${r.delta})`,
    )
  }
  console.error(
    '[knip-ratchet]    这是老形态(计数字典)下的判定:先按下面的方式把基线升级成清单形态,' +
      '再判断红的是不是本次引入:',
  )
  console.error(
    '[knip-ratchet]    node scripts/check-knip-ratchet.mjs --update-from <干净面 JSON> --provenance "<sha 与环境>"',
  )
  process.exit(1)
}

console.log('')
if (itemDiff) {
  console.log(
    `[knip-ratchet] ✅ 无新增项(当前 total ${currentTotal};基线清单存量 ${baseline.total ?? '?'};` +
      `本次已清偿 ${resolvedTotal} 项;容差 ${tolerance})`,
  )
  if (resolvedTotal > 0) {
    console.log('[knip-ratchet] 💡 有存量被清偿,可在干净面重跑 --update 收紧基线(把清单一起收紧)。')
  }
} else {
  console.log(
    `[knip-ratchet] ✅ 未超过计数基线(total ${currentTotal} ≤ ${baseline.total ?? '?'};容差 ${tolerance})`,
  )
  if (currentTotal < (baseline.total ?? Number.POSITIVE_INFINITY)) {
    console.log(
      `[knip-ratchet] 💡 已低于基线 ${(baseline.total ?? 0) - currentTotal} 项,可运行 --update 收紧基线。`,
    )
  }
}
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
