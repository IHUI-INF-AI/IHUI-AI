#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D71 错误码覆盖率守门(G-98 判据,2026-09-24 立)。
//
// 立因:`attachErrorMeta`(packages/api-client/src/client.ts:1117)把后端 errorCode 原样
// 挂到 Error 上,但 web 侧真正产出标题的 `formatSSEError` **只按 HTTP 码分支**,
// errorCode 从不参与判据 —— 于是后端产出的每一个业务码在界面上都被压成同一句
// 「AI 服务异常」。D71 补了 `packages/shared/src/chat/error-catalog.ts` 这张
// errorCode → 标题/动作 表;本门负责让它**不会悄悄漏码**。
//
// 三条正交规则:
//   R1 覆盖   —— 我方产出的每个 errorCode 都必须在 catalog 里有条目(零「未知错误」兜底);
//   R2 八类   —— 台账点名的八类(CONTEXT_TOO_LONG / MEDIA_COUNT_EXCEEDED / MODEL_REFUSED /
//                REQUEST_TIMEOUT / INTERNAL_ERROR / VERSION_TOO_LOW / ACCOUNT_RESTRICTED /
//                TOKEN_EXPIRED)必须全部登记;
//   R3 零兜底 —— catalog 内不得出现 category='unknown'、不得出现 UNKNOWN 键,
//                且 zh-CN 词包的 `ai.pane.errorCatalog` 下不得出现「未知错误」字样。
//
// 判据有效性靠 --self-test 注入违规自证(不读脚本自己的注释):
// 尤其 R1 带阳性反演 —— 注入一个未收录 code 必须 exit 1,否则这条门形同虚设。
// 全量模式宁漏不误报:只扫 `packages/api-client/src` 与 `apps/ai-service/app` 的
// **显式 errorCode 字面量位**,不做全仓模糊匹配。
//
// 本门**已注册进 guardian-runner.mjs(守门 91,blocking,skipEnv=HUSKY_SKIP_ERROR_CODE_COVERAGE)**,
// 2026-09-24 由守门接线对账(门 89)从"造好没装车"名单里补装;改这句时请同步改 runner,
// 否则门 89 会把本行判成 R1「声称已接线但五处零命中」而拦下提交。
//   node scripts/check-error-code-coverage.mjs
//   node scripts/check-error-code-coverage.mjs --self-test
//   node scripts/check-error-code-coverage.mjs --list
// 反演(真实磁盘注入未收录码,不改仓库任何文件):
//   node scripts/check-error-code-coverage.mjs --scan-extra=<探针文件路径>

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** 唯一真相源:catalog 表本身。 */
const CATALOG_FILE = 'packages/shared/src/chat/error-catalog.ts'
/** 词包:零兜底判定要读真实中文串(读 key 判不出来)。 */
const MESSAGE_FILE = 'packages/i18n/messages/web/zh-CN.json'

/**
 * 扫描面:只登记"我方真的会产出 errorCode 的两棵树"。
 * 刻意不含 dist / tests —— dist 是产物(重复计数),tests 里的假码不是产出。
 */
const SCAN_ROOTS = [
  { dir: 'packages/api-client/src', exts: ['.ts', '.tsx'], lang: 'ts' },
  { dir: 'apps/ai-service/app', exts: ['.py'], lang: 'py' },
]

/** 目录 / 文件名排除:产物、测试、缓存。 */
const EXCLUDE_DIR = /(^|\/)(tests?|__tests__|__pycache__|dist|node_modules)(\/|$)/i
const EXCLUDE_FILE = /(^|\/)(test_[^/]*|_test)\.py$|(\.test|\.spec)\.[jt]sx?$/

/**
 * 显式字面量位:`"errorCode": "X"` / `errorCode="X"` / `errorCode: 'X'` / `errorCode 'X'`。
 *
 * 分隔符写成可选是有实证依据的:api-client 只在**注释**里写下 BUDGET_EXHAUSTED
 * (client.ts:925 / :1199,产出方是 apps/api),漏掉它就会让这条漏网。
 * 值形态限定 `^[A-Z][A-Z0-9_]{2,}$` —— 同时挡掉 `...`(docstring 省略号)、小写串与类型声明。
 */
const CODE_RE = /\berrorCode\b["']?\s*[:=]?\s*["']([A-Z][A-Z0-9_]{2,})["']/g

