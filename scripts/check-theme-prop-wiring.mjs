// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨端主题透线守门(blocking)—— packages/app 的主题驱动组件必须被**接线**。
 *
 * 结构事实:`packages/app/src` 下 ~250 个组件靠 `colorScheme` prop 驱动主题
 * (`const tk = getTokens(colorScheme)`),且形参一律带默认值 `colorScheme = 'light'`。
 * 默认值 = **静默失效开关**:调用方写死字面量、或干脆不传,整棵子树都会按浅色档案渲染,
 * 而 app 自己的 chrome 跟着真主题走 —— 同一个屏幕两套档案,不报错、typecheck 也不红。
 *
 * 两类真实事故(2026-09-24 真机复现,修复见 84583fdf6 / cc63b5bd0a):
 *  L1 `apps/mobile-rn/src/screens/PlazaScreen.tsx:464` 与
 *     `apps/mobile-rn/src/screens/RankingDetailScreen.tsx:171` 写 `colorScheme="light"`
 *     → 实测导航栏/TabBar #1a1a1a(深)而页面体 #f5f5f5/#ebebeb(浅)。
 *  L2 漏传 `colorScheme` 的渲染点:当前实测 0 处 ⇒ 本门的作用是把它钉死在 0
 *     (刻意不把 213 处形参默认值改成必填:无收益,且会与并行会话在 213 个文件上对撞)。
 *
 * 判据不靠手工组件清单(清单过期正是上一道门漏判的原因):
 *  组件集 = 扫 `packages/app/src` 下所有 .tsx 里**导出**的、形参解构含 `colorScheme` 的组件名;
 *  渲染点 = 扫 apps/mobile-rn|desktop|cli + packages/app 的 .tsx 里这些组件的 JSX 开标签体。
 *
 * 两类红点分别报:`未接线(漏传 colorScheme)` / `写死字面量(colorScheme="light|dark")`。
 * `{...spread}` 转发的渲染点单列为「不确定」并如实报数(不静默放过、也不误判为红),由人工核。
 *
 * ⚠️ 假阳性的唯一来源是**同名不同物**:apps/mobile-rn/src/components 下有 NavBar / TabBar /
 * Carousel / UserInfoCard … 端内自绘版(它们根本不吃 colorScheme)。首跑不限定说明符时
 * 49 处"漏传"全是这类端内组件,故本门必须先做 import 解析(含 alias、默认导入、
 * 命名空间成员),只有解析到 `@ihui/rn-app` / 包内相对路径的才算共享主题组件。
 *
 * 存量口径(2026-09-24 建门实测):共享**屏幕**被各端 wrapper 渲染时普遍不传 colorScheme,
 * 全量 118 处 / 111 文件(其中 111 处所在文件通篇没有 colorScheme 字样 ⇒ 铁证),
 * 已冻结进 scripts/theme-prop-wiring-baseline.json 的「文件 × 类」棘轮(只减不增)。
 * ⇒ 新增一处、或在已冻结文件里再加一处都立刻红;`--strict` 忽略基线看全量欠债。
 *
 * 用法:
 *   node scripts/check-theme-prop-wiring.mjs                  # 全量(判 **HEAD blob**,按棘轮基线)
 *   node scripts/check-theme-prop-wiring.mjs --staged         # 判 **索引 blob**,只看暂存的渲染点文件
 *   node scripts/check-theme-prop-wiring.mjs --worktree       # 判磁盘 —— 仅供人工排查,不是提交门禁
 *   node scripts/check-theme-prop-wiring.mjs --root <dir>     # 测试注入位(默认本仓)
 *   node scripts/check-theme-prop-wiring.mjs --strict         # 忽略基线,报全部欠债
 *   node scripts/check-theme-prop-wiring.mjs --json           # CI 机读
 *   node scripts/check-theme-prop-wiring.mjs --update-baseline # 收紧基线(全量口径;拒绝与 --staged 同用)
 *   node scripts/check-theme-prop-wiring.mjs --self-test      # 逻辑自检
 * 紧急跳过:HUSKY_SKIP_THEME_PROP_WIRING=1
 *
 * 退出码:0 = 通过 / 1 = 判据红 / **2 = 无法判定**(取材失败,不是通过)。
 * 判定面与守门 70/77/83/94/98/101 同口径:共享工作树常年滞后 HEAD、且混着并行会话的
 * 半编辑态,按磁盘判会在"假红逼跳门"和"假绿放违规进 HEAD"之间来回跳。
 */
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SKIP_ENV = 'HUSKY_SKIP_THEME_PROP_WIRING'
const BASELINE_PATH = path.join(__dirname, 'theme-prop-wiring-baseline.json')

/**
 * 三个判定面(口径与守门 70/77/83/94/98/101 对齐)。
 * 本门此前全量与 --staged 都读磁盘 —— 共享工作树常年滞后 HEAD、且混着并行会话的半编辑态,
 * 于是同一份提交内容会在"恒红"和"假绿"之间来回跳。假绿那一半更致命:索引里带着违规、
 * 盘上别人又顺手改好了 ⇒ 门报绿,违规照样进 HEAD。
 */
const FACES = ['staged', 'head', 'worktree']
const FACE_LABEL = {
  staged: '索引 blob(git show :<path>)',
  head: 'HEAD blob(git show HEAD:<path>)',
  worktree: '工作树(磁盘)',
}
/** 判据取不到输入时抛它 —— 折成 exit 2「无法判定」,绝不冒烟成判据红、更绝不记绿 */
class Undetermined extends Error {}

function gitErrText(e) {
  const raw = e?.stderr ?? e?.stdout ?? e?.message ?? String(e)
  return String(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8'))
    .trim()
    .split(/\r?\n/)[0]
}

/** 同一个目录吗 —— 先各自 realpath 穿过 junction / 符号链接,再按平台大小写敏感性比 */
function sameDir(a, b) {
  const norm = (p) => {
    let real = p
    try {
      real = realpathSync(p)
    } catch {
      /* 目标不存在时退回原路径,让后续判据去点名它 */
    }
    const resolved = path.resolve(real)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  return norm(a) === norm(b)
}

/** 组件真相源:只有这里的导出组件算「主题驱动组件」 */
const COMPONENT_DIR = 'packages/app/src'
/** 共享包在盘上的根(说明符解析的落点) */
const SHARED_PKG = '@ihui/rn-app'
/** 渲染点扫描范围(4 端;web/miniapp 不用 packages/app 的 RN 组件) */
const RENDER_DIRS = ['packages/app/src', 'apps/mobile-rn/src', 'apps/desktop/src', 'apps/cli/src']
const THEME_PROP = 'colorScheme'
const LITERAL_ARCHIVES = new Set(['light', 'dark'])

// ---------------------------------------------------------------- 扫描原语

/**
 * 从 src[i] 的开引号走到闭引号(含转义),返回闭引号下标。
 * 按 JS 语义:**单/双引号串不得跨行**,模板串可以。走不通返回 -1 —— 调用方必须
 * 把该引号当普通字符,否则 JSX 文本里的撇号(`don't`)会把后文整片误判为"串内",
 * 反过来制造漏判(漏掉真正的渲染点)。
 */
export function skipStringChars(src, i) {
  const quote = src[i]
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j]
    if (c === '\\') {
      j++
      continue
    }
    if (c === '\n' && quote !== '`') return -1
    if (c === quote) return j
  }
  return -1
}

