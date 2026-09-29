// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 判据与预筛**同源**(都由 TEXT_OPS 派生):预筛漏一个算子,门就对该算子整型失明而账面报绿
// (守门 102 的"预筛必须是判据字面量超集"同一条对账)。

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000
const SELF = 'scripts/check-error-code-not-text-matching.mjs'

/**
 * 取材遮噪方向(刻意与门 135 相反,而且必须相反):
 * 本门要判的就是 `includes('429')` 里那个**字面量**,把字符串一起遮掉,判据当场对该形态全盲
 * —— 而全盲的门报出来的是"零违规",这是最贵的一种假绿。所以这里**只遮注释、保留字符串**。
 * 反过来,不遮注释就会把说明文字判成违规(门 131 正是被自己写的解释判红的)。
 * 两档各服务一侧,但**分词器只许一台** —— 都走 `scripts/lib/code-mask.mjs`,本门不留第二份遮噪。
 */
const EXEMPT = /error-code-exempt:\s*\S/
const SCAN_ROOTS = ['apps/', 'packages/']
const SCAN_EXT = /\.(tsx|ts|jsx|js)$/
/**
 * 测试面不判红,但**必须报名**。
 * 立票的实测证据之一就是 `apps/cli/tests/rate-limit-retry.test.ts` 把"按文本判"当**契约**钉着:
 * 测试面写下这种断言时,缺陷会从"实现里的一处疏忽"升级成"改了就红"的锁。整条豁免掉测试面就等于
 * 看不见这一型;把它判红又会在正当形态(断言外部驱动的真实文本)上误伤。
 * 所以:不进红条件、不静默丢弃,`--all` 逐文件量出来并打印。
 */
const TEST_NOISE = /(^|\/)(tests?|__tests__|e2e|__mocks__|fixtures)(\/|$)|\.(test|spec)\.[tj]sx?$/
/** 自豁免:本门自己的源码与镜像测试里全是判据字面量(不在 SCAN_ROOTS 内,这条是第二重保险)。 */
const SELF_EXEMPT = [SELF, 'scripts/tests/check-error-code-not-text-matching.test.mjs']
/**
 * 唯一出口的落点**跨两个文件**,所以两个文件各自有自己的必备导出 ——
 * 把两个文件的名单并成一张表去查一个文件,会让门对"出口被搬走"这一正当重构判红,
 * 而一红就只能跳钩子(§12e 那一型)。
 *  - 工具主模块(`tools/index.ts`):被计数的文本档 `classifyError`,以及递出的具名错误类 `ToolError`;
 *  - 判定出口(`tools/failure-classification.ts`):`resolveFailureCode` 与 `ToolError` 的原始声明。
 */
const OUTLET_INDEX_FILE = 'apps/cli/src/tools/index.ts'
const OUTLET_CLASS_FILE = 'apps/cli/src/tools/failure-classification.ts'
const OUTLET_REQUIREMENTS = Object.freeze([
  { file: OUTLET_INDEX_FILE, exports: ['classifyError', 'ToolError'] },
  { file: OUTLET_CLASS_FILE, exports: ['resolveFailureCode', 'ToolError', 'getFailureFallbackStats'] },
])
/** 供 --all/报告点名的主出口文件(两个都缺才算没出路,单个缺是该文件的摘线)。 */
const OUTLET_FILE = OUTLET_INDEX_FILE
const OUTLET_REQUIRED_EXPORTS = OUTLET_REQUIREMENTS[0].exports

/** 文本匹配算子。**判据与预筛都从这一张表派生** —— 不得在别处再抄一份算子清单。 */
const TEXT_OPS = Object.freeze(['includes', 'indexOf', 'lastIndexOf', 'startsWith', 'endsWith', 'search', 'match', 'test'])
const TEXT_OP_CLASS = TEXT_OPS.join('|')
const PRESCREEN = TEXT_OPS.map((op) => `.${op}(`)
/**
 * 宿主形态(`/re/.test(x)`)只认这三个算子 —— 它们才是"把一个正则当判据喂进去"的那几个。
 * 这张子集必须是 TEXT_OPS 的子集(自检 S1 钉住):否则它就是一份漂出去的第二个算子清单,
 * 而漂出去的清单的表现永远是"门照报绿"。
 */
const RECEIVER_OPS = Object.freeze(['test', 'match', 'search'])