/**
 * api-client 常量位:`export const PROVIDER_QUOTA_EXHAUSTED = 'PROVIDER_QUOTA_EXHAUSTED'`。
 * 该码在 TS 侧只有常量形态(判定靠 `errorCode === PROVIDER_QUOTA_EXHAUSTED`,无引号字面量),
 * 只认含 QUOTA/ERROR/BUDGET/RATE/TIMEOUT/CODE 的常量名,避免咬到无关大写常量。
 */
const CONST_NAME_RE = /QUOTA|ERROR|BUDGET|RATE|TIMEOUT|CODE/
const CONST_RE = /export const ([A-Z][A-Z0-9_]*)\s*=\s*'([A-Z][A-Z0-9_]{3,})'/g

/** catalog 单条目行(解析脚本按行读,故表内每条必须保持单行三字段形状)。 */
const CATALOG_ENTRY_RE =
  /^ {2}([A-Z][A-Z0-9_]{2,}): \{ titleKey: '([^']*)', actionKey: '([^']*)', category: '([^']*)' \},$/gm

/** 八类块解析(TURN_ERROR_CLASSES 数组)。 */
const CLASS_BLOCK_RE = /export const TURN_ERROR_CLASSES = \[([\s\S]*?)\] as const/

/** D92 分类学合法取值(不另立第二套分类学)。 */
const VALID_CATEGORIES = new Set([
  'resourceNotFound',
  'runtimeException',
  'entrypointNotRegistered',
  'entrypointInvalid',
  'dependencyModuleMissing',
  'resourceLimitExceeded',
  'environmentInitFailed',
  'disabled',
  'backendTimeout',
  'backendExited',
  'capabilityNotOffered',
  'backendCrashed',
  'protocolMismatch',
  'authForbidden',
  'invalidResponse',
])
const UNKNOWN_CATEGORY = 'unknown'

// ---------------------------------------------------------------------------
// 扫描器
// ---------------------------------------------------------------------------

/** 递归收集待扫文件(相对 ROOT 的 POSIX 路径)。 */
export function collectFiles(root = ROOT, extraFiles = []) {
  const out = []
  for (const { dir, exts, lang } of SCAN_ROOTS) {
    const walk = (abs) => {
      let entries
      try {
        entries = readdirSync(abs, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        const p = join(abs, e.name)
        const rel = p.slice(root.length + 1).replace(/\\/g, '/')
        if (e.isDirectory()) {
          if (EXCLUDE_DIR.test(rel)) continue
          walk(p)
          continue
        }
        if (!exts.some((x) => e.name.endsWith(x))) continue
        if (EXCLUDE_DIR.test(rel) || EXCLUDE_FILE.test(rel)) continue
        out.push({ relPath: rel, lang, src: readFileSync(p, 'utf8') })
      }
    }
    walk(join(root, dir))
  }
  for (const p of extraFiles) {
    out.push({ relPath: p, lang: /\.(ts|tsx)$/.test(p) ? 'ts' : 'py', src: readFileSync(p, 'utf8') })
  }
  return out
}

/** 从单个源文本里抽出 errorCode 字面量(带行号,便于报错定位)。 */
export function extractCodes(relPath, src, lang) {
  const found = []
  const lineOf = (index) => src.slice(0, index).split('\n').length
  for (const m of src.matchAll(CODE_RE)) {
    found.push({ code: m[1], relPath, line: lineOf(m.index), why: 'errorCode 字面量' })
  }
  if (lang === 'ts') {
    for (const m of src.matchAll(CONST_RE)) {
      if (!CONST_NAME_RE.test(m[1])) continue
      found.push({ code: m[2], relPath, line: lineOf(m.index), why: `常量 ${m[1]}` })
    }
  }
  return found
}

/** 全量扫描 → 去重后的 errorCode 全集(排序,便于比对与打印)。 */
export function scanErrorCodes(files) {
  const seen = new Map()
  for (const f of files) {
    for (const hit of extractCodes(f.relPath, f.src, f.lang)) {
      if (!seen.has(hit.code)) seen.set(hit.code, hit)
    }
  }
  return [...seen.values()].sort((a, b) => a.code.localeCompare(b.code))
}

// ---------------------------------------------------------------------------
// catalog 解析
// ---------------------------------------------------------------------------

/** 读 catalog 源文件 → { entries, classes }。 */
export function parseCatalog(src) {
  const entries = []
  for (const m of src.matchAll(CATALOG_ENTRY_RE)) {
    entries.push({ code: m[1], titleKey: m[2], actionKey: m[3], category: m[4] })
  }
  const block = CLASS_BLOCK_RE.exec(src)
  const classes = block ? [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]) : []
  return { entries, classes }
}

