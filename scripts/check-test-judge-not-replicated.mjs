// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-test-judge-not-replicated.mjs — 「禁止在测试文件中复制源判据」(AGENTS §22c 红线)的尺子。
 * 台账票 G-1058642(2026-10-08 立)。
 *
 * 要拦的事:**同一个被审对象的形态清单/正则集,在门体(`scripts/check-*.mjs`)与它的镜像测试
 * (`scripts/tests/*.test.mjs`)里各写了一份**。这条红线今天只有散文,没有任何东西会因为它变红;
 * 于是每一次"测试改调门的生产入口"都靠人记得 §22c。更糟的是它漂开时**测试照样绿**——门体看不见
 * 某一形态,而自带一份形态清单的测试照样判得过,那是假绿不是漏报(§22c 成因记录原话)。
 *
 * 判据形状(两把都必须在,缺一只有一半牙):
 *   F1 全复制:镜像测试里的正则字面量 / `match|matchAll|test(` 的裁定文本,与门体形态清单的某一
 *      单元同料(归一化后互为子串,容得下 `\s*`、`\b`、字符类这类**书写差**),或清单连名带料两份。
 *   F2 半复制:测试 import 了门,却在**本文件内**声明自己的形态清单/正则常量,并把它用作裁定输入
 *      (`RE.test(x)` / `LIST.forEach((re) => re.test(y))`),且这条清单**与门体同名或与门体同料**。
 *      材料不同也判(同名 = 两条真相正在分叉);与门体既不同名也不同料的本地正则是测试自己的夹具,
 *      不算复制 —— 不收这一条,F2 会把每条测试正则都判成债(真仓 HEAD 面实测:这条闸门 + 清单名收紧
 *      之前 76 处"命中",收之后 27 处;单拆这条闸门的变异自证是 +3 处假红,数字记在台账取证里,
 *      不抄进注释 —— 抄进来就成了第二份会腐烂的真相)。
 *
 * 取材面(口径同 70/77/83/98/101/103/118):全量档 = **HEAD blob**;`--staged` = **索引 blob**;
 *   `--worktree` = 人工排查逃生舱(不得作为提交门禁)。两面旗同给 = 自相矛盾 ⇒ exit 2。
 *   清单与内容**同面同轮**。正文一律经 `scripts/lib/face-reader.mjs` 的 `catBatch`,门内不散写
 *   `git show`/磁盘读(守门 118:引了层又自己 git show = 半接线)。
 *   任一面内容取不到 ⇒ "无法判定" exit 2,**绝不回落成"没有违规"**(回落就是把没判写成判过了)。
 *   枚举到 0 个候选(扫不到镜像测试,或门体索引为空)⇒ 判死不记绿。
 *   ⚠ `--staged` 取的是**整张索引**(`ls-files`)而不是 staged delta:比 F1 必须同时拿到门体与测试
 *   两侧正文,delta 档会让"门体不在本次提交"的每一对必然无从比对 —— 那是面形状,不是豁免。
 *
 * 遮噪:只用 `scripts/lib/code-mask.mjs` 那一份分词器 —— `scanSpans` 出单元(注释里的散文不会以
 *   regex/string 身份出现,所以"解释这一型的注释"不会被判成站点,守门 131/134 那一课),
 *   `maskCommentsAndStrings`(等长)出结构面(找声明与调用位)。门内不再写第二台词法器。
 *
 * 放过通道(每条都有正反用例:见 `--self-test` 与镜像测试):
 *   P1 导出口裁定:测试把**门导出的常量**当输入(`import { __test__ as gate }` 后用 `gate.PATTERNS`)
 *      且本文件不复制材料 ⇒ 放过(这正是 §22c 要求的形状)。
 *   P2 形状锁:`assert.match(gateSrc, /…/)` 钉的是**源码写法**而不是"被审对象长什么样" ⇒ 放过。
 *      词法条件:调用形式是 `assert.*`;主语出处二选一 —— (a) 首 token 形如 `*Src|*Source|*Text|
 *      *Body|*Code|*Blob|*Raw|src|source|raw` **且**本文件确实读了某个文件的正文(readFileSync/catBatch/
 *      `git show`/`gitRaw(['show'…)`),(b) 该主语变量的**初值**里就有那次取正文调用(名字不参与判断)。
 *      (b) 是这一格补的:名字清单必然腐烂,HEAD 面多处形状锁的变量叫 `own`/`txt`/`ps`/`preset`。
 *      两条出处都不成立 ⇒ 不放过,落判定链后段,不冒判红也不静默放过。
 *      这一格是本票最难的地方,判据是词法而不是语义,所以它的保证只到"不误冒红"。
 *   P4 行为文案断言:`assert.match(res.out, /门自己打出的那句话/)` 与 `assert.match(lastLine(head.out), /…/)` ——
 *      测试跑生产入口(派生进程或门导出口)再断言它返回的**文本**,这正是 §22c 要求的"改调生产入口"形态,
 *      不是第二份判据 ⇒ 放过。判据是**数据流而不是主语叫什么**:主语本身、或它作为纯格式化 helper 的实参,
 *      其初值(含本文件 helper 一跳、成员链宿主一跳,封顶 2 跳)必须真含一次派生(spawnSync、execFileSync、
 *      fork、run-evidence)或确实是 import 进门体的符号调用。查不到出处就照旧命中 —— 属性名叫 `.out` 本身
 *      不构成证据,而"名字不像载体"也不再是拒绝理由(证据在链上,不在拼写上)。
 *   P3 行内出口:`judge-replica-exempt: <原因>`(原因必填,**只救本行**,不救整文件也不救同名族)。
 *
 * 定级:**默认档(全量)= 只报数并逐条点名**,退出码不参与红绿。§12e 写得明白:一条"存量必然非零"
 *   的判据直接 blocking,等于每次提交都逼人 `--no-verify`,连带废掉链上全部守门。`--strict` 是问责档:
 *   命中 ⇒ exit 1,未判定 ⇒ exit 2(拒绝出具合格证)。
 *   ⚠ 升 blocking 的前置(硬条件,不满足就别接线成红门):**真仓 HEAD 面现读命中数 = 0**,且存量逐条
 *   已按"改调门的生产入口"收口。改判据后必须重新现读,不许引用历史数字。
 *
 * 已知边界(如实报,不当成已闭环):
 *   · 门侧只收 `scripts/check-*.mjs`;`scripts/lib/*.mjs` 与其镜像测试不在比对面内 —— 票面把被审对象
 *     定义为"门体 ↔ 其镜像测试",扩到 lib 会变成"任何两份正则",不是这一票要的尺子。
 *   · SELF_EXEMPT 排掉本门自己的门体与镜像测试(它的测试必须摆判据夹具才能证明有牙,不排就自审自红);
 *     代价是本门对自身这一对**整族失明**,由镜像测试的方向锁与阳性对照代偿。
 *   · 同料比对靠 16 字符窗口分桶:门体形态写在测试里的**中间片段**(既不同前缀也不同后缀)会漏,
 *     这是 F1 的左向盲区;放宽分桶会淹没在噪声里,所以宁可漏到"未判定/看不见"也不冒红。
 *   · 唯一形数量超过 `MAX_FORMS`(护栏)时分桶退化为"前缀+后缀+整串",退化会打印在结论里,不静默。
 *
 * 手动:`node scripts/check-test-judge-not-replicated.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * **接线现状(2026-10-06 已入提交链)**:注册在 `scripts/guardian-runner.mjs`,定级 **warn**,
 * `skipEnv=HUSKY_SKIP_TEST_JUDGE_REPLICATED`、`stagedTriggers=['scripts/check-','scripts/tests/']`。
 * 定级不是随手定的:默认档只报数是因为真仓 HEAD 面现读**命中不为 0**,当场 blocking 就是一台与任何提交都无关的
 * 恒红门,唯一结局是各会话跳钩子、连带链上全部守门对该提交作废(§12e)。**升 blocking 的前置见本头注下一段。**
 * 行内豁免族 `judge-replica-exempt` **已同笔登记进守门 108**
 * (`scripts/check-exemption-expiry.mjs` 的 `FAMILY_LIFETIME_DAYS`)取 **30 天** —— 它豁免的是"测试里复制了
 * 源判据"这笔**待偿的收口债**(唯一出路 = 把判据从门体导出、测试改调生产入口),不是结构性定性,所以不取
 * 那一族的 365 天;108 对未登记族兜的是 `DEFAULT_LIFETIME_DAYS` = 90 天默认档,那条只保证"新族不隐身",
 * 不算登记。这条跨文件规矩由本文件的**镜像测试 T10** 钉住:族名现取门体自己的 `EXEMPT_MARK`,登记与否
 * 现取 108 自己的 `isFamilyRegistered`,两处都不靠人记得、也不在测试里手抄。
 */
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { maskCommentsAndStrings, scanSpans } from './lib/code-mask.mjs'
import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 60_000
/** 归一化后的最短形长度:短于此的正则到处都是同形,配不上"同一被审对象"。 */
const MIN_FRAG_LEN = 16
/** 无 import / 非同名 / 仅靠同锚点连起来时,只有强同形(≥ 此长)才允许落进 F1。 */
const STRONG_FRAG_LEN = 24
/** 分桶规模护栏(超过就退化为前缀+后缀+整串,并如实打印)。 */
const MAX_FORMS = 60_000
const WINDOW = 16

/** 本门这一对:镜像测试必须摆判据夹具,不排就自审自红(代价见头注"已知边界")。 */
const SELF_EXEMPT = [
  'scripts/check-test-judge-not-replicated.mjs',
  'scripts/tests/check-test-judge-not-replicated.test.mjs',
]

const GATE_RE = /^scripts\/check-[^/]+\.mjs$/
const MIRROR_TEST_RE = /^scripts\/tests\/[^/]+\.test\.mjs$/

/** 形态清单类声明名:门侧只有落在这类声明里的单元才算"判据本体"(基础设施正则不参与 F1)。 */
const CRITERION_WORD_RE =
  /(?:pattern|forms\b|form_|_form|needle|rules?\b|judges?\b|clause|signal|forbid|prohibit|disallow|denied|deny|ban_|_ban|regex|regexp|verdict|criteria|assertion)/i
const CRITERION_AFFIX_RE = /(?:^|_)(?:RE|REGEX|PATTERNS|FORMS|FORM_LIST|RULES|JUDGES|NEEDLES|CHECKS|CRITERIA)(?:_|$|\d)/
/** 取景/解析类声明名:同形也算漂移风险,但不是"被审对象的形态" ⇒ 未判定,不判红。 */
const SCOPE_NAME_RE =
  /(ext$|_ext$|^ext|path|exclud|ignore|skip|filter|scope|candidate|preselect|prefilter|header|parse|split|join|dir|target|self_?exempt|marker|line_?re|spec)/i
/** P2 形状锁的主语名(只认"某文件的正文"那一类,`content`/`line` 这类被审数据不算)。 */
const LOCK_SUBJECT_RE = /^(?:[A-Za-z0-9_$]*(?:Src|Source|SourceText|FileText|Body|Code|Blob|Raw)|src|source|raw)$/
/** 本文件确实有"取正文"的通路(P2 的第二条件;别名 import 也算,`readFileSync as readFsSync` 实测存在)。 */
const SOURCE_READ_RE =
  /read\w*File\w*\s*\(|catBatch\w*\s*\(|\bgit\s+show\b|\[\s*'show'\s*|from\s*'node:fs|from\s*"node:fs|gitRaw\s*\(\s*\[[^\]]{0,60}'show'/
/**
 * P4 的两种"文本出处":派生进程取文本 / 调用门体导出口拿返回值。缺出处就不放过 ——
 * 这一条与 P2 要求"确实读了正文"是同一条纪律:证据必须在数据流上,不在变量的拼写上。
 * 立由:§22c 的第三条正解就是"测试改调生产入口" —— 跑 CLI 或导出口再断言它打出的那句话,
 * 是行为断言,不是第二份判据;而 F1/F2 抓的是"测试自己声明一张清单拿去裁数据"。
 */
const RUN_TEXT_RE = /spawnSync|execSync|execFileSync|\bspawn\s*\(|\bexecFile\s*\(|\bfork\s*\(|runEvidence|run-evidence/
/**
 * 动态装载门体(`await import(pathToFileURL(SRC).href)`)。没有 `isDirectRun` 守卫的门,静态 import
 * 就等于把它的 CLI 主流程跑一遍(实测门 47 就是这样打死过一次测试进程),所以 §22c 那句"改调生产
 * 入口"在这一型**只能**走动态 import —— 把它当成"没出处"就是要求测试用不了的唯一正解。
 */
const MODULE_LOAD_RE = /\bawait\s+import\s*\(|\bimport\s*\(\s*(?:pathToFileURL|['"`]\.\.)/
/**
 * 出处链跳数上限(见 `carrierTraced` 的注释:为什么恰好要三跳才够到那条唯一合法入口)。
 * 抽成常量是为了让"某条臂是在测封顶本身"这件事能被镜像点名 —— 封顶值写死在函数体里时,
 * 把它从 3 改成 2 只需要动一个字符,而没有任何一条断言会因此翻红。
 */
