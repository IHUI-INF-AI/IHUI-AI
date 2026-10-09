// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D135(承 V4 #93)可执行验收:折叠出口等值 + 屏侧接线 + 台账配套。
// 与未入库的 chat-stream-execution-wiring.test.ts 同判据面,但修掉两处硬伤:
//   ① 台账路径少一级(../../scripts → 实际在仓库根 scripts/,从本目录起须 ../../../);
//   ② 台账正向对照里 toContain('onToolApproval') 是"本票只接 6 帧"旧口径的陈旧断言 ——
//      本票按票面把 23 个全接了,台账同票删条目(G-978066 登记行明文 prescribed),
//      故这里改为正向断言"已接帧名一律不在 missing 里"。
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PlanUpdateEvent, ToolCallEvent, ToolDeltaEvent } from '@ihui/api-client'
import {
  applyAssistantExecutionFrame,
  applyToolCallEvent,
  applyToolDelta,
  applyPlanUpdate,
  type AssistantExecutionFrame,
  type AssistantExecutionViz,
  type ToolCallItem,
} from '../src/utils/chat-render-model'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCREEN_SOURCE = readFileSync(join(HERE, '../src/screens/ChatScreen.tsx'), 'utf8')
const N8N_SOURCE = readFileSync(join(HERE, '../src/screens/AiAssistantN8nScreen.tsx'), 'utf8')
const LEDGER = JSON.parse(
  readFileSync(join(HERE, '../../../scripts/data/sse-dispatch-coverage.json'), 'utf8'),
) as { missing: Record<string, Record<string, unknown>> }

function foldAll(
  frames: readonly AssistantExecutionFrame[],
  nowMs = 1_700_000_000_000,
): AssistantExecutionViz {
  let viz: AssistantExecutionViz | undefined
  for (const frame of frames) viz = applyAssistantExecutionFrame(viz, frame, nowMs)
  return viz ?? {}
}

const startFrame = (toolCallId: string, toolName = 'write_file'): ToolCallEvent =>
  ({
    type: 'tool-call-start',
    toolCallId,
    toolName,
    args: { path: 'a.ts' },
  }) as ToolCallEvent

const resultFrame = (toolCallId: string, toolName = 'write_file'): ToolCallEvent =>
  ({
    type: 'tool-result',
    toolCallId,
    toolName,
    isError: false,
    result: { ok: true },
  }) as ToolCallEvent

const planFrame = (steps: Array<{ step: string; status: string }>): PlanUpdateEvent =>
  ({ plan: steps, explanation: '先读再写' }) as unknown as PlanUpdateEvent

