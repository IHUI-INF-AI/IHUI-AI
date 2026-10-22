// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 原生弹窗守门的判据层(2026-10-23 重写,单独成层以便镜像测试直接 import)。
 *
 * 旧门判反了 —— 2026-10-23 现读:它全量档报 16 处"违规",**16 处全是假阳**
 * (8 处是项目自己的 `useConfirm()` / `confirmDialog()` 合法出口,8 处是 `apps/web/public/vs/**`
 * 里 Monaco 打包产物内的 TS 声明);而真正的原生弹窗 **12 处它一处也没看见**:
 *   · 成员式 `window.confirm(...)` / `window.prompt(...)` 7 处 —— 旧正则的前导守卫 `(?<!\.)`
 *     把带点号的调用整个排除掉了(它本意是防 `obj.confirm()` 误报,结果把真弹窗也防掉了);
 *   · 箭头体 `onClick={() => confirm(...) && ...}` 5 处 —— 旧 lookbehind 排除集里含 `>`,
 *     于是 `=>` 后面那个 `confirm(` 永远不匹配。
 * 两型"防误伤"的守卫同时把真阳杀干净,而门挂着 blocking、全量档恒 exit 0,所以没人发现。
 *
 * 新判据分两形,各自成对:
 *   member  —— `window|globalThis|self|top|parent . alert|confirm|prompt (` ⇒ **无条件违规**
 *              (加了前缀就是明指全局对象,任何本地绑定都救不了它);
 *   bare    —— 裸 `alert(|confirm(|prompt (` ⇒ 只有当**本文件内没有该名字的本地绑定**时才算违规
 *              (有绑定 = 项目自己的 Dialog/Tooltip 出口,如 `const { confirm } = useConfirm()`;
 *               绑定形态覆盖 import、解构、const/let/var、function/class、形参、箭头单参)。
 * 类型声明位(`confirm(opts): Promise<boolean>` 这种签名)不算调用。
 *
 * 取材面与差值棘轮一律走 `./lib/face-scan.mjs`(全量判 HEAD blob、`--staged` 判索引 blob、
 * `--worktree` 人工档),`public/` 下的第三方打包产物按面直接排除。
 */
import { maskCommentsStringsAndRegex } from './code-mask.mjs'

const NAMES = ['alert', 'confirm', 'prompt']

/** 成员式:显式挂在窗口对象上 */
const MEMBER_RE = /\b(?:window|globalThis|self|top|parent)\s*\.\s*(alert|confirm|prompt)\s*\(/g
/** 裸调用:前面不能是 `.` / `$` / 词字符(那属于成员或对象方法) */
const BARE_RE = /(^|[^\w$.])(alert|confirm|prompt)\s*\(/g
/** 类型签名位:name(...) : Type 或 name(...): void ⇒ 不是调用 */
const TYPE_SIG_RE =
  /^\s*(?:readonly\s+)?[a-zA-Z_$][\w$]*\s*(?:\([^)]*\))?\s*:\s*[\w<>{}[\]|,&.\s'"]+$/

/**
 * 本文件里 `name` 有没有本地绑定。判的是"这个标识符在这个文件里指向谁"。
 *
 * ⚠️ 每条模式都必须**限制在一行/一条语句内**。第一版写了 `import\s*[^;]*\{[^}]*\bconfirm\b[^}]*\}`,
 * 而本仓源码基本不用分号 ⇒ `[^;]*` 一路跨过整个文件,把 JSX 里那句 `() => confirm(...)` 读成了
 * "import 里有 confirm 绑定",于是 5 处真原生弹窗又被放过了 —— 判据的"防误伤"条款一旦跨行,
 * 就会反过来变成"防真阳"。跨语句的宽松匹配一律禁用。
 * 失效方向刻意是"认不出绑定 ⇒ 判红"(可见、可解释),而不是"漏掉真弹窗"(静默)。
 */
export function hasLocalBinding(rawText, name) {
  const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (importedLocalNames(rawText).has(name)) return true
  const linePats = [
    // 解构:const { confirm, ConfirmDialogRenderer } = useConfirm()
    new RegExp(`(?:const|let|var)\\s*\\{[^}\\n]*\\b${n}\\b[^}\\n]*\\}`),
    // 直接声明:const confirm = ... / function confirm( / class confirm
    new RegExp(`(?:const|let|var)\\s+${n}\\s*[=:]`),
    new RegExp(`function\\s+${n}\\s*[(<]`),
    // 形参:makeCtx(confirm: ...) / (a, confirm) / ({ confirm })
    new RegExp(`[(,]\\s*${n}\\s*[:?,)]`),
    new RegExp(`[(,]\\s*\\{\\s*${n}\\b`),
    // 箭头单参:confirm => ...
    new RegExp(`\\b${n}\\s*=>`),
  ]
  return linePats.some((re) => re.test(rawText))
}

/** 逐条 import/export 语句取"本地可见名"(含 `a as b` 取 b、`type X` 取 X),不跨语句 */
export function importedLocalNames(rawText) {
  const set = new Set()
  for (const chunk of rawText.split(/\n(?=(?:import|export)\b)/)) {
    if (!/^(?:import|export)\b/.test(chunk)) continue
    // 语句边界 = 到该 chunk 里第一个 `from` 为止(多行 import 也能吃到);没有 from 就只取首行
    const fromAt = chunk.search(/\bfrom\b/)
    const stmt = fromAt >= 0 ? chunk.slice(0, fromAt) : chunk.split('\n')[0]
    const m = /\{([^}]*)\}/.exec(stmt)
    if (!m) continue
    for (const spec of m[1].split(',')) {
      const s = spec.trim().replace(/^type\s+/, '')
      if (!s) continue
      const parts = s.split(/\s+as\s+/)
      const local = (parts[1] || parts[0] || '').trim()
      if (local) set.add(local)
    }
  }
  return set
}

/**
 * 整份源码 → 命中清单。
 * @returns {Array<{line:number, col:number, name:string, form:'bare'|'member', snippet:string}>}
 */
export function scanNativeCalls(rawText) {
  const masked = maskCommentsStringsAndRegex(rawText)
  const rawLines = rawText.split('\n')
  const hits = new Map() // `line:col` → hit(去重:member 与 bare 同一处只记一次,取 member 定性)
  const add = (re, form, nameIdx) => {
    re.lastIndex = 0
    let m
    while ((m = re.exec(masked)) !== null) {
      const name = m[nameIdx]
      const upto = masked.slice(0, m.index + m[0].length)
      const line = upto.split('\n').length
      const lineStart = masked.lastIndexOf('\n', m.index - 1) + 1
      const col = m.index - lineStart + 2 // 让 col 指向名字而非前导字符
      const snippet = (rawLines[line - 1] || '').trim().slice(0, 140)
      if (TYPE_SIG_RE.test(snippet)) continue
      if (form === 'bare' && hasLocalBinding(rawText, name)) continue
      const key = `${line}:${col}`
      const prev = hits.get(key)
      if (prev && prev.form === 'member') continue
      hits.set(key, { line, col, name, form, snippet })
    }
  }
  add(MEMBER_RE, 'member', 1)
  add(BARE_RE, 'bare', 2)
  return [...hits.values()].sort((a, b) => a.line - b.line || a.col - b.col)
}

/** 棘轮锚点与读数共用的计数口径 */
export function countNativeCalls(rawText) {
  return scanNativeCalls(rawText).length
}

export const NAMES_SCANNED = NAMES
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
