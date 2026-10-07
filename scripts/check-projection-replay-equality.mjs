// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/check-projection-replay-equality.mjs
/**
 * 快照↔增量「逐字节重放等式」的**只读取证尺子**(票 G-998175,2026-10-08 立)。
 * ## 是什么、不是什么
 * **是**:一把只读尺子,回答票面那个未决问题 —— 我方今天有没有(以及在哪些站点可能有)「服务端一张表 + 键级增量 → `JSON.stringify(apply(snap, diff)) === JSON.stringify(next)` 逐字节重放」这一型承载。缺省档 `--plan` 打印四轴现读清单;不改文件、不参与判定。
 * **不是守门**(票面明写「落点未定,需先取证」):**不判红**(命中永不影响退出码)、**不在提交链里**(不在 `scripts/guardian-runner.mjs`、不在 `.husky/*`、不在根 `package.json`)、**没有**应急跳过变量(不在钩子链上,「跳过」这件事结构上不存在)。头注因此不得出现任何肯定式的"已经在提交链上跑"表述 —— 守门 89 的 R2 正为这一型而设:声称与事实不符的门对**每一次**提交判红,而恒红门的唯一结局是各会话跳门、连带废掉全部守门(§12e)。`claimsWired()` 就是这条的机器判据(自检 ST-CLAIM 与镜像 T6 各钉一次,含"对本文件真跑一次为零")。
 * **问责入口 = 手动档**:`node scripts/check-projection-replay-equality.mjs --plan`(取证封缄走 `node scripts/run-evidence.mjs <证据> --cwd=G:/IHUI-AI --timeout=10m -- …`)。
 * ## 四轴(判据来源逐字对齐票面;不自扩第五轴,理由见「刻意没做的」第 2 条)
 *  - **A 承载轴**:被审面上是否存在「把 diff/patch 施加到既有状态上」的函数形态。五档:`replay-equality`(票面那句等式已写成逐字节)/ `key-level`(体判据)/ `key-level-window`(体不可达、只有窗口判据 —— 证据强度写在 `form` 上,读数的人必须看得出是哪一把)/ `whole-table`(整表重发)/ `append`(帧流直接 append —— 票面自述的我方现状),后两档为放过;体取不出 ⇒ 未判定。判据是**结构式**的(函数名承诺 + 体内是否真按键写),不是「delta 这个词出现过」—— 后者会把 SQL 的 `coalesce(sum(...))`、Python 账本注释与测试里的 debounce 命名一起读成承载(票面抽查过的那种假阳)。
 *  - **B 键序轴**:这些站点是否拿 `JSON.stringify` 当「内容变了没有」的等值判据(或当身份键)—— 正是上游注释点明的失效型:`...(x ? { k: v } : {})` 这类条件展开构造 ⇒ 同内容不同键序恒不等。等值/身份判据与条件展开**同文件** ⇒ 命中 `order-drift-risk`。走 `contentEqual` / `deepEqual`(键序无关)或 `stableStringify` / `canonicalSerialize`(确定性序列化,服务签名与哈希,**不是**投影重放等式 —— 票面自己就这么定性)的站点一律**放过**并逐条点名,不记债。
 *  - **C 必填/可缺省轴**:相关 zod schema 能否用 `Object.keys(schema.shape)` + `safeParse(undefined)` **现读**派生键序与可缺省集(票面机制的前提是「两侧不各维护一张字段表」)。本尺真去解析 `z.object({…})` 的体:按源码顺序枚顶层键,逐键判五种可缺省写法(`.optional()` / `z.optional(` / `.nullish()` / `.default(` / `| undefined`)。形状经 `...base.shape` / `pick` / `omit` 派生、有计算键、或配不平 ⇒ **未判定**(键序是**整体**属性,不折成"部分命中"),绝不折叠成「没有 schema」或「已派生」。线形状写成 TS `interface`(运行时没有 `.shape`)⇒ **放过**并注明「这一型在此结构上不可用」。
 *  - **D 帧序/clamp 轴**:投影侧有没有「发帧前先 clamp 到旧消费者二进制界」的**同型需求点**。找发帧出口(SSE `data:` / `reply.raw.write` / `broadcastSSEEvent` / `StreamingResponse` / Python `yield "data:…"`),再看同窗口上下 25 行有无五种界化形态(clamp 出口 / `Math.min` 封顶 / `MAX_*BYTES|LEN|SIZE|CHARS|TOKENS|FRAMES` 常量 / `slice(0,` / `truncated` 标志)。界已在 ⇒ 命中 `clamp-in-place`;界不在 ⇒ 命中 `clamp-absent`(票面那一格的候选落点)。
 * **两个取材面,方向相反,各由一条实测教训背书**:帧形状与 `'snapshot'`/`'delta'` 这类字面量**住在引号里**,所以出口识别与 TS 形状跑在 `maskComments` 面(剥注释、保留字符串);而「这是不是一处等值判据 / 一次 clamp 调用」必须是**代码**,跑在 `maskCommentsAndStrings` 面。只用一面会两头错:只剥注释 ⇒ 注释里逐字写出的旧形态被算成站点(守门 70/131 记过);连字符串也抹 ⇒ 对本型整族失明而账面报「零站点」(守门 134/135 记过 —— 那是最贵的假绿)。两台遮噪都出自 `scripts/lib/code-mask.mjs` 那**一台**分词器,本文件不自带第三遍遮噪(§22c)。
 * ## 三态绝不并桶(本仓最高频禁令:「把没判写成判过了」)
 * 每条站点只落一档:**命中** / **放过(明确不适用,逐条点名)** / **未判定(点名原因)**。`--strict` 下有未判定 ⇒ **exit 2 拒绝出具合格证**。空枚举**判死**(exit 2):预筛枚举到 0 个文件、或枚举到文件却一格判据都没产出,两种都只能读成「尺子没在工作」,不得记成「已确认没有」。
 * ## Python 面的一格:刻意不猜(已登记的射程边界,不是「Python 没有」)
 * `scripts/lib/code-mask.mjs` 只认 JS 词法(行注释、块注释的开闭序列、引号、模板),而 Python 的井号注释与三引号 docstring 它剥不掉,而该层**不得**在本门里再抄一台第二分词器(两处算同一件事必漂移)。我方最像承载的恰好是 Python 侧(`app/core/sse_contract.py::apply_frame` 的 snapshot/delta 水位机、`app/services/cost_ledger.py` 那族账本),按 JS 词法硬扫会把注释里的散文判成站点。所以本尺对 `.py` **每文件出一格未判定**(附原文采样行当线索),不参与 A/B/C/D 的命中计数,也不许被读成「Python 侧无承载」。
 * ## 口径(同 70/77/83/98/101/103/118)
 * 清单与内容**同面同轮**:缺省判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工取证档;两面旗同给 ⇒ exit 2;任一面取不到 ⇒ exit 2「无法判定」,**不回落另一个面**。清单用 `git grep -l`(只列路径、不产生正文 ⇒ 守门 118 认它是枚举而非读内容),正文一律经 `scripts/lib/face-reader.mjs` 的 `catBatch`(118 的 `face` 分类凭据即此);不 `process.cwd()` 定根、不自派生 `git show` 读 blob、不 `readFileSync(join(ROOT…))` 判被审内容。派生一律显式 `stdio`(§12g:本机宿主下不写 stdio 稳定 `spawnSync git EBUSY`,把环境问题读成业务结论就是假结论)。
 * ## 刻意没做的(如实登记,别读成「已确认不需要」)
 *  1. **不判红、不在提交链**:票面判据是「观察 + 需先取证」,落点未定 ⇒ 挂 blocking 就是一台与任何提交都无关的恒红门(§12e)。要升档得先由架构把 `workflowRuns` 那一型拍死。
 *  2. **不加第五轴**:本可再加「幂等判据与 diff 是否共用同一份结构比较」(票面机制第三句),但 A/B 两轴都没有键级承载时它**结构上无对象可判** —— 先由 A/B 决定它有没有意义。
 *  3. **不执行 zod**:C 轴是静态读形状,不是 `Object.keys(schema.shape)` 的真运行结果。静态读不出(计算键/spread)一律未判定;真要运行判据得引 schema 实例化,那是另一票。
 *  4. **不扫 `scripts/`**:见 `SCOPE_DIRS` 那条注 —— 尺子扫自己会把解释判据的散文读成站点。
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskComments, maskCommentsAndStrings } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 站点清单的打印截断(`--all` 解开;`--json` 面永远是全量)。 */
export const LIST_CAP = 40
const GIT_TIMEOUT = 180_000
/** 判据要整文件配平,超这个体量一律不判 ⇒ 未判定点名,不"取一段"凑结论。 */
export const MAX_FILE_CHARS = 256 * 1024
/**
 * 射程 = 产品代码面。刻意**不含 `scripts/`**:判「投影重放是否存在」的尺子若扫自己,
 * 会把门体里解释这条判据的散文(和镜像夹具字符串)读成站点 —— AGENTS「门不得读自己」
 * 实录过一条命令读数 0→12 的自伤。同理排除 `__tests__/`、`tests/`、`*.test.*`、`dist`、
 * `.next`、`*.gen.*`、`.d.ts`(计数进 `counts.excludedTests`,逐条可 `--all` 报名,不静默丢)。
 */
