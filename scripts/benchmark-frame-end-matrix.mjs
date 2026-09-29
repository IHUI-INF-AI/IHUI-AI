#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 常驻取证工具(D160 的产物之一):生成**我方侧**「SSE 帧 × 端」消费面对账表。
//
// 为什么要它:本线三份**竞品侧**一手清单(codex / qoder / trae)早已入库,而我方侧同类清单
// 从未交付(取证代理撞轮次上限,只留下 web-bind2.tsv 与 _callbacks.txt 两份中间产物)。
// 后果是"某帧在某端到底接没接"每次都要人肉重答,而本线已因此重做过一次 —— D160 的原话。
//
// 用法:
//   node scripts/benchmark-frame-end-matrix.mjs                 # 生成/覆盖 ours/frame-by-end-matrix.md
//   node scripts/benchmark-frame-end-matrix.mjs --stdout        # 只打到标准输出,不落盘(取证/对比用)
//   node scripts/benchmark-frame-end-matrix.mjs --self-test     # 逻辑自检(合成语料,零副作用)
//
// 三条不可漂的口径(都是这工具自己踩出来的):
//  ① **一律判 HEAD 面**:本机工作树对上千个路径滞后 HEAD,按磁盘判会在"恒红/假绿"之间来回跳
//     (与守门 70/77/83/98/118 同取向)。
//  ② **只有落在分派位上的字面量才算"该端接了这一帧"**。裸词不行(`error` 在 apps/web 命中 1563 个
//     文件),光有引号也不行(`"budget"` 会出现在与 SSE 无关的 Rust/表单字段里)。前两版分别栽在
//     这两条上,产出的表满屏"有",都已作废。
//  ③ **git 报错不得被读成"零命中"**:`(?:…)` 不是 POSIX ERE,一次写法错误就让每条调用都 fatal,
//     而 stdout 为空 ⇒ 表长得像"什么都没接"。现在任何 fatal 都直接拒绝出表(见 GREP_ERRORS)。
//
// 定级:取证工具,**刻意不接提交链** —— 它判的是"清单与代码是否一致",与本次提交内容无关,
// 挂 blocking 就是每台每次被逼 `--no-verify`、连带其余全部对账作废(AGENTS §12f)。
// 文件名不以 check|scan|guard 开头 ⇒ 守门 89 结构上看不见它;不变量由 --self-test 与
// §22c 镜像测试 scripts/tests/benchmark-frame-end-matrix.test.mjs 钉住。

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_REL = 'docs/benchmark-evidence/2026-09/ours/frame-by-end-matrix.md'
const TS_CONTRACT = 'packages/shared/src/sse/contract.ts'
const PY_CONTRACT = 'apps/ai-service/app/core/sse_contract.py'
const GIT_TIMEOUT = 180000

/** 被盘点的端(列顺序 = 表头顺序)。shared/api-client 单列:它们是"接线是否存在"的中间层。 */
export const ENDS = [
  ['web', 'apps/web'],
  ['miniapp-taro', 'apps/miniapp-taro/src'],
  ['mobile-rn', 'apps/mobile-rn/src'],
  ['packages/app', 'packages/app/src'],
  ['extension', 'apps/extension'],
  ['desktop', 'apps/desktop'],
  ['cli', 'apps/cli/src'],
  ['api-client', 'packages/api-client/src'],
  ['shared', 'packages/shared/src'],
]

const git = (args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: GIT_TIMEOUT,
    maxBuffer: 1 << 26,
  })

const isTestLine = (l) => /(^|\/)(tests?|__tests__|e2e)(\/|$)/.test(l) || /\.(test|spec)\./.test(l)

