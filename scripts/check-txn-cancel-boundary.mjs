// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门(常驻只读判据,blocking):事务边界内不得探测/响应取消 —— G-815960
//
// 状态:本门**已进提交链** —— `scripts/guardian-runner.mjs` 里有注册条目(guardian id 以 runner 现值
// 为准,落地那枚取到 195;并发会话可能挪号),`mode: 'blocking'` + `stagedTriggers=apps/ + packages/`,
// 紧急跳过 `HUSKY_SKIP_TXN_CANCEL_BOUNDARY=1`(跳过即放弃"取消必须落在事务边界外"这格不变量,
// 须在提交信息写明理由与清偿票)。定级依据是现读而非推测:`--staged` 面 0.33s、HEAD 全量档命中 0
// ⇒ 接线不新增恒红面;全量档 43s 只供人工与 CI 问责,提交链因触发面收窄在文档类提交上根本不唤起它。
//   · 镜像测试 T1 是一条**双向**锁:注册表里查得到本门而头注仍自称尚未落地 ⇒ 红(台账与实态分叉,
//     失效形态永远是安静);反过来查不到而头注自称已接线 ⇒ 也红(守门 89 的 R2 型谎言的本地锁)。
//
// 在修什么(上游把这条纪律写在注释里,我方把它变成可判的东西):
//   上游 SQLite adapter 是**同步事务**,它的注释说"事务里不 await,所以不存在检查与提交之间的
//   异步重入窗口"。我方语义等价物是 postgres.js 的 `db.transaction(async tx => …)`:它是真异步的,
//   所以"体内某处 await 了一个外部信号"这件事**不成立**。一旦事务体内探测取消(`throwIfAborted()`、
//   `signal.aborted`、`AbortSignal` 的 `.aborted` 读取、`isCancelled()`)并据此抛出/短路,
//   就出现:事务已经在跑、驱动侧连接已持有,而取消把控制流从 `await` 处夺走 ⇒
//   **回滚与"谁观察到取消"的次序不可判定**,取消落在事务边界内而不是边界外。
//   正解只有一条:**取消检查放在 `db.transaction(...)` 之前或之后**(边界外),体内不探测。
//   此前这一格在本仓**只有散文、没有尺子**,而散文的失效形态永远是安静(守门 70/76/81 同族)。
//
// 现读基线(2026-10-06 由本票现跑,数字一律可重跑;派单前必须复跑,勿照抄):
//   · 票面那条验收命令写不通(`git grep -nE "…" -A30 HEAD -- path` 把 `-A30` 当 revision ⇒
//     `fatal: unable to resolve revision: -A30`)。可用形态(实测**空**,0 命中):
//       git grep -nE -A 30 "db\.transaction\(async" HEAD -- apps packages \
//         | grep -E "throwIfAborted|signal\.aborted|isCancelled\(\)"
//   · `git grep -cE "db\.transaction\(async" HEAD -- apps packages` ⇒ 44 个文件有此类调用点。
//   · 取消探测 token 在 HEAD 面的分布(都在事务边界**外**,故落"放过"桶):
//       throwIfAborted 2 处 / 1 文件(`apps/cli/src/plugins/git-runner.ts`,一处定义一处调用,
//       两处都不在任何 transaction 体内)· signal.aborted 56 处 / 28 文件 · signal?.aborted 49 处 / 25 文件
//       · isCancelled() 1 处 / 1 文件 · abortSignal.aborted 0 处
//   ⇒ **这一维现读 0 命中,所以零容忍成立:默认档命中即 exit 1(全档),不需要基线清单。**
//     若将来现读 >0 且红在他人欠的债上,处置顺序是"先清偿再接着判",**不得**为变绿放宽判据,
//     也**不得**手工清单当基线(登记表必然腐烂,§4 对 RN_ONLY_BRAND_KEYS 的教训)。
//
// 两份视图(遮噪只引 scripts/lib/code-mask.mjs 那一份分词器,门内**不得**留第二台状态机):
//   视图A = maskCommentsAndStrings(遮注释 + 字符串 + **模板整段**,正则体**保留**)
//   视图B = maskCommentsStringsAndRegex(同上,额外清**正则字面量的体**)
//   分工:**结构切分与命中判定都走视图B** —— 本门要认的形态恰是 `\.aborted` / `throwIfAborted\(`,
//     而源码里 `/signal\.aborted/` 这类正则一旦当代码读,门会把**自己的判据**判成站点;同理 `/\{2,/`
//     里的 `{` 会把括号配平读成"配不平"(守门 156 现读 4 处未判定里 3 处正是这一型,code-mask 的
//     maskCommentsStringsAndRegex 头注把这条写成了规范)。视图A 只做一件对照:视图A 命中而视图B 没有
//     ⇒ 那一处住在正则体内 ⇒ 落"放过(正则体内)"并报名 —— 让"放过"是有理由的读数,而不是"门没看见"
//     的沉默(AGENTS:不得把"没判"写成"判过了",也不得把"没看见"写成"仓库里没有")。
//   两视图**等长**(逐字符换空格、换行保留)⇒ 行号直通原文件,不需要第三套偏移。
//
// 已知判不了 / 刻意不判的形态(逐条写死,不得读成"已确认没有"):
//   ① 模板字符串**插值**里的取消探测(`${throwIfAborted(s)}`)—— 两个投影都把模板整段遮白,
//     所以插值表达式不可见。事务体内用插值做取消检查在本仓无此形态,登记为盲区而不是判据。
//   ② 跨文件的别名/间接传入(`transaction` 被 import 后改名再传)—— 只认**同文件**的
//     `const txn = db.transaction` 绑定;解析不到 ⇒ 落未判定并点名,**不猜**。
//   ③ 回调经对象属性/三元/await 表达式传入 ⇒ 未判定。
//   ④ 名为 `transaction` 的类方法/接口声明(不是调用)⇒ 落"放过(声明形态)",不判红。
//
// 手动(全部只读;`--json` 可 JSON.parse):
//   node scripts/check-txn-cancel-boundary.mjs              # 全量档:判 HEAD blob
//   …  --staged            # 提交链档:判索引 blob(改动集无射程内文件 ⇒ 回落 HEAD 并喊出来)
//   …  --worktree           # 人工逃生舱(盘上面,不作门禁)
//   …  --strict             # 问责档:有未判定即 exit 2(拒绝出合格证)
//   …  --json | --self-test | --files <a> <b> | --root <目录>(镜像测试通道)
// 退出码:0 干净 / 1 命中(取消探测落在事务体内)或整面未判定 / 2 无法判定。

