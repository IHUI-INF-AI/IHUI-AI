// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 派生调用的**结论通道**判据(唯一实现)。
 *
 * ## 立因(不是假想,是量到的)
 *
 * 2026-10-04 为治本机 Windows 派生 EBUSY,上百处 `spawn*`/`execFile*` 被统一补了 `stdio`。
 * EBUSY 的真判据是"**不写 stdio**"(stdin 也建管道 ⇒ 父子抢句柄),修法有三种写法都合规:
 *   · `stdio: 'ignore'`             —— 三通道全丢,**只适用于不吃任何输出的调用**
 *   · `stdio: ['ignore','pipe','pipe']` —— stdin 关掉、stdout/stderr 收
 *   · `stdio: ['ignore','inherit','pipe']` —— stdout 直通终端(调用方**不得**再读 `r.stdout`)
 * 问题出在第一类被**误用**在"靠 stdout 拿结论"的调用上:Node 的标量写法对三个通道同时生效,
 * 于是 `r.stdout === null` ⇒ `JSON.parse(null)` 抛 ⇒ 门把自己的尺子读成"输出不可解析",
 * 账面写成「机器态未判定」并 **exit 0**。守门 152 因此自接线那天起在提交链上**从未真的判过一次**
 * (同一条尺子 standalone 给 `scanned: 1429`,门给 `扫描 0`),出处票 G-1108372。
 *
 * ## 与另外两把 stdio 门的分工(方向相反,不得并进去)
 *
 *  `scripts/check-git-stdio-discipline.mjs`(守门 189)与 `scripts/check-spawn-stdio.mjs`
 *  判的是**反极性**:"缺 stdio / 写 `'pipe'` 也算病"。本判据只问一件事 ——
 *  **该调用的 stdout 通道是不是被丢掉了,而同一个作用域里又有人去读它**。
 *  把两者并成一道门会把**正当**的 `stdio:'ignore'`(确实不吃输出的调用)判红。
 *
 * ## 作用域是这个判据的全部难点(整文件找 `r.stdout` 会产出七处假阳)
 *
 * 本仓调用点普遍把结果命名为 `r`。普查 8 处候选里 7 处的"读取点"属于**同一个文件里的另一个 `r`**。
 * 所以读取点要落在**这一处绑定的活区**里:左界是调用自身,右界是同名变量的下一个绑定/再赋值点
 * (`bindingOffsets` 认声明、解构、`for…of/in`、形参位、裸再赋值五种形态),函数体内再套一层
 * "最内层函数体"的界。顶层调用不再退回整文件,也不是一律判"未判定"—— 它有明确右界,判得出。
 * 少认一种绑定形态 ⇒ 借别人的读取点多判一处红;多认一处 ⇒ 只是把活区切短、可能漏判。
 * 本判据的取舍方向固定是后者(假阳比漏报更贵:它指使人去"修"没坏的东西)。
 *
 * ## 三态,绝不并桶
 *
 *  命中 / 放过 / **未判定**。未判定只剩三类,每类都有准确措辞(2026-10-10 票 G-1111918 交掉前两档):
 *   ① `stdio` 取值是**条件表达式一类的复合式**(两支不同形)⇒ 判不出(旧措辞误写成"简写属性");
 *   ② `stdio` 取值是同文件**取不到的变量**(声明不存在、有多处绑定、或 RHS 本身又是表达式);
 *   ③ stdout 通道写成 fd / 对象等**非字面量形态**。
 *  调用方必须逐条点名未判定,禁止把"没看清"写成"没问题",也禁止写成"有问题"。
 *
 * ## 两遍取材必须共用同一台分词器(本判据的结构性前提)
 *
 *  结构遍(找调用、配平括号、切活区、找读取点)跑在 **注释 + 字符串都遮掉** 的那一档上 ——
 *  夹具文本里写着半句 `execFileSync("git", [` 或 `.set({ .*updatedAt` 时,按原文配平必然失败,
 *  而失败的表现是"这一处判不出",不是"这一处有假阳",所以它一路藏在未判定里(票面①的成因)。
 *  取值遍必须读**原文同一偏移**的字节(`stdio: 'ignore'` 的值就住在字符串字面量里,
 *  连字符串一起抹 = 对本判据立项那一型全盲)。两遍**等长**是这个设计成立的前提,
 *  所以入口处显式核长度:不等即整份判"未判定",不产出任何自洽却错位的结论。
 *  遮噪只引 `scripts/lib/code-mask.mjs` 那一份实现,判据内不得自带第二遍状态机。
 */
import { maskCommentsAndStrings, maskedSpans } from './code-mask.mjs'