const CARRIER_MAX_HOPS = 3
/** 行内出口:`judge-replica-exempt: <原因>`,原因必填,只救本行。 */
const EXEMPT_MARK = /judge-replica-exempt:\s*(\S[^\n]*)/

/**
 * 声明名像不像"形态清单"。裸 `const re = /…/` **刻意不算**(那太常见,拿它当判据清单会把
 * 测试自己的夹具全判成复制);取景/解析类名字一律先出局。
 */
function isCriterionName(name) {
  if (!name) return false
  if (SCOPE_NAME_RE.test(name)) return false
  return CRITERION_WORD_RE.test(name) || CRITERION_AFFIX_RE.test(name)
}

function normPath(rel) {
  return String(rel).split(sep).join('/')
}
function isSelfExempt(rel) {
  const p = normPath(rel)
  return SELF_EXEMPT.some((x) => p === x || p.startsWith(x))
}

function lineStarts(text) {
  const starts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1)
  return starts
}
function lineOf(starts, off) {
  let lo = 0
  let hi = starts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (starts[mid] <= off) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}

/** 书写差归一:`\s*`、`\b`、字符类、锚点与量词都不算"另一种形态"。 */
function normalizePattern(raw) {
  let s = String(raw)
  s = s.replace(/\\s[*+]?/g, '')
  s = s.replace(/\\[bB]/g, '')
  s = s.replace(/\[(?:\^)?[^\]]*\][*+?]*/g, 'X')
  s = s.replace(/\\[dDwWsS]/g, 'X')
  s = s.replace(/\(\?:/g, '(')
  s = s.replace(/\\(.)/g, '$1')
  s = s.replace(/[.^$*+?|]/g, (c) => (c === '.' ? '.' : ''))
  s = s.replace(/\s+/g, '')
  return s
}

/** 顶层 `|` 切分(括号/字符类内的不算分支),这样"三条形态写成一条大正则"也能逐条对上。 */
function splitAlternatives(body) {
  const parts = []
  let depth = 0
  let cls = false
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '\\') {
      cur += c + (body[i + 1] ?? '')
      i++
      continue
    }
    if (cls) {
      if (c === ']') cls = false
      cur += c
      continue
    }
    if (c === '[') {
      cls = true
      cur += c
      continue
    }
    if (c === '(' || c === '{') depth++
    else if (c === ')') depth--
    if (c === '|' && depth === 0) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  parts.push(cur)
  return parts.map(normalizePattern).filter((f) => f.length >= MIN_FRAG_LEN)
}

