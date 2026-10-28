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
 *      (c) **变换位**:测试对门体正文做加工(`replace(/…/)`、`.split(…)`、`.slice(…)` 等)再断言加工产物,
 *      主语初值是取正文 + 变换 —— 归 P2 管(断言对象仍是源码写法的加工结果,不是被审对象长什么样)。
 *      守卫只问 `isCriterionName(unit.decl.name)`(该正则是否是判据族命名),**不查 decl.kind** ——
 *      变换位的 matcher 常是 replace 第 1 实参里的悬挂 list,kind 不是 'list'/'criterion' 的定式。
 *      (d) **helper 自源一跳**:主语初值经本文件内的纯格式化 helper(形如 `maskCommentsAndStrings(src)`)
 *      一跳到达取正文 ⇒ 仍认 (b);helper 实参的初值必须真含取正文调用,查不到照旧不放过。
 *   P4 行为文案断言:`assert.match(res.out, /门自己打出的那句话/)` 与 `assert.match(lastLine(head.out), /…/)` ——
 *      测试跑生产入口(派生进程或门导出口)再断言它返回的**文本**,这正是 §22c 要求的"改调生产入口"形态,
 *      不是第二份判据 ⇒ 放过。判据是**数据流而不是主语叫什么**:主语本身、或它作为纯格式化 helper 的实参,
 *      其初值(含本文件 helper 一跳、成员链宿主一跳,封顶 2 跳)必须真含一次派生(spawnSync、execFileSync、
 *      fork、run-evidence)或确实是 import 进门体的符号调用。查不到出处就照旧命中 —— 属性名叫 `.out` 本身
 *      不构成证据,而"名字不像载体"也不再是拒绝理由(证据在链上,不在拼写上)。
 *      出处集两档:①`../check-*.mjs` import 的门体符号(调用返回值或解构右值);②`../lib/*.mjs`
 *      import 的判据层符号 —— **只认"主语初值是该符号的调用返回值"**,成员常量输入
 *      (`gate.CRASH_MARKERS[0]`)不满足 callee 形不因此放行,且该调用的顶层实参若指向一次取正文
 *      (加工文件正文)⇒ 归 P2 管,不从本支放行 —— 否则"断言被审数据"会被洗成行为断言。
 *      另有**纯载体跳板**:`combo = out.stdout + out.stderr` 这类纯标识符/成员/`+` 拼接可沿初值里的
 *      标识符一跳查出处;混入调用或字符串字面量(取被审内容、判据材料)时语法上就不满足纯载体式 ⇒ 跳不成立。
 *   P5 门侧取景/解析谓词:门体里那个符号/匿名单元本身就是"决定扫哪些文件、怎么切行"的取景材料,不是
 *      被审对象的形态 ⇒ 同形只算漂移风险,放过(逐条点名,记 P5 —— 是"已判定"不是"没判")。三条臂:
 *      ①命名:名字命中取景词表(SCOPE_NAME_RE);②用法:非导出符号的全部消费位都是条件语境里的
 *      `.test(|.match(` 取景合取位,任一消费位落在断言/抛错/判红位即一票否决(禁止往词表加 test 词 ——
 *      那会把未来真正的测试面判据整族翻成 scope);③位置:匿名单元落在解析/取景 callee(以
 *      extract|parse|…|find 开头)的实参位且不在任何裁定位 —— 起 `*_RE` 名会被清单词缀抢判成 criterion,
 *      l1/l2 双真反变命中,所以位置臂按**位置**判,不按名字判。
 *   P3 行内出口:`judge-replica-exempt: <原因>`(原因必填,**只救本行**,不救整文件也不救同名族)。
 *
 * 定级:**默认档(全量)= 只报数并逐条点名**,退出码不参与红绿。§12e 写得明白:一条"存量必然非零"
 *   的判据直接 blocking,等于每次提交都逼人 `--no-verify`,连带废掉链上全部守门。`--strict` 是问责档:
 *   命中 ⇒ exit 1,未判定 ⇒ exit 2(拒绝出具合格证)。**第四态 NP(射程外·零配对关系)不参与退出码**:
 *   它的定义就是"§22c 那句复制在这里没有主语"(测试与该门之间不 import、不同名、不同锚点四条关系全不成立,
 *   而这三条同时是 F1/F2 两条命中判据的入口),所以把它从"未判定"里分出来**不会少拦任何一枚红**,
 *   只是不再让噪声替人按住合格证;它仍逐条点名、**不记为通过**。
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

import { maskCommentsAndStrings, maskCommentsStringsAndRegex, scanSpans } from './lib/code-mask.mjs'
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
/**
 * P4 纯载体跳板的初值式:只有标识符/成员读取与 `+`(`combo = out.stdout + out.stderr`)。
 * 字符串字面量与调用(取被审内容、判据材料)在**语法上就不满足**这一条 ⇒ 反向臂由语法钉死,
 * 不需要在跳板里再写一次"别混入 readFileSync/字面量"的黑名单(写黑名单必然漏)。
 */
const PURE_CARRIER_EXPR_RE =
  /^\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*)?\s*(?:\+\s*[A-Za-z_$][A-Za-z0-9_$]*(?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*)?\s*)*$/