/**
 * 扫描器统一入口:是串就返回闭引号下标,不是串(同行不闭合)就返回 i 本身,
 * 让调用方把该引号当普通字符继续走。
 * ⚠️ 不得直接把 skipStringChars 的 -1 赋给循环变量:`i = -1` 后 `i++` → 0,
 * 会把整个文件重扫成死循环。
 */
export function skipStrOr(src, i) {
  const end = skipStringChars(src, i)
  return end === -1 ? i : end
}

/**
 * 注释/字符串清洗:把 `//…`、`/* … *\/`、`@ts-…` 里的内容替换成空格,
 * 保留行结构与字符串原文(串内的 `<Foo />` 示例不得被当成真渲染点)。
 * 正则字面量不作专门处理:JSX 源文件里 `/<Foo>/` 形态的字面量属于极少数,
 * 若真出现只会多算一个渲染点候选,再由组件名白名单挡掉。
 */
export function stripComments(src) {
  const out = src.split('')
  let mode = ''
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const two = src.slice(i, i + 2)
    if (mode === '') {
      if (two === '//') {
        mode = '//'
        continue
      }
      if (two === '/*') {
        mode = '/*'
        continue
      }
      if (c === "'" || c === '"' || c === '`') {
        i = skipStrOr(src, i)
        continue
      }
      continue
    }
    if (mode === '//') {
      if (c === '\n') {
        mode = ''
        continue
      }
      out[i] = ' '
      continue
    }
    if (two === '*/') {
      out[i] = ' '
      out[i + 1] = ' '
      i++
      mode = ''
      continue
    }
    if (c !== '\n') out[i] = ' '
  }
  return out.join('')
}

/** src[open] 必须是 `(` / `{`,返回配对闭括号下标;不配平返回 -1 */
export function matchDelimited(src, open) {
  const pairs = { '(': ')', '{': '}' }
  const close = pairs[src[open]]
  if (!close) return -1
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      i = skipStrOr(src, i)
      continue
    }
    if (c === src[open]) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

const RESERVED_LEAD = new Set(['as', 'from', 'keyof', 'readonly', 'type'])

/**
 * 解构**对象字面量文本**(含外层大括号)→ 顶层键名。
 * `{ a, b = 1, c: { d } }` → ['a','b','c']。要点:
 *  - 只在最外层逗号处切分 ⇒ 嵌套对象/数组/函数调用里的逗号不切断;
 *  - 每个条目取**首个标识符** = 键名(`colorScheme = 'light'` 的键是 colorScheme,
 *    原判据要求整串是裸标识符,于是**带默认值的形参全被漏掉** ⇒ NavBar 等一大片
 *    主题驱动组件根本进不了组件集,这正是本门自己会犯的假绿);
 *  - 串内逗号不切分。
 */
export function topLevelBindingNames(objText) {
  const open = objText.indexOf('{')
  if (open === -1) return []
  const close = matchDelimited(objText, open)
  if (close === -1) return []
  const names = []
  let depth = 0
  let token = ''
  const flush = () => {
    const m = /^\s*([A-Za-z_$][\w$]*)/.exec(token)
    if (m && !RESERVED_LEAD.has(m[1])) names.push(m[1])
    token = ''
  }
  for (let i = open + 1; i < close; i++) {
    const c = objText[i]
    if (c === "'" || c === '"' || c === '`') {
      const end = skipStrOr(objText, i)
      token += objText.slice(i, end + 1)
      i = end
      continue
    }
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    if (c === ',' && depth === 0) {
      flush()
      continue
    }
    token += c
  }
  flush()
  return names
}

// ------------------------------------------------ 组件集推导(不手工维护)

const EXPORTED_DECL =
  /export\s+(?:default\s+)?(?:async\s+)?(?:function\s\*?\s*|const\s+|let\s+|var\s+)([A-Z][A-Za-z0-9_]*)/g

/**
 * 本文件里「形参解构包含 colorScheme」的导出组件名。
 * 覆盖 `export function X({colorScheme})` / `export const X = ({...}) => ` /
 * `export const X = memo(({...}) => …)` / `export const X: React.FC<P> = ({…}) => …`。
 */
export function findThemeDrivenComponents(src) {
  const clean = stripComments(src)
  const names = []
  for (const m of clean.matchAll(EXPORTED_DECL)) {
    const from = (m.index ?? 0) + m[0].length
    const params = findDestructuredParams(clean, from)
    if (params && topLevelBindingNames(params).includes(THEME_PROP)) names.push(m[1])
  }
  return names
}

/**
 * 从声明头往后找**第一个「内容以 `{` 开头」的括号组** = 解构形参的 `{...}` 原文。
 * 为什么要往后走:`export const X = memo(({ ... }) => …)` 的第一个 `(` 是 memo 的,
 * 只认第一个会把整类 memo/forwardRef 组件漏掉;而 `(props) => …` 这类非解构形参
 * 直接跳过,继续找下一组括号。
 */
export function findDestructuredParams(src, from, window = 4000) {
  const stop = Math.min(src.length, from + window)
  for (let i = from; i < stop; i++) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      i = skipStrOr(src, i)
      continue
    }
    if (c !== '(') continue
    const close = matchDelimited(src, i)
    if (close === -1) continue
    const inner = src.slice(i + 1, close)
    const braceStart = inner.search(/\S/)
    if (braceStart === -1 || inner[braceStart] !== '{') continue
    const abs = i + 1 + braceStart
    const objEnd = matchDelimited(src, abs)
    if (objEnd === -1) continue
    return src.slice(abs, objEnd + 1)
  }
  return null
}

// -------------------------------------------------------------- 渲染点扫描

const ELEMENT_HEAD = /^<([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)*)/

/**
 * 扫出所有 JSX 元素开标签 → { name, attrs, index }。
 * **括号深度感知**:`onPress={() => a > b}` 里的 `>` 不得提前收口;
 * 同理串内 `>`、嵌套 `<Bar/>` 都要按 {} 深度跳过。命中一个开标签后**不回退到结尾**,
 * 而是从下一个字符继续,以保证属性表达式里嵌套的组件同样被扫到。
 */
export function findJsxElementSites(src) {
  const clean = stripComments(src)
  const sites = []
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (c === "'" || c === '"' || c === '`') {
      i = skipStrOr(clean, i)
      continue
    }
    if (c !== '<') continue
    if (clean[i + 1] === '/' || clean[i + 1] === '>') continue
    const head = ELEMENT_HEAD.exec(clean.slice(i, i + 120))
    if (!head) continue
    let j = i + head[0].length
    let depth = 0
    let attrs = null
    for (; j < clean.length; j++) {
      const k = clean[j]
      if (k === "'" || k === '"' || k === '`') {
        j = skipStrOr(clean, j)
        continue
      }
      if (k === '{') {
        depth++
        continue
      }
      if (k === '}') {
        if (depth > 0) depth--
        continue
      }
      if (depth === 0 && (k === '>' || k === ';' || k === ')' || k === '<')) {
        if (k === '>') attrs = clean.slice(i + head[0].length, j)
        break
      }
      if (depth === 0 && (k === '&' || k === '|')) break
      if (k === '\n' && j - i > 4000) break
    }
    if (attrs === null) continue
    sites.push({ name: head[1], attrs, index: i })
  }
  return sites
}

