// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815959 常驻反向锁 —— 「持有资源的生成器必须由消费方显式关停」。
 *
 * 上游纪律(migration-runner.ts:88-96,属上游研究快照,不在本仓版本面):写成 generator
 * 是为了让 UI 先 flush 进度,而**消费方提前 break / 抛错时生成器自身的 finally 不会自动跑**
 * ⇒ 连接仍身在事务里,业务拿到"半迁移连接"继续读写,此后所有读到的账都不自洽。
 *
 * 本门问的是同一型的我方版本:被识别为「资源持有型生成器」的函数,其生产面消费点
 * 有没有显式关停(aclose() / .return() / contextlib.closing / async-for-in-try-finally /
 * @contextmanager|@asynccontextmanager 包装)。
 *
 * 消费点定性(两型假阳都在**语句级**判,不是"这一行有没有 break"):① 可证耗尽 ⇒ passed ——
 * 循环 suite(按缩进界定)内无 break/return/raise,或被 list()/推导式整体吃掉 ⇒ 必被喂完,
 * 终态由自身 finally 保证;循环**之后**的同级 return 不算提前退出。② 框架 sink ⇒ 未判定 ——
 * `return StreamingResponse(gen())` 一型:框架是否 aclose 不在被审面 ⇒ "看不见"不是"没关停",
 * 人读面与 --json 面都逐条点名。`yield` 转发 ⇒ 决定权在再往外一层,递归看到底,看不到底落
 * 未判定、不许猜"会耗尽";docstring / `__all__` / 同名定义 / 同名重绑定都不是消费点。
 *
 * 定级依据(现读,不照文档):本门落地当天 HEAD 面命中 > 0(见 --json 的 violations),
 * 所以**默认档只报数、--strict 才问责**。恒红门的唯一结局是各会话跳门、连带链上全部
 * 对账对该提交作废(AGENTS §12e)。升 blocking 的前置 = violations 归零。
 *
 * ⚠️ 当前**尚未接进提交链**:不在 scripts/guardian-runner.mjs、不在 .husky/**、不在
 * scripts/lib/pre-commit-hook.js。本门由 G-815959 交付,注册由主会话做。这条声称由
 * 镜像测试的方向锁钉住:未注册时头注必须自称未接,自称已接即红。
 * 问责入口(手动):node scripts/check-generator-resource-release.mjs --strict
 *
 * 三态绝不并桶:passed / violation(有消费点而确证无关停)/ undetermined(找不到消费点、
 * 函数体边界算不出、框架 sink、转发链看不到底)。
 * "看不见"永远不得被读成"没有敞口",也不得被读成"已合规"。
 *
 * 取材口径同 70/77/83/98/101/103/118:全量判 HEAD blob、--staged 判索引 blob、
 * --worktree 仅人工,两面旗同给 exit 2,取不到判"无法判定"不回落,枚举到 0 判死不记绿。
 * 清单与内容同面同轮(守门 118 的 half-wired 判据:引了 face-reader 却自己 git show /
 * 读盘 = 判红)⇒ 正文一律走 catBatch,枚举走 gitRaw(只列路径不读 blob)。
 *
 * 遮噪:Python 侧行注释与 docstring 由本门自持的最小判据处理 —— lib/code-mask.mjs 的
 * SCRIPT_COMMENT_DIALECTS(:479)只有 ps/sh/bat/vbs,**没有 py**,而它的 JS 遮罩会把
 * 字符串一起抹掉,本门恰恰要靠字符串里的 "BEGIN IMMEDIATE" 认资源 ⇒ 不能套用。
 * TS 侧则引 lib 那一份 maskComments,不在门里再抄一份 JS 遮罩。
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { catBatch, gitRaw, gitErrText } from './lib/face-reader.mjs'
import { maskComments as maskJsComments, maskCommentsStringsAndRegex as maskJsCommentsAndStrings } from './lib/code-mask.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 资源获取锚点:体内出现这些即"持有需要终态的资源" */
const RESOURCE_RES = [
  /BEGIN\s+IMMEDIATE/i,
  /\btransaction\(/,
  /\.acquire\(|\bacquire\(/,
  /subscribe\(/,
  /\bPopen\(/,
  /\bopen\(/,
  /create_subprocess_(exec|shell)/,
  /client\.stream\(/,
  /get_shared_pool|pool\.acquire/,
]
/** 显式关停锚点(消费点侧) */
const CLOSE_RES = [
  /\.aclose\(/,
  /\.return\(/,
  /contextlib\.closing|closing\(/,
  /GeneratorExit/,
]
/** 框架 sink:框架承诺关停,但那条保证不在本面 ⇒ 落未判定而非判红 */
const FRAMEWORK_SINK_RES = [/StreamingResponse\(/, /EventSourceResponse\(/, /StreamingHTTPResponse\(/]
const CM_DECORATOR_RES = /@([a-z0-9_]*\.)?(async)?contextmanager\b/i
const PY_DEF_RE = /^(\s*)(async\s+)?def\s+([A-Za-z_]\w*)\s*\(/
const TS_GEN_RE = /(?:async\s+)?function\s*\*\s*([A-Za-z_]\w*)?/

// ==================== Python 侧遮噪(仅行注释 + 模块/函数 docstring) ====================

/**
 * 产出"判据面":等长遮罩(行号不变),把 `#` 到行尾与整行字符串语句(docstring)压掉。
 * 刻意不抹普通字符串字面量 —— BEGIN IMMEDIATE 住在字符串里,抹掉就对本型全盲。
 * 判"这一行是不是注释/docstring"用原文,压的是内容,行号与列宽都保持。
 */
export function maskPythonNoise(src, blankStrings = false) {
  const lines = src.split('\n')
  let inDoc = false
  let docQuote = ''
  let lastCode = ''
  return lines
    .map((line) => {
      const trimmed = line.trimStart()
      if (inDoc) {
        const idx = trimmed.indexOf(docQuote)
        if (idx >= 0) {
          inDoc = false
          lastCode = ''
        }
        return ' '.repeat(line.length)
      }
      const hashAt = findUnquotedHash(line)
      if (hashAt === 0) return ' '.repeat(line.length)
      // 只有"块首的字符串语句"才是 docstring:上一行代码以 `:` 收尾(或文件首行)。
      // 否则一行以引号开头的**续行实参**(如 client.stream(\n    'POST', ...) 里的 'POST')
      // 会被误判成 docstring 起始,把整行吞掉并让后续代码连带进入错误状态 —— 那正是
      // "把能判的格写成判不出"的形态。
      const dq = /^("""|'''|"(?!=)|'(?!=))/.exec(trimmed)
      const opensSuite = lastCode === '' || lastCode.endsWith(':')
      if (dq && trimmed.startsWith(dq[1]) && opensSuite) {
        const q = dq[1].length === 3 ? dq[1] : dq[1][0]
        const rest = trimmed.slice(dq[1].length)
        if (rest.indexOf(q) < 0 && dq[1].length === 3) {
          inDoc = true
          docQuote = q
        }
        lastCode = ''
        return ' '.repeat(line.length)
      }
      lastCode = trimmed.replace(/\s+/g, ' ').trim()
      let out = hashAt > 0 ? line.slice(0, hashAt) + ' '.repeat(line.length - hashAt) : line
      if (blankStrings) out = blankQuotedSegments(out)
      return out
    })
    .join('\n')
}

/** 把行内单行字符串字面量的内容压白(引号保留)⇒ "只在字符串里出现的 aclose" 不算关停 */
function blankQuotedSegments(line) {
  let out = ''
  let i = 0
  while (i < line.length) {
    const c = line[i]
    if (c === '"' || c === "'") {
      const triple = line.slice(i, i + 3)
      if (triple === '"""' || triple === "'''") {
        const close = line.indexOf(triple, i + 3)
        if (close > 0) {
          out += triple + ' '.repeat(close - i - 3) + triple
          i = close + 3
          continue
        }
      }
      let j = i + 1
      while (j < line.length && line[j] !== c) {
        if (line[j] === '\\') j += 1
        j += 1
      }
      out += c + ' '.repeat(Math.max(0, j - i - 1)) + (j < line.length ? c : '')
      i = j + 1
      continue
    }
    out += c
    i += 1
  }
  return out
}

/** 按语言取"判据面"(注释 + 字符串压白,行号不变);遮罩只此一份实现 */
export function maskForJudgement(relPath, text) {
  if (relPath.endsWith('.py')) return maskPythonNoise(text, true)
  return maskJsCommentsAndStrings(text)
}

/** 找行内未被引号包裹的 `#`;引号内的 # 不算注释起点(不判整串,只定位) */
function findUnquotedHash(line) {
  let q = null
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (q) {
      if (c === '\\') { i += 1; continue }
      if (c === q) q = null
      continue
    }
    if (c === '"' || c === "'") { q = c; continue }
    if (c === '#') return i
  }
  return -1
}

const indentOf = (line) => (line.match(/^[ \t]*/)?.[0] ?? '').replace(/\t/g, '    ').length

/**
 * 扫一个 Python 文件,返回该文件里的"生成器函数"清单(name/lineno/是否含资源/是否 CM 包装)。
 * 边界算法:按缩进取体,嵌套 def 的子树从"自有语句"集合里剔除(资源与 yield 都只认本级)。
 */
export function scanPythonFile(relPath, src) {
  const masked = maskPythonNoise(src)
  const raw = src.split('\n')
  const mLines = masked.split('\n')
  const out = []
  for (let i = 0; i < mLines.length; i += 1) {
    const m = PY_DEF_RE.exec(mLines[i])
    if (!m) continue
    const baseIndent = m[1].replace(/\t/g, '    ').length
    // 装饰器行(紧邻上方,可能多行 @)
    let decoratedCM = false
    for (let k = i - 1; k >= 0; k -= 1) {
      const t = mLines[k].trim()
      if (t === '') continue
      if (t.startsWith('@')) {
        if (CM_DECORATOR_RES.test(t)) decoratedCM = true
        continue
      }
      break
    }
    // 多行签名:async def f(\n  a,\n  b,\n) -> X:  —— 若从 i+1 起逐行判"缩进 <= base 即体结束",
    // 签名结束行(`) -> X:` 缩进等于 def)会把体截成 0 行,而参数行缩进比 def 深、会被当成体内容
    // ⇒ 整族隐身(本门落地当天对 providers/*.astream 全盲就是这一型)。
    // 正确做法:从 def 行起跟踪括号深度,深度回到 0 且该行以 `:` 收尾 = 签名结束,体从下一行起算。
    let bodyStart = -1
    let depth = 0
    for (let j = i; j < mLines.length; j += 1) {
      for (const ch of mLines[j]) {
        if (ch === '(' || ch === '[') depth += 1
        else if (ch === ')' || ch === ']') depth -= 1
      }
      if (depth <= 0 && mLines[j].trimEnd().endsWith(':')) {
        bodyStart = j + 1
        break
      }
      if (depth <= 0 && j > i && !mLines[j].trim().startsWith(')')) break
    }
    if (bodyStart < 0) bodyStart = i + 1
    let ownLevelHasYield = false
    let ownLevelHasResource = false
    let end = bodyStart
    let parsedOk = false
    for (let j = bodyStart; j < mLines.length; j += 1) {
      const line = mLines[j]
      if (line.trim() === '') continue
      const ind = indentOf(line)
      if (ind <= baseIndent) { end = j; break }
      // 剔除嵌套 def/async def/lambda 的整个子树
      const nd = /^(\s*)(async\s+)?def\s+[A-Za-z_]\w*\s*\(/.exec(line)
      if (nd) {
        const ni = nd[1].replace(/\t/g, '    ').length
        let k = j + 1
        for (; k < mLines.length; k += 1) {
          if (mLines[k].trim() === '') continue
          if (indentOf(mLines[k]) <= ni) break
        }
        j = k - 1
        continue
      }
      parsedOk = true
      if (/\byield\b/.test(line)) ownLevelHasYield = true
      if (RESOURCE_RES.some((re) => re.test(line))) ownLevelHasResource = true
      if (ownLevelHasYield && ownLevelHasResource && decoratedCM) break
      end = j + 1
    }
    out.push({
      file: relPath,
      line: i + 1,
      name: m[3],
      generator: ownLevelHasYield,
      holdsResource: ownLevelHasResource,
      contextManagerWrapped: decoratedCM,
      bodyParsed: parsedOk || !ownLevelHasYield,
      bodyEnd: end,
      bodyText: raw.slice(i, end).join('\n'),
    })
  }
  return out
}

/** TS 侧:function* / async function* 体内含资源锚点 */
export function scanTsFile(relPath, src) {
  const masked = maskJsComments(src)
  const lines = masked.split('\n')
  const out = []
  for (let i = 0; i < lines.length; i += 1) {
    const m = TS_GEN_RE.exec(lines[i])
    if (!m) continue
    const name = m[1] || '<匿名>'
    // 体:到下一个同缩进的顶层声明为止(粗粒度,够用且宁漏不误报)
    const baseIndent = indentOf(lines[i])
    let end = i + 1
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === '') continue
      if (indentOf(lines[j]) <= baseIndent && /^\s*(export\s+)?(async\s+)?(function|const|class|})/.test(lines[j])) { end = j; break }
      end = j + 1
    }
    const body = lines.slice(i, end).join('\n')
    out.push({
      file: relPath,
      line: i + 1,
      name,
      generator: /\byield\b/.test(body),
      holdsResource: RESOURCE_RES.some((re) => re.test(body)),
      contextManagerWrapped: false,
      bodyParsed: true,
      bodyEnd: end,
      bodyText: src.split('\n').slice(i, end).join('\n'),
    })
  }
  return out
}

/** 是否测试面(测试不是消费点,也不得让夹具把门判红) */
export function isTestPath(p) {
  return /(^|\/)(tests?|__tests__|e2e)\//.test(p) || /\.(test|spec)\.[tj]sx?$/.test(p) || /conftest\.py$/.test(p)
}

// ==================== 消费点定性(①可证耗尽 / ②框架 sink) ====================
/**
 * 消费窗口 = 匹配行**所在的块**(不是固定 40 行):`return StreamingResponse(gen())` 常写在
 * 生成器 def 之后而体长于 40 行,固定窗口会把 sink 整型看成"无关停证据"判红。
 * 窗口被截断 ⇒ 看不到底 ⇒ 只能落未判定。
 */
const MAX_WINDOW_LINES = 400
const FORWARD_MAX_DEPTH = 3
const FUNNEL_RE = /\b(?:list|tuple|set|frozenset|sorted|deque)\s*\(\s*(?:await\s+)?/
const AGG_FUNNEL_RE = /\b(?:sum|min|max|any|all)\s*\(\s*(?:[^()]*\bfor\b[^()]*)?\s*(?:await\s+)?/
const PARTIAL_FUNNEL_RE = /\b(?:next|islice|tee)\s*\(/
const LOOP_HEAD_RE = /^\s*(?:async\s+)?for\b[^\n]*\bin\b/
const YIELD_RE = /\byield\b/
const EARLY_EXIT_RE = /(?:^|[\s;])(?:break|return|raise)\b/

function bracketDelta(t) {
  let d = 0
  for (const c of t) d += c === '(' || c === '[' || c === '{' ? 1 : c === ')' || c === ']' || c === '}' ? -1 : 0
  return d
}
/** 把窗口按"逻辑语句"归组(括号配平 + 续行);站点必须归到整条语句才认得出多行 sink */
export function statementGroups(lines) {
  const g = new Map()
  let depth = 0
  let start = -1
  for (let j = 0; j < lines.length; j += 1) {
    if (start < 0) {
      if (lines[j].trim() === '') continue
      start = j
      depth = 0
    }
    depth += bracketDelta(lines[j])
    if ((depth <= 0 && !/\\\s*$/.test(lines[j])) || j - start >= 60) {
      for (let k = start; k <= j; k += 1) if (!g.has(k)) g.set(k, { start, end: j + 1 })
      start = -1
    }
  }
  if (start >= 0) for (let k = start; k < lines.length; k += 1) if (!g.has(k)) g.set(k, { start, end: lines.length })
  return g
}
/** 循环/复合语句的 suite:比头行更深缩进的连续行 */
export function suiteRange(lines, headIdx) {
  const ind = indentOf(lines[headIdx])
  let j = headIdx + 1
  for (; j < lines.length; j += 1) {
    if (lines[j].trim() === '') continue
    if (indentOf(lines[j]) <= ind) break
  }
  return { start: headIdx + 1, end: j }
}

/** 匹配行**所在语句**的起始行:括号净深度为 0 的那一行(最多回看 20 行,免得把无关语句卷进窗口) */
export function statementStart(lines, idx) {
  let depth = 0
  for (let i = 0; i < idx; i += 1) depth += bracketDelta(lines[i])
  for (let k = idx; k >= 0 && idx - k <= 20; k -= 1) {
    if (depth === 0) return k
    depth -= bracketDelta(lines[k - 1])
  }
  return idx
}
export function blockWindow(lines, idx) {
  // 窗口起点回退到语句开头:多行 `return StreamingResponse(` 的 sink 关键词住在上一行,
  // 从匹配行起算会把 sink 整型读成 opaque(本门 ② 型假阳的真实成因之一)。
  const from = statementStart(lines, idx)
  const ind = indentOf(lines[idx])
  let depth = 0
  let end = from + 1
  for (let j = from; j < lines.length; j += 1) {
    depth += bracketDelta(lines[j])
    // 同级兄弟留在窗口内(sink 常写在生成器 def 之后);模块级到下一条顶层语句为止
    if (j > from && depth <= 0 && lines[j].trim() !== '') {
      const li = indentOf(lines[j])
      if (li < ind || (ind === 0 && li === 0)) break
    }
    end = j + 1
    if (end - from >= MAX_WINDOW_LINES) break
  }
  return { text: lines.slice(from, end).join('\n'), start: from, end, truncated: end - from >= MAX_WINDOW_LINES }
}

/**
 * 消费点上对 `name` 的**消费语句**逐条定性(语句级,不是"这一行有没有 break")。kind ∈
 * loop-exhausted(无提前退出 ⇒ 必被喂完) / loop-partial(有 break/return/raise) / loop-forward
 * 与 yield-forward(内层 yield ⇒ 往外一层决定,要递归看到底) / funnel / comprehension /
 * sink(交给框架运行时,关停与否不在本面) / handoff / opaque(认不出 ⇒ 绝不猜"会耗尽")
 */
export function classifySites(maskedText, startIdx, name) {
  const lines = maskedText.split('\n')
  const callRe = new RegExp(`\\b${name}\\s*\\(`)
  const bareRe = new RegExp(`\\b${name}\\b`)
  const defRe = new RegExp(`^\\s*(?:async\\s+)?def\\s+${name}\\b|^\\s*class\\s+${name}\\b`)
  const groups = statementGroups(lines)
  const sites = []
  for (let j = 0; j < lines.length; j += 1) {
    const line = lines[j]
    if (defRe.test(line)) continue // 定义行不是消费点(同名异函数不得互相顶账)
    const isCall = callRe.test(line)
    const isLoopRef = LOOP_HEAD_RE.test(line) && bareRe.test(line)
    if (!isCall && !isLoopRef) continue
    const abs = startIdx + j
    if (isLoopRef) {
      const { start, end } = suiteRange(lines, j)
      const suite = lines.slice(start, end).join('\n')
      if (YIELD_RE.test(suite)) sites.push({ kind: 'loop-forward', line: abs + 1 })
      else if (EARLY_EXIT_RE.test(suite)) sites.push({ kind: 'loop-partial', line: abs + 1 })
      else sites.push({ kind: 'loop-exhausted', line: abs + 1 })
      continue
    }
    const grp = groups.get(j) ?? { start: j, end: j + 1 }
    const stmt = lines.slice(grp.start, grp.end).join('\n')
    if (FRAMEWORK_SINK_RES.some((re) => re.test(stmt))) sites.push({ kind: 'sink', line: abs + 1 })
    else if (/^\s*(?:await\s+)?yield\b/.test(stmt)) sites.push({ kind: 'yield-forward', line: abs + 1 })
    else if (PARTIAL_FUNNEL_RE.test(stmt)) sites.push({ kind: 'loop-partial', line: abs + 1 })
    else if (FUNNEL_RE.test(stmt) || AGG_FUNNEL_RE.test(stmt)) sites.push({ kind: 'funnel', line: abs + 1 })
    else if (/\bfor\b[^\n]*\bin\b/.test(stmt)) sites.push({ kind: 'comprehension', line: abs + 1 })
    else if (/^\s*[\w.[\]]+\s*=[^=]/.test(stmt)) sites.push({ kind: 'handoff', line: abs + 1 })
    else sites.push({ kind: 'opaque', line: abs + 1 })
  }
  return sites
}
/** 消费循环是否被 try/finally 包住(旧锚点,现按**缩进归属**判,不再用 400 字符窗口正则) */
export function tryFinallyWraps(maskedText, name) {
  const lines = maskedText.split('\n')
  const bareRe = new RegExp(`\\b${name}\\b`)
  for (let j = 0; j < lines.length; j += 1) {
    if (!LOOP_HEAD_RE.test(lines[j]) || !bareRe.test(lines[j])) continue
    const ind = indentOf(lines[j])
    let k = j - 1
    while (k >= 0 && (lines[k].trim() === '' || indentOf(lines[k]) >= ind)) k -= 1
    if (k < 0 || !/^\s*try\s*:/.test(lines[k])) continue
    const outer = indentOf(lines[k])
    let fin = false
    for (let m = j + 1; m < lines.length; m += 1) {
      if (lines[m].trim() === '') continue
      if (indentOf(lines[m]) > outer) continue
      fin = indentOf(lines[m]) === outer && /^\s*finally\s*:/.test(lines[m])
      break
    }
    if (fin) return true
  }
  return false
}
/** 该消费点的定性:closed|exhausted|sink|forward|open|none */
export function consumerOutcome(consumer, name) {
  const code = maskForJudgement(consumer.file, consumer.text)
  if (CLOSE_RES.some((re) => re.test(code))) return { state: 'closed', why: '显式关停(aclose/return/closing/GeneratorExit)', sites: [] }
  if (tryFinallyWraps(code, name)) return { state: 'closed', why: '消费循环被 try/finally 包住', sites: [] }
  const sites = classifySites(code, Number.isInteger(consumer.start) ? consumer.start : 0, name)
  if (sites.length === 0) return { state: 'none', why: '代码面上没有对它的消费语句(叙述/清单/同名重绑定)', sites }
  if (sites.some((s) => s.kind === 'loop-partial' || s.kind === 'handoff' || s.kind === 'opaque')) {
    return { state: 'open', why: '存在提前退出或把对象交出去却无关停', sites }
  }
  if (sites.some((s) => s.kind === 'loop-forward' || s.kind === 'yield-forward')) return { state: 'forward', why: '转发给再往外一层的调用者', sites }
  if (sites.some((s) => s.kind === 'sink')) return { state: 'sink', why: '框架 sink:是否显式 aclose 不在被审面' + (consumer.truncated ? '(窗口已截断)' : ''), sites }
  return { state: 'exhausted', why: '可证耗尽(整体喂完 ⇒ 资源终态由生成器自身 finally 保证)', sites }
}
/** 递归一层"转发":往外找同名函数的消费点,看到底才敢判耗尽;看不到底就落未判定 */
function resolveForward(name, files, depth) {
  if (depth > FORWARD_MAX_DEPTH) return { state: 'none', why: `转发链超过 ${FORWARD_MAX_DEPTH} 层 ⇒ 看不到底` }
  const holders = []
  for (const [p, src] of files) {
    if (isTestPath(p) || src === null) continue
    const fns = p.endsWith('.py') ? scanPythonFile(p, src) : scanTsFile(p, src)
    for (const f of fns) if (f.name === name) holders.push(f)
  }
  if (holders.length === 0) return { state: 'none', why: '往外一层找不到该名字的函数 ⇒ 看不到底' }
  const outs = []
  for (const fn of holders) for (const c of findConsumers(fn, files)) outs.push((c.outcome ?? consumerOutcome(c, name)).state)
  if (outs.some((s) => s === 'open')) return { state: 'open', why: '往外一层存在提前退出/交接' }
  if (outs.some((s) => s === 'forward')) return { state: 'none', why: '还在往外传,未见底' }
  if (outs.some((s) => s === 'sink')) return { state: 'sink', why: '往外一层交给框架运行时' }
  if (outs.length > 0 && outs.every((s) => s === 'closed' || s === 'exhausted')) return { state: 'closed', why: '往外一层可证耗尽/已关停' }
  return { state: 'none', why: '往外一层无消费点 ⇒ 看不到底' }
}
/**
 * 消费点定性 + 汇总。返回 {verdict, evidence[]} —— verdict ∈ passed|violation|undetermined。
 * 三态不并桶:确证敞口(violation)> 看不见(undetermined)> 可证安全(passed)。
 */
export function judgeFunction(fn, consumers, ctx = {}) {
  const files = ctx.files ?? null
  if (!fn.generator || !fn.holdsResource) return { verdict: 'not-candidate', evidence: [] }
  if (fn.contextManagerWrapped) {
    return { verdict: 'passed', evidence: [`${fn.file}:${fn.line} 由 @contextmanager 系列包装(with 协议驱动终态)`] }
  }
  if (!fn.bodyParsed) return { verdict: 'undetermined', evidence: [`${fn.file}:${fn.line} 体边界算不出`] }
  if (consumers.length === 0) {
    return { verdict: 'undetermined', evidence: [`${fn.file}:${fn.line} 生产面找不到引用 ${fn.name} 的消费点`] }
  }
  const ev = []
  const states = []
  for (const c of consumers) {
    const o = c.outcome ?? consumerOutcome(c, fn.name)
    if (o.state === 'none') {
      ev.push(`      · ${c.file}:${c.line} 非消费语句(${o.why}) ⇒ 不计账`)
      continue
    }
    let state = o.state
    let why = o.why
    if (state === 'forward') {
      if (!files) {
        ev.push(`      · ${c.file}:${c.line} ⚠️ 未判定:${why};未给被审面 ⇒ 看不到底,不猜`)
        states.push('none')
        continue
      }
      const up = resolveForward(fn.name, files, (ctx.depth ?? 0) + 1)
      state = up.state === 'closed' ? 'exhausted' : up.state
      why = `${why};往外一层:${up.why}`
    }
    states.push(state)
    const kinds = [...new Set(o.sites.map((x) => x.kind))].join(',')
    ev.push(`      · ${c.file}:${c.line} ${state}(${why}) [${kinds} @${o.sites.map((x) => x.line).join(',')}]`)
  }
  if (states.length === 0) {
    return { verdict: 'undetermined', evidence: [`${fn.file}:${fn.line} 生产面只有非消费语句 ⇒ 真消费点未见`, ...ev] }
  }
  if (states.includes('open')) return { verdict: 'violation', evidence: ev }
  if (states.includes('sink') || states.includes('none')) {
    return { verdict: 'undetermined', evidence: [...ev, '      · 结论:框架侧/外层是否关停不在被审面 ⇒ 不判红也不记通过'] }
  }
  return { verdict: 'passed', evidence: ev }
}
/**
 * 在一个面里找生产消费点(排除测试面与自己)。定性逐候选做:前几处命中常是 docstring /
 * `__all__` / 同名定义,固定取第一条会把真消费行挤掉并把噪声行当消费点判红。
 */
export function findConsumers(fn, allFiles) {
  const re = new RegExp(`\\b${fn.name.replace(/[^\w]/g, '_')}\\b`)
  const noise = []
  const real = []
  for (const [p, src] of allFiles) {
    if (isTestPath(p) || src === null) continue
    const lines = src.split('\n')
    let taken = 0
    for (let i = 0; i < lines.length; i += 1) {
      if (!re.test(lines[i])) continue
      if (p === fn.file && Math.abs(i + 1 - fn.line) <= 1) continue // 声明行本身
      if (taken++ >= 12) break // 窗口可达 400 行 ⇒ 每文件核候选数必须封顶
      const win = blockWindow(lines, i)
      const c = { file: p, line: i + 1, start: i, text: win.text, truncated: win.truncated }
      c.outcome = consumerOutcome(c, fn.name)
      if (c.outcome.sites.length > 0 || c.outcome.state === 'closed') real.push(c)
      else noise.push(c)
      if (real.length >= 8) break
    }
    if (real.length >= 8) break
  }
  return real.length ? real : noise.slice(0, 1)
}
export function auditFace(files) {
  const funcs = []
  for (const [p, src] of files) {
    if (p.endsWith('.py')) funcs.push(...scanPythonFile(p, src))
    else if (/\.(ts|tsx|mts)$/.test(p) && !p.endsWith('.d.ts')) funcs.push(...scanTsFile(p, src))
  }
  const candidates = funcs.filter((f) => f.generator && f.holdsResource)
  const rows = candidates.map((fn) => {
    const consumers = findConsumers(fn, files)
    const { verdict, evidence } = judgeFunction(fn, consumers, { files, depth: 0 })
    return { file: fn.file, line: fn.line, name: fn.name, verdict, evidence, wrapped: fn.contextManagerWrapped }
  })
  const counts = { passed: 0, violation: 0, undetermined: 0 }
  for (const r of rows) counts[r.verdict] += 1
  // 未判定必须**点名站点**:只给计数,下一个人无从清偿(人读面与 --json 面同源)
  const undeterminedSites = rows
    .filter((r) => r.verdict === 'undetermined')
    .map((r) => ({ site: `${r.file}:${r.line}`, name: r.name, why: r.evidence.filter((e) => /sink|未判定|未见|看不到底|非消费/.test(String(e))).map((e) => String(e).trim()) }))
  const sinkSiteCount = undeterminedSites.reduce((n, s) => n + s.why.filter((w) => /sink/.test(w)).length, 0)
  return { rows, counts, scannedFiles: files.size, candidates: rows.length, undeterminedSites, sinkSiteCount }
}

// ==================== 取材 ====================

const ENUM_GLOBS = ['apps/ai-service/app', 'apps/api/src']

export function listCandidatesFor(face, root) {
  const split = (out) => String(out ?? '').split('\0').filter(Boolean)
  let paths
  if (face === 'worktree') {
    paths = split(
      gitRaw(
        ['ls-files', '-z', '--', ...ENUM_GLOBS.map((g) => `${g}/**/*.py`), ...ENUM_GLOBS.map((g) => `${g}/**/*.ts`)],
        root,
      ),
    )
  } else if (face === 'staged') {
    paths = split(gitRaw(['diff', '--cached', '--name-only', '-z', 'HEAD', '--', ...ENUM_GLOBS], root))
  } else {
    paths = split(gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...ENUM_GLOBS], root))
  }
  return paths.filter((p) => (p.endsWith('.py') || p.endsWith('.ts')) && !p.endsWith('.d.ts'))
}

export function readFace(face, root, paths) {
  const map = new Map()
  if (paths.length === 0) return map
  if (face === 'worktree') {
    // 人工逃生舱:磁盘副本常年滞后 HEAD ⇒ 这一档的读数不是问责面,报告行会明写
    for (const p of paths) {
      try {
        map.set(p, readFileSync(path.join(root, p), 'utf8'))
      } catch {
        map.set(p, null)
      }
    }
    return map
  }
  const specs = paths.map((p) => `${face === 'staged' ? '' : 'HEAD:'}${p}`)
  const got = catBatch(root, specs)
  for (let i = 0; i < paths.length; i += 1) {
    const v = got.get(specs[i])
    map.set(paths[i], typeof v === 'string' ? v : null)
  }
  return map
}

export function decide({ counts, strict, enumerated }) {
  if (!enumerated) return 2
  if (strict && counts.violation > 0) return 1
  return 0
}

// ==================== main ====================

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const wantStaged = argv.includes('--staged')
  const wantWorktree = argv.includes('--worktree')
  const strict = argv.includes('--strict')
  const asJson = argv.includes('--json')
  if (wantStaged && wantWorktree) {
    console.log('❌ --staged 与 --worktree 不得同时给(两面取数会互相冒充)')
    process.exit(2)
  }
  const face = wantStaged ? 'staged' : wantWorktree ? 'worktree' : 'head'
  let paths
  try {
    paths = listCandidatesFor(face, ROOT)
  } catch (e) {
    console.log(`❌ 无法判定:清单取不到(${gitErrText(e)})`)
    process.exit(2)
  }
  if (paths.length === 0) {
    console.log('❌ 无法判定:被审面枚举到 0 个候选文件 ⇒ 判死,不记绿')
    process.exit(2)
  }
  const files = readFace(face, ROOT, paths)
  let missing = 0
  for (const [, v] of files) if (v === null) missing += 1
  if (missing === files.size) {
    console.log(`❌ 无法判定:${missing} 个路径正文全部取不到 ⇒ 不回落另一个面、不记绿`)
    process.exit(2)
  }
  const res = auditFace(files)
  const rc = decide({ counts: res.counts, strict, enumerated: true })
  if (asJson) {
    console.log(JSON.stringify({ face, missingFromFace: missing, ...res }, null, 2))
  } else {
    console.log(`取材面=${face} · 扫描 ${res.scannedFiles} 文件 · 资源持有型生成器候选 ${res.candidates}`)
    for (const r of res.rows) {
      const tag = { passed: '✅ 已关停', violation: '❌ 无关停', undetermined: '⚠️ 未判定' }[r.verdict]
      console.log(`${tag} ${r.file}:${r.line} ${r.name}${r.wrapped ? '(contextmanager 包装)' : ''}`)
      for (const e of r.evidence) console.log(`      ${e}`)
    }
    console.log(
      `汇总:passed=${res.counts.passed} violation=${res.counts.violation} undetermined=${res.counts.undetermined}` +
        ` · 框架 sink 站点 ${res.sinkSiteCount}` +
        (missing ? ` · 取不到 ${missing}` : '') +
        (rc === 1 ? ' ⇒ --strict 问责' : rc === 0 ? ' ⇒ 默认档只报数' : ''),
    )
    if (res.undeterminedSites.length > 0) {
      console.log('未判定站点(逐条点名,不得被读成"这一格不存在"):')
      for (const s of res.undeterminedSites) console.log(`  ⚠️ ${s.site} ${s.name} — ${s.why.join(' / ') || '见上方证据行'}`)
    }
  }
  process.exit(rc)
}

// ==================== 自检(构造面成对正反例 + 真仓样本) ====================

function selfTest() {
  const results = []
  const t = (name, cond) => results.push({ name, ok: cond === true, got: String(cond) })
  const PY = [
    // ① 注释里的 yield 不算生成器
    ['a.py', 'def f():\n    # yield\n    return 1\n'],
    // ② 生成器 + 体内资源,无消费点 ⇒ 未判定
    ['b.py', 'async def g():\n    await pool.acquire()\n    yield 1\n'],
    // ③ @contextmanager 包装 ⇒ passed(等价保护)
    ['c.py', '@contextmanager\n    def _tx(self):\n        with self._lock:\n            self._conn.execute("BEGIN IMMEDIATE")\n            yield self._conn\n'],
    // ④ 资源只写在注释里 ⇒ 不是候选
    ['d.py', 'def h():\n    # pool.acquire()\n    yield 2\n'],
    // ⑤ 非生成器(无 yield)但含资源 ⇒ 不是候选
    ['e.py', 'async def k():\n    async with pool.acquire() as c:\n        return c\n'],
    // ⑥ 嵌套 def 里的 yield 不算本级
    ['f.py', 'def outer():\n    def inner():\n        yield 3\n    return inner\n'],
  ]
  for (const [name, src] of PY) {
    const fns = scanPythonFile(name, src)
    t(`${name} 解析出函数`, fns.length >= 1)
  }
  t('注释里的 yield 不算生成器', scanPythonFile('a.py', PY[0][1])[0].generator === false)
  t('资源只出现在注释里不算持有', scanPythonFile('d.py', PY[3][1])[0].holdsResource === false)
  t('无 yield 的函数不是候选', scanPythonFile('e.py', PY[4][1]).filter((f) => f.generator && f.holdsResource).length === 0)
  t('嵌套 def 的 yield 不归本级', scanPythonFile('f.py', PY[5][1]).filter((f) => f.name === 'outer' && f.generator).length === 0)
  const b = scanPythonFile('b.py', PY[1][1]).find((f) => f.name === 'g')
  t('生成器+资源被识别', b && b.generator === true && b.holdsResource === true)
  t('无消费点 ⇒ 未判定(不判红)', judgeFunction(b, []).verdict === 'undetermined')
  t('显式关停的消费点 ⇒ passed', judgeFunction(b, [{ file: 'z.py', line: 5, text: 'await g.aclose()' }]).verdict === 'passed')
  t('.return() 也算关停', judgeFunction(b, [{ file: 'z.py', line: 5, text: 'it.return()' }]).verdict === 'passed')
  t('aclose 只在字符串里 ⇒ 仍算关停?否:必须代码面', judgeFunction(b, [{ file: 'z.py', line: 5, text: 'msg = "please aclose() later"' }]).verdict !== 'passed')
  t('async-for-in-finally 算关停', judgeFunction(b, [{ file: 'z.py', line: 5, text: 'async for x in g():\n    use(x)\nfinally:\n    pass' }]).verdict === 'passed')
  t('StreamingResponse sink ⇒ 未判定而非判红', judgeFunction(b, [{ file: 'z.py', line: 5, text: 'return StreamingResponse(g(), media_type="text/event-stream")' }]).verdict === 'undetermined')
  t('有消费点而无关停 ⇒ violation', judgeFunction(b, [{ file: 'z.py', line: 5, text: 'async for x in g():\n    break' }]).verdict === 'violation')
  const c = scanPythonFile('c.py', PY[2][1]).find((f) => f.name === '_tx')
  t('@contextmanager 包装 ⇒ 等价保护 passed', c && judgeFunction(c, []).verdict === 'passed')
  // ⑦ 多行签名的生成器(参数行缩进比 def 深、`) -> X:` 与 def 同缩进)必须仍能识别
  const MULTI = 'class P:\n    async def astream(\n        self,\n        model: str,\n    ) -> AsyncIterator[dict]:\n        async with client.stream(\n            "POST",\n            timeout=1,\n        ) as resp:\n            yield {"type": "chunk"}\n'
  const ms = scanPythonFile('m.py', MULTI).find((f) => f.name === 'astream')
  t('多行签名的生成器不被签名截断(失明反向锁)', ms && ms.generator === true && ms.holdsResource === true)
  t('续行实参以引号开头不得被当 docstring 吞掉', maskPythonNoise('x = f(\n    "POST",\n)\n').includes('"POST"') === true)
  // TS 侧
  const tsFns = scanTsFile('t.ts', 'export async function* streamExportRows(q: string) {\n  const c = await pool.acquire()\n  yield c\n}\n')
  t('TS 生成器+资源被识别', tsFns.some((f) => f.generator && f.holdsResource))
  t('TS 注释里的 function* 不算', scanTsFile('t2.ts', '// export async function* gone(){ yield 1 }\nconst a = 1\n').length === 0)
  t('测试面不得当消费点', isTestPath('apps/ai-service/tests/x.py') && isTestPath('apps/web/e2e/y.ts'))
  // ===== 本票两型:构造面成对(①耗尽/②提前退出/③转发看不到底/④sink/⑤交接) =====
  const LOOP_EXH = 'async def c1():\n    async for x in g():\n        use(x)\n'
  const LOOP_BRK = 'async def c2():\n    async for x in g():\n        if x:\n            break\n'
  const LOOP_FWD = 'async def w():\n    async for x in g():\n        yield x\n'
  const SINK_MULTI = '    return StreamingResponse(\n        g(),\n        media_type="text/event-stream",\n    )\n'
  t('① 耗尽式消费(循环体内无 break/return)⇒ passed', judgeFunction(b, [{ file: 'z.py', line: 1, text: LOOP_EXH }]).verdict === 'passed')
  t('② 同一循环加一个 break ⇒ violation(证不出耗尽)', judgeFunction(b, [{ file: 'z.py', line: 1, text: LOOP_BRK }]).verdict === 'violation')
  t('③ yield 转发且外层看不到底 ⇒ 未判定(不得记 passed)', judgeFunction(b, [{ file: 'z.py', line: 1, text: LOOP_FWD }]).verdict === 'undetermined')
  const sinkC = judgeFunction(b, [{ file: 'z.py', line: 3, text: SINK_MULTI }])
  t('④ 多行框架 sink ⇒ 未判定', sinkC.verdict === 'undetermined')
  t('④b 未判定必须点名站点(只给计数无法清偿)', sinkC.evidence.some((e) => /sink/.test(String(e))))
  t('⑤ 拿到生成器对象却无关停 ⇒ violation', judgeFunction(b, [{ file: 'z.py', line: 1, text: 'it = g()\n    return it\n' }]).verdict === 'violation')
  t('docstring/`__all__`/同名重绑定不得算消费点', judgeFunction(b, [{ file: 'z.py', line: 1, text: 'g = await other()\n__all__ = ["g"]\n' }]).verdict === 'undetermined')
  t('循环之后的同级 return 不算提前退出(语句级,不是行级运气)', judgeFunction(b, [{ file: 'z.py', line: 1, text: 'async for x in g():\n    use(x)\nreturn done\n' }]).verdict === 'passed')
  // 真仓样本:跑在被审面上(不是夹具自证);面取不到 ⇒ 这几条红,不出合格证
  const HR = (() => { try { return auditFace(readFace('head', ROOT, listCandidatesFor('head', ROOT))).rows } catch { return [] } })()
  const at = (f, l) => HR.find((r) => r.file.endsWith(f) && r.line === l)
  t('真仓①: command_streamer:350 穷尽式 async for ⇒ passed', at('command_streamer.py', 350)?.verdict === 'passed')
  t('真仓①b: message_history:163 唯一生产消费是 list(...) ⇒ passed', at('message_history.py', 163)?.verdict === 'passed')
  t('真仓②: openai_provider:93 有提前退出的消费 ⇒ 仍是 violation', at('openai_provider.py', 93)?.verdict === 'violation')
  t('真仓④: agents:652/726/1311 框架 sink ⇒ 未判定且逐条点名', ['652', '726', '1311'].every((v) => { const r = at('routers/agents.py', Number(v)); return !!r && r.verdict === 'undetermined' && r.evidence.some((e) => /sink/.test(String(e))) }))
  t('真仓⑤: rollout_archive:165 仅 docstring/__all__ 命中 ⇒ 未判定,不是 violation', at('rollout_archive.py', 165)?.verdict === 'undetermined')
  // 定级与判读
  t('默认档不因存量判红', decide({ counts: { passed: 1, violation: 5, undetermined: 2 }, strict: false, enumerated: true }) === 0)
  t('--strict 下 violation 判红', decide({ counts: { passed: 1, violation: 5, undetermined: 2 }, strict: true, enumerated: true }) === 1)
  t('未判定不改退出码(只点名)', decide({ counts: { passed: 0, violation: 0, undetermined: 7 }, strict: true, enumerated: true }) === 0)
  t('枚举到 0 ⇒ 判死 exit 2', decide({ counts: { passed: 0, violation: 0, undetermined: 0 }, strict: false, enumerated: false }) === 2)
  const pass = results.filter((r) => r.ok).length
  for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : ` (实得:${r.got})`}`)
  console.log(`自检:${pass}/${results.length} 通过`)
  process.exit(pass === results.length ? 0 : 1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  maskPythonNoise, maskForJudgement, scanPythonFile, scanTsFile, isTestPath,
  judgeFunction, findConsumers, consumerOutcome, classifySites, auditFace,
  blockWindow, statementGroups, statementStart, tryFinallyWraps, decide,
  RESOURCE_RES, CLOSE_RES,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