/** P2b 的自源钉:那次取正文必须指向**门/测试自身源码**;命中被审数据面(locale.json 等)不放过。 */
const SELF_SOURCE_READ_RE = /['"][^'"]*\bcheck-[^'"]*\.mjs['"]|\bSELF\b/
/** P5 位置臂的解析/取景 callee 词表:匿名单元落在其实参位 ⇒ 取景材料(按位置判,不按名字判)。 */
const PARSE_CALLEE_RE = /^(?:extract|parse|locate|split|mask|splice|strip|merge|collect|read|find)\w*/
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

/** 调用位:`.match(|.matchAll(|.test(` 与 `assert.(doesNot)Match(`;另收"清单被逐个拿去裁"的迭代位。
 *
 * 底座用**认正则的那一档**遮噪(`maskCommentsStringsAndRegex`)而不是 `maskCommentsAndStrings`:
 * 后者正则档关闭 ⇒ 正则字面量里的引号照旧被当字符串开头,于是一行
 * `assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)` 会从那个 `'` 起开一段假字符串,
 * 一路吞到下一处同号引号,把中间真调用位(`.test(`/`.match(`)整段遮掉 —— 主语认不出来,
 * 该单元就掉进"既不在调用位也不在清单声明里"的未判定。本门判的是**调用位**,分词器必须看见
 * 正则的边界;门体/测试正文的取材仍走 `maskCommentsAndStrings`(L230/L685),那两处的读数
 * 是别人的基线,不在本票动。两条档共用同一台 `scanSpans` 分词器,不存在两处算同一件事。 */
function matcherSites(text) {
  const struct = maskCommentsStringsAndRegex(text)
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
 * P2 (d) **helper 自源一跳**:主语初值是形如 `maskCommentsAndStrings(src)` 的 helper 调用时,
 * 查它的实参 —— 实参标识符的初值(含本文件 helper 一跳)必须真含一次取正文,且那次取正文
 * **指向门/测试自身源码**(SELF_SOURCE_READ_RE,头注 P2b 的自源钉:命中被审数据面
 * locale.json 之类不放过)。实参初值查不到、或不自源,照旧不放过。
 */
function helperArgSourceRead(text, initRaw) {
  if (!initRaw) return false
  if (!/^\s*(?:await\s+)?[A-Za-z0-9_$.]+\s*\(/.test(initRaw)) return false
  for (const t of callArgTokens(initRaw)) {
    const ai = initializerOf(text, t)
    if (ai === null) continue
    const hop = oneHopSource(text, ai)
    const readHit = SOURCE_READ_RE.test(ai) || (hop !== ai && SOURCE_READ_RE.test(hop))
    if (!readHit) continue
    // 自源钉沿**取正文那次调用的实参**再走一跳:路径常住在变量里
    // (`url = new URL('../check-stale-revert.mjs', …)` ⇒ `readFileSync(url, 'utf8')` 看不见扩展名),
    // 实参初值里找得到 check-*.mjs 才算自源;仍不自源照旧不放过。
    const selfFromArg = callArgTokens(ai).some((at) => {
      const ti = initializerOf(text, at)
      if (ti === null) return false
      const th = oneHopSource(text, ti)
      return SELF_SOURCE_READ_RE.test(ti) || (th !== ti && SELF_SOURCE_READ_RE.test(th))
    })
    if (SELF_SOURCE_READ_RE.test(ai) || (hop !== ai && SELF_SOURCE_READ_RE.test(hop)) || selfFromArg) return true
  }
  return false
}

/**
 * P2 (c) **变换位**(头注 (c)):测试对门体正文做加工(`content.replace(/…/)`、`/…/.exec(txt)`)再断言
 * 加工产物 —— 断言对象是"源码写法的加工结果",不是被审对象长什么样 ⇒ 归 P2 管。两条位置:
 * ①单元躺在 replace|replaceAll|split|slice|splice 的**第 1 实参位**,且接收者初值(含 helper 一跳)真取正文;
 * ②单元是 `.exec(` 的**接收者**,exec 第 1 实参的初值(含 helper 一跳)真取正文。任一出处查不到不放行。
 * 调用位扫描在遮噪面(masked)上做,免得字符串/注释/正则体里写出来的 `.replace(` 被当真调用。
 * 守卫(声明名是不是判据族)由调用方 `unitRole` 按头注口径先行裁决,本函数只管位置与出处。
 */
function transformRole(text, masked, unit) {
  if (!masked) return null
  const traceRead = (tok) => {
    if (!tok) return false
    const ai = initializerOf(text, tok)
    if (ai === null) return false
    return SOURCE_READ_RE.test(oneHopSource(text, ai)) || helperArgSourceRead(text, ai)
  }
  const after = masked.slice(unit.end, unit.end + 48)
  // ② exec 接收者:`/re/.exec(txt)` —— 文本在第 1 实参位,沿实参初值(含 helper 一跳)查取正文。
  if (/^\s*\.\s*exec\s*\(/.test(after)) {
    const argToks = callArgTokens(masked.slice(unit.end))
    if (argToks.length > 0 && traceRead(argToks[0])) {
      return { atPattern: true, shapeLock: true, behaviorText: false, subject: '.exec 的第 1 实参', kind: 'transform' }
    }
    return null
  }
  // ① 变换调用的第 1 实参位:逐个 `.(replace|…)(` 调用,确认本单元落在它的首个顶层实参跨度内。
  const CALL = /\.\s*(?:replace|replaceAll|split|slice|splice)\s*\(/g
  for (let m; (m = CALL.exec(masked)) !== null; ) {
    if (m.index >= unit.start) break
    const openIdx = m.index + m[0].length - 1
    const win = masked.slice(openIdx + 1, openIdx + 1 + 1200)
    const argEnd = openIdx + 1 + topLevelComma(win)
    if (!(unit.start > openIdx && unit.end <= argEnd)) continue
    const recv = (
      masked.slice(Math.max(0, m.index - 80), m.index).match(/([A-Za-z_$][A-Za-z0-9_$]*(?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*)*)\s*$/) ||
      ['']
    )[1] || null
    const base = recv ? recv.split('.')[0] : null
    if (base && traceRead(base)) {
      return { atPattern: true, shapeLock: true, behaviorText: false, subject: base, kind: 'transform' }
    }
    return null
  }
  return null
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
function carrierTraced(text, tok, gateNames, libNames = new Set(), depth = 0) {
  const headOf = (s) => String(s).split('.')[0]
  // 只认**静态 import 进来的门体符号**(§22c 的形状);光有一个叫 gate 的变量名不构成证据。
  const fromGate = (t) => gateNames.has(headOf(t))
  const init = initializerOf(text, tok)
  if (init === null) {
    const rhs = destructureRhsOf(text, tok) || tok
    if (gateNames.has(headOf(rhs))) return true
    return depth < CARRIER_MAX_HOPS && rhs !== tok && carrierTraced(text, rhs, gateNames, libNames, depth + 1)
  }
  // 多行箭头函数/函数体的初值只能截到首行 ⇒ 一跳取 helper 体,派生往往在那里面
  const hop = oneHopSource(text, init)
  const hit = (re) => re.test(init) || (hop !== init && re.test(hop))
  if (hit(RUN_TEXT_RE) || hit(MODULE_LOAD_RE) || hit(SOURCE_READ_RE)) return true
  const callee = (init.match(/^\s*(?:await\s+)?([A-Za-z0-9_$.]+)\s*\(/) || [])[1] || null
  if (!callee) {
    // **纯载体跳板**(头注 P4):`combo = out.stdout + out.stderr` 这类初值只有标识符/成员读与 `+`
    // 拼接,载体自身不含任何被审内容,出处在它引用的每个标识符上 ⇒ 逐个沿初值一跳查出处。
    // 混入调用或字符串字面量(取被审内容、判据材料)时语法上就不满足纯载体式(PURE_CARRIER_EXPR_RE),
    // 反向臂由语法钉死,不靠黑名单;跳板沿用同一跳数封顶,不另开闸。
    if (PURE_CARRIER_EXPR_RE.test(init)) {
      const chains = init.match(/[A-Za-z_$][A-Za-z0-9_$]*(?:\s*\.\s*[A-Za-z_$][A-Za-z0-9_$]*)*/g) || []
      for (const chain of chains) {
        const id = chain.split('.')[0]
        if (id === tok || depth >= CARRIER_MAX_HOPS) continue
        if (carrierTraced(text, id, gateNames, libNames, depth + 1)) return true
      }
    }
    return false
  }
  if (fromGate(callee)) return true
  // 出处集两档②(`../lib/*.mjs` 判据层符号,头注 P4):只认"主语初值是该符号的**调用返回值**",
  // 与门体符号同一支(不进上面的解构支 —— lib 解构右值不从本支放行)。反向臂:该调用的顶层实参
  // 若指向一次取正文(加工文件正文)⇒ 归 P2 管,不从本支放行,否则"断言被审数据"会被洗成行为断言。
  // 成员常量输入(`gate.CRASH_MARKERS[0]`)没有调用形,callee 为 null 时走不到这里,天然不放行。
  if (libNames.has(headOf(callee))) {
    const argToks = callArgTokens(init)
    const argFromSourceRead = argToks.some((t) => {
      if (SOURCE_READ_RE.test(t)) return true
      const ai = initializerOf(text, t)
      return ai !== null && SOURCE_READ_RE.test(oneHopSource(text, ai))
    })
    if (argFromSourceRead) return false
    return true
  }
  const head = headOf(callee)
  if (depth < CARRIER_MAX_HOPS && head !== tok && carrierTraced(text, head, gateNames, libNames, depth + 1)) return true
  return false
}

/** `lastLine(head.out, 2)` → 顶层实参里的标识符首段(`['head']`);嵌套括号内的实参也按顶层逗号切。 */
function callArgTokens(subjStr) {
  const open = subjStr.indexOf('(')
  // 前导空白必须放行:`initializerOf` 的捕获组从等号后起,恒带一个前导空格,锚死行首会让
  // ` maskCommentsAndStrings(src)` 这类实参表永远切不出 token(P2d/helper 反向臂实测全灭的根因)。
  if (open < 0 || !/^\s*[A-Za-z0-9_$.]+\s*\(/.test(subjStr)) return []
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
 * 从门路径 import 进来的**本地符号名**。P4 用它判定"这段文本是门自己产出的",
 * 而不是把整个文件的任意调用都当导出口(那等于给任意被审数据发合格证)。
 * pathRe 默认认 `../check*.mjs`(门体);出处集两档②换用 `../lib/*.mjs` 见 `libSymbolNames`。
 */
function gateSymbolNames(text, pathRe = /^\.\.\/check[^/]+\.mjs$/) {
  const out = new Set()
  for (const m of text.matchAll(
    /import\s+(?:\{([^}]*)\}|\*\s+as\s+([A-Za-z0-9_$]+)|([A-Za-z0-9_$]+))?\s*(?:,\s*\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g,
  )) {
    if (!pathRe.test(m[5] || '')) continue
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

/**
 * P4 出处集两档②:`../lib/*.mjs` 判据层 import 进来的本地符号名。与门体符号同一台提取器,
 * 只换路径判据 —— 只有"主语初值是该符号的调用返回值"才走这一支,且顶层实参指向取正文时归 P2
 * (反向臂,见 `carrierTraced`)。测试侧的相对路径恒是 `../lib/`(镜像测试住在 scripts/tests/)。
 */
function libSymbolNames(text) {
  return gateSymbolNames(text, /^\.\.\/lib\/[^/]+\.mjs$/)
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
    // (b) 主语初值直含取正文;(d) helper 自源一跳(初值是纯格式化 helper 调用、实参初值真取自源码)。
    const tracedBody =
      (initForLock !== null && SOURCE_READ_RE.test(initForLock)) || helperArgSourceRead(text, initRaw)
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
        carrierTraced(text, baseTok, ctx.gateNames, ctx.libNames) ||
        argToks.some((t) => carrierTraced(text, t, ctx.gateNames, ctx.libNames))
      behaviorText = traced
    }
    return { atPattern: true, shapeLock, behaviorText, subject: subjStr.slice(0, 40), kind: s.kind }
  }
  /**
   * (c) 变换位(头注):站在任何站点上的单元先按站点语义判;只有"不在任何调用位"的单元落到兜底前,
   * 才问一次它是不是躺在加工调用的第 1 实参位 / `.exec(` 接收者位上。守卫只问
   * `isCriterionName(unit.decl.name)` —— 不查 decl.kind(变换位的 matcher 常是第 1 实参里
   * 的悬挂声明,kind 本就不是 'list'/'criterion' 的定式);判据族命名照旧不放行。
   */
  if (!(unit.decl && isCriterionName(unit.decl.name))) {
    const tr = transformRole(text, ctx.masked, unit)
    if (tr) return tr
  }
  const declared = !!unit.decl && (isCriterionName(unit.decl.name) || unit.decl.kind === 'list')
  return { atPattern: false, shapeLock: false, behaviorText: false, subject: '', declared }
}

/**
 * P5② **用法臂**(头注三臂之二):非导出符号的**全部**消费位都是条件语境里的
 * `.test(|.match(|.matchAll(` 取景合取位 ⇒ 它是"扫哪些文件/怎么切行"的取景材料,不是被审对象的形态;
 * 任一消费位落在断言/抛错位、或不是这种形(赋值、传参、别的方法)⇒ 一票否决不改角色;消费位为 0
 * 也否决(空真不改角色)。按**用法**判,不按名字判 —— `TEST_RE` 这种名字被词缀抢判成 criterion 是
 * 实测,往 SCOPE_NAME_RE 里加 test 词是被头注明令禁止的(那会把未来真正的测试面判据整族翻成 scope)。
 */
function usageIsScoping(masked, name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`\\b${esc}\\b`, 'g')
  let used = 0
  for (const m of masked.matchAll(re)) {
    const before = masked.slice(Math.max(0, m.index - 240), m.index)
    if (/(?:const|let|var)\s+$/.test(before)) continue // 声明位不算消费
    const after = masked.slice(m.index + name.length, m.index + name.length + 64)
    if (!/^\s*\.\s*(?:test|match|matchAll)\s*\(/.test(after)) return false // 非条件消费位(赋值/传参/别的方法)
    if (/assert\s*\.\s*[A-Za-z_$]+\s*\([^()]*$/.test(before)) return false // 断言实参位
    if (/\bthrow\b[^;{}]*$/.test(before)) return false // 抛错位
    // 「条件语境/取景合取位」(头注):消费位所在语句必须真的在做条件判断或布尔合取;
    // `const hit = RE.test(x)` 这种赋值位(条件在别处的 if 里)不算 —— 语句窗按最后的 ; { } 切。
    const stmt = before.slice(Math.max(before.lastIndexOf(';'), before.lastIndexOf('{'), before.lastIndexOf('}')) + 1)
    if (!/(?:\bif\s*\(|\bfor\s*\(|\bwhile\s*\(|\breturn\b|&&|\|\||=>)/.test(stmt)) return false
    used++
  }
  return used > 0
}

/** `(` 的配对闭括号下标(找不到返回 -1);P5③ 判"单元是否落在 callee 实参跨度内"用。 */
function matchCloseParen(t, open) {
  let depth = 0
  for (let i = open; i < t.length; i++) {
    const c = t[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/** 门侧解析/取景 callee 的实参跨度清单(P5③):每门在遮噪面上扫一次,`{ start: 命中处, close: 配对 ')' }`。 */
function parseCallSpans(masked) {
  const out = []
  for (const m of masked.matchAll(/([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
    if (!PARSE_CALLEE_RE.test(m[1])) continue
    const open = m.index + m[0].length - 1
    out.push({ start: m.index, close: matchCloseParen(masked, open) })
  }
  return out
}

/**
 * P5③ **位置臂**(头注三臂之三):匿名单元落在解析/取景 callee(PARSE_CALLEE_RE)的实参跨度内
 * 且不在任何裁定位 ⇒ 取景材料。按**位置**判不按名字判 —— 起 `*_RE` 名会被清单词缀抢判成
 * criterion(l1/l2 双真反变命中),而匿名单元更无名可依。裁定位否决:`.test(|.match(|.matchAll(|
 * .forEach(|.exec(` 紧跟其后(拿去裁了),或处于 `assert.*` 实参 / `throw` 语境。
 */
function inParseCalleeArg(masked, spans, u) {
  const after = masked.slice(u.end, u.end + 48)
  if (/^\s*\.\s*(?:test|match|matchAll|forEach|exec)\s*\(/.test(after)) return false // 裁定位
  const before = masked.slice(Math.max(0, u.start - 240), u.start)
  if (/assert\s*\.\s*[A-Za-z_$]+\s*\([^()]*$/.test(before)) return false // assert 实参位
  if (/\bthrow\b[^;{}]*$/.test(before)) return false // 抛错位
  for (const s of spans) {
    if (s.start >= u.start) break
    if (s.close > u.end) return true
  }
  return false
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
    // P5②/③ 共用的遮噪面与解析 callee 跨度:每门各算一次(消费位/实参位都必须看不见字符串、注释与正则体)。
    const maskedGate = maskCommentsStringsAndRegex(text)
    const parseSpans = parseCallSpans(maskedGate)
    /** 同门同名的 P5② 用法判定缓存(一个名字可能出现在多个单元的 decl 上)。 */
    const usageCache = new Map()
    for (const u of extractUnits(text)) {
      const name = u.decl ? u.decl.name : null
      let role = 'inline'
      if (name) {
        if (SCOPE_NAME_RE.test(name)) role = 'scope'
        else if (isCriterionName(name) || u.decl.kind === 'list') role = 'criterion'
        else role = 'topconst'
      }
      if (name && exported.has(name)) role = 'criterion'
      // P5② 用法臂:非导出符号、全部消费位都是条件语境的取景合取位 ⇒ 取景材料(按用法判,不按名字判)。
      if (name && role !== 'scope' && !exported.has(name)) {
        let scoped = usageCache.get(name)
        if (scoped === undefined) {
          scoped = usageIsScoping(maskedGate, name)
          usageCache.set(name, scoped)
        }
        if (scoped) role = 'scope'
      }
      // P5③ 位置臂:匿名单元落在解析/取景 callee 实参位且不在裁定位 ⇒ 取景材料(按位置判,不按名字判)。
      if (!name && inParseCalleeArg(maskedGate, parseSpans, u)) role = 'scope'
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
  // nopair 与 pass 同级(都不算待裁),但它是**独立状态**而非"通过":读数里必须看得见条数。
  return state === 'hit' ? 3 : state === 'undetermined' ? 2 : 1}

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
    /** P4 的出处集:①从门文件 import 的本地符号名(含 `* as` 与默认导入);②`../lib/*.mjs` 判据层符号;masked 是 P2c 变换位找调用位的遮噪面。 */
    const ctx = { hasSourceRead, gateNames: gateSymbolNames(text), libNames: libSymbolNames(text), masked: maskCommentsStringsAndRegex(text) }
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
              // 门侧那个符号是"取景/解析谓词"(决定扫哪些文件、怎么切行),不是被审对象的形态 ——
              // 这是**已经做出的判定**,所以它记 P5 放过而不是留在"未判定"(把判过的写成没判,与把没判的写成判过,
              // 是同一类事故的两个方向)。同一条形态若在别门是清单,F1/F2 那条入口照旧命中:
              // push() 按 (test,gate,shape) 分键,不同门各留一条记录,低秩的放过不会顶掉高秩的命中。
              state = 'pass'
              why = `P5 门侧 ${ent.name} 是取景/解析谓词(不是被审对象的形态)⇒ 同形只算漂移风险,不记为复制`
            } else if (role.shapeLock) {
              state = 'pass'
              why = `P2 形状锁:主语 ${role.subject} 是某文件的正文,钉的是写法不是被审对象形态`
            } else if (role.behaviorText) {
              state = 'pass'
              why = `P4 行为文案断言:主语 ${role.subject} 的初值来自一次派生/门体导出口调用,断的是门自己打出的那句话(§22c 的"改调生产入口"形态),不是第二份判据`
            } else if (!l1 && !l2 && !anchor && !sameName) {
              // 走到这里四条配对关系(l1 import / l2 同名镜像 / anchor 共同路径字面量 / sameName 清单同名)
              // 全不成立:测试既没 import 这道门、也不是它的同名镜像,两面没点同一个被审文件、清单名也不同 ——
              // §22c 的"复制"定义(门体 ∧ 它的镜像测试各写一份)在这里**没有主语**,所以它不是"没判"而是
              // "不构成候选"。本分支必须排在下面两条"未判定"**之前**:那两条问的是"这单元是判据还是数据"
              // (call 位/清单声明)与"门侧那个单值常量算不算清单",两个问题都以"存在一个可被指控的对子"为前提;
              // 配对关系为零时前提不成立,先把无主语的账摘出去,才不会把射程外的同形攒进待裁队列
              // (攒进去等于让合格证被"根本没人该裁的账"拦住)。单列一格而不是塞进未判定,是因为它
              // **逐条点名且不记为通过**,并且本门也不据此声称"复制藏在 helper 里的那一型已排除"——
              // 那一型今天两侧都看不见,是登记在案的射程缺口。
              state = 'nopair'
              why = 'NP 射程外:同形但两面零配对关系(不 import、不同名、不同锚点)⇒ §22c 的"复制"在这里没有主语,逐条点名而不算已判'
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
              // 走到这里 l1/l2 必为假(上面已判 hit)、而四配对全零的那一型已被前面的 NP 分支摘走 ⇒
              // 只剩两种:有共同锚点但形长不足 24(不冒判红),或跨门同名(名字住在别的门)。两条都点名待裁。
              state = 'undetermined'
              why = anchor
                ? `同锚点(${anchor})但形长 ${f.length} < 强同形阈值 ${STRONG_FRAG_LEN},不冒判红`
                : `同名清单 ${ent.name} 住在 ${gateRel},而本文件既不 import 它、也不是它的镜像 ⇒ 不能算复制这道门的判据(跨门同名),逐条点名待裁`
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
        // "跨门同名"只有名字撞上、**全仓零同料**时才降 NP。otherHolder 的第二个析取式本身就会用
        // "材料与某门同形"找持有者,所以这里再问一遍全仓有没有任何一条门体形态与本清单对得上:
        // 一条都对不上 ⇒ 撞名纯属巧合(实测:check-public-path-probe 的 CALL_RE,被 import 的门既无
        // 此名也无此料,全仓另有十几道门用 CALL_RE 这个名字)⇒ §22c 的"复制"在这里同样没有主语。
        // **反向臂**:只要全仓存在任一同料,立刻退回未判定点名待裁 —— 有同料就是真有一份对子要人裁,
        // 不许用"跨门"两个字把它洗成射程外。
        const sameFormRepoWide = fragsOfU.some((f) =>
          candidatesFor(f, index).some((gf) => fragMatch(f, gf)),
        )
        const crossGateNoSubject = crossGateOnly && !sameFormRepoWide
        push({
          state: reason ? 'pass' : crossGateNoSubject ? 'nopair' : crossGateOnly ? 'undetermined' : 'hit',
          test: testRel,
          testLine: u.line,
          gate: otherHolder || ownGate,
          gateLine: 0,
          gateName: u.decl.name,
          shape: 'F2',
          frag: normalizePattern(u.body).slice(0, 40),
          why: reason
            ? `P3 行内豁免:${reason}`
            : crossGateNoSubject
              ? `NP 射程外:同名清单 ${u.decl.name} 住在 ${otherHolder}、本文件 import 的是 ${ownGate},而**全仓零同料**(没有任何门体形态与它对得上)⇒ 撞名不构成 §22c 的"复制",逐条点名而不算已判`
              : crossGateOnly
                ? `同名清单 ${u.decl.name} 住在 ${otherHolder} 而本文件 import 的是 ${ownGate}(该门无此名)⇒ 不能算复制本门判据,但同名者确实存在且全仓另有同料 ⇒ 未判定点名待裁`
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
    nopair: items.filter((i) => i.state === 'nopair').length,
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
        const tag =
          i.state === 'hit' ? '✗ 命中' : i.state === 'pass' ? '· 放过' : i.state === 'nopair' ? '○ 射程外' : '? 未判定'
        console.log(
          `  ${tag}[${i.shape}] ${i.test}:${i.testLine} ⇄ ${i.gate || '—'}${i.gateLine ? `:${i.gateLine}` : ''} ${i.why}${i.excerpt ? ` 「${i.excerpt}」` : ''}`,
        )
      }
      console.log(
        `四态读数(不并桶):命中 = ${c.hits} · 放过 = ${c.passes}(P1 导出口裁定文件 ${c.p1Files} 份)· 未判定 = ${c.undetermined} · 射程外 NP = ${c.nopair}(同形但零配对关系:逐条点名,**不算已判也不记为通过**)`,
      )
      console.log(
        strict
          ? c.hits > 0
            ? `结论:--strict 问责档 ⇒ 判红(命中 ${c.hits} 处,未判定 ${c.undetermined} 处)`
            : c.undetermined > 0
              ? `结论:--strict 问责档 ⇒ 出具不了合格证(未判定 ${c.undetermined} 处)`
              : `结论:--strict 问责档 ⇒ 通过(命中 0 · 未判定 0;另有 NP 射程外 ${c.nopair} 条 —— 它不构成 §22c 的候选,但也不等于"复制藏在 helper 里"那一型已被排除)`
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
  t('P5 是"已判定"不是"没判":门侧谓词同形 ⇒ 记放过且不得再留未判定', (() => {
    const g = 'const TEST_PATH_RE = /(^|\\/)(tests|__tests__|e2e)\\//\n'
    const x = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst TEST_PATH_RE = /(^|\\/)(tests|__tests__|e2e)\\//\nvoid gate\n`
    const r = a({ [GATE]: g, [TEST]: x })
    return r.counts.undetermined === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P5'))
  })())
  t('P5 不吞真复制:同一条形态在别门是清单 ⇒ 那一门照旧命中(一条 pass 不顶掉另一条 hit)', (() => {
    const scopeGate = 'const TEST_PATH_RE = /(^|\\/)(tests|__tests__|e2e)\\//\n'
    const listGate = "const PATTERNS = [\n  { re: /(^|\\/)(tests|__tests__|e2e)\\// },\n]\nexport const __test__ = { PATTERNS }\n"
    const copy = `import { __test__ as gate } from '../check-list-judge.mjs'\nconst PATTERNS = [/(^|\\/)(tests|__tests__|e2e)\\//]\nPATTERNS.forEach((re) => re.test(p))\nvoid gate\n`
    const r = a({
      [GATE]: scopeGate,
      'scripts/check-list-judge.mjs': listGate,
      'scripts/tests/check-list-judge.test.mjs': copy,
    })
    return (
      r.items.some((i) => i.state === 'pass' && i.why.startsWith('P5')) &&
      r.items.some((i) => i.state === 'hit' && i.shape === 'F1') &&
      r.items.some((i) => i.state === 'hit' && i.shape === 'F2')
    )
  })())
  t('单元是数据而非判据 ⇒ 未判定(不冒红也不静默)', (() => {
    const r = a({ [GATE]: gateBody, [TEST]: `const keep = /${TFORM}/\nconsole.log(keep)\n` })
    return r.counts.hits === 0 && r.counts.undetermined >= 1
  })())
  /**
   * NP(射程外·零配对关系)两条成对臂。立由是 HEAD 面 65 处"未判定"里有 38 处根本不构成 §22c 的主语:
   * 测试既不 import 那道门、不是它的同名镜像、两面也不点同一个被审文件 —— 它只是**碰巧**写了同一条形状。
   * 把它们留在"未判定"里,合格证就被噪声拦住;把它们折进"放过"则是把没判写成判过了。所以第三条状态,
   * 条数与清单都可见。**第二条臂是这一档的边界锁**:同名跨门那一格仍须落未判定 —— 若 NP 分支写宽了
   * (不看 sameName 就跳过),第二条必红。
   */
  t('NP 单列:同料但零配对关系 ⇒ 不命中、不未判定、也不记为通过', (() => {
    const r = a({
      [GATE_B]: `const CALL_RE = [/${OTHER}/]\nexport function b() { return [] }\nexport const __test__ = { CALL_RE }\n`,
      [TEST]: `const KEEP_FORMS = [/${OTHER}/]\nKEEP_FORMS.forEach((re) => re.test(line))\n`,
    })
    return r.counts.hits === 0 && r.counts.undetermined === 0 && r.counts.nopair >= 1 && r.counts.passes === 0
  })())
  t('NP 不得吞掉同名跨门那一格(同名 ⇒ 仍未判定并点名持有者)', (() => {
    const r = a({
      [GATE_B]: `const CALL_RE = [/${OTHER}/]\nexport function b() { return [] }\nexport const __test__ = { CALL_RE }\n`,
      [TEST]: `const CALL_RE = [/${OTHER}/]\nCALL_RE.forEach((re) => re.test(line))\n`,
    })
    return r.counts.nopair === 0 && r.items.some((i) => i.state === 'undetermined' && /同名清单/.test(i.why))
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
  /**
   * Tier-1 成对臂自证(B 档落链的 6 类判据臂,每臂正反成对):正例证明新臂真的放行,
   * 反例证明收窄没有把真复制一起削掉 —— 只写正例时,"这臂是不是恒放行"无法被钉住。
   */
  // ① P2c 变换位 · 正:单元躺在 content.replace(…) 第 1 实参位,接收者初值是 readFileSync。
  t('P2c 放过:正则躺在 content.replace(…) 第 1 实参位且接收者真取正文', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import { readFileSync } from 'node:fs'\nconst content = readFileSync('scripts/check-demo-judge.mjs', 'utf8')\nconst cleaned = content.replace(/${GFORM}/, '')\nvoid cleaned\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P2'))
  })())
  // 反:声明名是判据族(CONTENT_RE)⇒ 守卫先行,变换位不接 —— 复制仍判命中。
  t('P2c 守卫:声明名是判据族(CONTENT_RE)⇒ 变换位不接,仍命中', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import { readFileSync } from 'node:fs'\nconst content = readFileSync('scripts/check-demo-judge.mjs', 'utf8')\nconst CONTENT_RE = content.replace(/${GFORM}/, '')\nvoid CONTENT_RE\n`,
    })
    return r.counts.hits >= 1 && r.items.some((i) => i.shape === 'F1' && i.state === 'hit')
  })())
  // ② P2c exec 位 · 正:单元是 .exec( 的接收者,exec 第 1 实参初值真取正文。
  t('P2c 放过:/…/.exec(txt) 接收者位,文本初值是 readFileSync', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import { readFileSync } from 'node:fs'\nconst content = readFileSync('scripts/check-demo-judge.mjs', 'utf8')\nconst hit = /${GFORM}/.exec(content)\nvoid hit\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P2'))
  })())
  // ③ P5② 用法臂 · 正:门侧非导出符号全部消费位都是条件语境的取景合取位 ⇒ 翻 scope 记 P5 放过。
  t('P5② 放过:门侧 XX_RE 消费位全是条件合取位(名字像判据也不按名字判)', (() => {
    const g = `const XX_RE = /${GFORM}/\nexport function pick(p) { return p !== null && XX_RE.test(p) }\nexport const __test__ = { pick }\n`
    const x = `const KEEP = /${GFORM}/\nvoid KEEP\n`
    const r = a({ [GATE]: g, [TEST]: x })
    return r.counts.hits === 0 && r.counts.undetermined === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P5'))
  })())
  // 反:任一消费位是 assert 实参 ⇒ 一票否决不翻角色,测试复制仍判命中。
  t('P5② 反例:门侧消费位是 assert 实参 ⇒ 不翻角色,测试复制仍命中', (() => {
    const g = `const XX_RE = /${GFORM}/\nexport function pick(line) { assert.ok(XX_RE.test(line)) }\nexport const __test__ = { pick }\n`
    const x = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst XX_RE = [/${TFORM}/]\nXX_RE.forEach((re) => re.test(line))\nvoid gate\n`
    const r = a({ [GATE]: g, [TEST]: x })
    return r.counts.hits >= 1 && !r.items.some((i) => i.state === 'pass' && i.why.startsWith('P5'))
  })())
  // ④ P5③ 位置臂 · 正:匿名单元落在 splitSections(src, /…/, true) 的实参跨度内且不在裁定位 ⇒ 按位置翻 scope。
  t('P5③ 放过:匿名单元在解析 callee 实参跨度内(按位置判,不按名字判)', (() => {
    const g = `export function build(src) {\n  return splitSections(src, /${GFORM}/, true)\n}\nexport const __test__ = {\n  build,\n}\n`
    const x = `const KEEP = /${GFORM}/\nvoid KEEP\n`
    const r = a({ [GATE]: g, [TEST]: x })
    return r.counts.hits === 0 && r.counts.undetermined === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P5'))
  })())
  // 反:同一条正则作 .test( 的接收者(裁定位)⇒ 位置臂一票否决不翻,测试复制仍判命中。
  t('P5③ 反例:匿名单元在 .test( 裁定位 ⇒ 位置臂不翻,测试复制仍命中', (() => {
    const g = `const anyLine = (l) => /${GFORM}/.test(l)\nexport const __test__ = {\n  anyLine,\n}\n`
    const x = `import { __test__ as gate } from '../check-demo-judge.mjs'\nconst PATTERNS = [/${TFORM}/]\nPATTERNS.forEach((re) => re.test(line))\nvoid gate\n`
    const r = a({ [GATE]: g, [TEST]: x })
    return r.counts.hits >= 1 && !r.items.some((i) => i.state === 'pass' && i.why.startsWith('P5'))
  })())
  // ⑤ P4 出处集两档②(libNames) · 正:主语初值是 ../lib 判据层符号的调用返回值 ⇒ 行为文案断言。
  t('P4 放过:主语是 ../lib 符号调用的返回值(d.reason 断的是行为文案)', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { decideGateOutcome } from '../lib/judge-outcome.mjs'\nconst d = decideGateOutcome({ kind: 'read' })\nassert.match(d.reason, /${GFORM}/)\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P4'))
  })())
  // 反向臂:该调用的顶层实参指向取正文(且非自源)⇒ 归 P2 管、P4 不放,P2 自源钉也不放 ⇒ 仍命中。
  t('P4 反例:lib 调用实参指向取正文(非自源)⇒ P4/P2 都不放,仍命中', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nimport { decideGateOutcome } from '../lib/judge-outcome.mjs'\nimport { __test__ as gate } from '../check-demo-judge.mjs'\nconst payload = readFileSync('fixtures/locale.json', 'utf8')\nconst d = decideGateOutcome(payload)\nassert.match(d.reason, /${GFORM}/)\nvoid gate\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P4') || i.why.startsWith('P2'))
  })())
  // 成员常量反例:gk.CRASH_MARKERS[0] 没有调用形 ⇒ 出处链走不到,不从 P4 放行。
  t('P4 反例:成员常量输入无调用形 ⇒ 出处链走不到,仍命中', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { __test__ as gk } from '../check-demo-judge.mjs'\nconst crashFirst = gk.CRASH_MARKERS[0]\nassert.match(crashFirst, /${GFORM}/)\nvoid gk\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P4') || i.why.startsWith('P2'))
  })())
  // ⑥ P2d helper 自源一跳 · 正:url→new URL('…check-*.mjs')→readFileSync→maskCommentsAndStrings(src)。
  t('P2d 放过:url→readFileSync→helper(src) 的自源一跳', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nimport { maskCommentsAndStrings } from '../lib/code-mask.mjs'\nconst url = new URL('../check-demo-judge.mjs', import.meta.url)\nconst src = readFileSync(url, 'utf8')\nconst masked = maskCommentsAndStrings(src)\nassert.doesNotMatch(masked, /${GFORM}/)\n`,
    })
    return r.counts.hits === 0 && r.items.some((i) => i.state === 'pass' && i.why.startsWith('P2'))
  })())
  // 反:helper 实参取的是 locale.json(命中被审数据面,不自源)⇒ 自源钉不放 ⇒ 仍命中。
  t('P2d 反例:helper 实参取 locale.json(非自源)⇒ 不放过,仍命中', (() => {
    const r = a({
      [GATE]: gateBody,
      [TEST]: `import assert from 'node:assert/strict'\nimport { readFileSync } from 'node:fs'\nimport { maskCommentsAndStrings } from '../lib/code-mask.mjs'\nconst locale = readFileSync('fixtures/locale.json', 'utf8')\nconst masked = maskCommentsAndStrings(locale)\nassert.doesNotMatch(masked, /${GFORM}/)\n`,
    })
    return r.counts.hits >= 1 && !r.items.some((i) => i.why.startsWith('P2') || i.why.startsWith('P4'))
  })())
  // 前导空格锚回归:initializerOf 捕获组恒带一个前导空格,锚死行首会把实参表切空(P2d/helper 全灭的根因)。
  t('callArgTokens 放行前导空格(initializerOf 捕获组恒带前导空格)', (() => {
    const toks = callArgTokens(' maskCommentsAndStrings(src)')
    return toks.length === 1 && toks[0] === 'src'
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
