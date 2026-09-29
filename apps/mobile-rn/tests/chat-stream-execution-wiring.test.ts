// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D135 端可达性①:RN 主聊天屏的 SSE 帧接线取证。
//
// 立票事实(2026-09-28 取证,本文件写前逐字复跑):
//   `apps/mobile-rn/src/screens/ChatScreen.tsx` 的 streamChat 回调表只传 7 个,
//   而 `packages/api-client/src/client.ts` 的 StreamChatOptions 现有 33 个 onXxx;
//   `src/utils/chat-render-model.ts` 的 applyToolCallEvent / applyToolDelta / applyPlanUpdate
//   三个 reducer **在主屏零调用方**,同端 AiAssistantN8nScreen 却全接上了。
//
// 本文件钉三件事:
//   ① 折叠档的纯函数行为(按消息 id 累加、按帧判别式穷尽、不改入参、结果与三个 reducer 等值);
//   ② 屏侧接线(源码级)—— 这两个 3.7k/2.4k 行的屏在本端没有渲染级用例(挂 FlatList +
//      十余 provider,挂载即 TypeError,同 tests/chat-disclosure-tier-approval.test.tsx 那段口径),
//      所以"接没接上"只能用源码断言钉;而"组件造好没装车"正是本仓反复出事的那一类(守门 64/70/81/115/138)。
//   ③ 与守门 90(scripts/check-sse-dispatch-parity.mjs)台账的配套性:接一帧必须同票动台账,
//      而 scripts/** 此刻在他人工作面 ⇒ 本票只接台账**没有**登记为缺失的那些帧,并用断言把
//      "接了台账仍登记缺失的帧"这一型当场钉红(否则红点会落在下一个人身上,而不是落在这笔改动上)。
//
// 刻意**不**依赖任何未入库的他人文件(memory 记过的教训:本机绿而干净检出必红)。
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
const LEDGER = JSON.parse(
  readFileSync(join(HERE, '../../scripts/data/sse-dispatch-coverage.json'), 'utf8'),
) as { missing: Record<string, Record<string, unknown>> }