/** 名字本身就像"错误/消息"的标识符(整词,或驼峰里以 Err/Message/… 结尾)。 */
const MESSAGE_IDENT =
  String.raw`\b(?:err|errs|error|errors|exception|exceptions|exc|msg|msgs|message|messages|reason|reasons|detail|details|failure|failures|cause|causes|stdout|stderr|rawMessage|errorMsg|errMsg|errText|errorText|errorMessage)\b|\b[A-Za-z_$][\w$]*(?:Err|Error|Message|Reason|Detail|Failure|Msg)\b`
/** 挂在任意表达式后面的"文本成员"—— `res.error` / `err.response.data.message` / `e.detail` 都算。 */
const TEXT_MEMBER = String.raw`[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*\s*\.\s*(?:message|msg|error|stderr|reason|detail|errMsg|errText)\b`
/** 叶子表达式:具名标识符 | 带文本成员的链 | 别名(由 buildSubject 追加)。 */
const TEXT_LEAF = `(?:${MESSAGE_IDENT}|${TEXT_MEMBER})`
/** 叶子后面常见的归一化链(`.toLowerCase()` / `?? ''` 这类两步式写法)。 */
const NORMALIZE_CHAIN = String.raw`(?:\s*\?\?\s*[^,;\n]{0,24})?(?:\s*\.\s*(?:trim|toLowerCase|toUpperCase)\s*\(\s*\))*`
const NAMED_TEXT = `(?:${TEXT_LEAF}${NORMALIZE_CHAIN})`
const STRING_OF_TEXT = String.raw`String\s*\(\s*` + `(?:${TEXT_LEAF})` + String.raw`\s*\)`
const TEXT_SUBJECT_BASE = `(?:${NAMED_TEXT}|${STRING_OF_TEXT})`

/**
 * 一跳别名:`const e = (error ?? '').toLowerCase()` 之后,判据读的是 `e.includes('429')`。
 *
 * 这一跳不是锦上添花 —— **本票立项那条原文就是这个形状**
 * (改前 `classifyError` 写的是 `const e = (error ?? '').toLowerCase()` 再逐条 `e.includes(...)`)。
 * 不认它,门就对自己要防的那一型全盲,而账面一路报绿(守门 70/76/81 "判据失效的表现永远是安静"同族)。
 * 只走一跳、只认 `const|let|var <id> = <含文本来源的表达式>`,不做数据流分析(再深就是猜);
 * 别名**不按名字长度过滤** —— 单字母 `e` 正是那条原文用的名字,把它筛掉等于把缺陷筛掉。
 */
const ALIAS_DECL_RE = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*[^;\\n]*${TEXT_SUBJECT_BASE}`, 'g')

function buildSubjectRegex(aliases) {
  // Set 没有 `.length` —— 写成 length 会让别名整档静默失效(判据"在位而不生效"是本仓最贵的失效型:
  // 它报的是"零违规",不是"我没看见")。这里用 size,并由自检 T1 的别名两条用例钉住。
  const extra = aliases && aliases.size ? `|\\b(?:${[...aliases].join('|')})\\b${NORMALIZE_CHAIN}` : ''
  const subject = `(?:${NAMED_TEXT}|${STRING_OF_TEXT}${extra})`
  return {
    status: new RegExp(`${subject}\\s*\\.\\s*(?:${TEXT_OP_CLASS})\\s*\\(\\s*['"\`]\\d{3}`),
    literal: new RegExp(`${subject}\\s*\\.\\s*(?:${TEXT_OP_CLASS})\\s*\\(\\s*['"\`]`),
    regexArg: new RegExp(`${subject}\\s*\\.\\s*(?:${TEXT_OP_CLASS})\\s*\\(\\s*/`),
    regexReceiver: new RegExp(
      `/[^/\\n]+/[a-z]*\\s*\\.\\s*(?:test|match|search)\\s*\\(\\s*(?:String\\s*\\(\\s*(?:${subject})\\s*\\)|(?:${subject}))\\s*\\)`,
    ),
    subject,
  }
}

const BASE_REGEXES = buildSubjectRegex(new Set())

/**
 * 别名收集的最小止损:只排除语言关键字与算子名(它们当上"文本变量"的概率是零),
 * **不按长度过滤** —— 本票立项那条原文用的就是单字母 `e`
 * (`const e = (error ?? '').toLowerCase()`),按长度筛就等于把门要防的那一型挡在视野外。
 */
const ALIAS_STOP = new Set(['if', 'else', 'for', 'while', 'switch', 'case', 'return', 'const', 'let', 'var', 'new', 'typeof', 'instanceof', 'String', 'Number', 'Boolean', 'includes', 'indexOf', 'search', 'match', 'test'])

