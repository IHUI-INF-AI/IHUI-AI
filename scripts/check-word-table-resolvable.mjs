// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「词表键必须五语言可解析」守门(2026-09-23 立)。
 *
 * 堵的洞(实测,非推测):
 *  - scripts/check-i18n-keys.mjs 只从 `t('字面量')` 形态提键(:403-412 extractKeysByVar),
 *    对象字面量里的 i18n 键它**看不见**;
 *  - scripts/check-permission-mode-vocabulary.mjs 的 R4 只咬 3 种形状(:266-270),
 *    `PermissionTierDisplayKey` / `permissionTier.mode.*` 都不匹配,也不在其 KNOWN_CONSUMERS(:66-75);
 *  ⇒ packages/shared/src/chat/permission-tier.ts 头部那句"键必须是字面量:各端 i18n 键检查
 *    靠静态扫描保证五语言都存在"是**假前提**:新增档位可以全闸绿,而运行时
 *    packages/i18n/src/loader.ts:54 在 `typeof value !== 'string'` 时 `return key` —— 键名上界面。
 *
 * 判据(范式照抄 scripts/check-tool-display-resolvable.mjs,不另造一套):
 *   W1 扫 `const NAME [: 类型] = { … }` 对象字面量(未导出的也算 —— 词表常模块内私有),
 *      取深度 ≤2 的带点字符串字面量:`k: 'a.b.c'` 或 `k: { title: 'a.b.c' }`;
 *      值里只要出现非字面量/非字符串就整表不认(动态表由各端自证,不在本门视野);
 *   W2 锚定(防误报洪水):表的去重键里 **≥2 个**能在权威语料
 *      packages/i18n/messages/<source>/<lang>.json 里按**绝对路径**解析、且占比 ≥50% → 认定 i18n 词表。
 *      不满足的是"命名空间相对风格"(`typeLabel.single_choice` 配 useTranslations('adminEdu…'))
 *      或含点但根本不是键的字符串 map(模型名 `MiniMax-M2.5`),一律不检并计数说明;
 *   W3 逐键 × 逐语言:消费端(apps/<end> 内经解析后的 import 图**确实**能到词表模块、
 *      且提及该模块导出符号)的合并视图 shared+端 必须解析出非空字符串且不等于键名;
 *   W4 miniapp-taro 消费时,离线生成物各远程语言载荷也必须解析出值
 *      (解码与 REMOTE_LOCALES 取法直接复用 check-tool-display-resolvable 的导出,不自己拼路径);
 *   W5 共享层落点:packages/* 的词表,若某依赖该包的端**尚未 import 它**但该端消息源整块缺键,
 *      单列 notices(表×端聚合,不逐键刷屏);**不计入退出码** —— 该端未引用这张表 ⇒ 坏状态当前不可达,
 *      计入会把 blocking 门长期红在别人未接入的存量上(实测初版 5 条全属此类)。
 *
 * 用法:
 *   node scripts/check-word-table-resolvable.mjs              # 全量
 *   node scripts/check-word-table-resolvable.mjs --staged     # pre-commit:暂存源码里的词表
 *   node scripts/check-word-table-resolvable.mjs --json       # 机读
 *   node scripts/check-word-table-resolvable.mjs --self-test   # 注入违规 + 反例自证
 * 紧急跳过:HUSKY_SKIP_WORD_TABLE_RESOLVABLE=1 git commit ...
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
// 复用既有闸的合并语义与 taro 离线包解码(§22d:被 import 时不触发它的 main)
import {
  mergeMessages,
  remoteLocaleList,
  decodeTaroBundle,
} from './check-tool-display-resolvable.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANGS = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko']
/** 端清单与 check-tool-display-resolvable.mjs:32 同口径(api 不产界面文案,故不在列) */
const END_DIRS = ['web', 'extension', 'miniapp-taro', 'mobile-rn', 'cli']
const TARO_GEN = 'apps/miniapp-taro/src/i18n/generated/remote-locales.gen.ts'
const TARO_GEN_SCRIPT = 'apps/miniapp-taro/scripts/gen-i18n-compressed.mjs'
const SKIP_ENV = 'HUSKY_SKIP_WORD_TABLE_RESOLVABLE'

const SCAN_ROOTS = [
  'packages/shared/src',
  'packages/types/src',
  'packages/ui-react/src',
  'packages/app/src',
  'packages/api-client/src',
  'apps/web/app',
  'apps/web/src',
  'apps/extension/entrypoints',
  'apps/extension/lib',
  'apps/extension/components',
  'apps/miniapp-taro/src',
  'apps/mobile-rn/src',
  'apps/cli/src',
]
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'generated',
  'coverage',
  '__tests__',
  'tests',
  'test',
  '.output',
])

/** 带点键字面量:首段须是标识符形状(排除 '/api/x.y' 路径与纯数字段) */
const DOTTED_KEY_RE = /^['"]([A-Za-z][\w-]*(?:\.[\w$-]+)+)['"]$/

// ─────────────────────────────────────────────────────────────────────────────
// 扫描小工具
// ─────────────────────────────────────────────────────────────────────────────

function skipString(s, i) {
  const q = s[i]
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') j++
    else if (s[j] === q) return j
  }
  return -1
}

function matchBrace(s, open) {
  let depth = 0
  for (let i = open; i < s.length; i++) {
    const c = s[i]
    if (c === '"' || c === "'" || c === '`') i = skipString(s, i)
    else if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 剥注释:块注释与整行行注释(判据不得被注释里的示例骗到)。
 *  用**空格填充**而非删除 —— 行列偏移必须与原文件一致,报错才指得到真行号。 */
export function stripComments(src) {
  const blank = (s) => s.replace(/[^\n]/g, ' ')
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/.*$/gm, blank)
}

// ─────────────────────────────────────────────────────────────────────────────
// W1 形状
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 对象字面量体内深度 ≤2 的 `字段: 'a.b.c'`。
 * @returns {{dotted:{path:string,key:string}[], plain:number, other:number}}
 *  plain = 不含点的字符串字面量(如 `title: '默认模式'`),other = 计算值/函数/数组等。
 */
export function scanObjectLiterals(body) {
  const dotted = []
  let plain = 0
  let other = 0
  const re = /(?:^|[,{\n])\s*(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$-]*))\s*:\s*(?![\w$])/g
  let m
  while ((m = re.exec(body))) {
    const field = m[1] ?? m[2] ?? m[3]
    let i = m.index + m[0].length
    while (i < body.length && /\s/.test(body[i])) i++
    const ch = body[i]
    if (ch === '"' || ch === "'") {
      const end = skipString(body, i)
      if (end === -1) break
      const km = DOTTED_KEY_RE.exec(body.slice(i, end + 1))
      if (km) dotted.push({ path: field, key: km[1] })
      else plain++
      re.lastIndex = end
    } else if (ch === '{') {
      const close = matchBrace(body, i)
      if (close === -1) break
      const inner = scanObjectLiterals(body.slice(i + 1, close))
      for (const h of inner.dotted) dotted.push({ path: `${field}.${h.path}`, key: h.key })
      plain += inner.plain
      other += inner.other
      re.lastIndex = close
    } else {
      other++
    }
  }
  return { dotted, plain, other }
}