/**

 * `const 变量 = spawnSync|execFileSync|execFile|spawn|execSync|exec(`。
 * 只认**赋值给变量**的调用:不接结果的调用(`execFileSync(GIT,[…])` 直接丢返回值)本来就没有
 * "读它"的一面,归反极性那道门管。
 */
const SPAWN_CALL_RE =
  /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:spawnSync|execFileSync|execFile|spawn|execSync|exec)\s*\(/g


/** 把 `text` 切成"块"表:`[start,end]`,只收能配平的函数体(`function …{` 与箭头 `=> {`)。 */
function collectBlocks(body) {
  const blocks = []
  for (const bm of body.matchAll(/(?:function\s+[\w$]*\s*\([^)]*\)|function\s*\([^)]*\)|=>)\s*\{/g)) {
    let j = bm.index + bm[0].length
    let depth = 1
    while (j < body.length && depth > 0) {
      if (body[j] === '{') depth++
      else if (body[j] === '}') depth--
      j++
    }
    if (depth === 0) blocks.push([bm.index, j])
  }
  return blocks
}

/** 从 `openIdx`(指向调用左括号)**后一位**起做括号配平,返回参数区文本与结束位置;配不平返回 null。 */
function balanceParens(text, startAfterOpen) {
  let depth = 1
  let i = startAfterOpen
  while (i < text.length && depth > 0) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    i++
  }
  return depth === 0 ? { args: text.slice(startAfterOpen, i - 1), end: i } : null
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

/**
 * 某个名字的**全部绑定/再赋值点**(用于切活区)。覆盖:
 *  `const|let|var NAME`、解构 `const {NAME}` / `const [NAME]`、`for (NAME of|in …)`、
 *  形参位 `function f(NAME…)` / `(NAME…) =>`,以及裸再赋值 `NAME =`。
 *
 * 为什么这些都要算:**读取点必须能追溯到它属于哪一次绑定**,否则顶层那处 `const r = spawnSync(…)`
 * 会借到同文件里另一个 `r` 的读取点(普查 8 处候选里 7 处就是这个形状)。
 * 少认一种绑定形态的后果是**多判一处红**(拿别人的读取点给自己定罪),
 * 而多认一处的后果只是把活区切短、可能漏判 —— 本判据的取舍方向一直是后者。
 */
function bindingOffsets(body, varName) {
  const n = varName.replace(/\$/g, '\\$')
  const pats = [
    new RegExp(`\\b(?:const|let|var)\\s+${n}\\b`, 'g'),
    new RegExp(`\\b(?:const|let|var)\\s*[\\[{][^\\]}\\n]*\\b${n}\\b`, 'g'),
    new RegExp(`\\b${n}\\s*(?:of|in)\\b`, 'g'),
    new RegExp(`\\(\\s*[^()\\n]*\\b${n}\\b[^()\\n]*\\)\\s*(?:=>|\\{)`, 'g'),
    new RegExp(`\\b${n}\\s*=[^=>]`, 'g'),
  ]
  const at = []
  for (const re of pats) for (const mm of body.matchAll(re)) at.push(mm.index)
  return at.sort((a, b) => a - b)
}

/**
 * 取 `struct` 上从 `from` 起第一个非空白字符的下标。
 *
 * **不能只看 struct**:`maskCommentsAndStrings` 把字符串**连引号**一起抹成空白,
 * 于是 `stdio: 'ignore'` 在 struct 上是 `stdio:        `,第一个非空白字符会跳到后面的逗号,
 * 取值就被读成"没有取值"(S1/S15a 第一轮就是这么红的)。所以这里补一条:
 * 原文该位是引号 ⇒ 那就是一个字符串值的起点。注释里的引号不算(靠 `commentMask` 排除)。
 */
function firstSigAt(struct, from) {
  const m = /\S/.exec(struct.slice(from))
  return m ? from + m.index : -1
}

/** 给整份文本标出"落在注释内"的位置(1 = 注释覆盖)。字符串起止不算注释。 */
function commentMask(text) {
  const mask = new Uint8Array(text.length)
  for (const s of maskedSpans(text)) {
    if (s.kind !== 'comment') continue
    for (let i = s.start; i < Math.min(s.end, text.length); i++) mask[i] = 1
  }
  return mask
}

/** 取值区起点:代码字符、或**字符串起始引号**(struct 上已被抹掉,只能回看原文)。 */
function firstValueAt(struct, raw, comments, from) {
  for (let i = from; i < struct.length; i++) {
    if (comments[i] === 1) continue
    const c = struct[i]
    if (c !== undefined && c.trim() !== '') return i
    const r = raw[i]
    if (r === "'" || r === '"' || r === '`') return i
  }
  return -1
}

/**
 * 在 `struct` 上从 `from` 起找**深度 0** 的结束点(逗号或右花括号),用于切出整个取值区。
 * 数组/括号都用 struct 配平(struct 已遮字符串,里面的 `,` 不会冒充边界)。
 */
