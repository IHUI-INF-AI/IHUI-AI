#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-batch-write-count-honesty.mjs — 批量写端点的 affected/deleted 不得由请求侧自算
 *
 * 在修什么(本批实测成因,不是抽象理由):同一批里人肉逐文件找到 8 处"批量写端点把
 * affected/deleted 由请求侧 `.length` 自算"的静默失真(chat.ts 批量、admin-sys/role-routes.ts
 * cancelAll+selectAll、admin-demand-square.ts、admin/_shared.ts registerCrud 批量删、
 * message.ts 批量删、workspace.ts batch-delete/batch-restore)。症状是**改了 0 行与改成功返回完全
 * 同形** —— 不报错、typecheck 全绿、单测不红,只有用户看到"已删除 3 条"而库里一条没动。修法是唯一
 * 出口 `apps/api/src/utils/batch-outcome.ts`(dedupeIds / batchWriteOutcome)+ db 层用
 * `.returning({id})` 回报真实命中集合。**没有尺子,下一批同类端点照样进 HEAD** —— 这正是本仓全部
 * 守门的立项理由。
 *
 * 判据(一条,窄口径,宁漏不误报):在 `apps/api/src/routes/**` 与 `apps/api/src/db/**` 的
 * 跟踪文件里,同一**函数体**内
 *   ① 有一条 `db|tx|trx` 发起的 `.delete(`/`.update(` 链,链上带 `.where(` 且其中出现 `inArray(`;
 *   ② 且该链**之后**有 `.send(success({ … (deleted|affected|restored|removed|count): <点号链>.length … }))`。
 *
 * 四条放过通道(任一成立即不算违规,各有一支正反对照钉住):
 *   E1 链上带 `.returning(` —— 计数来自库确认的返回集;
 *   E1b 计数根标识符可追到库确认的集合(归属预查询 `select … where inArray(…)` / returning 结果,
 *       ≤2 跳)。必须有这一条:唯一出口自己的定义就是"affected 由库确认的集合(… / **归属预查询
 *       命中集**)推出",只看 `.returning(` 会把 `business-card-routes.ts` 那种正确写法判成红。
 *   E2 该文件 import 了 `utils/batch-outcome`(已在唯一出口上);
 *   E3 命中行或其紧邻上一行有行内豁免 `batch-count-exempt: <原因>` —— **必须带非空原因**,裸标记
 *       不算(与门 102/108 同规矩),且必须在注释里(否则把标记写进字符串就能冒充豁免)。
 *
 * 刻意不判的邻近形状(反向锁,不得为消红放宽判据):N1 `success({ deleted: true })` 布尔确认
 * (DELETE 幂等 ack,改它属全 API 语义决策"删不存在的行回 404 还是 deleted:false",不归这道门顺手做)
 * 与 `deleted: ids.length > 0` 这类比较式;N2 `count: rows.length` 读查询计数(函数体内无写链);
 * N3 注释与字符串里的字样 —— 判据跑在"剥注释 + 抹字符串"的代码面上,模块说明符是唯一例外(E2 只能
 * 从字符串里读),所以 import 判据跑在另一档上;两型遮噪方向不同,门 118 头注记过同一条教训,各有用例。
 *
 * 两份"惯例存量"计数(可见性,不是判据 —— **永不影响退出码**):上面那两个"刻意放过"的形状此前只有
 * 注释里的一句"全仓 257 处"撑着,而那句是人肉量的,下次谁扩面/收面账面没人知道它变了多少。现由本门
 * 每次现读数并报数:
 *   V1 `booleanAckSites` / `booleanAckFiles` —— 窄到形态:`.send(<X>success({ … deleted: true … }))`
 *      对象字面量里 **键逐字为 `deleted`、值为布尔字面量 `true`、其后紧跟 `,` 或 `}`**。
 *      因此 `deleted: affected` / `deleted: rows.length` / `deleted: true === x` / `isDeleted: true` /
 *      `restored: true`(别的键族)**一律不混进这一计数**。
 *   V2 `readQueryCountSites` / `readQueryCountFiles` —— N2 那一族,复用同一份 sends 判据而不是另写
 *      正则(两处算同一件事必漂移):键为 `count` 且**函数体内没有任何批量写链**(有链而顺序不成立
 *      的那些已经落在 U1 未判定里,不重复计)。
 *   两型各计各的,**混计就等于没有信息**。口径与违规判据同面同轮,所以 U2(词法未闭合)那一份文件
 *   两份都不计 —— 该文件已在"未判定"清单里逐条点名,不会静默少掉。
 *   **锚点边界(不是漏判,是口径,扩面前先读这句)**:V1 只认 `.send(<X>success({ … deleted: true … }))`
 *   这一个形态。同族但形态不同的一律不进这一数 —— ① 裸 `return { deleted: true }`(legacy-ask /
 *   legacy-exam / zhs-legacy / tenant);② `reply.send({ … deleted: true })` 不走 success 信封的
 *   OpenAI 兼容契约(v1-assistants);③ 代码生成器**模板字符串**里的该字样(gen-table,由遮蔽面排除,
 *   与 V1c 同一把锁);④ SCAN_DIRS 之外的落点(如 `apps/api/src/plugins/ws-chat.ts`)。
 *   上一轮人肉量的"257 处"就是这么来的:它按 `grep "deleted: true"` 数整个 `apps/api/src`,
 *   把这四类全算进去了。要并掉①②④必须**同批改枚举表与判据两半**(§4 圆角那条记过只改一半 ⇒
 *   整块动静默失效而门照报绿),并另立键族;不得只放宽正则把一个数做大。
 *
 * 判不了 / 未判定(如实登记,绝不静默成"看起来全绿"):U1 链在 send 之后 ⇒ 顺序不成立,计入未判定
 * 并点名;U2 词法状态到文件末尾没闭合(疑正则字面量吞掉引号)⇒ 整份文件结论不可信 ⇒ 未判定,不冒红;
 * U3 写链在 db 层函数里、计数在路由 handler 里(如 workspace.ts 的 batchSoftDelete)⇒ 本门结构上
 * 看不见 —— 这是窄口径的代价,登记为已知空档,不得为覆盖它去猜跨函数归属。
 *
 * 口径纪律(与 36/70/77/83/93/98/101/103/118 同形):全量档判 **HEAD blob**、`--staged` 判**索引
 * blob**、`--worktree` 只作人工逃生舱、两面旗同给 ⇒ exit 2;清单与内容**同面同轮**;任一面取不到
 * ⇒ exit 2 显式"无法判定"且**不回落**另一个面;枚举到 0 个候选文件 ⇒ 判死,不记为通过。
 * **棘轮锚点 = 该文件 HEAD 自身的违规数** —— 只拦"这次改动把计数自算加回来了",存量不当场判红
 * (与改动无关的恒红门唯一结局是逼人 `--no-verify`,一次绕过等于全部守门作废,§12e)。
 * 取材走 `scripts/lib/face-reader.mjs` 的读取入口(catBatch / readWorktreeFile),枚举走 gitRaw
 * (ls-tree / ls-files 不产正文,不算散写读内容)。ROOT 由脚本自身位置推导(§15),`--root <dir>`
 * 是显式测试通道(换根后清单与内容仍同面,故无双根分裂)。
 *
 * 用法:node scripts/check-batch-write-count-honesty.mjs
 *   [--staged|--worktree] [--strict] [--explain] [--json] [--files a,b] [--root <dir>] [--self-test]
 * 退出码:0 = 通过(或全量档只报数);1 = 判红;2 = 无法判定(不冒红也不记绿)。
 * **V1/V2 两份惯例存量计数不参与任何一档退出码**(含 --strict);--explain 会逐条点名它们的 file:line,
 * --json 在 counts 里追加 booleanAckSites/booleanAckFiles/readQueryCountSites/readQueryCountFiles
 * 四个新字段,既有字段名与取值形态逐字不变。
 *
 * 本门**尚未接入提交链**(注册表与活文档由主会话单写,§12),故头注不声称"已接 pre-commit / 第 N
 * 项" —— 守门 89 正判这一型。接入后应急跳过按 HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY=1。
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import {
  Undetermined,
  assertRepoRoot,
  catBatch,
  gitBinary,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..') // ROOT 由脚本自身位置推导(§15,不写死盘符)

export const GATE = 'check-batch-write-count-honesty'
export const SELF_SKIP = 'HUSKY_SKIP_BATCH_WRITE_COUNT_HONESTY'
/** 覆盖面只有这两面(批量写的落点就在这里)。扩面必须同批改"枚举表 + 判据"两半 —— §4 记过同型。 */
export const SCAN_DIRS = ['apps/api/src/routes', 'apps/api/src/db']
export const EXEMPT_TOKEN = 'batch-count-exempt'
export const UNIQUE_OUTLET = 'utils/batch-outcome'
const WRITE_RECEIVERS = new Set(['db', 'tx', 'trx'])
const COUNT_KEYS = 'deleted|affected|restored|removed|count'
const FILE_RE = /\.(ts|mts|cts)$/
const SKIP_RE = /(^|\/)(?:tests?|__tests__|e2e)\//
const SPEC_RE = /(?:from|require\()\s*['"][^'"]*utils\/batch-outcome(?:\.js)?['"]/

/* ------------------------------- 词法遮噪 ------------------------------- */

/**
 * 剥注释(两档都剥);`blankStrings` 档另把字符串/模板字面量的内容与引号抹成空格。
 * 逐字符保位(换行原样),所以"遮蔽后的下标"仍能映射回原始行号 —— 行内豁免要吃原始行,靠这一点。
 * 为什么这一档要抹字符串:被抹掉的 token(inArray(、deleted: x.length)没有一个会合法地出现在
 * 字符串里;反过来保留字符串,一句 OpenAPI 描述就会替门产出一个"从字符串里 harvest 出来的假用量"
 * (守门 93 R6 正是栽在这一格)。唯一反例是 E2 的模块说明符 —— 它必须在字符串里才读得到。
 * 正则字面量按"值位置才是正则"的启发式跳过:不认它,里面的引号会把整份文件读盲
 * (实测真仓 13 个文件因此失明,判据看不见存量却一路报绿)。
 * @returns {{text:string, leaks:string[]}} leaks 非空 ⇒ 状态机没走干净(见 U2)
 */
export function maskText(src, { blankStrings = true } = {}) {
  const n = src.length
  const kill = new Uint8Array(n)
  const K = (i) => {
    if (blankStrings) kill[i] = 1
  }
  const stack = [{ kind: 'root', depth: 0 }]
  const leaks = []
  let lastSig = '' // 上一个有意义的代码字符:判 `/` 是除法还是正则开头
  let word = ''
  let i = 0
  while (i < n) {
    const top = stack[stack.length - 1]
    const c = src[i]
    const d = src[i + 1]
    if (top.kind === 'tpl') {
      if (c === '\\') {
        K(i)
        K(i + 1)
        i += 2
        continue
      }
      if (c === '`') {
        stack.pop()
        K(i)
        lastSig = '`'
        i++
        continue
      }
      if (c === '$' && d === '{') {
        stack.push({ kind: 'interp', depth: 1 })
        K(i)
        K(i + 1)
        i += 2
        continue
      }
      K(i)
      i++
      continue
    }
    if (c === '/' && d === '/') {
      let j = i
      while (j < n && src[j] !== '\n') kill[j++] = 1
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = i
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) kill[j++] = 1
      if (j < n) {
        kill[j] = 1
        kill[j + 1] = 1
        i = j + 2
      } else {
        leaks.push('块注释未闭合')
        i = n
      }
      continue
    }
    // 正则字面量按"值位置才是正则"的启发式跳过:不认它,里面的引号会把整份文件读盲
    // (实测真仓 13 个文件因此失明,判据看不见存量却一路报绿)。
    if (c === '/' && regexMayStartHere(lastSig, word)) {
      const end = scanRegexLiteral(src, i)
      if (end > 0) {
        for (let j = i; j < end; j++) K(j)
        lastSig = '/'
        i = end
        continue
      }
    }
    if (c === "'" || c === '"') {
      let j = i + 1
      let closed = false
      while (j < n) {
        if (src[j] === '\\') {
          K(j)
          K(j + 1)
          j += 2
          continue
        }
        if (src[j] === '\n') break
        if (src[j] === c) {
          closed = true
          break
        }
        K(j)
        j++
      }
      if (closed) {
        K(i)
        K(j)
        lastSig = c
        i = j + 1
      } else {
        leaks.push(`第 ${lineAt(src, i)} 行的 ${c} 未闭合(疑正则字面量)`)
        i = j
      }
      continue
    }
    if (c === '`') {
      stack.push({ kind: 'tpl', depth: 0 })
      K(i)
      i++
      continue
    }
    if (top.kind === 'interp') {
      if (c === '{') top.depth++
      else if (c === '}') {
        top.depth--
        if (top.depth === 0) {
          stack.pop()
          K(i)
          i++
          continue
        }
      }
    }
    if (!/\s/.test(c)) {
      lastSig = c
      word = /[\w$]/.test(c) ? (word + c).slice(-12) : ''
    }
    i++
  }
  if (stack.length > 1) leaks.push(`模板/插值嵌套未收平(残留 ${stack.length - 1} 层)`)
  let out = ''
  for (let k = 0; k < n; k++) {
    const ch = src[k]
    out += kill[k] && ch !== '\n' && ch !== '\r' ? ' ' : ch
  }
  return { text: out, leaks }
}

function lineAt(src, idx) {
  let line = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') line++
  return line
}

const REGEX_AFTER = new Set([
  '(',
  ',',
  '=',
  ':',
  '[',
  '!',
  '&',
  '|',
  '?',
  '{',
  '}',
  ';',
  '>',
  '<',
  '+',
  '*',
  '%',
  '^',
  '~',
  '',
])
const REGEX_WORDS = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'do',
  'else',
  'yield',
  'await',
  'delete',
  'void',
])
function regexMayStartHere(lastSig, word) {
  return REGEX_WORDS.has(word) || lastSig === '' || REGEX_AFTER.has(lastSig)
}