/** 读 zh-CN 词包的 `ai.pane.errorCatalog` 子树。 */
export function readCatalogMessages(raw) {
  const parsed = JSON.parse(raw)
  const node = parsed?.ai?.pane?.errorCatalog
  if (!node) throw new Error(`${MESSAGE_FILE} 缺少 ai.pane.errorCatalog`)
  return node
}

// ---------------------------------------------------------------------------
// 三条规则
// ---------------------------------------------------------------------------

/** R1:产出的每个码都必须在 catalog 里有条目。 */
export function checkCoverage(scanned, catalog) {
  const known = new Set(catalog.entries.map((e) => e.code))
  return scanned
    .filter((hit) => !known.has(hit.code))
    .map((hit) => `R1 ${hit.relPath}:${hit.line} 产出的 errorCode '${hit.code}'(${hit.why}) 未收录 —— 补 ${CATALOG_FILE} 一行 + 五语言词包`)
}

/** R2:台账点名的八类必须全部登记。 */
export function checkClasses(catalog) {
  const known = new Set(catalog.entries.map((e) => e.code))
  return catalog.classes
    .filter((c) => !known.has(c))
    .map((c) => `R2 台账八类里的 '${c}' 未登记 —— 它是判据的一部分,不得只在 TURN_ERROR_CLASSES 里挂名`)
}

