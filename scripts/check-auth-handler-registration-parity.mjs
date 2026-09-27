// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 会话失效统一出口注册对账(AP1/AP2/AP3)。
//
// 立因(真机实测,不是假想):2026-09-27 深夜 RN 在 access+refresh 双过期后,每一屏各自
// 显示一句从错误体取来的通用文案,**没有任何"去登录"的出路**;而共享层早有注册口
// `setUnauthorizedHandler`(packages/api-client/src/client.ts)与触发点 `notifyUnauthorized`。
// 全仓 grep 一度显示它的唯一调用点是 apps/web/src/lib/api.ts —— 即"机制在位、只有一端接线"。
// 本门守的是**不要再回到"只有 web 有"**:凡消费 @ihui/api-client 的 fetchApi 的端,必须在
// 某个非测试代码面注册 setUnauthorizedHandler(或进豁免台账带 reason + 未过期 reviewBy)。
//
// 三条判据:
//   AP1 消费端未注册且无有效豁免 ⇒ 红。豁免只认台账里带 reason + 未过期 reviewBy 的条目;
//       **库不是端** —— packages/* 的 fetchApi 消费不计(注册属宿主职责)。
//   AP2 反向锁(防清单腐烂):台账端其实已注册 ⇒ 红("豁免已不需要,请删条目");
//       台账指向不存在端 ⇒ 红;同一端重复登记 ⇒ 红。
//   AP3 注册口摘线:被审面上 setUnauthorizedHandler 的 export 不在,或 notifyUnauthorized
//       无任何真实调用点 ⇒ 判"失明",**不记为通过**(与守门 70/76/81/115 同型)。
//   枚举到 0 个消费端 ⇒ exit 2 判"无法判定",绝不记绿。
//
// 口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
// `--worktree` 仅人工逃生舱、两面旗同给 exit 2、取不到 exit 2 **不回落**;清单与内容同面同轮,
// 内容一律经 scripts/lib/face-reader.mjs 的读取入口 `catBatch`(只 import 不用它读会被守门 118
// 判"半接线")。判据面**先剥注释与字符串**,遮罩只有一份实现:`scripts/lib/code-mask.mjs`
// (import,不得留本地副本 —— 镜像测试有这条反向锁)。
//
// 已知限制(如实登记,不等于"没有"):
//   1. 消费判据是"同一文件内 fetchApi 标识符出现在代码面 ∧ 存在 from '@ihui/api-client' 的
//      字符串说明符"两条件同文件配对;某文件 import 了包内其他符号、又恰有**同名局部变量**
//      fetchApi 会被算成消费端(假阳方向 = 多要求注册,不会漏)。经本地 wrapper 再导入
//      fetchApi 的文件**不算**直接消费端(判据按包说明符)—— 端级判定只要有任一直连文件即成立。
//   2. require() 形态(CJS)不在射程(本仓 apps 全 ESM)。
//   3. 台账缺席(该面没有 ledger 文件)按"零豁免"判并**大声报出**,不当解析失败;坏 JSON 才判
//      "无法判定"(exit 2)—— 静默把坏清单当空清单是本仓记过多次的失败型。
//
// 用法:node scripts/check-auth-handler-registration-parity.mjs [--staged|--worktree|--json|--self-test|--today YYYY-MM-DD]
// 已接提交链:调用方 scripts/guardian-runner.mjs(编号以 runner 现值为准,勿照抄文档)
// 紧急跳过:HUSKY_SKIP_AUTH_HANDLER_PARITY=1

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace, Undetermined } from './lib/face-reader.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000

/** 豁免台账(唯一豁免通道;刻意不用行内标记族,故守门 108 的存活期表与本门无关)。 */
export const LEDGER_FILE = 'scripts/auth-handler-registration-exemptions.json'
/** 注册口所在包 —— AP3 的取材根。 */
const OUTLET_ROOT = 'packages/api-client/'
/** 预筛模式串必须是判据字面量的**严格超集**(守门 102/97 同一条锁)。 */
const APP_GREP_PATTERN = 'fetchApi|setUnauthorizedHandler|@ihui/api-client'
const OUTLET_GREP_PATTERN = 'setUnauthorizedHandler|notifyUnauthorized'