/** `const NAME [: 类型标注] = {` —— 标注里允许 `;`(内联对象类型)与 `=>` */
const CONST_OBJECT_RE =
  /(?:^|\n)\s*(export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*(?::\s*(?:[^=]|=>)*?)?=\s*\{/g

/** 文件里的候选词表(纯函数:files = [{rel,text}],镜像测试由此注入假语料) */
export function discoverWordTables(files) {
  const tables = []
  for (const { rel, text } of files) {
    const src = stripComments(text)
    CONST_OBJECT_RE.lastIndex = 0
    let m
    while ((m = CONST_OBJECT_RE.exec(src))) {
      const open = src.indexOf('{', m.index + m[0].length - 1)
      const close = matchBrace(src, open)
      if (close === -1) continue
      const { dotted, plain, other } = scanObjectLiterals(src.slice(open + 1, close))
      CONST_OBJECT_RE.lastIndex = close
      if (dotted.length < 2 || plain > 0 || other > 0) continue
      const keys = [...new Set(dotted.map((d) => d.key))]
      if (keys.length < 2) continue
      // 行号必须钉在 `const` 关键字上:整段匹配以 `\n\s*` 开头,用 m.index 会报到上一条语句
      const constAt = m.index + m[0].indexOf('const')
      tables.push({
        file: rel,
        name: m[2],
        line: src.slice(0, constAt).split('\n').length,
        exported: Boolean(m[1]),
        keys,
        fields: dotted.map((d) => d.path),
      })
    }
  }
  return tables
}

// ─────────────────────────────────────────────────────────────────────────────
// 权威消息源
// ─────────────────────────────────────────────────────────────────────────────

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}

/** 消息对象 → Map(叶子路径 → 值);数组与字符串都算叶子 */
export function collectLeaves(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) collectLeaves(v, path, out)
    else out.set(path, v)
  }
  return out
}

const msgPath = (source, lang) => join(ROOT, 'packages/i18n/messages', source, `${lang}.json`)

/** 每端合并视图(shared + 端 override,与 @ihui/i18n loader:mergeMessages 同语义) */
export function buildMergedViews() {
  const views = {}
  for (const end of END_DIRS) {
    for (const lang of LANGS) {
      views[`${end}/${lang}`] = collectLeaves(
        mergeMessages(readJson(msgPath('shared', lang)), readJson(msgPath(end, lang))),
      )
    }
  }
  return views
}

/** 绝对路径是否存在于权威语料(任一源 × 任一语言)—— 只服务 W2 锚定 */
export function corpusLeafSet() {
  const set = new Set()
  for (const source of ['shared', ...END_DIRS]) {
    for (const lang of LANGS)
      for (const p of collectLeaves(readJson(msgPath(source, lang))).keys()) set.add(p)
  }
  return set
}

/** 可解析 = 有值 ∧ 是字符串 ∧ 非空 ∧ 不等于键名(等于键名就是静默回显) */
export function resolvable(map, key) {
  const value = map?.get(key)
  return typeof value === 'string' && value.trim() !== '' && value !== key
}

// ─────────────────────────────────────────────────────────────────────────────
// W3 消费端归属
// ─────────────────────────────────────────────────────────────────────────────

/** 各 packages 子目录 package.json 的 name → 目录(权威,不猜包名) */
export function buildPackageMap() {
  const map = new Map()
  const dir = join(ROOT, 'packages')
  for (const name of readdirSync(dir)) {
    const pj = join(dir, name, 'package.json')
    if (!existsSync(pj)) continue
    const n = readJson(pj)?.name
    if (typeof n === 'string') map.set(n, `packages/${name}`)
  }
  return map
}

const EXTS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']
function isFile(abs) {
  try {
    return statSync(abs).isFile()
  } catch {
    return false
  }
}
function fileFromBase(baseRel) {
  if (!baseRel) return null
  const norm = baseRel.replace(/\\/g, '/')
  for (const ext of EXTS) {
    const p = norm + ext
    if (isFile(join(ROOT, p))) return p
  }
  return null
}

/**
 * 说明符 → 仓库内模块相对路径。支持相对路径、`@/<x>`(端内 src 别名)、`@ihui/<pkg>[/<sub>]`。
 * 解析不到(第三方包、未登记的 tsconfig 别名)返回 null —— 宁漏不误报。
 */
export function resolveSpecifier(spec, fromRel, pkgMap) {
  if (typeof spec !== 'string' || spec.length === 0) return null
  if (!spec.startsWith('.')) {
    if (spec.startsWith('@/')) {
      const seg = /^apps\/([^/]+)\//.exec(fromRel)
      if (!seg) return null
      return fileFromBase(`apps/${seg[1]}/src/${spec.slice(2)}`)
    }
    if (spec.startsWith('@ihui/')) {
      // 作用域名占两段:pkgName = '@scope/name',其余才是子路径
      const parts = spec.split('/')
      const pkgName = parts.slice(0, 2).join('/')
      const pkgDir = pkgMap.get(pkgName)
      if (!pkgDir) return null
      const sub = parts.slice(2).join('/')
      return sub
        ? (fileFromBase(`${pkgDir}/src/${sub}`) ?? fileFromBase(`${pkgDir}/${sub}`))
        : fileFromBase(`${pkgDir}/src/index`)
    }
    return null
  }
  const abs = resolve(dirname(join(ROOT, fromRel)), spec)
  const rel = relative(ROOT, abs).replace(/\\/g, '/')
  if (rel.startsWith('..')) return null
  return fileFromBase(rel)
}