/** 扫一个正则字面量(含字符类里的 `/` 与尾随 flag)。本行没有收尾的 `/` ⇒ 返回 -1,按普通字符走。 */
function scanRegexLiteral(src, i) {
  let j = i + 1
  let inClass = false
  let body = ''
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') {
      body += 'x'
      j += 2
      continue
    }
    if (c === '\n') return -1
    if (inClass) {
      if (c === ']') inClass = false
      body += c
      j++
      continue
    }
    if (c === '[') {
      inClass = true
      body += c
      j++
      continue
    }
    if (c === '/') {
      if (!body) return -1 // 空的 `//` 已在注释分支处理;`a / /` 之类不是正则
      let k = j + 1
      while (k < src.length && /[a-z]/i.test(src[k])) k++
      return k
    }
    body += c
    j++
  }
  return -1
}

/* ------------------------------- 结构扫描 ------------------------------- */

function closePair(src, openIdx, o, c) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === o) depth++
    else if (src[i] === c && --depth === 0) return i + 1
  }
  return -1
}
const closeParen = (s, i) => closePair(s, i, '(', ')')
const closeBrace = (s, i) => closePair(s, i, '{', '}')

/**
 * `db|tx|trx` 发起的 `.delete(` / `.update(` 调用链(逐链走括号,不按行切 —— 跨行写法实测存在)。
 * 接收者白名单是防误伤的第一道:实测 HEAD 面 `*.delete(` 里路由注册(server.delete)387 处、
 * Map/Set 的 .delete 上百处,远多于 `db.delete(` 242 处 —— 不认接收者就等于把路由注册当违规数。
 * 链上必须有 `.where(`(裸 `db.delete(table)` 全表删除不属本型);`opaque` 那支承认自己分不清。
 */
