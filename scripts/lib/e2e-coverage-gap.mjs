// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * e2e-coverage-gap.mjs —— 「某源码模块没有任何对应测试文件」的**唯一判据**(纯函数层,2026-10-25 立)。
 *
 * 只回答一个问题:给定**同一判定面**上的全部文件与测试文件,射程目录内哪些源码模块
 * 找不到按命名约定映射过来的测试?它**不读盘、不派生 git、不生成测试**(骨架生成属
 * `scripts/e2e-autofill.mjs` 的后续格)。取材面由调用方(`check-e2e-coverage-gap.mjs`)
 * 按 AGENTS §0.4 三面负责,本层只吃已取到的文本。
 *
 * 命名约定映射(唯一实现,别的门/测试必须 import 这里,禁止各抄一份 —— §0.6 / §22c):
 *   ① 同目录同名:`dir/x.ts` ← `dir/x.test.ts` / `dir/x.spec.ts`(扩展名可跨 ts/tsx/js/jsx/mjs/cjs);
 *   ② 同目录测试目录:`dir/x.ts` ← `dir/__tests__/x*`(逐字前缀,**但必须落在词边界**
 *      `.` / `-` / `_`,否则 `user.ts` 会被 `users.test.ts` 冒充成绿 —— 失效方向必须指向
 *      "多要一次说明",绝不能"多放一次跳门" §0.10)。
 * 只认这两条:更宽的"同根目录任意 stem 相同"会让 `apps/web/e2e/*.spec.ts` 与业务模块
 * 意外相撞,是静默假绿的入口,故不设。
 *
 * 三档结论(§0.3「没判绝不写成判过」):
 *   · `module` —— 有**运行时导出**且没有任何约定测试命中 ⇒ `gaps`;
 *   · `skipped` —— 不计入缺口的**已知非模块形态**:测试/夹具目录、`.d.ts`、纯类型文件、
 *     空导出文件、纯转发桶(只有 import / `export … from`,无自有实现)、资源文件;
 *   · `undetermined` —— 判不了,逐条点名:`无扩展名` / `未知扩展名` / `生成物` / `取不到内容`。
 *     前三种"可能真是模块"的形态(`blocks: true`)由门折成 exit 2;**生成物**只点名
 *     (`blocks: false`),否则本仓 3 枚 `*.generated.ts` 会把门变成恒红门(§12e)。
 *
 * 棘轮口径(§0.5,锚点 = 该文件在被审面的对照面上的自身状态):
 *   缺口是**逐模块的 0/1 事实**,所以锚点就是"该模块在基底(HEAD)面是否已是缺口"。
 *   `diffGaps` 只把"基底不是缺口、被审面成了缺口"归 `newGaps`(新增);基底已是缺口的归
 *   `stock`(存量只报数)。测试被删 ⇒ 模块从"有测试"变成缺口 ⇒ 正确地落进新增。
 */

import { basename, dirname, extname } from 'node:path'

import { maskComments, maskCommentsAndStrings } from './code-mask.mjs'

/** 计入"可能是源码模块"的扩展名。之后新增语言必须同笔扩表,否则会落 undetermined。 */
export const SOURCE_EXTS = Object.freeze(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/** 测试命名约定(按长度降序无所谓:全部各自 endsWith 判定)。 */
export const TEST_SUFFIXES = Object.freeze([
  '.test.ts',
  '.test.tsx',
  '.test.js',
  '.test.jsx',
  '.test.mjs',
  '.test.cjs',
  '.spec.ts',
  '.spec.tsx',
  '.spec.js',
  '.spec.jsx',
  '.spec.mjs',
  '.spec.cjs',
])

/**
 * 已知**非源码**形态:静默跳过不是"没判",而是判过"这不是模块"(资源/样式/声明)。
 * 不在本表、也不在 SOURCE_EXTS 的扩展名一律落 undetermined —— 新语言(.vue/.svelte/.mts)
 * 出现时必须让人看见,而不是被当成资源悄悄放过。
 */
export const KNOWN_NON_SOURCE_EXTS = Object.freeze([
  '.css',
  '.scss',
  '.less',
  '.sass',
  '.json',
  '.jsonc',
  '.md',
  '.mdx',
  '.txt',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.avif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.eot',
  '.map',
  '.yaml',
  '.yml',
  '.html',
  '.snap',
  '.graphql',
  '.gql',
  '.wasm',
])

/** 测试/夹具目录段:里面的文件既不判模块,也不当"模块的测试"(由 isTestFile 单独判)。 */
export const NON_SOURCE_DIR_SEGMENTS = Object.freeze([
  '__tests__',
  '__mocks__',
  '__fixtures__',
  'tests',
  'test',
  'e2e',
  'fixtures',
])

/** 生成物自述标记。命中即 undetermined(`blocks:false`,只点名不判红,§12e)。 */
export const GENERATED_MARKERS = Object.freeze([
  { re: /@generated\b/i, label: '@generated' },
  { re: /\bDO NOT EDIT\b/i, label: 'DO NOT EDIT' },
  { re: /\bauto-?generated\b/i, label: 'auto-generated' },
  { re: /此文件[^\n]{0,30}生成/, label: '中文生成物声明' },
])

export function normalizePath(value) {
  return String(value ?? '')
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '')
}