const SRC_EXT = /\.(ts|tsx|js|jsx|mts|cts)$/
const TEST_NOISE = /(^|\/)(tests?|__tests__|e2e|__mocks__)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/

const CONSUME_TOKEN_RE = /\bfetchApi\b/
/**
 * code-mask 会把**引号字符与字符串内容一起**抹成空格(等长遮罩),所以说明符不能从 masked 面读,
 * 更不能让 masked 面的正则吞掉空白后直接定位(空格串无法与"真空白"区分)。正解是双面对齐:
 * masked 面只锚定代码里的 `from` 关键字(注释/字符串里的 from 已被抹掉,不可能命中),
 * 再在 **raw 面**从同一偏移跳过空白取那条字符串 —— "注释里的示例 import"不会算消费端,
 * "代码里的 import"一定算。
 */
const FROM_KW_RE = /\bfrom\b/g
const SPEC_START = /^@ihui\/api-client(\/|$)/

/** 从偏移处解一条引号字符串(import 说明符必是单行引号串;解不出返回 null)。 */
function readQuotedAt(raw, at) {
  const q = raw[at]
  if (q !== '"' && q !== "'") return null
  let j = at + 1
  let str = ''
  while (j < raw.length) {
    const c = raw[j]
    if (c === '\\') {
      str += raw.slice(j, j + 2)
      j += 2
      continue
    }
    if (c === q) break
    if (c === '\n') return null // 未闭合 —— 不是 import 说明符
    str += c
    j++
  }
  return str
}

export function hasPackageSpecifier(raw, masked) {
  for (const m of masked.matchAll(FROM_KW_RE)) {
    let p = m.index + m[0].length
    while (p < raw.length && /\s/.test(raw[p])) p++
    const spec = readQuotedAt(raw, p)
    if (spec !== null && SPEC_START.test(spec)) return true
  }
  return false
}
const REGISTER_RE = /\bsetUnauthorizedHandler\s*\(/
/** 台账条目:app + 带原因 + 未过期 ISO 日期。 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * 单文件分类(纯函数,构造面即可成对证明)。
 * @returns {{consumes:boolean, registers:boolean}}
 */
export function classifyFile(raw) {
  if (typeof raw !== 'string') return { consumes: false, registers: false, unreadable: true }
  const masked = maskCommentsAndStrings(raw)
  const registers = REGISTER_RE.test(masked)
  if (!CONSUME_TOKEN_RE.test(masked)) return { consumes: false, registers, unreadable: false }
  if (hasPackageSpecifier(raw, masked)) return { consumes: true, registers, unreadable: false }
  return { consumes: false, registers, unreadable: false }
}

/**
 * AP3 机制判定的纯函数面:输入 packages/api-client 侧候选文件正文,输出机制是否完整。
 *  - exported:setUnauthorizedHandler 真的被 export(函数声明或导出条款,含多行)。
 *  - notifyCalled:notifyUnauthorized( 至少出现在一处**调用位**(排除 function/const 声明位)。
 * 任一缺失 = 注册口被摘线 = 判"失明",不得记绿。
 */
export function detectMechanismTexts(texts) {
  let exported = false
  let notifyCalled = false
  for (const text of texts) {
    if (typeof text !== 'string') continue
    const masked = maskCommentsAndStrings(text)
    if (
      /export\s+function\s+setUnauthorizedHandler\b/.test(masked) ||
      /export\s*\{[^}]*\bsetUnauthorizedHandler\b[^}]*\}/s.test(masked)
    )
      exported = true
    for (const m of masked.matchAll(/\bnotifyUnauthorized\s*\(/g)) {
      const before = masked.slice(Math.max(0, m.index - 24), m.index)
      if (/\b(?:function|const|let|var)\s+$/.test(before)) continue
      if (/\bexport\s*$/.test(before)) continue
      notifyCalled = true
      break
    }
  }
  return { exported, notifyCalled }
}

