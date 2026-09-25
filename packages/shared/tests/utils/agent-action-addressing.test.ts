// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 投递定址共享判据的单测(2026-09-26 三桥收口票)。
 *
 * 钉的是"五桥共用的那一份实现"本身的三条不变量:
 *  - 缺 assignment 一律放行(向后兼容,端内不得因抽库而改变旧语义);
 *  - 端种类与实例 id **两条都要**一致才执行(只比一条即串投/抢执行);
 *  - 回执只回显服务端下发过的 token,取一次即消费(旧形态不得多出 responded 键)。
 */
import { describe, it, expect } from 'vitest'

import {
  createAssignmentTokenLedger,
  isAgentActionAssignedToInstance,
  unassignedAgentActionLogMessage,
  withRespondedIdentity,
  type AgentActionSelfIdentity,
} from '../../src/utils/agent-action-addressing'
import type { AgentActionResponse } from '@ihui/types'

const SELF: AgentActionSelfIdentity = { endpoint: 'rn', instanceId: 'rn-self' }

function response(over: Partial<AgentActionResponse> = {}): AgentActionResponse {
  return {
    requestId: 'req-1',
    success: true,
    durationMs: 1,
    executedBy: 'rn',
    ...over,
  }
}

describe('isAgentActionAssignedToInstance', () => {
  it('缺 assignment(旧服务端)一律放行', () => {
    expect(isAgentActionAssignedToInstance(undefined, SELF)).toBe(true)
  })

  it('端种类 + 实例 id 都一致 → 放行', () => {
    expect(
      isAgentActionAssignedToInstance({ endpoint: 'rn', instanceId: 'rn-self', token: 't' }, SELF),
    ).toBe(true)
  })

  it('同端种类但他实例 → 拦(同用户两台手机不得各执行一次)', () => {
    expect(
      isAgentActionAssignedToInstance({ endpoint: 'rn', instanceId: 'rn-other', token: 't' }, SELF),
    ).toBe(false)
  })

  it('实例 id 巧合而端种类不同(跨档串投)→ 拦', () => {
    expect(
      isAgentActionAssignedToInstance(
        { endpoint: 'miniapp', instanceId: 'rn-self', token: 't' },
        SELF,
      ),
    ).toBe(false)
  })
})

describe('createAssignmentTokenLedger / withRespondedIdentity', () => {
  it('未 remember 过(旧形态)→ 回执对象逐字不变,不多 responded 键', () => {
    const ledger = createAssignmentTokenLedger()
    const original = response()
    expect(withRespondedIdentity(original, ledger, SELF)).toBe(original)
    expect('responded' in original).toBe(false)
  })

  it('remember 后回显服务端 token + 自报本实例,且取一次即消费', () => {
    const ledger = createAssignmentTokenLedger()
    ledger.remember('req-1', 'tk-server')
    const out = withRespondedIdentity(response(), ledger, SELF)
    expect(out.responded).toEqual({ instanceId: 'rn-self', assignmentToken: 'tk-server' })
    // 第二条同 requestId 的回执不得再带上已消费的 token(防止串单回显)
    expect(withRespondedIdentity(response(), ledger, SELF).responded).toBeUndefined()
  })

  it('超过容量按 FIFO 淘汰最早一条,新的仍可用', () => {
    const ledger = createAssignmentTokenLedger(2)
    ledger.remember('a', 'ta')
    ledger.remember('b', 'tb')
    ledger.remember('c', 'tc')
    expect(ledger.take('a')).toBeUndefined()
    expect(ledger.take('b')).toBe('tb')
    expect(ledger.take('c')).toBe('tc')
  })
})

describe('unassignedAgentActionLogMessage', () => {
  it('把 requestId / 被指派实例 / 自身身份全部写进这一行(排障不靠猜)', () => {
    const msg = unassignedAgentActionLogMessage(
      'req-x',
      { endpoint: 'rn', instanceId: 'rn-other', token: 't' },
      SELF,
    )
    expect(msg).toContain('requestId=req-x')
    expect(msg).toContain('assignedInstance=rn-other')
    expect(msg).toContain('self=rn/rn-self')
  })

  it('缺 assignment 时也如实写出 assigned=undefined(不让日志把"未定址"说成"定址给他端")', () => {
    const msg = unassignedAgentActionLogMessage('req-y', undefined, SELF)
    expect(msg).toContain('requestId=req-y')
    expect(msg).toContain('assignedInstance=undefined')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
