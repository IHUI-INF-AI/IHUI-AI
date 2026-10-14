// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * tool-approval-frame-claim.test.ts — D136 miniapp 主对话流 tool-approval 帧认领/分发/决策 回归钉
 *
 * 立票背景(2026-10-14,台账 #94「tool-approval 双零命中」miniapp 半格收尾):
 *   src/lib/tool-approval-frame.ts 头注承诺「映射口径由常驻测试 tests/tool-approval-frame-claim.test.ts
 *   对着 api-client 源码钉住」,但基线 5fc529ea65 上该文件缺失 —— 认领层/传输层/卡片/回传全在,钉子缺席。
 *   本测试按 tests/sse-subagent-consumption.test.ts 同一风格补上,钉住三段:
 *   ① 帧名与共享契约同字;② 解析+分发行为(整行旁路 → onToolApproval 回调真被触发);
 *   ③ 决策回传(buildXxxPayload 产物与 @ihui/api-client postToolApprovalResponse 入参同形 + 接线锚)。
 *   既有 src/pkg-ai/ai/__tests__/tool-approval-wiring.test.ts 覆盖源码级锚与解析细节;
 *   本文件是它承诺的 tests/ 级常驻伴侣,不重复其断言。
 */

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

// 本端 environment 是 'node':@tarojs/taro 在 node 下加载即崩,而传输层 src/lib/sse.ts
// 顶部 import 它 —— 与 tool-approval-wiring.test.ts 同一套替身,只为把 SSEStreamParser 真跑起来。
vi.mock('@tarojs/taro', () => ({
  default: { getEnv: () => 'WEAPP', ENV_TYPE: { WEB: 'WEB' }, request: vi.fn() },
}))
vi.mock('@/utils/auth', () => ({ getToken: () => 'test-token' }))

import { postToolApprovalResponse } from '@ihui/api-client'
import { SSEStreamParser } from '../src/lib/sse'
import { TOOL_APPROVAL_FRAME_TYPE, parseToolApprovalLine } from '../src/lib/tool-approval-frame'
import {
  buildApprovePayload,
  buildRejectPayload,
  type ApprovalDecisionPayload,
  type ApprovalRequestView,
} from '../src/pkg-ai/ai/tool-approval-text'

const HERE = dirname(fileURLToPath(import.meta.url))
const END_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(END_ROOT, '..', '..')

const src = (rel: string): string => readFileSync(join(END_ROOT, rel), 'utf8')

const FRAME =
  'data: {"type":"tool-approval","approval_id":"ap-1","tool_name":"run_command","tool_call_id":"tc-1","args_preview":"{\\"command\\":\\"ls\\"}","danger_level":"high","session_id":"s-9"}'

describe('D136 帧名与共享契约同字', () => {
  it('TOOL_APPROVAL_FRAME_TYPE 与 contract.ts SSE_EVENTS.TOOL_APPROVAL 逐字同', () => {
    const contract = readFileSync(join(REPO_ROOT, 'packages/shared/src/sse/contract.ts'), 'utf8')
    expect(contract).toContain(`TOOL_APPROVAL: '${TOOL_APPROVAL_FRAME_TYPE}'`)
    expect(TOOL_APPROVAL_FRAME_TYPE).toBe('tool-approval')
  })
})

describe('D136 解析+分发:帧到设备不再静默丢弃(onToolApproval 真被触发)', () => {
  /** 与 src/api/index.ts chatStream 的 onRawLine 同一条分发逻辑:解析得出审批事件才触发回调。 */
  const dispatch = (line: string): ReturnType<typeof parseToolApprovalLine>[] => {
    const evt = parseToolApprovalLine(line)
    return evt ? [evt] : []
  }

  it('整行旁路 → 认领层 → 回调:分发语义整链跑通,字段逐字正确', () => {
    const seen: string[] = []
    const parser = new SSEStreamParser((line) => seen.push(line))
    parser.push(`${FRAME}\n\n`)
    // 共享解析面不认领这族帧 ⇒ events 里不该有它,原始行只走旁路
    expect(seen).toHaveLength(1)
    const received = dispatch(seen[0] as string)
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      type: 'tool-approval',
      approvalId: 'ap-1',
      toolName: 'run_command',
      toolCallId: 'tc-1',
      argsPreview: '{"command":"ls"}',
      dangerLevel: 'high',
      sessionId: 's-9',
    })
  })

  it('正文 delta/坏帧不触发审批回调(旁路对非本族行零成本直返,半帧不猜)', () => {
    expect(dispatch('data: {"type":"chunk","content":"hi"}')).toHaveLength(0)
    // 缺 approval_id ⇒ 整帧不要(没有 id 就回传不了决策,留着只会挡路)
    expect(dispatch('data: {"type":"tool-approval","tool_name":"x"}')).toHaveLength(0)
    expect(dispatch('data: not-json')).toHaveLength(0)
    expect(dispatch('data: {"type":"tool-approval","approval_id":"a","danger_level":"low"}')[0]?.dangerLevel).toBe('low')
  })
})

describe('D136 决策回传:载荷与 postToolApprovalResponse 入参同形', () => {
  const REQUEST: ApprovalRequestView = {
    approvalId: 'ap-1',
    toolName: 'run_command',
    toolCallId: 'tc-1',
    argsPreview: '{}',
    dangerLevel: 'high',
    sessionId: 's-9',
  }

  /** 编译期锁:两个构造器产物必须可直接作为 postToolApprovalResponse 入参,漂开即 tsc 红。 */
  type RespondInput = Parameters<typeof postToolApprovalResponse>[0]
  const asRespondInput = (p: ApprovalDecisionPayload): RespondInput => p

  it('批准载荷可直送回传端点(决策/寻址/三档 scope 键齐)', () => {
    expect(asRespondInput(buildApprovePayload(REQUEST, 'session'))).toEqual({
      sessionId: 's-9',
      approvalId: 'ap-1',
      decision: 'approve',
      scope: 'session',
    })
  })

  it('拒绝载荷可直送回传端点且不带 scope(拒绝不落任何授权)', () => {
    const payload = asRespondInput(buildRejectPayload(REQUEST, '不执行'))
    expect(payload.decision).toBe('reject')
    expect('scope' in payload).toBe(false)
    expect(payload.reason).toBe('不执行')
  })

  it('接线锚:chat.tsx 决策出口与 api/index.ts 回传 re-export 在位', () => {
    expect(src('src/pkg-ai/ai/chat.tsx')).toContain(
      'await postToolApprovalResponse({ ...payload, sessionId })',
    )
    expect(src('src/api/index.ts')).toMatch(
      /export\s*\{[\s\S]{0,160}postToolApprovalResponse[\s\S]{0,80}\} from '@ihui\/api-client'/u,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