/** 台账正文解析(纯函数):坏 JSON ⇒ problems.unparseable(判"无法判定");缺文件由调用方分流。 */
export function parseLedger(text) {
  if (typeof text !== 'string') return { absent: true, entries: [], problems: [] }
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { absent: false, entries: [], problems: ['unparseable'], raw: text }
  }
  const entries = Array.isArray(data?.exemptions) ? data.exemptions : []
  const problems = Array.isArray(data?.exemptions) ? [] : ['exemptions 字段缺失或非数组']
  return { absent: false, entries, problems }
}

/** 豁免是否有效:app 匹配 + 带原因 + reviewBy 是未过期的 ISO 日期(到期日当天仍有效)。 */
export function exemptionIsValid(entry, end, today) {
  if (!entry || entry.app !== end) return false
  if (typeof entry.reason !== 'string' || entry.reason.trim() === '') return false
  if (typeof entry.reviewBy !== 'string' || !ISO_DATE.test(entry.reviewBy)) return false
  return entry.reviewBy >= today
}

/** 一条豁免失效的具体原因(点名进报告,免得"豁免"与"没查到豁免"长得一样)。 */
export function exemptionProblem(entry, today) {
  if (!entry) return '无台账条目'
  if (typeof entry.reason !== 'string' || entry.reason.trim() === '') return '缺 reason'
  if (typeof entry.reviewBy !== 'string' || !ISO_DATE.test(entry.reviewBy)) return 'reviewBy 缺失或非 ISO 日期'
  if (entry.reviewBy < today) return `已过期(reviewBy=${entry.reviewBy} < ${today})`
  return null
}

/**
 * 三条判据的决策核(纯函数,构造面成对证明;真实取材由 analyze 喂给它)。
 * @param ends [{end, consumers, registered}] —— apps/* 里的消费端集合
 * @param presentApps Set<string> —— 被审面上真实存在的 apps/<x> 前缀(含非消费端)
 * @param ledgerEntries 台账条目数组
 * @param ledgerAbsent 台账在该面缺席(大声报数,按零豁免判)
 * @param mechanism {exported, notifyCalled} | null
 * @param scanEmpty 枚举为空(0 候选文件/0 消费端)
 */
export function decideParity({ ends, presentApps, ledgerEntries, ledgerAbsent, mechanism, scanEmpty, today }) {
  const ap1 = []
  const ap2 = []
  const undetermined = []
  if (ledgerAbsent) undetermined.push('台账文件不在被审面(按零豁免判,已大声报出)')
  for (const p of ledgerEntries.__problems ?? []) undetermined.push(`台账异常:${p}`)

  // AP2:台账自身健康度(先于 AP1 判,腐烂清单比漏注册更早暴露)
  const seenApps = new Set()
  for (const e of ledgerEntries) {
    const app = typeof e?.app === 'string' ? e.app : ''
    if (!app) {
      ap2.push({ app: '(缺 app 字段)', why: '条目无法定位端 —— 补 app 或删除条目' })
      continue
    }
    if (seenApps.has(app)) ap2.push({ app, why: '同一端重复登记(一条豁免只许一行)' })
    seenApps.add(app)
    if (!presentApps.has(app)) {
      ap2.push({ app, why: '台账指向不存在的端(该面 apps/ 下没有任何文件)' })
      continue
    }
    const end = ends.find((x) => x.end === app)
    if (end && end.registered)
      ap2.push({ app, why: '该端已注册 setUnauthorizedHandler —— 豁免已不需要,请删条目' })
  }

  // AP1:消费端必须有注册或有效豁免
  for (const end of ends) {
    if (end.registered) continue
    const entry = ledgerEntries.find((e) => e?.app === end.end)
    if (exemptionIsValid(entry, end.end, today)) continue
    ap1.push({ ...end, why: exemptionProblem(entry, today), ledgerAbsent })
  }

  // AP3:机制摘线 = 失明(判红,不记绿)
  let blind = null
  if (mechanism && (!mechanism.exported || !mechanism.notifyCalled))
    blind = {
      exported: mechanism.exported,
      notifyCalled: mechanism.notifyCalled,
      why: !mechanism.exported
        ? `${OUTLET_ROOT} 被审面上没有 setUnauthorizedHandler 的 export —— 注册口被摘线`
        : `${OUTLET_ROOT} 被审面上 notifyUnauthorized 没有任何调用点 —— 注册了也不会有人触发`,
    }

  if (scanEmpty) return { exit: 2, ap1, ap2, blind, undetermined: [...undetermined, '枚举到 0 个消费端 —— 无法判定,绝不记绿'] }
  if (undetermined.some((u) => u.startsWith('台账异常'))) return { exit: 2, ap1, ap2, blind, undetermined }
  const red = ap1.length > 0 || ap2.length > 0 || blind !== null
  return { exit: red ? 1 : 0, ap1, ap2, blind, undetermined }
}

