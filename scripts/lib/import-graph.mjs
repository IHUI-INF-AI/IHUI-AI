// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文件级 import 图（共享库，2026-09-25 立）。
 * 为什么要单独有这一份：本仓至少四处各自实现了同一件事的不同侧面 ——
 * 门 73 自建污点传播（跨文件回溯深度 5）、门 64 自建「谁 import 了这个适配器」、
 * 门 74 自建「按符号粒度的消费端」、门 103 建的是**模块级**图（不是文件级）。
 * 四处窄口径各不相同 ⇒ 各有盲区。「改了实现、坏了签名、消费者在别处」这一整类漏判
 * 正从缝里掉出去：门 16 的判据是「报错文件 ∈ staged」，跨包破坏恰好被它过滤掉。
 * 本库把这些侧面收成一个：**A → B 的边存在 ⇔ B 在判定面上被 A 引用**。
 * 三条设计约束（都是本仓踩过坑之后定的，不是风格选择）：
 * 1. **取材面必填**（`face`）。「取哪个面」判错是本仓最高频的假绿源，
 *    门 77/83/91/94/98/100/101/103 全为它写过专门条款。缺 face 直接抛，
 *    绝不静默走工作树 —— 共享工作树常年滞后 HEAD，按磁盘建图会把别人未提交的
 *    半编辑态当成本仓依赖，也会把自己已入库的边看成不存在。
 * 2. **缓存键 = (tree oid, face)**，禁止按符号名 `HEAD` 键控。§5b 与门 100 都记过
 *    「按 ref 名缓存 ⇒ ref 移动后读到旧树」。本库先把面解析成一个**具体 oid**，
 *    之后所有读取都用那个 oid（`<oid>:<path>`），因此「同一实例内 tree oid 变了必须
 *    重算」是结构性质而不是纪律。`worktree` 面没有稳定身份（磁盘随时变），
 *    故**刻意不缓存**，每次重读 —— 宁可慢，不缓存一个自己不知道过期没过期的东西。
 * 3. **宁报数不假绿**。四类边来源（`@ihui/*` 包名族 ∪ tsconfig paths 别名 ∪ 相对导入 ∪
 *    动态 `import()`/`require()`）里解析不到的一律计入 `undetermined` 并如实报数，
 *    不得静默丢。第三方裸包名（`react` / `node:fs`）按定义不是顶点，单独计 `external`，
 *    既不混进 undetermined 也不静默。
 *
 * 已知限制（如实登记，别当成没有）：
 *   - 判边是**行级**的：`from '<spec>'` / `import '<spec>'` / `import('<spec>')` /
 *     `require('<spec>')`。因此模板字符串或正则字面量里**长得像 import 的文本**会被
 *     连成假边。方向是**过包含**（closure 只会变大），对「把消费者拉进检查闭包」这一
 *     用途而言是可接受的偏差 —— 多捞一个消费者付的是时间，漏捞一个付的是正确性。
 *     注释行与紧邻块注释内的行已剔除，所以本仓 `scripts/**` 里那些示例 import
 *     不会因为「行首就是 import」而被误判（`* ` 与 `// ` 前缀被剔）。
 *   - `worktree` 面只看 `git ls-files` 的清单 ⇒ 未跟踪的新文件不入图。
 *   - 包入口只认**源码**（`src/index.*` 等），不认 `dist/*`：闭包的用途是让人去读源码，
 *     指到构建产物等于把检查引向一份可能已过期的东西。这类命中记
 *     `entry-not-in-source-scope`，进 undetermined 而不是静默。
 *
 * 迁移（本票**不做**，给后续票的输入）：门 64 / 门 74 语义最接近，先改调本库；
 * 门 16 的过滤判据从「报错文件 ∈ staged」改为「∈ 闭包」；门 103 的模块图由本库聚合上去。
 * 每一步都要有等价性证明，禁止一次性换引擎。
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, catBatch, gitRaw } from './face-reader.mjs'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(SELF_DIR, '..', '..')

/** 面：规格书点名的三档，字符串取值按规格逐字写（`HEAD` / `index` / `worktree`）。 */
export const FACE_VALUES = Object.freeze(['HEAD', 'index', 'worktree'])
/** 各门惯用别名（face-reader 用 `head`/`staged`），只作输入归一，不作为对外真相。 */
const FACE_ALIASES = Object.freeze({ head: 'HEAD', staged: 'index' })