export const SCOPE_DIRS = ['apps', 'packages']
const CODE_EXT_RE = /\.(ts|tsx|js|jsx|mjs|cjs|py)$/
const PY_RE = /\.py$/
export const EXCLUDE_RE = /(node_modules|[/\\]dist[/\\]|[/\\]\.next[/\\]|__tests__[/\\]|[/\\]tests?[/\\]|\.test\.|\.spec\.|\.node-test\.|\.d\.ts$|\.gen\.)/

/**
 * 预筛(一次 `git grep -l -E`)。它**必须是各轴判据真实形态的严格超集** —— 守门 102 记过同型:
 * 预筛少一个字形,尺子就在自己立项那一型上整族失明而报告一切正常。这条不是散文:
 * `prefilterGaps()` 拿 `SAMPLES_MUST_PREFILTER` 里每条**真实书写形态**去问预筛,漏一条即报,
 * 自检 ST-PRE 与 ST-PREb(有牙证明:抽掉一条 ⇒ 必落 gap)各钉一次。
 */
export const PREFILTER = [
  'JSON\\.stringify', 'contentEqual', 'deepEqual', 'deep-equal', 'stableStringify', 'canonical',
  'shape', 'safeParse', 'z\\.object', 'strictObject', 'looseObject', 'optional', 'nullish',
  '[Dd]elta', '[Ss]napshot', '[Pp]atch', 'apply', 'merge', 'absorb', 'fold', 'replay', 'project',
  '\\.push', '\\.\\.\\.(prev|acc|items|rows|list|frames|base|snapshot)', 'clamp', 'Math\\.min',
  'MAX_', 'truncat', 'slice[(]0', 'data:', 'broadcastSSEEvent', 'StreamingResponse', 'write[(]', 'replaceAll',
]
/** 每条都必须被预筛命中的真实书写形态(是判据要看的字面,不是随手造的样本)。 */
export const SAMPLES_MUST_PREFILTER = [
  'JSON.stringify(prev) === JSON.stringify(next)', 'contentEqual(a, b)', 'deepEqual(a, b)',
  'stableStringify(o)', 'canonicalSerialize(o)', 'Object.keys(RunSchema.shape)',
  'RunSchema.safeParse(undefined)', 'z.object({ id: z.string() })', 'z.string().optional()',
  '.nullish()', 'mergeWorkflowRunDelta(base, patch)', 'applyFrame(state, frame)',
  'const delta = 1', 'const snapshot = 1', 'function replayProjection(a, b)',
  'Math.min(n, MAX_FRAME_BYTES)', 'clamp(1, 2, 3)', 'truncated: true', 'buf.slice(0, 10)',
  'reply.raw.write(`data: ${x}`)', 'broadcastSSEEvent(evt)', 'StreamingResponse(gen)',
  'replaceAll(rows)', 'return [...prev, frame]',
]
// ─── 通用小工具(导出给镜像测试直喂构造面)────────────────────────────────────