/* ------------------------------ 取材(同面同轮) ------------------------------ */

function facePrefix(face) {
  return face === 'head' ? 'HEAD:' : ''
}

/** 清单:head=ls-tree HEAD、staged=索引(ls-files)、worktree=跟踪清单(内容看盘)。 */
function listTracked(face, subdir) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z', '--', subdir], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z', '--', subdir], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

/** git grep 预筛(模式串为判据字面量超集);无命中 = git 正常结论 status 1,返回空集。 */
function grepCandidates(face, pattern, subdir) {
  const args =
    face === 'head'
      ? ['grep', '-l', '-z', '-E', pattern, 'HEAD', '--', subdir]
      : face === 'staged'
        ? ['grep', '--cached', '-l', '-z', '-E', pattern, '--', subdir]
        : ['grep', '-l', '-z', '-E', pattern, '--', subdir]
  try {
    return String(gitRaw(args, ROOT, { timeout: GIT_TIMEOUT }))
      .split('\0')
      .filter(Boolean)
      .map((p) => (face === 'head' ? p.replace(/^HEAD:/, '') : p))
  } catch (e) {
    if (e instanceof Undetermined && e.status === 1) return []
    throw e
  }
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

function inScopeAppFile(p) {
  return p.startsWith('apps/') && SRC_EXT.test(p) && !TEST_NOISE.test(p)
}

export function analyze(face, today) {
  const appPaths = listTracked(face, 'apps')
  const presentApps = new Set()
  for (const p of appPaths) {
    const seg = p.split('/')
    if (seg[0] === 'apps' && seg[1]) presentApps.add(`apps/${seg[1]}`)
  }
  const candidates = grepCandidates(face, APP_GREP_PATTERN, 'apps').filter(inScopeAppFile)
  const contents = readFace(candidates, face)
  const unreadable = []
  const perEnd = new Map()
  for (const p of candidates) {
    const text = contents.get(p)
    if (typeof text !== 'string') {
      unreadable.push(p)
      continue
    }
    const end = `apps/${p.split('/')[1]}`
    const { consumes, registers } = classifyFile(text)
    const cur = perEnd.get(end) ?? { end, consumers: 0, registered: false, sample: null }
    if (consumes) cur.consumers += 1
    if (registers) cur.registered = true
    if (consumes && !cur.sample) cur.sample = p
    perEnd.set(end, cur)
  }
  const ends = [...perEnd.values()].filter((e) => e.consumers > 0)

  // AP3 取材:同一面、同一轮读 packages/api-client 的机制候选。
  const outletCandidates = grepCandidates(face, OUTLET_GREP_PATTERN, OUTLET_ROOT).filter(
    (p) => SRC_EXT.test(p) && !TEST_NOISE.test(p),
  )
  const outletContents = readFace(outletCandidates, face)
  const outletUnreadable = outletCandidates.filter((p) => typeof outletContents.get(p) !== 'string')
  const mechanism =
    outletUnreadable.length > 0
      ? null
      : detectMechanismTexts(outletCandidates.map((p) => outletContents.get(p)))
  if (outletUnreadable.length) unreadable.push(...outletUnreadable)

  // 台账从同一面取。
  const ledgerText = readFace([LEDGER_FILE], face).get(LEDGER_FILE)
  const ledger = parseLedger(ledgerText)

  const verdict = decideParity({
    ends,
    presentApps,
    ledgerEntries: Object.assign(ledger.entries, { __problems: ledger.absent ? [] : ledger.problems }),
    ledgerAbsent: ledger.absent,
    mechanism,
    scanEmpty: candidates.length === 0 || ends.length === 0,
    today,
  })
  return {
    face,
    scannedCandidates: candidates.length,
    ends: ends.sort((a, b) => (a.end < b.end ? -1 : 1)),
    ledgerAbsent: ledger.absent,
    ledgerEntries: ledger.entries,
    unreadable,
    mechanism,
    // 取不到 = "无法判定"优先于判红(口径同 79/100:git 问不到 ⇒ exit 2 先于 1)
    exit: unreadable.length > 0 ? 2 : verdict.exit,
    undetermined: unreadable.length
      ? [...verdict.undetermined, `${unreadable.length} 个候选在本面取不到内容,首个:${unreadable[0]}`]
      : verdict.undetermined,
    ap1: verdict.ap1,
    ap2: verdict.ap2,
    blind: verdict.blind,
  }
}

/* --------------------------------- 自检 --------------------------------- */

const FX = {
  consumer: `import { fetchApi } from '@ihui/api-client'
export async function load() { return fetchApi('/api/x') }`,
  wrapperOnly: `import { fetchApi } from '@/lib/api'
export async function load() { return fetchApi('/api/x') }`,
  otherSymbol: `import { streamChat } from '@ihui/api-client'
export async function run() { return streamChat() }`,
  commentImport: `// 旧写法 import { fetchApi } from '@ihui/api-client'
export const fetchApiUsage = 1`,
  register: `import { setUnauthorizedHandler } from '@ihui/api-client'
setUnauthorizedHandler((ctx) => gotoLogin(ctx.method))`,
  registerOnlyInComment: `// 接线动作:setUnauthorizedHandler(handler)
export const noop = 1`,
  registerInString: `export const doc = 'setUnauthorizedHandler(...)'`,
  exportClause: `export {
  fetchApi,
  setUnauthorizedHandler,
} from '@ihui/api-client'`,
  mechanismFull: `export function setUnauthorizedHandler(h) { handler = h }
function notifyUnauthorized(url, m) { handler?.({url, method: m}) }
async function call() { notifyUnauthorized('/x', 'GET') }`,
  mechanismNoCall: `export function setUnauthorizedHandler(h) {}
function notifyUnauthorized(url) {}`,
  mechanismNoExport: `function setUnauthorizedHandler(h) {}
function notifyUnauthorized(url) {}
notifyUnauthorized('/x')`,
}

function runSelfTest() {
  let okAll = true
  const ok = (name, pass) => {
    console.log(`${pass ? '✅' : '❌'} ${name}`)
    if (!pass) okAll = false
  }
  const today = '2026-10-01'

  ok('AP1 命中:直接 import fetchApi 的文件算消费端', classifyFile(FX.consumer).consumes === true)
  ok('AP1 放过:只从本地 wrapper 取 fetchApi 不算包内直连消费', classifyFile(FX.wrapperOnly).consumes === false)
  ok('AP1 放过:import 了包但没碰 fetchApi 的文件不算', classifyFile(FX.otherSymbol).consumes === false)
  ok(
    'AP1 放过:import 只活在注释里(代码面只剩裸标识符,无包说明符)',
    classifyFile(FX.commentImport).consumes === false,
  )
  ok('AP1 命中:export 条款从包转发 fetchApi 也算', classifyFile(FX.exportClause).consumes === true)
  ok('接线:真调用 setUnauthorizedHandler( 才算', classifyFile(FX.register).registers === true)
  ok('接线:注释里的 setUnauthorizedHandler(handler) 不算(否则门给自己发合格证)', classifyFile(FX.registerOnlyInComment).registers === false)
  ok('接线:字符串字面量里的该形态不算', classifyFile(FX.registerInString).registers === false)
  ok('接线:裸 import 名字(无调用括号)不算', classifyFile(FX.exportClause).registers === false)

  const mFull = detectMechanismTexts([FX.mechanismFull])
  ok('AP3 完整:export 在位且 notifyUnauthorized 有调用位', mFull.exported === true && mFull.notifyCalled === true)
  const mNoCall = detectMechanismTexts([FX.mechanismNoCall])
  ok('AP3 摘线:notifyUnauthorized 只有定义没有调用 ⇒ 失明', mNoCall.exported === true && mNoCall.notifyCalled === false)
  const mNoExport = detectMechanismTexts([FX.mechanismNoExport])
  ok('AP3 摘线:export 不在 ⇒ 失明(定义还在也不行)', mNoExport.exported === false)

  const mk = (entries, opts = {}) =>
    decideParity({
      ends: entries,
      presentApps: new Set([...entries.map((e) => e.end), ...(opts.presentApps ?? [])]),
      ledgerEntries: Object.assign(opts.ledger ?? [], { __problems: [] }),
      ledgerAbsent: !!opts.ledgerAbsent,
      mechanism: opts.mechanism ?? { exported: true, notifyCalled: true },
      scanEmpty: !!opts.scanEmpty,
      today,
    })
  const unreg = { end: 'apps/x', consumers: 3, registered: false }
  const reged = { end: 'apps/web', consumers: 9, registered: true }

  ok('决策 AP1 红:未注册且无豁免的消费端判红', mk([unreg]).exit === 1 && mk([unreg]).ap1.length === 1)
  ok('决策 AP1 绿:已注册的消费端不判红', mk([reged]).exit === 0)
  ok(
    '决策 豁免有效:带 reason + 未过期 reviewBy ⇒ 绿',
    mk([unreg], { ledger: [{ app: 'apps/x', reason: '终端提示出口', reviewBy: '2099-01-01' }] }).exit === 0,
  )
  ok(
    '决策 豁免过期 ⇒ AP1 仍红并点名过期',
    (() => {
      const r = mk([unreg], { ledger: [{ app: 'apps/x', reason: 'r', reviewBy: '2020-01-01' }] })
      return r.exit === 1 && r.ap1[0].why.includes('已过期')
    })(),
  )
  ok(
    '决策 豁免缺 reason ⇒ AP1 仍红(裸豁免不救)',
    (() => {
      const r = mk([unreg], { ledger: [{ app: 'apps/x', reviewBy: '2099-01-01' }] })
      return r.exit === 1 && r.ap1[0].why.includes('缺 reason')
    })(),
  )
  ok(
    '决策 AP2 腐烂:台账端其实已注册 ⇒ 红',
    (() => {
      const r = mk([reged], { ledger: [{ app: 'apps/web', reason: 'r', reviewBy: '2099-01-01' }] })
      return r.exit === 1 && r.ap2.some((x) => x.why.includes('请删条目'))
    })(),
  )
  ok(
    '决策 AP2 幽灵:台账指向不存在端 ⇒ 红',
    (() => {
      const r = mk([reged], { ledger: [{ app: 'apps/ghost', reason: 'r', reviewBy: '2099-01-01' }] })
      return r.exit === 1 && r.ap2.some((x) => x.why.includes('不存在'))
    })(),
  )
  ok(
    '决策 AP2 重复:同端两行 ⇒ 红',
    mk([reged, { ...reged, end: 'apps/web' }], {
      ledger: [
        { app: 'apps/web', reason: 'r', reviewBy: '2099-01-01' },
        { app: 'apps/web', reason: 'r', reviewBy: '2099-01-01' },
      ],
    }).ap2.some((x) => x.why.includes('重复登记')),
  )
  ok(
    '决策 AP3:机制摘线 ⇒ exit 1 且 blind 点名(不记绿)',
    mk([reged], { mechanism: { exported: false, notifyCalled: true } }).exit === 1,
  )
  ok('决策 空枚举 ⇒ exit 2(判"无法判定",绝不记绿)', mk([], { scanEmpty: true }).exit === 2)
  ok(
    '决策 台账缺席:未注册端照红,并带 ledgerAbsent 大声报出',
    (() => {
      const r = mk([unreg], { ledgerAbsent: true })
      return r.exit === 1 && r.ap1[0].ledgerAbsent === true && r.undetermined.length === 1
    })(),
  )
  ok(
    '台账坏 JSON ⇒ 无法判定(exit 2),不静默当空清单',
    decideParity({
      ends: [reged],
      presentApps: new Set(['apps/web']),
      ledgerEntries: Object.assign([], { __problems: ['unparseable'] }),
      ledgerAbsent: false,
      mechanism: { exported: true, notifyCalled: true },
      scanEmpty: false,
      today,
    }).exit === 2,
  )
  ok('parseLedger:缺文件 ⇒ absent(不判异常)', parseLedger(null).absent === true)
  ok('parseLedger:坏 JSON ⇒ problems.unparseable', parseLedger('{oops').problems[0] === 'unparseable')
  ok(
    'packages/* 不参与端判定:消费判据文件清单只收 apps/(inScope 反向锁)',
    inScopeAppFile('apps/web/src/a.ts') === true && inScopeAppFile('packages/shared/src/a.ts') === false,
  )
  ok('两面旗同给 ⇒ selectFace 判死', selectFace({ staged: true, worktree: true, def: 'head' }).error !== null)

  // 真仓阳性对照(取材走真面):判据必须看得见本仓实际产出的形态。
  const head = analyze('head', today)
  const web = head.ends.find((e) => e.end === 'apps/web')
  ok(`真仓 HEAD 阳性对照:apps/web 是消费端且已注册(实得:${web ? `consumers=${web.consumers} registered=${web.registered}` : '未见'})`, !!web && web.consumers > 0 && web.registered === true)
  ok(
    `真仓 HEAD 阳性对照:消费端枚举不得空转(实得 ${head.ends.length} 端:${head.ends.map((e) => e.end.replace('apps/', '')).join(',')})`,
    head.ends.length >= 4,
  )
  console.log(okAll ? '--self-test: 全部通过' : '--self-test: 有失败')
  process.exitCode = okAll ? 0 : 1
}

/* ---------------------------------- CLI ---------------------------------- */

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  const picked = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exitCode = 2
    return
  }
  const ti = argv.indexOf('--today')
  const today = ti >= 0 ? argv[ti + 1] : new Date().toISOString().slice(0, 10)
  if (!ISO_DATE.test(today)) {
    console.error(`❌ --today 不是 ISO 日期:${today}`)
    process.exitCode = 2
    return
  }
  const r = analyze(picked.face, today)
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.exit
    return
  }
  console.log(
    `[auth-handler-parity] 面:${r.face}(${facePrefix(r.face) ? 'HEAD blob' : r.face === 'staged' ? '索引 blob' : '工作树(人工)'} · 基准日 ${today}) · 候选 ${r.scannedCandidates} 文件 · 消费端 ${r.ends.length}`,
  )
  for (const e of r.ends) console.log(`  - ${e.end}: 直连消费文件 ${e.consumers} · 注册 ${e.registered ? '✅' : '❌'}`)
  if (r.ledgerAbsent) console.log(`⚠️ 台账不在被审面(${LEDGER_FILE})—— 按"零豁免"判,不是解析失败`)
  if (r.blind) console.log(`❌ AP3 失明:${r.blind.why}`)
  for (const x of r.ap2) console.log(`❌ AP2 台账腐烂:${x.app} —— ${x.why}`)
  for (const x of r.ap1)
    console.log(`❌ AP1 未接线:${x.end}(直连消费 ${x.consumers} 文件,例:${x.sample ?? '—'})—— 豁免不成立:${x.why}`)
  for (const u of r.undetermined) console.log(`ℹ️ ${u}`)
  if (r.exit === 0) console.log(`✅ 全部 ${r.ends.length} 个消费端已注册或持有效豁免;台账 ${r.ledgerEntries.length} 条无腐烂;注册口在位`)
  console.log(
    `结论:exit ${r.exit}(消费端 ${r.ends.length} · AP1 红 ${r.ap1.length} · AP2 红 ${r.ap2.length} · AP3 ${r.blind ? '失明' : '在位'})—— 紧急跳过 HUSKY_SKIP_AUTH_HANDLER_PARITY=1`,
  )
  process.exitCode = r.exit
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

export const __test__ = {
  classifyFile,
  detectMechanismTexts,
  parseLedger,
  exemptionIsValid,
  exemptionProblem,
  decideParity,
  analyze,
  inScopeAppFile,
  LEDGER_FILE,
  FIXTURES: FX,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