const SRC_EXT = Object.freeze(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
/** 相对导入常写 `.js` 而真实文件是 `.ts`（NodeNext/打包器约定），两种都要试。 */
const EXT_ALIASES = Object.freeze({ '.js': ['.ts', '.tsx'], '.jsx': ['.tsx'] })
/** 跳过的是**产物与原生壳**，不是业务目录：跳过 `src` 会让图缺半边。 */
const SKIP_DIRS = Object.freeze([
  'node_modules',
  'dist',
  '.next',
  '.turbo',
  'build',
  'coverage',
  '.output',
  '.expo',
  'Pods',
  '.cache',
  'out',
])
/** 只在端与包里建图：`scripts/**` 的守门脚本互不 import，进图只会淹没真信号。 */
const SCAN_ROOTS = Object.freeze(['apps/', 'packages/', 'sdks/'])

const GIT_TIMEOUT = 120_000
/** 一次 batch 读全量源码 blob：真仓 8000+ 文件 ≈ 90MB，默认 64MB 会被截成「全都取不到」。 */
const BATCH_MAX_BUFFER = 1 << 29

// ── 路径与规格归一 ──────────────────────────────────────────────────────────────────────

/** 统一的顶点键： posix 分隔、无 `./` 前缀、无前后空白。 */
export function normalizeRel(p) {
  const s = String(p ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
  return s
}

/** 相对拼接后再归一（处理 `../`），不依赖 path 以便对虚拟路径同样成立。 */
export function joinRel(baseDir, spec) {
  const segs = (baseDir ? `${baseDir}/${spec}` : spec).split('/')
  const out = []
  for (const s of segs) {
    if (s === '' || s === '.') continue
    if (s === '..') out.pop()
    else out.push(s)
  }
  return out.join('/')
}

function inScanScope(rel) {
  return SCAN_ROOTS.some((p) => rel.startsWith(p))
}
function inSkipDir(rel) {
  const parts = rel.split('/')
  return parts.some((seg, i) => i < parts.length - 1 && SKIP_DIRS.includes(seg))
}
function hasSrcExt(rel) {
  const dot = rel.lastIndexOf('.')
  if (dot < 0) return false
  return SRC_EXT.includes(rel.slice(dot)) || rel.endsWith('.d.ts')
}

// ── 面解析（关键：一次解析成具体 oid，之后不再问符号名）────────────────────────────────

/**
 * @returns {{face:string, kind:'oid'|'index'|'live', oid:string|null, key:string, paths:string[], lsRaw:string}}
 */
function resolveFace(root, face) {
  const normalized = FACE_ALIASES[face] ?? face
  if (!FACE_VALUES.includes(normalized)) {
    throw new Undetermined(
      `face 必须是 ${FACE_VALUES.join(' | ')}（或其惯用别名），收到: ${JSON.stringify(face)}`,
    )
  }
  if (normalized === 'worktree') {
    const ls = gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT })
    const paths = ls.split('\0').filter(Boolean).map(normalizeRel)
    return { face: normalized, kind: 'live', oid: null, key: 'live', paths, lsRaw: ls }
  }
  if (normalized === 'index') {
    // 索引没有 tree oid 可问（`git write-tree` 会**写对象**，本库全程只读，故不用它）。
    // 退一步用「索引内容的指纹」：ls-files -s 逐行记 mode+blob sha+stage，
    // 任何一次暂存改动都会翻指纹 ⇒ 与 tree oid 等价的失效信号，且零副作用。
    const ls = gitRaw(['ls-files', '-s', '-z'], root, { timeout: GIT_TIMEOUT })
    const paths = ls
      .split('\0')
      .filter(Boolean)
      .map((line) => {
        const tab = line.indexOf('\t')
        const meta = line.slice(0, tab).split(' ')
        return { stage: Number(meta[2]), path: normalizeRel(line.slice(tab + 1)) }
      })
      .filter((e) => e.stage === 0)
      .map((e) => e.path)
    const key = `index:${createHash('sha256').update(ls).digest('hex')}`
    return { face: normalized, kind: 'index', oid: null, key, paths, lsRaw: ls }
  }
  const tree = gitRaw(['rev-parse', '--verify', '-q', 'HEAD^{tree}'], root, {
    timeout: GIT_TIMEOUT,
  }).trim()
  if (!/^[0-9a-f]{40,64}$/.test(tree)) throw new Undetermined('HEAD^{tree} 解析不到 oid')
  const ls = gitRaw(['ls-tree', '-r', '--name-only', '-z', tree], root, { timeout: GIT_TIMEOUT })
  const paths = ls.split('\0').filter(Boolean).map(normalizeRel)
  return { face: normalized, kind: 'oid', oid: tree, key: `tree:${tree}`, paths, lsRaw: ls }
}