/** 声明取景:单行 `const X = /re/`,与多行 `const X = [ / ] {` 到收尾 ` ] / }`。 */
function declarationSpans(text) {
  const struct = maskCommentsAndStrings(text)
  const starts = lineStarts(struct)
  const decls = []
  const DECL_LINE = /^[\t ]*(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(.*)$/
  const LIST_TAIL = /[[{]\s*$/
  const LIST_END = /^[\t ]*[\]}]\s*(?:as\s+[A-Za-z0-9_$]+\s*)?[;,]?\s*$/
  for (let li = 0; li < starts.length; li++) {
    const s = starts[li]
    const e = li + 1 < starts.length ? starts[li + 1] : struct.length
    const line = struct.slice(s, e).replace(/\n$/, '')
    const m = DECL_LINE.exec(line)
    if (!m) continue
    const rest = m[2]
    if (LIST_TAIL.test(rest)) {
      let end = e
      for (let lj = li + 1; lj < starts.length; lj++) {
        const t = struct.slice(starts[lj], lj + 1 < starts.length ? starts[lj + 1] : struct.length)
        if (LIST_END.test(t.replace(/\n$/, ''))) {
          end = starts[lj] + t.length
          break
        }
      }
      decls.push({ name: m[1], start: s, end, kind: 'list' })
    } else if (rest === '') {
      // `const X =` 把值放到**下一行**:真仓反例(`d10fbebd14^` 的 `INLINE_CLAMP_RE`)正是这一型。
      // 续行不算进声明范围,自带判据就认不出来 —— 阳性对照会因此假绿,所以这里必须吃下续行。
      const indent = (line.match(/^[\t ]*/) || [''])[0].length
      let end = e
      for (let lj = li + 1; lj < starts.length; lj++) {
        const t = struct.slice(starts[lj], lj + 1 < starts.length ? starts[lj + 1] : struct.length).replace(/\n$/, '')
        if (!t.trim()) {
          end = starts[lj] + t.length
          continue
        }
        if ((t.match(/^[\t ]*/) || [''])[0].length <= indent) break
        end = starts[lj] + t.length
      }
      decls.push({ name: m[1], start: s, end, kind: 'single' })
    } else if (/\/[^\n]*\/[a-z]*(\s*[,;)\]}]|\s*$)/.test(rest) || /RegExp\s*\(/.test(rest)) {
      decls.push({ name: m[1], start: s, end: e, kind: 'single' })
    }
  }
  return decls
}
function declAt(decls, off) {
  let hit = null
  for (const d of decls) if (off >= d.start && off < d.end) hit = d
  return hit
}