const IMPORT_RE = /(?:^|[\s;}('])import\s+(?:type\s+)?[\s\S]*?\s+from\s*['"]([^'"]+)['"]/g
const BARE_IMPORT_RE = /(?:^|[\s;}]|)\bimport\s+['"]([^'"]+)['"]/g
const EXPORT_FROM_RE = /(?:^|[\s;}])export\s+(?:\*|\{[\s\S]*?\})\s+from\s*['"]([^'"]+)['"]/g

/** 文件里所有 import / re-export 的说明符 */
export function importSpecifiers(text) {
  const src = stripComments(text)
  const out = []
  for (const re of [IMPORT_RE, BARE_IMPORT_RE, EXPORT_FROM_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src))) out.push(m[1])
  }
  return out
}

/** 模块导出的符号名(判"是否真被用到",避免 barrel 顺路可达算成消费方) */
export function exportedSymbols(text) {
  const src = stripComments(text)
  const out = new Set()
  for (const m of src.matchAll(
    /\bexport\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
  ))
    out.add(m[1])
  for (const m of src.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (name && /^[A-Za-z_$][\w$]*$/.test(name)) out.add(name)
    }
  }
  return out
}

/**
 * 顶层声明块:名字 → 该声明的文本切片。切片终点取"下一个顶层声明的起点"(最后一块到 EOF),
 * 因此函数体必被覆盖。只认**第 0 列**的声明 —— 缩进的声明是嵌套在别的块里,其文本已含于外层切片。
 * 切片偏"过含"(末尾块把后续杂项也算进来)是有意方向:多算一次引用只会保留判据,不会造成放行。
 */
function topLevelDeclBlocks(src) {
  const re =
    /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm
  const starts = []
  let m
  while ((m = re.exec(src))) {
    starts.push({ at: m.index, name: m[1] })
    re.lastIndex = m.index + 1
  }
  const blocks = new Map()
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].at : src.length
    const prev = blocks.get(starts[i].name)
    blocks.set(starts[i].name, (prev ? prev + '\n' : '') + src.slice(starts[i].at, end))
  }
  return blocks
}

/** `export { a as b, c }` 的别名回填:b → a(判据认内部真名,消费端写的是对外名字) */
function exportAliases(src) {
  const map = new Map()
  for (const x of src.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of x[1].split(',')) {
      const seg = part.trim().replace(/^type\s+/, '')
      if (!seg || seg === 'default') continue
      const as = seg.split(/\s+as\s+/)
      const from = as[0].trim()
      const to = (as[1] ?? as[0]).trim()
      if (/^[A-Za-z_$][\w$]*$/.test(from) && /^[A-Za-z_$][\w$]*$/.test(to)) map.set(to, from)
    }
  }
  return map
}

/** 该表标识符在模块内**被谁读到**:从表名出发沿顶层声明块相互引用做传递闭包 */
export function tableReachableNames(moduleText, tableName) {
  return reachableFromBlocks(topLevelDeclBlocks(stripComments(moduleText)), tableName)
}

function reachableFromBlocks(blocks, tableName) {
  const word = new Map()
  const reFor = (name) => {
    if (!word.has(name))
      word.set(name, new RegExp(String.raw`\b${name.replace(/[$]/g, '\\$')}\b`))
    return word.get(name)
  }
  const tainted = new Set([tableName])
  let grew = true
  while (grew) {
    grew = false
    for (const [name, text] of blocks) {
      if (tainted.has(name)) continue
      for (const t of tainted) {
        if (reFor(t).test(text)) {
          tainted.add(name)
          grew = true
          break
        }
      }
    }
  }
  return tainted
}

/**
 * 消费端判定的符号面 = 模块导出符号 ∩ 真正读到这张表的符号。
 *
 * 为什么必须收到这一层(2026-09-24 实测盲区,70 枚 blocking 恒红的真因):
 * `packages/shared/src/utils/error-messages.ts` 同模块导出 3 个函数 —— 只有
 * `getErrorI18nKey` / `resolveErrorMessage` 会把 `errors.*` 交给 `t()`;
 * `toUserFriendlyMessage` 读的是另一张固定中文表 `ERROR_CODE_TO_ZH`,压根不查词表。
 * 而 mobile-rn 约 40 个屏调的正是后者。旧判据"该端提到**任一**导出符号 ⇒ 它是这张键表的
 * 消费端",符号粒度被抹平,于是 14 枚全仓零调用方的键在 mobile-rn 上被判"界面会回显键名"。
 *
 * 两处兜底(方向一律是"退回旧判据、宁可多报"):
 * ① 覆盖性自检 —— 任一导出符号既没有自己的顶层声明块、也不是 `export { 内名 as 外名 }` 的别名,
 *   说明顶层切分没吃下这个文件(新语法形态 / 从别处 re-export)。**这条是命门**:切分一旦失效,
 *   触表面会缩成"只剩表自己"⇒ 消费端被判成 0 ⇒ 门在真缺陷上恒绿(首轮实测就是这样误伤了
 *   permission-tier / AgentRuntimePanel / budget-note 三张表的真消费端)。
 * ② 收窄后为空(表只被模块内的非导出代码读)→ 同样退回全量。
 */
export function tableScopedSymbols(moduleText, tableName) {
  const src = stripComments(moduleText)
  const all = exportedSymbols(moduleText)
  const blocks = topLevelDeclBlocks(src)
  const alias = exportAliases(src)
  const uncovered = [...all].filter((s) => !blocks.has(s) && !blocks.has(alias.get(s) ?? ''))
  if (!blocks.size || uncovered.length) return all
  const reach = reachableFromBlocks(blocks, tableName)
  const scoped = new Set()
  for (const s of all) {
    if (reach.has(s) || reach.has(alias.get(s) ?? s)) scoped.add(s)
  }
  return scoped.size ? scoped : all
}

const sourceCache = new Map()
export function sourceFile(rel) {
  if (sourceCache.has(rel)) return sourceCache.get(rel)
  let text = ''
  try {
    text = readFileSync(join(ROOT, rel), 'utf8')
  } catch {
    text = ''
  }
  sourceCache.set(rel, text)
  return text
}

/** 扫描面内全部源码文件(相对路径,正斜杠) */
export function listSourceFiles() {
  const out = []
  const walk = (dir) => {
    let entries
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      const p = join(dir, name)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(p)
      } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) {
        out.push(relative(ROOT, p).replace(/\\/g, '/'))
      }
    }
  }
  for (const d of SCAN_ROOTS) walk(join(ROOT, d))
  return out.sort()
}

