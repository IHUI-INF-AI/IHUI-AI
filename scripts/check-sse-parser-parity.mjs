#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 帧"多解析器漏接"守门(2026-09-22 立,PROJECT_PLAN.md D106 / G-148 配套)
 *
 * 背景(实测,非推测):同一份 SSE 协议在库内被**两处独立解析** ——
 *   - packages/api-client/src/client.ts(routeLineByType + tryParse*,web / extension / mobile-rn 走这条)
 *   - packages/shared/src/utils/sse-parse.ts(miniapp-taro 走这条)
 * 每加一帧都要在两处各写一遍,再在每端的回调表里注册一次。历史上 `citations`、`steer`
 * 就是"api-client 有、另一处 0 命中"的状态被静默遗忘(实测四端 0 命中),
 * `injection_applied` / `retry_scheduled` 第 42 轮也只补了 api-client 一侧。
 * 本闸把"漏接"从**没人会发现的运行时静默**变成**提交时可见的清单**。
 *
 * 三类判定:
 *  ① 契约自洽:抽不到事件名 = 判据失效,**按失败处理**(不许"解析不出来就当全绿")。
 *  ② 解析覆盖(ratchet):sse-parse 侧覆盖的事件数 **不得低于 baseline**。只挡倒退不挡增长
 *     (否则未接的端一提交就恒红)。新覆盖一帧就把 baseline 上调。
 *  ③ 归属交代(machine-checkable):凡"api-client 已解析、sse-parse 未解析"的帧,必须出现在
 *     `scripts/data/sse-parser-coverage.json` 的 `webOnly` 清单里并写明**为什么只有 web 消费**。
 *     既不许凭空多出没登记的帧,也不许登记了却其实已接(该删的要删)。
 *
 * 刻意**不做**的一条:曾想加"代码里出现契约外事件名"判据,实测被否 ——
 * errorCode / 状态枚举(`content_policy_violation`、`output_ready`、`tool_call` 等)与事件名
 * 形状完全相同,按形状无法区分,拦到的全是误报。宁漏不误报。
 *
 * 用法:
 *   node scripts/check-sse-parser-parity.mjs [--json] [--self-test] [--report]
 *     [--staged | --worktree]   判定面旗标(互斥,同给 ⇒ exit 2;缺省 = HEAD blob)
 *     --report 打印两端覆盖矩阵与待接清单(供逐端补齐时当工单用)
 * 紧急跳过:HUSKY_SKIP_SSE_PARSER_PARITY=1 git commit ...
 * 退出码:0 = 一致;1 = 有违规(含"抽不到事件名 = 判据失效"那一型);2 = 无法判定
 *
 * ── 判定面(2026-09-27 G-303 收口;与守门 36 / 124 / 117 / 93 同一口径)────────────────
 * 默认(全量档)判 **HEAD blob**;`--staged` 判**索引 blob**(本次提交会带走的那一份,
 * 盘上随后改对不算修好);`--worktree` 只作人工逃生舱;**两面旗同给 ⇒ exit 2**
 * (取哪一面都会让另一面成为假绿);该面取不到任何一份输入 ⇒ **exit 2「无法判定」**,
 * **绝不回落到另一个面、绝不记绿**(回落就是把"没判"写成"判过了")。
 * 立因:本门此前按**磁盘**取四份输入,而 runner 给每道门追加的 `--staged` 它**不认** ——
 * 于是提交链上判的既不是"本次提交会带走的那一份",也不是 HEAD,而是常年滞后的共享工作树;
 * 同一份 HEAD 代码因此能在"恒红"与"假绿"之间来回跳(守门 83 的 R3 登记一天内被整文件
 * 回退三次即此型)。四份输入(契约 / 两份解析器 / **归属台账**)必须**同面同轮**经
 * `scripts/lib/face-reader.mjs` 的 `catBatch` 一次读满:台账与解析器分面读尤其致命 ——
 * 别人刚补接一帧而那条过期登记还没删(正是本门 stale 臂立项那一型),分面就会判出与真实
 * 提交相反的结论,而账面自洽。
 * **判据语义(比什么、什么算漂移)与本票之前逐字一致** —— 本票只换取材面,不改一条臂。
 * 唯一新增的出口:被审面上输入取不到 / 台账不是合法 JSON ⇒ 从"崩一个栈"变成 exit 2 点名,
 * 因为那种情况下本门**没有结论**,而"没有结论"不得被读成"没有违规"。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/**
 * 四份输入 = 本门**全部**取材面,同面同轮读满(见上方"判定面"段)。
 * 相对路径而非绝对:面旗标决定的是"哪一份内容",拼绝对路径等于把磁盘当默认档。
 */