export function findWriteChains(code) {
  const out = []
  const re = /\.(delete|update)\s*\(/g
  let m
  while ((m = re.exec(code)) !== null) {
    const rec = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, m.index))
    if (!rec || !WRITE_RECEIVERS.has(rec[1])) continue
    const end0 = closeParen(code, code.indexOf('(', m.index))
    if (end0 < 0) continue
    const links = [{ name: m[1], text: code.slice(m.index + m[0].length, end0 - 1) }]
    let cur = end0
    for (;;) {
      const cm = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*\(/.exec(code.slice(cur, cur + 80))
      if (!cm) break
      const open = cur + cm[0].length - 1
      const cend = closeParen(code, open)
      if (cend < 0) break
      links.push({ name: cm[1], text: code.slice(open + 1, cend - 1) })
      cur = cend
    }
    out.push({
      start: m.index,
      end: cur,
      receiver: rec[1],
      names: links.map((l) => l.name),
      hasWhere: links.some((l) => l.name === 'where'),
      hasInArray: links.some((l) => /\binArray\s*\(/.test(l.text)),
      hasReturning: links.some((l) => l.name === 'returning'),
      opaque: links.some((l) => /=>|\bfunction\b/.test(l.text)),
    })
  }
  return out
}

/**
 * 函数体 = `=>` 后紧跟 `{`,或 `function` 头部之后的第一个顶层 `{`。
 * 为什么必须是函数体而不是"任意最小花括号块":取"同时包住链与 send 的最小块"会让兄弟 handler
 * 互相借链(A 里的链替 B 里的 send 定罪)—— 那等于把判据建立在花括号几何上。
 */
export function findFunctionBodies(code) {
  const bodies = []
  const push = (b) => {
    if (b >= 0 && code[b] === '{') {
      const end = closeBrace(code, b)
      if (end > 0) bodies.push({ start: b, end })
    }
  }
  let m
  const arrow = /=>/g
  while ((m = arrow.exec(code)) !== null) {
    const rest = /^\s*\{/.exec(code.slice(m.index + 2, m.index + 12))
    if (rest) push(m.index + 2 + rest[0].length - 1)
  }
  const fn = /\bfunction\b/g
  while ((m = fn.exec(code)) !== null) {
    let i = m.index + 8
    while (i < code.length && code[i] !== '{' && code[i] !== ';' && code[i] !== '}') i++
    push(i)
  }
  return bodies
}

function enclosingBody(bodies, idx) {
  let best = null
  for (const b of bodies)
    if (idx >= b.start && idx < b.end && (!best || b.start > best.start)) best = b
  return best
}

const DB_CONFIRMED_RE =
  /\.(?:returning|select|execute|insert|update|delete)\s*\(|\bawait\s+[\w$.]*\bdb\b|dbRead|dbWrite/
const CONTINUE_CHARS = new Set([
  '.',
  ',',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&',
  '|',
  '^',
  '?',
  ':',
  ')',
  '}',
  ']',
  '=',
  '<',
  '>',
  '`',
])
const NOT_IDENT = new Set([
  'const',
  'let',
  'var',
  'await',
  'async',
  'return',
  'if',
  'else',
  'for',
  'of',
  'in',
  'new',
  'map',
  'filter',
  'from',
  'where',
  'and',
  'or',
  'eq',
  'inArray',
  'set',
  'then',
  'length',
  'ids',
  'String',
  'Number',
  'Boolean',
  'Array',
  'Object',
  'JSON',
  'Math',
  'Date',
  'size',
  'join',
  'split',
  'includes',
  'some',
  'every',
  'push',
])

/** 语句结尾:深度 0 处的 `;`,或深度 0 处换行且下一行不是续行。 */
function statementEnd(code, from, limit) {
  let depth = 0
  for (let i = from; i < limit; i++) {
    const c = code[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth > 0) depth--
    } else if (c === ';' && depth === 0) return i
    else if (c === '\n' && depth === 0) {
      let k = i + 1
      while (k < limit && /\s/.test(code[k])) k++
      if (k >= limit || !CONTINUE_CHARS.has(code[k])) return i
    }
  }
  return limit
}

function initializersOf(code, span, name) {
  const re = new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`, 'g')
  const out = []
  let m
  while ((m = re.exec(code)) !== null) {
    if (m.index < span.start || m.index >= span.end) continue
    const eq = m.index + m[0].length - 1
    out.push(code.slice(eq + 1, statementEnd(code, eq + 1, span.end)))
  }
  return out
}

/** E1b:计数根标识符是否可追到库确认的集合(≤2 跳)。查不到声明 ⇒ 不放过(参数/请求侧解构都是这种)。 */
function resolveConfirmed(code, span, name, depth) {
  if (depth > 2) return false
  for (const rhs of initializersOf(code, span, name)) {
    if (rhs.length > 4000) continue
    if (DB_CONFIRMED_RE.test(rhs)) return true
    if (depth >= 2) continue
    for (const mm of rhs.matchAll(/[A-Za-z_$][\w$]*/g)) {
      if (!NOT_IDENT.has(mm[0]) && resolveConfirmed(code, span, mm[0], depth + 1)) return true
    }
  }
  return false
}

/** `.send(<X>success({ … }))` 的对象字面量 —— 违规判据与两份惯例计数**共用这一遍取材**。
 *  为什么必须共用:两处各扫一遍 send 形态,一处改了另一处不会跟着改,惯例数就会和违规数说不同的话
 *  (本仓"两处算同一件事必须共用一份实现"记过多次)。 */
function* sendSuccessObjects(code) {
  const sendRe = /\.\s*send\s*\(\s*\w*[Ss]uccess\s*\(\s*\{/g
  let m
  while ((m = sendRe.exec(code)) !== null) {
    const objOpen = code.indexOf('{', m.index + m[0].length - 1)
    const objEnd = closeBrace(code, objOpen)
    if (objEnd < 0) continue
    yield { objOpen, objText: code.slice(objOpen, objEnd) }
  }
}

/** `.send(<X>success({ … deleted: true … }))` 的**布尔 ack** 落点(V1,只报数不判红)。
 *  窄到形态才算:键逐字 `deleted`(故 `isDeleted:` / `deleted_count:` 不纳)、值逐字 `true`
 *  (故 `deleted: affected` / `rows.length` 不纳 —— 那一型归违规判据)、值后必须紧跟 `,` 或 `}`
 *  (故 `deleted: true ? a : b` / `deleted: trueOrFalse` 不纳)。键族刻意只有 `deleted`:
 *  `restored: true` 是另一种语义(可撤销的软删),混进来就等于把两型合成一个没有信息的数。 */
const BOOL_ACK_RE = /[{,]\s*deleted\s*:\s*true\s*(?=[,}])/g
export function findBooleanAckSends(code) {
  const out = []
  for (const { objOpen, objText } of sendSuccessObjects(code)) {
    BOOL_ACK_RE.lastIndex = 0
    let k
    while ((k = BOOL_ACK_RE.exec(objText)) !== null)
      out.push({
        index: objOpen + k.index + k[0].indexOf('deleted'),
        key: 'deleted',
        value: 'true',
      })
  }
  return out
}

/** `.send(<X>success({ … <key>: <点号链>.length … }))` 的每一处落点。 */
export function findCountSends(code) {
  const value = String.raw`[A-Za-z_$][\w$]*(?:\s*(?:\?\.|\.\s*[A-Za-z_$][\w$]*|\[[^\]]*\]|\([^)]*\)))*\s*(?:\?\.|\.)\s*length\b`
  const keyRe = new RegExp(`\\b(${COUNT_KEYS})\\s*:\\s*(${value})`, 'g')
  const out = []
  for (const { objOpen, objText } of sendSuccessObjects(code)) {
    keyRe.lastIndex = 0
    let k
    while ((k = keyRe.exec(objText)) !== null) {
      const nxt = /^\s*(.)/.exec(objText.slice(k.index + k[0].length))
      // `deleted: ids.length > 0` / `… .length + 1` 是布尔或算式,不是自算计数(N1 那一族)。
      if (nxt && nxt[1] && /[<>!=+*/%&|?-]/.test(nxt[1])) continue
      out.push({ index: objOpen + k.index, key: k[1], expr: k[2].replace(/\s+/g, '') })
    }
  }
  return out
}

/**
 * 行内豁免 `batch-count-exempt: <原因>`:必须带非空原因,且必须落在注释里。
 * 两件事各堵一个洞 —— 原因由注释闭合符冒充(先剥尾随闭合符与前导星号再判空,门 102 的 GA1
 * 就漏在这一格);把标记写进字符串冒充(判"标记之前是否有注释起始符")。
 * @returns {{state:'none'|'ok'|'bare', reason:string}}
 */
export function readExemptMarker(rawLine) {
  const at = rawLine.indexOf(`${EXEMPT_TOKEN}:`)
  const idx = at >= 0 ? at : rawLine.indexOf(`${EXEMPT_TOKEN} :`)
  if (idx < 0) return { state: 'none', reason: '' }
  const head = rawLine.slice(0, idx)
  if (!/(?:^|[^\S\n])(?:\/\/|\/\*|\*)/.test(head)) return { state: 'none', reason: '' }
  const rest = rawLine
    .slice(idx + EXEMPT_TOKEN.length + 1)
    .replace(/\*\/\s*$/, '')
    .replace(/^[:*\s]+/, '')
    .trim()
  return rest ? { state: 'ok', reason: rest } : { state: 'bare', reason: '' }
}

/* ------------------------------- 单文件判据 ------------------------------- */

/** 纯函数:一份文件正文 → 候选与处置。自检与端到面都跑它(判据只此一份实现)。 */
export function scanFileText(relPath, text) {
  const masked = maskText(text, { blankStrings: true })
  const code = masked.text
  const rawLines = text.split(/\r?\n/)
  const bodies = findFunctionBodies(code)
  const batchChains = findWriteChains(code).filter((c) => c.hasWhere && c.hasInArray && !c.opaque)
  const sends = findCountSends(code)
  const usesOutlet = SPEC_RE.test(maskText(text, { blankStrings: false }).text)
  const res = {
    file: relPath,
    candidates: [],
    violations: [],
    exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
    undetermined: [],
    bareExempt: 0,
    leaks: masked.leaks,
    usesOutlet,
    batchChains: batchChains.length,
    // 两份"惯例存量"落点(可见性,不进 decide、不进四个判据数)。U2 那份文件在此提前 return  ⇒ 两份都不计,
    // 而该文件已在 undetermined 清单里点名 —— 少掉的数有对应的名字,不是静默少掉。
    booleanAck: [],
    readQuery: [],
  }
  if (res.leaks.length) {
    res.undetermined.push({
      file: relPath,
      line: 0,
      why: `词法状态未闭合(${res.leaks[0]}${res.leaks.length > 1 ? ` 等 ${res.leaks.length} 处` : ''})⇒ 整文件不判(U2)`,
    })
    return res
  }
  for (const s of sends) {
    const line = lineAt(code, s.index)
    const body = enclosingBody(bodies, s.index)
    const scope = body ? batchChains.filter((c) => c.start >= body.start && c.end <= body.end) : []
    const before = scope.filter((c) => c.end <= s.index)
    if (!before.length) {
      if (scope.length)
        res.undetermined.push({
          file: relPath,
          line,
          why: `${s.key}: ${s.expr} 在同函数体内只有其后的 inArray 批量写链 ⇒ 顺序不成立,不判红也不记绿(U1)`,
        })
      // V2:函数体内**完全没有**批量写链且键为 count ⇒ N2 读查询计数那一族(只报数)。
      // 刻意不在 U1 那一支计:那处已经作为"未判定"点名过,再计一次就是把同一格算进两个惯例族。
      else if (s.key === 'count')
        res.readQuery.push({ file: relPath, line, key: s.key, expr: s.expr })
      continue // 函数体内没有批量写链:读查询/布尔确认(N1/N2),不入面
    }
    const chain = before[before.length - 1]
    const site = { file: relPath, line, key: s.key, expr: s.expr, receiver: chain.receiver }
    res.candidates.push(site)
    const mk = readExemptMarker(rawLines[line - 1] || '')
    const prev = line >= 2 ? readExemptMarker(rawLines[line - 2] || '') : { state: 'none' }
    const marked = mk.state === 'ok' || prev.state === 'ok'
    if (mk.state === 'bare' || prev.state === 'bare') res.bareExempt++
    const root = /^([A-Za-z_$][\w$]*)/.exec(s.expr)?.[1] || ''
    const dbDerived = !!root && resolveConfirmed(code, body, root, 0)
    // 四条放过通道按" cheapest 且最能说明意图"排序;每支各有反面对照(见 selfTest 的 P1b/P2)。
    const kind = usesOutlet
      ? 'outlet'
      : marked
        ? 'marker'
        : chain.hasReturning
          ? 'returning'
          : dbDerived
            ? 'db'
            : 'violation'
    if (kind === 'violation') {
      site.disposition = 'violation'
      res.violations.push(site)
    } else {
      site.disposition = {
        outlet: 'outlet',
        marker: 'marker',
        returning: 'returning',
        db: 'db-confirmed',
      }[kind]
      res.exempt[kind]++
    }
  }
  // V1:布尔 ack 惯例落点(DELETE 幂等确认)。与违规判据同面同轮、同一份遮蔽后的代码面,
  // 所以注释/字符串里的 `deleted: true` 不计数(N3 那一型),而跨行对象字面量数得到。
  res.booleanAck = findBooleanAckSends(code).map((b) => ({
    file: relPath,
    line: lineAt(code, b.index),
    key: b.key,
    value: b.value,
  }))
  for (const c of findWriteChains(code).filter((x) => x.opaque))
    res.undetermined.push({
      file: relPath,
      line: lineAt(code, c.start),
      why: `${c.receiver}.${c.names.join('.')} 链里混进函数字面量 ⇒ 分不清批量写还是路由注册,不计入本门(U0)`,
    })
  return res
}

/* ------------------------------ 取材(同面同轮) ------------------------------ */

export function listCandidates(root, face) {
  const out =
    face === 'head'
      ? gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...SCAN_DIRS], root)
      : gitRaw(['ls-files', '-z', '--', ...SCAN_DIRS], root)
  return String(out)
    .split('\0')
    .filter(Boolean)
    .filter((p) => FILE_RE.test(p) && !SKIP_RE.test(p))
}

/** 一次 `cat-file --batch` 把同一面全部候选读满(清单与内容同面同轮;取不到即抛,不回落)。 */
export function readCandidates(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${p}`)
      map.set(p, t)
    }
    return map
  }
  const specs = paths.map((p) => (face === 'staged' ? ':' : 'HEAD:') + p)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: 180000 })
  paths.forEach((p, k) => {
    const t = got.get(specs[k])
    if (t === null || t === undefined)
      throw new Undetermined(
        `${face === 'staged' ? '索引' : 'HEAD'} 取不到 ${p} ⇒ 不回落另一个面(回落就是把"没判"写成"判过了")`,
      )
    map.set(p, t)
  })
  return map
}

