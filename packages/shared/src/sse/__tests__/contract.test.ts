// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSE 事件契约单一事实源测试(#25,2026-09-16 立)
 *
 * 覆盖:
 * 1. SSE_EVENTS 事件名集合完整性(现读 30 个:2026-09-19 补录 fallback/usage/steer/budget、
 *    删 repair/resumed 孤儿事件;V3 #48/#58 补 terminal_delta/start/tool-approval;
 *    D113 补 tool-delta;V3 #63 补 form_request)与无重复
 * 2. SSE_EVENT_NAMES 派生一致性
 * 3. isSSEEventName 类型守卫
 * 4. 判别联合 SSEEventPayload 与事件名映射的全量对齐(编译期穷尽性 + 运行时抽样)
 * 5. #25 补录的 3 个漂移事件(plan_updated/terminal_start/terminal_end)
 * 6. 2026-09-19 补录 3 个:usage(D1 消息级计量)/ steer(中途引导)/ fallback(模型降级)
 */

import { readFileSync, readdirSync, existsSync, type Dirent } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'
import {
  SSE_EVENTS,
  SSE_EVENT_NAMES,
  FORM_FRAME_EVENTS,
  isSSEEventName,
  type SSEEventPayload,
  type SSEEventName,
} from '../contract'

// ============ 1. 事件名集合完整性 ============

describe('SSE_EVENTS 事件名集合', () => {
  it('包含全部 32 个契约事件(V3 #48/#58:26 - token + terminal_delta + start + tool-approval;D113: + tool-delta;V3 #63: + form_request;D151: + terminal_interaction;D152: + goal_updated)', () => {
    expect(Object.keys(SSE_EVENTS)).toHaveLength(32)
    expect(SSE_EVENT_NAMES).toHaveLength(32)
    // 光有计数会放过"删了别的、加了这个",新帧必须点名在位:
    expect(SSE_EVENTS.TERMINAL_INTERACTION).toBe('terminal_interaction')
    // D152(2026-09-29):目标状态单帧(cleared 由 status 承载,无 goal_cleared 第二帧)
    expect(SSE_EVENTS.GOAL_UPDATED).toBe('goal_updated')
    expect(SSE_EVENT_NAMES as readonly string[]).not.toContain('goal_cleared')
  })

  // V3 #63(2026-09-27 落地生产者):form_request 按 contract.ts 自己写在
  // FORM_FRAME_EVENTS 注释③(c) 的指令并回 SSE_EVENTS。**form_response 必须仍在射程外**
  // —— 它是上行 POST 的 body,列进 SSE_EVENTS 会让「前端监听对账」把一次 POST
  // 当成 SSE 监听去要后端 SSE 生产点(判据与语义互咬),且 Python 侧集合里也没有它。
  it('form_request 已并入契约;form_response 仍是上行帧、不入 SSE_EVENTS', () => {
    expect(SSE_EVENTS.FORM_REQUEST).toBe('form_request')
    expect(SSE_EVENT_NAMES as readonly string[]).toContain('form_request')
    expect(SSE_EVENT_NAMES as readonly string[]).not.toContain('form_response')
    // 两处名字必须是同一个字面量(并回后不得留第二份真相)
    expect(FORM_FRAME_EVENTS.REQUEST).toBe(SSE_EVENTS.FORM_REQUEST)
  })

  // D34(2026-09-22,G-40/G-44):运行环境交代两帧。
  // 事件名为我方协议自定;实证部分是字段形状(kind 八枚举 / collapsed+全文 /
  // attempt+maxRetries+retryInMs+httpStatus)。第 36 轮收回曾多加的
  // settings_applied(无服务端触发点)与 terminal_output(与 terminal_end 重复)。
  it('包含 D34 补录的 2 个运行环境交代事件', () => {
    expect(SSE_EVENTS.INJECTION_APPLIED).toBe('injection_applied')
    expect(SSE_EVENTS.RETRY_SCHEDULED).toBe('retry_scheduled')
  })

  it('值无重复(事件判别名唯一)', () => {
    const values = Object.values(SSE_EVENTS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('包含 #25 补录的 3 个对话流漂移事件', () => {
    expect(SSE_EVENTS.PLAN_UPDATED).toBe('plan_updated')
    expect(SSE_EVENTS.TERMINAL_START).toBe('terminal_start')
    expect(SSE_EVENTS.TERMINAL_END).toBe('terminal_end')
  })

  it('包含 2026-09-19 新增的 budget(网关预算档位提醒)', () => {
    expect(SSE_EVENTS.BUDGET).toBe('budget')
  })

  it('核心流式事件在位', () => {
    expect(SSE_EVENTS.CHUNK).toBe('chunk')
    expect(SSE_EVENTS.REASONING).toBe('reasoning')
    expect(SSE_EVENTS.TOOL_CALL_START).toBe('tool-call-start')
    expect(SSE_EVENTS.TOOL_RESULT).toBe('tool-result')
    expect(SSE_EVENTS.SUBAGENT_SPAWN).toBe('subagent_spawn')
    expect(SSE_EVENTS.PLAN_STEP).toBe('plan-step')
    expect(SSE_EVENTS.DONE).toBe('done')
    expect(SSE_EVENTS.ERROR).toBe('error')
    expect(SSE_EVENTS.COMPACTION).toBe('compaction')
    expect(SSE_EVENTS.THINKING).toBe('thinking')
  })
})

// ============ 2. 派生一致性 ============

describe('SSE_EVENT_NAMES 派生', () => {
  it('与 SSE_EVENTS 值集合一致', () => {
    expect([...SSE_EVENT_NAMES].sort()).toEqual([...Object.values(SSE_EVENTS)].sort())
  })
})

// ============ 3. 类型守卫 ============

describe('isSSEEventName', () => {
  it('已知事件名返回 true', () => {
    for (const name of SSE_EVENT_NAMES) {
      expect(isSSEEventName(name)).toBe(true)
    }
  })

  it('未知事件名返回 false', () => {
    expect(isSSEEventName('unknown-event')).toBe(false)
    expect(isSSEEventName('')).toBe(false)
    expect(isSSEEventName('CHUNK')).toBe(false)
  })
})

// ============ 4. 判别联合对齐 ============

/**
 * 这张表只证明两件事:键集与 SSE_EVENTS 一致(Record<keyof typeof SSE_EVENTS, …> 要求穷尽),
 * 以及映射值是合法事件名。**它不检查判别联合里有没有对应成员** —— 所以新增事件名而漏写
 * payload 类型时,这一段连同它原先的注释("新增事件漏写 payload 类型时此处编译报错")一起恒绿。
 * 真·穷尽性在下面 UNION_MEMBER_BY_NAME,由 2026-09-28 D132 那票补上。
 */
const PAYLOAD_TYPE_BY_KEY: Record<keyof typeof SSE_EVENTS, SSEEventName> = {
  CHUNK: 'chunk',
  REASONING: 'reasoning',
  TOOL_CALL_START: 'tool-call-start',
  TOOL_RESULT: 'tool-result',
  TOOL_DELEGATE: 'tool-delegate',
  TOOL_SUMMARY: 'tool-summary',
  CITATIONS: 'citations',
  QUESTION: 'question',
  SUBAGENT_SPAWN: 'subagent_spawn',
  SUBAGENT_PROGRESS: 'subagent_progress',
  SUBAGENT_END: 'subagent_end',
  PLAN_STEP: 'plan-step',
  THINKING: 'thinking',
  PLAN_UPDATED: 'plan_updated',
  TERMINAL_START: 'terminal_start',
  TERMINAL_END: 'terminal_end',
  // V3 #48(2026-09-26)补登:终端逐行增量 / agent 流执行开始
  TERMINAL_DELTA: 'terminal_delta',
  // D151(2026-09-29):命令在等键盘输入的一帧
  TERMINAL_INTERACTION: 'terminal_interaction',
  START: 'start',
  // V3 #58(2026-09-26):主聊天流工具审批帧
  TOOL_APPROVAL: 'tool-approval',
  // D113(2026-09-27,G-227):文件写类工具流中 diff 预览帧
  TOOL_DELTA: 'tool-delta',
  // V3 #63(2026-09-27 落地生产者后并回契约):对话流业务表单下行帧。
  // 上行那一条 form_response **不在这里**(它不是 SSE 事件,见 contract.ts 第 3 条)。
  FORM_REQUEST: 'form_request',
  // D152(2026-09-29):会话目标状态的下行帧(单帧,cleared 由 status 承载)
  GOAL_UPDATED: 'goal_updated',
  DONE: 'done',
  ERROR: 'error',
  COMPACTION: 'compaction',
  // 2026-09-19 补录 3 个(此前入契约未同步本映射,编译期穷尽性检查已拦截):
  // usage(D1 消息级计量)/ steer(中途引导注入确认)/ fallback(模型降级通知)
  USAGE: 'usage',
  STEER: 'steer',
  FALLBACK: 'fallback',
  // 2026-09-19 立:网关预算档位提醒(流首软提醒,80%~95% warning / 95%~100% critical)
  BUDGET: 'budget',
  INJECTION_APPLIED: 'injection_applied',
  RETRY_SCHEDULED: 'retry_scheduled',
}

/**
 * 真·穷尽性(2026-09-28 立,承 D132)。两个方向都有牙:
 *  - **漏一名**:判别联合里没有 `type: 'usage'` 这一成员时,该值不在
 *    `SSEEventPayload['type']` 的值域内 ⇒ `pnpm --filter @ihui/shared typecheck` 直接红;
 *    键写漏同理(`Record<SSEEventName, …>` 要求键穷尽)。
 *  - **值写错**:下面那条运行时断言红(把任一值改成别的名字即可复现,这是本断言的反向对照)。
 * 上一段那张表管不住第一种,它只保证"映射值 ∈ 事件名集"。
 */
const UNION_MEMBER_BY_NAME: Record<SSEEventName, SSEEventPayload['type']> = {
  budget: 'budget',
  chunk: 'chunk',
  citations: 'citations',
  compaction: 'compaction',
  done: 'done',
  error: 'error',
  fallback: 'fallback',
  form_request: 'form_request',
  injection_applied: 'injection_applied',
  'plan-step': 'plan-step',
  plan_updated: 'plan_updated',
  question: 'question',
  reasoning: 'reasoning',
  retry_scheduled: 'retry_scheduled',
  start: 'start',
  steer: 'steer',
  subagent_end: 'subagent_end',
  subagent_progress: 'subagent_progress',
  subagent_spawn: 'subagent_spawn',
  terminal_delta: 'terminal_delta',
  // D151(2026-09-29):命令在等键盘输入的一帧(判别联合成员见 contract.ts)
  terminal_interaction: 'terminal_interaction',
  // D152(2026-09-29):会话目标状态帧(判别联合成员见 contract.ts)
  goal_updated: 'goal_updated',
  terminal_end: 'terminal_end',
  terminal_start: 'terminal_start',
  thinking: 'thinking',
  'tool-approval': 'tool-approval',
  'tool-call-start': 'tool-call-start',
  'tool-delegate': 'tool-delegate',
  'tool-delta': 'tool-delta',
  'tool-result': 'tool-result',
  'tool-summary': 'tool-summary',
  usage: 'usage',
}

describe('SSEEventPayload 判别联合对齐', () => {
  it('每个事件名都必须在判别联合里有成员(键数对齐 + 逐名同值)', () => {
    expect(Object.keys(UNION_MEMBER_BY_NAME)).toHaveLength(SSE_EVENT_NAMES.length)
    for (const [name, member] of Object.entries(UNION_MEMBER_BY_NAME)) {
      expect(member).toBe(name)
    }
  })

  it('键→事件名映射与 SSE_EVENTS 值一致(编译期穷尽 + 运行时校验)', () => {
    for (const [key, name] of Object.entries(PAYLOAD_TYPE_BY_KEY)) {
      expect(SSE_EVENTS[key as keyof typeof SSE_EVENTS]).toBe(name)
    }
  })

  it('判别联合成员的 type 抽样可赋值(payload 类型收紧不回归)', () => {
    const samples: SSEEventPayload[] = [
      { type: 'chunk', content: 'hello' },
      {
        type: 'plan_updated',
        plan: [{ step: 's1', status: 'done', durationMs: 12 }],
        explanation: 'e',
        timestamp: 't',
      },
      {
        type: 'terminal_start',
        terminalId: 't1',
        command: 'ls',
        status: 'running',
        startedAt: 'now',
      },
      {
        type: 'terminal_end',
        terminalId: 't1',
        status: 'completed',
        endedAt: 'now',
        durationMs: 100,
        output: 'ok',
        exitCode: 0,
      },
      { type: 'error', message: 'boom', errorCode: 'E1' },
      // P1 #27(2026-09-16 立):done 事件携带 memoryUpdates(已记住提示条数据源)
      { type: 'done', model: 'm', stub: false, memoryUpdates: ['用户偏好 TypeScript'] },
      // Steer(2026-09-19 立):中途引导注入确认(tool loop 边界注入 messages 后下发)
      { type: 'steer', phase: 'injected', text: '换个思路,先看配置文件' },
      // Fallback(P4-2,2026-09-19 入契约):主模型失败切换备用模型通知
      {
        type: 'fallback',
        primary_model: 'gemini-2.0',
        backup_model: 'step-router-v1',
        reason: 'timeout',
      },
    ]
    expect(samples).toHaveLength(8)
  })
})

// ============================================================================
// G-816035:tool-delta 载荷语义(累积式)三处对账
// ============================================================================
//
// 立票原委(AGENTS §22c 点名的"注释与实现分叉"型):`contract.ts` 的 tool-delta 声明段此前写的是
// "本次增量的正文(不是全量)" + "乱序/重传由消费端按 seq 收敛",而生产端
// (`apps/ai-service/app/routers/llm.py::_file_edit_preview_frames`,每帧 `kept[:i+N]` = 从头到当前的
// 整段)与六个消费端(web `createToolDeltaHandler` / extension / miniapp / RN 的 `applyToolDelta` +
// api-client 与 shared 两条解析腿)**一律按累积文本整帧覆盖**。
// 要紧的是:覆盖式写入只在累积语义下安全 —— 谁照旧注释改成增量,各端**静默丢正文**而不报错、
// 不红任何 typecheck(本仓"判据失效的表现永远是安静"那一族)。
//
// 三条锁各自独立;③ 是"明写它仍判不出来"的那一半 —— 跨语言 parity 门
// `scripts/check-agent-event-parity.mjs` 只提**事件名**,对本帧载荷语义零判据,所以不得把 parity 绿
// 读成语义一致。取材一律走文件本身(与守门 98 D4 的源码锁同形态);本段**不 import 任何被测实现的
// 判定函数**:"契约注释该写什么"在实现里没有第二份可复用判据,这里必须是独立 oracle(§22c)。

const REPO_ROOT = (() => {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('上溯 8 层找不到 pnpm-workspace.yaml ⇒ 被审面取不到,本组用例不得当成通过')
})()

/** 取被审面文本;取不到一律抛(把"没跑到"写成"没违规"是本仓最高频的假绿)。 */
function readRepoText(rel: string): string {
  try {
    return readFileSync(join(REPO_ROOT, rel), 'utf8')
  } catch {
    throw new Error(`取不到 ${rel}(被审面缺件)⇒ 这条锁根本没跑到,不得记为通过`)
  }
}

const CONTRACT_REL = 'packages/shared/src/sse/contract.ts'
const TOOL_DELTA_ANCHOR = '文件写类工具的流中 diff 预览'

/** 截出 tool-delta 的注释段 + 成员体(注释与类型必须同段核,分两处核就会各漂各的)。 */
function toolDeltaSection(src: string): string {
  const start = src.indexOf(TOOL_DELTA_ANCHOR)
  if (start < 0)
    throw new Error(`${CONTRACT_REL} 里找不到 tool-delta 声明段 ⇒ 判据没跑到,不得当成通过`)
  const end = src.indexOf('\n    }>', start)
  if (end < 0) throw new Error('tool-delta 声明段闭合形态认不出(结构漂开)⇒ 判据没跑到,不得当成通过')
  return src.slice(start, end)
}

/** 禁止再出现的"增量"措辞(逐字取自被改掉的那份旧文本,不是模糊匹配 —— 模糊匹配会把未来的合法措辞一起打死)。 */
const INCREMENTAL_PHRASES = ['不是全量', '本次增量的正文'] as const

function contractSemanticsProblems(section: string): string[] {
  const problems: string[] = []
  if (!section.includes('累积式')) problems.push('未写"累积式"')
  for (const phrase of INCREMENTAL_PHRASES) {
    if (section.includes(phrase)) problems.push(`仍含增量措辞"${phrase}"`)
  }
  if (!section.includes('不参与')) problems.push('未点明 seq 当前不参与判定')
  if (!section.includes('check-agent-event-parity')) problems.push('未明写 parity 门判不出这一维')
  return problems
}

interface PreviewFrame {
  partialText: string
  truncated?: boolean
}
interface PreviewCase {
  id: string
  expected?: { frames?: PreviewFrame[] }
}

/**
 * 生产端事实:跨语言台账 `file-edit-preview-cases.json` 的 `expected.frames` 由 llm.py 真实输出写入
 * (其 `$comment` 自述"不得手工编辑 expected 让某一侧变绿")。累积式 ⇔ 每一帧以上一帧为前缀。
 * 判据用**前缀关系**而不是复算切帧:复算就是实现自己的复读机。
 */
function nonCumulativeFrames(cases: PreviewCase[]): string[] {
  const problems: string[] = []
  let multiFrameCases = 0
  for (const c of cases) {
    const frames = c.expected?.frames ?? []
    if (frames.length < 2) continue
    multiFrameCases += 1
    for (let i = 1; i < frames.length; i += 1) {
      const prev = frames[i - 1]?.partialText
      const cur = frames[i]?.partialText
      if (typeof prev !== 'string' || typeof cur !== 'string') {
        // 判不出 ≠ 通过:前缀关系量不到时点名,不静默计成"累积式"
        problems.push(`${c.id}: 第 ${i + 1} 帧缺 partialText ⇒ 累积与否判不出,不得当成通过`)
        continue
      }
      if (!cur.startsWith(prev)) {
        problems.push(`${c.id}: 第 ${i + 1} 帧不以第 ${i} 帧为前缀 ⇒ 生产端不是累积式`)
      }
    }
  }
  if (multiFrameCases === 0) problems.push('台账里没有多帧用例 ⇒ 这条锁根本没跑到')
  return problems
}

const CONSUMER_SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '__tests__',
  'tests',
  'e2e',
  '.ihui-agent',
  'tmp',
  'output',
  'outputs',
])

/** 生产面(非测试面)的 TS 源码;测试面刻意排除 —— 那里的反例文本不是仓库里的接线形态。 */
function walkSourceFiles(relDir: string, depth: number, out: string[]): void {
  if (depth > 12) return
  let entries: Dirent[]
  try {
    entries = readdirSync(join(REPO_ROOT, relDir), { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue
    const rel = `${relDir}/${e.name}`
    if (e.isDirectory()) {
      if (!CONSUMER_SKIP_DIRS.has(e.name)) walkSourceFiles(rel, depth + 1, out)
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      out.push(rel)
    }
  }
}

/** "把新帧当增量拼接"的书写形态(覆盖写 `partialDiff: evt.partialText` 不在其列)。 */
const INCREMENTAL_WRITE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\+=\s*[A-Za-z_$][\w$.]*\.partialText\b/, '新帧 partialText 被 += 追加到已有正文'],
  [/\bpartialText\b\s*\+=/, 'partialText 自身被 += 改写'],
  [
    /\bpartial(?:Diff|Text)\s*:\s*[^;\n]*\+[^;\n]*partialText/,
    '以 + 拼接 partialText 后落到覆盖字段',
  ],
  [/\bpartial(?:Diff|Text)\b[^\n]{0,40}\.concat\(/, 'partialDiff/partialText 走 concat 拼接'],
]

function incrementalWriteProblems(rel: string, text: string): string[] {
  return INCREMENTAL_WRITE_PATTERNS.filter(([re]) => re.test(text)).map(
    ([, msg]) => `${rel}: ${msg}`,
  )
}

describe('G-816035 tool-delta 载荷语义 = 累积式(三处对账)', () => {
  it('① 契约注释必须写"累积式整帧替换"、不得留旧增量措辞、并明写 parity 判不出', () => {
    expect(contractSemanticsProblems(toolDeltaSection(readRepoText(CONTRACT_REL)))).toEqual([])
  })

  it('① 阳性对照:旧那份"增量/不是全量"的注释形态喂同一判据必须红(否则本条锁是恒绿的)', () => {
    const legacy = [
      '// 文件写类工具的流中 diff 预览增量帧',
      '/** 同一 toolCallId 内的递增序号(乱序/重传由消费端按 seq 收敛) */',
      '/** 本次增量的正文(不是全量) */',
      'partialText: string',
    ].join('\n')
    const problems = contractSemanticsProblems(legacy)
    expect(problems.length).toBeGreaterThan(0)
    // 点名到具体哪几条:只要求"非空"会放过"因为别的偶然原因红"的退化
    expect(problems.join('|')).toContain('未写"累积式"')
    expect(problems.join('|')).toContain('不是全量')
  })

  it('①b 生产端事实同向:跨语言台账每一帧都以上一帧为前缀(累积式)', () => {
    const fixture = JSON.parse(
      readRepoText('apps/ai-service/tests/fixtures/file-edit-preview-cases.json'),
    ) as { cases: PreviewCase[] }
    expect(nonCumulativeFrames(fixture.cases)).toEqual([])
  })

  it('①b 正反对照:增量形态必红、单帧台账必须被认成"这条锁没跑到"', () => {
    expect(
      nonCumulativeFrames([
        { id: 'fake-delta', expected: { frames: [{ partialText: 'l0' }, { partialText: 'l1' }] } },
      ]).length,
    ).toBeGreaterThan(0)
    expect(
      nonCumulativeFrames([
        {
          id: 'fake-prefix',
          expected: { frames: [{ partialText: 'l0' }, { partialText: 'l0\nl1' }] },
        },
      ]),
    ).toEqual([])
    // 单帧用例给不出"累积 vs 增量"的任何信息 ⇒ 必须喊"没跑到",不得静默返回 [] 冒充通过
    expect(
      nonCumulativeFrames([{ id: 'only-one', expected: { frames: [{ partialText: 'l0' }] } }]),
    ).toEqual([expect.stringContaining('没有多帧用例')])
  })

  it('② 反向锁:生产面任何接 tool-delta 的端都不许把 partialText 当增量拼接', () => {
    // 已知局限(与守门 117 那条同型):本锁扫的是**工作树副本**,而工作树常年有他人未提交的在飞文件
    // ⇒ 这一条红可能点名别人正在写的文件。那种红归属他人,不得由本包持有人去改别人的文件,
    // 也不得为让它变绿而放宽判据(本仓 §12/§12e 同一条禁令)。
    const files: string[] = []
    walkSourceFiles('apps', 0, files)
    walkSourceFiles('packages', 0, files)
    const consumers = files.filter((rel) => readRepoText(rel).includes('partialText'))
    // 覆盖面自证:扫到 0~2 个含 partialText 的生产面文件,读起来与"都没违规"一模一样
    expect(consumers.length).toBeGreaterThanOrEqual(3)
    const problems = consumers.flatMap((rel) => incrementalWriteProblems(rel, readRepoText(rel)))
    expect(problems).toEqual([])
  })

  it('② 阳性对照 + 反向对照:拼接写法必被抓,整帧覆盖的真实形态不得被计债', () => {
    expect(
      incrementalWriteProblems('fake.ts', '{ ...c, partialDiff: c.partialDiff + evt.partialText }')
        .length,
    ).toBeGreaterThan(0)
    expect(incrementalWriteProblems('fake.ts', 'acc += evt.partialText').length).toBeGreaterThan(0)
    expect(incrementalWriteProblems('real.ts', '{ ...c, partialDiff: evt.partialText }')).toEqual(
      [],
    )
    expect(incrementalWriteProblems('real.ts', 'partialText: string }).strict()')).toEqual([])
  })

  it('③ 明写边界:跨语言 parity 门对本帧载荷语义零判据(它开始判这一维时本条必须红,并同步改掉 contract.ts 的免责声明)', () => {
    const gate = readRepoText('scripts/check-agent-event-parity.mjs')
    expect(
      gate.includes('partialText'),
      'parity 门已认识 partialText ⇒ 请把 contract.ts 的"判不出"声明改掉',
    ).toBe(false)
    expect(
      gate.includes('tool-delta'),
      'parity 门已点名 tool-delta ⇒ 请把 contract.ts 的"判不出"声明改掉',
    ).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