export const INPUT_RELS = {
  contract: 'packages/shared/src/sse/contract.ts',
  client: 'packages/api-client/src/client.ts',
  parse: 'packages/shared/src/utils/sse-parse.ts',
  ledger: 'scripts/data/sse-parser-coverage.json',
}
const SKIP_ENV = 'HUSKY_SKIP_SSE_PARSER_PARITY'

/** 从 contract.ts 的 SSE_EVENTS 对象取事件名(值为字符串;含连字符与下划线两种写法) */
export function extractContractEvents(source) {
  const start = source.indexOf('export const SSE_EVENTS')
  if (start === -1) return []
  const block = source.slice(
    start,
    source.indexOf('\n}', start) === -1 ? undefined : source.indexOf('\n}', start) + 2,
  )
  const names = new Set()
  const re = /:\s*'([a-z0-9_-]+)'/gu
  let m
  while ((m = re.exec(block)) !== null) names.add(m[1])
  return [...names].sort()
}

/**
 * 判定"这一帧被本解析器接了"= 源码里有**分支守卫**,而不是字符串出现过。
 * 只按"字面量出现"判定会被两处骗过:
 *   - 类型联合声明(`type:` 下一行 `| 'steer'`)——只声明了形状,没写解析分支;
 *   - 产出语句(`return { type: 'steer', … }`)——守卫被删掉/写错时产出语句还在,照样"覆盖"。
 * 故要求同一行内出现守卫形态之一:
 *   ① `type === 'x'` / `type !== 'x'`   —— 分支守卫
 *   ② `case 'x':`                        —— routeLineByType 分派表
 * 唯一例外是**按字段形态识别**的帧(见 FIELD_SHAPE_EVENTS):它们没有 type 字面量守卫,
 * 只以 `type: 'x'` 产出语句为凭。
 */
const GUARD_PATTERNS = [
  /type\s*[!=]==\s*'([a-z][a-z0-9_-]{2,})'/gu,
  /case\s+'([a-z][a-z0-9_-]{2,})'/gu,
]
const PRODUCE_PATTERN = /type:\s*'([a-z][a-z0-9_-]{2,})'/gu
/** 后端不带 type 字段、靠 payload 形状识别的帧(见 sse-parse 的 compaction / usage 分支) */
const FIELD_SHAPE_EVENTS = new Set(['compaction', 'usage'])

export function extractHandledEvents(source, contractEvents) {
  const known = new Set(contractEvents)
  const guarded = new Set()
  const produced = new Set()
  for (const rawLine of source.split('\n')) {
    // 注释里抄的 wire 样例(如 "data: { type:'steer', ... }")不算实现,整行截到 // 之前
    const line = rawLine.includes('//') ? rawLine.slice(0, rawLine.indexOf('//')) : rawLine
    for (const re of [...GUARD_PATTERNS, PRODUCE_PATTERN]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(line)) !== null) {
        if (!known.has(m[1])) continue
        ;(re === PRODUCE_PATTERN ? produced : guarded).add(m[1])
      }
    }
  }
  return [...known]
    .filter((e) => guarded.has(e) || (FIELD_SHAPE_EVENTS.has(e) && produced.has(e)))
    .sort()
}

/** 契约外事件名判据已删除(形状与 errorCode 无法区分),见文件头"刻意不做的一条" */

/**
 * 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认不再是磁盘"这一格能被**构造面**
 * 证明,而不是等人跑一次真仓看结论行 —— 结论行会被人改,函数不会(守门 124 T15 同型)。
 * 两个面旗同给由 `selectFace` 判死:两面互斥,取任一都会让另一面成为假绿。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

export const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
}

/**
 * 按判定面取**全部四份**输入:一次 `cat-file --batch` 同面同轮读满,再逐条取。
 * `read()` 之前必须 `catBatch()` 预取 —— 共用层的这一设计是刻意的:未预取即读会**抛**
 * 而不是偷偷补一次派生,否则"退回散写"这种退化会被掩盖成正常。
 * 任一份取不到 ⇒ 抛 `Undetermined` 并**逐条点名**(调用方折成 exit 2);**不回落**另一个面。
 * root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引 ≠ 磁盘 ≠ HEAD"三面互异的现场。
 */