function collectAliases(codeLines) {
  const aliases = new Set()
  for (const line of codeLines) {
    ALIAS_DECL_RE.lastIndex = 0
    let m
    while ((m = ALIAS_DECL_RE.exec(line)) !== null) {
      const id = m[1]
      if (!id || ALIAS_STOP.has(id)) continue
      aliases.add(id)
      if (aliases.size >= 64) return aliases
    }
  }
  return aliases
}

/**
 * 命中判据的分型。顺序即优先级(状态码那一型最具体,先判)。
 *
 * 为什么**不要求**"在 if / 三元里":一次 `.includes('429')` 无论摆在条件、返回值还是标签里,
 * 都是"把文本当判据"。要求分支上下文会让"先算一个 severity 再按它分流"这种两步式整型隐身
 * (本仓实际写法就是两步式),而误伤面由"必须是文本来源的表达式 + 参数必须是字面量"两道窄口径兜住。
 */
export function classifyLine(line, aliases) {
  const re = aliases && aliases.size ? buildSubjectRegex(aliases) : BASE_REGEXES
  if (re.status.test(line)) return 'status-as-text'
  if (re.literal.test(line)) return 'literal-in-text-op'
  if (re.regexArg.test(line)) return 'regex-in-text-op'
  if (re.regexReceiver.test(line)) return 'regex-receiver-on-text'
  return null
}

/**
 * 跨行拼接的文本判据:算子在一行、字面量在下一行。
 * 只数不判红(它可能只是正常的多行调用,猜不得),但必须打印 —— 否则"单行判据"这个已知盲区
 * 会被读成"仓库里没有这种形态"。
 */