import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsAndStrings, maskCommentsStringsAndRegex } from './lib/code-mask.mjs'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,禁止 process.cwd() 定根,禁止硬编码盘符) */
const ROOT = resolve(HERE, '..')

/** 射程:apps/ 与 packages/ 下的源码面(与票面验收 probe 的 scope 逐字一致) */
export const SCAN_PREFIXES = Object.freeze(['apps/', 'packages/'])
const SCAN_EXT = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])
/** 单文件体积护栏:超过此字节数不判,如实报名(不静默跳过) */
export const MAX_BYTES = 1_500_000
const GIT_TIMEOUT = 120000

/** `transaction(` 的出现点(在视图B 上找,注释/字符串/正则体已遮) */
export const TX_TOKEN_RE = /transaction\s*\(/g
/** 声明形态的左近前缀:这些关键字紧跟 `transaction(` ⇒ 是方法/函数声明,不是调用 */
const DECL_PREFIX_WORDS = new Set(['function', 'async', 'generator', 'static', 'public', 'private', 'readonly', 'declare', 'override'])
/** 同文件别名绑定:`const txn = db.transaction`(右移一个 token 不得是 `(`) */
const ALIAS_BIND_RE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:this\.)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*\.\s*transaction\s*(?![\w$.]*(\s*\())/g
/** 命中形态:特定 → 泛化(同一 index 只计最特定的那一次) */
export const HIT_PATTERNS = Object.freeze([
  { kind: 'throwIfAborted()', re: /\bthrowIfAborted\s*\(/g },
  { kind: 'signal.aborted 读取', re: /\bsignal\s*(?:\?\.|\.)\s*aborted\b/g },
  { kind: 'abortSignal.aborted 读取', re: /\babortSignal\s*(?:\?\.|\.)\s*aborted\b/g },
  { kind: 'isCancelled() 调用', re: /\bisCancelled\s*\(\s*\)/g },
  { kind: '.aborted 读取(AbortSignal 族)', re: /\.aborted\b/g },
])
/** 箭头函数参数表里允许出现的字符(用于"裸标识符实参"判定) */
const IDENT_RE = /^[A-Za-z_$][\w$]*$/

/** 行号(1 起):idx 之前的换行数 + 1。两视图等长 ⇒ 直通原文件行号。 */
export function lineOf(view, idx) {
  let line = 1
  for (let i = 0; i < idx && i < view.length; i++) if (view[i] === '\n') line++
  return line
}

/** 视图A 的投影(仅取"正则体保留"这一档差别):用于把视图B 漏掉的 regex 内命中显式归入放过桶。 */
export function hitsIn(text, patterns = HIT_PATTERNS) {
  const kept = []
  for (const { kind, re } of patterns) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text))) {
      // 特定优先:与已保留区间重叠者丢弃(否则 `signal.aborted` 会被特定档与泛化 `.aborted` 各计一次)
      const overlaps = kept.some((k) => m.index < k.end && k.start < m.index + m[0].length)
      if (!overlaps) kept.push({ start: m.index, end: m.index + m[0].length, kind })
    }
  }
  return kept
}