/**
 * 把属性串里**非顶层**的部分(花括号表达式内、字符串字面量内)掩成空格,
 * 结果与入参**逐位同长**,故掩码上匹配到的下标可直接回指原文。
 * 为什么必须掩:不掩的话 `data-colorScheme="light"`、`icon={<Wrapped/>}` 里的
 * 字符会被当成顶层属性来认,前者假红、后者串了判定范围。
 */
export function maskNonTopLevel(attrs) {
  let out = ''
  let depth = 0
  for (let i = 0; i < attrs.length; i++) {
    const c = attrs[i]
    if (depth === 0 && (c === "'" || c === '"' || c === '`')) {
      const end = skipStringChars(attrs, i)
      if (end !== -1) {
        out += ' '.repeat(end - i + 1)
        i = end
        continue
      }
    }
    if (c === '{') depth++
    if (depth > 0) {
      if (c === '}') depth--
      out += ' '
      continue
    }
    out += c
  }
  return out
}

/**
 * 检查开标签属性体里的主题透线。
 * 返回 { kind: 'ok' | 'missing' | 'literal' | 'spread-unknown', detail }
 *  - literal:`colorScheme="light|dark"` 或 `colorScheme={'light'|'dark'}` —— 字面量永远是错的
 *  - missing:整标签顶层没有该属性(形参默认值 'light' 静默生效)
 *  - spread-unknown:只有 `{...x}` 转发,判不出来 ⇒ 单列报数,不判红也不静默放过
 * 属性名带前缀(`data-colorScheme`)或嵌在表达式里的,一律不算本属性。
 */
const THEME_PROP_DECL = new RegExp(`(^|[^\\w$.\\-])${THEME_PROP}\\s*\\??=`, '')

export function inspectThemeAttr(attrs) {
  const masked = maskNonTopLevel(attrs)
  const m = THEME_PROP_DECL.exec(masked)
  if (!m) {
    // 转发形态在掩码里会被抹平(它在 {} 内),故对**原文**判
    if (/\{\s*\.\.\./.test(attrs)) {
      return { kind: 'spread-unknown', detail: '整标签走 {...} 转发,判不出 colorScheme' }
    }
    return { kind: 'missing', detail: `渲染 ${THEME_PROP} 驱动组件而未传该 prop` }
  }
  const eqIdx = m.index + m[0].length - 1
  let p = eqIdx + 1
  while (p < attrs.length && /\s/.test(attrs[p])) p++
  const q = attrs[p]
  if (q === '"' || q === "'") {
    const end = skipStringChars(attrs, p)
    if (end === -1) return { kind: 'ok', detail: null }
    const value = attrs.slice(p + 1, end)
    if (LITERAL_ARCHIVES.has(value)) return { kind: 'literal', detail: `${THEME_PROP}="${value}"` }
    return { kind: 'ok', detail: null }
  }
  if (q === '{') {
    const close = matchDelimited(attrs, p)
    const inner = (close === -1 ? attrs.slice(p + 1) : attrs.slice(p + 1, close)).trim()
    const lit = /^(?:'|"|`)(light|dark)(?:'|"|`)$/.exec(inner)
    if (lit) return { kind: 'literal', detail: `${THEME_PROP}={${inner}}` }
    return { kind: 'ok', detail: null }
  }
  return { kind: 'ok', detail: null }
}

function lineCol(src, index) {
  const before = src.slice(0, index)
  const line = before.split('\n').length
  const col = index - (before.lastIndexOf('\n') + 1) + 1
  return { line, col }
}

// ------------------------------------------------------ 标识符 → 模块解析

const IMPORT_RE = /import\s+(type\s+)?([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g

/**
 * 解析一个文件里的 import,得 localName → { from: 说明符, imported: 原名 }。
 * 必须带 **alias**:`import { PlazaScreen as SharedPlazaScreen } from '@ihui/rn-app'`
 * 在 JSX 里出现的是 `SharedPlazaScreen`,不认 alias 就等于对本门最常见的跨端用法失明。
 * `import type {...}` 整条丢弃(类型不是组件)。
 */
export function parseImports(src) {
  const clean = stripComments(src)
  const map = new Map()
  for (const m of clean.matchAll(IMPORT_RE)) {
    if (m[1]) continue
    const spec = m[3]
    const clause = m[2]
    const braces = /\{([\s\S]*)\}/.exec(clause)
    if (braces) {
      for (const raw of braces[1].split(',')) {
        const entry = raw.trim()
        if (!entry || entry.startsWith('type ')) continue
        const asM = /^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/.exec(entry)
        if (asM) map.set(asM[2], { from: spec, imported: asM[1] })
        else if (/^[A-Za-z_$][\w$]*$/.test(entry)) map.set(entry, { from: spec, imported: entry })
      }
    }
    const nsM = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause)
    if (nsM) map.set(nsM[1], { from: spec, imported: '*', ns: true })
    const defM = /^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause.replace(/\{[\s\S]*\}/, ' , '))
    if (defM) map.set(defM[1], { from: spec, imported: 'default' })
  }
  return map
}

/**
 * 说明符是否指向共享包 packages/app。
 *  - `@ihui/rn-app` / `@ihui/rn-app/...` ⇒ 是(跨端引用)
 *  - 相对路径解析后落在 packages/app/ 下 ⇒ 是(包内兄弟引用)
 *  - 其余(react-native、端内 `../components/NavBar` 等)⇒ 否
 * ⚠️ 这一条是**假阳性的唯一来源**:apps/mobile-rn/src/components 下有与共享包
 * 同名的 NavBar / TabBar / Carousel / UserInfoCard … 端内自绘版,它们根本不吃
 * colorScheme。不限定说明符就会把这些端内组件全判成"漏传"(实测首跑 49 处全此类)。
 */
export function isSharedSpecifier(spec, fromRel) {
  if (spec === SHARED_PKG || spec.startsWith(`${SHARED_PKG}/`)) return true
  if (!spec.startsWith('.')) return false
  const abs = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec))
  return abs === COMPONENT_DIR || abs.startsWith(`${COMPONENT_DIR}/`)
}

/** 本文件里自行声明的同名组件(function/const/class/enum) ⇒ 遮蔽 import */
const LOCAL_DECL_RE =
  /(?:^|\n)\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Z][A-Za-z0-9_]*)/g

export function findLocalComponentDecls(src) {
  const set = new Set()
  for (const m of stripComments(src).matchAll(LOCAL_DECL_RE)) set.add(m[1])
  return set
}

/**
 * 解析渲染点用到的标识符 → 共享组件**原名**。
 * 返回 { shared: string | null, why: 'shared' | 'local-shadow' | 'non-shared' | 'unresolved' }
 *  - 本文件同名自绘 ⇒ 遮蔽 import(除非本文件正是该共享主题组件的定义处);
 *  - `@ihui/rn-app` / 包内相对路径 ⇒ 共享;其余一律不判。
 */