/** 按面批量取内容：oid/index 面一次 `cat-file --batch`，worktree 面逐文件读盘。 */
function readBlobs(root, faceInfo, paths) {
  const out = new Map()
  if (paths.length === 0) return out
  if (faceInfo.kind === 'live') {
    for (const p of paths) {
      let text
      try {
        text = readFileSync(resolve(root, p), 'utf8')
      } catch (e) {
        if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) continue
        throw new Undetermined(`worktree 面取不到 ${p}: ${e.message}`)
      }
      if (!text.includes('\u0000')) out.set(p, text)
    }
    return out
  }
  const rev = faceInfo.kind === 'oid' ? faceInfo.oid : null
  const specs = paths.map((p) => (rev ? `${rev}:${p}` : `:${p}`))
  const got = catBatch(root, specs, { maxBuffer: BATCH_MAX_BUFFER, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) {
    const text = got.get(specs[i])
    if (typeof text === 'string') out.set(paths[i], text)
  }
  return out
}

// ── 规格抽取（行级，见文件头「已知限制」）──────────────────────────────────────────────

const RE_FROM = /\bfrom\s*['"]([^'"\n]+)['"]/g
const RE_SIDE_EFFECT = /^\s*import\s*['"]([^'"\n]+)['"]/
const RE_DYNAMIC = /(?:\bimport|\brequire)\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g
const RE_BLOCK_OPEN = /^\s*\/\*/
const RE_BLOCK_CLOSE = /\*\//

/** @returns {Array<{spec:string, syntax:'static'|'dynamic', line:number}>} */
export function extractSpecifiers(text) {
  const found = []
  const lines = String(text).split(/\r?\n/)
  let inBlock = false
  lines.forEach((line, idx) => {
    const trimmed = line.trim()
    const wasInBlock = inBlock
    if (inBlock && RE_BLOCK_CLOSE.test(line)) inBlock = false
    else if (!wasInBlock && RE_BLOCK_OPEN.test(line) && !RE_BLOCK_CLOSE.test(line)) inBlock = true
    // 注释行剔掉:本仓注释里全是取证用的示例 import,留着会造出一批现实中不存在的边。
    if (wasInBlock || inBlock) return
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    const at = idx + 1
    const push = (spec, syntax) => found.push({ spec, syntax, line: at })
    let hitDynamic = false
    for (const m of line.matchAll(RE_DYNAMIC)) {
      push(m[1], 'dynamic')
      hitDynamic = true
    }
    // `from '<spec>'` 一条式:多行 import 列表的 `} from './x'` 也在这种形态下被认出来。
    for (const m of line.matchAll(RE_FROM)) push(m[1], 'static')
    // 副作用式 `import './x'`:该行没有其他任何 import 形态时才认,避免与上面重复计。
    if (!hitDynamic && !RE_FROM.test(line)) {
      const se = RE_SIDE_EFFECT.exec(line)
      if (se) push(se[1], 'static')
    }
    RE_FROM.lastIndex = 0
  })
  return found
}

// ── 解析器 ─────────────────────────────────────────────────────────────────────────────

function candidatePaths(base) {
  const out = [base]
  const dot = base.lastIndexOf('.')
  const slash = base.lastIndexOf('/')
  const ext = dot > slash ? base.slice(dot) : ''
  const stem = ext ? base.slice(0, dot) : base
  if (ext && !SRC_EXT.includes(ext) && ext !== '.json') return out
  if (ext === '.json') {
    out.push(base)
    return out
  }
  for (const e of SRC_EXT) out.push(`${stem}${e}`)
  for (const alt of EXT_ALIASES[ext] ?? []) out.push(`${stem}${alt}`)
  for (const e of SRC_EXT) out.push(`${base}/index${e}`)
  return out
}

