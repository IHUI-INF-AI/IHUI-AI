#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 截断语义的边界对账 + 同一论证的第二份真相(G-815983)。
 *
 * 立因(上游实测,本仓同型):多层各自 clamp 时,**取 limit+1 的那条探测行会被中间层剪掉**,
 * 于是判据看到的永远是"整好 limit 条" ⇒ `truncated` 在恰好 limit 处**永久缺席** ——
 * 账面写"没有更多了"而其实还有,分页永不收敛。它没有编译期症状:typecheck / lint / 单测全绿,
 * 只有翻页翻到第二页什么也没多出来的人才知道,而那个人不会去查 git。
 *
 * 四条判据(口径同 70/77/83/98/101/103/118):
 *  - **HB 语义唯一落点**:分页判据的档名表(`export type HasMoreRule`)在被审面必须**恰有一处**声明。
 *      0 处 ⇒ 判死(档名表被摘线 = 尺子对它立项要防的那一型完全失明,不得读成"没有违规");
 *      ≥2 处 ⇒ 红(同一论证的第二份真相)。
 *  - **TB 恒 false 那一型**:同一文件里,截断标志由 `PAGE.length > LIMIT` 给出,而 PAGE 的取数
 *      上限**恰为 LIMIT**(无 `LIMIT + 1` 探针)⇒ 该标志**结构上永不成立** ⇒ 红。
 *      这正是"truncated 在恰好 limit 时永久缺席"的机器形态。
 *  - **两种实现并存但必须各自可见**(票面要求"把两种实现的差别用测试固定住"):
 *      `probe-backed`(取 limit+1、判 `> limit`)在边界处回 **false** —— 那是"确实没有更多"的正当结论;
 *      `page-full`(判 `>= limit` / `=== limit`)在边界处回 **true** —— 保守档,拿不到总数时只能看填满。
 *      两档都放过、分别计数并点名;合并/换档属对外契约决策(改一边就改一边用户的分页),不属本门。
 *  - **TA 论证的第二份真相**:同一段"limit/截断"论证的**措辞**归一后出现在 ≥2 个文件 ⇒ 红
 *      (要求提到一处;唯一落点就是 HB 找到的那一份)。水印横幅行不参与,否则每个文件都一样。
 *
 * 三态绝不并桶:取数关系解析不到 / 面旗矛盾 / 内容取不到 ⇒ **未判定**并逐条点名,
 * 既不冒红也不记绿;`--strict` 下有未判定即 exit 2(拒绝出具合格证)。
 * 全量档(HEAD)的红**只报数**,提交链档(--staged)按"该文件 HEAD 自身存量"差值棘轮只拦新增 ——
 * 与本次提交无关的恒红门只会逼人 `--no-verify`,连带废掉链上全部守门(§12e)。
 *
 * 已知射程边界(如实登记,不得读成"已确认没有"):
 *  - 只判 JS/TS 系(.ts/.tsx/.js/.jsx/.mjs/.mts/.cjs);**Python 侧未纳入射程** ——
 *    `apps/ai-service/**` 的截断判定是另一套语法(`len(x) > limit` + 生成器分块),
 *    照抄本判据必然空转,归该侧持有人另计一票。
 *  - 取数与判定的绑定只在**同文件**内做(跨文件把集合传来传去 ⇒ 落未判定,不猜)。
 *
 * 手动: `node scripts/check-truncation-boundary.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * **尚未接线**(不在 `scripts/guardian-runner.mjs`,也不在 pre-commit 链)—— 接线与定级由主会话单写者裁。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsAndStrings, maskComments } from './lib/code-mask.mjs'
import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined, FACE_LABEL } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_TRUNCATION_BOUNDARY'
const GIT_TIMEOUT = 120000
const SCAN_DIRS = ['apps', 'packages', 'sdks']
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|mts)$/
const EXCLUDE =
  /(\.test\.|\.spec\.|__tests__|[/\\]tests[/\\]|[/\\]e2e[/\\]|node_modules|[/\\]dist[/\\]|[/\\]build[/\\]|\.gen\.|\.d\.ts|[/\\]\.next[/\\])/

/** 语义唯一落点的锚:**档名表本身**,不是任何一份散文。清单靠内容推导,不写死文件名。 */
const HOME_RE = /\bexport\s+type\s+HasMoreRule\b/g
/** 截断标志的词汇(响应键 / 变量名两形都认)。 */
const FLAG_NAME_RE = /(truncated|has_?more|hasMore|truncat(ing)?$|more$|hasNext|has_next)/i
/** 比较表达式:`LHS OP RHS`,两侧任一带 `.length` 即算一条判定。 */
const CMP_RE = /([A-Za-z0-9_.$[\]]+?)\s*(<=|>=|===|!==|<|>)\s*([A-Za-z0-9_.$[\]+ -]+?)(?=[,;)\n}])/g
/**
 * 取数上限的书写:`.slice(a, b)` / `.limit(n)`。
 * 刻意**先取整段实参再解析** —— 用一条正则同时抓"变量名"和"`+ 1` 探针"会退化成
 * `[^,)]*` 回溯把 `1` 当成变量名(本门初版就栽在这里:探针在位的站点被读成恒 false)。
 */
const CALL_RE = /\.(?:slice|limit)\(\s*([^)]*)\)/g

/**
 * 一条赋值的右值最多读多少字符。本仓 drizzle 链带 `.select({ … })` 多行对象,
 * 120 字符会在探针之前断掉(实测 chat-queries 的 4 处 limit+1 全部读不到 ⇒ 整型落未判定);
 * 上限只是**性能护栏**,超上限一律落未判定并点名,不得当成"没有这种形状"。
 */
const RHS_CAP = 1200

/** 从实参文本里量出 { limitVar, probe }:最后一个标识符是限流变量;出现 `+ 1` 就是探针。 */export function clampInfo(argsText) {
  const probe = /\+\s*1\b/.test(argsText)
  const ids = argsText.match(/[A-Za-z_][A-Za-z0-9_.]*/g) || []
  const nums = argsText.match(/\b\d+(?:\.\d+)?\b/g) || []
  const limitVar = ids.length ? ids[ids.length - 1] : nums.length ? nums[nums.length - 1] : null
  return { limitVar, probe }
}

/** TA 用的论证块词表:必须**同时**命中"边界/上限"与"截断"两族才进射程(票面口径是"同一 limit 论证")。 */
const ARG_LIMIT_TOKEN = /(limit|上限|天花板|探针|page[- ]?full|has[-_]?more|截[^新]|clamp)/i
const ARG_TRUNC_TOKEN = /(truncat|截断|has[-_]?more|next[-_]?cursor|分页|翻页)/i
const ARG_MIN_CHARS = 40
/** 水印横幅与版权行每个文件都有,不参与论证比对(否则 TA 恒红)。 */
const BANNER_RE = /(IHUI AI|Provenance-watermarked|IHUI-AI-PROVENANCE|版权所有)/

/* ------------------------------------------------------------------ 边界语义(纯判据) */

/**
 * 一条截断判定在三个边界值上**是否会报截断**。这是票面要求的三态口径本体:
 * 源集合分别有 `limit-1 / limit / limit+1` 条时,判据看到的是几行、标志是否成立。
 *  - `probePresent`(取数留了 `limit+1` 探针):看到的行数 = min(k, limit+1);
 *  - 无探针(中间层已 clamp 到 limit):看到的行数 = min(k, limit) —— 第 limit+1 行**永远看不见**。
 * 两种实现只差在"恰好 limit"那一格会不会报,把它写死成一张表,合并/换档就必须留下证据。
 */
export function boundaryVerdicts({ operator, probePresent }) {
  const limit = 2
  const cap = probePresent ? limit + 1 : limit
  const cmp = (a, b) => {
    switch (operator) {
      case '>':
        return a > b
      case '>=':
        return a >= b
      case '===':
        return a === b
      case '<':
        return a < b
      case '<=':
        return a <= b
      default:
        return null
    }
  }
  const at = (k) => {
    const v = cmp(Math.min(k, cap), limit)
    return v === null ? null : v
  }
  return { minus1: at(limit - 1), atLimit: at(limit), plus1: at(limit + 1) }
}

/**
 * 取一条赋值的右值文本:跨行的链式调用也要读完(drizzle 的
 * `const rows = await db.select()…\n  .limit(limit + 1)` 是本仓分页的主流写法,
 * 只取单行会让**探针在位**这一整型隐身,而隐身表现为"未判定 45 条"这种既不像失明
 * 也不像违规的中间态 —— 门看得见多少,就必须真看多少。
 * 断点:分号 / 下一行首个非空白字符不是 `.`、`?`、`)`、`:`。上限 500 字符(护栏,超上限落未判定)。
 */
export function statementRhs(view, eqIdx) {
  let out = ''
  let depth = 0
  for (let i = eqIdx + 1; i < view.length && out.length < RHS_CAP; i++) {
    const c = view[i]
    if (c === '(' || c === '{' || c === '[') depth++
    else if (c === ')' || c === '}' || c === ']') depth = Math.max(0, depth - 1)
    if (c === ';' && depth === 0) break
    if (c === '\n' && depth === 0) {
      let j = i + 1
      while (j < view.length && (view[j] === ' ' || view[j] === '\t' || view[j] === '\r')) j++
      const nx = view[j]
      if (nx !== '.' && nx !== '?' && nx !== ')' && nx !== ':') break
      out += ' '
      i = j - 1
      continue
    }
    out += c
  }
  return out
}

/**
 * TB 的核心裁决(纯函数,构造面可证):
 *  - 判定读的是**被 clamp 到 LIMIT 的那一份**(operand 就是页变量)、算子是 `>`、
 *    而**比较的另一侧就是那个限流变量本身**且没留探针
 *      ⇒ `neverFires` —— 标志结构恒 false,截断在恰好 limit(及以上)永久缺席 ⇒ **红**;
 *  - 比较的另一侧是**另一个量**(如服务端给的总条数 `knownTotal > list.length`)
 *      ⇒ `totalCountScoped` —— 这是不需要探针的正解(确数比页长大就是截了),放过并计数;
 *  - 算子 `>=` / `===` ⇒ `pageFull` —— 边界处会报(保守档);
 *  - 取数留了 `LIMIT + 1` 探针 ⇒ `probeBacked` —— 边界处回 false 是"确实没有更多"的正当结论;
 *  - 其余 ⇒ `undetermined`(不冒红也不记绿)。
 * `limitVarMatches` 是本判据的牙齿所在:少了它,`确数 > 页长` 会被当成"恒 false"误红
 * (本门第一次跑真仓就是这样撞上 `packages/types/src/api-contracts.ts` 的 projectBoundedList,
 *  假阳的代价是让人去"修"一个本来就对的实现,并把口径说歪成"问题很多")。
 */
export function classifyDecision({ operandClamped, probePresent, operator, readsPageOperand, limitVarMatches = true }) {
  if (!readsPageOperand) return 'sourceScoped'
  if (probePresent) return 'probeBacked'
  if (!operandClamped) return 'undetermined'
  if (operator === '>') return limitVarMatches ? 'neverFires' : 'totalCountScoped'
  if (operator === '>=' || operator === '===') return limitVarMatches ? 'pageFull' : 'totalCountScoped'
  return 'undetermined'
}

/* ------------------------------------------------------------------ 单文件扫描 */

/**
 * 判定所属的**标志名**:先回到本条语句的起点(`;` / `{` / `}` / `=>` 之后),
 * 再看这条语句的头部是不是"把值交给某个名字"——
 * `const truncated = …`、`{ truncated: … }`、`hasMore = …` 都算,
 * 而 `if (x.length > limit)` 这种没有归属名字的比较**不算**(它不是截断标志)。
 * 刻意不用"上下文窗口里出现过截断词汇"这种模糊判据:那会把同文件别处的 `more`
 * 也算成证据(假阳指使人去修本来就对的代码),同时也会漏掉真正的标志名。
 * 复合条件(`truncated = total !== undefined && total > list.length`)必须仍然认得出 ——
 * 比较式在 `&&` 之后,语句起点仍在很前面。
 */
export function flagTarget(view, cmpIdx) {
  let start = 0
  for (let i = cmpIdx - 1; i >= 0 && i > cmpIdx - 240; i--) {
    const c = view[i]
    if (c === ';' || c === '{' || c === '}' || c === '\n') {
      start = i + 1
      break
    }
  }
  const head = view.slice(start, cmpIdx).replace(/^\s+/, '')
  const decl = head.match(/^(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=]{0,60})?=\s*/)
  if (decl) return decl[1]
  const assign = head.match(/^([A-Za-z0-9_$]+)\s*=(?!=)\s*/)
  if (assign) return assign[1]
  const key = head.match(/^([A-Za-z0-9_$]+)\s*:\s*/)
  if (key) return key[1]
  return ''
}

/** 截断标志的词汇(只作用在 flagTarget 取出的那一个名字上)。 */
export function isTruncationFlag(name) {
  if (!name) return false
  return /(truncat|has[-_]?more|hasmore|more$|omitted$|dropped$|has[-_]?next|next[-_]?cursor)/i.test(name)
}

/** 归一注释块文本(去空白、去注释符、小写);水印横幅行整体跳过。 */
export function argumentBlocks(code) {
  const out = []
  const lines = code.split(/\r?\n/)
  let cur = []
  let startLine = 0
  const flush = (endLine) => {
    if (cur.length) {
      // 注释符号(/* // * 与收尾的 */)一律剥掉再比 —— 否则块注释与行注释两条同义措辞
      // 会因为多出一个 `/` 而配不上,门就对自己立项那一型失明。
      const text = cur.join('').replace(/[*/]/g, '').replace(/\s+/g, '').toLowerCase()
      if (text.length >= ARG_MIN_CHARS && ARG_LIMIT_TOKEN.test(text) && ARG_TRUNC_TOKEN.test(text)) {
        out.push({ norm: text, line: startLine })
      }
    }
    cur = []
  }
  lines.forEach((raw, i) => {
    const l = raw.trim()
    const isComment = l.startsWith('//') || l.startsWith('*') || l.startsWith('/*') || l.startsWith(' *')
    if (BANNER_RE.test(l)) {
      flush(i)
      return
    }
    if (isComment) {
      if (!cur.length) startLine = i + 1
      cur.push(l.replace(/^\/\/?/, '').replace(/^\/?\*+/, '').replace(/-\s*$/, ''))
    } else flush(i)
  })
  flush(lines.length)
  return out
}

/**
 * 单文件判据(纯函数):返回 { home, decisions, blocks, note }。
 * decisions 逐条带 verdict;取不到取数关系的落 undetermined。
 */
export function scanFile(code) {
  const codeFace = maskCommentsAndStrings(code)
  const home = [...codeFace.matchAll(HOME_RE)].length
  const blocks = argumentBlocks(code)

  const clamps = []
  for (const m of codeFace.matchAll(CALL_RE)) {
    const info = clampInfo(m[1])
    clamps.push({ limitVar: info.limitVar, probe: info.probe, idx: m.index })
  }
  // 变量 → 被 clamp 的形状:`const data = items.slice(start, start + limit)`,跨行链式同样吃。
  // **按名字存成一份列表**:同一个名字在一个文件里常被多个分支各自赋值(chat-queries 的
  // `rows` 就有四处),取"判定之前最近的那一次"才近似作用域;只留最后一份会把探针在位的站点
  // 读成"另一条没探针的赋值"(本门第一次跑真仓就把 3 处 limit+1 误归到 totalCountScoped)。
  const pageVars = new Map()
  for (const m of codeFace.matchAll(/(?:const|let)\s+([A-Za-z0-9_]+)\s*(?::[^=]{0,40})?=\s*/g)) {
    const rhs = statementRhs(codeFace, m.index + m[0].length - 1)
    const hits = [...rhs.matchAll(CALL_RE)]
    if (!hits.length) continue
    const last = clampInfo(hits[hits.length - 1][1])
    const list = pageVars.get(m[1]) || []
    list.push({
      limitVar: last.limitVar,
      probe: hits.some((h) => clampInfo(h[1]).probe),
      // `.limit(n)`(SQL 侧封顶)与 `.slice(0, n)`(消费侧裁尾)**都算夹过**:
      // 区分"恒 false"与"探针在位"的是有没有 +1,不是夹在哪一层。
      clamped: hits.length > 0,
      idx: m.index,
    })
    pageVars.set(m[1], list)
  }
  /** 取"判定之前最近的一次赋值"作为该变量的取数形状。 */
  const nearestPageVar = (name, beforeIdx) => {
    const list = pageVars.get(name)
    if (!list || !list.length) return undefined
    let best
    for (const p of list) {
      if (p.idx >= beforeIdx) continue
      if (!best || p.idx > best.idx) best = p
    }
    return best
  }

  const decisions = []
  for (const m of codeFace.matchAll(CMP_RE)) {
    const left = m[1]
    const right = m[3]
    const pageSide = left.endsWith('.length') ? left : right.endsWith('.length') ? right : null
    if (!pageSide) continue
    const operand = pageSide.replace(/\.length$/, '')
    const other = pageSide === left ? right : left
    const op = m[2]
    // 标志名要落在截断词汇里,否则那是普通分支条件(不属本型)
    const flag = flagTarget(codeFace, m.index)
    if (!isTruncationFlag(flag)) continue
    const pv = nearestPageVar(operand, m.index)
    const limitVar = (other || '').trim().split(/[ +]/)[0]
    const verdict = pv
      ? classifyDecision({
          operandClamped: Boolean(pv.clamped),
          probePresent: pv.probe,
          operator: op,
          readsPageOperand: true,
          // 比较的另一侧就是 clamp 用的那个限流变量(或同一个数字上限)⇒ 才是"恒 false"那一型
          limitVarMatches: pv.limitVar === limitVar,
        })
      : otherIncludesLimitVar(limitVar, clamps, m.index, operand)
    decisions.push({ line: lineOf(codeFace, m.index), operand, operator: op, verdict, expr: m[0].trim().slice(0, 90) })
  }
  return { home, decisions, blocks }
}

/**
 * 页面变量解析不到时的第二条路:被比较的那一侧本身是不是一个**已知 clamp 的限流变量名**
 * (如 `rows` 直接来自 `.limit(limit + 1)` 的调用结果而未落 const)。
 * 判不出就落 undetermined —— "看不见"与"没违规"在账面上必须不同形。
 */
function otherIncludesLimitVar(limitVar, clamps, idx, operand) {
  void operand
  const near = clamps.filter((c) => Math.abs(c.idx - idx) < 900)
  if (!near.length) return 'undetermined'
  // 邻近确有按同一限流变量的 clamp,而比较读的那一侧**不是**被 clamp 的页变量 ⇒ beyond-page 档
  return near.some((c) => c.limitVar === limitVar) ? 'sourceScoped' : 'undetermined'
}

function lineOf(view, idx) {
  let line = 1
  for (let i = 0; i < idx && i < view.length; i++) if (view[i] === '\n') line++
  return line
}

/* ------------------------------------------------------------------ 汇总判定 */

/**
 * 纯汇总(镜像测试主战场):把逐文件结果合成三态。
 * `anchors` = 同一批文件在**锚点面(HEAD)**的存量:`{ tb: Map<file, 恒false站点数>, norms: Map<file, Set<论证归一文本>> }`。
 * 返回 { reds, undetermined, counts } —— reds 分 HB / TB / TA 三类,各自点名。
 */
export function aggregate(perFile, { anchors = { tb: new Map(), norms: new Map(), unreadable: new Set() }, strict = false, stagedMode = false } = {}) {
  const tbCount = (f) => anchors.tb.get(f) || 0
  const anchorsNorms = anchors.norms
  const reds = []
  const undetermined = []
  const counts = { files: perFile.size, homes: 0, probeBacked: 0, pageFull: 0, sourceScoped: 0, totalCountScoped: 0, neverFires: 0 }

  // HB:档名表的声明处
  const homes = []
  for (const [file, r] of perFile) if (r.home > 0) homes.push({ file, n: r.home })
  counts.homes = homes.length
  if (homes.length === 0) undetermined.push('HB 判死:被审面找不到 `export type HasMoreRule` 的声明 —— 语义唯一落点不在这一面(空扫不记绿)')
  else if (homes.length > 1) reds.push({ kind: 'HB', where: homes.map((h) => `${h.file}(×${h.n})`), why: '分页判据的档名表出现第二份声明 ⇒ 两份必漂移,提到一处' })

  // TB + 计数
  for (const [file, r] of perFile) {
    for (const d of r.decisions) {
      if (d.verdict === 'neverFires') {
        if (stagedMode && !strict && anchors.unreadable && anchors.unreadable.has(file)) {
          undetermined.push(`TB 未判定:${file}:${d.line} —— 锚点面(HEAD)取不到该文件,存量无从对账,既不冒红也不记绿`)
          continue
        }
        const anchor = tbCount(file)
        if (stagedMode && !strict && anchor > 0) {
          counts.legacyKept = (counts.legacyKept || 0) + 1
          continue
        }
        counts.neverFires++
        reds.push({
          kind: 'TB',
          where: [`${file}:${d.line}`],
          why: `截断标志由被 clamp 到 limit 的那一份集合按 "${d.expr}" 判定 ⇒ 结构恒 false:truncated 在恰好 limit 处缺席,且在哪儿都不报 —— 取数侧留 limit+1 探针,或改由源集合判`,
        })
      } else if (d.verdict === 'probeBacked') counts.probeBacked++
      else if (d.verdict === 'pageFull') counts.pageFull++
      else if (d.verdict === 'sourceScoped') counts.sourceScoped++
      else if (d.verdict === 'totalCountScoped') counts.totalCountScoped++
      else undetermined.push(`TB 未判定:${file}:${d.line} —— 取数上限与判定读的是哪个集合解析不到("${d.expr}")`)
    }
  }

  // TA:论证措辞的跨文件重复
  const byText = new Map()
  for (const [file, r] of perFile) for (const b of r.blocks) {
    if (!byText.has(b.norm)) byText.set(b.norm, [])
    byText.get(b.norm).push({ file, line: b.line })
  }
  for (const [norm, sites] of byText) {
    const files = [...new Set(sites.map((s) => s.file))]
    if (files.length < 2) continue
    // 存量判据:该措辞在 HEAD 面**每个涉及文件里都已出现过** ⇒ 本次没把它扩大 ⇒ 只报数。
    // 只要有一个文件是这次带上台的(HEAD 那份没有这段),就是"论证的第二份真相"被新增。
    const sets = files.map((f) => anchorsNorms.get(f))
    if (stagedMode && sets.some((s) => !s)) {
      undetermined.push(`TA 未判定:${norm.slice(0, 40)}… 的锚点面(HEAD)取不到其中 ${sets.filter((s) => !s).length} 个文件 —— 存量无从对账,既不冒红也不记绿`)
      continue
    }
    const allLegacy = files.every((f, i) => (stagedMode ? sets[i].has(norm) : false))
    if (stagedMode && !strict && allLegacy) {
      counts.legacyKept = (counts.legacyKept || 0) + 1
      continue
    }
    reds.push({
      kind: 'TA',
      where: sites.map((s) => `${s.file}:${s.line}`),
      why: `同一段 limit/截断论证的措辞在 ${files.length} 个文件各写一遍 ⇒ 提到一处(唯一落点=${(homes[0] && homes[0].file) || '档名表所在文件'}),其余处引用而不是复述`,
    })
  }
  return { reds, undetermined, counts }
}

/** 退出码三态:全量档红只报数;--staged 拦新增;--strict 逐格问责且有未判定 ⇒ 2。 */
export function decideExit({ reds, undetermined, strict, mode }) {
  if (strict && undetermined.length) return 2
  const judging = mode === 'staged' || strict
  if (judging && reds.length) return 1
  return 0
}

/* ------------------------------------------------------------------ 取材 */

export function isSourcePath(p) {
  const n = p.replace(/\\/g, '/')
  return SRC_EXT.test(n) && !EXCLUDE.test(n) && SCAN_DIRS.some((d) => n.startsWith(d + '/'))
}

/** 清单与内容**同面同轮**:head=ls-tree、staged=索引全量 ls-files、worktree=ls-files + 磁盘读。 */
export function listFace(root, face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z', '--', ...SCAN_DIRS], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(isSourcePath)
  return gitRaw(['ls-files', '-z', '--', ...SCAN_DIRS], root, { timeout: GIT_TIMEOUT }).split('\0').filter(isSourcePath)
}

export function changedInIndex(root) {
  return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--', ...SCAN_DIRS], root, { timeout: GIT_TIMEOUT })
    .split('\0')
    .filter(isSourcePath)
}

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

export function analyze(root, face, opts = {}) {
  const all = listFace(root, face)
  if (all.length === 0) throw new Undetermined(`${FACE_LABEL[face]}: 枚举到 0 个受审源文件 —— 空扫不记绿`)
  const focus = face === 'staged' && !opts.fullFace ? changedInIndex(root) : []
  const effectiveMode = face === 'staged' && !opts.fullFace && focus.length === 0 ? 'full' : face
  // HB/TA 是**跨文件**判据:必须有全局面;TB 在提交链档只看本次改动过的文件(其余是别人的在飞现场)。
  const targetPaths = effectiveMode === 'staged' ? [...new Set([...focus, ...all.filter((p) => false)])] : all
  const sources = readFace(root, face === 'staged' && effectiveMode === 'staged' ? 'staged' : face, targetPaths)
  const perFile = new Map()
  const undetermined = []
  for (const [file, code] of sources) {
    if (code === null) {
      undetermined.push(`${file}(内容取不到,不回落另一个面)`)
      continue
    }
    perFile.set(file, scanFile(code))
  }
  // 锚点面:同一批文件在 HEAD 自身的 TB 站点数 / 论证文本集(差值棘轮只拦新增)。
  const anchors = { tb: new Map(), norms: new Map(), unreadable: new Set() }
  if (effectiveMode === 'staged') {
    const anchorPaths = [...new Set(targetPaths)]
    const headSources = readFace(root, 'head', anchorPaths)
    for (const [f, c] of headSources) {
      if (c === null) {
        anchors.unreadable.add(f) // 锚点面取不到 ⇒ 该文件的存量无从对账(不冒红也不记绿,见 aggregate)
        continue
      }
      const r = scanFile(c)
      anchors.tb.set(f, r.decisions.filter((d) => d.verdict === 'neverFires').length)
      anchors.norms.set(f, new Set(r.blocks.map((b) => b.norm)))
    }
  }
  const agg = aggregate(perFile, { anchors, strict: !!opts.strict, stagedMode: effectiveMode === 'staged' })
  agg.undetermined.push(...undetermined)
  agg.face = face
  agg.mode = effectiveMode
  agg.filesRequested = targetPaths.length
  return agg
}

/* ------------------------------------------------------------------ 输出 */

function render(res) {
  const lines = []
  lines.push(
    `判定面=${FACE_LABEL[res.face]}(mode=${res.mode})· 审 ${res.filesRequested} 文件 · 档名表声明处 ${res.counts.homes}`,
  )
  lines.push(
    `  截断判定分布:探针在位(probe-backed)${res.counts.probeBacked} · 填满即报(page-full)${res.counts.pageFull} · 按源集合判 ${res.counts.sourceScoped} · 确数对照(total > 页长,正解)${res.counts.totalCountScoped} · 恒 false ${res.counts.neverFires} · 棘轮放过存量 ${res.counts.legacyKept || 0}`,
  )
  if (res.reds.length) {
    const judging = res.mode === 'staged'
    lines.push(`  ${judging ? '❌ 判红' : '⚠️ 红(全量档只报数;问责跑 --strict)'} ${res.reds.length} 条:`)
    for (const r of res.reds) lines.push(`    [${r.kind}] ${r.where.join(' , ')}\n        ${r.why}`)
  }
  if (res.undetermined.length) {
    lines.push(`  ⚠️ 未判定 ${res.undetermined.length} 条(逐条点名,绝不静默成"看起来全绿"):`)
    for (const u of res.undetermined.slice(0, 30)) lines.push(`    · ${u}`)
    if (res.undetermined.length > 30) lines.push(`    · …其余 ${res.undetermined.length - 30} 条(--json 面全量)`)
  }
  if (!res.reds.length && !res.undetermined.length) lines.push('  ✅ 边界处判据可得且论证无第二份')
  lines.push('  射程外(登记,不等于"已确认没有"):Python 侧 ai-service 的截断判定未纳入本判据。')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ 自检(构造面,零副作用) */

function selfTest() {
  let ran = 0
  let fail = 0
  const t = (name, cond) => {
    ran++
    if (typeof cond === 'function') {
      fail++
      console.log(`  ❌ ${name}:cond 是函数 ⇒ 断言从未求值(应写成 (() => {...})())`)
      return
    }
    if (cond !== true) {
      fail++
      console.log(`  ❌ ${name}`)
    } else console.log(`  ✅ ${name}`)
  }

  // TB-1 恒 false 那一型:clamp 到 limit 后判 > limit ⇒ neverFires
  const BAD = [
    'export async function page(rows: Row[], limit: number) {',
    '  const data = rows.slice(0, limit)',
    '  const truncated = data.length > limit',
    '  return { data, truncated }',
    '}',
    '',
  ].join('\n')
  const s1 = scanFile(BAD)
  t('TB-1 clamp 到 limit 后按 > limit 判 ⇒ neverFires(截断标志结构恒 false)', s1.decisions.some((d) => d.verdict === 'neverFires'))

  // TB-2 探针在位:取 limit+1 再判 > limit ⇒ 放过(边界处 false 是正当结论)
  const PROBE = [
    'export async function page(limit: number) {',
    '  const rows = await q.limit(limit + 1).all()',
    '  const hasMore = rows.length > limit',
    '  return rows.slice(0, limit)',
    '}',
    '',
  ].join('\n')
  const s2 = scanFile(PROBE)
  t('TB-2 limit+1 探针在位 ⇒ probeBacked(不得判红)', s2.decisions.length > 0 && s2.decisions.every((d) => d.verdict === 'probeBacked'))

  // TB-3 填满即报:>= limit ⇒ pageFull(边界处会报)
  const FULL = [
    'export function page(rows: Row[], limit: number) {',
    '  const data = rows.slice(0, limit)',
    '  const hasMore = data.length >= limit',
    '  return { data, hasMore }',
    '}',
    '',
  ].join('\n')
  t('TB-3 >= limit ⇒ pageFull 放过', scanFile(FULL).decisions.every((d) => d.verdict === 'pageFull'))

  // TB-4 真形态对照(与 cursor-page.ts 同构):按源集合判 ⇒ 不判红
  const SOURCE = [
    'export type HasMoreRule = ',
    "  | 'beyond-page'",
    "  | 'page-full'",
    '',
    'export function pageOf<T>(items: readonly T[], limit: number): PageOutcome<T> {',
    '  const data = items.slice(0, limit)',
    '  const hasMore = limit < items.length',
    '  return { data, has_more: hasMore } as any',
    '}',
    '',
  ].join('\n')
  const s4 = scanFile(SOURCE)
  t('TB-4 判定读的是源集合(items.length)⇒ 不得算恒 false', !s4.decisions.some((d) => d.verdict === 'neverFires'))

  // TB-5 判不出 ⇒ 未判定,不得读成通过
  const UNKNOWN = ['export function f(rows: Row[], limit: number) {', '  const truncated = rows.length > limit', '  return { rows, truncated }', '}', ''].join('\n')
  const s5 = scanFile(UNKNOWN)
  t('TB-5 取数上限解析不到 ⇒ undetermined(不是"没违规")', s5.decisions.every((d) => d.verdict === 'undetermined'))

  // TB-6 注释里的该形态不计(判据面先遮注释)
  const COMMENTED = ['// const truncated = data.length > limit', 'export const z = 1', ''].join('\n')
  t('TB-6 注释里的判定形态不得计成站点', scanFile(COMMENTED).decisions.length === 0)

  // TB-7 与截断词汇无关的比较不进射程
  const UNRELATED = ['export function f(rows: Row[], limit: number) {', '  const data = rows.slice(0, limit)', '  const empty = data.length === 0', '  return { data, empty }', '}', ''].join('\n')
  t('TB-7 非截断语义的比较(空集判定)不计', scanFile(UNRELATED).decisions.length === 0)

  // MT 跨行链式(drizzle 的本仓主流写法):探针在位必须被看见,否则整型只落"未判定"
  const CHAIN = [
    'export async function page(limit: number) {',
    '  const rows = await db',
    '    .select({ id: t.id })',
    '    .from(t)',
    '    .limit(limit + 1)',
    '  const hasMore = rows.length > limit',
    '  return { rows: rows.slice(0, limit), hasMore }',
    '}',
    '',
  ].join('\n')
  const sm = scanFile(CHAIN)
  t('MT-1 跨行链式取数 + limit+1 ⇒ probeBacked(不得退化成未判定)', sm.decisions.length > 0 && sm.decisions.every((d) => d.verdict === 'probeBacked'))
  const CHAIN_BAD = CHAIN.replace('.limit(limit + 1)', '.limit(limit)')
  t('MT-2 同一形状去掉探针 ⇒ neverFires(判据的牙齿在探针这一维,不是行数)', scanFile(CHAIN_BAD).decisions.some((d) => d.verdict === 'neverFires'))
  t('MT-3 statementRhs 在分号处断,不吃下一条语句', statementRhs('const a = x.limit(n);\nconst b = y.slice(0, m);\n', 9).includes('limit') === true)
  // MT-4 链里嵌多行 select 对象(drizzle 本仓主流写法):深度未归零不得断句,否则探针整型隐身
  const CHAIN_OBJ = [
    'export async function page(limit: number) {',
    '  const rows = await db',
    '    .select({',
    '      id: t.id,',
    '      ord: t.ord,',
    '    })',
    '    .from(t)',
    '    .limit(limit + 1)',
    '  const hasMore = rows.length > limit',
    '  return { hasMore }',
    '}',
    '',
  ].join('\n')
  t('MT-4 多行 select 后的 limit+1 仍读得到 ⇒ probeBacked(不落在未判定)', scanFile(CHAIN_OBJ).decisions.every((d) => d.verdict === 'probeBacked') && scanFile(CHAIN_OBJ).decisions.length > 0)
  t('MT-4b 同形去掉探针 ⇒ neverFires(深度修好了也不能把判据钝化)', scanFile(CHAIN_OBJ.replace('.limit(limit + 1)', '.limit(limit)')).decisions.some((d) => d.verdict === 'neverFires'))
  // MT-5 同名多次赋值:判定必须绑到**它之前最近**的那次取数(chat-queries 的 rows 有四处)
  const SHADOWED = [
    'export async function twoBranches(limit: number) {',
    '  const rows = await db.select().from(t).limit(limit)      // 分支 A:没有探针',
    '  const more = rows.length > limit                          // 这一条按 A 判 ⇒ 恒 false',
    '  const rows2 = await db.select().from(t).limit(limit + 1)  // 分支 B:探针在位',
    '  return { more, rows2 }',
    '}',
    '',
  ].join('\n')
  const sh = scanFile(SHADOWED)
  t('MT-5 判定绑到最近的前序赋值(不拿后面那条的形状替它脱责)', sh.decisions.some((d) => d.verdict === 'neverFires'))
  const SHADOWED2 = [
    'export async function probeFirst(limit: number) {',
    '  const rows = await db.select().from(t).limit(limit + 1)',
    '  const more = rows.length > limit',
    '  const rows2 = await db.select().from(t).limit(limit)',
    '  return { more, rows2 }',
    '}',
    '',
  ].join('\n')
  t('MT-5b 前序是探针 ⇒ probeBacked(顺序反了不得变成红)', scanFile(SHADOWED2).decisions.every((d) => d.verdict === 'probeBacked'))

  // TC 假阳陷阱:比较的另一侧是**另一个量**(服务端总条数),不是限流变量本身 ⇒ 正解,不得判恒 false
  const TOTAL = [
    'export function project(input: { list: readonly unknown[]; total?: number; limit: number }) {',
    '  const list = input.list.slice(0, appliedLimit)',
    '  const knownTotal = input.total',
    '  const truncated = knownTotal !== undefined && knownTotal > list.length',
    '  return { list, truncated }',
    '}',
    '',
  ].join('\n')
  const sTc = scanFile(TOTAL)
  t('TC-1 确数对照(total > 页长)⇒ 不判 neverFires(这是不需要探针的正解)', !sTc.decisions.some((d) => d.verdict === 'neverFires'))
  t('TC-2 且它被归到可数的档里(而不是静默消失)', sTc.decisions.some((d) => d.verdict === 'totalCountScoped'))

  // 边界三值:两种实现的差别必须被固定住(票面要求)
  const probe = boundaryVerdicts({ operator: '>', probePresent: true })
  const clamped = boundaryVerdicts({ operator: '>', probePresent: false })
  const full = boundaryVerdicts({ operator: '>=', probePresent: false })
  t('V-1 探针实现:limit-1 ⇒ false', probe.minus1 === false)
  t('V-2 探针实现:恰好 limit ⇒ false(那一行探针行真的不存在,是正当结论而非缺席)', probe.atLimit === false)
  t('V-3 探针实现:limit+1 ⇒ true', probe.plus1 === true)
  t('V-4 clamp 实现:三个边界全 false ⇒ 这就是"truncated 永久缺席"的机器形态', clamped.minus1 === false && clamped.atLimit === false && clamped.plus1 === false)
  t('V-5 填满即报实现:limit-1 ⇒ false', full.minus1 === false)
  t('V-6 填满即报实现:恰好 limit ⇒ true(保守档在边界处会报)', full.atLimit === true)
  t('V-7 两档在恰好 limit 处结论相反 ⇒ 判据必须让它们各自可见而非合并成一个数', probe.atLimit !== full.atLimit)

  // HB:档名表 0 / 1 / 2 处
  const oneHome = new Map([['a.ts', { home: 1, decisions: [], blocks: [] }], ['b.ts', { home: 0, decisions: [], blocks: [] }]])
  const twoHomes = new Map([['a.ts', { home: 1, decisions: [], blocks: [] }], ['b.ts', { home: 1, decisions: [], blocks: [] }]])
  const noHome = new Map([['b.ts', { home: 0, decisions: [], blocks: [] }]])
  t('HB-1 恰一处声明 ⇒ 不判死也不判红', aggregate(oneHome, {}).counts.homes === 1 && aggregate(oneHome, {}).reds.length === 0)
  t('HB-2 两处声明 ⇒ HB 红(同义表第二份)', aggregate(twoHomes, {}).reds.some((r) => r.kind === 'HB'))
  t('HB-3 找不到声明 ⇒ 判死走未判定,不得记绿', aggregate(noHome, {}).reds.length === 0 && aggregate(noHome, {}).undetermined.some((u) => u.startsWith('HB 判死')))

  // TA:论证措辞的第二份
  const A1 = ['/**', ' * 别在这里加自己的天花板:取数已经多要了一条做探针,', ' * 中间层再 clamp 一次就把探针剪掉,truncated 在恰好 limit 时永久缺席。', ' */', 'export const x = 1', ''].join('\n')
  const A2 = ['// 别在这里加自己的天花板:取数已经多要了一条做探针,', '// 中间层再 clamp 一次就把探针剪掉,truncated 在恰好 limit 时永久缺席。', 'export const y = 2', ''].join('\n')
  const tas = new Map([['p.ts', scanFile(A1)], ['q.ts', scanFile(A2)]])
  const taAgg = aggregate(tas, {})
  t('TA-1 同一段论证出现在第二个文件 ⇒ 红并点名两处', taAgg.reds.filter((r) => r.kind === 'TA').length === 1 && taAgg.reds.find((r) => r.kind === 'TA').where.length === 2)
  const single = new Map([['p.ts', scanFile(A1)], ['q.ts', scanFile('export const y = 2\n')]])
  t('TA-2 只有一份论证 ⇒ 不判红(提到一处即合规)', aggregate(single, {}).reds.length === 0)
  const banner = new Map([
    ['p.ts', scanFile('// © 2026 IHUI AI · truncated 在恰好 limit 时永久缺席,别在这里加自己的天花板和上限限制')],
    ['q.ts', scanFile('// © 2026 IHUI AI · truncated 在恰好 limit 时永久缺席,别在这里加自己的天花板和上限限制')],
  ])
  t('TA-3 水印横幅/版权行不参与论证比对(否则每个文件都一样 = 恒红门)', aggregate(banner, {}).reds.length === 0)
  t('TA-4 只谈截断不提 limit(或反之)的注释不进射程', argumentBlocks('// 这里只是把日志截断显示,与分页无关\n').length === 0)

  // 棘轮:提交链档放过 HEAD 已有存量,但 --strict 仍问责
  const badMap = new Map([['a.ts', scanFile(BAD)]])
  const normOfBad = scanFile(BAD).blocks
  void normOfBad
  const noAnchor = aggregate(badMap, { stagedMode: true })
  const withAnchor = aggregate(badMap, { stagedMode: true, anchors: { tb: new Map([['a.ts', 1]]), norms: new Map([['a.ts', new Set()]]) } })
  const strictAnchor = aggregate(badMap, { stagedMode: true, strict: true, anchors: { tb: new Map([['a.ts', 1]]), norms: new Map([['a.ts', new Set()]]) } })
  const brokenAnchor = aggregate(badMap, { stagedMode: true, anchors: { tb: new Map(), norms: new Map([['a.ts', new Set()]]), unreadable: new Set(['a.ts']) } })
  t('RJ-0 锚点面整体缺席(非 staged)⇒ 不因棘轮而免检', aggregate(badMap, {}).reds.some((r) => r.kind === 'TB'))
  t('RJ-1 无锚点(本次新增)⇒ 提交链档判红', noAnchor.reds.some((r) => r.kind === 'TB'))
  t('RJ-2 锚点在位(HEAD 已有)⇒ 存量只报数,不变成人人跳门(§12e)', withAnchor.reds.filter((r) => r.kind === 'TB').length === 0 && withAnchor.counts.legacyKept === 1)
  t('RJ-3 --strict 下存量照样点名(问责档不被棘轮钝化)', strictAnchor.reds.some((r) => r.kind === 'TB'))
  t('RJ-4 锚点取不到 ⇒ TA/TB 落未判定并点名,不得读成通过', brokenAnchor.undetermined.some((u) => u.includes('锚点面')) && !brokenAnchor.reds.some((r) => r.kind === 'TB'))

  // 退出码三态
  t('EX-1 全量档红只报数 ⇒ 0', decideExit({ reds: [{ kind: 'TB' }], undetermined: [], strict: false, mode: 'head' }) === 0)
  t('EX-2 提交链档有红 ⇒ 1', decideExit({ reds: [{ kind: 'TB' }], undetermined: [], strict: false, mode: 'staged' }) === 1)
  t('EX-3 --strict 有未判定 ⇒ 2 拒绝出合格证', decideExit({ reds: [], undetermined: ['u'], strict: true, mode: 'head' }) === 2)
  t('EX-4 默认档有未判定 ⇒ 0 但必须打印(render 逐条报名)', decideExit({ reds: [], undetermined: ['u'], strict: false, mode: 'staged' }) === 0 && render({ reds: [], undetermined: ['u'], counts: { homes: 1, probeBacked: 0, pageFull: 0, sourceScoped: 0, neverFires: 0 }, mode: 'staged', face: 'staged', filesRequested: 1 }).includes('未判定 1 条'))

  console.log(`\n自检:${ran - fail}/${ran} 通过${fail ? ` — 失败 ${fail} 条` : ''}`)
  return fail === 0 ? 0 : 1
}

/* ------------------------------------------------------------------ CLI */

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest())
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  if (staged && worktree) {
    console.log('❌ --staged 与 --worktree 不得同用(两个判定面互斥)')
    process.exit(2)
  }
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const fullFace = argv.includes('--full-face')
  const sel = selectFace({ staged, worktree, def: 'head' })
  if (sel.error) {
    console.log(`❌ ${sel.error}`)
    process.exit(2)
  }
  let res
  try {
    res = analyze(ROOT, sel.face, { strict, fullFace })
  } catch (e) {
    if (e instanceof Undetermined) {
      console.log(`❌ 无法判定:${e.message}`)
      process.exit(2)
    }
    throw e
  }
  const rc = decideExit({ reds: res.reds, undetermined: res.undetermined, strict, mode: res.mode })
  if (json) process.stdout.write(JSON.stringify({ ...res, rc, skip: SELF_SKIP }, null, 2) + '\n')
  else {
    console.log(render(res))
    if (strict && res.undetermined.length) console.log('  (--strict:有未判定 ⇒ 拒绝出具合格证,exit 2)')
  }
  process.exit(rc)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e && e.message ? e.message : e}\n${e && e.stack ? e.stack : ''}`)
    process.exit(2)
  }
}

export const __test__ = {
  scanFile,
  aggregate,
  analyze,
  argumentBlocks,
  boundaryVerdicts,
  classifyDecision,
  clampInfo,
  statementRhs,
  flagTarget,
  isTruncationFlag,
  decideExit,
  isSourcePath,
  listFace,
  readFace,
  changedInIndex,
  SELF_SKIP,
  SCAN_DIRS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