export function resolveRenderedName(site, imports, localDecls, fromRel, sharedNames) {
  const segs = site.name.split('.')
  if (segs.length > 1) {
    const [ns, member] = segs
    const binding = imports.get(ns)
    if (binding?.ns && isSharedSpecifier(binding.from, fromRel) && sharedNames.has(member)) {
      return { shared: member, why: 'shared' }
    }
    return { shared: null, why: binding ? 'non-shared' : 'unresolved' }
  }
  const name = segs[0]
  if (localDecls.has(name)) {
    // 本文件就是该主题驱动组件的定义处 ⇒ 它渲染自己(递归/组合)仍要判
    if (sharedNames.get(name)?.has(fromRel)) return { shared: name, why: 'shared' }
    return { shared: null, why: 'local-shadow' }
  }
  const binding = imports.get(name)
  if (!binding) {
    // 无 import 却在用:多半是端内小写形态/生成代码,拿不准就不判(计入 unresolved 报数)
    return { shared: null, why: 'unresolved' }
  }
  if (!isSharedSpecifier(binding.from, fromRel)) return { shared: null, why: 'non-shared' }
  if (binding.imported === 'default') {
    // 默认导入:alias 指向包内模块,原名取该模块的导出组件名
    return { shared: defaultExportNameOf(binding.from, sharedNames) ?? name, why: 'shared' }
  }
  return { shared: binding.imported, why: 'shared' }
}

/**
 * `import X from '@ihui/rn-app/...'` 的默认导出名:说明符末段是目录/文件时取驼峰名,
 * 与主题驱动组件表对上就用表里的名字。判不出来时退回调用方给的名字,不影响"是否要传 prop"。
 */
function defaultExportNameOf(spec, sharedNames) {
  const tail = spec.split('/').pop() ?? ''
  const camel = tail.replace(/(^\w|[-_]\w)/g, (s) => s.replace(/[-_]/, '').toUpperCase())
  return sharedNames.has(camel) ? camel : null
}

/**
 * git 派生统一口径(§5b + 守门 80):绝对路径由 ROOT 起、`-c safe.directory=*`、
 * windowsHide、数字 timeout。缺 timeout 的 git 只读调用是本仓守门 80 专门拦的那一类无界挂起。
 */
function gitRaw(args, opts = {}) {
  return execFileSync('git', ['-c', 'safe.directory=*', '-C', opts.root ?? ROOT, ...args], {
    cwd: opts.root ?? ROOT,
    encoding: 'utf8',
    windowsHide: true,
    timeout: opts.timeout ?? 60000,
    maxBuffer: opts.maxBuffer ?? 1 << 26,
  })
}

/** 抛错即"判定面取不到",由调用方折成 exit 2「无法判定」—— 绝不静默成空清单(空清单=全绿) */
function gitOrDie(args, what, opts) {
  try {
    return gitRaw(args, opts)
  } catch (e) {
    throw new Undetermined(`${what} 失败: ${gitErrText(e)}`)
  }
}

/** 列出「某个面」里的 .tsx。三个面各问各的 git,不再 glob 读盘。 */
function listTsxOnFace(face, dirs, root) {
  const out =
    face === 'head'
      ? gitOrDie(['ls-tree', '-r', '--name-only', 'HEAD', '--', ...dirs], 'git ls-tree HEAD', {
          root,
        })
      : face === 'staged'
        ? gitOrDie(['ls-files', '--', ...dirs], 'git ls-files(索引)', { root })
        : gitOrDie(['ls-files', ...dirs], 'git ls-files(工作树)', { root })
  const list = out
    .split('\n')
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => f.endsWith('.tsx') && f.length > 0)
  return [...new Set(list)]
}

function stagedTsxIn(dirs, root) {
  const out = gitOrDie(
    ['diff', '--cached', '--name-only', '--diff-filter=ACMRT'],
    'git diff --cached',
    {
      root,
    },
  )
    .split('\n')
    .map((f) => f.replace(/\\/g, '/'))
    .filter((f) => f.endsWith('.tsx') && dirs.some((d) => f.startsWith(`${d}/`)))
  return [...new Set(out)]
}

/**
 * 单一取内容出口:枚举与内容必须来自**同一个面**、同一轮。
 * 混面(盘上枚举 + git 取内容,或反过来)会产出自洽但基准错位的结论 —— 与守门 101 同一条理由。
 *
 * ⚠️ git 面**必须**先 `prefetch(rels)` 再 `read(rel)`:一次 `cat-file --batch` 读完一批。
 * 逐文件派生 git 在真仓是 ~1500 次进程创建(§5b 的 fork 风暴同型),故 read 遇到
 * 未预取的路径一律判"无法判定",不偷偷补一次派生把退化掩盖成正常。
 */