export function readFaceInputs(repoRoot, face) {
  const rels = Object.values(INPUT_RELS)
  const out = {}
  if (face === 'worktree') {
    const missing = []
    for (const rel of rels) {
      const text = readWorktreeFile(repoRoot, rel)
      if (text === null || text === undefined) missing.push(rel)
      else out[rel] = text
    }
    if (missing.length > 0)
      throw new Undetermined(`${FACE_TXT.worktree} 取不到 ${missing.join(' / ')}`)
    return out
  }
  const prefix = face === 'staged' ? ':' : 'HEAD:'
  const specs = rels.map((rel) => prefix + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
  const missing = []
  for (let i = 0; i < rels.length; i++) {
    const text = got.get(specs[i])
    if (text === null || text === undefined) missing.push(rels[i])
    else out[rels[i]] = text
  }
  if (missing.length > 0) {
    const label = face === 'staged' ? '索引 blob' : 'HEAD blob'
    throw new Undetermined(`${label} 取不到 ${missing.join(' / ')}`)
  }
  return out
}

/**
 * 台账不是合法 JSON ⇒ 本门**没有输入**,不是"没有违规":抛 `Undetermined`(交调用方 exit 2)。
 * 旧写法让 JSON.parse 抛裸异常、栈直接冒到提交链上,现象是"门崩了"而不是"门判不出";
 * 两者后果相同(提交被阻),但账面写的东西不同 —— 前者会让人去查门,后者才知道去补台账。
 */
export function parseLedger(text) {
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Undetermined(`归属台账 ${INPUT_RELS.ledger} 不是合法 JSON:${e.message}`)
  }
}

/**
 * 判据本体(纯函数,四份**文本**进、结论出)。**逐字**沿用收口前的比较逻辑:
 * 三条臂(ratchet / unaccounted / stale)+ "抽不到名字 = 判据失效"一条未动。
 */
export function analyze({ contractSrc, clientSrc, parseSrc, ledger, face }) {
  const contractEvents = extractContractEvents(contractSrc)
  const clientHandled = extractHandledEvents(clientSrc, contractEvents)
  const parseHandled = extractHandledEvents(parseSrc, contractEvents)
  const data = ledger
  const declared = new Set((data.webOnly ?? []).map((x) => x.event))
  const baseline = Number(data.parseCoverageBaseline ?? 0)

  const violations = []
  if (contractEvents.length === 0) {
    violations.push({ event: '(contract)', reason: '抽不到契约事件名(判据失效,不许当"全绿")' })
  }
  if (clientHandled.length === 0) {
    violations.push({ event: '(api-client)', reason: '抽不到已解析事件名(判据失效,不许当"全绿")' })
  }

  // ① 契约外事件名判据已删:errorCode / 状态枚举与事件名形状相同,按形状判只会产误报

  // ② ratchet
  if (parseHandled.length < baseline) {
    violations.push({
      event: '(parse-coverage)',
      reason: `sse-parse 覆盖 ${parseHandled.length} < 基线 ${baseline},有帧的解析被删(补回或说明后调基线)`,
    })
  }

  // ③ 归属交代
  const parsed = new Set(parseHandled)
  const unaccounted = []
  for (const ev of clientHandled) {
    if (parsed.has(ev)) continue
    if (!declared.has(ev)) unaccounted.push(ev)
  }
  if (unaccounted.length > 0) {
    violations.push({
      event: unaccounted.join(','),
      reason: 'api-client 已解析但 sse-parse 未解析,且未在 webOnly 登记(小程序端会静默丢帧)',
    })
  }
  const stale = []
  for (const entry of data.webOnly ?? []) {
    if (parsed.has(entry.event)) stale.push(entry.event)
  }
  if (stale.length > 0) {
    violations.push({
      event: stale.join(','),
      reason: 'webOnly 登记项其实已被 sse-parse 解析(应删登记并上调 parseCoverageBaseline)',
    })
  }
  for (const entry of data.webOnly ?? []) {
    if (!entry.why || String(entry.why).trim().length < 8) {
      violations.push({
        event: entry.event,
        reason: 'webOnly 登记必须写清"为什么只有 web 消费"(不能空着)',
      })
    }
  }

  return {
    // face 进结论:镜像测试与人工取证都要能证明"这一轮判的是哪一面",
    // 否则一色绿无法分辨是 HEAD 判过还是索引判过(三面各答各的)。
    face,
    contractEvents,
    clientHandled,
    parseHandled,
    missingInParse: contractEvents.filter((e) => !parsed.has(e)),
    baseline,
    violations,
  }
}