/** 反向 import 索引:模块 → 直接 import 它的文件(全仓一次构建,查多次) */
export function buildReverseIndex(files, pkgMap) {
  const importers = new Map()
  for (const rel of files) {
    for (const spec of importSpecifiers(sourceFile(rel))) {
      const r = resolveSpecifier(spec, rel, pkgMap)
      if (!r || r === rel) continue
      if (!importers.has(r)) importers.set(r, new Set())
      importers.get(r).add(rel)
    }
  }
  return importers
}

/** 谁(直接或间接,maxDepth 跳内)import 了 target */
export function reverseClosure(targetRel, importers, maxDepth = 4) {
  const found = new Set()
  let frontier = new Set([targetRel])
  for (let d = 0; d < maxDepth && frontier.size; d++) {
    const next = new Set()
    for (const mod of frontier) {
      for (const imp of importers.get(mod) ?? []) {
        if (imp === targetRel || found.has(imp)) continue
        found.add(imp)
        next.add(imp)
      }
    }
    frontier = next
  }
  return found
}

/** 消费端:该端存在文件既经 import 图到词表模块、又提及该模块导出的符号 */
export function consumerEnds(table, importers, symbols) {
  const hits = new Set()
  for (const rel of reverseClosure(table.file, importers)) {
    const seg = /^apps\/([^/]+)\//.exec(rel)
    if (!seg || !END_DIRS.includes(seg[1])) continue
    const text = sourceFile(rel)
    for (const s of symbols) {
      if (new RegExp(`\\b${s.replace(/\$/g, '\\$')}\\b`).test(text)) {
        hits.add(seg[1])
        break
      }
    }
  }
  return [...hits].sort()
}

/** 各包/各端 package.json 的直接 @ihui 依赖 */
export function buildDirectDeps(pkgMap) {
  const direct = new Map()
  const load = (dir, fallbackName) => {
    const j = readJson(join(ROOT, dir, 'package.json'))
    const name = typeof j?.name === 'string' ? j.name : fallbackName
    direct.set(
      name,
      Object.keys({ ...j.dependencies, ...j.devDependencies }).filter(
        (k) => pkgMap.has(k) || k === name,
      ),
    )
    return name
  }
  for (const [name, dir] of pkgMap) load(dir, name)
  const appName = {}
  for (const end of END_DIRS) appName[end] = load(`apps/${end}`, `@ihui/${end}`)
  return { direct, appName }
}

