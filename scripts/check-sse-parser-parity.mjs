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
 * 取材面(2026-09-28 收口,与守门 36/70/77/83/93/98/101/103/118/124 同口径):
 * 默认判 **HEAD blob**,`--staged` 判**索引 blob**(这次提交会带走的那一份 —— 盘上随后改对
 * 不算修好),`--worktree` 只作人工逃生舱;两个面旗同给 = 自相矛盾 ⇒ exit 2;任一面取不到
 * ⇒ **exit 2「无法判定」并点名路径,绝不回落到另一个面**(回落就是把"没判"写成"判过了")。
 * 旧形态按磁盘直读三份源码 + 台账,且**不认识 runner 在 pre-commit 追加的 `--staged` 旗标**
 * (加与不加行为一致)⇒ 落在守门 118 的"散写"桶里。共享工作树常年滞后 HEAD,按磁盘判的门
 * 会在"恒红 / 假绿"之间来回跳,并把错数写回棘轮基线(台账基线 23 是按现值上调的,判错面
 * 等于让下一个人对着滞后的磁盘把基线再调歪一次)。清单与内容一次 `cat-file --batch`
 * **同面同轮**读完 —— 混面会在并行会话推进的瞬间产出自洽却错位的尺子。
 *
 * 用法:
 *   node scripts/check-sse-parser-parity.mjs                    全量(HEAD blob)
 *   node scripts/check-sse-parser-parity.mjs --staged           索引面(pre-commit 由 runner 追加)
 *   node scripts/check-sse-parser-parity.mjs --worktree         人工排查(提交链不走这档)
 *   node scripts/check-sse-parser-parity.mjs [--json] [--self-test] [--report]
 *     --report 打印两端覆盖矩阵与待接清单(供逐端补齐时当工单用)
 * 退出码:0 = 通过;1 = 违规;2 = 无法判定(两面旗同给 / 所选面取不到,绝不冒红也绝不记绿)
 * 紧急跳过:HUSKY_SKIP_SSE_PARSER_PARITY=1 git commit ...
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 取材只走这一层:绝对路径 git、safe.directory、quotepath、windowsHide、maxBuffer、
// "输出被截断 ⇒ 无法判定" —— 这几处易错点各门自己写一遍就会各漏一遍(AGENTS 守门 118 头注)。
import { Undetermined, catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 四份输入一律用**仓库相对路径**登记 —— 面切换时同一份清单喂 cat-file 规格与磁盘拼接,不得两处各写一份 */
const REL_CONTRACT = 'packages/shared/src/sse/contract.ts'
const REL_CLIENT = 'packages/api-client/src/client.ts'
const REL_PARSE = 'packages/shared/src/utils/sse-parse.ts'
const REL_DATA = 'scripts/data/sse-parser-coverage.json'
const INPUT_RELS = [REL_CONTRACT, REL_CLIENT, REL_PARSE, REL_DATA]
const SKIP_ENV = 'HUSKY_SKIP_SSE_PARSER_PARITY'

/** 从 contract.ts 的 SSE_EVENTS 对象取事件名(值为字符串;含连字符与下划线两种写法) */
export function extractContractEvents(source) {
  const start = source.indexOf('export const SSE_EVENTS')
  if (start === -1) return []
  const block = source.slice(start, source.indexOf('\n}', start) === -1 ? undefined : source.indexOf('\n}', start) + 2)
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
 * 纯函数:argv → 判定面(默认 **head**)。导出是为了"默认不再是磁盘"这一格能被构造面
 * 证明,而不是等人跑一次真仓看结论行 —— 结论行会被人改,函数不会。两面旗同给 = 自相矛盾,
 * 由共用层的 selectFace 折成 error 交调用方判死(取哪一面都会让另一面成为假绿)。
 */
export function faceFromArgv(argv) {
  return selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
}

/**
 * 纯函数:面 → `cat-file --batch` 的规格前缀。worktree 走磁盘分支所以返回 null;
 * 未知面**抛**(拿"猜一个面"继续跑 = 把没判写成判过了)。
 */
export function faceSpecPrefix(face) {
  if (face === 'staged') return ':'
  if (face === 'head') return 'HEAD:'
  if (face === 'worktree') return null
  throw new Undetermined(`未知取材面:${String(face)}`)
}

/**
 * 按判定面取**四份**输入(三份源码 + 台账),一次 `cat-file --batch` 同面同轮读完。
 * 混面(清单来自磁盘、内容来自 git,或两份输入各取一面)会在并发会话推进的瞬间产出
 * 自洽却错位的尺子;取不到一律抛 `Undetermined`(调用方折成 exit 2),**不回落**另一个面。
 * root/face 都是入参:镜像测试因此能在临时 git 仓里造"索引≠磁盘"的现场,不依赖真仓瞬时状态。
 */
export function readGateInputs(repoRoot, face) {
  const prefix = faceSpecPrefix(face)
  const out = {}
  if (prefix === null) {
    for (const rel of INPUT_RELS) {
      const t = readWorktreeFile(repoRoot, rel)
      if (t === null || t === undefined) throw new Undetermined(`工作树(逃生舱)取不到 ${rel}`)
      out[rel] = t
    }
    return out
  }
  const specs = INPUT_RELS.map((rel) => prefix + rel)
  const got = catBatch(repoRoot, specs, { maxBuffer: 1 << 28 })
  for (let i = 0; i < INPUT_RELS.length; i++) {
    const t = got.get(specs[i])
    if (t === null || t === undefined)
      throw new Undetermined(
        `${face === 'staged' ? '索引' : 'HEAD'} 面取不到 ${INPUT_RELS[i]}(不回落到其他面)`,
      )
    out[INPUT_RELS[i]] = t
  }
  return out
}

/**
 * 纯判据:四份输入文本 → 结论对象。三条臂(契约自洽 / ratchet / 归属交代)只在这一处实现,
 * 面向与盘面都经它 —— 判据一个字不因迁移放宽,变的只有"输入从哪一面来"。
 */
export function analyze(sources) {
  const contractEvents = extractContractEvents(sources[REL_CONTRACT])
  const clientSrc = sources[REL_CLIENT]
  const parseSrc = sources[REL_PARSE]
  const clientHandled = extractHandledEvents(clientSrc, contractEvents)
  const parseHandled = extractHandledEvents(parseSrc, contractEvents)
  const data = JSON.parse(sources[REL_DATA])
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
      violations.push({ event: entry.event, reason: 'webOnly 登记必须写清"为什么只有 web 消费"(不能空着)' })
    }
  }

  return {
    contractEvents,
    clientHandled,
    parseHandled,
    missingInParse: contractEvents.filter((e) => !parsed.has(e)),
    baseline,
    violations,
  }
}

