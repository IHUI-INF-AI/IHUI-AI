// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-05 票4(G-998099)验收草案:客户端禁止用本地时钟造事件 id/ts。
 *
 * 钉三件事:
 *   ① 同一条 payload 解析两次 ⇒ JSON.stringify 逐字节同值(今天必然 false,因为
 *      ts/id 含 Date.now();改后必须 true);
 *   ② 解析结果不再携带来源为本地时钟的 ts:ts 只来自 wire 原值(timestamp/ts),
 *      缺席时整个键不在(而非 0、而非 undefined 键挂 undefined);
 *   ③ applyCoalesceEquivalence 型断言:同一序列"逐条 push"与"先批量解析再 push"
 *      两条路径的列表项 id 多重集合相等(防重连重放产生重复卡片)。
 */
import { describe, expect, it, vi, afterEach } from 'vitest'

import { parseAgentTaskEvent, parseSelfHealEvent, parseToolApprovalEvent } from '../src/sse/agent-events'

afterEach(() => {
  vi.restoreAllMocks()
})

const selfHealRaw = JSON.stringify({
  type: 'self-heal',
  payload: { session_id: 's1', iteration: 2, phase: 'started', command: 'pytest -q', failed: 3 },
})
const toolApprovalRaw = JSON.stringify({
  type: 'tool-approval',
  payload: { approval_id: 'a1', tool_name: 'run_command', tool_call_id: 'tc1', args_preview: 'x', danger_level: 'high' },
})

describe('① 同一 payload 重复解析逐字节同值', () => {
  it('self-heal 解析两次 JSON.stringify 相等(改动前因 Date.now 必然 false)', () => {
    const a = parseSelfHealEvent(selfHealRaw)
    const b = parseSelfHealEvent(selfHealRaw)
    expect(a).not.toBeNull()
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('tool-approval 解析两次 JSON.stringify 相等', () => {
    const a = parseToolApprovalEvent(toolApprovalRaw)
    const b = parseToolApprovalEvent(toolApprovalRaw)
    expect(a).not.toBeNull()
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('把本地时钟拨到两个相隔甚远的值,id 与整体序列化都不变(本地时钟无贡献)', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000000000000)
    const early = parseSelfHealEvent(selfHealRaw)
    vi.spyOn(Date, 'now').mockReturnValue(2000000000000)
    const late = parseSelfHealEvent(selfHealRaw)
    expect(JSON.stringify(early)).toBe(JSON.stringify(late))
  })
})

describe('② ts 只来自 wire 原值,缺席即整个键不在', () => {
  it('wire 带 timestamp ⇒ 透传原值,不取 Date.now()', () => {
    const evt = parseSelfHealEvent(
      JSON.stringify({
        payload: { session_id: 's1', iteration: 1, phase: 'finished', ok: true, timestamp: 1735689600000 },
      }),
    )
    expect(evt!.ts).toBe(1735689600000)
  })

  it('wire 带 ts(旧键)⇒ 同样透传原值', () => {
    const evt = parseAgentTaskEvent('agent-status', JSON.stringify({ payload: { status: 'resuming', ts: 1735689600001 } }))
    expect(evt).not.toBeNull()
    expect(evt!.event).toMatchObject({ ts: 1735689600001 })
  })

  it('wire 缺 ts ⇒ 解析结果整个键不在(而非 0)', () => {
    const evt = parseSelfHealEvent(selfHealRaw)
    expect(evt).not.toBeNull()
    expect('ts' in evt!).toBe(false)
    expect(evt!.ts).toBeUndefined()
  })
})

describe('③ applyCoalesceEquivalence 型:逐条 push 与批量解析再 push 的 id 多重集合相等', () => {
  it('同一序列两条路径后,列表项 id 多重集合逐项相等(防重连重放产生重复卡片)', () => {
    const raws = [
      JSON.stringify({ payload: { session_id: 's1', iteration: 1, phase: 'started', command: 'a' } }),
      JSON.stringify({ payload: { session_id: 's1', iteration: 1, phase: 'finished', ok: true } }),
      JSON.stringify({ payload: { session_id: 's1', iteration: 2, phase: 'started', command: 'b' } }),
      JSON.stringify({ payload: { session_id: 's1', iteration: 2, phase: 'finished', ok: false, attempts: 1 } }),
    ]
    // 路径一:逐条解析逐条 push
    const incremental: string[] = []
    for (const raw of raws) {
      const evt = parseSelfHealEvent(raw)
      if (evt) incremental.push(evt.id)
    }
    // 路径二:先批量解析,再一次 push
    const batch = raws
      .map((raw) => parseSelfHealEvent(raw))
      .filter((e): e is NonNullable<typeof e> => e !== null)
      .map((e) => e.id)
    // 多重集合相等:排序后逐项相等
    expect([...incremental].sort()).toEqual([...batch].sort())
    // 且每条 id 都稳定:重放同一序列得到同一多重集合
    const replay = raws.map((raw) => parseSelfHealEvent(raw)!.id)
    expect([...replay].sort()).toEqual([...batch].sort())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