describe('applyAssistantExecutionFrame(D135 折叠档:纯函数 + 穷尽判别式)', () => {
  it('tool-call-start → running;同 id 的 tool-result → success 且耗时算得出来', () => {
    const viz = foldAll([
      { kind: 'tool-call', event: startFrame('c1') },
      { kind: 'tool-call', event: resultFrame('c1') },
    ])
    expect(viz.toolCalls?.map((c) => c.status)).toEqual(['success'])
    expect(viz.toolCalls?.[0]?.name).toBe('write_file')
    expect(viz.toolCalls?.[0]?.durationMs).toBe(0)
  })

  it('一轮三个工具调用 ⇒ 三行,顺序 = 首现序(票面验收点名的那一轮)', () => {
    const viz = foldAll([
      { kind: 'tool-call', event: startFrame('c1', 'read_file') },
      { kind: 'tool-call', event: startFrame('c2', 'write_file') },
      { kind: 'tool-call', event: resultFrame('c1', 'read_file') },
      { kind: 'tool-call', event: startFrame('c3', 'run_command') },
    ])
    expect(viz.toolCalls?.map((c) => [c.id, c.status])).toEqual([
      ['c1', 'success'],
      ['c2', 'running'],
      ['c3', 'running'],
    ])
  })

  it('tool-delta 覆盖写 partialDiff;tool-result 到达即清(最终 diff 以 result 为准)', () => {
    const first = foldAll([
      { kind: 'tool-call', event: startFrame('c1') },
      { kind: 'tool-delta', event: { toolCallId: 'c1', partialText: '+a' } as ToolDeltaEvent },
    ])
    expect(first.toolCalls?.[0]?.partialDiff).toBe('+a')
    const next = applyAssistantExecutionFrame(first, {
      kind: 'tool-delta',
      event: { toolCallId: 'c1', partialText: '+a\n+b' } as ToolDeltaEvent,
    })
    expect(next.toolCalls?.[0]?.partialDiff).toBe('+a\n+b')
    const done = applyAssistantExecutionFrame(next, { kind: 'tool-call', event: resultFrame('c1') })
    expect(done.toolCalls?.[0]?.partialDiff).toBeUndefined()
    expect(done.toolCalls?.[0]?.status).toBe('success')
  })

  it('plan-update 是权威快照 ⇒ 整体替换,不追加;载荷没给 explanation 就不沿用旧的', () => {
    const merged = foldAll([
      { kind: 'plan-update', event: planFrame([{ step: 's1', status: 'pending' }]) },
      { kind: 'plan-update', event: planFrame([{ step: 'x', status: 'in_progress' }]) },
    ])
    expect(merged.planSteps?.map((s) => s.step)).toEqual(['x'])
    expect(merged.planExplanation).toBe('先读再写')
    const bare = applyAssistantExecutionFrame(merged, {
      kind: 'plan-update',
      event: { plan: [{ step: 'y', status: 'completed' }] } as unknown as PlanUpdateEvent,
    })
    expect(bare.planExplanation).toBeUndefined()
    expect(bare.planSteps?.map((s) => s.step)).toEqual(['y'])
  })

  it('纯函数:不改入参;tool 帧与 plan 帧各写各的键,互不覆盖', () => {
    const base = foldAll([{ kind: 'tool-call', event: startFrame('c1') }])
    const frozen = JSON.parse(JSON.stringify(base)) as AssistantExecutionViz
    const afterPlan = applyAssistantExecutionFrame(base, {
      kind: 'plan-update',
      event: planFrame([{ step: 's1', status: 'pending' }]),
    })
    expect(JSON.parse(JSON.stringify(base))).toEqual(frozen)
    expect(afterPlan.toolCalls).toEqual(base.toolCalls)
    expect(afterPlan.planSteps).toHaveLength(1)
  })

  it('反向对照:没折帧就是空档;start 未到的 delta 不凭空造条目', () => {
    expect(foldAll([])).toEqual({})
    const untouched = applyAssistantExecutionFrame(undefined, {
      kind: 'tool-delta',
      event: { toolCallId: 'ghost', partialText: 'x' } as ToolDeltaEvent,
    })
    expect(untouched.toolCalls ?? []).toEqual([])
  })

  it('terminal start/end 也走同一出口:start 建 running,end 收终态', () => {
    const viz = foldAll([
      {
        kind: 'terminal-start',
        event: { type: 'terminal_start', terminalId: 't1', command: 'ls -la', status: 'running' },
      } as AssistantExecutionFrame,
      {
        kind: 'terminal-end',
        event: { type: 'terminal_end', terminalId: 't1', status: 'completed', exitCode: 0 },
      } as AssistantExecutionFrame,
    ])
    expect(viz.terminalTasks?.map((t) => [t.id, t.status, t.exitCode])).toEqual([
      ['t1', 'completed', 0],
    ])
  })

  it('出口配对:这一层只做组合 —— reducer 仍是唯一实现,结果逐字等值', () => {
    const event = startFrame('c9')
    const viaSeam = foldAll([{ kind: 'tool-call', event }], 1000)
    const viaReducer: ToolCallItem[] = applyToolCallEvent(undefined, event, 1000)
    expect(viaSeam.toolCalls).toEqual(viaReducer)

    const viaDelta = foldAll(
      [
        { kind: 'tool-call', event },
        { kind: 'tool-delta', event: { toolCallId: 'c9', partialText: 'z' } as ToolDeltaEvent },
      ],
      1000,
    )
    expect(viaDelta.toolCalls).toEqual(
      applyToolDelta(applyToolCallEvent(undefined, event, 1000), {
        toolCallId: 'c9',
        partialText: 'z',
      }),
    )

    const plan = planFrame([{ step: 'p', status: 'pending' }])
    expect(foldAll([{ kind: 'plan-update', event: plan }]).planSteps).toEqual(
      applyPlanUpdate(plan).steps,
    )
  })
})