export function analyze(root, face, opts = {}) {
  assertRepoRoot(root, GATE)
  const paths = listCandidates(root, face)
  if (paths.length === 0)
    throw new Undetermined(
      `${face} 面在 ${SCAN_DIRS.join(' / ')} 下枚举到 0 个候选源文件 —— 判据失效,不计通过`,
    )
  const texts = readCandidates(root, face, paths)
  const only = opts.onlyFiles && opts.onlyFiles.length ? new Set(opts.onlyFiles) : null
  const scanned = only ? paths.filter((p) => only.has(p)) : paths
  if (only && scanned.length === 0)
    throw new Undetermined(
      `--files 指定的路径没有一个落在本门覆盖面(${SCAN_DIRS.join(' / ')} · ${face} 面)⇒ 判据失效,不计通过`,
    )
  const per = scanned.map((p) => scanFileText(p, texts.get(p)))
  const violations = per.flatMap((r) => r.violations)
  const undetermined = per.flatMap((r) => r.undetermined)
  const exempt = ['returning', 'db', 'outlet', 'marker'].reduce(
    (a, k) => ({ ...a, [k]: per.reduce((x, r) => x + r.exempt[k], 0) }),
    {},
  )
  const counts = {
    files: scanned.length,
    enumerated: paths.length,
    candidates: per.reduce((a, r) => a + r.candidates.length, 0),
    violations: violations.length,
    undetermined: undetermined.length,
    exempt: exempt.returning + exempt.db + exempt.outlet + exempt.marker,
    bareExempt: per.reduce((a, r) => a + r.bareExempt, 0),
    // 两份惯例存量:可见性字段,**不参与 decide**。刻意各计各的 —— 混计成一个数就等于没有信息。
    booleanAckSites: per.reduce((a, r) => a + r.booleanAck.length, 0),
    booleanAckFiles: per.filter((r) => r.booleanAck.length > 0).length,
    readQueryCountSites: per.reduce((a, r) => a + r.readQuery.length, 0),
    readQueryCountFiles: per.filter((r) => r.readQuery.length > 0).length,
  }
  // 棘轮锚点:只在这一档才回读 HEAD 面(全量档本来就是 HEAD)。新文件不在 HEAD ⇒ 锚点 0,
  // 这是"第一个端点第一次就写错"必须判红的那一格;锚点文件取不到则判死,不拿 0 顶替。
  let ratcheted = null
  if (face === 'staged' && violations.length) {
    const byFile = new Map()
    for (const v of violations) byFile.set(v.file, (byFile.get(v.file) || 0) + 1)
    const headSet = new Set(listCandidates(root, 'head'))
    const need = [...byFile.keys()].filter((p) => headSet.has(p))
    const headTexts = need.length ? readCandidates(root, 'head', need) : new Map()
    ratcheted = []
    for (const [file, now] of byFile) {
      let anchor = 0
      if (headSet.has(file)) {
        const t = headTexts.get(file)
        if (t === undefined)
          throw new Undetermined(`HEAD 取不到棘轮锚点文件 ${file} ⇒ 无法判定(不回落、不拿 0 顶替)`)
        anchor = scanFileText(file, t).violations.length
      }
      if (now > anchor) ratcheted.push({ file, now, anchor, added: now - anchor })
    }
  }
  const exit = decide({ face, violations, undetermined, ratcheted, strict: !!opts.strict })
  return {
    face,
    strict: !!opts.strict,
    counts,
    violations,
    undetermined,
    exempt,
    ratcheted,
    per,
    exit,
  }
}