function valueEndAt(struct, from) {
  let depth = 0
  for (let i = from; i < struct.length; i++) {
    const c = struct[i]
    if (c === '[' || c === '(' || c === '{') depth++
    else if (c === ']' || c === ')' || c === '}') {
      if (depth === 0) return i
      depth--
    } else if ((c === ',' || c === ';') && depth === 0) return i
  }
  return struct.length
}

/**
 * 把 `stdio` 的取值区归一成一个可判定的通道规格。返回:
 *  - `{kind:'spec', text}` 拿到字面量(含 `as const` 包裹、标识符一跳回溯、三元两支同形)
 *  - `{kind:'unknown', reason}` 判不出 ⇒ 调用方落未判定,**绝不猜**
 *
 * 三条回溯规则各有边界:① 标识符只允许**同文件恰好一处** `const/let/var` 绑定(跨文件不在射程,
 * 与守门 157"一跳即止"同一条纪律);② 三元只在**两支都落到同一个通道值**时下结论,不同形就判不出
 * (实测 `discardStdout ? ['pipe','ignore','pipe'] : ['pipe','pipe','pipe']` 是**有意的开关**,
 * 判红等于把设计当缺陷,判绿等于替它担保 ⇒ 只能是未判定);③ 遮罩与原文等长是偏移对得上的前提,
 * 不成立时上层已整份判未判定。
 */