describe('ChatScreen 屏侧接线(源码级,23 缺口逐名在回调表)', () => {
  const streamChatBlock = streamChatBlockOf(SCREEN_SOURCE)

  const registered = (name: string): boolean =>
    new RegExp(`^\\s{6}${name}:`, 'm').test(streamChatBlock)

  const MISSING_23 = [
    'onToolCall',
    'onToolDelta',
    'onToolSummary',
    'onToolApproval',
    'onToolDelegate',
    'onPlanUpdate',
    'onTerminalStart',
    'onTerminalDelta',
    'onTerminalEnd',
    'onSubagentSpawn',
    'onSubagentProgress',
    'onSubagentEnd',
    'onUsage',
    'onBudget',
    'onCompaction',
    'onFallback',
    'onRetryScheduled',
    'onQuestion',
    'onFormRequest',
    'onReconnect',
    'onResponse',
    'onAgentDelta',
    'onMemoryUpdates',
  ] as const

  for (const name of MISSING_23) {
    it(`${name} 在 streamChat 回调表里(不是只在注释里被提到)`, () => {
      expect(registered(name)).toBe(true)
    })
  }

  it('三类帧都折进同一个出口,屏内没有第二份折叠实现', () => {
    expect(SCREEN_SOURCE).toMatch(
      /applyAssistantExecutionFrame\(\s*prev\[turnAssistantId\],\s*frame,?\s*\)/,
    )
    expect(SCREEN_SOURCE).not.toMatch(/toolCalls:\s*\w+\.toolCalls\??\.map\(/)
    expect(SCREEN_SOURCE).not.toMatch(/partialDiff:\s*event\.partialText/)
  })

  it('折叠键在 send() 里就锁到本轮那条 assistant 消息(不在回调里现算"最后一条")', () => {
    expect(SCREEN_SOURCE).toMatch(/const turnAssistantId = aiMsg\.id/)
  })

  it('接了就得有人读:TaskStatusBar 挂在本屏(import + JSX 三条各一条)', () => {
    expect(SCREEN_SOURCE).toMatch(
      /import \{ TaskStatusBar \} from '\.\.\/components\/ai\/TaskStatusBar'/,
    )
    expect(SCREEN_SOURCE).toMatch(
      /<TaskStatusBar[\s\S]{0,240}?planSteps=\{planViz\?\.planSteps \?\? \[\]\}/,
    )
    expect(SCREEN_SOURCE).toMatch(/toolCalls=\{planViz\?\.toolCalls\}/)
    expect(SCREEN_SOURCE).toMatch(/isStreaming=\{isStreaming\}/)
  })

  it('跨端取数口径不新立:沿用 web / N8n 那条"最后一条带 planSteps 的 assistant 消息"', () => {
    expect(SCREEN_SOURCE).toMatch(/if \(\(viz\?\.planSteps\?\.length \?\? 0\) > 0\) return viz/)
  })

  it('历史回放缺口被点名,而不是被读成"已还原"(metadata 映射现在仍是 N8n 屏私有实现)', () => {
    const clears = SCREEN_SOURCE.match(/setExecutionVizById\(\{\}\)/g) ?? []
    expect(clears.length).toBeGreaterThanOrEqual(2)
    expect(SCREEN_SOURCE).toMatch(/历史消息 metadata 里的 toolCalls\/planSteps/)
  })

  it('onToolApproval 交审批队列且组件装车(D136 四点:import/hook/接帧/挂 host)', () => {
    expect(SCREEN_SOURCE).toMatch(
      /import \{ useToolApprovalQueue \} from '\.\.\/components\/ai\/ToolApprovalSheet'/,
    )
    expect(SCREEN_SOURCE).toMatch(/const toolApproval = useToolApprovalQueue\(\)/)
    expect(SCREEN_SOURCE).toContain('{toolApproval.host}')
    expect(SCREEN_SOURCE).toContain('toolApproval.onToolApproval(event)')
  })
})

// D136 三格里留给本屏的那两格之一:立因复跑(改前)`git grep -c 'ToolApproval|toolApproval' HEAD --
// …/AiAssistantN8nScreen.tsx` = 0 ⇒ 这一屏的 streamChat 回调表里根本没有 onToolApproval 这一格,
// 而审批帧在解析层(api-client tryParseToolApproval)是统一投影的 ⇒ 收到询问时屏幕上什么都不发生。
// 判据面与上面 ChatScreen 那节同形(接帧必须在回调表这个对象字面量里),只是属性位缩进多一级(在 try 块内)。
describe('AiAssistantN8nScreen 屏侧接线(D136 四点同一出口,不是第二份队列)', () => {
  const n8nBlock = streamChatBlockOf(N8N_SOURCE)

  it('onToolApproval 在 streamChat 回调表里,回调体把帧交给队列', () => {
    expect(/^\s{8}onToolApproval:/m.test(n8nBlock)).toBe(true)
    expect(n8nBlock).toContain('toolApproval.onToolApproval(event)')
  })

  it('import + hook 调用 + host 装车三处都在(挂 host 用的是共享出口那个 host)', () => {
    expect(N8N_SOURCE).toMatch(
      /import \{ useToolApprovalQueue \} from '\.\.\/components\/ai\/ToolApprovalSheet'/,
    )
    expect(N8N_SOURCE).toMatch(/const toolApproval = useToolApprovalQueue\(\)/)
    expect(N8N_SOURCE).toContain('{toolApproval.host}')
    // 反向锁:本屏不得再写一份队列/解析(票面规则 1 要根治的那一型)
    expect(N8N_SOURCE).not.toMatch(/function useToolApprovalQueue|parseToolApprovalEvent\(/)
  })
})

describe('守门 90 台账配套性(接一帧同票删台账条目 + 抬 baseline)', () => {
  const ledgerMissingMobileRn = Object.keys(LEDGER.missing['mobile-rn'] ?? {})
  const wiredNames = [...streamChatOptionNames(SCREEN_SOURCE)]

  it('本屏接的每一个帧名,都不得是台账里"mobile-rn 未命中"的那一条', () => {
    expect(wiredNames.filter((name) => ledgerMissingMobileRn.includes(name))).toEqual([])
  })

  it('台账确实在管这批名字(空台账会让上一条恒真)', () => {
    expect(ledgerMissingMobileRn.length).toBeGreaterThan(0)
  })
})

/** 括号配平取 `await streamChat({ … })` 整段(行号每次 append 都会挪,不靠行号)。 */
function streamChatBlockOf(source: string): string {
  const start = source.indexOf('await streamChat({')
  if (start < 0) throw new Error('找不到 streamChat 调用点')
  let depth = 0
  let index = source.indexOf('{', start)
  for (; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) break
    }
  }
  return source.slice(start, index + 1)
}