/** `exports` 字段里挑一个字符串目标（支持 string / {'import','require','default'} 两形态）。 */
function pickExportTarget(v) {
  if (typeof v === 'string') return v
  if (!v || typeof v !== 'object') return null
  for (const k of ['import', 'module-sync', 'default', 'require']) {
    const t = v[k]
    if (typeof t === 'string') return t
  }
  return null
}

/**
 * JSON 注释剥离必须**串感知**。第一版直接上 `/\/\*[\s\S]*?\*\//g`，于是
 * `"@/*": ["./src/*"]` 里的斜杠星被当成块注释开头，一路吃到下一个「星号斜杠」才收 —— 结果
 * tsconfig 解析失败、**整张别名表静默消失**，`--stats` 打出 `alias 0/0` 看着像
 * 「这仓没用 paths 别名」。真仓 `apps/web/tsconfig.json` 恰好就是这个形态。
 * 一个语法细节让一类判据整体隐身，而这类隐身永远表现为「没有违规」。
 */
export function stripJsonComments(text) {
  let out = ''
  let inStr = false
  let esc = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      out += c
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      out += c
      continue
    }
    const n = text[i + 1]
    if (c === '/' && n === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
      continue
    }
    if (c === '/' && n === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i++
      continue
    }
    out += c
  }
  return out
}

function parseTsconfig(raw) {
  try {
    return JSON.parse(
      stripJsonComments(raw).replace(/,(\s*[}\]])/g, '$1'), // 去尾逗号（tsconfig 合法）
    )
  } catch {
    return null
  }
}

/** package.json 是严格 JSON：注释与尾逗号都不合法，解不出就是解不出。 */
function parseJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * tsconfig paths 表,**按 tsconfig 所在目录键控**（不是按文件路径 —— 那样每次查表都要
 * 先猜文件名）。一层 `extends` 合并：本文件的 patterns 优先，父级补空。
 *
 * 只按「最近的 tsconfig」取 paths，是 tsc/bundler 实际行为的最小可用近似；
 * 近似失败时调用方落到 `undetermined`（大声报数）而不是静默断边 —— 静默断边正是
 * 本库要消灭的那一类漏判。
 */
export function buildAliasTables(files, tsconfigPaths) {
  /** @type {Map<string, {dir:string, baseUrl:string, paths:Array<{prefix:string,suffix:string,targets:string[]}>, extendsRel:string|null}>} */
  const byDir = new Map()
  for (const p of tsconfigPaths) {
    const raw = files.get(p)
    if (!raw) continue
    const json = parseTsconfig(raw)
    if (!json) continue // 解不出来的 tsconfig 变体：就此跳过，不猜
    const co = json?.compilerOptions
    const extendsRel = typeof json.extends === 'string' ? json.extends : null
    const dir = dirname(p)
    const key = dir === '.' ? '' : dir
    if (!byDir.has(key)) byDir.set(key, mkTable(key, co, extendsRel))
  }
  // 一层 extends:目标按路径解析到它所在的目录表,把自己的 paths 接在父级之前。
  for (const t of byDir.values()) {
    if (!t.extendsRel || !t.extendsRel.startsWith('.')) continue
    const targetDir = dirname(normalizeRel(joinRel(t.dir, t.extendsRel)))
    const parent = byDir.get(targetDir === '.' ? '' : targetDir)
    if (parent && parent !== t) t.paths = [...t.paths, ...parent.paths]
  }
  return byDir
}

function mkTable(dir, co, extendsRel) {
  const paths = []
  const src = co && co.paths && typeof co.paths === 'object' ? co.paths : {}
  for (const [key, val] of Object.entries(src)) {
    if (!Array.isArray(val)) continue
    const star = key.indexOf('*')
    paths.push({
      key,
      wild: star >= 0,
      prefix: star < 0 ? key : key.slice(0, star),
      suffix: star < 0 ? '' : key.slice(star + 1),
      targets: val.filter((v) => typeof v === 'string'),
    })
  }
  // 精确键先于通配键：`"@plugins-data"` 若被 `"@/*"` 抢走，解析到的是错文件而不是没文件。
  paths.sort((a, b) => Number(b.wild) - Number(a.wild) || b.prefix.length - a.prefix.length)
  return {
    dir,
    baseUrl: typeof co?.baseUrl === 'string' ? co.baseUrl : '.',
    paths,
    extendsRel: extendsRel ?? null,
  }
}