/** R3:零兜底 —— 不许有 unknown 分类、UNKNOWN 键,zh-CN 词包里不许出现「未知错误」。 */
export function checkNoFallback(catalog, messages) {
  const problems = []
  for (const e of catalog.entries) {
    if (e.category === UNKNOWN_CATEGORY) {
      problems.push(`R3 catalog 条目 '${e.code}' 的分类是 '${UNKNOWN_CATEGORY}' —— 零兜底判据不允许`)
    }
    if (!VALID_CATEGORIES.has(e.category)) {
      problems.push(`R3 catalog 条目 '${e.code}' 的分类 '${e.category}' 不在 D92 分类学内`)
    }
    if (!e.titleKey || !e.actionKey) {
      problems.push(`R3 catalog 条目 '${e.code}' 缺 titleKey / actionKey`)
    }
    // 只咬**恰恰叫 UNKNOWN** 的兜底条目。UNKNOWN_API_TOOL 这类"不知道是哪个工具"的
    // 真实业务码(标题是「未找到目标资源」)不是兜底 —— 判据宽一格就会误伤真实码。
    if (e.code === 'UNKNOWN') {
      problems.push(`R3 catalog 出现 UNKNOWN 兜底条目 —— 就是「未知错误」兜底,不得存在`)
    }
  }
  for (const [code, node] of Object.entries(messages)) {
    for (const [field, value] of Object.entries(node ?? {})) {
      if (typeof value === 'string' && value.includes('未知错误')) {
        problems.push(`R3 词包 ai.pane.errorCatalog.${code}.${field} 出现「未知错误」兜底文案`)
      }
    }
  }
  return problems
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function runChecks({ root = ROOT, extraFiles = [] } = {}) {
  const files = collectFiles(root, extraFiles)
  const scanned = scanErrorCodes(files)
  const catalog = parseCatalog(readFileSync(join(root, CATALOG_FILE), 'utf8'))
  const messages = readCatalogMessages(readFileSync(join(root, MESSAGE_FILE), 'utf8'))
  const problems = [
    ...checkCoverage(scanned, catalog),
    ...checkClasses(catalog),
    ...checkNoFallback(catalog, messages),
  ]
  return { problems, scanned, catalog, files: files.length }
}

/** 注入违规自证:证明每条规则各自真的咬得住(不靠脚本自述)。 */
function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })

  const catalogSrc = readFileSync(join(ROOT, CATALOG_FILE), 'utf8')
  const base = parseCatalog(catalogSrc)
  const msgSrc = readFileSync(join(ROOT, MESSAGE_FILE), 'utf8')
  const msgs = readCatalogMessages(msgSrc)

  // —— 扫描器:咬得住的 ——
  t(
    '扫描器咬住 python 字典位 `"errorCode": "X"`',
    extractCodes('a.py', 'return {"ok": False, "errorCode": "NOT_CATALOGED_ONE"}', 'py').some(
      (h) => h.code === 'NOT_CATALOGED_ONE',
    ),
  )
  t(
    '扫描器咬住 python kwarg 位 `errorCode="X"`',
    extractCodes('a.py', 'raise Foo(errorCode="NOT_CATALOGED_TWO")', 'py').some(
      (h) => h.code === 'NOT_CATALOGED_TWO',
    ),
  )
  t(
    '扫描器咬住 TS 对象位 `errorCode: \'X\'`',
    extractCodes('a.ts', "const e = { errorCode: 'NOT_CATALOGED_THREE' }", 'ts').some(
      (h) => h.code === 'NOT_CATALOGED_THREE',
    ),
  )
  t(
    '扫描器咬住注释位 `errorCode \'X\'`(BUDGET_EXHAUSTED 只存在于注释,放过它就会漏网)',
    extractCodes('a.ts', "* errorCode 'BUDGET_EXHAUSTED'", 'ts').some(
      (h) => h.code === 'BUDGET_EXHAUSTED',
    ),
  )
  t(
    '扫描器咬住 TS 导出常量位(PROVIDER_QUOTA_EXHAUSTED 只有常量形态)',
    extractCodes('a.ts', "export const PROVIDER_QUOTA_EXHAUSTED = 'PROVIDER_QUOTA_EXHAUSTED'", 'ts').some(
      (h) => h.code === 'PROVIDER_QUOTA_EXHAUSTED',
    ),
  )
  // —— 扫描器:不该咬的 ——
  t(
    '扫描器不吃类型声明 `errorCode?: string`',
    extractCodes('a.ts', 'export interface E { errorCode?: string }', 'ts').length === 0,
  )
  t(
    '扫描器不吃标识符比较 `errorCode === PROVIDER_QUOTA_EXHAUSTED`',
    extractCodes('a.ts', 'if (errorCode === PROVIDER_QUOTA_EXHAUSTED) return', 'ts').length === 0,
  )
  t(
    '扫描器不吃 docstring 省略号 `"errorCode": "..."`',
    extractCodes('a.py', 'SSE_ERROR = "error"  # {"message", "errorCode": "..."}', 'py').length === 0,
  )
  t(
    '扫描器不吃无关大写常量(常量名不含 QUOTA/ERROR/BUDGET/RATE/TIMEOUT/CODE 一律放过)',
    extractCodes('a.ts', "export const MAX_RETRY = 'MAX_RETRY'", 'ts').length === 0,
  )
  t(
    `扫描器不吃 typeof 守卫里的 'string'(不是错误码)`,
    !extractCodes('a.ts', "if (typeof json.errorCode === 'string') {}", 'ts').some(
      (h) => h.code === 'string',
    ),
  )

  // —— R1 阳性反演:注入未收录码必须被咬 ——
  const injected = [
    { code: 'D71_PROBE_NOT_CATALOGED', relPath: '<injected>', line: 1, why: '反演探针' },
  ]
  t('R1 咬住未收录码(阳性反演:补表前必红)', checkCoverage(injected, base).length === 1)
  t(
    'R1 放过已收录码(不是恒红判据)',
    checkCoverage([{ code: 'TIMEOUT', relPath: 'x.py', line: 1, why: 'x' }], base).length === 0,
  )

  // —— R2 ——
  t(
    'R2 咬住八类缺登记(从表里删掉一类)',
    checkClasses({
      ...base,
      entries: base.entries.filter((e) => e.code !== 'TOKEN_EXPIRED'),
    }).some((p) => p.includes('TOKEN_EXPIRED')),
  )
  t('R2 现状八类全登记', checkClasses(base).length === 0)
  t('R2 八类数量 = 8', base.classes.length === 8)

  // —— R3 ——
  t(
    'R3 咬住 unknown 分类(零兜底)',
    checkNoFallback(
      { ...base, entries: [...base.entries, { code: 'X_Y_Z', titleKey: 'x', actionKey: 'y', category: 'unknown' }] },
      msgs,
    ).some((p) => p.includes("分类是 'unknown'")),
  )
  t(
    'R3 咬住 UNKNOWN 兜底条目',
    checkNoFallback(
      { ...base, entries: [...base.entries, { code: 'UNKNOWN', titleKey: 'UNKNOWN.title', actionKey: 'UNKNOWN.action', category: 'runtimeException' }] },
      msgs,
    ).some((p) => p.includes('UNKNOWN 兜底条目')),
  )
  t(
    'R3 放过 UNKNOWN_API_TOOL(真实业务码,不是兜底 —— 判据宽一格就误伤)',
    checkNoFallback(base, msgs).length === 0 && base.entries.some((e) => e.code === 'UNKNOWN_API_TOOL'),
  )
  t(
    'R3 咬住词包里的「未知错误」兜底文案',
    checkNoFallback(base, { ...msgs, TIMEOUT: { title: '未知错误', action: '重试' } }).some((p) =>
      p.includes('未知错误'),
    ),
  )
  t(
    'R3 咬住空 titleKey',
    checkNoFallback(
      { ...base, entries: [...base.entries, { code: 'A_B_C', titleKey: '', actionKey: 'y', category: 'runtimeException' }] },
      msgs,
    ).some((p) => p.includes('缺 titleKey')),
  )
  t(
    'R3 咬住分类越界(不在 D92 分类学内)',
    checkNoFallback(
      { ...base, entries: [...base.entries, { code: 'A_B_C', titleKey: 'x', actionKey: 'y', category: 'madeUp' }] },
      msgs,
    ).some((p) => p.includes('不在 D92 分类学内')),
  )
  t('R3 现状零兜底', checkNoFallback(base, msgs).length === 0)

  // —— 现状必须干净:否则本门一上手就红 ——
  const live = runChecks()
  if (live.problems.length > 0) for (const p of live.problems) console.error(`   · ${p}`)
  t('当前工作区零违规', live.problems.length === 0)
  t('扫描面非空(判据没在扫空气)', live.scanned.length > 50)
  t('catalog 条目数 ≥ 扫描到的码数', live.catalog.entries.length >= live.scanned.length)

  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
  return cases.every((c) => c.ok) ? 0 : 1
}