/** streamChat 回调表里的 onXxx 键名(6 空格缩进 = 该对象字面量的属性位) */
function streamChatOptionNames(source: string): string[] {
  return [...streamChatBlockOf(source).matchAll(/^\s{6}(on[A-Z][A-Za-z]+):/gm)].map((m) => m[1]!)
}

describe('reducer 的生产面 importer(票面验收:排除测试面)', () => {
  const SRC = resolve(HERE, '../src')
  const tsFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return tsFiles(full)
      return /\.tsx?$/.test(entry.name) && statSync(full).isFile() ? [full] : []
    })

  const importedNamesFromChatRenderModel = (text: string): Set<string> => {
    const names = new Set<string>()
    for (const match of text.matchAll(
      /import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']*chat-render-model)'/g,
    )) {
      for (const raw of (match[1] ?? '').split(',')) {
        const token = raw
          .replace(/^\s*type\s+/, '')
          .split(/\s+as\s+/)[0]
          ?.trim()
        if (token) names.add(token)
      }
    }
    return names
  }

  const productionFiles = tsFiles(SRC).filter((file) => !file.endsWith('chat-render-model.ts'))

  const importersOf = (symbol: string): string[] =>
    productionFiles.filter((file) =>
      importedNamesFromChatRenderModel(readFileSync(file, 'utf8')).has(symbol),
    )

  it('applyToolCallEvent 在 src/ 有 ≥1 个生产面 importer(不是只有测试面在引)', () => {
    expect(importersOf('applyToolCallEvent').length).toBeGreaterThanOrEqual(1)
  })

  it('折叠出口的生产面 importer 含主聊天屏 ChatScreen(票面点名"主屏零调用方"那一格)', () => {
    const importers = importersOf('applyAssistantExecutionFrame')
    expect(importers.some((file) => file.endsWith('ChatScreen.tsx'))).toBe(true)
  })

  it('注释不得被当成装车:合成一份"只在注释里提到符号"的文本,判定函数必须返回空集', () => {
    // 本屏此刻没有"只提不引"的存量文件(主屏走 seam,不直名 reducer),
    // 这条性质改用合成文本自证:comment-only 的 import 看起来像 import,
    // 但正则要求 import 与 from 同段无行注释隔断 ⇒ 不得计入。
    const commentOnly = [
      '// tool-result 到达由 applyToolCallEvent 清掉(注释里的逐字引用,不算装车)',
      'const x = 1',
    ].join('\n')
    expect(importedNamesFromChatRenderModel(commentOnly).size).toBe(0)
    // 正向对照:真 import 语句照常被识别(证明上一条不是恒真)
    const live = "import { applyToolCallEvent } from '../utils/chat-render-model'"
    expect(importedNamesFromChatRenderModel(live).has('applyToolCall')).toBe(false)
    expect(importedNamesFromChatRenderModel(live).has('applyToolCallEvent')).toBe(true)
  })

  it('接上主屏之后,三个 reducer 仍只有一份实现(src 里不存在第二处定义)', () => {
    for (const symbol of ['applyToolCallEvent', 'applyToolDelta', 'applyPlanUpdate']) {
      const definitions = productionFiles.filter((file) =>
        new RegExp(`export function ${symbol}\\b`).test(readFileSync(file, 'utf8')),
      )
      expect(definitions, `${symbol} 出现第二份定义`).toHaveLength(0)
      const own = readFileSync(join(SRC, 'utils/chat-render-model.ts'), 'utf8')
      expect(own).toContain(`export function ${symbol}(`)
    }
  })
})