export function countMultilineCandidates(codeLines, aliases) {
  let n = 0
  for (let i = 0; i < codeLines.length - 1; i++) {
    const line = codeLines[i] ?? ''
    const next = (codeLines[i + 1] ?? '').trim()
    if (!/^['"`]/.test(next)) continue
    if (!PRESCREEN.some((op) => line.includes(op))) continue
    if (classifyLine(line, aliases)) continue
    n += 1
  }
  return n
}

/**
 * 单文件判据(纯函数,构造面可证)。四态绝不并桶:
 *  - hits:进入红条件候选的站点
 *  - exempted:带原因的行内豁免(只报数,到期由守门 108 追)
 *  - undetermined:算子与字面量分在两行 —— 单行判据的已知盲区,**如实计数,不当"没有"**
 *  - unreadable:输入不是字符串(取材失败),由调用方换算成 exit 2
 */
export function findTextMatching(text) {
  const hits = []
  const exempted = []
  if (typeof text !== 'string') return { hits, exempted, undetermined: 0, aliases: 0, unreadable: true }
  const raw = text.split('\n')
  const code = maskComments(text).split('\n')
  const aliases = collectAliases(code)
  for (let i = 0; i < code.length; i++) {
    const line = code[i] ?? ''
    if (!line.trim()) continue
    const kind = classifyLine(line, aliases)
    if (!kind) continue
    const rawLine = raw[i] ?? ''
    const prev = i > 0 ? raw[i - 1] ?? '' : ''
    const prevIsPureComment = /^\s*(?:\/\/|\/\*|\*)/.test(prev)
    if (EXEMPT.test(rawLine) || (prevIsPureComment && EXEMPT.test(prev))) {
      exempted.push({ line: i + 1, kind, text: rawLine.trim().slice(0, 140) })
      continue
    }
    hits.push({ line: i + 1, kind, text: rawLine.trim().slice(0, 140) })
  }
  return { hits, exempted, undetermined: countMultilineCandidates(code, aliases), aliases: aliases.size, unreadable: false }
}

function isTestSurface(p) {
  return TEST_NOISE.test(p)
}

function inScope(p) {
  if (!SCAN_EXT.test(p)) return false
  if (!SCAN_ROOTS.some((d) => p.startsWith(d))) return false
  if (isTestSurface(p)) return false
  if (SELF_EXEMPT.some((s) => p === s)) return false
  return true
}

/**
 * 符号是否真的被**递出**:两种合法形态都算 ——
 * ① 就地声明 `export (const|function|class) NAME`;
 * ② 再导出 `export { NAME } from './x.js'`(本票的 `ToolError` 正是这一型:类住在
 *    `failure-classification.ts`,由工具主模块递出去,好让 handler 共享同一个构造函数)。
 * 只认①会让门对"出口被搬进另一个文件"这一正当重构判红 —— 而门一红,唯一出路就是跳钩子(§12e)。
 */
export function exportsSymbol(text, name) {
  return (
    new RegExp(`export\\s+(?:const|function|class|async\\s+function)\\s+${name}\\b`).test(text) ||
    new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(text)
  )
}

/**
 * 唯一出口在不在位 —— 纯函数 + 构造面证明(守门 103 那一课:证明取材/判定这类行为只能用
 * 纯函数 + 构造面,不得依赖仓库瞬时状态)。
 *
 * 返回三态字符串而不是布尔:`unreadable` 与 `stripped` 的处置动作完全不同(前者先查自落格,
 * 后者是把别人拆了),把它们并成一格就等于把"没判"写成"判过了"。
 */
export function detectOutlet(text, requiredExports) {
  if (typeof text !== 'string') return 'unreadable'
  const list = requiredExports ?? OUTLET_REQUIRED_EXPORTS
  const missing = list.filter((name) => !exportsSymbol(text, name))
  return missing.length === 0 ? 'ok' : 'stripped'
}

/**
 * 接线状态与出口在位性必须**成对**判 —— 这是本门被摘出提交链那一次留下的契约。写成纯函数是为了
 * 让两侧都能喂构造面(镜像若只判仓库瞬时状态,就等于把"此刻恰好不红"当证据;守门 103 那一课)。
 *
 * 两个方向各拦一型:① 出口还没入库就把门接进提交链 ⇒ 干净 HEAD 恒红,唯一结局是各会话跳钩子、
 * 该枚提交上全部守门作废(§12e);② 出口已经入库却没人接线 ⇒ 判据存在而零调度器,即"造好没装车"。
 * 注册面问不到 ⇒ 判"未判定"并返回 false,绝不冒充通过。
 */
export function wiringConsistent(outletStatus, runnerText, selfPath = SELF) {
  if (typeof runnerText !== 'string') return false
  const wired = runnerText.includes(selfPath)
  return outletStatus === 'ok' ? wired : !wired
}

/**
 * 两个出口文件在**同一轮、同一面**上各自查一遍(清单与内容必须同面同轮 —— 门 101/103/118 同条纪律)。
 * 聚合方向刻意保守:任一文件被摘线 ⇒ stripped;任一读不到 ⇒ unreadable;全部齐备才 ok。
 * `self-not-landed` 只在前两者出现且本门自身还没入库时替换(见 analyze 里的注)。
 */
function detectOutletsOnFace(face) {
  const selfText = readFace([SELF], face).get(SELF)
  const selfLanded = typeof selfText === 'string'
  const per = OUTLET_REQUIREMENTS.map((req) => ({
    file: req.file,
    status: detectOutlet(readFace([req.file], face).get(req.file), req.exports),
    exports: req.exports,
  }))
  let outlet = 'ok'
  if (per.some((p) => p.status === 'stripped')) outlet = 'stripped'
  else if (per.some((p) => p.status === 'unreadable')) outlet = 'unreadable'
  if (!selfLanded && outlet !== 'ok') outlet = 'self-not-landed'
  return { selfLanded, outlet, per }
}

function listFacePaths(face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

function readFace(paths, face) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/**
 * 全量档的预筛:在**被审面**上用 git grep 取候选(不是工作树!),再逐 blob 复核。
 * 候选为空时不由本函数决定后果 —— 调用方把它换算成"枚举到 0 个候选 ⇒ 判死",绝不记绿。
 */
function prescreenCandidates() {
  // 参数顺序是硬要求:所有 `-e <pattern>` 必须在 rev **之前**,否则 git 把 `-e` 当位置参数
  // (fatal: unable to resolve revision: -e —— 与门 137 记过的 `--cached` 放模式之后同一条坑)。
  const args = ['grep', '-I', '-l', '-z', '-F']
  for (const p of PRESCREEN) args.push('-e', p)
  args.push('HEAD', '--', ...SCAN_ROOTS)
  const out = gitRaw(args, ROOT, { timeout: GIT_TIMEOUT })
  if (!out) return []
  return [...new Set(out.split('\0').map((s) => s.replace(/^HEAD:/, '').trim()).filter(Boolean))]
}

export function analyze(face, opts = {}) {
  const wantAll = opts.all === true
  let enumeration = 'prescreen'
  let candidates
  if (face === 'staged') {
    // 暂存档本来就只有一小撮路径,再预筛反而多一次派生:直接按变更清单收窄(口径与门 135 同形)。
    candidates = listFacePaths('staged')
    enumeration = 'staged-changes'
  } else if (face === 'worktree') {
    candidates = listFacePaths('worktree')
    enumeration = 'full-list'
  } else {
    candidates = prescreenCandidates()
    if (candidates.length === 0) {
      // 0 候选有两种相反含义:仓库真没有,或预筛漂了。两种都必须现读全量清单再判一次,
      // 否则"预筛读空"会被下游读成"仓库干净"。
      candidates = listFacePaths('head')
      enumeration = 'full-list-after-empty-prescreen'
    }
  }
  const files = candidates.filter(inScope)
  const contents = readFace(files, face)

  const red = []
  const unreadable = []
  const exempted = []
  const kinds = {}
  let total = 0
  let undetermined = 0
  for (const f of files) {
    const text = contents.get(f)
    if (typeof text !== 'string') {
      unreadable.push(f)
      continue
    }
    const r = findTextMatching(text)
    total += r.hits.length
    undetermined += r.undetermined
    for (const h of r.hits) kinds[h.kind] = (kinds[h.kind] ?? 0) + 1
    exempted.push(...r.exempted.map((e) => ({ file: f, ...e })))
    if (!r.hits.length) continue
    if (face === 'staged' || face === 'worktree') {
      // 棘轮锚点 = 该文件 HEAD 自身的存量:只拦"这次改动把文本判分支加回来了",不追存量债。
      const headText = readFace([f], 'head').get(f)
      const cap = typeof headText === 'string' ? findTextMatching(headText).hits.length : 0
      if (r.hits.length > cap) red.push({ file: f, n: r.hits.length, cap, sites: r.hits.slice(0, 3) })
    }
  }

  // 测试面:只有 --all 才逐文件读(默认档不读,免得把一次问责跑变成一次全仓扫描)。
  let testSurfaceFiles = -1
  let testSurfaceHits = -1
  if (wantAll) {
    const tFiles = listFacePaths(face).filter(
      (p) => SCAN_EXT.test(p) && SCAN_ROOTS.some((d) => p.startsWith(d)) && isTestSurface(p) && !SELF_EXEMPT.includes(p),
    )
    const tc = readFace(tFiles, face)
    let tn = 0
    for (const p of tFiles) {
      const t = tc.get(p)
      if (typeof t === 'string') tn += findTextMatching(t).hits.length
    }
    testSurfaceFiles = tFiles.length
    testSurfaceHits = tn
  }

  const { selfLanded, outlet, per: outletPer } = detectOutletsOnFace(face)
  const emptyScan = files.length === 0
  let exit = 0
  if (unreadable.length || emptyScan || outlet === 'unreadable') exit = 2
  else if (red.length || outlet === 'stripped') exit = 1
  return {
    face,
    enumeration,
    selfLanded,
    scannedFiles: files.length,
    total,
    kinds,
    undetermined,
    exempted,
    red,
    unreadable,
    emptyScan,
    testSurfaceFiles,
    testSurfaceHits,
    outlet,
    outletPer,
    exit,
  }
}

/* ------------------------------- 自检 ------------------------------- */

const FIXTURES = {
  // 命中:数字状态码当文本判 —— 本票立项时那一条的确切形状(一跳别名 + 字面量)
  statusText: `async function call(err) {
  const e = String(err.message).toLowerCase()
  if (e.includes('429')) return retry()
}`,
  // 命中:措辞当判据(直接挂在 err.message 上)
  wording: `  if (err.message.includes('rate limit') || message.includes('限流')) {
    backoff()
  }`,
  // 命中:正则当判据(实参形态)
  regexArg: `  const transient = errorMsg.search(/\\b5\\d{2}\\b/) >= 0`,
  // 命中:正则当判据(宿主形态,方向相反)
  regexReceiver: `  if (/permission denied/i.test(String(err))) {
    deny()
  }`,
  // 命中:两步式 —— 先归一成小写再判(本仓实际写法,漏它等于对整型失明)
  loweredChain: `  const e = err.message.toLowerCase()
  if (e.includes('timeout')) return retry()`,
  // 命中:三元/赋值形态的文本判分支(判据不要求写在 if 里)
  ternary: `  const kind = err.message ? err.message.indexOf('timeout') : 0`,
  // 放过:注释里的同型(门 131 那型 —— 解释自己不得被自己判红)
  inComment: `  // 旧写法: if (err.message.includes('429')) retry()
  doSomething()`,
  // 放过:块注释里的同型
  blockComment: `  /*
    if (err.message.includes('429')) retry()
  */
  run()`,
  // 放过:对结构化集合的包含判断(参数是变量,不是文本字面量)
  structured: `  if (RETRYABLE_CODES.includes(code)) return retry()`,
  // 放过:已走唯一出口
  outlet: `  const { code } = resolveFailureCode(err, 'tool-retry')
  if (isRetryableFailureCode(code)) return retry()`,
  // 放过:数据驱动的关键词表(本票给兜底出口选定的形态 —— 字面量在数据里,不在分支条件里)
  dataTable: `  const TABLE = [{ needle: '429', code: 'rate_limited' }]
  for (const r of TABLE) if (haystack.includes(r.needle)) return r.code`,
  // 放过:带原因的行内豁免
  exempted: `  if (err.message.includes('already exists')) return ignore() // error-code-exempt: 上游驱动未提供错误码,只能匹配其文本(已登记工单 ABC-1)`,
  // 不放过:族名写错的标记不算豁免(免得"像豁免"就当放行)
  bareMarker: `  if (err.message.includes('already exists')) return ignore() // error-error-exempt: 有原因也不行`,
  // 不放过:裸标记没原因
  bareMarkerNoReason: `  if (err.message.includes('already exists')) return ignore() // error-code-exempt:`,
  // 别名只走一跳:两跳之外判不出来也不瞎判(登记为已知边界,由 undetermined/报数承担)
  twoHopAlias: `  const a = err.message.toLowerCase()
  const b = a
  if (b.includes('429')) return retry()`,
}

function runSelfTest() {
  let okAll = true
  const ok = (name, pass) => {
    console.log(`${pass ? '✅' : '❌'} ${name}`)
    if (!pass) okAll = false
  }
  const n = (k) => findTextMatching(FIXTURES[k]).hits.length
  ok(`T1 命中:一跳别名 + includes('429')(本票立项那条原文的形状)`, n('statusText') === 1)
  ok('T1 命中:措辞当判据(rate limit / 限流)', n('wording') === 1)
  ok('T1 命中:正则当判据(search(/…/))', n('regexArg') === 1)
  ok('T1 命中:/re/.test(String(err)) 方向相反的同型也要判', n('regexReceiver') === 1)
  ok('T1 命中:先 toLowerCase 再判(不认这一跳,门就对自己立项那一型全盲)', n('loweredChain') === 1)
  ok('T1 命中:三元/赋值形态不要求 if 上下文', n('ternary') >= 1)
  ok('T1 放过:对结构化集合的包含判断不算(参数不是文本字面量)', n('structured') === 0)
  ok('T1 放过:已走唯一出口的不算', n('outlet') === 0)
  ok('T1 放过:数据驱动的关键词表不算(这是兜底出口选定的合法形态)', n('dataTable') === 0)
  ok('已知边界如实登记:别名只走一跳,两跳不瞎判', n('twoHopAlias') === 0)
  ok('反向锁 A:注释里的该形态不得计入(门 131 刚被这一型咬过)', n('inComment') === 0 && n('blockComment') === 0)
  ok('反向锁 B:判据面必须保留字符串(整条遮字符串会让本门对该型全盲而照报绿)', (() => {
    const line = "  if (err.message.includes('429')) retry()"
    return classifyLine(line) === 'status-as-text' && classifyLine(maskComments(line)) === 'status-as-text'
  })())
  ok('豁免:带原因才放行,且计入 exempted 只报数', (() => {
    const r = findTextMatching(FIXTURES.exempted)
    return r.hits.length === 0 && r.exempted.length === 1
  })())
  ok('裸标记 / 族名写错的标记都不得放行', n('bareMarker') === 1 && n('bareMarkerNoReason') === 1)
  ok('判据分型齐备:状态码/字面量/正则实参/正则宿主 各有命中', (() => {
    const found = new Set()
    for (const k of Object.keys(FIXTURES)) for (const h of findTextMatching(FIXTURES[k]).hits) found.add(h.kind)
    return (
      found.has('status-as-text') &&
      found.has('literal-in-text-op') &&
      found.has('regex-in-text-op') &&
      found.has('regex-receiver-on-text')
    )
  })())
  ok('预筛与判据同源:每个判据正则都展开全部 TEXT_OPS(少一个算子=对该算子整型失明)', (() => {
    if (PRESCREEN.length !== TEXT_OPS.length) return false
    if (!TEXT_OPS.every((op, i) => PRESCREEN[i] === `.${op}(`)) return false
    const re = buildSubjectRegex(new Set())
    const wide = ['status', 'literal', 'regexArg'].every((key) => TEXT_OPS.every((op) => re[key].source.includes(`(?:${TEXT_OP_CLASS})`) || re[key].source.includes(op)))
    // 宿主形态(/re/.test(x))只认三个"能接正则当判据"的算子 —— 那张子集必须仍是 TEXT_OPS 的子集,
    // 否则它就是第二份算子清单(本条断言的存在理由:让"清单漂了"变成一条红,而不是一格静默)。
    const receiverSubsetOk = RECEIVER_OPS.every((op) => TEXT_OPS.includes(op))
    return wide && receiverSubsetOk
  })())
  ok('出口三态:ok / stripped / unreadable 各自可判(三态不得并桶)', (() => {
    // 夹具由 OUTLET_REQUIREMENTS **现算**,不手写名字:手写那份会在下一次改需求表时
    // 变成"断言与需求对不上"的恒红(或更糟:恒绿)。
    const goodFor = (req) =>
      req.exports.map((name) => `export function ${name}(){}`).join('\n') + '\nexport { X } from "./y.js"'
    const badFor = (req) => req.exports.map((name) => `function ${name}(){}`).join('\n')
    const goods = OUTLET_REQUIREMENTS.map((req) => detectOutlet(goodFor(req), req.exports))
    const bads = OUTLET_REQUIREMENTS.map((req) => detectOutlet(badFor(req), req.exports))
    return goods.every((s) => s === 'ok') && bads.every((s) => s === 'stripped') && detectOutlet(undefined) === 'unreadable'
  })())
  ok('出口需求表里每条 file/exports 都非空,且主出口就是需求表第一行(防止需求表漂成空表)', (() => {
    if (OUTLET_REQUIREMENTS.length < 2) return false
    if (!OUTLET_REQUIREMENTS.every((r) => typeof r.file === 'string' && r.file && r.exports.length > 0)) return false
    return OUTLET_FILE === OUTLET_REQUIREMENTS[0].file && OUTLET_REQUIRED_EXPORTS === OUTLET_REQUIREMENTS[0].exports
  })())
  ok('遮噪只用那一份实现:必须从 code-mask 引 maskComments,且本文件里没有第二个遮噪函数', (() => {
    const src = readWorktreeFile(ROOT, SELF) ?? ''
    // 判"有没有第二份遮噪"用**带转义的 regex**(它的字面写法不会匹配到自己),
    // 判"有没有引共享层"用模块说明符的 regex 形态同理 —— 用裸字符串写这两条断言,
    // 断言自身就会成为被检出的那一处(本票写这一格时正撞上,现已按行为证明改法)。
    const importsSharedMasker = /import\s*\{[^}]*\bmaskComments\b[^}]*\}\s*from\s*['"]\.[^'"]*code-mask\.mjs['"]/.test(src)
    const hasLocalMasker = /function\s+(?:mask|strip|blank)(?:Comments|Strings|Spans)\s*\(/.test(src)
    return importsSharedMasker && !hasLocalMasker
  })())
  ok('取材只能走 face-reader,不得散写 git show / 按磁盘读被审内容 / 用当前目录定根', (() => {
    const src = readWorktreeFile(ROOT, SELF) ?? ''
    // 被禁形态一律用**带转义的 regex** 表达:把那种写法原样写进断言的字符串里,断言自己就会
    // 成为被检出的那一处(本票写这一格时正撞上 —— 说明性文字也会带执行性字符)。
    return (
      src.includes('catBatch') &&
      src.includes('selectFace') &&
      !/\bgitRaw\(\s*\[?\s*'show'/.test(src) &&
      !/readFileSync\(\s*join\(\s*ROOT/.test(src) &&
      !/process\s*\.\s*cwd\s*\(/.test(src)
    )
  })())
  ok('空输入/非字符串判 unreadable,不当"零违规"', findTextMatching(undefined).unreadable === true && findTextMatching(null).unreadable === true)
  ok('跨行拼接的判据落"判不出"计数而不是消失(单行判据的已知盲区必须报名)', (() => {
    const two = "  if (err.message.includes(\n    '429')) retry()"
    const r = findTextMatching(two)
    return r.hits.length === 0 && r.undetermined >= 1
  })())
  const head = analyze('head')
  ok(`真仓 HEAD 阳性对照:必须看得见存量(实得 ${head.total} 处,枚举档 ${head.enumeration},自落格 ${head.selfLanded})`, head.total > 0)
  // 这一格原本写的是 `head.exit !== 1`,那是把**两维**混成了一维:head 面结构上不可能因存量判红
  // (棘轮只在 staged/worktree 档往 red 里 push),所以它真正在判的其实是"出口在不在位"。等 HEAD 里
  // 还没有失败码出口时,这条就顶着"存量"的名义红 —— 措辞与病因不一致,而下一个人会照措辞去放宽出口表。
  ok('HEAD 全量档的存量维不得判红(棘轮锚点是该文件 HEAD 自身;当场判红就是恒红门 ⇒ 逼人跳门)', head.red.length === 0)
  ok(
    '出口不在位 ⇒ 本门不得在提交链上;出口已入库 ⇒ 本门必须已接线(两个方向各拦一型,都不靠人记得)',
    wiringConsistent(head.outlet, readFace(['scripts/guardian-runner.mjs'], 'head').get('scripts/guardian-runner.mjs')),
  )
  ok('门未入库时出口那一格报 self-not-landed,不冒充 ok 也不冒充 stripped', (() => {
    const r = analyze('head')
    if (r.selfLanded) return r.outlet === 'ok' || r.outlet === 'stripped' || r.outlet === 'unreadable'
    return r.outlet === 'self-not-landed'
  })())
  ok('测试面/夹具不进红条件,而生产面仍进(否则迁移者被自己的测试拦住,或门看不见案发现场)', !inScope('apps/cli/tests/x.test.ts') && !inScope('apps/api/src/routes/__tests__/y.ts') && !inScope('apps/web/e2e/z.ts') && inScope('apps/api/src/routes/a.ts'))
  console.log(okAll ? '--self-test: 全部通过' : '--self-test: 有失败')
  process.exitCode = okAll ? 0 : 1
}

/* ------------------------------- CLI ------------------------------- */

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exitCode = 2
    return
  }
  const r = analyze(picked.face, { all: argv.includes('--all') })
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.exit
    return
  }
  const kindText = Object.entries(r.kinds)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')
  console.log(
    `[error-code-not-text-matching] 面:${r.face}(${r.enumeration}) · 扫描 ${r.scannedFiles} 文件 · 文本判分支 ${r.total} 处${kindText ? ` (${kindText})` : ''} · 判不出 ${r.undetermined} 处`,
  )
  if (r.testSurfaceHits >= 0)
    console.log(`   测试面同型 ${r.testSurfaceHits} 处 / ${r.testSurfaceFiles} 文件(不判红 —— 但"把缺陷当契约"就写在这一面)`)
  else console.log('   测试面:本轮未量(加 --all 才逐文件读)')
  if (r.outlet === 'self-not-landed')
    console.log(`⚠️ 出口在位性本轮未判:本门自己还不在这张面上(${SELF})。落地那一枚提交之后这一格自动变成判定。`)
  else if (r.outlet === 'stripped') {
    for (const p of r.outletPer.filter((x) => x.status === 'stripped'))
      console.log(`❌ 出口被摘线:${p.file} 没有把 ${p.exports.join(' / ')} 递出去 —— 判据没有出路,先补出口`)
  } else if (r.outlet === 'unreadable') {
    for (const p of r.outletPer.filter((x) => x.status === 'unreadable'))
      console.log(`❌ 出口取不到:${p.file} 在本面读不到 —— 判"无法判定",不记绿`)
  }
  if (r.exempted.length) console.log(`⚠️ 带 error-code-exempt 豁免 ${r.exempted.length} 处(只报数,到期由守门 108 追)`)
  if (r.unreadable.length) console.log(`❌ 无法判定:${r.unreadable.length} 个候选在本面取不到内容,首个:${r.unreadable[0]}`)
  if (r.emptyScan) console.log('❌ 本面枚举到 0 个候选文件 —— 判"无法判定",绝不记绿')
  if (r.red.length) {
    console.log(`❌ 新增(超出该文件 HEAD 自身存量)${r.red.length} 个文件:`)
    for (const x of r.red.slice(0, 12))
      console.log(`   - ${x.file}: ${x.n} 处(HEAD 存量 ${x.cap})  例 L${x.sites[0]?.line}:${x.sites[0]?.text ?? ''}`)
    console.log('   出口:让抛出方给码(new ToolError(code, message)),消费侧 resolveFailureCode(err, site) 读码')
  } else if (r.exit === 0) {
    console.log(`✅ 无新增。存量 ${r.total} 处按"该文件 HEAD 自身存量"棘轮只报数(清偿进度看这一行,勿引用文档旧数)`)
  }
  console.log('提示:射程 = apps/ 与 packages/ 的 .ts/.tsx/.js/.jsx;测试面只报数;应急跳过 HUSKY_SKIP_ERROR_CODE_TEXT_MATCHING=1')
  process.exitCode = r.exit
}

export const __test__ = {
  findTextMatching,
  classifyLine,
  detectOutlet,
  wiringConsistent,
  analyze,
  inScope,
  isTestSurface,
  countMultilineCandidates,
  prescreenCandidates,
  collectAliases,
  FIXTURES,
  PRESCREEN,
  TEXT_OPS,
  OUTLET_FILE,
  OUTLET_REQUIRED_EXPORTS,
  EXEMPT,
  SELF,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