export function extOf(rel) {
  const base = basename(normalizePath(rel))
  const idx = base.lastIndexOf('.')
  return idx <= 0 ? '' : base.slice(idx).toLowerCase()
}

export function isTestFile(rel) {
  const p = normalizePath(rel)
  return TEST_SUFFIXES.some((suffix) => p.endsWith(suffix))
}

function isInNonSourceDir(rel) {
  const dir = dirname(normalizePath(rel))
  if (dir === '.' || dir === '') return false
  return dir.split('/').some((seg) => NON_SOURCE_DIR_SEGMENTS.includes(seg))
}

/** `x.test.ts` / `x.spec.tsx` → `x`;非测试名退回"去掉最后一段扩展名"。 */
function testCoreOf(rel) {
  const base = basename(normalizePath(rel))
  const hit = TEST_SUFFIXES.find((suffix) => base.endsWith(suffix))
  return hit ? base.slice(0, -hit.length) : base.replace(/\.[^.]*$/, '')
}

/**
 * `__tests__/x*` 的前缀命中必须落在词边界:`x` 命中 `x` / `x.foo` / `x-extra` / `x_extra`,
 * 但**不命中** `xylophone`、也不命中模块 `user.ts` 被 `users.test.ts` 冒充的那一格。
 */
export function prefixHit(name, stem) {
  if (!stem || !name) return false
  if (name === stem) return true
  if (!name.startsWith(stem)) return false
  return '.-_'.includes(name[stem.length])
}

const LOCAL_DECL_RE = /^[ \t]*(?:const|let|var|function|class|enum|interface|type|namespace)\b/m
const CJS_EXPORT_RE = /^[ \t]*(?:module\.exports|exports\.[A-Za-z_$][\w$]*)\s*=/m
const RUNTIME_DECL_RE =
  /^[ \t]*export\s+(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function|class|enum)\b/gm
const DEFAULT_EXPORT_RE = /^[ \t]*export\s+default\b(?!\s+(?:interface|type|declare)\b)/m
const TS_EXPORT_EQUALS_RE = /^[ \t]*export\s*=/m
const EXPORT_BLOCK_RE = /^[ \t]*export\s*\{([\s\S]*?)\}\s*(?:from\s*['"][^'"]*['"]\s*)?;?/gm
const STAR_EXPORT_RE = /^[ \t]*export\s+(type\s+)?\*(?:\s+as\s+[A-Za-z_$][\w$]*)?\s+from\s*['"][^'"]*['"]/gm

const IMPORT_STMT_RE = /^[ \t]*import\b[\s\S]*?from\s*['"][^'"]*['"]\s*;?/gm
const SIDE_EFFECT_IMPORT_RE = /^[ \t]*import\s*['"][^'"]*['"]\s*;?/gm
const RE_EXPORT_STMT_RE =
  /^[ \t]*export\s+(?:type\s+)?(?:\*|\{[\s\S]*?\})\s*(?:as\s+[A-Za-z_$][\w$]*\s*)?from\s*['"][^'"]*['"]\s*;?/gm