/** 依赖(含传递)某个 packages/* 的端清单 */
export function endsDependingOnPackage(pkgDir, pkgMap, deps) {
  const target = [...pkgMap.entries()].find(([, d]) => d === pkgDir)?.[0]
  if (!target) return []
  const out = []
  for (const end of END_DIRS) {
    const start = deps.appName[end] ?? `@ihui/${end}`
    const seen = new Set([start])
    const queue = [start]
    while (queue.length) {
      for (const dep of deps.direct.get(queue.shift()) ?? []) {
        if (seen.has(dep)) continue
        seen.add(dep)
        queue.push(dep)
      }
    }
    if (seen.has(target)) out.push(end)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// W4 taro 离线生成物
// ─────────────────────────────────────────────────────────────────────────────

export function taroBundleViews(genScriptText, genFileText) {
  const parsed = remoteLocaleList(genScriptText)
  const remote = parsed ?? LANGS
  const decoded = decodeTaroBundle(genFileText, remote)
  const views = {}
  const broken = []
  for (const lang of remote) {
    if (!decoded[lang]) {
      broken.push(lang)
      continue
    }
    views[lang] = collectLeaves(decoded[lang])
  }
  // 取不到 REMOTE_LOCALES 清单 = 生成器格式变了,离线面根本没核验(宁可炸,不静默放过)
  return { views, remote, broken, unparsed: parsed === null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 判据组装(纯函数,可注入)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param tables     W1 认定的候选词表(带 keys/consumerEnds/dependentEnds)
 * @param corpusLeaves Set<绝对路径>  W2 锚定
 * @param views      { `${end}/${lang}` → Map<叶子,值> }
 * @param taro       { views: Map<lang,Map>, remote:[lang], broken:[lang] } | null
 * @param isSharedTable  (table)=>boolean
 */
export function evaluateWordTables({ tables, corpusLeaves, views, taro, isSharedTable }) {
  const checked = []
  const skipped = []
  const failures = []
  // W5 是"落点债"而非当前缺陷:该端依赖共享包但**尚未引用**这张表 ⇒ 今天没有任何界面会回显键名。
  // 让它计入 failures 会把 blocking 门长期红在别人未接入的存量上(实测 5 条全是这一类),
  // 故单列 notices:照报、不改退出码。真正接进去(端内出现该表符号)即由 W3/W4 逐键硬拦。
  const notices = []
  for (const t of tables) {
    const absCount = t.keys.filter((k) => corpusLeaves.has(k)).length
    const ratio = absCount / t.keys.length
    if (absCount === 0) {
      skipped.push({
        name: t.name,
        file: t.file,
        keys: t.keys.length,
        absCount,
        reason: '绝对路径全解析不出:命名空间相对取词或含点非键 map',
      })
      continue
    }
    if (absCount < 2 || ratio < 0.5) {
      skipped.push({
        name: t.name,
        file: t.file,
        keys: t.keys.length,
        absCount,
        reason: `锚定不足(${absCount}/${t.keys.length} < 50%)`,
      })
      continue
    }
    checked.push(t)
    const ends = t.consumerEnds ?? []
    for (const end of ends) {
      for (const lang of LANGS) {
        const view = views[`${end}/${lang}`]
        for (const key of t.keys) {
          if (!resolvable(view, key))
            failures.push({
              rule: 'W3',
              table: t,
              key,
              where: `${end}/${lang}`,
              why: '消费端合并视图(shared+端)解析不出值 → 界面回显键名',
            })
        }
      }
    }
    if (taro && ends.includes('miniapp-taro')) {
      if (taro.unparsed) {
        failures.push({
          rule: 'W4',
          table: t,
          key: `(${t.keys.length} 个键)`,
          where: 'taro-gen/REMOTE_LOCALES',
          why: `读不到离线包语言清单(${TARO_GEN_SCRIPT} 格式变更?)→ 小程序离线面未核验,判红而非静默放过`,
        })
      }
      for (const lang of taro.remote) {
        const view = taro.views[lang]
        if (!view) {
          failures.push({
            rule: 'W4',
            table: t,
            key: `(${t.keys.length} 个键)`,
            where: `taro-gen/${lang}`,
            why: '离线包解不出该语言载荷(生成物过期或格式变更,需 pnpm gen:i18n)',
          })
          continue
        }
        for (const key of t.keys) {
          if (!resolvable(view, key))
            failures.push({
              rule: 'W4',
              table: t,
              key,
              where: `taro-gen/${lang}`,
              why: '小程序离线语言包取不到值(pnpm gen:i18n 未跑或键未补)',
            })
        }
      }
    }
    if (isSharedTable(t)) {
      for (const end of t.dependentEnds ?? []) {
        if (ends.includes(end)) continue
        const missing = LANGS.filter((lang) =>
          t.keys.some((k) => !resolvable(views[`${end}/${lang}`], k)),
        )
        if (missing.length) {
          notices.push({
            rule: 'W5',
            table: t,
            key: `(${t.keys.length} 个键)`,
            where: `${end}/[${missing.join(',')}]`,
            why: '词表在共享包、该端依赖此包但尚未 import;键未沉到 shared 消息源 → 接入即回显键名',
          })
        }
      }
    }
  }
  return { checked, skipped, failures, notices }
}

/** 空输入不得静默变绿:全量模式一张表都没认出来 = 源码形状变了 */
export function guardNoTables({ tablesFound, mode, scopedCount }) {
  if (tablesFound === 0) return '全仓扫出 0 张候选词表(源码形状变更或扫描面漂移),判据不可信'
  if (mode === 'full' && scopedCount === 0) return '全量模式下待检词表为 0,判据不可信'
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function stagedFiles() {
  try {
    return execFileSync(
      'git',
      ['-c', 'safe.directory=*', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'],
      {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
      },
    )
      .split('\n')
      .map((s) => s.trim().replace(/\\/g, '/'))
      .filter(Boolean)
  } catch {
    return null
  }
}

export function run({ staged = false, json = false, quiet = false } = {}) {
  const log = (...a) => {
    if (!quiet) console.log(...a)
  }
  const warn = (...a) => {
    if (!quiet) console.error(...a)
  }
  const files = listSourceFiles()
  const pkgMap = buildPackageMap()
  const deps = buildDirectDeps(pkgMap)
  const tables = discoverWordTables(
    files.map((rel) => ({ rel, text: sourceFile(rel) })).filter((f) => f.text),
  )

  let mode = 'full'
  let scope = '全量'
  let scoped = tables
  if (staged) {
    mode = 'staged'
    const st = stagedFiles()
    const touchesCorpus =
      st && (st.some((f) => f.startsWith('packages/i18n/messages/')) || st.includes(TARO_GEN))
    const touchesCode = st && st.some((f) => f.startsWith('apps/') || f.startsWith('packages/'))
    if (!st) scope = '暂存区读不到(git 不可用)→ 全表回归'
    else if (touchesCorpus) scope = '暂存区触及消息语料或离线包 → 全表回归'
    else if (touchesCode)
      // 只按"暂存文件里有没有词表"收窄会漏:新接线一个消费端(改 apps/**)就把原本无人消费的
      // 词表变成真缺口,而词表文件本身没动 —— 所以端内/包内任何源码改动都回归全表。
      scope = '暂存区含端内/共享包源码(import 归属可能变)→ 全表回归'
    else {
      scoped = []
      scope = '暂存区未触及 apps/ 与 packages/(词表、语料、消费端都不可能变)→ 本轮 0 张待检'
    }
  }

  const guard = guardNoTables({ tablesFound: tables.length, mode, scopedCount: scoped.length })
  if (guard) {
    if (!quiet) throw new Error(guard)
    return {
      ok: false,
      guard,
      failures: [],
      consumers: [],
      tablesFound: tables.length,
      checkedTables: 0,
    }
  }

  const importers = buildReverseIndex(
    [...new Set([...files, ...scoped.map((t) => t.file)])],
    pkgMap,
  )
  const views = buildMergedViews()
  const corpus = corpusLeafSet()
  const taro = taroBundleViews(sourceFile(TARO_GEN_SCRIPT), sourceFile(TARO_GEN))
  const symbolsCache = new Map()
  for (const t of scoped) {
    // 键必须带表名:一个文件可同时挂多张键表(实测 CourseFilterScreen.tsx 3 张、privacy.tsx 2 张),
    // 各表的"触表符号"不同,按文件缓存会把前一张表的结论漏给后一张。
    const skey = `${t.file}#${t.name}`
    if (!symbolsCache.has(skey)) symbolsCache.set(skey, tableScopedSymbols(sourceFile(t.file), t.name))
    t.consumerEnds = consumerEnds(t, importers, symbolsCache.get(skey))
    const m = /^(packages\/[^/]+)\//.exec(t.file)
    t.dependentEnds = m ? endsDependingOnPackage(m[1], pkgMap, deps) : []
  }
  const { checked, skipped, failures, notices } = evaluateWordTables({
    tables: scoped,
    corpusLeaves: corpus,
    views,
    taro,
    isSharedTable: (t) => t.file.startsWith('packages/'),
  })
  const report = {
    scope,
    mode,
    tablesFound: tables.length,
    checkedTables: checked.length,
    keysChecked: checked.reduce((a, b) => a + b.keys.length, 0),
    consumers: checked.map((t) => ({
      table: `${t.file}:${t.line}#${t.name}`,
      ends: t.consumerEnds,
      dependentEnds: t.dependentEnds,
      keys: t.keys.length,
    })),
    skipped,
    taroRemoteLocales: taro.remote,
    taroBroken: taro.broken,
    landingDebts: notices.map((f) => ({ rule: f.rule, table: `${f.table.file}:${f.table.line}#${f.table.name}`, key: f.key, where: f.where, why: f.why })),
    failures: failures.map((f) => ({
      rule: f.rule,
      table: `${f.table.file}:${f.table.line}#${f.table.name}`,
      key: f.key,
      where: f.where,
      why: f.why,
    })),
  }
  if (json) {
    log(JSON.stringify(report, null, 2))
    return { ok: report.failures.length === 0, ...report }
  }
  log(
    `[word-table-resolvable] 候选词表 ${report.tablesFound} 张 → 认定 ${report.checkedTables} 张 / ${report.keysChecked} 键` +
      `(未锚定跳过 ${skipped.length} 张)· ${report.scope}` +
      (taro.broken.length ? ` · ⚠ taro 载荷解不出:${taro.broken.join(',')}` : ''),
  )
  if (notices.length) {
    log(
      `  ⚠ 落点债 ${notices.length} 条(该端依赖共享包但尚未引用这张表 ⇒ 今天没有界面会回显键名,不计失败;一旦真接入,W3/W4 逐键硬拦):`,
    )
    for (const n of notices.slice(0, 10))
      log(`   · [W5] ${n.table.file}:${n.table.line}#${n.table.name} → ${n.key} @ ${n.where}`)
    if (notices.length > 10) log(`   …另 ${notices.length - 10} 条`)
  }
  if (!failures.length) {
    if (!checked.length) {
      log(`  ⏭ 本轮待检 0 张(原因:${scope})—— 未核验任何词表,不是"已核验通过"`)
      return { ok: true, ...report }
    }
    log(
      `  ✅ 每键在 5 语言 × 消费端合并视图${checked.some((t) => t.consumerEnds.includes('miniapp-taro')) ? ' + 小程序离线包' : ''}全部取到值`,
    )
    return { ok: true, ...report }
  }
  warn(`  ❌ ${failures.length} 处取不到值(界面会回显键名):`)
  for (const f of failures.slice(0, 30)) {
    warn(`   · [${f.rule}] ${f.table.file}:${f.table.line}#${f.table.name} → ${f.key} @ ${f.where}`)
    warn(`       ${f.why}`)
  }
  if (failures.length > 30) warn(`   …另 ${failures.length - 30} 处`)
  warn(
    '  修法:缺失键补进 packages/i18n/messages/<shared|端>/<lang>.json 五语言齐全(共享层词表优先沉到 shared);' +
      ` 改完跑 cd apps/miniapp-taro && pnpm gen:i18n 重生成离线包。紧急跳过 ${SKIP_ENV}=1`,
  )
  return { ok: false, ...report }
}

/** 注入违规 + 反例自证(全部用内存假语料,绝不写仓库真实文件) */
function selfTest() {
  const cases = []
  const t = (name, ok) => cases.push({ name, ok })

  // ── 假源码:一张好词表 + 三种"不该检"的形状 ─────────────────
  const fake = [
    {
      rel: 'packages/demo/src/words.ts',
      text: [
        'export const TIER_KEYS: Readonly<',
        '  Record<TierKey, { title: string; desc: string }>',
        '> = {',
        "  a: { title: 'tier.mode.a.title', desc: 'tier.mode.a.desc' },",
        "  b: { title: 'tier.mode.b.title', desc: 'tier.mode.b.desc' },",
        '}',
        'export const MODEL_NAMES: Record<string, string> = {',
        "  minimax: 'MiniMax-M2.5',",
        "  gpt: 'gpt-4.1',",
        '}',
        'export const RELATIVE_TABLE: Record<string, string> = {',
        "  one: 'typeLabel.single_choice',",
        "  two: 'typeLabel.judgment',",
        '}',
        'export const HALF_BAKED: Record<string, string> = {',
        "  ok1: 'tier.mode.a.title',",
        "  ok2: 'tier.mode.b.title',",
        "  junk1: 'x.y1',",
        "  junk2: 'p.q2',",
        "  junk3: 'r.s3',",
        '}',
        'export const MIXED_ZH: Record<string, string> = {',
        "  a: 'tier.mode.a.title',",
        "  b: 'tier.mode.b.title',",
        "  c: '直接写死的中文',",
        '}',
        'export const WITH_FN: Record<string, () => string> = {',
        "  a: 'tier.mode.a.title',",
        '  b: () => "x.y",',
        '}',
      ].join('\n'),
    },
  ]
  const found = discoverWordTables(fake)
  const names = found.map((f) => f.name)
  t(
    'W1 咬住 Record<K,{title,desc}> 嵌套形状并取到 4 键',
    found.find((f) => f.name === 'TIER_KEYS')?.keys.length === 4,
  )
  t('W1 不吃含函数值的 map(WITH_FN)', !names.includes('WITH_FN'))
  t('W1 不吃混了硬编码中文的 map(MIXED_ZH)', !names.includes('MIXED_ZH'))

  const corpus = new Set([
    'tier.mode.a.title',
    'tier.mode.a.desc',
    'tier.mode.b.title',
    'tier.mode.b.desc',
  ])
  const leafMap = (missing = []) =>
    new Map([...corpus].filter((k) => !missing.includes(k)).map((k) => [k, `V:${k}`]))
  const good = Object.fromEntries(LANGS.map((l) => [`web/${l}`, leafMap()]))
  const pick = (name, extra = {}) => [
    {
      file: 'packages/demo/src/words.ts',
      line: 1,
      name,
      keys: found.find((f) => f.name === name).keys,
      ...extra,
    },
  ]

  // ① 注入验证:表里一个键在 ko 缺失 → 必红,且点名 键/表/语言
  const injected = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: ['web'], dependentEnds: ['web'] }),
    corpusLeaves: corpus,
    views: { ...good, 'web/ko': leafMap(['tier.mode.b.desc']) },
    taro: null,
    isSharedTable: () => true,
  })
  t(
    '注入验证:某语言缺一个键 → W3 判红并点名 键/表/语言',
    injected.failures.some(
      (f) =>
        f.rule === 'W3' &&
        f.key === 'tier.mode.b.desc' &&
        f.where === 'web/ko' &&
        f.table.file.includes('words.ts'),
    ),
  )
  t(
    '反例:补齐 5 语言后同表通过(判据非恒红)',
    evaluateWordTables({
      tables: pick('TIER_KEYS', { consumerEnds: ['web'] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => true,
    }).failures.length === 0,
  )
  t(
    'W2 反例:含点但非 i18n 的模型名 map 判为不检(零失败)',
    !evaluateWordTables({
      tables: pick('MODEL_NAMES', { consumerEnds: [] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => true,
    }).failures.length,
  )
  t(
    'W2 反例:命名空间相对风格表(abs=0)判为不检',
    evaluateWordTables({
      tables: pick('RELATIVE_TABLE', { consumerEnds: [] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => true,
    }).skipped.some((s) => s.name === 'RELATIVE_TABLE' && s.absCount === 0),
  )
  t(
    'W2 反例:锚定不足半的表判为不检',
    evaluateWordTables({
      tables: pick('HALF_BAKED', { consumerEnds: [] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => true,
    }).skipped.some((s) => s.name === 'HALF_BAKED'),
  )
  t(
    'W2 锚定不掩盖真缺陷:过半可解析的表里,解析不出的那几个键仍逐条咬',
    (() => {
      const r = evaluateWordTables({
        tables: pick('HALF_BAKED', { consumerEnds: ['web'] }),
        corpusLeaves: new Set(['tier.mode.a.title', 'tier.mode.b.title', 'x.y1', 'p.q2', 'r.s3']),
        views: good,
        taro: null,
        isSharedTable: () => false,
      })
      const keys = new Set(r.failures.map((f) => f.key))
      return (
        r.checked.length === 1 &&
        keys.has('x.y1') &&
        keys.has('p.q2') &&
        keys.has('r.s3') &&
        r.failures.every((f) => f.rule === 'W3')
      )
    })(),
  )

  // W4:miniapp-taro 消费 + 离线包缺键 → 必红
  const withTaro = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: ['miniapp-taro'], dependentEnds: ['miniapp-taro'] }),
    corpusLeaves: corpus,
    views: {
      'miniapp-taro/zh-CN': leafMap(),
      'miniapp-taro/zh-TW': leafMap(),
      'miniapp-taro/en': leafMap(),
      'miniapp-taro/ja': leafMap(),
      'miniapp-taro/ko': leafMap(),
    },
    taro: { views: { ja: leafMap(['tier.mode.b.title']) }, remote: ['ja'], broken: [] },
    isSharedTable: () => true,
  })
  t(
    'W4 咬住离线生成物缺键(端 JSON 有、gen 载荷没有)',
    withTaro.failures.some((f) => f.rule === 'W4' && f.where === 'taro-gen/ja'),
  )
  const taroBrokenCase = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: ['miniapp-taro'] }),
    corpusLeaves: corpus,
    views: Object.fromEntries(LANGS.map((l) => [`miniapp-taro/${l}`, leafMap()])),
    taro: { views: {}, remote: ['en'], broken: ['en'], unparsed: false },
    isSharedTable: () => true,
  })
  t(
    'W4 生成物整体解不出 → 点名需 pnpm gen:i18n',
    taroBrokenCase.failures.some((f) => f.rule === 'W4' && /gen:i18n/.test(f.why)),
  )
  const taroUnparsedCase = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: ['miniapp-taro'] }),
    corpusLeaves: corpus,
    views: Object.fromEntries(LANGS.map((l) => [`miniapp-taro/${l}`, leafMap()])),
    taro: { views: {}, remote: LANGS, broken: ['zh-CN'], unparsed: true },
    isSharedTable: () => true,
  })
  t(
    'W4 取不到 REMOTE_LOCALES 清单 → 单独点名"离线面未核验"(不冒充缺键)',
    taroUnparsedCase.failures.some(
      (f) => f.rule === 'W4' && /REMOTE_LOCALES/.test(f.where) && /格式变更/.test(f.why),
    ),
  )
  t(
    'W4 生成器正常时不产生 REMOTE_LOCALES 假红',
    !withTaro.failures.some((f) => /REMOTE_LOCALES/.test(f.where)),
  )

  // W5:无人 import 但依赖该包的端整块缺键 → 单列落点债
  const w5 = evaluateWordTables({
    tables: pick('TIER_KEYS', { consumerEnds: [], dependentEnds: ['cli'] }),
    corpusLeaves: corpus,
    views: Object.fromEntries(
      LANGS.flatMap((l) => [
        [
          `cli/${l}`,
          leafMap([
            'tier.mode.a.title',
            'tier.mode.a.desc',
            'tier.mode.b.title',
            'tier.mode.b.desc',
          ]),
        ],
        [`web/${l}`, leafMap()],
      ]),
    ),
    taro: null,
    isSharedTable: () => true,
  })
  t(
    'W5 共享层词表在未接入的依赖端整块缺键 → 进 notices 落点债,且不进 failures',
    w5.notices.some((f) => f.rule === 'W5' && f.where.startsWith('cli/')) &&
      !w5.failures.some((f) => f.rule === 'W5'),
  )
  t(
    'W5 端包内的表不要求别的端(不误伤)',
    evaluateWordTables({
      tables: pick('TIER_KEYS', { consumerEnds: [], dependentEnds: ['cli'] }),
      corpusLeaves: corpus,
      views: good,
      taro: null,
      isSharedTable: () => false,
    }).failures.length === 0,
  )

  // 空输入防呆
  t(
    '空输入不静默变绿:全量 0 表 → guardNoTables 报错',
    guardNoTables({ tablesFound: 0, mode: 'full', scopedCount: 0 }) !== null,
  )
  t(
    '空输入防呆不误伤:暂存区没词表时 guard 只在候选=0 时报',
    guardNoTables({ tablesFound: 9, mode: 'staged', scopedCount: 0 }) === null,
  )

  // ── 消费端符号粒度(2026-09-24 补):只认"真读到这张表"的导出符号 ──────
  const modMulti = [
    "export const WORDS: Record<string, string> = { a: 'ns.a', b: 'ns.b' }",
    'const ZH_ONLY: Record<string, string> = { a: "甲", b: "乙" }',
    'export function keyOf(k: string) { return WORDS[k] }',
    'export function zhOnly(k: string) { return ZH_ONLY[k] }',
  ].join('\n')
  const scopedMulti = [...tableScopedSymbols(modMulti, 'WORDS')].sort()
  t(
    '收窄:读表的导出符号留下、读另一张中文字面量表的不留',
    scopedMulti.join(',') === 'WORDS,keyOf',
  )
  t(
    '反例(判据非恒真):把 zhOnly 改成也读这张表 → 它必须进触表面',
    [...tableScopedSymbols(modMulti.replace('ZH_ONLY[k]', 'WORDS[k]'), 'WORDS')]
      .sort()
      .join(',') === 'WORDS,keyOf,zhOnly',
  )
  t(
    '兜底①:符号没有自己的顶层声明块(re-export 形态)⇒ 退回全量,切分失效不得变绿',
    (() => {
      const viaReexport = ['export { nope } from "./other"', 'export const T = 1'].join('\n')
      return [...tableScopedSymbols(viaReexport, 'nope')].sort().join(',') === 'T,nope'
    })(),
  )
  t(
    '传递闭包:导出符号经**私有** helper 间接读表,仍须算触表',
    (() => {
      const viaPrivateHelper = [
        "const PRIV: Record<string, string> = { a: 'ns.a', b: 'ns.b' }",
        'function pick(k: string) { return PRIV[k] }',
        'export function unrelated() { return pick("a") }',
      ].join('\n')
      return [...tableScopedSymbols(viaPrivateHelper, 'PRIV')].join(',') === 'unrelated'
    })(),
  )
  t(
    '兜底②:无任何导出符号触表(收窄为空)⇒ 退回全量,不得判成"没有消费端"',
    (() => {
      const noExportReader = [
        "const PRIV: Record<string, string> = { a: 'ns.a', b: 'ns.b' }",
        'function pick(k: string) { return PRIV[k] }',
        'export function noop() { return 1 }',
      ].join('\n')
      return [...tableScopedSymbols(noExportReader, 'PRIV')].join(',') === 'noop'
    })(),
  )
  t(
    '别名:`export { 内名 as 外名 }` 时消费端写的是外名,判据须按外名收',
    [...tableScopedSymbols(`${modMulti}\nexport { keyOf as pickKey }`, 'WORDS')].includes(
      'pickKey',
    ),
  )
  // 真仓 A/B:同一份盘、只换符号面,证明收窄只影响该收的那一张
  t(
    '真仓:permission-tier 的真 accessor 不被收窄掉(收窄过窄即伪绿)',
    [...tableScopedSymbols(sourceFile('packages/shared/src/chat/permission-tier.ts'), 'PERMISSION_TIER_WORD_KEYS')].includes(
      'permissionTierWordKeys',
    ),
  )
  t(
    '真仓 A/B:error-messages 用全量符号面算出消费端、用收窄面算出零消费端',
    (() => {
      const EM = 'packages/shared/src/utils/error-messages.ts'
      const importers = buildReverseIndex(listSourceFiles(), buildPackageMap())
      const full = exportedSymbols(sourceFile(EM))
      const narrow = tableScopedSymbols(sourceFile(EM), 'ERROR_CODE_TO_I18N_KEY')
      return (
        consumerEnds({ file: EM }, importers, full).includes('mobile-rn') &&
        consumerEnds({ file: EM }, importers, narrow).length === 0 &&
        !narrow.has('toUserFriendlyMessage') &&
        narrow.has('resolveErrorMessage')
      )
    })(),
  )

  // 真仓锚点:走权威入口 run()(全量),不拼内部件
  const live = run({ quiet: true })
  const tier = (live?.consumers ?? []).find((c) => c.table.includes('permission-tier.ts'))
  t('真仓:PERMISSION_TIER_WORD_KEYS 被认定且键数=10', Boolean(tier) && tier.keys === 10)
  t('真仓:词表消费端只认已登记端', Boolean(tier) && tier.ends.every((e) => END_DIRS.includes(e)))
  t(
    '真仓:候选词表不为 0(全量入口自带防呆)',
    (live?.tablesFound ?? 0) > 0 && (live?.checkedTables ?? 0) > 0,
  )
  const specCase = resolveSpecifier(
    '@ihui/shared/chat',
    'apps/miniapp-taro/src/x.ts',
    buildPackageMap(),
  )
  t(
    'import 解析:@ihui/shared/chat → packages/shared/src/chat/index.ts',
    specCase === 'packages/shared/src/chat/index.ts',
  )
  t(
    'import 解析:第三方包说明符返回 null(不猜路径)',
    resolveSpecifier('react', 'apps/web/src/x.ts', buildPackageMap()) === null,
  )
  t(
    'import 解析:css 资源不当模块',
    resolveSpecifier('./noop.css', 'apps/web/src/x.ts', buildPackageMap()) === null,
  )
  // 真数据注入:真表 + 真语料视图,人为抽掉一个语言的一个键 → W3 必点名
  t(
    '真表注入:从真语料删掉 permissionTier 的一个 ko 键 → W3 判红并点名 键/表/语言',
    (() => {
      const realTier = discoverWordTables([
        {
          rel: 'packages/shared/src/chat/permission-tier.ts',
          text: sourceFile('packages/shared/src/chat/permission-tier.ts'),
        },
      ]).find((x) => x.name === 'PERMISSION_TIER_WORD_KEYS')
      if (!realTier) return false
      const views = buildMergedViews()
      const ko = new Map(views['web/ko'])
      ko.delete(realTier.keys[0])
      const r = evaluateWordTables({
        tables: [{ ...realTier, consumerEnds: ['web'], dependentEnds: [] }],
        corpusLeaves: corpusLeafSet(),
        views: { ...views, 'web/ko': ko },
        taro: null,
        isSharedTable: () => false,
      })
      return (
        r.failures.length === 1 &&
        r.failures[0].rule === 'W3' &&
        r.failures[0].key === realTier.keys[0] &&
        r.failures[0].where === 'web/ko'
      )
    })(),
  )
  t(
    '注入验证:值是键名本身(静默回显)也判红',
    (() => {
      const echo = new Map([...corpus].map((k) => [k, k]))
      const r = evaluateWordTables({
        tables: pick('TIER_KEYS', { consumerEnds: ['web'] }),
        corpusLeaves: corpus,
        views: Object.fromEntries(LANGS.map((l) => [`web/${l}`, echo])),
        taro: null,
        isSharedTable: () => false,
      })
      return r.failures.length === 4 * 5 && r.failures.every((f) => f.rule === 'W3')
    })(),
  )

  for (const c of cases) console.log(`${c.ok ? '✅' : '❌'} ${c.name}`)
  return cases.every((c) => c.ok) ? 0 : 1
}

export const __test__ = {
  stripComments,
  scanObjectLiterals,
  discoverWordTables,
  collectLeaves,
  buildMergedViews,
  corpusLeafSet,
  resolvable,
  resolveSpecifier,
  importSpecifiers,
  exportedSymbols,
  tableScopedSymbols,
  tableReachableNames,
  buildReverseIndex,
  reverseClosure,
  consumerEnds,
  buildPackageMap,
  buildDirectDeps,
  endsDependingOnPackage,
  listSourceFiles,
  taroBundleViews,
  evaluateWordTables,
  guardNoTables,
  run,
  LANGS,
  END_DIRS,
  DOTTED_KEY_RE,
  SCAN_ROOTS,
  TARO_GEN,
  TARO_GEN_SCRIPT,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  try {
    const r = run({ staged: argv.includes('--staged'), json: argv.includes('--json') })
    process.exit(r.ok ? 0 : 1)
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