/**
 * 纯映射:面 + 结论 → 退出码。判红只算两型:staged 的差值棘轮、全量档的 --strict。
 * 全量档默认不判红是设计前提而不是偷懒:HEAD 有存量时当场判红 = 恒红门(§12e)。
 * 未判定永不冒红,但 --strict 下拒绝出合格证 ⇒ exit 2(不冒红也不记绿)。
 * **签名即判据**:本函数只收 violations / undetermined / ratcheted / strict 四个输入 ——
 * 两份惯例存量计数(booleanAck* / readQueryCount*)**刻意不在参数里**,所以"把可见性计数接进退出码"
 * 这一改法在结构上就要求改签名,而那一步由 self-test 的 X2 直接判红(惯例存量是**决策依据**不是**债**)。
 */
export function decide({ face, violations, undetermined, ratcheted, strict }) {
  if (strict) {
    if (undetermined.length) return 2
    if (face === 'staged' ? ratcheted && ratcheted.length : violations.length) return 1
    return 0
  }
  if (face === 'staged') return ratcheted && ratcheted.length ? 1 : 0
  return 0
}

/* ------------------------------- 报告 ------------------------------- */

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

export function formatReport(out) {
  const L = []
  const c = out.counts
  if (out.ratcheted && out.ratcheted.length) {
    L.push(
      `❌ 判红:${out.ratcheted.length} 个文件把"计数自算"加回来了(锚点 = 该文件 HEAD 自身违规数)`,
    )
    for (const r of out.ratcheted)
      L.push(`   ${r.file}:索引 ${r.now} 处 > HEAD ${r.anchor} 处 ⇒ 净新增 ${r.added} 处`)
    L.push(
      `   修法二选一:① db 层补 .returning({id}) 并以真实命中集算 affected;② 走唯一出口 ${UNIQUE_OUTLET} 的 batchWriteOutcome(requested, confirmed)。`,
    )
    L.push(`   确属有意(如全量改写后必得请求数):写行内豁免 ${EXEMPT_TOKEN}: <一句话原因>。`)
  } else if (out.face === 'staged')
    L.push('✅ 索引面未见新增"批量写自算计数"(存量按各文件 HEAD 自身计数豁免,不代裁)。')
  if (out.face !== 'staged' && c.violations) {
    L.push(
      `${out.strict ? '❌' : '⚠️'} 全量档现读 ${c.violations} 处自算计数${out.strict ? '(--strict 判红)' : '(只报数,不拦提交:与改动无关的恒红门只会逼人 --no-verify,§12e)'}`,
    )
    for (const v of out.violations)
      L.push(`   ${v.file}:${v.line}  ${v.key}: ${v.expr}  (写链=${v.receiver}.… 无 .returning())`)
  }
  if (c.undetermined) {
    L.push(`⚠️ 未判定 ${c.undetermined} 处 —— **未判定不等于通过**,下列每一处本门都承认自己看不见:`)
    for (const u of out.undetermined.slice(0, 40)) L.push(`   ${u.file}:${u.line}  ${u.why}`)
    if (c.undetermined > 40) L.push(`   …另 ${c.undetermined - 40} 处(--explain 看全量)`)
  }
  if (out.strict && c.undetermined)
    L.push('❌ --strict 下未判定即拒绝出合格证 ⇒ exit 2(不冒红也不记绿)。')
  if (out.face !== 'staged' && !c.violations && !c.undetermined)
    L.push('✅ 通过:覆盖面内无自算计数,且无未判定项。')
  if (out.face === 'staged' && !out.ratcheted?.length && c.undetermined)
    L.push('ℹ️ 本门未拦本次提交,但上面列出的未判定项**没有被判过** —— 别让绿灯替它们说话。')
  L.push(
    `候选 ${c.candidates} / 违规 ${c.violations} / 未判定 ${c.undetermined} / 豁免 ${c.exempt}` +
      `(库确认·链 ${out.exempt.returning} / 库确认·预查询 ${out.exempt.db} / 唯一出口 ${out.exempt.outlet} / 行内标记 ${out.exempt.marker})` +
      `  [裸标记不计 ${c.bareExempt};文件 ${c.files}/${c.enumerated};取材面:${FACE_TXT[out.face] || out.face}]` +
      // 结论行必须**点名**两份惯例存量:放着一个不喊出的数,读报告的人就会以为覆盖面内没有这两种形状
      // ("判据失效的表现永远是安静"同型)。它们不参与退出码 —— 措辞里"不计红"是这一句的约束力所在。
      ` 布尔 ack 惯例(不计红,仅现读计数): ${c.booleanAckSites} 处 / ${c.booleanAckFiles} 文件` +
      `;读查询 count 惯例(不计红,仅现读计数): ${c.readQueryCountSites} 处 / ${c.readQueryCountFiles} 文件`,
  )
  return L
}

const USAGE = `用法: node scripts/${GATE}.mjs [--staged|--worktree] [--strict] [--explain] [--json] [--files a,b] [--root <dir>] [--self-test]
  判据:同函数体内 inArray 批量写链 + .send(success({ deleted|affected|… : <请求侧>.length }))
  放过:链带 .returning( / 计数根可追到库确认集 / import ${UNIQUE_OUTLET} / 行内 ${EXEMPT_TOKEN}: <原因>(须带原因)
  只报数不判红(现读惯例存量,写在结论行):布尔 ack \`deleted: true\` 与读查询 \`count: X.length\`;--explain 逐条点名
  全量档只报数不判红(HEAD 有存量,当场判红 = 恒红门 = 逼人 --no-verify);提交链档走差值棘轮。
  紧急跳过(接入提交链后):${SELF_SKIP}=1`

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return void console.log(USAGE)
  if (argv.includes('--self-test')) return selfTest(argv)
  const { face, error } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (error) {
    console.error(`[${GATE}] ❌ 无法判定:${error}`)
    return 2
  }
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? resolve(argv[ri + 1]) : ROOT
  const fi = argv.includes('--files') ? argv.indexOf('--files') : -1
  const onlyFiles =
    fi >= 0 && argv[fi + 1]
      ? argv[fi + 1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null
  let out
  try {
    out = analyze(root, face, { strict: argv.includes('--strict'), onlyFiles })
  } catch (e) {
    console.error(
      `[${GATE}] 无法判定(exit 2):${e instanceof Undetermined ? e.message : `${e?.message ?? e}\n${e?.stack ?? ''}`}`,
    )
    return 2
  }
  if (argv.includes('--explain')) {
    for (const r of out.per)
      for (const c of r.candidates)
        console.log(`  · ${c.file}:${c.line} ${c.key}: ${c.expr} ⇒ ${c.disposition}`)
    // 两份惯例存量的抽样出口:阳性对照要能"数到"并"点名",只有聚合数字就等于没法复核判据。
    for (const r of out.per)
      for (const b of r.booleanAck)
        console.log(`  · 布尔ack ${b.file}:${b.line} ${b.key}: ${b.value}(不计红)`)
    for (const r of out.per)
      for (const q of r.readQuery)
        console.log(`  · 读查询count ${q.file}:${q.line} ${q.key}: ${q.expr}(不计红)`)
  }
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          gate: GATE,
          root,
          face: out.face,
          strict: out.strict,
          counts: out.counts,
          exempt: out.exempt,
          violations: out.violations,
          undetermined: out.undetermined,
          ratcheted: out.ratcheted,
          exit: out.exit,
        },
        null,
        2,
      ),
    )
    return out.exit
  }
  for (const line of formatReport(out)) console.log(`[${GATE}] ${line}`)
  return out.exit
}

/* ------------------------------- 自检 ------------------------------- */

/** 夹具骨架:一份最小路由文件,每个 handler 一组行。共用骨架才不会让"文件形状"本身成为变量。 */
const h = (...handlers) =>
  [
    "import { inArray } from 'drizzle-orm'",
    "import { success } from '../utils/envelope.js'",
    ...handlers.flatMap((b) => ['server.delete(basePath, async (request, reply) => {', ...b, '})']),
    '',
  ].join('\n')