function resolveStdioValue(struct, raw, comments, from) {
  const end = valueEndAt(struct, from)
  const sFrom = firstValueAt(struct, raw, comments, from)
  if (sFrom < 0 || sFrom >= end) return { kind: 'unknown', reason: 'stdio 没有取值' }
  const seg = raw.slice(sFrom, end)
  const lit = seg.match(/^\s*(?:\(\s*)?(\[[^\]]*\]|'[^']*'|"[^"]*"|`[^`]*`)/)
  if (lit) return { kind: 'spec', text: lit[1].trim() }
  const idm = seg.match(/^\s*([A-Za-z_$][\w$]*)/)
  if (!idm) return { kind: 'unknown', reason: `stdio 取值形态读不出(${seg.trim().slice(0, 24)})` }
  const name = idm[1]
  const afterId = firstSigAt(struct, sFrom + idm[0].length)
  if (struct[afterId] === '?') {
    // 三元:两支各自主判,只有全等才下结论
    const rest = raw.slice(afterId + 1, end)
    const arms = rest.split(':').map((s) => s.match(/\[[^\]]*\]|'[^']*'|"[^"]*"/g)?.[0]).filter(Boolean)
    if (arms.length === 2) {
      const specs = arms.map((a) => a.trim())
      if (specs[0] === specs[1]) return { kind: 'spec', text: specs[0] }
      return { kind: 'unknown', reason: 'stdio 是三元且两支通道不同形(有意开关 ⇒ 不猜)' }
    }
    return { kind: 'unknown', reason: 'stdio 是三元而两支读不出字面量' }
  }
  return resolveIdentifier(struct, raw, comments, name)
}

/**
 * 同文件一跳回溯:只认「恰好一处 `const/let/var NAME` 且其 RHS 可归一」。
 * 跨文件与第二跳刻意不做 —— 沿 import 再走会把别的模块的常量拉进来,而"两处算同一件事"
 * 必然漂移是本仓记过最多次的失效型(守门 157 同一格也只允许一跳)。
 */
function resolveIdentifier(struct, raw, comments, name) {
  const decl = new RegExp(`\\b(?:const|let|var)\\s+${name.replace(/\$/g, '\\$')}\\b`, 'g')
  const at = [...struct.matchAll(decl)]
  if (at.length !== 1) {
    return { kind: 'unknown', reason: `stdio 取自变量 ${name} 而同文件绑定数=${at.length}(不唯一 ⇒ 不猜)` }
  }
  const eqAt = firstSigAt(struct, at[0].index + at[0][0].length)
  if (struct[eqAt] !== '=') return { kind: 'unknown', reason: `stdio 取自变量 ${name} 而找不到赋值点` }
  return resolveStdioValue(struct, raw, comments, eqAt + 1)
}

/**
 * 简写属性那一档的入口:属性名固定是 `stdio`,回溯本身与显式赋值共用一份实现。
 */
function traceIdentifier(struct, raw, comments, name = 'stdio') {
  return resolveIdentifier(struct, raw, comments, name)
}

/**
 * 找出「把 stdout 丢掉/直通终端、却在同一作用域里读它」的派生调用。
 * @returns {{hits:Array<{varName:string,line:number,channel:string}>, undetermined:Array<{line:number,reason:string}>}}
 */
export function findBlindOutputSpawns(text) {
  const hits = []
  const undetermined = []
  if (typeof text !== 'string' || text.length === 0) {
    return { hits, undetermined: [{ line: 0, reason: '内容为空(取不到内容 ≠ 没有违规)' }] }
  }
  const struct = maskCommentsAndStrings(text)
  if (struct.length !== text.length) {
    // 遮罩层若不再等长,两遍偏移就对不上,继续跑会产出"自洽却错位"的尺子 —— 那比判不出更坏。
    return { hits, undetermined: [{ line: 0, reason: '遮罩层与原文不等长(行号/偏移会漂)⇒ 整份判不出' }] }
  }
  const body = struct
  const comments = commentMask(text)
  const blocks = collectBlocks(body)
  SPAWN_CALL_RE.lastIndex = 0
  let m
  while ((m = SPAWN_CALL_RE.exec(body))) {
    const varName = m[1]
    const openAfter = m.index + m[0].length
    const balanced = balanceParens(body, openAfter)
    if (!balanced) {
      undetermined.push({ line: lineOf(body, m.index), reason: '括号配不平,读不出 options' })
      continue
    }
    const argsStruct = body.slice(openAfter, balanced.end - 1)
    // `stdio` 这个**标识符**在遮罩面上找(注释与夹具字符串里的同名 token 已被抹掉 ⇒
    // 既不会被读成"这里有 stdio",也不会被读成命中);取值再从原文同一偏移读。
    const keyAt = argsStruct.match(/\bstdio\b/)
    if (!keyAt) {
      // 完全没有 stdio 属性是**另一道门**(189 / check-spawn-stdio)的射程;本判据不判。
      continue
    }
    const afterKey = keyAt.index + keyAt[0].length
    const colonAt = firstSigAt(body, openAfter + afterKey)
    let spec = null
    if (body[colonAt] !== ':') {
      // 简写属性 `{ stdio }` / `{ stdio, … }`:属性名就是变量名 ⇒ 走同一份回溯
      const r = traceIdentifier(body, text, comments)
      if (r.kind !== 'spec') {
        undetermined.push({ line: lineOf(body, m.index), reason: `stdio 写成简写属性而${r.reason}` })
        continue
      }
      spec = r.text
    } else {
      const r = resolveStdioValue(body, text, comments, colonAt + 1)
      if (r.kind !== 'spec') {
        undetermined.push({ line: lineOf(body, m.index), reason: r.reason })
        continue
      }
      spec = r.text
    }
    const channels = spec.startsWith('[') ? spec.slice(1, -1).split(',').map((s) => s.trim()) : [spec, spec, spec]
    const stdoutCh = channels[1]
    if (!stdoutCh || !/^['"]/.test(stdoutCh)) {
      undetermined.push({ line: lineOf(body, m.index), reason: `stdout 通道写法读不出(${String(stdoutCh).slice(0, 24)})` })
      continue
    }
    const bare = stdoutCh.slice(1, -1)
    if (bare === 'pipe') continue
    if (bare !== 'ignore' && bare !== 'inherit') {
      undetermined.push({ line: lineOf(body, m.index), reason: `stdout 通道取值不认识(${bare})` })
      continue
    }
    const enclosing = blocks.filter(([s, e]) => s <= m.index && m.index < e).sort((a, b) => a[1] - a[0] - (b[1] - b[0]))[0]
    // 活区右界:同名变量的下一个绑定/再赋值点。越过它的读取点属于**另一个**绑定,
    // 借来定罪就是假阳(普查 8 处候选里 7 处是这个形状)。
    // 起点必须是**本次调用之后**:`const r = spawnSync(…` 里的 `r =` 自身就是一个绑定点,
    // 按 `> m.index` 切会把活区切成零长 ⇒ 整条判据静默失去命中能力(第一版就是这么把 3 条自检判红的)。
    const nextBinding = bindingOffsets(body, varName).find((o) => o > balanced.end)
    const liveEnd = nextBinding === undefined ? body.length : nextBinding
    const scope = enclosing ? body.slice(enclosing[0], Math.min(enclosing[1], liveEnd)) : body.slice(m.index, liveEnd)
    const reader = new RegExp(`\\b${varName}\\s*\\.\\s*(?:stdout|output)\\b|JSON\\.parse\\s*\\(\\s*${varName}\\b`)
    if (!reader.test(scope)) continue // 正当写法:这个调用不吃输出
    hits.push({ varName, line: lineOf(body, m.index), channel: bare })
  }
  return { hits, undetermined }
}

export const __test__ = {
  findBlindOutputSpawns,
  collectBlocks,
  balanceParens,
  traceIdentifier,
  resolveStdioValue,
  resolveIdentifier,
  firstSigAt,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