/** TS 契约:帧名住在 `SSE_EVENTS` 这个对象的**值**里(`SSE_EVENT_NAMES = Object.values(SSE_EVENTS)`)。 */
export function parseTsNames(src) {
  const out = new Set()
  const start = src.indexOf('export const SSE_EVENTS')
  if (start < 0) throw new Error(`找不到 SSE_EVENTS(${TS_CONTRACT})⇒ 契约面形状变了,不猜`)
  const brace = src.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let i = brace; i >= 0 && i < src.length; i++) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end < 0) throw new Error('SSE_EVENTS 花括号配不上 ⇒ 取材失败,不出表')
  for (const m of src.slice(brace, end).matchAll(/:\s*'([a-z][a-z0-9_]{2,})'/g)) out.add(m[1])
  if (out.size < 10) throw new Error(`只解析到 ${out.size} 个 TS 帧名 ⇒ 判据失效,拒绝出表`)
  return out
}

/** Python 契约:帧名住在 `SSE_EVENTS: frozenset[str] = frozenset(...)` 的集合字面量里。 */
export function parsePyNames(src) {
  const out = new Set()
  const start = src.indexOf('SSE_EVENTS')
  if (start < 0) throw new Error(`找不到 SSE_EVENTS(${PY_CONTRACT})⇒ 契约面形状变了,不猜`)
  const open = src.indexOf('frozenset(', start)
  if (open < 0) throw new Error('SSE_EVENTS 后面找不到 frozenset( ⇒ 形状变了,不猜')
  let depth = 0
  let close = -1
  for (let i = src.indexOf('(', open); i < src.length; i++) {
    if (src[i] === '(') depth += 1
    else if (src[i] === ')') {
      depth -= 1
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close < 0) throw new Error('frozenset 括号配不上 ⇒ 取材失败,不出表')
  for (const m of src.slice(open, close).matchAll(/["']([a-z][a-z0-9_]{2,})["']/g)) out.add(m[1])
  if (out.size < 10) throw new Error(`python 侧只解析到 ${out.size} 个帧名 ⇒ 判据失效,拒绝出表`)
  return out
}

/** 三类分派位。注意必须 POSIX ERE:写 `(?:…)` 会让 git grep 每条都 fatal(真实自伤过)。 */
export function dispatchPatterns(frame) {
  const q = `["'\`]${frame}["'\`]`
  return [
    ['switch', `case\\s+${q}`],
    ['table', `${q}\\s*:`],
    ['compare', `===?\\s*${q}|event:\\s*${frame}\\b`],
  ]
}

/** 一格的判读:有(switch/table/compare) / 仅测试面 / 判不出(字面量无分派位) / 无字面量。 */
export function classifyCell({ dispatchProd, dispatchAll, quotedProd, sample }) {
  if (dispatchProd.length > 0) return { state: 'wired', kind: dispatchProd[0].kind, at: dispatchProd[0].at, extra: dispatchProd.length - 1 }
  if (dispatchAll.length > 0) return { state: 'testOnly' }
  if (quotedProd > 0) return { state: 'undetermined', quotedProd }
  return { state: 'absent', sample }
}

function makeGrep(errors) {
  return function grepAll(pattern, path) {
    let stdout = ''
    try {
      stdout = git(['grep', '-n', '-I', '-E', pattern, 'HEAD', '--', path])
    } catch (e) {
      const err = String(e.stderr ?? '')
      if (/fatal:/.test(err)) errors.push(`${pattern} :: ${err.split('\n')[0]}`)
      stdout = String(e.stdout ?? '')
    }
    return stdout.split('\n').filter(Boolean)
  }
}

function atOf(line) {
  const i = line.indexOf('HEAD:')
  const rest = i >= 0 ? line.slice(i + 5) : line
  return rest.split(':').slice(0, 2).join(':')
}

export function buildMatrix(grepAll) {
  const errors = []
  const g = grepAll ?? makeGrep(errors)
  const names = parseTsNames(git(['show', `HEAD:${TS_CONTRACT}`]).replace(/\r\n/g, '\n'))
  const pyNames = parsePyNames(git(['show', `HEAD:${PY_CONTRACT}`]).replace(/\r\n/g, '\n'))
  const frames = [...new Set([...names, ...pyNames])].sort()
  const cells = []
  for (const f of frames) {
    const row = []
    for (const [, path] of ENDS) {
      const pats = dispatchPatterns(f)
      const dispatchAll = []
      for (const [kind, pat] of pats) for (const l of g(pat, path)) if (!dispatchAll.some((x) => x.line === l)) dispatchAll.push({ line: l, kind })
      const dispatchProd = dispatchAll.filter((x) => !isTestLine(x.line)).map((x) => ({ kind: x.kind, at: atOf(x.line) }))
      const quotedProd = dispatchAll.length === 0 ? g(`["'\`]${f}["'\`]`, path).filter((l) => !isTestLine(l)).length : 0
      row.push(classifyCell({ dispatchProd, dispatchAll, quotedProd, sample: dispatchProd[0]?.at ?? '' }))
    }
    cells.push(row)
  }
  return { frames, cells, errors, counts: { ts: names.size, py: pyNames.size } }
}

function render({ frames, cells, counts }, generatedBy) {
  const header = `| 帧名 | ${ENDS.map(([l]) => l).join(' | ')} |\n| --- | ${ENDS.map(() => '---').join(' | ')} |`
  const body = cells.map((row, i) => {
    const cols = row.map((c) => {
      if (c.state === 'wired') return `有·${c.kind}(${c.at}${c.extra > 0 ? ` +${c.extra}` : ''})`
      if (c.state === 'testOnly') return '**仅测试面**'
      if (c.state === 'undetermined') return `判不出(字面量 ${c.quotedProd} 处,无分派位)`
      return '—'
    })
    return `| \`${frames[i]}\` | ${cols.join(' | ')} |`
  })
  const undetermined = cells.flat().filter((c) => c.state === 'undetermined').length
  const testOnly = cells.flat().filter((c) => c.state === 'testOnly').length
  const wired = cells.flat().filter((c) => c.state === 'wired').length
  const total = frames.length * ENDS.length
  return `# 我方侧 AI 对话流「帧 × 端」消费面对账(机器生成,HEAD 面)

> 由 \`${generatedBy}\` 生成,D160 的产物之一。重新生成:
> \`node scripts/benchmark-frame-end-matrix.mjs\` —— **本文件的任何一格都不该手工改**,
> 读数变了就说明代码或契约变了,那就去改代码或另立一票,而不是改这张表。
>
> **取材面**:全部读数来自 \`git grep -n -I -E <分派位模式> HEAD -- <端路径>\`,不看工作树
> (本机工作树对上千个路径滞后 HEAD,按磁盘判会在"恒红/假绿"之间来回跳 —— 本仓所有对账门同口径)。
> **帧全集** = TS 契约 \`${TS_CONTRACT}\` 的 \`SSE_EVENTS\`(${counts.ts} 名) ∪
> Python 契约 \`${PY_CONTRACT}\` 的 \`SSE_EVENTS\` frozenset(${counts.py} 名),合计 ${frames.length} 名。
>
> ## 怎么读(四条,别只挑好看的)
>
> 1. \`有·switch / 有·table / 有·compare(路径:行 +N)\` = 该帧名在该端**生产面**落在一个分派位上
>    (\`case 'x'\` / \`'x':\` 分派表键 / \`=== 'x'\` 或线格式 \`event: x\`),已排除 \`tests/\`、\`__tests__/\`、
>    \`e2e/\`、\`*.test.*\`。它是"接线存在"的证据,**不是**"用户看得见"的证据:到端渲染要浏览器/模拟器
>    会话,本机结构性缺这两样,所以本表一律不下"已实测"结论。
> 2. \`判不出(字面量 N 处,无分派位)\` = 有带引号的该名字,但不在分派位上。**不得**读成"接了",
>    也**不得**读成"没接",要人工看一眼。
> 3. \`—\` 只表示"该端源码里没有这个带引号的帧名字面量"。以下三型它结构上判不出来,
>    因此**不得**被读成"该端没有这一能力":① 帧名由模板字符串动态拼接;② 经命名空间对象或
>    \`export *\` 转发;③ 该端走 api-client 的集中分派(端内只见回调 prop 名,不见帧名)。
>    —— 已知实例:web 侧消费 \`citations\`/\`goal_updated\` 是经 api-client 的 \`onCitations\` prop,
>    所以 web 列里该帧显示 \`—\` 或"判不出",而**不代表** web 没有这个功能。
> 4. \`**仅测试面**\` = 只有测试文件提到该帧 ⇒ 本仓最高频的失效型("造好没装车"),按 §12f 的优先级
>    它比新增功能票更该先修。
>
> ## 表
>
${header}
${body.join('\n')}

## 本表自身的读数(判不出不是瑕疵,是它唯一诚实的那一列)

- 格数 ${total} = 帧 ${frames.length} × 端 ${ENDS.length};其中 **有分派位 ${wired}**、**仅测试面 ${testOnly}**、**判不出 ${undetermined}**、无字面量 ${total - wired - testOnly - undetermined}。
- 把「判不出」抹成「有」或「没有」都是假账 —— 本线的 §十一 勘误表里,一半以上的条目就是这么来的。

## 已知判不了的一格(如实登记,不得读成"已覆盖")

- **端内回调 prop 层**没进本表:帧名→\`onDelta\`/\`onToolCall\`/\`onCitations\` 的映射住在
  \`packages/api-client/src/client.ts\` 与 \`packages/shared/src/sse/agent-events.ts\`,那里按字段挑、
  不出现帧名的情况(如帧级 \`traceId\` 到端那一格)本表看不见 —— 已知实例:服务端每条帧都带
  \`traceId\`(\`c92f0777f0\` + \`413a651551\`),而端上取不到,该格由台账里「帧级 traceId 到端那一半」那张票跟。
- 小程序自写流式传输层(D138 登记的"同一续传逻辑养两份实现")在本表里表现为 miniapp 列的命中,
  但**它是否与 api-client 那条链等价**判不出 —— 属 D138,不在本表射程。
- 各端**渲染层**是否把这些帧变成用户看得见的东西,本表完全不判(见上面读法第 1 条)。
`
}

function selfTest() {
  const pass = []
  const fail = []
  const t = (name, cond) => (cond ? pass : fail).push(name)
  const tsSrc = `export const SSE_EVENTS = { DELTA: 'chunk', DONE: 'done', PLAN: 'plan_updated', CIT: 'citations', GOAL: 'goal_updated', TERM: 'terminal_delta', INJ: 'injection_applied', ERR: 'error', BUD: 'budget', FB: 'fallback', RC: 'retry_scheduled' } as const\nexport const SSE_EVENT_NAMES = Object.values(SSE_EVENTS)`
  t('① TS 契约按**值**解析(照 SSE_EVENT_NAMES 那行抓字面量只会抓到 3 个)', parseTsNames(tsSrc).size === 11)
  const pySrc = 'SSE_EVENTS: frozenset[str] = frozenset(\n    "chunk",\n    "done",\n    "plan_updated",\n    "citations",\n    "goal_updated",\n    "terminal_delta",\n    "injection_applied",\n    "error",\n    "budget",\n    "fallback",\n    "retry_scheduled",\n)\n'
  t('② py 契约按 frozenset 深度配平解析(找 "))" 那种写法会落空)', parsePyNames(pySrc).size === 11)
  let threw = false
  try {
    parseTsNames('export const SSE_EVENTS = { A: \'chunk\' } as const')
  } catch {
    threw = true
  }
  t('③ 帧名太少 ⇒ 判据失效就拒绝出表(不得静默出一张缺半的表)', threw)
  const pats = dispatchPatterns('citations')
  t('④ 分派位模式必须是 POSIX ERE(出现 (?: 即 git 端 fatal)', !pats.some(([, p]) => p.includes('(?:')))
  t('⑤ compare 一支必须同时覆盖 === 与线格式 event:', pats[2][1].includes('event:'))
  t('⑥ 判不出不得被吞成"没有"', classifyCell({ dispatchProd: [], dispatchAll: [], quotedProd: 3, sample: '' }).state === 'undetermined')
  t('⑦ 无字面量才允许写 —', classifyCell({ dispatchProd: [], dispatchAll: [], quotedProd: 0, sample: '' }).state === 'absent')
  t('⑧ 命中全在测试面 ⇒ 单列 testOnly(这是"造好没装车"那一型)', classifyCell({ dispatchProd: [], dispatchAll: [{ line: 'HEAD:apps/web/x.test.ts:1', kind: 'switch' }], quotedProd: 0, sample: '' }).state === 'testOnly')
  t('⑨ 有生产面分派位 ⇒ wired 并带上分派形态', classifyCell({ dispatchProd: [{ kind: 'table', at: 'apps/miniapp-taro/src/api/index.ts:436' }], dispatchAll: [], quotedProd: 0, sample: '' }).state === 'wired')
  const md = render({ frames: ['chunk'], cells: [[classifyCell({ dispatchProd: [{ kind: 'switch', at: 'a:1' }], dispatchAll: [], quotedProd: 0, sample: '' }), classifyCell({ dispatchProd: [], dispatchAll: [], quotedProd: 0, sample: '' }), classifyCell({ dispatchProd: [], dispatchAll: [], quotedProd: 2, sample: '' })]], counts: { ts: 1, py: 1 } }, 'scripts/benchmark-frame-end-matrix.mjs')
  t('⑩ 渲染必须把三态都写进正文(不得只给颜色)', md.includes('有·switch') && md.includes('判不出(字面量 2 处') && md.includes('无字面量'))
  t('⑪ 必须显式声明"本机不下已实测结论"', md.includes('一律不下"已实测"结论'))
  console.log(`✅ ${pass.length} 条 / ❌ ${fail.length} 条`)
  for (const f of fail) console.log(`   ❌ ${f}`)
  return fail.length === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes('--help')) {
    console.log('用法:node scripts/benchmark-frame-end-matrix.mjs [--stdout|--self-test]')
    return 0
  }
  if (argv.includes('--self-test')) return selfTest()
  const errors = []
  const built = buildMatrix(makeGrep(errors))
  if (errors.length > 0) {
    console.error(`❌ ${errors.length} 次 git grep 报错 ⇒ 尺子在空转,拒绝出表(首个:${errors[0]})`)
    return 1
  }
  const md = render(built, 'scripts/benchmark-frame-end-matrix.mjs')
  if (argv.includes('--stdout')) {
    process.stdout.write(md)
    return 0
  }
  const abs = join(ROOT, OUT_REL)
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, md, 'utf8')
  // AGENTS §5c:产出被跟踪文件后由生成器自己注入水印(否则"重新生成一次"就把溯源横幅洗掉,
  // 而覆盖率门禁是自愈式的,会替生成器擦屁股 —— 于是这条纪律在提交链上永远不响)。
  // 幂等判据:同一份输入连续生成两次,文件的 git hash 必须不变。
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'watermark.mjs'), 'inject', abs], {
    cwd: ROOT,
    stdio: 'pipe',
    windowsHide: true,
    timeout: 120000,
  })
  console.log(`已写 ${OUT_REL}:帧 ${built.frames.length} 名 × 端 ${ENDS.length} 列(TS ${built.counts.ts} / py ${built.counts.py})`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}`)
    process.exit(1)
  }
}

// §22d:__test__ 的 export 必须在入口守卫之后(位置本身是判据,镜像测试 T2 钉着)。
export const __test__ = { ENDS, OUT_REL, parseTsNames, parsePyNames, dispatchPatterns, classifyCell, buildMatrix, render, isTestLine, selfTest }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