const FIX = {
  selfCount: h([
    '  const idList = request.body.ids',
    '  await db.delete(table).where(inArray(table.id, idList))',
    '  return reply.send(success({ deleted: idList.length }))',
  ]),
  returning: h([
    '  const deleted = await db',
    '    .delete(table)',
    '    .where(inArray(table.id, ids))',
    '    .returning()',
    '  return reply.send(success({ deleted: deleted.length }))',
  ]),
  outlet:
    "import { batchWriteOutcome } from '../utils/batch-outcome.js'\n" +
    // 第二条 handler 是"同一文件里还没迁完的老端点":有唯一出口 import ⇒ 整文件放过(E2);
    // 去掉 import 就必须变红 —— 那条对照是 outletNoImport(证明 E2 不是恒真)。
    h(
      [
        '  const rows = await db.delete(table).where(inArray(table.id, idList)).returning({ id: table.id })',
        '  const o = batchWriteOutcome(idList, rows.map((r) => r.id))',
        '  return reply.send(success({ affected: o.affected, missedIds: o.missedIds }))',
      ],
      [
        '  await db.delete(table).where(inArray(table.id, idList))',
        '  return reply.send(success({ affected: idList.length }))',
      ],
    ),
  outletNoImport: h([
    '  await db.delete(table).where(inArray(table.id, idList))',
    '  return reply.send(success({ affected: idList.length }))',
  ]),
  preQuery: h([
    '  const owned = await dbRead',
    '    .select({ id: cards.id })',
    '    .from(cards)',
    '    .where(and(eq(cards.userId, userId), inArray(cards.id, body.data.ids)))',
    '  const ownedIds = owned.map((r) => r.id)',
    '  if (ownedIds.length > 0) await db.delete(cards).where(inArray(cards.id, ownedIds))',
    '  return reply.send(success({ deleted: ownedIds.length }))',
  ]),
  preQueryRequestSide: h([
    '  const owned = await dbRead',
    '    .select({ id: cards.id })',
    '    .from(cards)',
    '    .where(and(eq(cards.userId, userId), inArray(cards.id, body.data.ids)))',
    '  const ownedIds = owned.map((r) => r.id)',
    '  if (ownedIds.length > 0) await db.delete(cards).where(inArray(cards.id, ownedIds))',
    '  return reply.send(success({ deleted: body.data.ids.length }))',
  ]),
  markerOk: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return reply.send(success({',
    '    // batch-count-exempt: 该表有触发器逐行归档,删除数恒等于请求数,见 docs/x.md',
    '    deleted: ids.length,',
    '  }))',
  ]),
  markerBare: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return reply.send(success({ deleted: ids.length })) // batch-count-exempt:',
  ]),
  regexQuote: h([
    "  const cleaned = ids.map((x) => x.replace(/'/g, ''))",
    '  await db.delete(table).where(inArray(table.id, cleaned))',
    '  return reply.send(success({ deleted: cleaned.length }))',
  ]),
  // 字符类里的反引号/引号(真仓 feature-center.ts 的 /[*`_~]/g 就是这一型):不吞掉整段正则,
  // 整份文件就会被后面的"模板未闭合"读盲 —— 判据看不见存量却一路报绿。
  regexClass: h([
    "  const cleaned = ids.map((x) => x.replace(/[*`_'~]/g, ''))",
    '  await db.delete(table).where(inArray(table.id, cleaned))',
    '  return reply.send(success({ deleted: cleaned.length }))',
  ]),
  boolAck: h([
    '  await db.delete(table).where(eq(table.id, p.data.id))',
    '  return reply.send(success({ id: p.data.id, deleted: true }))',
  ]),
  // V1 阳性对照的三个真形态:单行无尾逗号 / 带尾逗号 / 跨行对象字面量 —— 三个都该被现读到。
  boolAckCount: h(
    ['  await db.delete(t).where(eq(t.id, 1))', '  return reply.send(success({ deleted: true }))'],
    [
      '  await db.delete(t).where(eq(t.id, 2))',
      '  return reply.send(success({ id: 2, deleted: true, }))',
    ],
    [
      '  await db.delete(t).where(eq(t.id, 3))',
      '  return reply.send(success({',
      '    deleted: true,',
      '  }))',
    ],
  ),
  // V1 必须**不**数的近邻形状:键族别的(restored/isDeleted)、值不是布尔字面量(affected/rows.length)、
  // 字面量后面还接着算式或更长的标识符。放宽到"任何含 deleted 的行"就会把这些一并混进同一个数。
  boolAckNearMiss: h(
    ['  const affected = 1', '  return reply.send(success({ deleted: affected }))'],
    ['  return reply.send(success({ deleted: rows.length }))'],
    ['  return reply.send(success({ restored: true }))'],
    ['  return reply.send(success({ isDeleted: true }))'],
    ['  return reply.send(success({ deleted: true === flag }))'],
    ['  return reply.send(success({ deleted: trueOrFalse }))'],
  ),
  // N3 同一条遮噪方向也管惯例计数:注释与字符串里的 `deleted: true` 不得进账。
  boolAckInComment: h(
    [
      '  // 旧实现曾返回 reply.send(success({ deleted: true })) —— 现按库确认计数',
      '  return reply.send(success({ ok: true }))',
    ],
    [
      "  const doc = '形如 reply.send(success({ deleted: true })) 的响应'",
      '  return reply.send(success({ ok: true, doc }))',
    ],
  ),
  // 三族同时出现在一份文件里:违规 1 / 布尔 ack 1 / 读查询 1 —— 各计各的,谁也不得串到谁的账上。
  mixedAll: h(
    [
      '  await db.delete(table).where(inArray(table.id, idList))',
      '  return reply.send(success({ deleted: idList.length }))',
    ],
    ['  await db.delete(t).where(eq(t.id, 1))', '  return reply.send(success({ deleted: true }))'],
    [
      '  const rows = await db.select().from(t).where(inArray(t.id, ids))',
      '  return reply.send(success({ rows, count: rows.length }))',
    ],
  ),
  readQuery: h([
    '  const rows = await db.select().from(t).where(inArray(t.id, ids))',
    '  return reply.send(success({ rows, count: rows.length }))',
  ]),
  commentOnly: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  // 旧实现:reply.send(success({ deleted: ids.length })) —— 已改为按库确认计数',
    '  return reply.send(success({ ok: true }))',
  ]),
  stringOnly: h([
    "  const doc = '示例: db.delete(t).where(inArray(t.id, ids)) 然后 reply.send(success({ deleted: ids.length }))'",
    '  return reply.send(success({ ok: true, doc }))',
  ]),
  chainAfter: h([
    '  const r = reply.send(success({ deleted: ids.length }))',
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return r',
  ]),
  registrar: h([
    '  await db.delete(table).where(inArray(table.id, ids))',
    '  return reply.send(success({ deleted: ids.length }))',
  ]).replace('server.delete(basePath', 'server.delete("/x"'),
}