/** 正则字面量的体(去掉定界符与 flags;flags 不参与同形比对)。 */
function regexBody(text, span) {
  const m = /^\/([\s\S]*)\/([a-z]*)$/.exec(text.slice(span.start, span.end))
  return m ? m[1] : null
}
function isRegExpArg(text, off) {
  return /RegExp\s*\(\s*$/.test(text.slice(Math.max(0, off - 24), off))
}

/** 单元 = 正则字面量的体 + 写成串的正则源(只认带转义的,免得把代码算例当成判据)。 */function extractUnits(text) {
  const starts = lineStarts(text)
  const decls = declarationSpans(text)
  const units = []
  for (const s of scanSpans(text)) {
    if (s.kind === 'regex') {
      const body = regexBody(text, s)
      if (body === null) continue
      units.push({ type: 'regex', body, start: s.start, end: s.end, line: lineOf(starts, s.start), decl: declAt(decls, s.start) })
    } else if (s.kind === 'string') {
      if (!s.body.includes('\\')) continue
      const decl = declAt(decls, s.start)
      const byName = decl && isCriterionName(decl.name)
      if (!isRegExpArg(text, s.start) && !byName) continue
      units.push({ type: 'string', body: s.body, start: s.start, end: s.end, line: lineOf(starts, s.start), decl })
    }
  }
  return units
}

/** 调用位:`.match(|.matchAll(|.test(` 与 `assert.(doesNot)Match(`;另收"清单被逐个拿去裁"的迭代位。 */
function matcherSites(text) {
  const struct = maskCommentsAndStrings(text)
  const starts = lineStarts(struct)
  const sites = []
  const RE = /\.(match|matchAll|test)\s*\(|\bassert\.(?:match|doesNotMatch|notMatch)\s*\(/g
  let m
  while ((m = RE.exec(struct)) !== null) {
    const isAssert = m[0].startsWith('assert')
    const openAt = m.index + m[0].length
    const window = struct.slice(openAt, openAt + 240)
    const firstArg = window.slice(0, topLevelComma(window))
    const receiver = (struct.slice(Math.max(0, m.index - 60), m.index).match(/[A-Za-z0-9_$]+[\s.]*$/) || [''])[0]
      .replace(/[.\s]+$/, '')
    sites.push({
      line: lineOf(starts, m.index),
      dotIdx: m.index,
      openAt,
      window,
      receiver,
      subject: isAssert ? firstArg.trim() : receiver,
      innerArg: firstArg.trim(),
      kind: isAssert ? 'assert' : 'proto',
    })
  }
  // `LIST.forEach((re) => re.test(x))` 这一型:清单本身没出现在 `.test(` 的括号里,
  // 但它的**每个元素都被拿去裁定** —— 不认这一型,F2 半复制就只剩 `.test(LIST)` 那一种写法能抓到。
  // 收紧条件:迭代调用的窗口里必须真的出现 `.test(|.match(|.matchAll(`,否则 `rows.map((r) => r.id)` 也算数。
  const ITER = /\.([A-Za-z0-9_$]*)\s*\(/g
  const LIST_USE = /^[A-Za-z0-9_$]+$/
  let it
  const LIST_RE = /\b([A-Za-z0-9_$]+)\.(forEach|some|every|filter|map|flatMap|find|findIndex|reduce)\s*\(/g
  void ITER
  void LIST_USE
  while ((it = LIST_RE.exec(struct)) !== null) {
    const openAt = it.index + it[0].length
    const window = struct.slice(openAt, openAt + 240)
    if (!/\.(test|match|matchAll)\s*\(|assert\.(?:match|doesNotMatch)\s*\(/.test(window)) continue
    sites.push({
      line: lineOf(starts, it.index),
      dotIdx: it.index,
      openAt,
      window,
      receiver: it[1],
      subject: '',
      innerArg: window.slice(0, topLevelComma(window)).trim(),
      kind: 'iter',
    })
  }
  return sites
}
function topLevelComma(window) {
  let depth = 0
  for (let i = 0; i < window.length; i++) {
    const c = window[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') {
      if (depth === 0) return i
      depth--
    } else if (c === ',' && depth === 0) return i
  }
  return window.length
}

/**
 * 一跳:初值里调的是**本文件自己声明的 helper** 时,把那个 helper 体一起拿来查出处。
 * 立由见 AGENTS「判据要允许同文件一跳委托」—— 把 `spawnSync` 提成 `runGate()` 是正当重构,
 * 只按字面初值判会让整族行为断言被算成"复制判据"(HEAD 面现读 6 处 `cli.out`/`w.out`/
 * `red.out`/`staged.out`/`head.out`/`costLine` 全是这一型)。只跳**一层**、只认同名函数声明,
 * 不做传递闭包,也不猜动态派发。
 */
function oneHopSource(text, init) {
  const callee = init === null ? null : (init.match(/^\s*(?:await\s+)?([A-Za-z0-9_$.]+)\s*\(/) || [])[1]
  if (!callee) return init
  const base = String(callee).split('.')[0]
  if (!/^[A-Za-z0-9_$]+$/.test(base)) return init
  const m = new RegExp(
    `function\\s+${base}\\b|(?:const|let|var)\\s+${base}\\s*=\\s*(?:async\\s*)?(?:function\\b|\\([^()]*\\)|[A-Za-z0-9_$]+)\\s*=>`,
  ).exec(text)
  if (!m) return init
  return `${init}\n${text.slice(m.index, m.index + 1200)}`
}

/**
 * P4 的出处链:`res.out` 的 `res` 可以是 ① 直接 spawnSync ② 本文件 helper 里的 spawnSync
 * ③ 门导出口(`gate.x()` / import 进来的符号)④ 成员链的宿主变量本身是①/②(`out.split(…)` 那种)。
 * 深度封顶 3 跳;跳不到出处就返回 false —— 放过必须拿得出证据,不是拿"看起来像输出"当证据。
 * 为什么是 3 而不是 2:§22d 的 `isDirectRun` 守卫在无该守卫的门上是**禁路**(顶层就是 CLI 主流程),
 * 那种门的镜像测试只剩一条合法入口 —— `const mod = await import(pathToFileURL(SRC).href)` →
 * `const { __test__ } = mod` → `const { fn } = __test__` → `const out = fn(…)`,
 * 断言的对象离真正的取正文/取模块动作恰好三跳。少一跳就等价于"按书写位置判,不按出处判"。
 */
function carrierTraced(text, tok, gateNames, depth = 0) {
  const headOf = (s) => String(s).split('.')[0]
  // 只认**静态 import 进来的门体符号**(§22c 的形状);光有一个叫 gate 的变量名不构成证据。
  const fromGate = (t) => gateNames.has(headOf(t))
  const init = initializerOf(text, tok)
  if (init === null) {
    const rhs = destructureRhsOf(text, tok) || tok
    if (gateNames.has(headOf(rhs))) return true
    return depth < CARRIER_MAX_HOPS && rhs !== tok && carrierTraced(text, rhs, gateNames, depth + 1)
  }
  // 多行箭头函数/函数体的初值只能截到首行 ⇒ 一跳取 helper 体,派生往往在那里面
  const hop = oneHopSource(text, init)
  const hit = (re) => re.test(init) || (hop !== init && re.test(hop))
  if (hit(RUN_TEXT_RE) || hit(MODULE_LOAD_RE) || hit(SOURCE_READ_RE)) return true
  const callee = (init.match(/^\s*(?:await\s+)?([A-Za-z0-9_$.]+)\s*\(/) || [])[1] || null
  if (!callee) return false
  if (fromGate(callee)) return true
  const head = headOf(callee)
  if (depth < CARRIER_MAX_HOPS && head !== tok && carrierTraced(text, head, gateNames, depth + 1)) return true
  return false
}

/** `lastLine(head.out, 2)` → 顶层实参里的标识符首段(`['head']`);嵌套括号内的实参也按顶层逗号切。 */
function callArgTokens(subjStr) {
  const open = subjStr.indexOf('(')
  if (open < 0 || !/^[A-Za-z0-9_$.]+\s*\(/.test(subjStr)) return []
  const inner = subjStr.slice(open + 1)
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of inner) {
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) {
        out.push(cur)
        break
      }
      depth--
    } else if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  return out
    .map((a) => (a.match(/[A-Za-z0-9_$]+/) || [''])[0])
    .filter((t) => t && !/^\d/.test(t))
}

/**
 * `const { a, b } = gate` 这种解构形:成员本身没有独立初值,但它的**出处就是等号右边那个符号**。
 * §22c 要求的正是这种形状(判据一律走静态 import 的导出口),不认它就是把"已经改调生产入口"的测试
 * 继续算成复制判据 —— 而 HEAD 面 RF-4 那一格就是这个形态。
 */
function destructureRhsOf(text, tok) {
  const esc = String(tok).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const m of text.matchAll(/(?:const|let|var)\s*\{([^{}]*)\}\s*=\s*([A-Za-z0-9_$.]+)/g)) {
    if (new RegExp(`(^|[,{\\s])${esc}(\\s*:[^,}]+)?\\s*(,|$|\\s})`).test(m[1])) return m[2]
  }
  return null
}

/** 取 `const <name> = <初值>` 的初值文本(找不到返回 null);只截到首个行尾分号/换行前的 400 字符。 */
function initializerOf(text, name) {
  if (!name) return null
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`(?:const|let|var)\\s+${esc}\\s*=([\\s\\S]{0,400}?)(?:;\s*\n|\n|$)`).exec(text)
  return m ? m[1] : null
}

/**
 * 从"门路径"import 进来的**本地符号名**。P4 用它判定"这段文本是门自己产出的",
 * 而不是把整个文件的任意调用都当导出口(那等于给任意被审数据发合格证)。
 */
function gateSymbolNames(text) {
  const out = new Set()
  for (const m of text.matchAll(
    /import\s+(?:\{([^}]*)\}|\*\s+as\s+([A-Za-z0-9_$]+)|([A-Za-z0-9_$]+))?\s*(?:,\s*\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g,
  )) {
    if (!/^\.\.\/check[^/]+\.mjs$/.test(m[5] || '')) continue
    for (const grp of [m[1], m[4]]) {
      if (!grp) continue
      for (const part of grp.split(',')) {
        const nm = part.trim().split(/\s+as\s+/).pop()
        if (nm && /^[A-Za-z0-9_$]+$/.test(nm)) out.add(nm)
      }
    }
    if (m[2]) out.add(m[2])
    if (m[3]) out.add(m[3])
  }
  return out
}

/** 单元在这一文件里的角色:拿去裁别人(pattern 位)/ 钉源码写法(形状锁)/ 断言执行返回的文案(行为锁)/ 只是摆着的料。 */
function unitRole(unit, sites, text, ctx) {
  const hasSourceRead = ctx.hasSourceRead
  const name = unit.decl ? unit.decl.name : null
  const nameRe = name ? new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`) : null
  for (const s of sites) {
    const asArg = unit.start >= s.openAt && unit.start < s.openAt + 240
    const nameInArgs = !!nameRe && nameRe.test(s.window)
    const asReceiver = !!name && s.receiver === name
    const literalBefore = !name && unit.end <= s.dotIdx && unit.end >= s.dotIdx - 80 && /^\s*$/.test(text.slice(unit.end, s.dotIdx))
    if (!(asArg || nameInArgs || asReceiver || literalBefore)) continue
    const subject = asArg ? s.innerArg : s.subject || s.innerArg
    const subjStr = String(subject).trim()
    const toks = subjStr.match(/[A-Za-z0-9_$.]+/) || ['']
    const firstTok = toks[0].split('.').pop()
    const baseTok = toks[0].split('.')[0]
    const initRaw = initializerOf(text, baseTok)
    const initForLock = initRaw === null ? null : oneHopSource(text, initRaw)
    const tracedBody = initForLock !== null && SOURCE_READ_RE.test(initForLock)
    const shapeLock =
      s.kind === 'assert'
        ? // 两条出处任一:P2a 主语名字就是"某文件正文"(旧口径,要求本文件有取正文通路);
          // P2b 主语变量的**初值**真的来自一次取正文 —— 名字清单必然腐烂,HEAD 面多处形状锁的
          // 变量叫 own/txt/ps/preset,没一个叫 *Src,却被当成"复制判据"点了名。
          ((LOCK_SUBJECT_RE.test(firstTok) && hasSourceRead) || tracedBody)
        : // `.test()` 这一路只认查得到出处的:词法器把 `assert.ok(!/…/.test(own))` 记成 proto 位
          // (它只认到 `.test(`,看不见外面的 assert.ok),旧写法要求 kind 必须是 assert,于是整族
          // 源码形状锁被算成命中。放宽的是"调用写法",不是"出处证据"。
          tracedBody
    /**
     * P4:这次断言吃的文本,沿数据流能查到确是"某次派生/门导出口"产出的 —— 证据在链上,
     * 不在主语拼写上(旧口径要求属性名像 `.out`/`.err`,于是 `costLine`、`lastLine(head.out)`
     * 这类同一条事实的写法整族看不见;反过来,光有个 `.out` 名字而查不到派生也不放过)。
     */
    let behaviorText = false
    if (s.kind === 'assert' || s.kind === 'proto') {
      // 主语自己查不到出处时,再看它是不是"把派生结果喂给一个纯格式化 helper"
      // (`assert.match(lastLine(head.out), /…/)` 那一型):断言对象的**实参**才是文本载体。
      const argToks = callArgTokens(subjStr)
      const traced =
        carrierTraced(text, baseTok, ctx.gateNames) || argToks.some((t) => carrierTraced(text, t, ctx.gateNames))
      behaviorText = traced
    }
    return { atPattern: true, shapeLock, behaviorText, subject: subjStr.slice(0, 40), kind: s.kind }
  }
  const declared = !!unit.decl && (isCriterionName(unit.decl.name) || unit.decl.kind === 'list')
  return { atPattern: false, shapeLock: false, behaviorText: false, subject: '', declared }
}

/** 门侧索引:唯一形 → 出处清单;并按 16 字符窗口分桶以容纳书写差。 */
function gateIndex(gateContents) {
  const forms = new Map()
  const buckets = new Map()
  const names = new Set()
  /** 名字 → **是哪道门持有的**(F2 的"清单同名"只认被 import 的那道门,见 audit 内注释)。 */
  const namesByGate = new Map()
  /** 形态 → **是哪道门持有的**(F2 的"材料与门体同形"同理,只认被 import 的那道门)。 */
  const formsByGate = new Map()
  let gateFiles = 0
  let degraded = false
  for (const [rel, text] of Object.entries(gateContents)) {
    if (isSelfExempt(rel)) continue
    gateFiles++
    const exported = new Set(
      ((text.match(/export\s+const\s+__test__\s*=\s*\{([\s\S]{0,1200}?)\n\}/) || [])[1] || '')
        .split(',')
        .map((x) => (x.match(/([A-Za-z0-9_$]+)\s*:?/) || [])[1])
        .filter(Boolean),
    )
    for (const u of extractUnits(text)) {
      const name = u.decl ? u.decl.name : null
      let role = 'inline'
      if (name) {
        if (SCOPE_NAME_RE.test(name)) role = 'scope'
        else if (isCriterionName(name) || u.decl.kind === 'list') role = 'criterion'
        else role = 'topconst'
      }
      if (name && exported.has(name)) role = 'criterion'
      if (name && role !== 'scope') names.add(name)
      if (name && role !== 'scope') {
        if (!namesByGate.has(rel)) namesByGate.set(rel, new Set())
        namesByGate.get(rel).add(name)
      }
      for (const frag of splitAlternatives(u.body)) {
        if (!forms.has(frag)) forms.set(frag, [])
        forms.get(frag).push({ gate: rel, line: u.line, name, role, type: u.type })
        if (!formsByGate.has(rel)) formsByGate.set(rel, new Set())
        formsByGate.get(rel).add(frag)
      }
    }
  }
  if (forms.size > MAX_FORMS) degraded = true
  for (const frag of forms.keys()) {
    const keys = degraded ? [frag.slice(0, WINDOW), frag.slice(-WINDOW), frag] : [frag]
    if (!degraded) {
      for (let i = 0; i + WINDOW <= frag.length; i++) keys.push(frag.slice(i, i + WINDOW))
    }
    for (const k of keys) {
      if (k.length < WINDOW && k !== frag) continue
      if (!buckets.has(k)) buckets.set(k, [])
      buckets.get(k).push(frag)
    }
  }
  return { forms, formsByGate, buckets, names, namesByGate, gateFiles, degraded, formCount: forms.size }
}

function pathLiterals(text) {
  const out = new Set()
  for (const s of scanSpans(text)) {
    if (s.kind !== 'string') continue
    if (/^[A-Za-z0-9_@./-]+\.(mjs|js|ts|tsx|jsx|json|md|sql|py|wxss|css)$/.test(s.body) && s.body.includes('/')) out.add(s.body)
  }
  return out
}
function importMap(testText) {
  const out = []
  for (const s of scanSpans(testText)) {
    if (s.kind !== 'string') continue
    const m = /^\.\.\/(check[^/]+\.mjs)$/.exec(s.body)
    if (m) out.push(`scripts/${m[1]}`)
  }
  return [...new Set(out)]
}
function mirrorNameCandidates(testRel) {
  const base = testRel.split('/').pop().replace(/\.test\.mjs$/, '')
  return [...new Set([`scripts/check-${base}.mjs`, `scripts/${base}.mjs`])]
}
function exemptReason(rawLines, line) {
  const t = rawLines[line - 1]
  if (typeof t !== 'string') return null
  const m = EXEMPT_MARK.exec(t)
  return m ? m[1].trim() : null
}

/** 归一化同形:整串相等,或一侧是另一侧的子串(容书写差)。 */
function fragMatch(testFrag, gateFrag) {
  if (!testFrag || !gateFrag) return null
  if (testFrag === gateFrag) return 'same'
  if (gateFrag.length >= MIN_FRAG_LEN && testFrag.includes(gateFrag)) return 'contains'
  if (testFrag.length >= MIN_FRAG_LEN && gateFrag.includes(testFrag)) return 'contained'
  return null
}
function candidatesFor(testFrag, index) {
  const set = new Set()
  if (index.forms.has(testFrag)) set.add(testFrag)
  if (testFrag.length >= WINDOW) {
    for (let i = 0; i + WINDOW <= testFrag.length; i++) {
      for (const f of index.buckets.get(testFrag.slice(i, i + WINDOW)) || []) set.add(f)
    }
  } else if (testFrag.length >= MIN_FRAG_LEN) {
    for (const f of index.buckets.get(testFrag) || []) set.add(f)
  }
  return [...set]
}

function rankOf(state) {
  return state === 'hit' ? 3 : state === 'undetermined' ? 2 : 1
}

function audit(contents, { strict = false } = {}) {
  const gateContents = {}
  const testContents = {}
  for (const [rel, text] of Object.entries(contents)) {
    const p = normPath(rel)
    if (isSelfExempt(p)) continue
    if (GATE_RE.test(p)) gateContents[p] = text
    else if (MIRROR_TEST_RE.test(p)) testContents[p] = text
  }
  const index = gateIndex(gateContents)
  const tests = Object.keys(testContents).sort()
  if (tests.length === 0) throw new Undetermined('枚举到 0 个镜像测试(scripts/tests/*.test.mjs)—— 空扫不记绿')
  if (index.gateFiles === 0) throw new Undetermined('枚举到 0 个门体(scripts/check-*.mjs)—— 索引为空,尺子无从比对')
  if (index.formCount === 0) throw new Undetermined('门体索引里 0 条形态(唯一形枚举为空)—— 空扫不记绿')

  const items = []
  const seen = new Set()
  const push = (rec) => {
    const key = `${rec.state}\u0000${rec.test}\u0000${rec.gate}\u0000${rec.gateName || ''}\u0000${rec.shape}`
    if (seen.has(key)) return
    seen.add(key)
    const prevIdx = items.findIndex((i) => i.test === rec.test && i.gate === rec.gate && i.shape === rec.shape)
    if (prevIdx >= 0 && rankOf(items[prevIdx].state) >= rankOf(rec.state)) return
    if (prevIdx >= 0) items[prevIdx] = rec
    else items.push(rec)
  }

  let p1Files = 0
  for (const testRel of tests) {
    const text = testContents[testRel]
    const rawLines = text.split('\n')
    const struct = maskCommentsAndStrings(text)
    const hasSourceRead = SOURCE_READ_RE.test(text) || SOURCE_READ_RE.test(struct)
    const units = extractUnits(text)
    const sites = matcherSites(text)
    const imports = importMap(text)
    const mirrors = mirrorNameCandidates(testRel).filter((x) => gateContents[x] !== undefined)
    const usesGateExports = /\bgate\s*\.\s*[A-Za-z0-9_$]+|\b__test__\s*\.\s*[A-Za-z0-9_$]+/.test(struct)
    /** P4 的出处集:从门文件 import 进来的本地符号名(含 `* as` 与默认导入)。 */
    const ctx = { hasSourceRead, gateNames: gateSymbolNames(text) }
    // 每个声明里到底有几个单元:光"是个 list"不够,`const appJson = { … }` 这种数据块也满足 list 形状,
    // 里面 0~1 条正则就说明它不是形态清单(把数据块判成"自带清单"是假阳,不是抓漏)。
    const listUnitCount = new Map()
    for (const u of units) if (u.decl) listUnitCount.set(u.decl.start, (listUnitCount.get(u.decl.start) || 0) + 1)

    const ownListUnits = units.filter((u) => u.decl && isCriterionName(u.decl.name) && splitAlternatives(u.body).length > 0)
    if (imports.length > 0 && usesGateExports && ownListUnits.length === 0) {
      p1Files++
      push({ state: 'pass', test: testRel, testLine: 0, gate: imports[0], gateLine: 0, gateName: '', shape: 'P1', frag: '', why: `P1 经门导出口裁定(import ${imports.join(', ')})`, excerpt: '' })
    }

    for (const u of units) {
      const frags = splitAlternatives(u.body)
      if (frags.length === 0) continue
      const role = unitRole(u, sites, text, ctx)
      const reason = exemptReason(rawLines, u.line)
      const declaredList = !!(u.decl && (isCriterionName(u.decl.name) || (u.decl.kind === 'list' && listUnitCount.get(u.decl.start) >= 2)))
      for (const f of frags) {
        for (const gf of candidatesFor(f, index)) {
          const how = fragMatch(f, gf)
          if (!how) continue
          for (const ent of index.forms.get(gf)) {
            const gateRel = ent.gate
            const l1 = imports.includes(gateRel)
            const l2 = mirrors.includes(gateRel)
            const anchor = !l1 && !l2 && gateContents[gateRel] ? [...pathLiterals(text)].find((p) => pathLiterals(gateContents[gateRel]).has(p)) || null : null
            const sameName = !!ent.name && !!u.decl && ent.name === u.decl.name
            let state
            let why
            if (reason) {
              state = 'pass'
              why = `P3 行内豁免:${reason}`
            } else if (ent.role === 'scope') {
              state = 'undetermined'
              why = `门侧 ${ent.name} 是取景/解析谓词(不是被审对象的形态)⇒ 同形只算漂移风险,逐条点名不判红`
            } else if (role.shapeLock) {
              state = 'pass'
              why = `P2 形状锁:主语 ${role.subject} 是某文件的正文,钉的是写法不是被审对象形态`
            } else if (role.behaviorText) {
              state = 'pass'
              why = `P4 行为文案断言:主语 ${role.subject} 的初值来自一次派生/门体导出口调用,断的是门自己打出的那句话(§22c 的"改调生产入口"形态),不是第二份判据`
            } else if (!role.atPattern && !declaredList) {
              state = 'undetermined'
              why = `与门体形态同料(${how}),但该单元在本文件既不在调用位也不在清单声明里 —— 认不出是判据还是数据`
            } else if (ent.role === 'topconst' && !sameName && !l1 && !l2) {
              state = 'undetermined'
              why = `同料但门侧是顶层单值常量(${ent.name || 'inline'}),未证实它是形态清单`
            } else if (l1 || l2) {
              state = 'hit'
              why = sameName
                ? `F1 同名同料:清单名 ${ent.name} 与材料在两处各写一份(${how})`
                : `F1 同料:${l1 ? '测试 import 了该门' : '同名镜像对'}却把材料又写了一遍(${how})`
            } else if (anchor && f.length >= STRONG_FRAG_LEN) {
              state = 'hit'
              why = `F1 同锚点强料:两面都点名 ${anchor} 且形态同形(${how})`
            } else {
              state = 'undetermined'
              why = anchor
                ? `同锚点(${anchor})但形长 ${f.length} < 强同形阈值 ${STRONG_FRAG_LEN},不冒判红`
                : sameName
                  ? `同名清单 ${ent.name} 住在 ${gateRel},而本文件既不 import 它、也不是它的镜像 ⇒ 不能算复制这道门的判据(跨门同名),逐条点名待裁`
                  : '材料同形却无 import / 同名 / 同锚点关系,无法确认两面审的是同一对象'
            }
            push({
              state,
              test: testRel,
              testLine: u.line,
              gate: gateRel,
              gateLine: ent.line,
              gateName: ent.name,
              shape: 'F1',
              frag: f,
              why,
              excerpt: (rawLines[u.line - 1] || '').trim().slice(0, 96),
            })
          }
        }
      }
    }

    if (imports.length > 0) {
      for (const u of ownListUnits) {
        const role = unitRole(u, sites, text, ctx)
        // 形状锁与行为文案锁都不算"另立第二份判据":前者钉源码写法,后者钉门自己打出的那句话
        // (§22c 的正解就是"改调生产入口再断言输出")。两条都在这里静默出局,不静默记绿 —— F1 那一遍
        // 仍会为同一条材料写出 P2/P4 的放过记录与理由,报告里查得到是"哪一格、为什么放过"。
        if (!role.atPattern || role.shapeLock || role.behaviorText) continue
        // F2 也要"对得上同一个被审对象":清单名与门体同名,或材料与门体同形 —— 两条都不满足的本地
        // 正则是测试自己的夹具(测试当然要有自己的断言正则),把它判成复制源判据是假阳。
        const ownGate = imports[0]
        const ownNames = index.namesByGate.get(ownGate) || new Set()
        const ownForms = index.formsByGate.get(ownGate) || new Set()
        const fragsOfU = splitAlternatives(u.body)
        // F2 的两个链接条件都只认**被 import 的那道门**。此前"同名"与"同料"都查全部门的全局集合,
        // 于是"测试 import 门 A、而那条清单的名字与材料其实住在门 B"会被报成复制了 A 的判据,
        // 而报告里的归因门还是 A —— 实测假阳:check-public-path-probe 的 CALL_RE(门 A 既无此名也无此料,
        // 全仓另有十几道门用 CALL_RE 这个名字)。别门确实持有时也**不静默放过**:落未判定并点名
        // 真正持有者 —— 待裁不是判死,而"把没判写成判过了"与"错怪一道门"同样是造合格证。
        const overlapOwn = fragsOfU.some((f) =>
          candidatesFor(f, index).some((gf) => ownForms.has(gf)),
        )
        const nameLinked = ownNames.has(u.decl.name)
        const allGates = new Set([...index.namesByGate.keys(), ...index.formsByGate.keys()])
        const otherHolder = nameLinked
          ? null
          : [...allGates].find(
              (g) =>
                g !== ownGate &&
                ((index.namesByGate.get(g) || new Set()).has(u.decl.name) ||
                  fragsOfU.some((f) =>
                    candidatesFor(f, index).some((gf) =>
                      (index.formsByGate.get(g) || new Set()).has(gf),
                    ),
                  )),
            ) || null
        if (!overlapOwn && !nameLinked && !otherHolder) continue
        const reason = exemptReason(rawLines, u.line)
        const crossGateOnly = !overlapOwn && !nameLinked && !!otherHolder
        push({
          state: reason ? 'pass' : crossGateOnly ? 'undetermined' : 'hit',
          test: testRel,
          testLine: u.line,
          gate: otherHolder || ownGate,
          gateLine: 0,
          gateName: u.decl.name,
          shape: 'F2',
          frag: normalizePattern(u.body).slice(0, 40),
          why: reason
            ? `P3 行内豁免:${reason}`
            : crossGateOnly
              ? `同名清单 ${u.decl.name} 住在 ${otherHolder} 而本文件 import 的是 ${ownGate}(该门无此名)⇒ 不能算复制本门判据,但同名者确实存在 ⇒ 未判定点名待裁`
              : `F2 半复制:import 了门却自带清单 ${u.decl.name} 并用作裁定输入(${nameLinked ? '清单同名' : '材料与门体同形'})`,
          excerpt: (rawLines[u.line - 1] || '').trim().slice(0, 96),
        })
      }
    }
  }

  const c = {
    testsScanned: tests.length,
    gatesIndexed: index.gateFiles,
    formCount: index.formCount,
    p1Files,
    hits: items.filter((i) => i.state === 'hit').length,
    passes: items.filter((i) => i.state === 'pass').length,
    undetermined: items.filter((i) => i.state === 'undetermined').length,
  }
  return { items, counts: c, red: c.hits > 0, degraded: index.degraded, strict }
}

/** 清单与内容同面同轮:HEAD→ls-tree、索引→ls-files(整张索引,理由见头注)、工作树→ls-files+untracked。 */
function listFace(face, root) {
  let raw
  if (face === 'head') {
    raw = gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', 'scripts'], root, { timeout: GIT_TIMEOUT })
  } else if (face === 'staged') {
    raw = gitRaw(['ls-files', '-z', '--', 'scripts'], root, { timeout: GIT_TIMEOUT })
  } else {
    raw = [
      ...gitRaw(['ls-files', '-z', '--', 'scripts'], root, { timeout: GIT_TIMEOUT }).split('\0'),
      ...gitRaw(['ls-files', '--others', '--exclude-standard', '-z', '--', 'scripts'], root, { timeout: GIT_TIMEOUT }).split('\0'),
    ].join('\0')
  }
  if (typeof raw !== 'string') throw new Undetermined(`${face} 面清单枚举失败`)
  const out = new Set()
  for (const p of raw.split('\0')) {
    if (!p) continue
    const q = normPath(p)
    if (GATE_RE.test(q) || MIRROR_TEST_RE.test(q)) out.add(q)
  }
  return [...out]
}

function readFace(face, root = ROOT) {
  const paths = listFace(face, root)
  if (paths.length === 0) throw new Undetermined(`枚举到 0 个候选文件(${face} 面,scripts/check-*.mjs + scripts/tests/*.test.mjs)—— 空扫不记绿`)
  const contents = {}
  const missing = []
  if (face === 'worktree') {
    for (const p of paths) {
      const text = readWorktreeFile(root, p)
      if (typeof text !== 'string') missing.push(p)
      else contents[p] = text
    }
  } else {
    const prefix = face === 'staged' ? '' : 'HEAD'
    const specs = paths.map((p) => `${prefix}:${p}`)
    const got = catBatch(root, specs, { timeout: 120_000 })
    for (let i = 0; i < paths.length; i++) {
      const text = got.get(specs[i])
      if (typeof text !== 'string') missing.push(paths[i])
      else contents[paths[i]] = text
    }
  }
  if (missing.length > 0) throw new Undetermined(`${face} 面内容取不到 ${missing.length} 个文件,首个:${missing[0]}`)
  return contents
}

function main(argv, root = ROOT) {
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree') })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    return 2
  }
  const face = picked.face
  try {
    const res = audit(readFace(face, root), { strict })
    const c = res.counts
    if (json) console.log(JSON.stringify({ face, ...res }, null, 2))
    else {
      console.log(
        `判定面 = ${face} · 门体 ${c.gatesIndexed} 份(唯一形态 ${c.formCount} 条${res.degraded ? ' · 分桶已退化为前缀+后缀+整串' : ''})· 镜像测试 ${c.testsScanned} 份(本门一对按 SELF_EXEMPT 排除)`,
      )
      for (const i of res.items) {
        const tag = i.state === 'hit' ? '✗ 命中' : i.state === 'pass' ? '· 放过' : '? 未判定'
        console.log(
          `  ${tag}[${i.shape}] ${i.test}:${i.testLine} ⇄ ${i.gate || '—'}${i.gateLine ? `:${i.gateLine}` : ''} ${i.why}${i.excerpt ? ` 「${i.excerpt}」` : ''}`,
        )
      }
      console.log(`三态读数(不并桶):命中 = ${c.hits} · 放过 = ${c.passes}(P1 导出口裁定文件 ${c.p1Files} 份)· 未判定 = ${c.undetermined}`)
      console.log(
        strict
          ? c.hits > 0
            ? `结论:--strict 问责档 ⇒ 判红(命中 ${c.hits} 处,未判定 ${c.undetermined} 处)`
            : c.undetermined > 0
              ? `结论:--strict 问责档 ⇒ 出具不了合格证(未判定 ${c.undetermined} 处)`
              : '结论:--strict 问责档 ⇒ 通过(命中 0 · 未判定 0)'
          : '结论:默认档只报数并逐条点名,不参与红绿(升 blocking 的前置 = 真仓 HEAD 面现读命中 = 0)',
      )
    }
    if (strict && c.hits > 0) return 1
    if (strict && c.undetermined > 0) return 2
    return 0
  } catch (e) {
    if (e instanceof Undetermined) {
      console.error(`❌ 无法判定(不记为通过):${e.message}`)
      return 2
    }
    console.error(`❌ 脚本自身异常:${e && e.stack ? e.stack : e}`)
    return 2
  }
}

/** 构造面自检:判据有牙只能靠"它应当红的夹具"证明,不能只看它此刻的颜色。 */
function selfTest() {
  const results = []
  const t = (name, cond) => results.push({ name, ok: cond === true, isFn: typeof cond === 'function' })

  const GATE = 'scripts/check-demo-judge.mjs'
  const TEST = 'scripts/tests/check-demo-judge.test.mjs'
  // 夹具用 String.raw,免得"字符串里的字符串"两层转义把正则本身写歪
  const GFORM = String.raw`Math\.max\(\s*0\s*,\s*Math\.min\(\s*100\b`
  const TFORM = String.raw`Math\.max\(\s*0\s*,\s*Math\.min\(\s*100\s*,`
  const OTHER = String.raw`Some\.weird\(pattern,\s*"x"\)`
  const gateBody = `const PATTERNS = [\n  { why: '内联钳位', re: /${GFORM}/ },\n]\nexport function findSites() { return [] }\nexport const __test__ = {\n  PATTERNS,\n}\n`
  const fullCopy = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst PATTERNS = [/${TFORM}/]\nPATTERNS.forEach((re) => re.test(line))\nvoid gate\n`
  const sanctioned = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst sites = lines.filter((l) => gate.PATTERNS.some(({ re }) => re.test(l)))\n`
  const shapeLock = `import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nconst gateSrc = readFileSync('scripts/check-demo-judge.mjs', 'utf8')\nassert.match(gateSrc, /${GFORM}/)\n`
  const exempted = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst PATTERNS = [/${TFORM}/] // judge-replica-exempt: 门体尚未导出这一形态,先钉住再收口\nPATTERNS.forEach((re) => re.test(line))\nvoid gate\n`
  const noReason = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst PATTERNS = [/${TFORM}/] // judge-replica-exempt:\nPATTERNS.forEach((re) => re.test(line))\nvoid gate\n`
  const halfCopy = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst PATTERNS = [/${OTHER}/]\nPATTERNS.forEach((re) => re.test(line))\nvoid gate\n`
  const ownFixture = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst MY_FORMS = [/${OTHER}/]\nMY_FORMS.forEach((re) => re.test(line))\nvoid gate\n`
  const a = (map, opts) => audit(map, opts || {})
  const first = (r) => r.items.filter((i) => i.shape === 'F1')[0]

  t('F1 全复制(import 门又重述材料)⇒ 命中', (() => { const r = a({ [GATE]: gateBody, [TEST]: fullCopy }); return r.counts.hits >= 1 && !!first(r) })())
  t('§22c 合规形状(经导出口裁定)⇒ 0 命中', a({ [GATE]: gateBody, [TEST]: sanctioned }).counts.hits === 0)
  t('P1 通道:合规形状被记成放过而不是静默', (() => { const r = a({ [GATE]: gateBody, [TEST]: sanctioned }); return r.counts.passes >= 1 && r.counts.p1Files === 1 })())
  t('P2 形状锁不被冒判红(assert.match 钉 gateSrc 且本文件读了正文)', (() => { const r = a({ [GATE]: gateBody, [TEST]: shapeLock }); return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P2')) })())
  t('F2 半复制(import 门却自带同名清单当裁定输入)⇒ 命中', (() => { const r = a({ [GATE]: gateBody, [TEST]: halfCopy }); return r.items.some((i) => i.shape === 'F2' && i.state === 'hit') })())
  t('测试自己的夹具正则(与门体不同名也不同料)不算 F2', (() => { const r = a({ [GATE]: gateBody, [TEST]: ownFixture }); return !r.items.some((i) => i.shape === 'F2') })())
  // 同名清单属于**另一道门**时,不得把 F2 记在被 import 的那道门上(实测假阳:public-path-probe 的 CALL_RE)。
  const GATE_B = 'scripts/check-other-judge.mjs'
  const gateBOther = `const CALL_RE = [/${OTHER}/]\nexport function probe() { return [] }\nexport const __test__ = {\n  CALL_RE,\n}\n`
  const crossName = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst CALL_RE = [/${OTHER}/]\nCALL_RE.forEach((re) => re.test(line))\nvoid gate\n`
  // 反例(锁住"收窄没有把真复制一起削掉"):同名清单就在被 import 的那道门里 ⇒ 仍判命中
  const gateOwnOther = `const PATTERNS = [\n  { why: '内联钳位', re: /${GFORM}/ },\n]\nconst CALL_RE = [/${OTHER}/]\nexport const __test__ = {\n  PATTERNS,\n  CALL_RE,\n}\n`
  t('同名清单住在别门 ⇒ 不判 F2 命中,但落未判定并点名真正持有者', (() => {
    const r = a({ [GATE]: gateBody, [GATE_B]: gateBOther, [TEST]: crossName })
    const i = r.items.find((x) => x.shape === 'F2')
    return (
      r.counts.hits === 0 &&
      !!i &&
      i.state === 'undetermined' &&
      i.gate === GATE_B &&
      /不能算复制本门判据/.test(i.why)
    )
  })())
  t('同名清单就在被 import 的那道门里 ⇒ F2 照旧命中(收窄没有削掉真复制)', (() => {
    const r = a({ [GATE]: gateOwnOther, [TEST]: crossName })
    return r.items.some((x) => x.shape === 'F2' && x.state === 'hit')
  })())
  t('P3 行内出口(带原因)只救本行', (() => { const r = a({ [GATE]: gateBody, [TEST]: exempted }); return r.counts.hits === 0 && r.items.some((i) => i.why.startsWith('P3')) })())
  t('P3 缺原因不算出口 ⇒ 仍命中', (() => { const r = a({ [GATE]: gateBody, [TEST]: noReason }); return r.counts.hits >= 1 })())
  t('注释里的散文不被判成站点(遮噪只一份)', (() => { const r = a({ [GATE]: gateBody, [TEST]: `// gate.PATTERNS 里那条 /${TFORM}/ 是反面教材,本行不该被当站点\n` }); return r.counts.hits === 0 && r.items.length === 0 })())
  t('同形容书写差(\\s* 与 \\b 的差异不算另一形态)', (() => {
    const n = splitAlternatives(GFORM)[0]
    const m = splitAlternatives(TFORM)[0]
    return fragMatch(m, n) !== null
  })())
  t('短正则不配称同一被审对象(噪声下限)', splitAlternatives(String.raw`x\d+`).length === 0)
  t('枚举到 0 个镜像测试 ⇒ 判死不记绿', (() => { try { a({ [GATE]: gateBody }); return false } catch (e) { return e instanceof Undetermined } })())
  t('枚举到 0 个门体 ⇒ 判死不记绿', (() => { try { a({ [TEST]: sanctioned }); return false } catch (e) { return e instanceof Undetermined } })())
  t('本门这一对 SELF_EXEMPT,不自审自红', isSelfExempt('scripts/tests/check-test-judge-not-replicated.test.mjs'))
  t('--strict 下有命中即判红', a({ [GATE]: gateBody, [TEST]: fullCopy }, { strict: true }).red === true)
  t('取景/解析谓词同形不判红', (() => {
    const g = 'const TEST_PATH_RE = /(^|\\/)(tests|__tests__|e2e)\\//\n'
    const x = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst TEST_PATH_RE = /(^|\\/)(tests|__tests__|e2e)\\//\nvoid gate\n`
    return a({ [GATE]: g, [TEST]: x }).counts.hits === 0
  })())
  t('单元是数据而非判据 ⇒ 未判定(不冒红也不静默)', (() => {
    const r = a({ [GATE]: gateBody, [TEST]: `const keep = /${TFORM}/\nconsole.log(keep)\n` })
    return r.counts.hits === 0 && r.counts.undetermined >= 1
  })())
  /**
   * P4 三条成对臂。立由不是"数字太大",而是 HEAD 面 13 处命中里逐条读下来,绝大多数是
   * `assert.match(某次执行返回的文本, /门自己打出的那句话/)` —— 把行为断言当判据复制来判红,
   * 是在要求测试不许引用它正在验证的那句话(§22c 的正解恰恰是"改调生产入口")。
   * 放过必须带出处,所以第二臂把派生改成字面对象 ⇒ 必须照旧命中。
   */
  t('P4 放过:断言派生进程返回文本里门打出的那句话', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { spawnSync } from 'node:child_process'\nconst res = spawnSync(process.execPath, ['scripts/check-demo-judge.mjs'], { encoding: 'utf8' })\nassert.match(res.out, /${GFORM}/)\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P4'))
  })())
  t('P4 不查实出处就不放过(res 是字面对象 ⇒ 仍命中)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nconst res = { out: input }\nassert.match(res.out, /${GFORM}/)\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P4'))
  })())
  t('P4 认门导出口返回的文本(gate.decide(...).errors)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { __test__ as gate } from '../check-demo-judge.mjs'\nconst noTokens = gate.decide(input)\nassert.match(noTokens.errors.join('\\n'), /${GFORM}/)\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P4'))
  })())
  t('P2b 放过:主语名字不叫 *Src,但初值是 readFileSync 拿来的正文', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nconst own = readFileSync('scripts/check-demo-judge.mjs', 'utf8')\nassert.ok(!/${GFORM}/.test(own), '形状锁')\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P2'))
  })())
  t('P4 认一跳:spawnSync 提成本文件 helper 后仍算行为断言', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { spawnSync } from 'node:child_process'\nconst runGate = (a) => spawnSync(process.execPath, a, { encoding: 'utf8' })\nconst cli = runGate(['x.mjs'])\nassert.match(cli.out, /${GFORM}/)\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P4'))
  })())
  t('P4 一跳也查不到出处就不放过(helper 里没有派生)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nconst runGate = (a) => ({ out: a.join(' ') })\nconst cli = runGate(['x.mjs'])\nassert.match(cli.out, /${GFORM}/)\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P4'))
  })())
  t('P4 放过:主语名字不像载体,但初值确实是派生调用产出的行', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { spawnSync } from 'node:child_process'\nconst res = spawnSync('node', ['x'], { encoding: 'utf8' })\nconst costLine = res.stdout.split('\\n').find((l) => l.includes('[成本读数]'))\nassert.match(costLine, /${GFORM}/)\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P4'))
  })())
  t('P4 放过:派生结果喂给纯格式化 helper 的实参位', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { spawnSync } from 'node:child_process'\nconst lastLine = (s) => s.trim().split('\\n').pop()\nconst head = spawnSync('node', ['x'], { encoding: 'utf8' })\nassert.match(lastLine(head.stdout), /${GFORM}/)\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P4'))
  })())
  t('P4 放过:走 §22c 的解构导出口,再用 test() 的实参位断生成文本', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { __test__ as gate } from '../check-demo-judge.mjs'\nconst { buildIt } = gate\nconst ps = buildIt()\nassert.ok(/${GFORM}/.test(ps), '生成文本形状锁')\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P4'))
  })())
  t('P4 解构右边不是门体符号就不放过(fixtures 解构出来的同名成员仍算复制判据)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { __test__ as gate } from '../check-demo-judge.mjs'\nconst { buildIt } = fixtures\nconst ps = buildIt()\nassert.ok(/${GFORM}/.test(ps), '自建夹具')\nvoid gate\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P4'))
  })())
  t('P4 放过:无 isDirectRun 守卫的门只能动态 import,出处链三跳(mod→__test__→fn→ps)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { pathToFileURL } from 'node:url'\nconst mod = await import(pathToFileURL(SRC).href)\nconst { __test__ } = mod\nconst { buildIt } = __test__\nconst ps = buildIt()\nassert.ok(/${GFORM}/.test(ps), '生成文本形状锁')\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P4'))
  })())
  t('P4 出处链封顶会响:比上限多一跳就仍命中(把上限调大必读绿这一条)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { pathToFileURL } from 'node:url'\nconst mod = await import(pathToFileURL(SRC).href)\nconst { __test__ } = mod\nconst { pair } = __test__\nconst { buildIt } = pair\nconst ps = buildIt()\nassert.ok(/${GFORM}/.test(ps), '形状锁')\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P4'))
  })())
  t('P2b 不查实初值就不放过(同名但初值是字面串 ⇒ 仍命中)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nconst own = 'some unrelated literal'\nassert.match(own, /${GFORM}/)\nvoid readFileSync\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P2'))
  })())
  t('P4 光有 gate 这个变量名不构成证据(既非 import 符号也无取正文 ⇒ 仍命中)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nconst gate = 'a hand-written string that is neither a file body nor a run result'\nconst own = gate.replace(/x/g, '')\nassert.ok(/${GFORM}/.test(own))\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P4') || i.why.startsWith('P2'))
  })())
  t('P2 需要"确实读了正文"才成立(否则不放过)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { __test__ as gate } from '../check-demo-judge.mjs'\nconst gateSrc = 'x'\nassert.match(gateSrc, /${GFORM}/)\nvoid gate\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P2'))
  })())
  let failed = 0
  for (const r of results) {
    if (!r.ok) failed++
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.isFn ? ' [cond 是函数 ⇒ 该断言从未求值]' : ''}`)
  }
  console.log(`--self-test 结果:${results.length - failed}/${results.length} 通过`)
  return failed === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  const rc = argv.includes('--self-test') ? selfTest() : main(argv)
  process.exit(rc)
}

// §22c:导出的是**判据本身**,不是给测试的第二份复制品。
// 镜像测试若再写一遍归一化/切分/角色判定,两边必然漂开 —— 那正是本门要拦的形状。
export const __test__ = {
  audit,
  readFace,
  listFace,
  main,
  extractUnits,
  declarationSpans,
  matcherSites,
  unitRole,
  initializerOf,
  oneHopSource,
  callArgTokens,
  destructureRhsOf,
  carrierTraced,
  CARRIER_MAX_HOPS,
  gateSymbolNames,
  splitAlternatives,
  normalizePattern,
  fragMatch,
  candidatesFor,
  gateIndex,
  pathLiterals,
  importMap,
  mirrorNameCandidates,
  exemptReason,
  isSelfExempt,
  SELF_EXEMPT,
  GATE_RE,
  MIRROR_TEST_RE,
  isCriterionName,
  SCOPE_NAME_RE,
  LOCK_SUBJECT_RE,
  SOURCE_READ_RE,
  MIN_FRAG_LEN,
  STRONG_FRAG_LEN,
  WINDOW,
  EXEMPT_MARK,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