/**
 * 从 importer 往上找最近的带 paths 的 tsconfig 目录，再按键匹配。
 *
 * ⚠️ 通配键的 `prefix` **已含**分隔符（`"@/*"` → prefix `"@/"`），所以下面判前缀时
 * 不得再补一个 `/`。第一版补了，结果 `"@/*"` 永远匹配不上，真仓 6251 处 `@/...`
 * 被算成第三方裸包名 —— 别名这一整类边**静默消失**，而 `--stats` 打出的
 * `alias 1/187` 看着像「这仓基本没用 paths」。通配与精确两种键的失效形态不同，
 * 所以两类都各有正反例（见镜像测试）。
 */
export function matchAlias(importer, spec, tables) {
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@ihui/')) return null
  const dirs = []
  let cur = dirname(importer)
  while (cur !== '.' && cur !== '/') {
    dirs.push(cur)
    cur = dirname(cur)
  }
  dirs.push('')
  for (const d of dirs) {
    const t = tables.get(d)
    if (!t || t.paths.length === 0) continue
    for (const entry of t.paths) {
      if (entry.wild) {
        if (!spec.startsWith(entry.prefix) || !spec.endsWith(entry.suffix)) continue
        if (spec.length < entry.prefix.length + entry.suffix.length) continue
        const mid = spec.slice(entry.prefix.length, spec.length - entry.suffix.length)
        if (!mid) continue
        return { table: t, mid, entry }
      }
      if (spec === entry.key) return { table: t, mid: '', entry }
      if (spec.startsWith(`${entry.key}/`)) {
        return { table: t, mid: spec.slice(entry.key.length + 1), entry }
      }
    }
  }
  return null
}

/**
 * @returns {{state:'edge'|'external'|'undetermined', kind?:string, target?:string, reason?:string}}
 */