function selfTest(argv) {
  const R = []
  const eq = (name, got, want) => {
    const g = JSON.stringify(got),
      w = JSON.stringify(want)
    R.push(`${g === w ? '✅' : '❌'} ${name}${g === w ? '' : ` → 实得 ${g} 期望 ${w}`}`)
  }
  const v = (t) => scanFileText('apps/api/src/routes/x.ts', t)
  const st = (t) => {
    const r = v(t)
    return [r.candidates.length, r.violations.length, r.undetermined.length]
  }
  const trip = (t) => {
    const r = v(t)
    return [r.candidates.length, r.violations.length, r.exempt]
  }
  eq('P1 自算 count ⇒ 候选 1 违规 1', st(FIX.selfCount), [1, 1, 0])
  eq('N1 链带 .returning( ⇒ 违规 0(库确认放过)', trip(FIX.returning), [
    1,
    0,
    { returning: 1, db: 0, outlet: 0, marker: 0 },
  ])
  eq('N1b 计数根来自归属预查询 ⇒ 违规 0(库确认·预查询)', trip(FIX.preQuery), [
    1,
    0,
    { returning: 0, db: 1, outlet: 0, marker: 0 },
  ])
  eq('P1b 同一处改成请求侧集合 ⇒ 违规 1(证明 N1b 不是恒真)', trip(FIX.preQueryRequestSide), [
    1,
    1,
    { returning: 0, db: 0, outlet: 0, marker: 0 },
  ])
  eq('N2 import 唯一出口 ⇒ 违规 0(出口放过)', trip(FIX.outlet), [
    1,
    0,
    { returning: 0, db: 0, outlet: 1, marker: 0 },
  ])
  eq('P2 同一处去掉 import ⇒ 违规 1(证明 E2 不是恒真)', trip(FIX.outletNoImport), [
    1,
    1,
    { returning: 0, db: 0, outlet: 0, marker: 0 },
  ])
  eq('N3 带原因的行内豁免 ⇒ 违规 0', trip(FIX.markerOk), [
    1,
    0,
    { returning: 0, db: 0, outlet: 0, marker: 1 },
  ])
  eq(
    'P3 裸标记无原因 ⇒ 违规 1 且裸标记计数 1',
    (() => {
      const r = v(FIX.markerBare)
      return [r.violations.length, r.bareExempt, r.exempt.marker]
    })(),
    [1, 1, 0],
  )
  eq('P4 正则字面量里有引号 ⇒ 仍看得见违规(词法器不被带盲)', st(FIX.regexQuote), [1, 1, 0])
  eq(
    'P4b 字符类里有反引号/引号 ⇒ 仍看得见违规(真仓 feature-center 那一型)',
    st(FIX.regexClass),
    [1, 1, 0],
  )
  eq('N4 布尔 deleted:true ⇒ 不入面', st(FIX.boolAck), [0, 0, 0])
  eq('N5 读查询 count: rows.length ⇒ 不入面', st(FIX.readQuery), [0, 0, 0])
  // ---- V1/V2:两份"惯例存量"计数(只报数、永不判红)。六元组一次读出「两型计数 + 四个判据数」,
  //      所以同一支用例既证计数数到了,也证它没有把判据的四个数顶动一格。----
  const cc = (t) => {
    const r = v(t)
    return [
      r.booleanAck.length,
      r.readQuery.length,
      r.candidates.length,
      r.violations.length,
      r.undetermined.length,
      r.exempt.returning + r.exempt.db + r.exempt.outlet + r.exempt.marker,
    ]
  }
  eq(
    'V1 布尔 ack 三种真形态(单行 / 带尾逗号 / 跨行对象)⇒ 数到 3 处,判据四数仍 0',
    cc(FIX.boolAckCount),
    [3, 0, 0, 0, 0, 0],
  )
  eq(
    'V1b 近邻形状一律不数(affected / rows.length / restored:true / isDeleted / true===flag / trueOrFalse)',
    cc(FIX.boolAckNearMiss),
    [0, 0, 0, 0, 0, 0],
  )
  eq(
    'V1c 注释与字符串里的 deleted: true 不计数(判据与计数共用同一份遮蔽面)',
    cc(FIX.boolAckInComment),
    [0, 0, 0, 0, 0, 0],
  )
  eq(
    'V2 读查询 count: rows.length ⇒ 只进 readQuery,不混进布尔 ack',
    cc(FIX.readQuery),
    [0, 1, 0, 0, 0, 0],
  )
  eq(
    'V3 三族同文件各计各的:违规 1 / 布尔 ack 1 / 读查询 1(混计就等于没有信息)',
    cc(FIX.mixedAll),
    [1, 1, 1, 1, 0, 0],
  )
  eq(
    'V4 反向对照:加了两型计数后,自算计数那一处仍是候选 1 / 违规 1、两型计数 0',
    cc(FIX.selfCount),
    [0, 0, 1, 1, 0, 0],
  )
  eq(
    'V5 N1/N2 的"不入面"结论一字未动',
    [st(FIX.boolAck), st(FIX.readQuery)],
    [
      [0, 0, 0],
      [0, 0, 0],
    ],
  )
  eq('N6 注释里的字样 ⇒ 不计候选(剥注释锁)', st(FIX.commentOnly), [0, 0, 0])
  eq('N7 字符串里的字样 ⇒ 不入面(遮噪方向锁)', st(FIX.stringOnly), [0, 0, 0])
  eq('U1 链在 send 之后 ⇒ 未判定 1、不判红', st(FIX.chainAfter), [0, 0, 1])
  eq('N8 路由注册者不被当批量写(接收者白名单),而体内 db 链照判', st(FIX.registrar), [1, 1, 0])
  eq(
    'N8b 去掉 db 链后同一路由注册 ⇒ 不入面',
    st(FIX.registrar.replace('  await db.delete(table).where(inArray(table.id, ids))\n', '')),
    [0, 0, 0],
  )
  eq(
    'E1 两面旗同给 ⇒ 判死',
    selectFace({ staged: true, worktree: true, def: 'head' }).error,
    '--staged 与 --worktree 不得同用(两个判定面互斥)',
  )
  eq(
    'E2 默认面是 HEAD(不是磁盘)',
    selectFace({ staged: false, worktree: false, def: 'head' }).face,
    'head',
  )
  const D = (o) => decide(o)
  eq(
    'E3 全量档默认不判红(存量只报数)',
    D({ face: 'head', violations: [1, 2, 3], undetermined: [], ratcheted: null, strict: false }),
    0,
  )
  eq(
    'E4 --strict 下存量判红',
    D({ face: 'head', violations: [1, 2, 3], undetermined: [], ratcheted: null, strict: true }),
    1,
  )
  eq(
    'E5 --strict 下有未判定 ⇒ 拒绝出合格证(2 优先于 1)',
    D({ face: 'head', violations: [], undetermined: [{}], ratcheted: null, strict: true }),
    2,
  )
  eq(
    'E6 staged 差值棘轮判红',
    D({
      face: 'staged',
      violations: [1, 2],
      undetermined: [],
      ratcheted: [{ file: 'a', now: 2, anchor: 1, added: 1 }],
      strict: false,
    }),
    1,
  )
  eq(
    'E7 staged 存量持平 ⇒ 不拦',
    D({ face: 'staged', violations: [1], undetermined: [], ratcheted: [], strict: false }),
    0,
  )
  // ---- 只报数不改判据的两把锁:把惯例计数接进退出码 / 让它从结论行消失,各自必读红。----
  eq(
    'X1 惯例计数再大也不得进退出码(--strict 也一样:存量是决策依据,不是债)',
    D({
      face: 'head',
      violations: [],
      undetermined: [],
      ratcheted: null,
      strict: true,
      booleanAckSites: 9999,
      booleanAckFiles: 500,
      readQueryCountSites: 9999,
      readQueryCountFiles: 500,
    }),
    0,
  )
  eq(
    'X1b 同一条对 staged 档成立(不得用惯例数替差值棘轮加料)',
    D({
      face: 'staged',
      violations: [],
      undetermined: [],
      ratcheted: [],
      strict: false,
      booleanAckSites: 9999,
      readQueryCountSites: 9999,
    }),
    0,
  )
  const BASE_COUNTS = {
    files: 1,
    enumerated: 1,
    candidates: 0,
    violations: 0,
    undetermined: 0,
    exempt: 0,
    bareExempt: 0,
    booleanAckSites: 233,
    booleanAckFiles: 148,
    readQueryCountSites: 12,
    readQueryCountFiles: 9,
  }
  const fmt = (countsOver = {}) =>
    formatReport({
      face: 'head',
      strict: false,
      ratcheted: null,
      violations: [],
      undetermined: [],
      exempt: { returning: 0, db: 0, outlet: 0, marker: 0 },
      counts: { ...BASE_COUNTS, ...countsOver },
    }).join('\n')
  eq(
    'X2 结论行必须点名两份惯例存量与数字(不得被"✅ 通过"一句替它们说话)',
    /布尔 ack 惯例\(不计红,仅现读计数\): 233 处 \/ 148 文件/.test(fmt()) &&
      /读查询 count 惯例\(不计红,仅现读计数\): 12 处 \/ 9 文件/.test(fmt()),
    true,
  )
  eq(
    'X2b 四个判据数的原形态逐字不变(新增只许追加,不许改写既有结论行)',
    /^候选 0 \/ 违规 0 \/ 未判定 0 \/ 豁免 0.*取材面:HEAD blob.*布尔 ack 惯例/m.test(fmt()),
    true,
  )
  eq(
    'X2c 存量真是 0 时也必须喊出 0(0 处不等于"没扫过")',
    /布尔 ack 惯例\(不计红,仅现读计数\): 0 处 \/ 0 文件/.test(
      fmt({ booleanAckSites: 0, booleanAckFiles: 0 }),
    ),
    true,
  )
  eq(
    'S1 词法未闭合 ⇒ 整文件未判定(U2)',
    (() => {
      const r = v("db.delete(t).where(inArray(t.id, ids))\nconst s = '未闭合的串\n")
      return [r.violations.length, r.undetermined.length > 0]
    })(),
    [0, true],
  )
  eq(
    'S2 maskText 保行号(遮蔽不改行数)',
    maskText(FIX.selfCount).text.split('\n').length,
    FIX.selfCount.split('\n').length,
  )
  eq(
    'S3 模块说明符只在保留字符串那一档读得到',
    [
      SPEC_RE.test(maskText(FIX.outlet, { blankStrings: false }).text),
      SPEC_RE.test(maskText(FIX.outlet, { blankStrings: true }).text),
    ],
    [true, false],
  )
  let repoCases = 0
  if (!argv.includes('--no-repo')) {
    const before = R.length
    let dir = null
    try {
      git(['init', '-q'], (dir = mkScratch('bch-self-')))
      git(['config', 'user.email', 'gate@fixture.local'], dir)
      git(['config', 'user.name', 'gate-fixture'], dir)
      const stage = (rel, text) => {
        mkdirSync(join(dir, dirname(rel)), { recursive: true })
        writeFileSync(join(dir, rel), text, 'utf8')
        git(['add', '--', rel], dir)
      }
      const commit = (m) => git(['commit', '-q', '-m', m], dir)
      const X = 'apps/api/src/routes/x.ts'
      stage(X, FIX.selfCount)
      commit('fixture')
      const head = analyze(dir, 'head')
      eq(
        'R1 --root 注入临时仓:HEAD 面点名同一处存量(全量档不拦提交)',
        [head.counts.files, head.counts.violations, head.exit],
        [1, 1, 0],
      )
      stage(X, FIX.returning) // 索引:干净版本
      writeFileSync(join(dir, X), FIX.chainAfter, 'utf8') // 磁盘:第三份(链在 send 之后 ⇒ 未判定)
      const staged = analyze(dir, 'staged')
      const wt = analyze(dir, 'worktree')
      eq('R2 --staged 判索引(干净那份)⇒ 不判红', [staged.counts.violations, staged.exit], [0, 0])
      eq('R3 HEAD 仍是旧的那一处(不被索引/磁盘带跑)', analyze(dir, 'head').counts.violations, 1)
      eq(
        'R4 磁盘面是第三份 ⇒ 未判定 1、违规 0(不记绿)',
        [wt.counts.violations, wt.counts.undetermined],
        [0, 1],
      )
      commit('clean')
      stage(X, FIX.selfCount)
      const back = analyze(dir, 'staged')
      eq(
        'R5 索引把自算计数加回来(HEAD 已 0)⇒ 差值棘轮判红',
        [back.counts.violations, back.exit, back.ratcheted.length],
        [1, 1, 1],
      )
      commit('dirty')
      const flat = analyze(dir, 'staged')
      eq(
        'R5b HEAD 已带该存量、索引持平 ⇒ 不拦(防恒红门)',
        [flat.counts.violations, flat.exit],
        [1, 0],
      )
      stage('apps/api/src/routes/new-one.ts', FIX.selfCount)
      const fresh = analyze(dir, 'staged')
      eq(
        'R5c 新增文件带自算计数(HEAD 无该路径)⇒ 判红',
        [fresh.exit, fresh.ratcheted.length],
        [1, 1],
      )
      // R7 只报数最硬的形式:同面同轮取材 + 聚合,往索引里加一份**只有惯例形态**的文件 ⇒
      // 惯例数被数到,而四个判据数与退出码一字不变(X1 只能证 decide 没接,R7 证整条链都没接)。
      const beforeAck = analyze(dir, 'staged')
      stage('apps/api/src/routes/ack-only.ts', FIX.boolAckCount)
      const afterAck = analyze(dir, 'staged')
      const four = (a) => [
        a.counts.candidates,
        a.counts.violations,
        a.counts.undetermined,
        a.counts.exempt,
      ]
      eq(
        'R7 布尔 ack 现读到 3 处 / 1 文件,四个判据数与退出码一字不变(只报数)',
        [
          afterAck.counts.booleanAckSites,
          afterAck.counts.booleanAckFiles,
          JSON.stringify(four(beforeAck)) === JSON.stringify(four(afterAck)),
          beforeAck.exit === afterAck.exit,
        ],
        [3, 1, true, true],
      )
      eq(
        'R7b 读查询族同理:只顶起 readQueryCountSites,不串到布尔 ack 的账上、也不动判据四数',
        (() => {
          const b = analyze(dir, 'staged')
          stage('apps/api/src/routes/count-only.ts', FIX.readQuery)
          const a = analyze(dir, 'staged')
          return [
            a.counts.readQueryCountSites - b.counts.readQueryCountSites,
            a.counts.booleanAckSites,
            JSON.stringify(four(b)) === JSON.stringify(four(a)),
          ]
        })(),
        [1, 3, true],
      )
      // R8:上面两支都落在"索引里本来就有一处真违规"的那张面上,exit 前后都是 1 ⇒ 看不出惯例计数被接进了
      // 退出码。这一支另起一棵**干净仓**(只有放过的那一处 + 两份纯惯例文件),把 exit 与 --strict exit
      // 钉在 0:变异②(把 booleanAckSites 接进 decide)在这里必读红,而 R7 那一支顶得住。
      eq(
        'R8 干净仓只含惯例形态 ⇒ 计数有值而 exit 与 --strict exit 仍为 0(只报数不是判据)',
        (() => {
          const d2 = mkScratch('bch-conv-')
          try {
            git(['init', '-q'], d2)
            git(['config', 'user.email', 'g@f.local'], d2)
            git(['config', 'user.name', 'g'], d2)
            const st2 = (rel, text) => {
              mkdirSync(join(d2, dirname(rel)), { recursive: true })
              writeFileSync(join(d2, rel), text, 'utf8')
              git(['add', '--', rel], d2)
            }
            st2('apps/api/src/routes/ok.ts', FIX.returning) // 放过的那一处:候选 1 / 违规 0
            st2('apps/api/src/routes/ack.ts', FIX.boolAckCount) // 只含布尔 ack
            st2('apps/api/src/routes/cnt.ts', FIX.readQuery) // 只含读查询 count
            git(['commit', '-q', '-m', 'conventions'], d2)
            const a = analyze(d2, 'head')
            const s = analyze(d2, 'head', { strict: true })
            return [
              a.counts.booleanAckSites,
              a.counts.readQueryCountSites,
              a.counts.candidates,
              a.counts.violations,
              a.counts.undetermined,
              a.exit,
              s.exit,
            ]
          } finally {
            rmScratch(d2)
          }
        })(),
        [3, 1, 1, 0, 0, 0, 0],
      )
      const empty = mkScratch('bch-empty-')
      try {
        git(['init', '-q'], empty)
        git(['config', 'user.email', 'g@f.local'], empty)
        git(['config', 'user.name', 'g'], empty)
        mkdirSync(join(empty, 'docs'), { recursive: true })
        writeFileSync(join(empty, 'docs/a.md'), 'x\n', 'utf8')
        git(['add', '-A'], empty)
        git(['commit', '-q', '-m', 'empty'], empty)
        let threw = ''
        try {
          analyze(empty, 'head')
        } catch (e) {
          threw = e instanceof Undetermined ? 'undetermined' : `other:${e?.message}`
        }
        eq('R6 枚举到 0 个候选文件 ⇒ 判死而非记绿', threw, 'undetermined')
      } finally {
        rmScratch(empty)
      }
    } catch (e) {
      R.push(`❌ 端到端夹具跑挂了:${e?.message ?? e}`)
    } finally {
      if (dir) rmScratch(dir)
    }
    repoCases = R.length - before
  }
  for (const r of R) console.log(r)
  const failed = R.filter((r) => r.startsWith('❌')).length
  console.log(
    failed
      ? `❌ self-test 失败 ${failed}/${R.length} 条`
      : `✅ self-test 全通过(${R.length} 条 = 构造面 ${R.length - repoCases} + 临时 git 仓端到面 ${repoCases})`,
  )
  return failed ? 1 : 0
}

/** 自检夹具仓专用的 git(绝对路径 + windowsHide + timeout;真仓判定面一律走 face-reader)。 */
function git(args, cwd) {
  return execFileSync(gitBinary() || 'git', ['-c', 'safe.directory=*', '-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 32 << 20,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`[${GATE}] 脚本自身异常:${e?.message}\n${e?.stack}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  // 判据只此一份实现:镜像测试与自检都从这里取,不得在测试里再抄一份(§22c)。
  // findBooleanAckSends / sendSuccessObjects 也在这里 —— 惯例计数的取材与违规判据共用同一遍 send 扫描,
  // 镜像测试要复核"数到了什么"只能调这两个出口,不得自己再写一份正则。
  maskText,
  findWriteChains,
  findFunctionBodies,
  findCountSends,
  findBooleanAckSends,
  sendSuccessObjects,
  readExemptMarker,
  scanFileText,
  listCandidates,
  readCandidates,
  analyze,
  decide,
  formatReport,
  FIXTURES: FIX,
  SELF_SKIP,
  UNIQUE_OUTLET,
  EXEMPT_TOKEN,
  SCAN_DIRS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