function lineAt(src, idx) {
  let n = 1
  for (let i = 0; i < idx && i < src.length; i++) if (src[i] === '\n') n += 1
  return n
}
function clip(s, n = 150) {
  const one = String(s ?? '').replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n)}…` : one
}

/**
 * 从 openIdx 的 `{`/`(`/`[` 走到配对闭括号**之后**。配不平 ⇒ -1,
 * 调用方一律落「未判定」—— 绝不"取到行尾"凑一个体出来(凑出来的体比不判更响)。
 */
export function matchBracket(src, openIdx) {
  const open = src[openIdx]
  if (open !== '{' && open !== '(' && open !== '[') return -1
  const close = open === '{' ? '}' : open === '(' ? ')' : ']'
  let d = 0
  for (let k = openIdx; k < src.length; k++) {
    if (src[k] === open) d += 1
    else if (src[k] === close) {
      d -= 1
      if (d === 0) return k + 1
      if (d < 0) return -1
    }
  }
  return -1
}

/** 判据面两档,各一次扫描(同一台分词器的两个投影,本文件不自带第三遍遮噪)。 */
export function faces(src) {
  return { codeAll: maskComments(src), codeStrict: maskCommentsAndStrings(src) }
}
// ─── A 承载轴 ────────────────────────────────────────────────────────────────

const CARRIER_VERB_RE = /^(?:apply|merge|absorb|fold|diff|project|replay|ingest|reduce)[A-Za-z0-9_$]*$/i
/** 累加型命名:票面自述的我方现状("从帧流直接 append 出来")要靠这一族点名,而不是靠它判红。 */
const ACCUM_VERB_RE = /^(?:append|push|collect|accumulate)[A-Za-z0-9_$]*$/i
const CARRIER_TOPIC_RE = /(Frame|Delta|Patch|Diff|Snapshot|State|Projection|Watermark|Revision|Records?|Runs?|Tasks?|Base)/
/** 键级写入的六种书写形态。少一种 = 该形态整族隐身(守门 77 B6「门让你怎么写,门就看不见怎么写」那一课)。 */
const KEY_LEVEL_RES = [
  { name: '条件展开', re: /\.\.\.\s*\(?\s*[A-Za-z0-9_$.[\]]+[^{}]{0,60}[?|&]/ }, { name: 'spread 既有状态', re: /\{\s*\.\.\.\s*(?:prev|base|current|existing|acc|snapshot|prior|state)[A-Za-z0-9_$.]*/ },
  { name: 'entries/keys 遍历写键', re: /Object\.(?:entries|keys)\s*\(/ }, { name: '下标写键', re: /[\w$)\]]\s*\[\s*[A-Za-z0-9_$.+']+\s*\]\s*=[^=]/ },
  { name: 'Map.set', re: /\.set\(\s*[A-Za-z0-9_$'"`][^)]{0,60}[,)]/ }, { name: 'for…of 解构写键', re: /for\s*\(\s*(?:const|let)\s*\[\s*\w+\s*,\s*\w+\s*\]/ },
]
const WHOLE_TABLE_RE = /=\s*(?:snap|snapshot|base|full|whole|entire)[A-Za-z0-9_$]*\b|replaceAll\s*\(|setRows\s*\(/
const APPEND_RE = /\.push\s*\(|\.concat\s*\(|\[\s*\.\.\.\s*(?:prev|acc|items|rows|list|frames)[A-Za-z0-9_$]*\s*,/
/** 票面那句契约本体:`JSON.stringify(apply(x, y)) === JSON.stringify(z)`。 */
const REPLAY_EQ_RE = /JSON\.stringify\s*\([^;{]*\b(?:apply|merge|fold|reduce|absorb|project|replay)[A-Za-z0-9_$]*\s*\([^)]*\)[^;}]{0,60}(?:===|!==)\s*JSON\.stringify\s*\(/gi
const DECL_RE = /(?:function\s+([A-Za-z0-9_$]+)\s*\(|(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>)/g
/** `) {` 之间允许 TS 返回类型标注(≤90 字符),否则带 `): Foo {` 的声明整族取不出体。 */
const PARAMS_TO_BODY_RE = /^[\s:<>A-Za-z0-9_$,.\[\]|&'"()]{0,90}\{/

/**
 * A 轴判定。三桶严格分开:`sites`=命中 / `notes`=放过 / `undetermined`=未判定。
 * 证据强度写在 `form` 上(`key-level` 是体判据,`key-level-window` 是窗口判据)——
 * 两者都算命中(票面要求「宁可多列不可漏列」),但读数的人必须看得出是哪一把。
 */
export function judgeCarrier(rel, codeAll, codeStrict) {
  const out = { sites: [], notes: [], undetermined: [] }
  if (PY_RE.test(rel)) return out // Python 整族由 analyze 汇成一条未判定(见头注那一格)
  for (const mm of codeAll.matchAll(REPLAY_EQ_RE)) {
    out.sites.push({ axis: 'A', form: 'replay-equality', at: `${rel}:${lineAt(codeAll, mm.index)}`, text: clip(mm[0], 120), note: '契约已写成逐字节重放等式 ⇒ 键序在这一格是一等公民' })
  }
  for (const mm of codeStrict.matchAll(DECL_RE)) {
    const name = mm[1] || mm[2]
    if (!name) continue
    const line = lineAt(codeStrict, mm.index)
    const isCarrier = CARRIER_VERB_RE.test(name) && CARRIER_TOPIC_RE.test(name)
    const isAccum = ACCUM_VERB_RE.test(name) && CARRIER_TOPIC_RE.test(name)
    if (!isCarrier && !isAccum) continue
    const parenAt = codeStrict.indexOf('(', mm.index)
    const afterParams = parenAt >= 0 ? matchBracket(codeStrict, parenAt) : -1
    if (afterParams < 0) {
      out.undetermined.push({ where: `${rel}:${line}`, reason: `函数 ${name} 的参数表括号配不平 ⇒ 取不出体,增量粒度判不了`, text: clip(name) })
      continue
    }
    const gap = codeStrict.slice(afterParams, afterParams + 100)
    const bodyOpen = PARAMS_TO_BODY_RE.exec(gap)
    if (!bodyOpen) {
      // 箭头单表达式 / 体在别处 ⇒ 只在窗口里找键级形态,并把证据强度写在 form 上。
      const win = codeStrict.slice(mm.index, Math.min(codeStrict.length, mm.index + 900))
      const keyHit = KEY_LEVEL_RES.find((k) => k.re.test(win))
      if (keyHit) {
        out.sites.push({ axis: 'A', form: 'key-level-window', at: `${rel}:${line}`, text: clip(name), note: `体不可达,窗口里出现「${keyHit.name}」⇒ 证据强度低于体判据,已在 form 上分开` })
      } else {
        out.undetermined.push({ where: `${rel}:${line}`, reason: `函数 ${name} 名字承诺"${isCarrier ? '施加' : '累加'}",但体取不出(箭头单表达式/跨行声明)且窗口无键级形态 ⇒ 键级/整表/append 三档都判不了`, text: clip(name) })
      }
      continue
    }
    const braceAt = afterParams + bodyOpen[0].length - 1
    const bodyEnd = matchBracket(codeStrict, braceAt)
    if (bodyEnd < 0) {
      out.undetermined.push({ where: `${rel}:${line}`, reason: `函数 ${name} 的体配不平 ⇒ 不猜粒度`, text: clip(name) })
      continue
    }
    const body = codeStrict.slice(braceAt + 1, bodyEnd - 1)
    const keyForms = KEY_LEVEL_RES.filter((k) => k.re.test(body)).map((k) => k.name)
    if (keyForms.length) {
      // "体内另有 keyed 集合"= 票面那一型的**前置结构**(一张按 id 索引的表)在这一处可达;
      // 没有它,键级写只是往数组/对象上添字段,不构成"整表 + 键级 delta"。
      const keyedStore = /new Map\(|new WeakMap\(|Map<\s*string|Record<\s*string|\[\s*[A-Za-z0-9_$.]*(?:Id|id|Key|key)\s*\]/.test(body)
      out.sites.push({ axis: 'A', form: 'key-level', keyedStore, at: `${rel}:${line}`, text: clip(name), note: `体内按键写:${keyForms.join(' / ')}${keyedStore ? ';并有 keyed 集合(Map / Record<string,…> / 按 id 下标)⇒ 表型前置结构在这一处可达' : ';未见 keyed 集合 ⇒ 是字段级写,不是一张表'}` })
      continue
    }
    if (WHOLE_TABLE_RE.test(body)) {
      out.notes.push({ axis: 'A', state: 'pass', at: `${rel}:${line}`, text: clip(name), reason: '整表赋值 / replaceAll ⇒「服务端一张表 + 键级增量」这一型在此不成立(键序议题无从谈起)' })
      continue
    }
    if (APPEND_RE.test(body)) {
      out.notes.push({ axis: 'A', state: 'pass', at: `${rel}:${line}`, text: clip(name), reason: '帧流直接 append(票面自述的我方现状),无「既有状态 + 键级 patch」结构' })
      continue
    }
    out.undetermined.push({ where: `${rel}:${line}`, reason: `函数 ${name} 名字承诺"施加",体读得出但键级/整表/append 三种粒度一条都不成立 ⇒ 判不了它改的是什么`, text: clip(name) })
  }
  return out
}
// ─── B 键序轴 ────────────────────────────────────────────────────────────────

/** `JSON.stringify(x) ===/!== JSON.stringify(y)`,允许一层嵌套括号(真代码里传的多是 `a.b` 或一次调用)。 */
const STR_EQ_RE = /JSON\.stringify\(\s*(?:[^()]|\([^()]*\))*\)\s*(?:===|!==)\s*JSON\.stringify\(\s*(?:[^()]|\([^()]*\))*\)/g
/** 把序列化结果当**身份键/缓存键** —— 与等值判据同型失真(键序一漂就"查不到")。 */
const STR_KEY_RE = /\.set\(\s*JSON\.stringify\(|\[\s*JSON\.stringify\([^)]*\)\s*\]\s*[:=]|new\s+(?:Map|Set)\(\s*\[[^\]]*JSON\.stringify\(/g
const KEY_INSENSITIVE_RE = /contentEqual|deepEqual|isContentEqual/g
const CANONICAL_RE = /stableStringify|canonicalSerialize|canonical_json|canonical_serialize/g
const COND_SPREAD_RE = /\.\.\.\s*\(\s*[^{}]{1,90}\?\s*\{/g

export function judgeKeyOrder(rel, codeStrict) {
  const out = { sites: [], notes: [], undetermined: [] }
  if (PY_RE.test(rel)) return out
  for (const mm of codeStrict.matchAll(STR_EQ_RE)) out.sites.push({ axis: 'B', form: 'stringify-equality', at: `${rel}:${lineAt(codeStrict, mm.index)}`, text: clip(mm[0], 120), note: '用 JSON.stringify 当「内容变了没有」的等值判据 ⇒ 键序是一等公民' })
  for (const mm of codeStrict.matchAll(STR_KEY_RE)) out.sites.push({ axis: 'B', form: 'stringify-as-identity', at: `${rel}:${lineAt(codeStrict, mm.index)}`, text: clip(mm[0], 120), note: '把序列化结果当身份键/缓存键 ⇒ 与等值判据同型(键序漂移即"查不到")' })
  for (const mm of codeStrict.matchAll(KEY_INSENSITIVE_RE)) out.notes.push({ axis: 'B', state: 'pass', at: `${rel}:${lineAt(codeStrict, mm.index)}`, text: clip(mm[0]), reason: '走键序无关的内容相等出口 ⇒ 本轴对它无债' })
  for (const mm of codeStrict.matchAll(CANONICAL_RE)) out.notes.push({ axis: 'B', state: 'pass', at: `${rel}:${lineAt(codeStrict, mm.index)}`, text: clip(mm[0]), reason: '确定性序列化(服务签名/哈希)——**另一语义**:不是投影重放等式(票面自己就这么定性)' })
  const eqCount = out.sites.length
  const cond = [...codeStrict.matchAll(COND_SPREAD_RE)]
  if (eqCount > 0 && cond.length > 0) {
    out.sites.push({ axis: 'B', form: 'order-drift-risk', at: `${rel}:${lineAt(codeStrict, cond[0].index)}`, text: clip(cond[0][0], 120), note: `同文件同时有 stringify 等值/身份判据 ${eqCount} 处与条件展开构造 ${cond.length} 处 ⇒「同内容不同键序恒不等」这一型在此可达` })
  }
  // 半截形态(一侧是 stringify、另一侧是变量/跨行)——STR_EQ_RE 刻意只认单行完整式,
  // 这类命中不了但**确实是等值判据**的站点一律落未判定并点名,不读成「这一格没有键序债」。
  if (eqCount === 0 && /JSON\.stringify\([^()]*\)\s*(?:===|!==)|(?:===|!==)\s*JSON\.stringify/.test(codeStrict)) {
    out.undetermined.push({ where: `${rel}`, reason: '读到一侧是 JSON.stringify 的比较式,但另一侧跨行/是变量 ⇒ STR_EQ_RE 的完整式没咬住 ⇒ 键序是否参与判定判不了', text: '' })
  }
  return out
}
// ─── C 必填/可缺省轴 ─────────────────────────────────────────────────────────

const SCHEMA_DECL_RE = /(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::\s*[A-Za-z0-9_$<>,\s|]+)?=\s*z\.(object|strictObject|looseObject|record)\s*\(\s*\{/g
const OPTIONAL_RES = [/\.optional\s*\(/, /\bz\.optional\s*\(/, /\.nullish\s*\(/, /\.default\s*\(/, /\|\s*undefined/]
const DERIVE_SHAPE_RE = /Object\.keys\(\s*([A-Za-z0-9_$.]+)\.shape\s*\)/g
const SHAPE_CALC_RE = /\.\s*(?:pick|omit|extend|partial|required|merge)\s*\(/
const SAFE_PARSE_UND_RE = /\.safeParse\(\s*undefined\s*\)/g
const TS_SHAPE_RE = /^[ \t]*(?:export\s+)?(?:interface|type)\s+[A-Za-z0-9_$]+/gm
const TS_OPTIONAL_RE = /^[ \t]+[A-Za-z0-9_$]+\?\s*:/gm

/**
 * 从一个 `z.object({…})` 的字面体里**按源码顺序**枚顶层键并逐键判可缺省。
 * 这就是票面 `Object.keys(schema.shape)` + `safeParse(undefined)` 想静态回答的两件事:键序 + 必填集。
 * 计算键(`[k]:`)、spread(`...base`)、配不平 ⇒ `problems` 非空 / `balanced:false`,
 * 调用方一律落未判定,不得把"读不出"折成"没有"。
 */
export function deriveSchemaShape(body) {
  const keys = []
  const problems = []
  const segs = []
  let d = 0
  let start = 0
  for (let i = 0; i <= body.length; i++) {
    const c = body[i]
    if (c === '{' || c === '(' || c === '[') d += 1
    else if (c === '}' || c === ')' || c === ']') {
      d -= 1
      if (d < 0) return { keys, problems: ['形状体配不平(多出一个闭括号)'], balanced: false }
    }
    if (i === body.length || (c === ',' && d === 0)) {
      const seg = body.slice(start, i)
      if (seg.trim()) segs.push(seg)
      start = i + 1
    }
  }
  if (d !== 0) return { keys, problems: [`形状体走到末尾仍有 ${d} 层未闭合`], balanced: false }
  for (const raw of segs) {
    const head = raw.replace(/^\s+/, '')
    if (/^\.\.\./.test(head)) problems.push('段首是 spread(形状来自别处)')
    else if (/^\[[^[\]]*\]\s*:/.test(head)) problems.push('段首是计算键 [x]:(键序不可静态枚)')
    else {
      const kv = /^([A-Za-z0-9_$]+|"[^"]*"|'[^']*')\s*:/.exec(head)
      if (!kv) problems.push(`段首不是"键:"形态:${clip(head, 40)}`)
      else keys.push({ name: kv[1], optional: OPTIONAL_RES.some((r) => r.test(head)) })
    }
  }
  return { keys, problems, balanced: true }
}

/**
 * C 轴的射程判据(自扩的一条,理由写在 `analyze` 那段注释里):
 * 一个文件**已经在用**票面那两条运行时派生通道 ⇒ 它无条件进 C 射程(那是"机制已在位"的正证,不能被相关性圈掉)。
 */
export function cScopePredicate(codeStrict) {
  return /Object\.keys\(\s*[A-Za-z0-9_$.]+\.shape\s*\)/.test(codeStrict) || /\.safeParse\(\s*undefined\s*\)/.test(codeStrict)
}

export function judgeSchema(rel, codeAll, codeStrict) {
  const out = { sites: [], notes: [], undetermined: [] }
  if (PY_RE.test(rel)) return out
  let found = 0
  for (const mm of codeStrict.matchAll(SCHEMA_DECL_RE)) {
    found += 1
    const name = mm[1]
    const line = lineAt(codeStrict, mm.index)
    const openAt = codeStrict.indexOf('{', mm.index + mm[0].length - 1)
    const closeAt = openAt >= 0 ? matchBracket(codeStrict, openAt) : -1
    if (closeAt < 0) {
      out.undetermined.push({ where: `${rel}:${line}`, reason: `schema ${name} 的形状体配不平 ⇒ 键序读不出(不读成「没有 schema」)`, text: clip(mm[0]) })
      continue
    }
    const d = deriveSchemaShape(codeStrict.slice(openAt + 1, closeAt - 1))
    // 键序是**整体**属性:只要有一枚计算键 / spread / 读不出的段,静态键序就不可信 ⇒ 整张表未判定,
    // 不得折成"部分命中"(那等于把没量到写成量到了前半截,而票面要的是"两侧不各维护字段表")。
    if (!d.balanced || d.problems.length || d.keys.length === 0) {
      out.undetermined.push({ where: `${rel}:${line}`, reason: `schema ${name} 的键序不可整体静态枚:${d.problems.join(' / ') || (d.balanced ? '体里没读到一个键' : '形状体配不平')}`, text: clip(mm[0]) })
      continue
    }
    const optCount = d.keys.filter((k) => k.optional).length
    const usedRuntimeDerive = new RegExp(`Object\\.keys\\(\\s*${name}\\.shape\\s*\\)`).test(codeStrict)
    const calcShape = SHAPE_CALC_RE.test(codeStrict.slice(mm.index, closeAt))
    out.sites.push({ axis: 'C', form: d.problems.length ? 'shape-derivable-partial' : 'shape-derivable', at: `${rel}:${line}`, text: `${name}(${d.keys.length} 键,${optCount} 可缺省)`, note: (usedRuntimeDerive ? '本站点已用 Object.keys(x.shape) 现读;' : '可现读但本站点未用;') + (calcShape ? '形状经 pick/omit/extend ⇒ 键序是算子结果,不是这张字面表;' : '') + (d.problems.length ? `部分段读不出:${d.problems.join(' / ')}` : '') })
  }
  for (const mm of codeStrict.matchAll(DERIVE_SHAPE_RE)) out.sites.push({ axis: 'C', form: 'shape-derived', at: `${rel}:${lineAt(codeStrict, mm.index)}`, text: clip(mm[0]), note: '键序已在运行时从 schema 派生 ⇒ 票面要的「不各维护字段表」这一格已在位' })
  for (const mm of codeStrict.matchAll(SAFE_PARSE_UND_RE)) out.sites.push({ axis: 'C', form: 'absent-derived-by-parse', at: `${rel}:${lineAt(codeStrict, mm.index)}`, text: clip(mm[0]), note: '用 safeParse(undefined) 判可缺省 ⇒ 票面那一判据已在位' })
  if (found === 0) {
    const shapes = codeAll.match(TS_SHAPE_RE) || []
    const opts = codeAll.match(TS_OPTIONAL_RE) || []
    if (shapes.length) out.notes.push({ axis: 'C', state: 'pass', at: `${rel}:面`, text: `${shapes.length} 个 interface/type,${opts.length} 个可选键`, reason: '线形状写成 TS 类型,运行时没有 .shape ⇒「从 schema 现读派生」这一型在此结构上不可用' })
    else out.notes.push({ axis: 'C', state: 'pass', at: `${rel}:面`, text: '', reason: '本文件既无 zod 对象 schema 也无 TS 线形状声明 ⇒ 不属 C 轴射程' })
  }
  return out
}
// ─── D 帧序/clamp 轴 ─────────────────────────────────────────────────────────

/** 出口形态住在引号/模板里 ⇒ 跑在 codeAll(剥注释、保留字符串)面。 */
const EMIT_RES = [
  { name: 'SSE data 帧写入', re: /\.write\(\s*[`'"]data:/g },
  { name: 'data: 模板拼装', re: /[`'"]data:\s*\$\{/g },
  { name: 'reply.raw.write', re: /reply\.raw\.write\s*\(/g },
  { name: 'broadcastSSEEvent', re: /broadcastSSEEvent\s*\(/g },
  { name: 'StreamingResponse', re: /StreamingResponse\s*\(/g },
  { name: 'Python yield data 帧', re: /yield\s+f?["'`]data:/g },
]
/** 界化形态必须是代码 ⇒ 跑在 codeStrict 面(注释里写一句「有 MAX_FRAME_BYTES」不算在位)。 */
const BOUND_RES = [
  { name: 'clamp 出口', re: /\bclamp[A-Za-z0-9_$]*\s*\(/g },
  { name: 'Math.min 封顶', re: /Math\.min\s*\(/g },
  { name: '字节/长度常量', re: /MAX_[A-Za-z0-9_]*(?:BYTES|LEN|LENGTH|SIZE|CHARS|TOKENS|FRAMES)\b/g },
  { name: 'slice 截断', re: /\.slice\(\s*0\s*,/g },
  { name: 'truncated 标志', re: /truncated/g },
]

/**
 * D 轴。**两遍遮噪的行号同轴、列偏移不同**(行注释整段删除,换行保住),
 * 所以出口在 codeAll 找(帧形状住在模板/引号里),界化窗口**按行**回到 codeStrict 取 ——
 * 拿 codeAll 的字符下标去切 codeStrict 会切错位(第一次自跑就是这么读的)。
 * 同一行的多种写法(`.write(` + 模板 `data:` + `reply.raw.write`)合并成**一条**站点:
 * 一格需求点算三条会让"站点数"这个读数失去含义(两份基线互相顶掉那一型)。
 */
export function judgeClamp(rel, codeAll, codeStrict) {
  const out = { sites: [], notes: [], undetermined: [] }
  if (PY_RE.test(rel)) return out
  const strictLines = codeStrict.split(/\r?\n/)
  const WINDOW_LINES = 25
  const byLine = new Map() // line → { names:Set<string>, text:string }
  for (const e of EMIT_RES) {
    for (const mm of codeAll.matchAll(e.re)) {
      const line = lineAt(codeAll, mm.index)
      const cur = byLine.get(line) || { names: new Set(), text: clip(mm[0], 110) }
      cur.names.add(e.name)
      byLine.set(line, cur)
    }
  }
  if (!byLine.size) return out
  for (const line of [...byLine.keys()].sort((a, b) => a - b)) {
    const e = byLine.get(line)
    const win = strictLines.slice(Math.max(0, line - 1 - WINDOW_LINES), line + WINDOW_LINES).join('\n')
    const bounds = BOUND_RES.filter((b) => {
      b.re.lastIndex = 0
      return b.re.test(win)
    }).map((b) => b.name)
    const names = [...e.names].join(' + ')
    out.sites.push(
      bounds.length
        ? { axis: 'D', form: 'clamp-in-place', at: `${rel}:${line}`, text: e.text, note: `发帧出口「${names}」上下 ${WINDOW_LINES} 行内有界化:${bounds.join(' / ')}` }
        : { axis: 'D', form: 'clamp-absent', at: `${rel}:${line}`, text: e.text, note: `发帧出口「${names}」上下 ${WINDOW_LINES} 行内五种界化形态一条都不在 ⇒ 票面「发帧前先 clamp」的同型需求点候选` },
    )
  }
  return out
}
// ─── 面的枚举与取材 ──────────────────────────────────────────────────────────

/**
 * 只列路径(`-l`,不产生正文 ⇒ 守门 118 认它是枚举而不是读内容)。
 * HEAD 档带 rev、`--staged` 走 `--cached`、worktree 档不带任一个 —— **清单与内容必须同面**,
 * 错配会让尺子对着一个面判、对另一个面报数(守门 118 在本门立项当天刚修过同一型)。
 */
export function listArgsFor(face) {
  const args = ['grep', '-l', '-E', '-I', '--no-color']
  for (const p of PREFILTER) args.push('-e', p)
  if (face === 'head') args.push('HEAD')
  else if (face === 'staged') args.push('--cached')
  args.push('--', ...SCOPE_DIRS)
  return args
}

/**
 * 预筛必须能命中每条真实书写形态(纯函数;自检 ST-PRE 与镜像 T5 据此判"预筛是不是超集")。
 * @returns {string[]} 没被预筛覆盖的形态(空 = 超集成立)
 */
export function prefilterGaps(samples = SAMPLES_MUST_PREFILTER, patterns = PREFILTER) {
  let combined
  try {
    combined = new RegExp(patterns.join('|'))
  } catch (e) {
    return [`预筛正则本身编译不过:${e && e.message}`]
  }
  return samples.filter((s) => !combined.test(s))
}

export function enumerate(root, face) {
  let out
  try {
    out = gitRaw(listArgsFor(face), root, { timeout: GIT_TIMEOUT })
  } catch (e) {
    // `git grep` 无命中 = exit 1,是 git 的正常结论(不是"派生失败");其余一律抛 Undetermined。
    if (e && e.status === 1) return []
    throw e instanceof Undetermined ? e : new Undetermined(`枚举失败:${e && e.message}`)
  }
  return String(out)
    .split(/\r?\n/)
    .map((p) => (p.startsWith('HEAD:') ? p.slice(5) : p))
    .map((p) => p.trim())
    .filter(Boolean)
}

export function listFace(root, face) {
  const files = []
  const excluded = []
  for (const rel of enumerate(root, face)) {
    if (!CODE_EXT_RE.test(rel)) continue
    if (EXCLUDE_RE.test(rel)) excluded.push(rel)
    else files.push(rel)
  }
  return { files: files.sort(), excluded }
}

export function readFace(root, face, files) {
  if (face === 'worktree') return files.map((rel) => ({ rel, src: readWorktreeFile(root, rel) }))
  const pre = face === 'staged' ? ':' : 'HEAD:'
  const got = catBatch(root, files.map((p) => `${pre}${p}`), { timeout: GIT_TIMEOUT, maxBuffer: 1 << 28 })
  return files.map((rel) => ({ rel, src: got.get(`${pre}${rel}`) ?? null }))
}

function tally(a) {
  return { hit: a.sites.length, pass: a.notes.length, undetermined: a.undetermined.length }
}

/** 一个面判完的汇总。`budget` 只为自检构造超大文件而存在,不是给调用方调绿窄的旋钮。 */
export function analyze({ face = 'head', root = ROOT, budget = MAX_FILE_CHARS } = {}) {
  const top = assertRepoRoot(root, 'projection-replay-equality 的判定根')
  const { files, excluded } = listFace(top, face)
  const rows = readFace(top, face, files)
  const mk = () => ({ sites: [], notes: [], undetermined: [] })
  const acc = { A: mk(), B: mk(), C: mk(), D: mk() }
  const unreadable = []
  const tooBig = []
  const pyFiles = []
  let cOutOfScope = 0
  const cInScope = new Set()
  for (const r of rows) {
    if (typeof r.src !== 'string') {
      unreadable.push(r.rel)
      continue
    }
    if (r.src.length > budget) {
      tooBig.push(`${r.rel}(${r.src.length} B)`)
      acc.A.undetermined.push({ where: r.rel, reason: `文件 ${r.src.length} 字符 > 判据上限 ${budget} ⇒ 整面不判(不"取一段"凑结论)`, text: '' })
      continue
    }
    const { codeAll, codeStrict } = faces(r.src)
    if (PY_RE.test(r.rel)) {
      pyFiles.push(r.rel)
      const leads = String(codeAll)
        .split(/\r?\n/)
        .map((l, i) => ({ l, i: i + 1 }))
        .filter((x) => /(^|\s)(def|class)\b/.test(x.l) && /delta|snapshot|patch|apply|merge|frame|projection/i.test(x.l))
        .slice(0, 2)
      acc.A.undetermined.push({ where: `${r.rel}${leads.length ? `:${leads[0].i}` : ''}`, reason: 'Python 面未纳入可判遮罩(code-mask 只认 JS 词法,# 注释与三引号 docstring 剥不掉)⇒ 命中与散文无法区分,整族出未判定', text: leads.map((x) => clip(x.l, 90)).join(' ⧵ ') })
      continue
    }
    const a = judgeCarrier(r.rel, codeAll, codeStrict)
    const b = judgeKeyOrder(r.rel, codeStrict)
    const d = judgeClamp(r.rel, codeAll, codeStrict)
    for (const k of ['sites', 'notes', 'undetermined']) {
      acc.A[k].push(...a[k])
      acc.B[k].push(...b[k])
      acc.D[k].push(...d[k])
    }
    // C 轴的射程(自扩的一条,理由写在这里):票面问的是「**相关** schema 能否现读派生」。
    // 不加这层限定的话,全仓每张 zod 表都算一次命中、每个非 zod 文件都算一次"放过",
    // 噪声(实测 1961 + 3465 条)会把真信号淹掉 —— 而"数字很多"在本仓不是好报告,它指使人
    // 去修没坏的东西(守门 118:假阳比漏报更贵)。相关文件 = 本文件已被 A/B 判成承载/键序站点,
    // 或它已经在用票面那两条运行时派生通道(shape-derived / safeParse(undefined))——后者是
    // 「机制已在位」的正证,必须在**全仓**上找,不能被相关性圈掉。
    if (a.sites.length > 0 || b.sites.length > 0 || cScopePredicate(codeStrict)) {
      cInScope.add(r.rel)
      const c = judgeSchema(r.rel, codeAll, codeStrict)
      for (const k of ['sites', 'notes', 'undetermined']) acc.C[k].push(...c[k])
    } else cOutOfScope++
    // 出口字样在、EMIT_RES 一条没读到 ⇒ 书写形态超出识别集。按「少任何一种即红」那条规矩,这里如实报名。
    if (!d.sites.length && !d.undetermined.length && /reply\.raw\.write|broadcastSSEEvent|StreamingResponse/.test(codeAll)) {
      acc.D.undetermined.push({ where: r.rel, reason: '文件里有发帧字样,但六种出口形态一条都没匹配 ⇒ 该处出口写法不在识别集内(不读成「这里不发帧」)', text: '' })
    }
  }
  const undetermined = acc.A.undetermined.length + acc.B.undetermined.length + acc.C.undetermined.length + acc.D.undetermined.length
  const produced = ['A', 'B', 'C', 'D'].reduce((n, k) => n + acc[k].sites.length + acc[k].notes.length + acc[k].undetermined.length, 0)
  const dead =
    files.length === 0
      ? 'dead:预筛在候选面枚举到 0 个文件 ⇒ 尺子没在工作,不得读成「已确认没有承载」'
      : produced === 0
        ? `dead:枚举到 ${files.length} 个文件却一格判据都没产出 ⇒ 预筛与判据不同形(读成「扫过了」就是假账)`
        : null
  return {
    face, root: top, listed: files.length, pyFiles, excludedTests: excluded, unreadable, tooBig, axes: acc, dead,
    counts: { listed: files.length, excludedTests: excluded.length, unreadable: unreadable.length, tooBig: tooBig.length, py: pyFiles.length, cInScope: cInScope.size, cOutOfScope, A: tally(acc.A), B: tally(acc.B), C: tally(acc.C), D: tally(acc.D), undetermined },
  }
}

/** 票面那句「落点未定」现在的判定 —— **从读数算,不写死**。三条出口,拿不到证据就落第三条。 */
export function verdictOf(r) {
  const keyLevel = r.axes.A.sites.filter((s) => /^key-level/.test(s.form))
  const replay = r.axes.A.sites.filter((s) => s.form === 'replay-equality')
  const wholeOrAppend = r.axes.A.notes.filter((s) => /整表|append/.test(s.reason || ''))
  const drift = r.axes.B.sites.filter((s) => s.form === 'order-drift-risk')
  const clampAbsent = r.axes.D.sites.filter((s) => s.form === 'clamp-absent')
  const clampInPlace = r.axes.D.sites.filter((s) => s.form === 'clamp-in-place')
  const filesOf = (list) => [...new Set(list.map((s) => String(s.at || '').split(':')[0]).filter(Boolean))].length
  const num = { keyLevel: keyLevel.length, keyLevelFiles: filesOf(keyLevel), replay: replay.length, wholeOrAppend: wholeOrAppend.length, drift: drift.length, driftFiles: filesOf(drift), clampAbsent: clampAbsent.length, clampInPlace: clampInPlace.length }
  if (r.dead) return { verdict: 'undetermined', why: r.dead, ...num }
  if (keyLevel.length > 0) {
    const keyed = keyLevel.filter((s) => s.keyedStore)
    return {
      verdict: replay.length ? 'carrier-exists-with-equality' : 'carrier-exists',
      why:
        `A 轴有 ${keyLevel.length} 处键级承载(${num.keyLevelFiles} 个文件;其中 ${keyed.length} 处体内另有 keyed 集合 ⇒「服务端一张表」那一型可达)` +
        (replay.length ? `、另有 ${replay.length} 处已写成逐字节重放等式` : '、**无一处**写成逐字节重放等式') +
        ` ⇒ 承载已在位,缺的是"要不要把重放等式写进契约"这一裁决 —— 这一格属架构决策,本尺只把站点列出来,不代裁`,
      ...num,
    }
  }
  if (r.counts.A.undetermined > 0) {
    return { verdict: 'undetermined', why: `A 轴零键级命中,但有 ${r.counts.A.undetermined} 格未判定(其中 Python 整族 ${r.counts.py ?? 0} 个文件)⇒ 不能落「不需要」,只能报「量过、Python 那一面没量到」`, ...num }
  }
  return { verdict: 'no-carrier', why: `A 轴零键级承载、零未判定,而整表/append 型 ${wholeOrAppend.length} 处 ⇒ 票面那一型在我方今天没有承载站点;要写得先引入「服务端一张表 + 键级增量」的前置结构(属架构决策,本尺不代裁)`, ...num }
}

/**
 * 头注/正文有没有谎称"已接线"。本尺刻意不在提交链,所以这些字样**一个都不许出现**
 * (出现即守门 89 的 R2 对每次提交判红 —— 恒红门的唯一出路是各会话跳门,§12e/§12f)。
 */
export function claimsWired(text) {
  const hits = []
  const re = /(已接|已接入|接入|挂在)\s*(pre-commit|pre-push|提交链|guardian|守门)|guardian\s*第\s*\d+\s*项|pre-commit\s*第\s*\d+\s*项/g
  for (const m of String(text ?? '').matchAll(re)) hits.push(m[0])
  if (/HUSKY_SKIP_[A-Z0-9_]+/.test(String(text ?? ''))) hits.push('声明了应急跳过变量(不在钩子链上的尺子不该有)')
  return hits
}
// ─── 报告 ────────────────────────────────────────────────────────────────────

const C = { red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' }
const AXIS_TITLE = {
  A: 'A 承载轴 —「把 diff/patch 施加到既有状态上」的函数形态',
  B: 'B 键序轴 — 用 JSON.stringify 当等值/身份判据的站点(键序一等公民)',
  C: 'C 必填/可缺省轴 — 键序与可缺省集能否从 schema 现读派生',
  D: 'D 帧序/clamp 轴 —「发帧前先 clamp 到旧消费者界」的同型需求点',
}

function printBucket(label, items, showAll, color) {
  const cap = LIST_CAP
  console.log(`${color}▸ ${label}${C.reset}(${items.length}${!showAll && items.length > cap ? `,截断 ${cap};--all/--json 看全量` : ''})`)
  if (!items.length) {
    console.log(`    ${C.dim}(空)${C.reset}`)
    return
  }
  const line = (it) => {
    const where = it.where || it.at || ''
    const txt = it.text ? ` ${C.dim}${it.text}${C.reset}` : ''
    const note = it.note || it.reason || ''
    return `    ${it.form ? `[${it.form}] ` : ''}${where}${txt}${note && !it.reason ? `\n        ${C.dim}${note}${C.reset}` : ''}`
  }
  if (showAll) {
    for (const it of items.slice(0, cap * 20)) console.log(line(it))
    return
  }
  // 同一原因重复数百次(Python 整族那一型)时按原因归组:文件名仍然逐条给,只是不再把同一句
  // 解释抄 469 遍 —— 噪声淹掉信号与"点名"是两件事,`--json` 面永远逐条全量。
  const groups = new Map()
  const singles = []
  for (const it of items) {
    const key = it.reason && it.reason.length > 24 ? it.reason : null
    if (!key) singles.push(it)
    else {
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(it)
    }
  }
  let printed = 0
  for (const it of singles) {
    if (printed >= cap) break
    console.log(line(it))
    printed += 1
  }
  for (const [reason, list] of groups) {
    if (printed >= cap) break
    const uniq = [...new Set(list.map((x) => String(x.where || x.at || '').split(':')[0]))]
    console.log(`    ${uniq.slice(0, 12).join(', ')}${uniq.length > 12 ? ` +${uniq.length - 12} 个同因文件` : ''} (${list.length} 格)`)
    console.log(`        ${C.dim}${reason}${C.reset}`)
    printed += 1
  }
}

export function planReport(r, { showAll = false } = {}) {
  const v = verdictOf(r)
  console.log(`${C.cyan}── 快照↔增量「逐字节重放等式」取证(--plan:只读、不判红、不在提交链)${C.reset}`)
  console.log(
    `判定面:${r.face === 'staged' ? '索引 blob' : r.face === 'worktree' ? '工作树(仅人工取证档,不得据此问责提交)' : 'HEAD blob'} ｜ 预筛枚举 ${r.listed} ｜ 测试/产物面排除 ${r.counts.excludedTests} ｜ Python 整族未判定 ${r.counts.py} ｜ 取不到 ${r.counts.unreadable} ｜ 超判据上限 ${r.counts.tooBig}`,
  )
  console.log(
    `${C.dim}C 轴射程:A/B 命中所在文件 或 已在用 Object.keys(x.shape)/safeParse(undefined) 的文件 = ${r.counts.cInScope ?? 0} 个;其余 ${r.counts.cOutOfScope ?? 0} 个文件按定义不属 C 轴(既不记命中也不记放过,理由见 analyze 里那段自扩说明)${C.reset}`,
  )
  if (r.counts.unreadable) {
    const l = showAll ? r.unreadable : r.unreadable.slice(0, 8)
    console.log(`  ${C.yellow}内容取不到(逐条):${l.join(', ')}${!showAll && r.unreadable.length > 8 ? ' …' : ''}${C.reset}`)
  }
  for (const k of ['A', 'B', 'C', 'D']) {
    const a = r.axes[k]
    const c = r.counts[k]
    console.log(`\n${C.cyan}${AXIS_TITLE[k]}${C.reset}   ${c.hit} 命中 / ${c.pass} 放过 / ${c.undetermined} 未判定`)
    printBucket('命中', a.sites, showAll, C.red)
    printBucket('放过(明确不适用,逐条点名)', a.notes, showAll, C.green)
    printBucket('未判定(点名原因)', a.undetermined, showAll, C.yellow)
  }
  console.log(`\n${C.cyan}── 票面那句「落点未定」的当前判定${C.reset}`)
  console.log(`  ${v.verdict === 'undetermined' ? C.yellow : C.green}落点 = ${v.verdict}${C.reset}`)
  console.log(`  ${v.why}`)
  console.log(
    `  读数依据:键级承载 ${v.keyLevel} 处/${v.keyLevelFiles} 文件 ｜ 已写成逐字节等式 ${v.replay} 处 ｜ 整表或 append 型 ${v.wholeOrAppend} 处 ｜ 键序漂移风险 ${v.drift} 处/${v.driftFiles} 文件 ｜ 无界发帧 ${v.clampAbsent} 处、已 clamp 发帧 ${v.clampInPlace} 处 ｜ 未判定合计 ${r.counts.undetermined} 处(Python 整族 ${r.counts.py})`,
  )
  console.log(`\n${C.dim}本尺不判红:命中与放过都不改退出码;exit 2 只来自「空扫」与 --strict 下的未判定。它不在 guardian-runner / .husky / package.json,因此没有应急跳过变量。${C.reset}`)
  return v
}
// ─── 自检(构造面成对正反例;判据一律走导出的真函数,不在自检里重写一遍)────────

export function selfTest() {
  const cases = []
  const t = (name, cond, extra = '') => cases.push({ name, ok: cond === true, extra: cond === true ? '' : String(extra ?? '') })
  const run = (src) => {
    const f = faces(src)
    return { A: judgeCarrier('a.ts', f.codeAll, f.codeStrict), B: judgeKeyOrder('a.ts', f.codeStrict), C: judgeSchema('a.ts', f.codeAll, f.codeStrict), D: judgeClamp('a.ts', f.codeAll, f.codeStrict) }
  }
  const J = (src) => JSON.stringify(run(src))
  const ev = (src, ax, fn) => fn(run(src)[ax])
  /** verdictOf 的构造面:默认零站点零未判定,按用例只填要改的那一格。 */
  const fake = (a = {}, counts = {}) => ({ dead: null, axes: { A: { sites: [], notes: [], undetermined: [], ...a }, B: { sites: [] }, C: { sites: [] }, D: { sites: [] } }, counts: { undetermined: 0, py: 0, A: { undetermined: 0 }, ...counts } })

  const KEY_MERGE = `export function mergeWorkflowRunDelta(base, patch) {\n  const out = {}\n  for (const [k, v] of Object.entries(patch)) {\n    out[k] = v\n  }\n  return out\n}\n`
  const APPEND_ONLY = `export function appendFrames(prev, frame) {\n  return [...prev, frame]\n}\n`
  const WHOLE_TABLE = `export function applyRunSnapshot(state, snap) {\n  state = snap\n  return state\n}\n`
  const REPLAY = `const ok = JSON.stringify(applyDelta(snap, diff)) === JSON.stringify(next)\n`
  const STR_EQ = `if (JSON.stringify(prev) === JSON.stringify(validated)) return prev\n`
  const COND_SPREAD = `const p = { ...(x !== undefined ? { k: v } : {}) }\nif (JSON.stringify(a) === JSON.stringify(b)) c()\n`
  const COND_ONLY = `export function noop(p, x) {\n  return { ...(x ? { k: p } : {}) }\n}\n`
  const CONTENT_EQUAL = `import { contentEqual } from './content-equal.js'\nexport function eq(a, b) {\n  return contentEqual(a, b)\n}\n`
  const CANON = `export function handle(o) {\n  return canonicalSerialize(o)\n}\n`
  const ZOD = `const RunSchema = z.object({ id: z.string(), title: z.string().optional(), n: z.number() })\n`
  const ZOD_SPREAD = `const S = z.object({ ...base.shape, extra: z.string() })\n`
  const ZOD_UNBALANCED = `const Bad = z.object({ id: z.string(),\n`
  const TS_IFACE = `export interface WireRun {\n  id: string\n  title?: string\n}\n`
  const EMIT_CLAMP = `function send(reply, f) {\n  reply.raw.write(\`data: \${JSON.stringify(f)}\\n\\n\`)\n}\nconst MAX_FRAME_BYTES = 4096\nfunction clampFrame(n) {\n  return Math.min(n, MAX_FRAME_BYTES)\n}\n`
  const EMIT_NO_CLAMP = `function send(reply, f) {\n  reply.raw.write(\`data: \${JSON.stringify(f)}\\n\\n\`)\n}\n`
  const NO_BODY = `function mergeDeltaFrame(base, patch) {\n  const o = { ...\n}\n`
  const NO_GRANULARITY = `function mergeDeltaFrame(base, patch) {\n  return base\n}\n`
  const COMMENT_ONLY = `// export function mergeWorkflowRunDelta(base, patch) {\n//   for (const [k, v] of Object.entries(patch)) out[k] = v\n// }\n`
  const COMMENT_EMIT = `// reply.raw.write(\`data: \${x}\`)\n// Math.min(a, MAX_FRAME_BYTES)\n`
  const DUMP_ONLY = `export function dump(o) {\n  return JSON.stringify(o)\n}\n`
  const HALF_EQ = `const changed = snapshot !== JSON.stringify(next)\nexport function f(){ return changed }\n`
  const HALF_EQ_ALT = `const snapshot = 1\nexport function f(x){ return x !== JSON.stringify(snapshot) }\n`
  const KEYED_MAP = `export function mergeRunState(base, patch) {\n  const m = new Map<string, number>()\n  for (const [k, v] of Object.entries(patch)) m.set(k, v)\n  return m\n}\n`

  t('ST1 键级增量承载 ⇒ A 命中 key-level', ev(KEY_MERGE, 'A', (j) => j.sites.some((s) => s.form === 'key-level')), J(KEY_MERGE))
  t('ST1b 同一形态只写在注释里 ⇒ 不得命中(尺子不得把自己的解释当站点)', ev(COMMENT_ONLY, 'A', (j) => j.sites.length === 0), J(COMMENT_ONLY))
  t('ST2 帧流 append ⇒ A 放过并写明"我方现状那一型"', ev(APPEND_ONLY, 'A', (j) => j.sites.length === 0 && j.notes.length === 1 && /append/.test(j.notes[0].reason)), J(APPEND_ONLY))
  t('ST2b 整表重发 ⇒ A 放过并写明"键级这一型不成立"', ev(WHOLE_TABLE, 'A', (j) => j.sites.length === 0 && j.notes.some((s) => /整表/.test(s.reason))), J(WHOLE_TABLE))
  t('ST3 票面等式已逐字节写成 ⇒ A 命中 replay-equality', ev(REPLAY, 'A', (j) => j.sites.some((s) => s.form === 'replay-equality')), J(REPLAY))
  t('ST4 stringify 等值判据 ⇒ B 命中 stringify-equality', ev(STR_EQ, 'B', (j) => j.sites.some((s) => s.form === 'stringify-equality')), J(STR_EQ))
  t('ST5「键序不同而内容同」:等值判据 + 条件展开同文件 ⇒ order-drift-risk 必命中', ev(COND_SPREAD, 'B', (j) => j.sites.some((s) => s.form === 'order-drift-risk')), J(COND_SPREAD))
  t('ST5b 只有条件展开、没有 stringify 判据 ⇒ 不得凭空造 drift 命中', ev(COND_ONLY, 'B', (j) => !j.sites.some((s) => s.form === 'order-drift-risk')), J(COND_ONLY))
  t('ST6 contentEqual ⇒ B 放过并写明"键序无关"', ev(CONTENT_EQUAL, 'B', (j) => j.notes.some((s) => /键序无关/.test(s.reason))), J(CONTENT_EQUAL))
  t('ST7 canonical 序列化 ⇒ B 放过并写明"另一语义"(票面那句定性的载体)', ev(CANON, 'B', (j) => j.notes.some((s) => /另一语义/.test(s.reason))), J(CANON))
  t('ST8 zod 字面形状 ⇒ C 现读出键序与可缺省数', ev(ZOD, 'C', (j) => /3 键,1 可缺省/.test(j.sites.find((s) => s.form === 'shape-derivable')?.text ?? '')), J(ZOD))
  t('ST9 读不到 schema(spread)⇒ 未判定,不得算放过', ev(ZOD_SPREAD, 'C', (j) => j.undetermined.length >= 1 && j.notes.filter((s) => s.state === 'pass').length === 0), J(ZOD_SPREAD))
  t('ST9b 形状体配不平 ⇒ 同样未判定(不读成「没有 schema」)', ev(ZOD_UNBALANCED, 'C', (j) => j.undetermined.length >= 1), J(ZOD_UNBALANCED))
  t('ST10 TS interface ⇒ C 明确不适用并写明"运行时没有 .shape"', ev(TS_IFACE, 'C', (j) => j.notes.some((s) => /运行时没有/.test(s.reason))), J(TS_IFACE))
  t('ST11 发帧前已 clamp ⇒ D 命中 clamp-in-place', ev(EMIT_CLAMP, 'D', (j) => j.sites.some((s) => s.form === 'clamp-in-place')), J(EMIT_CLAMP))
  t('ST12 发帧而无界 ⇒ D 命中 clamp-absent(票面那一格的候选落点)', ev(EMIT_NO_CLAMP, 'D', (j) => j.sites.some((s) => s.form === 'clamp-absent')), J(EMIT_NO_CLAMP))
  t('ST12b 同一形态只写在注释里 ⇒ D 不得命中(界化形态必须是代码)', ev(COMMENT_EMIT, 'D', (j) => j.sites.length === 0), J(COMMENT_EMIT))
  t('ST13 体配不平 ⇒ A 未判定,绝不"取到行尾"凑一个体', ev(NO_BODY, 'A', (j) => j.sites.length === 0 && j.undetermined.length === 1), J(NO_BODY))
  t('ST13b 体读得出但三种粒度都不成立 ⇒ 同样未判定(不折成放过)', ev(NO_GRANULARITY, 'A', (j) => j.sites.length === 0 && j.notes.length === 0 && j.undetermined.length === 1), J(NO_GRANULARITY))
  t('ST13c 纯序列化输出(没有任何比较式)⇒ B 既不命中也不虚报未判定(不制造噪声格)', ev(DUMP_ONLY, 'B', (j) => j.sites.length === 0 && j.undetermined.length === 0), J(DUMP_ONLY))
  t('ST13d 半截比较式(一侧是变量)⇒ 未判定,不得静默当"没有键序债"', ev(HALF_EQ, 'B', (j) => j.sites.length === 0 && j.undetermined.length === 1), J(HALF_EQ_ALT))
  t('ST13e C 射程判据:用过派生通道的文件无条件进射程,没用过的不进', cScopePredicate('const ks = Object.keys(RunSchema.shape)\n') && cScopePredicate('const r = RunSchema.safeParse(undefined)\n') && !cScopePredicate('const r = RunSchema.parse(x)\n'))
  t('ST13f A 命中带不带 keyed 集合要分得开(票面"服务端一张表"那一型的判据)', ev(KEYED_MAP, 'A', (j) => j.sites.find((s) => s.form === 'key-level')?.keyedStore === true) && ev(KEY_MERGE, 'A', (j) => j.sites.find((s) => s.form === 'key-level')?.keyedStore === false), J(KEYED_MAP))
  t('ST14 Python 面 ⇒ A/B/C/D 单文件判据一律不命中(整族由 analyze 汇成一格未判定)', judgeCarrier('x.py', 'def apply_delta(base, patch):\n    for k, v in patch.items():\n        base[k] = v\n', 'def apply_delta(base, patch):\n    for k, v in patch.items():\n        base[k] = v\n').sites.length === 0 && judgeClamp('x.py', 'yield f"data: {x}"', 'yield f"data: {x}"').sites.length === 0 && judgeKeyOrder('x.py', 'x = json.dumps(a) == json.dumps(b)').sites.length === 0)
  t('ST14b Python 面不得被记成放过(没判 ≠ 不适用)', judgeCarrier('x.py', 'def apply_delta(a, b):\n    return a\n', 'x').notes.length === 0)
  t('ST15 空扫 ⇒ verdict 落 undetermined(不得读成「已确认没有」)', verdictOf({ ...fake(), dead: 'dead:枚举 0' }).verdict === 'undetermined')
  t('ST16 A 零键级 + 零未判定 + 有整表 ⇒ no-carrier(已判定为无承载站点)', verdictOf(fake({ notes: [{ reason: '整表赋值 / replaceAll' }] })).verdict === 'no-carrier')
  t('ST16b 有未判定(Python 整族)⇒ 不得落 no-carrier', verdictOf(fake({ undetermined: [{ where: 'x.py', reason: 'Python 面' }] }, { undetermined: 1, py: 1, A: { undetermined: 1 } })).verdict === 'undetermined')
  t('ST17 有键级承载 ⇒ carrier-exists(落点不需要引入新架构),且文件数独立于处数', (() => {
    const v = verdictOf(fake({ sites: [{ form: 'key-level', at: 'a.ts:1' }, { form: 'key-level', at: 'a.ts:20' }] }))
    return v.verdict === 'carrier-exists' && v.keyLevel === 2 && v.keyLevelFiles === 1
  })(), JSON.stringify(verdictOf(fake({ sites: [{ form: 'key-level', at: 'a.ts:1' }, { form: 'key-level', at: 'a.ts:20' }] }))))
  const gaps = prefilterGaps()
  t('ST-PRE 预筛必须是各轴判据真实形态的超集(漏一项 ⇒ 尺子对自己立项那一型失明)', gaps.length === 0, `预筛缺:${gaps.join(' | ')}`)
  t('ST-PREb 该判据有牙:从预筛里抽掉一条 ⇒ 对应形态必落 gaps', prefilterGaps(['contentEqual(a, b)'], PREFILTER.filter((p) => p !== 'contentEqual')).length === 1)
  t('ST-PREc 预筛正则本身坏 ⇒ 报"编译不过"而不是空数组(不得静默通过)', prefilterGaps(['x'], ['[']).length === 1 && /编译不过/.test(prefilterGaps(['x'], ['['])[0]))
  t('ST-CLAIM 自称已接线/自称有应急变量的措辞必须被点名(本尺不在提交链)', claimsWired('本门已接 pre-commit,guardian 第 200 项,HUSKY_SKIP_X=1 可跳').length >= 3 && claimsWired('本尺不接提交链,没有应急跳过变量').length === 0, JSON.stringify(claimsWired('本尺不接提交链,没有应急跳过变量')))
  t('ST-BAL matchBracket 的配平与配不平各一条', matchBracket('{a:{b}}x', 0) === 7 && matchBracket('{a(', 0) === -1)
  t('ST-SHAPE deriveSchemaShape 的正常/spread/计算键三态各一条', (() => {
    const ok = deriveSchemaShape(' a: z.string(), b: z.number().optional() ')
    const sp = deriveSchemaShape(' ...base.shape, extra: z.string() ')
    const dk = deriveSchemaShape(' [k]: z.string(), id: z.string() ')
    return ok.balanced && ok.keys.length === 2 && ok.keys[1].optional === true && sp.balanced && sp.keys.length === 1 && sp.problems.length === 1 && dk.balanced && dk.keys.length === 1 && /计算键/.test(dk.problems[0])
  })(), JSON.stringify(deriveSchemaShape(' [k]: z.string(), id: z.string() ')))
  t('ST-LIST 三面各只在自己那一带 rev / --cached(清单与内容同面)', (() => {
    const h = listArgsFor('head').join(' ')
    const s = listArgsFor('staged').join(' ')
    const w = listArgsFor('worktree').join(' ')
    return /HEAD -- apps packages$/.test(h) && !h.includes('--cached') && /--cached -- apps packages$/.test(s) && !s.includes('HEAD') && !w.includes('--cached') && !w.includes('HEAD')
  })(), [listArgsFor('head').join(' '), listArgsFor('staged').join(' '), listArgsFor('worktree').join(' ')].join(' § '))
  return { pass: cases.filter((c) => c.ok).length, fail: cases.filter((c) => !c.ok).length, cases }
}
// ─── CLI ─────────────────────────────────────────────────────────────────────

export function main(argv = process.argv.slice(2)) {
  const fail = (msg, soft = false) => (console.error(`${soft ? C.yellow : C.red}❌ ${msg}${C.reset}`), Promise.resolve(2))
  const flags = new Set(argv.filter((a) => a.startsWith('--')))
  const known = new Set(['--plan', '--all', '--json', '--staged', '--worktree', '--strict', '--self-test'])
  const unknown = [...flags].filter((f) => !known.has(f))
  if (unknown.length) {
    console.error(`${C.red}❌ 不认识开关:${unknown.join(' ')}(可用:${[...known].join('|')})${C.reset}`)
    return Promise.resolve(2) // 不认识的开关不能当成"没要求"放过去
  }
  const faceSel = selectFace({ staged: flags.has('--staged'), worktree: flags.has('--worktree') })
  if (faceSel.error) return fail(faceSel.error)
  if (flags.has('--self-test')) {
    const r = selfTest()
    for (const c of r.cases.filter((x) => !x.ok)) console.log(`${C.red}✘ ${c.name}${c.extra ? ` ⇒ ${c.extra}` : ''}${C.reset}`)
    console.log(`[projection-replay-equality] 自检 例数 ${r.cases.length} 通过 ${r.pass} 失败 ${r.fail}`)
    return Promise.resolve(r.fail === 0 ? 0 : 1)
  }
  let res
  try {
    res = analyze({ face: faceSel.face })
  } catch (e) {
    return fail(`无法判定:${e instanceof Undetermined ? e.message : e && e.message}`)
  }
  if (flags.has('--json')) console.log(JSON.stringify({ ...res, verdict: verdictOf(res) }))
  else planReport(res, { showAll: flags.has('--all') })
  // 尺子不判红:命中与放过都不改退出码。exit 2 只来自「没判到」与「空扫」。
  if (res.dead) return fail(res.dead)
  if (flags.has('--strict') && res.counts.undetermined > 0) return fail(`拒绝出具合格证:未判定 ${res.counts.undetermined} 格(逐条见上)`, true)
  if (flags.has('--strict') && res.counts.unreadable > 0) return fail(`内容取不到 ${res.counts.unreadable} 个文件 ⇒ 面不完整,不出合格证`, true)
  return Promise.resolve(0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    },
  )
}

export const __test__ = {
  PREFILTER, SAMPLES_MUST_PREFILTER, SCOPE_DIRS, EXCLUDE_RE, MAX_FILE_CHARS, LIST_CAP,
  matchBracket, faces, prefilterGaps, deriveSchemaShape, cScopePredicate, judgeCarrier,
  judgeKeyOrder, judgeSchema, judgeClamp, listArgsFor, enumerate, listFace, readFace,
  analyze, verdictOf, claimsWired, planReport, selfTest, main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