/** --list:打印扫描到的 errorCode 全集(给测试里的冻结清单做输入)。 */
function listCodes() {
  const { scanned, catalog } = runChecks()
  console.log(`# 扫描面:packages/api-client/src + apps/ai-service/app`)
  console.log(`# 产出的 errorCode:${scanned.length} 个 / catalog 条目:${catalog.entries.length} 条`)
  for (const hit of scanned) console.log(`${hit.code}\t${hit.relPath}:${hit.line}`)
  return 0
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  if (argv.includes('--list')) process.exit(listCodes())

  const extraFiles = []
  for (const arg of argv) {
    if (arg.startsWith('--scan-extra=')) extraFiles.push(arg.slice('--scan-extra='.length))
  }

  const { problems, scanned, catalog, files } = runChecks({ extraFiles })
  if (problems.length === 0) {
    console.log(
      `✅ 错误码覆盖率通过:扫 ${files} 个文件,产出 ${scanned.length} 个 errorCode,` +
        `catalog ${catalog.entries.length} 条全覆盖,八类齐全,零「未知错误」兜底`,
    )
    return
  }
  console.error(`❌ 错误码覆盖率发现 ${problems.length} 处问题:`)
  for (const p of problems) console.error(`   · ${p}`)
  console.error(`\n唯一真源:${CATALOG_FILE}`)
  console.error('改法:在 ERROR_CODE_CATALOG 补一行,并同步 packages/i18n/messages/web/*.json 五语言词包')
  process.exit(1)
}

/** 供 / 测试复用(被 import 时不执行 main(),见 isDirectRun 守卫)。 */
export const __test__ = {
  collectFiles,
  extractCodes,
  scanErrorCodes,
  parseCatalog,
  readCatalogMessages,
  checkCoverage,
  checkClasses,
  checkNoFallback,
  runChecks,
  CATALOG_FILE,
  MESSAGE_FILE,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