/**
 * 面向入口:按面取材 → 交给唯一一份判据 `analyze`。
 * root/face 都是可选入参(默认 = 真仓 + HEAD),镜像测试据此能在临时 git 仓里跑同一份实现。
 * 取不到输入时**抛** `Undetermined`(main 折成 exit 2),不在这里吞。
 */
export function runChecks(repoRoot = ROOT, face = 'head') {
  const res = analyze(readGateInputs(repoRoot, face))
  return { ...res, face }
}

const FACE_TXT = {
  head: 'HEAD blob(全量审计)',
  staged: '索引 blob(本次提交会带走的那一份)',
  worktree: '工作树(人工逃生舱,提交链不走这档)',
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
    ['分支守卫算覆盖', extractHandledEvents("if (json?.type === 'alpha_frame') return 1", evs).join(','), 'alpha_frame'],
    ['反向守卫算覆盖', extractHandledEvents("if (json?.type !== 'beta_frame') return", evs).join(','), 'beta_frame'],
    ['分派表 case 算覆盖', extractHandledEvents("    case 'gamma_frame':\n      return 'x'", evs).join(','), 'gamma_frame'],
    // 必须**不**算覆盖的反例:只声明类型、或只剩产出语句而守卫被删/写错 —— 都是"看着接了其实没接"
    ['类型联合声明不算覆盖', extractHandledEvents("  type:\n    | 'alpha_frame'\n    | 'beta_frame'\n  text?: string", evs).length, 0],
    [
      '守卫缺失只剩产出语句不算覆盖',
      extractHandledEvents("if (json?.type !== 'alpha_frame') return\nreturn { type: 'beta_frame' }", evs).join(','),
      'alpha_frame',
    ],
    ['注释里的 wire 样例不算覆盖', extractHandledEvents("// 例:type: 'gamma_frame' 只是样例", evs).length, 0],
    ['非契约字面量不参与判定', extractHandledEvents("if (x?.type === 'chunk') return 1", evs).length, 0],
    ['按字段形态识别的帧以产出语句为凭', extractHandledEvents("return { type: 'compaction', compaction }", ['compaction']).join(','), 'compaction'],
  ]
  let bad = 0
  for (const [label, got, expected] of cases) {
    const ok = String(got) === String(expected)
    if (!ok) bad++
    console.log(`${ok ? '✓' : '✗'} ${label} → ${JSON.stringify(got)}(期望 ${JSON.stringify(expected)})`)
  }
  let res
  try {
    res = runChecks(ROOT, 'head')
  } catch (e) {
    // 自检也跑在被审面上:HEAD 取不到 ⇒ 输入缺失会被静默读成"抽不到事件名"以外的东西,
    // 必须在这里点名,而不是让下一条断言去猜(取不到 ≠ 通过,也不 = 判据红)。
    const known = e instanceof Undetermined
    console.log(`✗ HEAD 面取不到四份输入(缺一个判据就会假绿):${known ? e.message : (e?.stack ?? e)}`)
    return 1
  }
  const noCrash = res.contractEvents.length > 20 && res.clientHandled.length > 0
  if (!noCrash) bad++
  console.log(`✓ 四份输入在 HEAD 面(${FACE_TXT.head})全部取到且可解析:契约 ${res.contractEvents.length} 帧 / api-client ${res.clientHandled.length} / sse-parse ${res.parseHandled.length}(基线 ${res.baseline})`)
  console.log(`ℹ️  现存违规 ${res.violations.length} 条(新增登记项前必须先降到 0)`)
  console.log(bad === 0 ? '✅ self-test 全过' : `❌ self-test 失败 ${bad} 例`)
  return bad === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (process.env[SKIP_ENV] === '1') {
    console.warn(`⚠️  [sse-parser-parity] 已用 ${SKIP_ENV}=1 跳过(紧急通道,须在 PROJECT_PLAN.md 说明)`)
    return 0
  }
  const sel = faceFromArgv(argv)
  if (sel.error) {
    console.error(`❌ [sse-parser-parity] 无法判定:${sel.error}`)
    return 2
  }
  let res
  try {
    res = runChecks(ROOT, sel.face)
  } catch (e) {
    // 「无法判定」是预期结论,一句话足够;**其他异常**必须带栈落地 —— 匿名 exit 2 = 不可诊断
    const known = e instanceof Undetermined
    console.error(
      `[sse-parser-parity] 取不到输入(${FACE_TXT[sel.face]})⇒ 无法判定(不记为通过):${
        known ? e.message : (e?.stack ?? e)
      }`,
    )
    return 2
  }
  if (argv.includes('--report')) {
    console.log(`契约 ${res.contractEvents.length} 帧;api-client 解析 ${res.clientHandled.length};sse-parse 解析 ${res.parseHandled.length}(基线 ${res.baseline})(取材面:${FACE_TXT[sel.face]})`)
    console.log(`\nsse-parse 未解析的帧(${res.missingInParse.length}):`)
    console.log(res.missingInParse.map((e) => `  ${e}`).join('\n') || '  (无)')
    console.log('\n逐端补齐工单:上面每删一条登记,就同步上调 parseCoverageBaseline')
    return 0
  }
  if (argv.includes('--json')) {
    console.log(JSON.stringify(res, null, 2))
  }
  if (res.violations.length > 0) {
    console.error(`❌ [sse-parser-parity] ${res.violations.length} 处问题(取材面:${FACE_TXT[sel.face]})`)
    for (const v of res.violations.slice(0, 20)) {
      console.error(`  ${v.event} ${v.reason}`)
    }
    console.error(
      `\n  💡 同一协议两处解析,漏接是静默的(小程序拿不到帧,界面上像"功能不存在")。\n     看清单:node scripts/check-sse-parser-parity.mjs --report\n     自检:node scripts/check-sse-parser-parity.mjs --self-test\n     紧急跳过(不推荐):${SKIP_ENV}=1 git commit ...`,
    )
    return 1
  }
  console.log(
    `✅ [sse-parser-parity] 契约 ${res.contractEvents.length} 帧;api-client ${res.clientHandled.length} / sse-parse ${res.parseHandled.length}(基线 ${res.baseline}),未接帧均已交代归属(取材面:${FACE_TXT[sel.face]})`,
  )
  return 0
}

export const __test__ = {
  extractContractEvents,
  extractHandledEvents,
  analyze,
  runChecks,
  faceFromArgv,
  faceSpecPrefix,
  readGateInputs,
  INPUT_RELS,
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
