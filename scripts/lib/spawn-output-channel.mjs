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
 * 所以判据必须把读取点限制在**最内层函数体**内;取不到最内层函数体(顶层语句)时退回整文件,
 * 并把这一格单独计数(`topLevelScoped`)—— 它不是"判过了",是"用更宽的口径判的"。
 *
 * ## 三态,绝不并桶
 *
 *  命中 / 放过 / **未判定**(括号配不平、`stdio` 取值不是字面量(变量或简写属性)、内容取不到)。
 *  调用方必须逐条点名未判定,禁止把"没看清"写成"没问题",也禁止写成"有问题"。
 */
const LINE_COMMENT_RE = /^[ \t]*(\/\/|\/\*|\*).*$/gm

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
 * 找出「把 stdout 丢掉/直通终端、却在同一作用域里读它」的派生调用。
 * @returns {{hits:Array<{varName:string,line:number,channel:string}>, undetermined:Array<{line:number,reason:string}>}}
 */
export function findBlindOutputSpawns(text) {
  const hits = []
  const undetermined = []
  if (typeof text !== 'string' || text.length === 0) {
    return { hits, undetermined: [{ line: 0, reason: '内容为空(取不到内容 ≠ 没有违规)' }] }
  }
  const body = text.replace(LINE_COMMENT_RE, '')
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
    const stdioProp = balanced.args.match(/stdio\s*:\s*(\[[^\]]*\]|'[^']*'|"[^"]*"|`[^`]*`)/)
    if (!stdioProp) {
      // 简写属性 `{ stdio, … }` / `{ stdio }`:取值在别处,**判不出**。不猜(把它算进"没有违规"
      // 就是替一个可能存在的坏通道发合格证),也不算命中(它可能完全合规)。
      if (/\bstdio\b/.test(balanced.args)) {
        undetermined.push({ line: lineOf(body, m.index), reason: 'stdio 是简写属性,取值在别处' })
      }
      // 完全没有 stdio 属性是**另一道门**(189 / check-spawn-stdio)的射程;本判据不判。
      continue
    }
    if (!/^\[|^['"]/.test(stdioProp[1].trim())) {
      undetermined.push({ line: lineOf(body, m.index), reason: `stdio 取值不是字面量(${stdioProp[1].trim().slice(0, 24)})` })
      continue
    }
    const spec = stdioProp[1].trim()
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
    if (!enclosing) {
      // 顶层调用界定不出作用域 ⇒ **未判定**,绝不退回"整文件"。
      // 实测教训:本仓 `scripts/desktop-dev-saas.mjs` 有四个不同的 `const r = …`,其中
      // 顶层那处只读 `r.status`;整文件找 `r.stdout` 会借到别的功能里的读取点 ⇒ 假阳。
      // 假阳比漏报更贵:它指使人去"修"没坏的东西,还会把这条判据的口径说歪成"仓里到处有病"。
      undetermined.push({ line: lineOf(body, m.index), reason: '顶层调用,作用域界定不了(整文件找同名变量会借别人的读取点造假阳)' })
      continue
    }
    const scope = body.slice(enclosing[0], enclosing[1])
    const reader = new RegExp(`\\b${varName}\\s*\\.\\s*(?:stdout|output)\\b|JSON\\.parse\\s*\\(\\s*${varName}\\b`)
    if (!reader.test(scope)) continue // 正当写法:这个调用不吃输出
    hits.push({ varName, line: lineOf(body, m.index), channel: bare })
  }
  return { hits, undetermined }
}

export const __test__ = { findBlindOutputSpawns, collectBlocks, balanceParens }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