export function resolveSpecifier({ spec, importer, vertexSet, pkgByName, manifests, tables }) {
  const edge = (target, kind) => ({ state: 'edge', target, kind })

  if (spec.startsWith('.') || spec.startsWith('/')) {
    const base = spec.startsWith('/')
      ? normalizeRel(spec.slice(1))
      : joinRel(dirname(importer), spec)
    for (const c of candidatePaths(normalizeRel(base))) {
      if (vertexSet.has(c)) return edge(c, 'relative')
    }
    return { state: 'undetermined', kind: 'relative', reason: 'relative-not-found' }
  }

  if (spec.startsWith('@ihui/')) {
    const rest = spec.slice('@ihui/'.length)
    const at = rest.indexOf('/')
    const pkgName = at < 0 ? rest : rest.slice(0, at)
    const sub = at < 0 ? null : rest.slice(at + 1)
    const pkgDir = pkgByName.get(pkgName.replace(/^@[^/]+\//, '')) ?? pkgByName.get(pkgName)
    if (!pkgDir) {
      return { state: 'undetermined', kind: 'pkg', reason: 'no-such-workspace-package' }
    }
    const manifest = manifests.get(`${pkgDir}/package.json`)
    const exportsMap = manifest?.exports
    const tried = new Set()
    const tryTarget = (t) => {
      if (typeof t !== 'string' || !t.startsWith('.')) return null
      const cand = normalizeRel(joinRel(pkgDir, t))
      if (tried.has(cand)) return null
      tried.add(cand)
      for (const c of candidatePaths(cand)) if (vertexSet.has(c)) return c
      return null
    }
    if (sub) {
      const direct =
        exportsMap && typeof exportsMap === 'object'
          ? pickExportTarget(exportsMap[`./${sub}`] ?? exportsMap[sub])
          : null
      const hit = tryTarget(direct)
      if (hit) return edge(hit, 'pkg')
      // 兜底:大量 workspace 包根本没写 exports 子路径,按目录结构找。
      for (const c of candidatePaths(normalizeRel(joinRel(pkgDir, sub)))) {
        if (vertexSet.has(c)) return edge(c, 'pkg')
      }
      return { state: 'undetermined', kind: 'pkg', reason: 'subpath-not-found' }
    }
    const entry =
      typeof exportsMap === 'string'
        ? exportsMap
        : exportsMap && typeof exportsMap === 'object'
          ? pickExportTarget(exportsMap['.'])
          : null
    const hit = tryTarget(entry)
    if (hit) return edge(hit, 'pkg')
    for (const m of ['main', 'module']) {
      const h = tryTarget(typeof manifest?.[m] === 'string' ? manifest[m] : null)
      if (h) return edge(h, 'pkg')
    }
    for (const base of [`${pkgDir}/src/index`, `${pkgDir}/index`]) {
      const hit = candidatePaths(normalizeRel(base)).find((c) => vertexSet.has(c))
      if (hit) return edge(hit, 'pkg')
    }
    return { state: 'undetermined', kind: 'pkg', reason: 'entry-not-in-source-scope' }
  }

  const alias = matchAlias(importer, spec, tables)
  if (alias) {
    const baseDir = normalizeRel(joinRel(alias.table.dir, alias.table.baseUrl ?? '.'))
    for (const t of alias.entry.targets) {
      const filled = t.includes('*') ? t.replace('*', alias.mid) : `${t}${alias.mid}`
      const base = normalizeRel(joinRel(baseDir, filled.replace(/^\.\//, '')))
      for (const c of candidatePaths(base)) {
        if (vertexSet.has(c)) return edge(c, 'alias')
      }
    }
    return { state: 'undetermined', kind: 'alias', reason: 'alias-target-not-found' }
  }
  return { state: 'external', kind: 'bare' }
}

// ── 建图 ───────────────────────────────────────────────────────────────────────────────

/** face -> (tree oid | 索引指纹) -> graph。键控规则见文件头约束 2；测试走 `noCache`，不另开清空口。 */
const GRAPH_CACHE = new Map()

/**
 * @param {{face:string, root?:string, noCache?:boolean}} opts
 */
export function buildFileGraph(opts) {
  const face = opts?.face
  if (face === undefined || face === null || face === '') {
    throw new Undetermined(
      'buildFileGraph 必须显式给 face（HEAD | index | worktree）—— 不给默认值是刻意的：' +
        '「取哪个面」判错是本仓最高频假绿源（门 77/83/91/94/98/100/101/103 均为此写过专门条款）',
    )
  }
  const root = opts.root ?? ROOT
  // 相对基准必须是仓库根：root 若是仓库**子目录**，ls-tree 的路径与 join(root, rel) 会错位，
  // 产出的正是本库最不该产出的东西 —— 看起来自洽、实则混面的绿。
  assertRepoRoot(root, 'import-graph')
  const started = Date.now()
  const info = resolveFace(root, face)
  const cacheKey = `${root}::${info.key}`
  if (!opts.noCache && info.kind !== 'live') {
    const hit = GRAPH_CACHE.get(cacheKey)
    if (hit) return hit
  }

  const all = info.paths
  const srcFiles = all.filter((p) => inScanScope(p) && !inSkipDir(p) && hasSrcExt(p))
  const metaFiles = all.filter(
    (p) =>
      inScanScope(p) &&
      !inSkipDir(p) &&
      /(^|\/)package\.json$/.test(p) &&
      !p.includes('/node_modules/'),
  )
  const tsconfigs = all.filter((p) => /(^|\/)tsconfig[^/]*\.json$/.test(p) && !inSkipDir(p))
  const rootTsconfigs = all.filter((p) => /^tsconfig[^/]*\.json$/.test(p))

  const files = readBlobs(root, info, [...srcFiles, ...metaFiles, ...tsconfigs, ...rootTsconfigs])
  const vertexSet = new Set(srcFiles)

  /** @type {Map<string, string>} 包名（全名与去 scope 短名各一份）-> 包目录 */
  const pkgByName = new Map()
  /** @type {Map<string, Object>} `<pkgDir>/package.json` -> 已 parse 的清单 */
  const manifests = new Map()
  for (const p of metaFiles) {
    const json = parseJson(files.get(p))
    if (!json || typeof json.name !== 'string') continue
    const dir = dirname(p)
    pkgByName.set(json.name, dir)
    pkgByName.set(json.name.replace(/^@[^/]+\//, ''), dir)
    manifests.set(p, json)
  }
  const tables = buildAliasTables(files, [...tsconfigs, ...rootTsconfigs])

  const edges = []
  const forward = new Map()
  const reverse = new Map()
  const undetermined = []
  const external = []
  const attempts = { pkg: 0, alias: 0, relative: 0, dynamic: 0 }
  const resolved = { pkg: 0, alias: 0, relative: 0, dynamic: 0 }

  for (const file of srcFiles) {
    const text = files.get(file)
    if (typeof text !== 'string') continue
    for (const ref of extractSpecifiers(text)) {
      const spec = ref.spec
      if (/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(spec)) continue // node: / data: / http(s):
      const r = resolveSpecifier({
        spec,
        importer: file,
        vertexSet,
        pkgByName,
        manifests,
        tables,
      })
      const kind = r.kind === 'pkg' || r.kind === 'alias' || r.kind === 'relative' ? r.kind : null
      if (kind) attempts[kind] += 1
      if (ref.syntax === 'dynamic') attempts.dynamic += 1
      if (r.state === 'edge') {
        if (r.target === file) continue // 自环不进闭包
        if (kind) resolved[kind] += 1
        if (ref.syntax === 'dynamic') resolved.dynamic += 1
        edges.push({
          from: file,
          to: r.target,
          kind: kind ?? 'bare',
          syntax: ref.syntax,
          spec,
          line: ref.line,
        })
        if (!forward.has(file)) forward.set(file, new Set())
        forward.get(file).add(r.target)
        if (!reverse.has(r.target)) reverse.set(r.target, new Set())
        reverse.get(r.target).add(file)
      } else if (r.state === 'undetermined') {
        undetermined.push({ from: file, spec, kind: r.kind, reason: r.reason, line: ref.line })
      } else {
        external.push({ from: file, spec, line: ref.line })
      }
    }
  }

  const graph = {
    face: info.face,
    faceKey: info.key,
    faceKind: info.kind,
    treeOid: info.oid,
    root,
    vertices: srcFiles,
    edges,
    forward,
    reverse,
    undetermined,
    external,
    elapsedMs: Date.now() - started,
    stats: {
      vertices: srcFiles.length,
      edges: edges.length,
      undetermined: undetermined.length,
      external: external.length,
      attempts,
      resolved,
    },
  }
  if (info.kind !== 'live') GRAPH_CACHE.set(cacheKey, graph)
  return graph
}

/**
 * 沿反向边做传递闭包：把「直接或间接引用了 changed 里任何东西」的文件全拉进来。
 * 不变量：**闭包 ⊇ changed**（changed 里不在图上的路径也原样保留 —— 它可能正是那个
 * 被删除的消费者，丢掉它等于把闭包判据退化成「按暂存清单判」）。
 */
export function widenOverDependents(changed, graph) {
  if (!graph || !(graph.reverse instanceof Map)) {
    throw new Undetermined('widenOverDependents 需要一个 graph（buildFileGraph 的返回值）')
  }
  const seeds = new Set(
    (Array.isArray(changed) ? changed : [changed]).map((p) => normalizeRel(p)).filter(Boolean),
  )
  const closure = new Set(seeds)
  const queue = [...seeds]
  while (queue.length) {
    const cur = queue.shift()
    for (const dep of graph.reverse.get(cur) ?? []) {
      if (closure.has(dep)) continue
      closure.add(dep)
      queue.push(dep)
    }
  }
  return {
    closure: [...closure].sort(),
    added: [...closure].filter((p) => !seeds.has(p)).sort(),
    seedCount: seeds.size,
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────────────────

const USAGE = `用法: node scripts/lib/import-graph.mjs [--stats] [--widen <path> ...] [--face HEAD|index|worktree] [--json] [--no-cache]
  --stats   打印顶点数 / 边数 / undetermined 数 + 四类边解析率 + 实测耗时
  --widen   对给定路径做反向依赖闭包，打印闭包大小与新增成员（前 40 条）
  --face    取材面，默认 HEAD；未登记开关一律 exit 2（不得静默落进默认分支）`

/**
 * 白名单解析。拼错的开关必须 exit 2 —— 本仓在 `sync-lost-commit-tags.mjs` 踩过：
 * 未知 flag 掉进默认分支，打一句抬头就 exit 0，什么都没说也什么都没做。
 */
export function parseArgv(argv) {
  const opts = { stats: false, json: false, noCache: false, face: 'HEAD', widen: [], error: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--stats') opts.stats = true
    else if (a === '--json') opts.json = true
    else if (a === '--no-cache') opts.noCache = true
    else if (a === '--face') {
      const v = argv[++i]
      if (!v) {
        opts.error = '--face 缺取值'
        return opts
      }
      opts.face = v
    } else if (a === '--widen') {
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.widen.push(argv[++i])
    } else {
      opts.error = `未知开关: ${a}`
      return opts
    }
  }
  if (!opts.stats && opts.widen.length === 0) opts.stats = true
  return opts
}

function rate(n, d) {
  return d === 0 ? 'n/a' : `${((n / d) * 100).toFixed(1)}%`
}

export function formatStats(graph) {
  const s = graph.stats
  const L = []
  L.push(
    `import-graph · face=${graph.face}（${graph.faceKind}${graph.treeOid ? ` ${graph.treeOid.slice(0, 10)}` : ''}）`,
  )
  L.push(`  顶点数 : ${s.vertices}`)
  L.push(`  边数   : ${s.edges}`)
  L.push(`  undetermined : ${s.undetermined}（解析不到，如实报数，不得静默丢）`)
  L.push(`  external     : ${s.external}（第三方裸包名，按定义不是顶点）`)
  L.push(`  耗时   : ${graph.elapsedMs} ms`)
  L.push('  四类边来源解析率：')
  for (const k of ['pkg', 'alias', 'relative', 'dynamic']) {
    L.push(
      `    ${k.padEnd(9)}: ${s.resolved[k]}/${s.attempts[k]} (${rate(s.resolved[k], s.attempts[k])})`,
    )
  }
  const reasons = new Map()
  for (const u of graph.undetermined) {
    const key = `${u.kind}/${u.reason}`
    reasons.set(key, (reasons.get(key) ?? 0) + 1)
  }
  if (reasons.size) {
    L.push('  undetermined 归因：')
    for (const [k, v] of [...reasons].sort((a, b) => b[1] - a[1])) L.push(`    ${k} = ${v}`)
  }
  return L.join('\n')
}

async function main() {
  const opts = parseArgv(process.argv.slice(2))
  if (opts.error) {
    console.error(`❌ ${opts.error}\n${USAGE}`)
    process.exit(2)
  }
  let graph
  try {
    graph = buildFileGraph({ face: opts.face, root: ROOT, noCache: opts.noCache })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`⚠️ 无法判定：${e.message}`)
      process.exit(2)
    }
    throw e
  }
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          face: graph.face,
          treeOid: graph.treeOid,
          stats: graph.stats,
          elapsedMs: graph.elapsedMs,
          undeterminedSample: graph.undetermined.slice(0, 50),
        },
        null,
        2,
      ),
    )
  } else {
    console.log(formatStats(graph))
  }
  if (opts.widen.length) {
    const w = widenOverDependents(opts.widen, graph)
    console.log(`闭包: seed=${w.seedCount} → ${w.closure.length}（新增消费者 ${w.added.length}）`)
    for (const p of w.added.slice(0, 40)) console.log(`  + ${p}`)
  }
}

// §22d：CLI 与「被测试 import」两种形态必须互不牵连。Windows 反斜杠路径须经
// pathToFileURL 归一才能与 import.meta.url 逐字相等 —— 手拼 file:// 永远不匹配，
// 后果是 CLI 永不触发 main（静默失控），比误触发更糟。
const isDirectRun = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  ROOT,
  normalizeRel,
  joinRel,
  candidatePaths,
  stripJsonComments,
  parseTsconfig,
  extractSpecifiers,
  matchAlias,
  buildAliasTables,
  resolveSpecifier,
  parseArgv,
  resolveFace,
  buildFileGraph,
  widenOverDependents,
  GRAPH_CACHE,
  Undetermined,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