const DIRECTIVE_RE = /^[ \t]*['"]use (?:client|server|strict)['"];?[ \t]*$/gm

/**
 * 导出形态判定(纯字符串)。三件事:
 *   · `anyExport`   —— 文件里出现过 export(TS/ESM)或 CJS 导出赋值;
 *   · `runtime`     —— 至少一个**运行时**导出(`export type` / `interface` / `declare` 不算);
 *   · `reExportOnly`—— 去掉全部 import / `export … from` / 指令后没有剩余语句 ⇒ 纯转发桶。
 * 注释与字符串都遮(判代码结构的门,§速查区"横向口径"),避免注释里的 `export` 被当真。
 */
export function analyzeExports(text) {
  const src = String(text ?? '')
  const masked = maskCommentsAndStrings(src)
  const commented = maskComments(src)
  const anyExport = /^[ \t]*export\b/m.test(masked) || CJS_EXPORT_RE.test(masked)
  let runtime = false
  if (CJS_EXPORT_RE.test(masked)) runtime = true
  if (RUNTIME_DECL_RE.test(masked)) runtime = true
  RUNTIME_DECL_RE.lastIndex = 0
  if (DEFAULT_EXPORT_RE.test(masked)) runtime = true
  if (TS_EXPORT_EQUALS_RE.test(masked)) runtime = true
  for (const m of masked.matchAll(EXPORT_BLOCK_RE)) {
    // `export { type A, type B }` 是纯类型;混入一个值导出就是运行时导出。
    const specs = String(m[1] ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const allType = specs.length > 0 && specs.every((s) => /^type\s+/.test(s))
    if (!allType) runtime = true
  }
  for (const m of masked.matchAll(STAR_EXPORT_RE)) {
    if (!m[1]) runtime = true
  }
  const reExportStmts = commented.match(RE_EXPORT_STMT_RE) ?? []
  let reExportOnly = false
  if (reExportStmts.length > 0 && runtime) {
    const residual = commented
      .replace(IMPORT_STMT_RE, '')
      .replace(SIDE_EFFECT_IMPORT_RE, '')
      .replace(RE_EXPORT_STMT_RE, '')
      .replace(DIRECTIVE_RE, '')
      .trim()
    reExportOnly = residual === ''
  }
  return { anyExport, runtime, reExportOnly }
}

/**
 * 单文件分类。入参 `{path, text}`:`text` 缺省(未提供内容)只对可能是模块的源码形态落
 * undetermined,资源文件在读到内容之前就已判过"不是模块"。
 * @returns {{path:string, kind:'module'|'test'|'skipped'|'undetermined', reason:string, blocks:boolean, runtime:boolean}}
 */
export function classifyFile(entry) {
  const rel = normalizePath(typeof entry === 'string' ? entry : entry?.path)
  const text = typeof entry === 'string' ? undefined : entry?.text
  const out = (kind, reason, blocks = false, runtime = false) => ({ path: rel, kind, reason, blocks, runtime })
  if (!rel) return out('undetermined', '空路径', true)
  if (isTestFile(rel)) return out('test', '测试文件')
  if (isInNonSourceDir(rel)) return out('skipped', '测试/夹具目录')
  if (rel.endsWith('.d.ts')) return out('skipped', '类型声明(.d.ts)')
  const base = basename(rel)
  const nameMarker = GENERATED_MARKERS.find((m) => m.re.test(base) || /\.generated\./i.test(base))
  const ext = extOf(rel)
  if (ext === '') return out('undetermined', '无扩展名', true)
  if (!SOURCE_EXTS.includes(ext)) {
    if (KNOWN_NON_SOURCE_EXTS.includes(ext)) return out('skipped', `非源码资源(${ext})`)
    return out('undetermined', `未知扩展名(${ext})`, true)
  }
  if (typeof text !== 'string') return out('undetermined', '取不到文件内容', true)
  if (text.includes('\u0000')) return out('undetermined', '二进制内容', true)
  if (nameMarker) return out('undetermined', `生成物(${nameMarker.label})`, false)
  const src = String(text)
  for (const m of GENERATED_MARKERS) {
    if (m.re.test(src)) {
      const line = src.split(/\r?\n/).find((l) => m.re.test(l)) ?? ''
      if (line.trim().length <= 200) return out('undetermined', `生成物(${m.label})`, false)
    }
  }
  const ex = analyzeExports(src)
  if (!ex.anyExport) return out('skipped', '无导出(空模块)')
  if (!ex.runtime) return out('skipped', '纯类型(无运行时导出)')
  if (ex.reExportOnly) return out('skipped', '纯转发桶(无自有实现)')
  return out('module', '有运行时导出', false, true)
}

/**
 * 单个模块是否被某测试文件按命名约定覆盖。两条规则见文件头注。
 * 对 `dir/x.ts`:①同目录 `x.test.*` / `x.spec.*`;②`dir/__tests__/` 下词边界前缀命中。
 */
export function testCoversModule(moduleRel, testRel) {
  const mod = normalizePath(moduleRel)
  const tst = normalizePath(testRel)
  if (!isTestFile(tst)) return false
  const modDir = dirname(mod)
  const stem = basename(mod).replace(/\.[^.]*$/, '')
  const testDir = dirname(tst)
  if (testDir === modDir) return testCoreOf(tst) === stem
  if (testDir === `${modDir}/__tests__` || testDir === '__tests__') {
    if (getParentTestDir(tst) !== modDir) return false
    return prefixHit(testCoreOf(tst), stem)
  }
  return false
}

function getParentTestDir(rel) {
  const dir = dirname(rel)
  return dirname(dir)
}

export function normalizeRoots(roots) {
  if (!Array.isArray(roots)) throw new TypeError('roots 必须是数组')
  const seen = new Set()
  const list = []
  for (const raw of roots) {
    const value = typeof raw === 'string' ? raw : raw?.root
    const root = normalizePath(value)
    if (!root || seen.has(root)) continue
    seen.add(root)
    list.push(root)
  }
  return list
}

export function inRoot(rel, root) {
  const p = normalizePath(rel)
  return p === root || p.startsWith(`${root}/`)
}

/**
 * 判据主函数:射程内哪些源码模块没有任何对应测试。
 *
 * @param {{files:(string|{path:string,text?:string})[], testFiles:string[], roots:string[]}} input
 * @returns {{
 *   roots:string[], scanned:number, outOfScope:number, modules:number,
 *   gaps:{path:string,root:string}[], covered:{path:string,test:string}[],
 *   skipped:{path:string,reason:string}[], undetermined:{path:string,reason:string,blocks:boolean}[],
 *   emptyRoots:string[], gapCount:number
 * }}
 */
export function findTestlessModules({ files, testFiles, roots } = {}) {
  if (!Array.isArray(files)) throw new TypeError('files 必须是数组(字符串路径或 {path,text})')
  if (!Array.isArray(testFiles)) throw new TypeError('testFiles 必须是数组')
  const rootList = normalizeRoots(roots)
  if (rootList.length === 0) throw new TypeError('roots 必须是非空数组')

  const tests = [...new Set(testFiles.map(normalizePath).filter(isTestFile))].sort()
  const inside = new Map()
  let outOfScope = 0
  for (const raw of files) {
    const entry = typeof raw === 'string' ? { path: raw } : (raw ?? {})
    const rel = normalizePath(entry.path)
    if (!rel) continue
    if (!rootList.some((r) => inRoot(rel, r))) {
      outOfScope += 1
      continue
    }
    const prev = inside.get(rel)
    if (prev === undefined || entry.text !== undefined) inside.set(rel, entry.text)
  }

  // 测试索引:同目录(含 __tests__)即可,不建全仓倒排 —— 规则本身是路径局部的。
  const byDir = new Map()
  for (const t of tests) {
    const dir = dirname(t)
    if (!byDir.has(dir)) byDir.set(dir, [])
    byDir.get(dir).push(t)
  }
  const coveringTests = (rel) => {
    const dir = dirname(rel)
    const stem = basename(rel).replace(/\.[^.]*$/, '')
    const hits = []
    for (const t of byDir.get(dir) ?? []) if (testCoversModule(rel, t)) hits.push(t)
    for (const t of byDir.get(`${dir}/__tests__`) ?? []) if (testCoversModule(rel, t)) hits.push(t)
    return hits.sort()
  }

  const gaps = []
  const covered = []
  const skipped = []
  const undetermined = []
  let modules = 0
  for (const [rel, text] of [...inside.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const verdict = classifyFile({ path: rel, text })
    if (verdict.kind === 'test') continue
    if (verdict.kind === 'skipped') {
      skipped.push({ path: rel, reason: verdict.reason })
      continue
    }
    if (verdict.kind === 'undetermined') {
      undetermined.push({ path: rel, reason: verdict.reason, blocks: verdict.blocks })
      continue
    }
    modules += 1
    const root = rootList.filter((r) => inRoot(rel, r)).sort((a, b) => b.length - a.length)[0]
    const hits = coveringTests(rel)
    if (hits.length) covered.push({ path: rel, test: hits[0] })
    else gaps.push({ path: rel, root })
  }
  const emptyRoots = rootList.filter((r) => ![...inside.keys()].some((p) => inRoot(p, r)))
  return {
    roots: rootList,
    scanned: inside.size,
    outOfScope,
    modules,
    gaps,
    covered,
    skipped,
    undetermined,
    emptyRoots,
    gapCount: gaps.length,
  }
}

/**
 * 差值棘轮:锚点 = 该模块在基底面的自身状态。基底缺失(`null`) ⇒ 全部算存量,新增 0
 * (默认档判 HEAD,HEAD 的基底就是它自己,这一档只报读数、不判新增)。
 */
export function diffGaps(face, base) {
  const faceGaps = Array.isArray(face?.gaps) ? face.gaps : []
  if (!base) return { newGaps: [], stock: faceGaps }
  const baseGap = new Set((base.gaps ?? []).map((g) => g.path))
  const newGaps = []
  const stock = []
  for (const g of faceGaps) (baseGap.has(g.path) ? stock : newGaps).push(g)
  return { newGaps, stock }
}

/** 按 reason 前缀聚合,给结论行与 JSON 一个稳定的读数口径。 */
export function countByReason(list) {
  const map = new Map()
  for (const item of list ?? []) {
    const key = String(item.reason ?? '未标注').replace(/\(.*$/, '')
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export const __test__ = {
  analyzeExports,
  classifyFile,
  testCoversModule,
  prefixHit,
  findTestlessModules,
  diffGaps,
  countByReason,
  normalizeRoots,
  inRoot,
  isTestFile,
  extOf,
  testCoreOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