/**
 * 对外入口:按面取输入 → 判据本体。取不到 ⇒ **抛** `Undetermined`(不冒红也不记绿),
 * 由 `main` 折成 exit 2;`--self-test` 与镜像测试也走这一条,证明的是同一条取材路径。
 */
export function runChecks({ root = ROOT, face = 'head' } = {}) {
  const inputs = readFaceInputs(root, face)
  return analyze({
    contractSrc: inputs[INPUT_RELS.contract],
    clientSrc: inputs[INPUT_RELS.client],
    parseSrc: inputs[INPUT_RELS.parse],
    ledger: parseLedger(inputs[INPUT_RELS.ledger]),
    face,
  })
}

function selfTest() {
  const evs = ['alpha_frame', 'beta_frame', 'gamma_frame']
  const cases = [
    [
      '契约名抽取',
      extractContractEvents(
        "export const SSE_EVENTS = {\n  A: 'alpha_frame',\n  B: 'beta_frame',\n}\n",
      ).join(','),
      'alpha_frame,beta_frame',
    ],
    [
      '分支守卫算覆盖',
      extractHandledEvents("if (json?.type === 'alpha_frame') return 1", evs).join(','),
      'alpha_frame',
    ],
    [
      '反向守卫算覆盖',
      extractHandledEvents("if (json?.type !== 'beta_frame') return", evs).join(','),
      'beta_frame',
    ],
    [
      '分派表 case 算覆盖',
      extractHandledEvents("    case 'gamma_frame':\n      return 'x'", evs).join(','),
      'gamma_frame',
    ],
    // 必须**不**算覆盖的反例:只声明类型、或只剩产出语句而守卫被删/写错 —— 都是"看着接了其实没接"
    [
      '类型联合声明不算覆盖',
      extractHandledEvents("  type:\n    | 'alpha_frame'\n    | 'beta_frame'\n  text?: string", evs)
        .length,
      0,
    ],
    [
      '守卫缺失只剩产出语句不算覆盖',
      extractHandledEvents(
        "if (json?.type !== 'alpha_frame') return\nreturn { type: 'beta_frame' }",
        evs,
      ).join(','),
      'alpha_frame',
    ],
    [
      '注释里的 wire 样例不算覆盖',
      extractHandledEvents("// 例:type: 'gamma_frame' 只是样例", evs).length,
      0,
    ],
    [
      '非契约字面量不参与判定',
      extractHandledEvents("if (x?.type === 'chunk') return 1", evs).length,
      0,
    ],
    [
      '按字段形态识别的帧以产出语句为凭',
      extractHandledEvents("return { type: 'compaction', compaction }", ['compaction']).join(','),
      'compaction',
    ],
  ]
  let bad = 0
  for (const [label, got, expected] of cases) {
    const ok = String(got) === String(expected)
    if (!ok) bad++
    console.log(
      `${ok ? '✓' : '✗'} ${label} → ${JSON.stringify(got)}(期望 ${JSON.stringify(expected)})`,
    )
  }
  // 取材面自证(取代旧的"四个数据源文件都在磁盘上"那一臂):旧臂判的是**磁盘**,而磁盘绿
  // 不代表提交链会判的那一面在位 —— 那正是本票收口的型。现按默认档(HEAD blob)取一次。
  let faceOk = true
  let faceWhy = ''
  try {
    readFaceInputs(ROOT, 'head')
  } catch (e) {
    faceOk = false
    faceWhy = e && e.message ? e.message : String(e)
  }
  if (!faceOk) bad++
  console.log(
    `${faceOk ? '✓' : '✗'} 四份输入在 HEAD 面全部取得到(取不到即"无法判定",不许当全绿)${faceWhy ? ` → ${faceWhy}` : ''}`,
  )
  // 默认档必须是 HEAD、两面旗同给必须判死 —— 这一格由纯函数证明,不靠人看结论文字。
  const faceSelOk =
    faceFromArgv([]).face === 'head' &&
    faceFromArgv(['--staged']).face === 'staged' &&
    faceFromArgv(['--worktree']).face === 'worktree' &&
    faceFromArgv(['--staged', '--worktree']).face === null
  if (!faceSelOk) bad++
  console.log(
    `${faceSelOk ? '✓' : '✗'} 判定面四态:缺省 head / --staged / --worktree / 两旗同给判死`,
  )
  let res = null
  let resErr = ''
  try {
    res = runChecks()
  } catch (e) {
    resErr = e && e.message ? e.message : String(e)
  }
  const noCrash = !!res && res.contractEvents.length > 20 && res.clientHandled.length > 0
  if (!noCrash) bad++
  console.log(
    `${noCrash ? '✓' : '✗'} 真实语料可解析(面:${res ? FACE_TXT[res.face] : '取不到'}):契约 ${res?.contractEvents.length ?? 0} 帧 / api-client ${res?.clientHandled.length ?? 0} / sse-parse ${res?.parseHandled.length ?? 0}(基线 ${res?.baseline ?? 0})${resErr ? ` → ${resErr}` : ''}`,
  )
  if (res) console.log(`ℹ️  现存违规 ${res.violations.length} 条(新增登记项前必须先降到 0)`)
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.warn(
      `⚠️  [sse-parser-parity] 已用 ${SKIP_ENV}=1 跳过(紧急通道,须在 PROJECT_PLAN.md 说明)`,
    )
    return 0
  }
  const sel = faceFromArgv(argv)
  if (sel.error) {
    console.error(`❌ [sse-parser-parity] 无法判定:${sel.error}`)
    return 2
  }
  let res = null
  try {
    res = runChecks({ root: ROOT, face: sel.face })
  } catch (e) {
    const why =
      e instanceof Undetermined ? e.message : `取材失败:${e && e.message ? e.message : String(e)}`
    console.error(
      `❌ [sse-parser-parity] 无法判定(取材面:${FACE_TXT[sel.face]})—— ${why}\n` +
        `   既不冒红也不记绿:先确认被审面上 ${Object.values(INPUT_RELS).join(' / ')} 都在位,再重跑。`,
    )
    return 2
  }
  if (argv.includes('--report')) {
    console.log(
      `契约 ${res.contractEvents.length} 帧;api-client 解析 ${res.clientHandled.length};sse-parse 解析 ${res.parseHandled.length}(基线 ${res.baseline};取材面:${FACE_TXT[res.face]})`,
    )
    console.log(`\nsse-parse 未解析的帧(${res.missingInParse.length}):`)
    console.log(res.missingInParse.map((e) => `  ${e}`).join('\n') || '  (无)')
    console.log('\n逐端补齐工单:上面每删一条登记,就同步上调 parseCoverageBaseline')
    return 0
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(res, null, 2))
  }
  if (res.violations.length > 0) {
    console.error(
      `❌ [sse-parser-parity] ${res.violations.length} 处问题(取材面:${FACE_TXT[res.face]})`,
    )
    for (const v of res.violations.slice(0, 20)) {
      console.error(`  ${v.event} ${v.reason}`)
    }
    console.error(
      `\n  💡 同一协议两处解析,漏接是静默的(小程序拿不到帧,界面上像"功能不存在")。\n     看清单:node scripts/check-sse-parser-parity.mjs --report\n     自检:node scripts/check-sse-parser-parity.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
    )
    return 1
  }
  console.log(
    `✅ [sse-parser-parity] 契约 ${res.contractEvents.length} 帧;api-client ${res.clientHandled.length} / sse-parse ${res.parseHandled.length}(基线 ${res.baseline}),未接帧均已交代归属(取材面:${FACE_TXT[res.face]})`,
  )
  return 0
}

// §22d:CLI 直接执行才跑主流程;被镜像测试 import 时不得有副作用。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  extractContractEvents,
  extractHandledEvents,
  runChecks,
  // 收口后新增的四个出口:面选择 / 取材 / 台账解析 / 判据本体 —— 镜像测试因此能分别证明
  // "默认档不是磁盘""取不到不回落""三面各答各的",而不是只能整跑一次 CLI 看结论。
  faceFromArgv,
  readFaceInputs,
  parseLedger,
  analyze,
  INPUT_RELS,
  FACE_TXT,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