export function makeFaceReader(face, root = ROOT) {
  if (!FACES.includes(face)) {
    throw new Undetermined(`未知判定面 "${face}"(允许: ${FACES.join(' / ')})`)
  }
  const label = FACE_LABEL[face]
  if (face === 'worktree') {
    return {
      face,
      label,
      list: (dirs) => listTsxOnFace('worktree', dirs, root),
      prefetch() {},
      read(rel) {
        const abs = path.join(root, rel)
        if (!existsSync(abs)) return null
        // 不套"读失败即当作不存在":编码/权限错误必须原样点名,否则一个环境问题伪装成业务结论
        let text
        try {
          text = readFileSync(abs, 'utf8')
        } catch (e) {
          throw new Undetermined(`${label} 取不到 ${rel}: ${e.message}`)
        }
        return text.includes('\u0000') ? null : text
      },
    }
  }

  const prefix = face === 'staged' ? ':' : 'HEAD:'
  // 面的相对基准必须是仓库根:ROOT 若是仓库子目录,ls-tree 的路径与 join(root,rel) 就错位,
  // 那正好产出门最不该产出的东西 —— 看起来自洽的绿。故显式判死,不静默容忍。
  // 但比较前先各自穿过 junction:scratch-dir / DevEnv 改道(§26)会让同一目录有两个写法,
  // 只比字面路径会把正常仓判成"基准错位"。
  let top
  try {
    top = gitRaw(['rev-parse', '--show-toplevel'], { root }).trim()
  } catch (e) {
    throw new Undetermined(`${label} 无法解析仓库根: ${gitErrText(e)}`)
  }
  if (top && !sameDir(top, root)) {
    throw new Undetermined(`${label} 的 ROOT(${root})不是仓库根(${top}),两基准会错位`)
  }
  const cache = new Map()
  return {
    face,
    label,
    list: (dirs) => listTsxOnFace(face, dirs, root),
    prefetch(rels) {
      const todo = [...new Set(rels)].filter((r) => !cache.has(r))
      if (todo.length === 0) return
      let out
      try {
        out = execFileSync('git', ['-c', 'safe.directory=*', '-C', root, 'cat-file', '--batch'], {
          cwd: root,
          input: Buffer.from(todo.map((r) => `${prefix}${r}`).join('\n') + '\n', 'utf8'),
          windowsHide: true,
          maxBuffer: 1 << 28,
          timeout: 120000,
          // stdio[0] 必须是 pipe —— input 靠它喂 rev 清单;设成 'ignore' 会让 git 读到空输入,
          // 于是每个 rev 都"取不到"(守门 101 真仓自验时被这一条咬出假 exit 2)
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      } catch (e) {
        throw new Undetermined(`${label} 批量取材失败(${todo.length} 个路径): ${gitErrText(e)}`)
      }
      let pos = 0
      for (const rel of todo) {
        const nl = out.indexOf(0x0a, pos)
        if (nl < 0) {
          cache.set(rel, null)
          continue
        }
        const header = out.subarray(pos, nl).toString('utf8')
        pos = nl + 1
        const m = /^([0-9a-f]{40}) blob (\d+)$/.exec(header)
        if (!m) {
          cache.set(rel, null) // "<rev>:<path> missing" / unmerged / 非 blob
          continue
        }
        const size = Number(m[2])
        cache.set(rel, out.subarray(pos, pos + size).toString('utf8'))
        pos += size + 1
      }
    },
    read(rel) {
      if (!cache.has(rel)) {
        throw new Undetermined(`${label} 的 ${rel} 未经 prefetch 就被读取(判据退化,不补隐式派生)`)
      }
      return cache.get(rel)
    },
  }
}

/**
 * 组件清单:全量扫 COMPONENT_DIR(清单必须来自源码,不得手工维护)。
 * 返回 name → 定义处文件集:同名组件在端内几乎必然另有自绘版
 * (apps/mobile-rn/src/components 下就有 NavBar / TabBar / Carousel / UserInfoCard …),
 * 不记定义处的话无法区分"渲染的是共享主题组件"还是"端内同名组件"。
 */
export function collectThemeDrivenComponents(reader) {
  const byName = new Map()
  const files = reader.list([COMPONENT_DIR])
  reader.prefetch(files)
  for (const rel of files) {
    const src = reader.read(rel)
    if (src === null) continue
    for (const name of findThemeDrivenComponents(src)) {
      if (!byName.has(name)) byName.set(name, new Set())
      byName.get(name).add(rel)
    }
  }
  return byName
}

/**
 * 单文件判定(纯函数,便于用内存夹具做端到端自测)。
 * 返回 { violations, unknown, skipped }
 *
 * ⚠️ 不得用「JSX 名是否在组件表里」做预筛:`import { UserInfoCard as SharedUserCard }`
 * 之后 JSX 里出现的是 alias,按 alias 预筛会把整类跨端引用**静默跳过**
 * (共享组件表按原名登记)。故先解析、再按原名查表。
 * 解析完仍与主题组件无关的普通标签(View/Text/三方组件)一律不计,
 * 否则 skipped 会被几千个 <View/> 灌满而失去意义。
 */
export function judgeFile(rel, src, sharedNames) {
  const violations = []
  const unknown = []
  const skipped = {}
  const clean = stripComments(src)
  const imports = parseImports(src)
  const localDecls = findLocalComponentDecls(src)
  const bump = (why) => {
    skipped[why] = (skipped[why] ?? 0) + 1
  }
  for (const site of findJsxElementSites(src)) {
    const r = resolveRenderedName(site, imports, localDecls, rel, sharedNames)
    if (r.why === 'shared' && sharedNames.has(r.shared)) {
      const verdict = inspectThemeAttr(site.attrs)
      const { line, col } = lineCol(clean, site.index)
      const rec = {
        file: rel,
        line,
        col,
        component: site.name,
        shared: r.shared,
        kind: verdict.kind,
        detail: verdict.detail,
      }
      if (verdict.kind === 'literal' || verdict.kind === 'missing') violations.push(rec)
      else if (verdict.kind === 'spread-unknown') unknown.push(rec)
      continue
    }
    // 只报"名字本来撞上共享主题组件却落空"的三类:端内同名自绘 / 本文件自绘遮蔽 / 无 import 解析不到
    const collides = site.name.split('.').some((s) => sharedNames.has(s))
    if (collides) bump(r.why)
  }
  return { violations, unknown, skipped }
}

/**
 * 在给定渲染点文件集上判定。
 * 返回 { violations, unknown, skipped, filesScanned }
 *  - skipped:命中同名但**解析不到共享包**的渲染点(端内自绘组件),按原因分类计数,
 *    在结论行如实报出 —— 不报数就等于悄悄把判定面缩小了。
 */
export function scanRenderSites(relFiles, sharedNames, reader) {
  const violations = []
  const unknown = []
  const skipped = {}
  let filesScanned = 0
  reader.prefetch(relFiles)
  for (const rel of relFiles) {
    const src = reader.read(rel)
    if (src === null) continue
    filesScanned++
    const one = judgeFile(rel, src, sharedNames)
    violations.push(...one.violations)
    unknown.push(...one.unknown)
    for (const [why, n] of Object.entries(one.skipped)) skipped[why] = (skipped[why] ?? 0) + n
  }
  return { violations, unknown, skipped, filesScanned }
}

/** 基线形态:{ counts: { [file]: { missing: n, literal: n } } },按"文件 × 类"只减不增 */
function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return { counts: {} }
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  return { counts: raw.counts ?? {} }
}

function tallyByFile(violations) {
  const counts = {}
  for (const v of violations) {
    if (!counts[v.file]) counts[v.file] = { missing: 0, literal: 0 }
    counts[v.file][v.kind === 'literal' ? 'literal' : 'missing'] += 1
  }
  return counts
}

/**
 * 棘轮:超额的(文件,类)整类报出 —— 不报"只红第 N+1 条",
 * 否则同一文件里红哪一条取决于扫描顺序,不稳定也不可复现。
 */
export function applyRatchet(violations, baseline) {
  const counts = tallyByFile(violations)
  const over = []
  let grandfathered = 0
  for (const [file, per] of Object.entries(counts)) {
    const allow = baseline.counts[file] ?? {}
    for (const kind of ['missing', 'literal']) {
      const n = per[kind]
      const a = allow[kind] ?? 0
      if (n > a) over.push({ file, kind, count: n, allowed: a })
      else grandfathered += n
    }
  }
  const keys = new Set(over.map((o) => `${o.file}\u0000${o.kind}`))
  return {
    over,
    listed: violations.filter((v) => keys.has(`${v.file}\u0000${v.kind}`)),
    grandfathered,
  }
}

function run(options) {
  if (process.env[SKIP_ENV] === '1') {
    console.log(`⏭ ${SKIP_ENV}=1,跳过主题透线守门`)
    return 0
  }
  // 基线是全量口径:与 --staged 同用会拿暂存子集覆盖整份基线(与守门 83 同一条护栏)
  if (options.updateBaseline && options.staged) {
    console.error('❌ --update-baseline 不得与 --staged 同用(基线须按全量口径收紧)')
    return 1
  }
  // 两个面旗同给 = 判据自相矛盾(到底按提交内容还是按盘?),判死而不是任选一边
  if (options.staged && options.worktree) {
    console.error('❌ --staged 与 --worktree 不得同用(两个判定面互斥,取哪一面都会让另一面成为假绿)')
    return 2
  }
  const face = options.staged ? 'staged' : options.worktree ? 'worktree' : 'head'
  try {
    return runOnFace(options, face, options.root ?? ROOT)
  } catch (e) {
    if (e instanceof Undetermined) {
      // 取材失败不是"没有违规"。显式无法判定 + 非零退出,绝不冒绿(守门 94/101 同口径)
      console.error(`⚠️ 无法判定(不是通过):${e.message}`)
      return 2
    }
    throw e
  }
}

function runOnFace(options, face, root) {
  // 基线台账只有一份、落在本脚本同目录;拿别的根去写它 = 用夹具覆盖真账(与守门 70 的"禁为过门调账"同条)
  if (options.updateBaseline && !sameDir(root, ROOT)) {
    throw new Undetermined(`--update-baseline 不得对非默认根(${root})执行,基线只会写回本仓那一份`)
  }
  const reader = makeFaceReader(face, root)
  // --json 时 stdout 必须是纯 JSON(CI 直接 parse);判定面已在 JSON 体里以 face/faceLabel 两个字段报出
  if (!options.json) console.log(`📐 判定面:${reader.label}`)
  const components = collectThemeDrivenComponents(reader)
  if (components.size === 0) {
    // 反假绿:组件集为空 = 推导失效(目录改名 / 语法换型),绝不能当成"无违规"
    console.error(`❌ 未从 ${COMPONENT_DIR} 推导到任何主题驱动组件 ⇒ 判据失效,请按源码形态复查`)
    return 1
  }
  const renderFiles = options.staged ? stagedTsxIn(RENDER_DIRS, root) : reader.list(RENDER_DIRS)
  if (options.staged && renderFiles.length === 0) {
    console.log(`⏭ 暂存区无 ${RENDER_DIRS.join(' / ')} 的 .tsx,跳过`)
    return 0
  }
  // 全量面枚举到 0 个渲染点文件 = 取材失效(目录改名 / ls-tree 参数变了),同上一条反假绿
  if (!options.staged && renderFiles.length === 0) {
    throw new Undetermined(
      `${reader.label} 上未列出任何 ${RENDER_DIRS.join(' / ')} 的 .tsx ⇒ 扫描面为空`,
    )
  }
  const { violations, unknown, skipped, filesScanned } = scanRenderSites(
    renderFiles,
    components,
    reader,
  )

  if (options.updateBaseline) {
    const counts = tallyByFile(violations)
    writeFileSync(BASELINE_PATH, `${JSON.stringify({ counts }, null, 2)}\n`)
    console.log(
      `✅ 基线已更新:${Object.keys(counts).length} 文件 / ${violations.length} 处存量透线缺口已冻结(只减不增)`,
    )
    return 0
  }

  const baseline = readBaseline()
  const ratcheted = options.strict
    ? { over: [], listed: violations, grandfathered: 0 }
    : applyRatchet(violations, baseline)
  const listed = ratcheted.listed
  const missing = listed.filter((v) => v.kind === 'missing')
  const literal = listed.filter((v) => v.kind === 'literal')
  const skippedLine = Object.entries(skipped)
    .map(([why, n]) => `${why} ${n}`)
    .join(' / ')

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          components: components.size,
          filesScanned,
          face,
          faceLabel: reader.label,
          skipped,
          strict: Boolean(options.strict),
          debtFrozen: ratcheted.grandfathered,
          over: ratcheted.over,
          violations: listed,
          unknown,
          failed: listed.length > 0,
        },
        null,
        2,
      ),
    )
    return listed.length > 0 ? 1 : 0
  }

  if (literal.length > 0) {
    console.error(`❌ 写死字面量(colorScheme="light|dark"):${literal.length} 处`)
    for (const v of literal)
      console.error(`   ${v.file}:${v.line}:${v.col} <${v.component} ${v.detail}>`)
  }
  if (missing.length > 0) {
    console.error(`❌ 未接线(漏传 colorScheme):${missing.length} 处`)
    for (const v of missing) console.error(`   ${v.file}:${v.line}:${v.col} <${v.component}>`)
  }
  if (ratcheted.over.length > 0) {
    for (const o of ratcheted.over)
      console.error(`   ↳ ${o.file} ${o.kind}:${o.count} > 基线 ${o.allowed}`)
  }
  if (unknown.length > 0) {
    console.warn(
      `⚠️ 判不出(整标签走 {...} 转发):${unknown.length} 处 —— 本门不判红也不静默放过,请人工确认被转发对象确含 ${THEME_PROP}`,
    )
    for (const v of unknown) console.warn(`   ${v.file}:${v.line}:${v.col} <${v.component}>`)
  }

  if (listed.length > 0) {
    console.error(
      [
        '',
        `  💡 主题驱动组件(${components.size} 个,由 ${COMPONENT_DIR} 源码自动推导)必须拿到**调用方解析出的**主题:`,
        `     ① 正解 \`<X ${THEME_PROP}={resolvedTheme} />\`(值来自 useTheme/主题 store,不得是字面量);`,
        '     ② 字面量 "light"/"dark" 永远错:形参默认值会把它当合法值,',
        '        整棵子树按该档案渲染,而 app chrome 跟着真主题走 ⇒ 同一屏幕两套档案(真机实测 #1a1a1a vs #f5f5f5);',
        `     ③ 漏传同理(静默落到 'light' 默认值),故本门把"漏传"当红。`,
        `     存量已冻结于 ${path.basename(BASELINE_PATH)}(棘轮只减不增);全量口径重跑:node scripts/check-theme-prop-wiring.mjs --update-baseline`,
        '     看未冻结的全部缺口:--strict;自检:--self-test;机读:--json',
        `     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
        '',
      ].join('\n'),
    )
    return 1
  }
  console.log(
    `✅ 主题透线守门通过(${reader.label};${filesScanned} 渲染点文件 / ${components.size} 组件,0 处新增未接线、0 处新增写死字面量` +
      `${ratcheted.grandfathered > 0 ? `;存量 ${ratcheted.grandfathered} 处已冻结于基线` : ''}` +
      `${skippedLine ? `;同名但解析不到共享包而未判:${skippedLine}` : ''}` +
      `${unknown.length > 0 ? `;${unknown.length} 处 {...} 转期待人工核` : ''})`,
  )
  return 0
}

// ------------------------------------------------------------------- 自检

const FIXTURE_COMPONENTS = `
export function NavBar({
  title,
  colorScheme = 'light',
}: { title?: string; colorScheme?: 'light' | 'dark' }) {
  const tk = getTokens(colorScheme)
  return <View style={{ backgroundColor: tk.surface.bg }} />
}

export const Wrapped = memo(({ colorScheme = 'light' }: { colorScheme?: string }) => <View />)

export const NotThemeDriven = ({ title }: { title: string }) => <View />

function Private({ colorScheme = 'light' }) {
  return <View />
}

export const Shadow = ({ nested: { colorScheme } }: any) => <View />

export function UserInfoCard({
  colorScheme = 'light',
}: { colorScheme?: string }) {
  return <View />
}

export function Carousel({ colorScheme = 'light' }: { colorScheme?: string }) {
  return <View />
}
`

const FIXTURE_CALLS = `
import { NavBar, Wrapped, UserInfoCard as SharedUserCard } from '@ihui/rn-app'
import { Carousel } from '../components/Carousel'

function Screen({ resolvedTheme }: { resolvedTheme: 'light' | 'dark' }) {
  return (
    <>
      <NavBar title="a" colorScheme={resolvedTheme} />
      <NavBar title="a" colorScheme="light" />
      <NavBar title="a" colorScheme={'dark'} />
      <NavBar title="a" />
      <SharedUserCard colorScheme="light" />
      <Wrapped colorScheme={resolvedTheme} />
      <Wrapped />
      <Carousel />
      <NotThemeDriven title="x" />
      {/* 注释里的 <NavBar /> 不算 */}
      <Text>{'<NavBar no-prop-here />'}</Text>
      <Pressable onPress={() => (a > b ? 1 : 2)}>
        <NavBar colorScheme={resolvedTheme} icon={<Wrapped colorScheme={resolvedTheme} />} />
      </Pressable>
      <Forwarded {...rest} />
    </>
  )
}
`

export function selfTest() {
  const assert = (cond, msg) => {
    if (!cond) {
      console.error(`❌ self-test 失败: ${msg}`)
      process.exit(1)
    }
  }
  // --- 组件集推导 ---
  const derived = findThemeDrivenComponents(FIXTURE_COMPONENTS)
  assert(derived.includes('NavBar'), '应推导出 export function 解构 colorScheme 的组件')
  assert(derived.includes('Wrapped'), '应推导出 memo(({colorScheme}) => …) 形态')
  assert(!derived.includes('NotThemeDriven'), '形参无 colorScheme 的组件不得入集')
  assert(!derived.includes('Private'), '未导出组件不得入集(不可能被外部渲染)')
  assert(
    !derived.includes('Shadow'),
    'colorScheme 只在嵌套解构里(顶层无该绑定)不得入集 —— 调用方传顶层 prop 也救不了它',
  )
  assert(
    topLevelBindingNames('{ a, b = 1, c: { colorScheme } }').join() === 'a,b,c',
    '顶层绑定名提取',
  )
  // --- 渲染点扫描:括号深度 ---
  const sites = findJsxElementSites(FIXTURE_CALLS)
  assert(
    sites.some(
      (s) => s.name === 'Pressable' && s.attrs.includes('onPress={() => (a > b ? 1 : 2)}'),
    ),
    '属性表达式内的 > 不得提前收口(括号深度感知)',
  )
  assert(
    !sites.some((s) => s.attrs.includes('no-prop-here')),
    '串内的 <NavBar … /> 示例不是渲染点(注释/字符串必须被清洗)',
  )
  const navBars = sites.filter((s) => s.name === 'NavBar')
  assert(
    navBars.length === 5,
    `NavBar 应有 5 个渲染点(4 个平铺 + 1 个嵌套在属性表达式里),实得 ${navBars.length}`,
  )
  // 嵌套在属性表达式里的 <NavBar colorScheme={resolvedTheme}> 也必须被扫到
  assert(
    navBars.some((s) => s.attrs.includes('icon={<Wrapped')),
    '属性表达式内嵌套的元素应同样进入扫描面(不得跳过)',
  )
  // --- 判定 ---
  const verdictOf = (attrs) => inspectThemeAttr(attrs).kind
  assert(verdictOf(' title="a" colorScheme={resolvedTheme} ') === 'ok', '透传真主题 = ok')
  assert(verdictOf(' colorScheme="light" ') === 'literal', '写死字符串字面量 = 红')
  assert(verdictOf("colorScheme={'dark'}") === 'literal', '花括号里的字面量同样 = 红')
  assert(
    verdictOf(' colorScheme={theme === "dark" ? "dark" : "light"} ') === 'ok',
    '三元表达式不当字面量',
  )
  assert(verdictOf(' title="a" ') === 'missing', '漏传 = 红')
  assert(
    verdictOf(' {...rest} ') === 'spread-unknown',
    '仅 {...} 转发 = 单列不确定,不判红也不静默放过',
  )
  assert(
    verdictOf(' colorScheme={c} onPress={() => a > b} ') === 'ok',
    '属性表达式不得干扰 colorScheme 识别',
  )
  assert(verdictOf(' data-colorScheme="light" ') !== 'literal', '同尾缀的别的属性不得误判')
  // --- 说明符解析(假阳性的唯一来源:端内与共享包**同名**自绘组件)---
  const imp = parseImports(
    `import { NavBar, Wrapped as W, type NavBarAction } from '@ihui/rn-app'\nimport Carousel from '../components/Carousel'\nimport * as App from '@ihui/rn-app'\nimport type { Foo } from 'x'`,
  )
  assert(imp.get('NavBar')?.imported === 'NavBar', '具名导入应登记')
  assert(imp.get('W')?.imported === 'Wrapped', 'alias 必须登记到**原名**(JSX 里用的是 alias)')
  assert(!imp.has('NavBarAction'), '`type` 前缀的具名导入是类型,不得当值绑定')
  assert(!imp.has('Foo'), 'import type { … } 整条是类型,不得当值绑定')
  assert(imp.get('Carousel')?.imported === 'default', '默认导入应登记')
  assert(imp.get('App')?.ns === true, '命名空间导入应登记 ns')
  assert(isSharedSpecifier('@ihui/rn-app', 'apps/mobile-rn/src/screens/A.tsx'), '包名说明符 = 共享')
  assert(
    isSharedSpecifier('@ihui/rn-app/foo', 'apps/mobile-rn/src/screens/A.tsx'),
    '包名子路径 = 共享',
  )
  assert(
    !isSharedSpecifier('../components/Carousel', 'apps/mobile-rn/src/screens/A.tsx'),
    '端内相对路径 ≠ 共享',
  )
  assert(
    isSharedSpecifier('../../components/NavBar', 'packages/app/src/features/plaza/X.tsx'),
    '包内兄弟相对路径 = 共享',
  )
  assert(
    !isSharedSpecifier('react-native', 'packages/app/src/features/plaza/X.tsx'),
    '三方包 ≠ 共享',
  )
  const sharedNames = new Map()
  for (const n of derived) sharedNames.set(n, new Set([`packages/app/src/components/${n}.tsx`]))
  const resolveWhy = (name, spec) =>
    resolveRenderedName(
      { name },
      parseImports(`import { ${name} } from '${spec}'`),
      new Set(),
      'apps/mobile-rn/src/screens/A.tsx',
      sharedNames,
    ).why
  assert(resolveWhy('NavBar', '@ihui/rn-app') === 'shared', '共享包导入的主题组件 ⇒ 判')
  assert(
    resolveWhy('NavBar', '../components/NavBar') === 'non-shared',
    '端内同名自绘 ⇒ 不判(首跑 49 处全此类)',
  )
  assert(
    resolveRenderedName(
      { name: 'NavBar' },
      new Map(),
      new Set(['NavBar']),
      'packages/app/src/components/NavBar.tsx',
      sharedNames,
    ).why === 'shared',
    '定义处文件渲染自己 ⇒ 仍判',
  )
  assert(
    resolveRenderedName(
      { name: 'NavBar' },
      new Map(),
      new Set(['NavBar']),
      'apps/mobile-rn/src/screens/A.tsx',
      sharedNames,
    ).why === 'local-shadow',
    '本文件自绘同名组件遮蔽 import ⇒ 不判',
  )
  assert(
    resolveRenderedName(
      { name: 'X.NavBar' },
      parseImports(`import * as X from '@ihui/rn-app'`),
      new Set(),
      'apps/mobile-rn/src/screens/A.tsx',
      sharedNames,
    ).why === 'shared',
    '命名空间成员 <X.NavBar> 也应判',
  )
  // --- 端到端(judgeFile:推导 × 解析 × 扫描 × 判定)---
  const e2e = judgeFile('apps/mobile-rn/src/screens/fixture.tsx', FIXTURE_CALLS, sharedNames)
  const kinds = [...e2e.violations.map((v) => v.kind)]
  assert(
    e2e.violations.filter((v) => v.kind === 'literal').length === 3,
    `端到端应有 3 处写死字面量(NavBar×2 + alias 指向的 UserInfoCard),实得 ${e2e.violations.filter((v) => v.kind === 'literal').length}`,
  )
  assert(
    e2e.violations.filter((v) => v.kind === 'missing').length === 2,
    `端到端应有 2 处漏传,实得 ${e2e.violations.filter((v) => v.kind === 'missing').length}`,
  )
  assert(
    e2e.skipped['non-shared'] === 1,
    `端内同名 Carousel 必须被解析层挡掉并如实计数,实得 ${JSON.stringify(e2e.skipped)}`,
  )
  assert(kinds.length === 5, `端到端应只判 5 处违规(正确接线不入 violations),实得 ${kinds.length}`)
  // --- 反假绿护栏:空组件集必须被 run() 识别为判据失效 ---
  assert(
    collectThemeDrivenComponents(makeFaceReader('head')).size > 50,
    '真仓应推导出大量主题驱动组件(否则推导失效)',
  )
  faceSelfTest(assert)
  console.log('✅ check-theme-prop-wiring self-test 全部通过')
  return 0
}

/**
 * 判定面取证(在临时 git 仓里做,绝不碰真仓索引 —— §12 多会话纪律)。
 *
 * 这一组用例是**本票存在的全部理由**,钉的是"改前必红、改后必绿"的两条相反方向:
 *  F1 索引里带着违规、盘上已被并行会话改好 ⇒ **staged 面必须判红**。
 *     旧口径读磁盘,这一型是**假绿**:违规照样进 HEAD,而门一路绿灯。
 *  F2 索引合规、盘上别人正在半编辑 ⇒ **staged 面必须判绿**。
 *     旧口径读磁盘,这一型是**假红**:与我这次提交无关的他人未提交内容把我钉住,
 *     唯一结局是 --no-verify,连带废掉全部守门。
 *  F3 head 面与 staged 面在同一轮里给出**不同**结论 ⇒ 证明两面各自独立取材,
 *     而不是其中一面偷偷回落到磁盘(那会让 F1/F2 一起失效)。
 *  F4 未 prefetch 就 read / 未知面 ⇒ 抛 Undetermined,不静默 null(静默 null = 少扫一个文件 = 偏绿)。
 */
function faceSelfTest(ok) {
  const dir = mkScratch('theme-face')
  const write = (rel, text) => {
    const abs = path.join(dir, rel)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, text)
  }
  const COMPONENT = 'packages/app/src/NavBar.tsx'
  const SITE = 'apps/mobile-rn/src/screens/Home.tsx'
  const git = (...args) =>
    execFileSync(
      'git',
      ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', ...args],
      {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 60000,
      },
    )
  const siteSrc = (variant) => {
    const attrs = {
      goodHead: ' t={x} colorScheme={theme}',
      goodIndex: ' t={x} label="b" colorScheme={theme}',
      bad: ' t={x}',
    }[variant]
    return `import { NavBar } from '@ihui/rn-app'\nexport const Home = ({ theme }) => (\n  <NavBar${attrs} />\n)\n`
  }

  try {
    git('init', '-q', '.')
    write(COMPONENT, "export function NavBar({ colorScheme = 'light' }) {\n  return <View />\n}\n")
    write(SITE, siteSrc('goodHead'))
    git('add', '-A')
    git('commit', '-q', '-m', 'v1 compliant')

    const verdict = (face) => {
      const reader = makeFaceReader(face, dir)
      const comps = collectThemeDrivenComponents(reader)
      const files =
        face === 'staged'
          ? stagedTsxIn(['apps/mobile-rn/src'], dir)
          : reader.list(['apps/mobile-rn/src'])
      const { violations } = scanRenderSites(files, comps, reader)
      return { n: violations.length, comps: comps.size, files: files.length }
    }

    // ---- F1:索引带着违规、盘上已被并行会话改好(旧口径 = 假绿) ----
    write(SITE, siteSrc('bad'))
    git('add', '-A') // 索引 = 违规
    write(SITE, siteSrc('goodHead')) // 磁盘回到合规,索引不动

    const staged = verdict('staged')
    ok(staged.comps > 0, 'F0 组件集必须从同一面推导出来(为 0 = 索引面枚举失效,F1/F2 会一起假绿)')
    ok(staged.files > 0, 'F1 暂存集不得为空 —— 空集会让"判绿"变成空转,本条断言也就恒真')
    ok(
      staged.n === 1,
      `F1 索引里摘掉 colorScheme ⇒ staged 面必须判红,实得 ${staged.n}(旧口径读盘 = 0 = 假绿,违规照样进 HEAD)`,
    )
    const wt = verdict('worktree')
    ok(wt.n === 0, `对照:同一现场磁盘是合规的 ⇒ worktree 面判 0(正因如此,旧口径才会漏掉 F1)`)
    const head = verdict('head')
    ok(head.n === 0, `F3 HEAD 是 v1 合规 ⇒ head 面判 0;它与 staged 面结论不同,证明两面各自独立取材`)
    ok(staged.n !== wt.n, 'F3 若两面同值,说明其中一面偷偷回落到磁盘 —— 本票的改动等于没生效')

    // ---- F2:索引合规、盘上他人正在半编辑(旧口径 = 假红,逼 --no-verify) ----
    write(SITE, siteSrc('goodIndex'))
    git('add', '-A') // 索引 = 合规(且与 HEAD 不同 ⇒ 暂存集非空,不让"绿"来自空扫)
    write(SITE, siteSrc('bad')) // 磁盘留着别人的半编辑态
    const f2 = verdict('staged')
    ok(f2.files > 0, 'F2 暂存集不得为空(同上,防空转)')
    ok(
      f2.n === 0,
      `F2 索引合规而盘上有他人未提交违规 ⇒ staged 面必须判绿,实得 ${f2.n}(旧口径读盘 = 假红)`,
    )
    ok(
      verdict('worktree').n === 1,
      'F2 对照:同一现场磁盘确实带着违规 —— 旧口径就是会把它算到本次提交头上',
    )

    // ---- F4:退化不得静默 ----
    const r4 = makeFaceReader('staged', dir)
    let threw = false
    try {
      r4.read(SITE)
    } catch (e) {
      threw = e instanceof Undetermined
    }
    ok(threw, 'F4 未 prefetch 就 read 必须抛 Undetermined(静默 null = 少扫一个文件 = 偏绿)')
    let threwFace = false
    try {
      makeFaceReader('nonsense', dir)
    } catch (e) {
      threwFace = e instanceof Undetermined
    }
    ok(threwFace, 'F4 未知判定面必须抛 Undetermined,不得默认回落到磁盘')
  } finally {
    rmScratch(dir)
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  const argv = process.argv.slice(2)
  // --root 是给测试用的显式注入位(§22d + 守门 70 的教训:只改 cwd 会被判据忽略,
  // 于是"扫夹具"静默变成"扫真仓")。生产调用一律不带,语义不变。
  const rootAt = argv.indexOf('--root')
  const code = argv.includes('--self-test')
    ? selfTest()
    : run({
        staged: argv.includes('--staged'),
        worktree: argv.includes('--worktree'),
        json: argv.includes('--json'),
        strict: argv.includes('--strict'),
        updateBaseline: argv.includes('--update-baseline'),
        root: rootAt >= 0 ? path.resolve(argv[rootAt + 1] ?? '') : undefined,
      })
  process.exit(code)
}

export const __test__ = {
  skipStringChars,
  skipStrOr,
  stripComments,
  matchDelimited,
  topLevelBindingNames,
  findDestructuredParams,
  findThemeDrivenComponents,
  findJsxElementSites,
  maskNonTopLevel,
  inspectThemeAttr,
  parseImports,
  isSharedSpecifier,
  findLocalComponentDecls,
  resolveRenderedName,
  collectThemeDrivenComponents,
  judgeFile,
  scanRenderSites,
  makeFaceReader,
  listTsxOnFace,
  FACES,
  Undetermined,
  COMPONENT_DIR,
  SHARED_PKG,
  RENDER_DIRS,
  LITERAL_ARCHIVES,
  FIXTURE_COMPONENTS,
  FIXTURE_CALLS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