/** 逐帧折叠(与屏内 foldExecutionFrame 走同一个出口) */
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
    // 两条帧喂同一个 nowMs ⇒ 0(而不是 undefined:startedAtMs 确实记下了)
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

  it('出口配对:这一层只做组合 —— 三个 reducer 仍是唯一实现,结果逐字等值', () => {
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

/**
 * 屏侧接线自证(源码级)。断言的不是"文件里出现过这个名字",而是
 * **真在 streamChat 的回调表里** —— 本仓"造好没装车"的教训全都长在同一处:名字在,位置错。
 */
describe('ChatScreen 屏侧接线(源码级)', () => {
  /** 取 `await streamChat({ … })` 那一段(括号配平,不靠行号 —— 行号在每次 append 后都会挪) */
  const streamChatBlock = ((): string => {
    const start = SCREEN_SOURCE.indexOf('await streamChat({')
    if (start < 0) throw new Error('找不到 streamChat 调用点')
    let depth = 0
    let index = SCREEN_SOURCE.indexOf('{', start)
    for (; index < SCREEN_SOURCE.length; index += 1) {
      const char = SCREEN_SOURCE[index]
      if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth === 0) break
      }
    }
    return SCREEN_SOURCE.slice(start, index + 1)
  })()

  const registered = (name: string): boolean =>
    new RegExp(`^\\s{6}${name}:`, 'm').test(streamChatBlock)

  // 票面点名的缺口里,本票落的是这 6 个(其余的理由与解阻判据写在 d135 报告,不在此藏)
  for (const name of [
    'onToolCall',
    'onToolDelta',
    'onPlanUpdate',
    'onCompaction',
    'onBudget',
    'onRetryScheduled',
  ] as const) {
    it(`${name} 在 streamChat 回调表里(不是只在注释里被提到)`, () => {
      expect(registered(name)).toBe(true)
    })
  }

  it('三类帧都折进同一个出口,屏内没有第二份折叠实现', () => {
    expect(SCREEN_SOURCE).toMatch(
      /applyAssistantExecutionFrame\(\s*prev\[turnAssistantId\],\s*frame,?\s*\)/,
    )
    // 反向锁:屏内自己 map/findIndex 折工具行 = 第二份真相
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
    expect(SCREEN_SOURCE).toMatch(/<TaskStatusBar[\s\S]{0,240}?planSteps=\{planViz\?\.planSteps \?\? \[\]\}/)
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
})

describe('守门 90 台账配套性(接一帧必须同票动台账;本票刻意不碰 scripts/)', () => {
  /**
   * `scripts/check-sse-dispatch-parity.mjs` 判据③:台账 `missing[端]` 的键集合必须
   * **精确等于**实测未命中集合。于是"接一帧"结构上要求同票删台账条目 + 调 baseline,
   * 而 scripts/** 此刻在他人工作面里(本票文件清单外)。
   * 这条断言把这件事从"下一次提交被别人那枚门挡住"提前到"本票当场红"。
   */
  const ledgerMissingMobileRn = Object.keys(LEDGER.missing['mobile-rn'] ?? {})
  const wiredNames = [...streamChatOptionNames(SCREEN_SOURCE)]

  it('本屏接的每一个帧名,都不得是台账里"mobile-rn 未命中"的那一条', () => {
    expect(wiredNames.filter((name) => ledgerMissingMobileRn.includes(name))).toEqual([])
  })

  it('正向对照:台账确实在管这批名字(空台账会让上一条恒真)', () => {
    expect(ledgerMissingMobileRn.length).toBeGreaterThan(0)
    expect(ledgerMissingMobileRn).toContain('onToolApproval')
  })
})

/** streamChat 回调表里的 onXxx 键名(6 空格缩进 = 该对象字面量的属性位) */
function streamChatOptionNames(source: string): Set<string> {
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
  const block = source.slice(start, index + 1)
  return new Set([...block.matchAll(/^\s{6}(on[A-Z][A-Za-z]+):/gm)].map((m) => m[1]))
}

describe('reducer 的生产面 importer(票面验收:排除测试面)', () => {
  const SRC = resolve(HERE, '../src')
  const tsFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) return tsFiles(full)
      return /\.tsx?$/.test(entry.name) && statSync(full).isFile() ? [full] : []
    })

  /**
   * 从 chat-render-model 的**具名导入清单**里取符号 —— 不是"文件里出现过这个名字":
   * 注释里逐字引用旧写法在本屏是常态(它自己就写着"tool-result 到达由 applyToolCallEvent 清掉"),
   * 按"提到"算装车会让判据对"造好没装车"那一型彻底失明(守门 115/138 同一条禁令)。
   */
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

  it('注释不得被当成装车:把符号只写进注释的文件不算 importer', () => {
    // 反向对照 —— 本屏确实有这种文件(注释里逐字提到 applyToolCallEvent),
    // 它必须**不**出现在 applyToolCallEvent 的 importer 清单里;若出现了,上面两条就都没牙。
    const mentioned = productionFiles.filter((file) =>
      /applyToolCallEvent/.test(readFileSync(file, 'utf8')),
    )
    const counted = importersOf('applyToolCallEvent')
    expect(mentioned.length).toBeGreaterThan(counted.length)
  })

  it('接上主屏之后,三个 reducer 仍只有一份实现(src 里不存在第二处定义)', () => {
    for (const symbol of ['applyToolCallEvent', 'applyToolDelta', 'applyPlanUpdate']) {
      const definitions = productionFiles.filter((file) =>
        new RegExp(`export function ${symbol}\\b`).test(readFileSync(file, 'utf8')),
      )
      expect(definitions, `${symbol} 出现第二份定义`).toHaveLength(0)
      // 定义处只允许在 chat-render-model.ts 自身
      const own = readFileSync(join(SRC, 'utils/chat-render-model.ts'), 'utf8')
      expect(own).toContain(`export function ${symbol}(`)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