/** 从 openIdx 的 `(` 起配平,返回闭合 `)` 的下标;配不平 ⇒ -1。 */
export function balanceParen(view, openIdx) {
  let depth = 0
  for (let i = openIdx; i < view.length; i++) {
    const c = view[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 从 openIdx 的 `{` 起配平,返回闭合 `}` 的下标;配不平 ⇒ -1。 */
export function balanceBrace(view, openIdx) {
  let depth = 0
  for (let i = openIdx; i < view.length; i++) {
    const c = view[i]
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 顶层实参切分:返回 [{start,end}],start/end 都是原视图下标(不含逗号本身)。 */
export function splitTopLevelArgs(view, openIdx, closeIdx) {
  const args = []
  let depth = 0
  let cur = openIdx + 1
  for (let i = openIdx + 1; i < closeIdx; i++) {
    const c = view[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) {
      args.push({ start: cur, end: i })
      cur = i + 1
    }
  }
  args.push({ start: cur, end: closeIdx })
  return args.filter((a) => view.slice(a.start, a.end).trim() !== '')
}

/**
 * `transaction(` 之前的接收者链:返回 {receiver, calleeStart}。
 * receiver 为 null ⇒ 裸 `transaction(`(同名调用或声明,交调用方判 DECL/别名)。
 */
export function receiverOf(view, calleeStart) {
  let i = calleeStart - 1
  while (i >= 0 && /\s/.test(view[i])) i--
  if (i < 0) return { receiver: null, prefix: '' }
  if (view[i] === '.') {
    const optional = i > 0 && view[i - 1] === '?'
    let j = optional ? i - 2 : i - 1
    while (j >= 0 && /[\w$]/.test(view[j])) j--
    return { receiver: view.slice(j + 1, i).trim(), prefix: view.slice(Math.max(0, j - 24), i) }
  }
  // 链式中段(`foo.bar.transaction(`)由上面分支覆盖;这里给"非 . 前导"的裸形态
  return { receiver: null, prefix: view.slice(Math.max(0, i - 24), i + 1) }
}

/** 裸形态是否其实是声明(`async transaction(tx) {`)—— 是 ⇒ 放过(声明形态) */
export function looksLikeDeclaration(prefix) {
  const words = (prefix || '').match(/[A-Za-z_$][\w$]*/g)
  if (!words || !words.length) return false
  return DECL_PREFIX_WORDS.has(words[words.length - 1])
}

/** 同文件别名绑定表:name -> {from, kind:'alias'} */
export function aliasMap(viewB) {
  const map = new Map()
  for (const m of viewB.matchAll(ALIAS_BIND_RE)) {
    map.set(m[1], { from: m[2] || '', line: lineOf(viewB, m.index) })
  }
  return map
}

/**
 * 同文件里定位标识符回调的声明体:`function N(tx) {…}` / `const N = async (tx) => {…}` /
 * `const N = async function (tx) {…}`。取到 ⇒ 返回该函数**实参区间**(交 callbackBody 再切一次);
 * 取不到 ⇒ null(调用方折成未判定,不猜)。
 */
export function locateDeclaration(viewB, name) {
  const fnRe = new RegExp(String.raw`\bfunction\s+${name}\s*(?:\([^)]*\))?[^{;]*\{`, 'g')
  const m1 = fnRe.exec(viewB)
  if (m1) {
    const open = viewB.indexOf('{', m1.index)
    const close = balanceBrace(viewB, open)
    if (close >= 0) return { start: open + 1, end: close }
  }
  const varRe = new RegExp(String.raw`(?:const|let|var)\s+${name}\s*=\s*(?:async\s+)?(?:function\s*)?\(?[^)]*\)?\s*=>\s*\{`, 'g')
  const m2 = varRe.exec(viewB)
  if (m2) {
    const open = viewB.lastIndexOf('{', m2.index + m2[0].length - 1)
    const close = balanceBrace(viewB, open)
    if (close >= 0) return { start: open + 1, end: close }
  }
  return null
}

/**
 * 从一个实参区间里取回调体。返回 {start,end,form} 或 {error} 或 null(不是回调)。
 * form: 'block' | 'expr' | 'alias' | 'decl'
 */
export function callbackBody(viewB, arg, aliases, depth = 0) {
  const raw = viewB.slice(arg.start, arg.end)
  const trimmed = raw.trim()
  if (!trimmed) return null
  // 裸标识符 ⇒ 走别名 / 同文件函数声明解析
  if (IDENT_RE.test(trimmed)) {
    const bound = aliases.get(trimmed)
    if (bound) return { form: 'alias', start: arg.start, end: arg.end, alias: trimmed, boundFrom: bound.from }
    if (depth < 1) {
      const decl = locateDeclaration(viewB, trimmed)
      // locateDeclaration 交回的就是**函数体内部区间**(已配平),直接当体用;再走一遍
      // callbackBody 会把体本身当"实参"重新识别函数形态 ⇒ 声明解析成功却报"解析不到"(假未判定)。
      if (decl) return { form: 'decl', start: decl.start, end: decl.end, viaDecl: trimmed }
    }
    return { error: `实参 "${trimmed}" 是标识符:同文件既找不到 \`const ${trimmed} = <x>.transaction\` 绑定,也定位不到它的函数声明体 ⇒ 未判定` }
  }
  const arrowAt = findTopLevelArrow(viewB, arg)
  const isFnLike = /^(?:async\s+)?(?:\(|[A-Za-z_$][\w$]*\s*=>|function\b)/.test(trimmed)
  if (!isFnLike && arrowAt < 0) return null // 对象/字面量实参,不是回调
  const braceAt = viewB.indexOf('{', arg.start)
  if (braceAt >= 0 && braceAt < arg.end) {
    // 块体:确认那个 `{` 在 `=>` 之后(或本就没有箭头),否则是参数对象解构
    if (arrowAt < 0 || braceAt > arrowAt) {
      const close = balanceBrace(viewB, braceAt)
      if (close < 0) return { error: '回调块体的 `}` 配不平 ⇒ 体终点判不出,不猜' }
      return { form: 'block', start: braceAt + 1, end: close }
    }
  }
  if (arrowAt > 0) return { form: 'expr', start: arrowAt + 2, end: arg.end }
  return { error: '实参是函数形态但既无块体也无箭头表达式体 ⇒ 体起点判不出' }
}

/** 在实参区间内找**顶层** `=>` 的位置(避开嵌套括号);找不到 ⇒ -1 */
export function findTopLevelArrow(viewB, arg) {
  let depth = 0
  for (let i = arg.start; i < arg.end - 1; i++) {
    const c = viewB[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (depth === 0 && c === '=' && viewB[i + 1] === '>') return i
  }
  return -1
}

/**
 * 纯判据核心(镜像测试主战场):对一个源文件文本判"取消探测是否落在事务体内"。
 * 返回 {bodies, hits, passedOutside, passedRegexBody, passedDeclaration, passedAliasRef, undetermined, unbalanced}
 */
export function judgeSource(code) {
  const viewB = maskCommentsStringsAndRegex(code)
  const viewA = maskCommentsAndStrings(code)
  const out = {
    bodies: [],
    hits: [],
    passedOutside: 0,
    passedRegexBody: 0,
    passedDeclaration: 0,
    undetermined: [],
    unbalanced: false,
  }
  const aliases = aliasMap(viewB)
  // 早退只在"既没有字面 transaction( 调用、也没有同文件别名绑定"时走 —— 漏了后半句,
  // 别名形态会在切体之前整段隐身(表现为"零命中",而零命中读起来与合规一模一样)。
  if (aliases.size === 0 && !/(?:[A-Za-z0-9_$.]\s*(?:\?\.)?)?\s*transaction\s*\(/.test(viewB)) return out

  const callSites = []
  const seenOpen = new Set()
  /** 收一个调用点:openIdx 是实参左括号下标;同一下标只收一次 */
  const addSite = (openIdx, receiver, calleeStart) => {
    if (seenOpen.has(openIdx)) return
    seenOpen.add(openIdx)
    const closeIdx = balanceParen(viewB, openIdx)
    if (closeIdx < 0) {
      out.unbalanced = true
      out.undetermined.push({ line: lineOf(viewB, calleeStart), why: `实参圆括号配不平(接收者 ${receiver})⇒ 未判定` })
      return
    }
    callSites.push({ calleeStart, openIdx, closeIdx, receiver })
  }
  for (const m of viewB.matchAll(TX_TOKEN_RE)) {
    const calleeStart = m.index
    const openIdx = viewB.indexOf('(', calleeStart)
    if (openIdx < 0) continue
    const { receiver, prefix } = receiverOf(viewB, calleeStart)
    if (receiver === null && looksLikeDeclaration(prefix)) {
      out.passedDeclaration++
      continue
    }
    if (receiver === null) {
      // 裸 transaction( 且不是声明:只有当它是别名调用时才有意义(别名表按 name 存,不看这里)
      out.undetermined.push({
        line: lineOf(viewB, calleeStart),
        why: '裸 `transaction(` 调用既无接收者也不在别名表里 ⇒ 无法确认它是 db.transaction ⇒ 未判定',
      })
      continue
    }
    addSite(openIdx, receiver, calleeStart)
  }
  // 同文件别名绑定后的调用形态:`const txn = db.transaction` + `txn(async tx => …)`。
  // 不接这一格,别名就把整型**从尺子上抹掉**(表现是"零命中",而零命中读起来与合规一模一样)。
  for (const [name, bound] of aliases) {
    const callRe = new RegExp(String.raw`\b${name}\s*\(`, 'g')
    let m
    while ((m = callRe.exec(viewB))) {
      const openIdx = m.index + m[0].length - 1
      addSite(openIdx, bound.from || '(同文件别名)', m.index)
    }
  }

  for (const site of callSites) {
    const args = splitTopLevelArgs(viewB, site.openIdx, site.closeIdx)
    if (!args.length) {
      out.undetermined.push({ line: lineOf(viewB, site.calleeStart), why: `db.transaction( 实参为空 ⇒ 判不出回调` })
      continue
    }
    let picked = null
    let errored = false
    for (let k = args.length - 1; k >= 0; k--) {
      const r = callbackBody(viewB, args[k], aliases)
      if (!r) continue
      if (r.error) {
        out.undetermined.push({ line: lineOf(viewB, args[k].start), why: r.error })
        errored = true
        break
      }
      picked = r
      break
    }
    if (errored) continue
    if (!picked) {
      out.undetermined.push({
        line: lineOf(viewB, site.calleeStart),
        why: '事务调用的实参里取不出回调函数(可能是对象配置实参/表达式无法解析)⇒ 未判定',
      })
      continue
    }
    if (picked.form === 'alias') {
      out.undetermined.push({
        line: lineOf(viewB, site.calleeStart),
        why: `回调经同文件别名 "${picked.alias}"(绑定自 ${picked.boundFrom}.transaction)传入,函数体在实参之外 ⇒ 本档不追声明体(已知限制②),未判定`,
      })
      continue
    }
    out.bodies.push({ start: picked.start, end: picked.end, callLine: lineOf(viewB, site.calleeStart), form: picked.form })
  }

  if (!out.bodies.length) return out
  out.bodies.sort((a, b) => a.start - b.start)

  // 命中:视图B 面上扫全文件,再按最内层体归属
  const bHits = hitsIn(viewB)
  const aHits = hitsIn(viewA)
  const bStarts = new Set(bHits.map((h) => h.start))
  for (const a of aHits) if (!bStarts.has(a.start)) out.passedRegexBody++

  for (const hit of bHits) {
    const owners = out.bodies.filter((b) => hit.start >= b.start && hit.start < b.end)
    const entry = { line: lineOf(viewB, hit.start), kind: hit.kind }
    if (!owners.length) {
      out.passedOutside++
      continue
    }
    const inner = owners[owners.length - 1]
    out.hits.push({ ...entry, bodyCallLine: inner.callLine, nested: owners.length > 1 })
    // 外层体不重复计债:命中的那一处归最内层事务,外层记一条"为什么不判"
    for (const outer of owners.slice(0, -1)) {
      outer.delegated = (outer.delegated || 0) + 1
    }
  }
  return out
}

export function inScanFace(p) {
  if (!SCAN_PREFIXES.some((pre) => p.startsWith(pre))) return false
  if (/(?:^|\/)(?:node_modules|dist|build|\.next|coverage)(?:\/|$)/.test(p)) return false
  return SCAN_EXT.has(extname(p))
}

/** 各面的文件清单(清单与内容**同面同轮**:head 走 ls-tree,staged 走索引) */
export function listFace(root, face) {
  if (face === 'head') {
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(inScanFace)
  }
  if (face === 'staged') {
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(inScanFace)
  }
  return gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(inScanFace)
}

/** 内容一律经 face-reader 的 catBatch(守门 118:引了层却自己 git show/读盘 = half-wired) */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/** 汇总判定:unreadable⇒2;strict 且有未判定⇒2;命中⇒1(全档零容忍);否则 0 */
export function decide({ perFile, unreadable, mode, strict = false }) {
  const hits = []
  const undetermined = []
  const counts = {
    files: 0,
    bytesSkipped: 0,
    bodies: 0,
    passedOutside: 0,
    passedRegexBody: 0,
    passedDeclaration: 0,
  }
  for (const [file, r] of perFile) {
    counts.files++
    counts.bodies += r.bodies.length
    counts.passedOutside += r.passedOutside
    counts.passedRegexBody += r.passedRegexBody
    counts.passedDeclaration += r.passedDeclaration
    for (const h of r.hits) hits.push({ file, line: h.line, kind: h.kind, bodyCallLine: h.bodyCallLine })
    for (const u of r.undetermined) undetermined.push(`${file}:${u.line} —— ${u.why}`)
    if (r.unbalanced) undetermined.push(`${file} —— 视图上括号配不平,该文件整体判不出`)
  }
  let exit = 0
  if (unreadable.length) exit = 2
  else if (hits.length) exit = 1
  else if (strict && undetermined.length) exit = 2
  return { exit, hits, undetermined, unreadable, counts, mode }
}

export function analyze(root, face, { files = null, strict = false } = {}) {
  let effFace = face
  let fellBack = false
  let paths = null
  if (files && files.length) {
    paths = files.slice()
  } else if (face === 'staged') {
    paths = listFace(root, 'staged')
    if (!paths.length) {
      effFace = 'head'
      fellBack = true
      paths = null
    }
  }
  if (!paths) paths = listFace(root, effFace)
  if (!paths.length) throw new Undetermined(`${effFace} 面枚举到 0 个 apps/packages 源码文件 —— 空扫不记绿`)

  const sources = readFace(root, effFace, paths)
  const perFile = new Map()
  const unreadable = []
  let bytesSkipped = 0
  for (const [file, code] of sources) {
    if (code === null) {
      unreadable.push(`${file} —— ${effFace} 面取不到该 blob`)
      continue
    }
    if (code.length > MAX_BYTES) {
      bytesSkipped++
      continue
    }
    perFile.set(file, judgeSource(code))
  }
  const res = decide({ perFile, unreadable, mode: fellBack ? 'full' : effFace, strict })
  res.counts.bytesSkipped = bytesSkipped
  return { ...res, face: effFace, fellBack }
}

/** 判据自检:纯函数 + 构造面,零副作用;每条 cond 都是**已求值布尔**(§门 150 票㉛ 那一课) */
function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const wrap = (body) => `import { db } from './db'\n\n${body}`

  const IN_BODY_THROW = 'export async function run(signal) {\n  await db.transaction(async (tx) => {\n    if (tx) signal.throwIfAborted()\n    await tx.insert(rows).values(v)\n  })\n}\n'
  const IN_BODY_READ = 'async function a(signal) {\n  return db.transaction(async (tx) => {\n    const stop = signal.aborted\n    await tx.insert(rows).values(v)\n  })\n}\n'
  const IN_BODY_OPT_READ = 'async function a(signal) {\n  return db.transaction(async (tx) => {\n    if (signal?.aborted) return\n  })\n}\n'
  const OUTSIDE_BOTH = 'async function a(signal) {\n  signal.throwIfAborted()\n  const r = await db.transaction(async (tx) => {\n    await tx.insert(rows).values(v)\n  })\n  if (signal.aborted) log.warn(1)\n  return r\n}\n'
  const COMMENT_ONLY = 'async function a(signal) {\n  return db.transaction(async (tx) => {\n    // 早先这里写 signal.throwIfAborted(),已移到边界外\n    await tx.insert(rows).values(v)\n  })\n}\n'
  const COMMENT_THEN_REAL = 'async function a(signal) {\n  return db.transaction(async (tx) => {\n    // 说明:signal.throwIfAborted() 不该出现在这里\n    signal.throwIfAborted()\n  })\n}\n'
  const STRING_ONLY = "async function a() {\n  return db.transaction(async (tx) => {\n    log.info('signal.aborted 时不要在这里检查')\n  })\n}\n"
  const NESTED = 'async function a(signal) {\n  return db.transaction(async (outer) => {\n    await outer.insert(t).values(v)\n    await db.transaction(async (inner) => {\n      if (signal.aborted) throw new Error("x")\n    })\n  })\n}\n'
  const EXPR_BODY = 'const a = db.transaction((tx) => tx.insert(rows).values(signal.aborted ? 1 : 2))\n'
  const ALIAS_FORM = 'const txn = db.transaction\nasync function a() {\n  await txn(async (t) => {\n    if (t && t.signal?.aborted) return\n  })\n}\n'
  const OPTION_ARG = 'async function a() {\n  await db.transaction(async (tx) => {\n    await tx.insert(rows).values(v)\n  }, { timeout: 5000, isolationLevel: "read committed" })\n}\n'
  const METHOD_DECL = 'class Runner {\n  async transaction(fn) {\n    return fn()\n  }\n}\n'
  const STRING_WITH_BRACKETS = 'async function a(signal) {\n  const junk = "unbalanced } and ( and {"\n  return db.transaction(async (tx) => {\n    signal.throwIfAborted()\n    await tx.insert(rows).values(v)\n  })\n}\n'
  const REGEX_BODY = 'async function a() {\n  const re = /signal\\.aborted{2,}/g\n  return db.transaction(async (tx) => {\n    await tx.insert(rows).values(v)\n  })\n}\n'
  // 票面描述的上游等价形态:同步事务注释纪律 → 异步事务体内探测取消
  const UPSTREAM_ANALOGUE = 'async function commitRound(ctx, db, signal) {\n  // 上游写法:同步事务不 await,故无重入窗口;我方是 async,探测必须在边界外\n  await db.transaction(async (tx) => {\n    await tx.insert(a).values(1)\n    if (ctx.isCancelled()) await tx.rollback\n    ctx.signal.throwIfAborted()\n  })\n'
  const UNRESOLVED_CALLBACK = 'async function a(handler) {\n  return db.transaction(handler)\n}\n'
  const DECL_PASSED = 'const handleTx = async (tx) => {\n  if (signal.aborted) return\n}\nasync function a() {\n  return db.transaction(handleTx)\n}\n'

  // ⑦b 标识符传入 + 同文件声明体定位成功 ⇒ 判红(不静默放过);定位不到仍走未判定(见 UNRESOLVED_CALLBACK)
  eq('⑦b 标识符回调解析到同文件声明体 ⇒ 判红', (() => {
    const r = judgeSource(wrap(DECL_PASSED))
    return [r.hits.length, r.undetermined.length, r.hits[0]?.line]
  })(), [1, 0, 4])

  // ① 事务体内 throwIfAborted / signal.aborted / signal?.aborted 三种书写 ⇒ 必红
  eq('①体内 throwIfAborted 判红(点名行=第 4 行)', (() => {
    const r = judgeSource(wrap(IN_BODY_THROW))
    return [r.hits.length, r.hits[0]?.line, r.hits[0]?.kind]
  })(), [1, 5, 'throwIfAborted()'])
  eq('①体内 signal.aborted 判红', (() => judgeSource(wrap(IN_BODY_READ)).hits.length)(), 1)
  eq('①体内 signal?.aborted 判红', (() => judgeSource(wrap(IN_BODY_OPT_READ)).hits.length)(), 1)

  // ② 同一形态只写进注释 ⇒ 必绿;且注释之后的真代码仍要能红(证明遮噪关掉的是误报不是判据)
  eq('②注释形态不判红', (() => judgeSource(wrap(COMMENT_ONLY)).hits.length)(), 0)
  eq('②注释之后真代码仍红', (() => judgeSource(wrap(COMMENT_THEN_REAL)).hits.length)(), 1)

  // ③ 写进字符串字面量 ⇒ 放过,不判红
  eq('③字符串内形态不判红', (() => judgeSource(wrap(STRING_ONLY)).hits.length)(), 0)

  // ④ 取消检查在 transaction 之前/之后 ⇒ 放过并计数
  eq('④边界外两处都放过', (() => {
    const r = judgeSource(wrap(OUTSIDE_BOTH))
    return [r.hits.length, r.passedOutside]
  })(), [0, 2])

  // ⑤ 嵌套事务 ⇒ 只判最内层体,外层给出"不判的理由"(delegated 计数即那条理由的读数)
  eq('⑤嵌套只判最内层(命中 1 · 体 2 · 外层 delegated=1 · nested 标真)', (() => {
    const r = judgeSource(wrap(NESTED))
    const outer = r.bodies[0]
    return [r.hits.length, r.bodies.length, outer?.delegated ?? 0, outer?.callLine, r.hits[0]?.nested]
  })(), [1, 2, 1, 4, true])

  // ⑥ 非 async 表达式体回调
  eq('⑥表达式体回调仍能取到体', (() => {
    const r = judgeSource(wrap(EXPR_BODY))
    return [r.bodies.length, r.bodies[0]?.form, r.hits.length]
  })(), [1, 'expr', 1])

  // ⑦ 别名形态:同文件 `const txn = db.transaction` + `txn(async t => …)` ⇒ **判红**。
  //   不接这一格,别名就把整型从尺子上抹掉,而"零命中"读起来与合规一模一样。跨文件别名不在射程(限制②)。
  eq('⑦同文件别名调用判红并点名行', (() => {
    const r = judgeSource(wrap(ALIAS_FORM))
    return [r.hits.length, r.bodies.length, r.undetermined.length, r.hits[0]?.line]
  })(), [1, 1, 0, 6])

  // ⑧ 空枚举判死(经 analyze 的 face 走真实临时仓由镜像测试做;这里判 listFace 的过滤器)
  eq('⑧过滤器对无关路径返回 false', (() => [inScanFace('scripts/x.mjs'), inScanFace('apps/api/src/a.ts'), inScanFace('packages/y/node_modules/z.ts')])(), [false, true, false])

  // ⑨ 两面旗同给 ⇒ selectFace 给 error
  eq('⑨两面旗同给必给 error', (() => {
    const s = selectFace({ staged: true, worktree: true, def: 'head' })
    return [!!s.error, s.face]
  })(), [true, null])

  // ⑩ blob 取不到 ⇒ 未判定且不记绿(decide 给 2)
  eq('⑩取不到 ⇒ exit 2 不记绿', (() => {
    const d = decide({ perFile: new Map(), unreadable: ['apps/api/src/x.ts —— head 面取不到该 blob'], mode: 'head' })
    return [d.exit, d.unreadable.length]
  })(), [2, 1])

  // ⑪ 阳性对照:票面描述的上游等价形态必须命中两处
  eq('⑪上游等价形态命中 2 处', (() => judgeSource(wrap(UPSTREAM_ANALOGUE)).hits.length)(), 2)

  // ⑫ 变异自证:把"剥注释"(视图B 遮噪)摘掉、直接拿原文面喂命中扫描 ⇒ 注释用例翻红
  eq('⑫摘掉遮注释后注释形态会被误判(证明该步不是装饰)', (() => {
    const raw = wrap(COMMENT_ONLY)
    const unmasked = hitsIn(raw)
    const masked = judgeSource(raw)
    return [unmasked.length >= 1, masked.hits.length]
  })(), [true, 0])

  // 配套:实参含对象配置 / 类方法声明 / 串内伪括号 / 正则体内伪形态
  eq('配置实参不误认回调', (() => {
    const r = judgeSource(wrap(OPTION_ARG))
    return [r.hits.length, r.bodies.length, r.undetermined.length]
  })(), [0, 1, 0])
  eq('类方法 transaction 落声明形态放过', (() => {
    const r = judgeSource(wrap(METHOD_DECL))
    return [r.hits.length, r.passedDeclaration, r.bodies.length]
  })(), [0, 1, 0])
  eq('串内伪括号不破坏切体(视图把串遮了)', (() => {
    const r = judgeSource(wrap(STRING_WITH_BRACKETS))
    return [r.hits.length, r.unbalanced]
  })(), [1, false])
  eq('正则体内伪形态落放过而非站点', (() => {
    const r = judgeSource(wrap(REGEX_BODY))
    return [r.hits.length, r.passedRegexBody >= 1]
  })(), [0, true])
  eq('解析不到的回调 ⇒ 未判定不冒红', (() => {
    const r = judgeSource(wrap(UNRESOLVED_CALLBACK))
    return [r.hits.length, r.undetermined.length >= 1]
  })(), [0, true])
  eq('looksLikeDeclaration 只认关键字前导', (() => [
    looksLikeDeclaration('async'),
    looksLikeDeclaration('await db.'),
    looksLikeDeclaration('return db.'),
  ])(), [true, false, false])
  eq('balanceParen/Brace 配不平返回 -1', (() => [
    balanceParen('(( )', 0),
    balanceBrace('{ } }', 0),
    balanceParen('( ( ) )', 0),
  ])(), [-1, 2, 6])

  console.log(`自检:${ran - fail}/${ran} 通过`)
  return fail === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  const strict = argv.includes('--strict')
  const f = argv.indexOf('--root')
  let root = ROOT
  if (f >= 0) {
    const token = argv[f + 1]
    if (typeof token !== 'string' || token === '' || token.startsWith('-')) {
      console.error(`❌ 无法判定(exit 2): --root 没收到有效目录 —— 紧邻 token 实得:${token === undefined ? '(其后没有任何参数)' : JSON.stringify(token)}`)
      return 2
    }
    root = resolve(token)
  }
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  const fi = argv.indexOf('--files')
  let files = null
  if (fi >= 0) {
    files = []
    for (let i = fi + 1; i < argv.length; i++) {
      if (argv[i].startsWith('--')) break
      files.push(argv[i])
    }
    if (!files.length) {
      console.error('❌ 无法判定(exit 2): --files 后一个路径都没收到')
      return 2
    }
  }
  try {
    assertRepoRoot(root, '本门')
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : String(e?.message ?? e)}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  let out
  try {
    out = analyze(root, face, { files, strict })
  } catch (e) {
    console.error(`❌ 无法判定(exit 2): ${e instanceof Undetermined ? e.message : e?.message ?? String(e)}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(out, null, 2))
    return out.exit
  }
  for (const u of out.unreadable) console.error(`❌ 取不到(${out.face} 面): ${u}`)
  for (const u of out.undetermined) console.error(`❓ 未判定: ${u}`)
  if (out.hits.length) {
    console.error(`❌ 检出 ${out.hits.length} 处「取消探测落在事务体内」[${out.face} 面]:`)
    for (const h of out.hits) {
      console.error(`   ${h.file}:${h.line} —— ${h.kind}(该事务调用起于 :${h.bodyCallLine})`)
    }
    console.error('   出路:把取消检查移到 db.transaction(...) 之前或之后(边界外);体内只做事不探测取消。')
  }
  const c = out.counts
  const fell = out.fellBack ? '(改动集未触及 apps/packages 源码 ⇒ 回落 HEAD 全量)' : ''
  console.log(
    `${out.exit === 0 ? '✅' : out.exit === 2 ? '❌ 无法判定' : '❌ 判红'} [${out.face}]${fell} 文件 ${c.files} / 事务体 ${c.bodies} / 命中 ${out.hits.length} / 放过:边界外 ${c.passedOutside} · 正则体内 ${c.passedRegexBody} · 声明形态 ${c.passedDeclaration} / 未判定 ${out.undetermined.length} / 取不到 ${out.unreadable.length} / 超大跳过 ${c.bytesSkipped}`,
  )
  return out.exit
}

// §22d isDirectRun:被 import(镜像测试)时不得跑 main。Windows 反斜杠必须经 pathToFileURL 归一。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main(process.argv.slice(2)))

export const __test__ = {
  SCAN_PREFIXES,
  MAX_BYTES,
  TX_TOKEN_RE,
  HIT_PATTERNS,
  lineOf,
  hitsIn,
  balanceParen,
  balanceBrace,
  splitTopLevelArgs,
  receiverOf,
  looksLikeDeclaration,
  aliasMap,
  callbackBody,
  findTopLevelArrow,
  locateDeclaration,
  judgeSource,
  inScanFace,
  listFace,
  readFace,
  decide,
  analyze,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
