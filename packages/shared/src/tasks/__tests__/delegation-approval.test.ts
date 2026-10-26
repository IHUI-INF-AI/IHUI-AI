// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  openDelegationApproval,
  resolveTicketExpiry,
  resolveDelegationAnswer,
  resolveDelegationStop,
  resolveDelegationExpiry,
  delegationApprovalAudienceOf,
  delegationActorRoleOf,
  delegationApprovalKey,
  type DelegationApprovalTicket,
} from '../delegation-approval.js'

const ORIGIN = 'dev-phone-01'
const TARGET = 'dev-desk-02'
const THIRD = 'dev-web-03'

function ticket(): DelegationApprovalTicket {
  return openDelegationApproval({
    delegationId: 'dlg-1',
    originDeviceId: ORIGIN,
    targetDeviceId: TARGET,
  })
}

describe('跨设备委派审批 —— 审批跟人', () => {
  it('① 审批卡恒达提问方与执行方两台设备', () => {
    expect(delegationApprovalAudienceOf(ticket())).toEqual([ORIGIN, TARGET])
  })

  it('② 自派自发(origin === target)只出一份,不重复投递', () => {
    const self = openDelegationApproval({
      delegationId: 'dlg-self',
      originDeviceId: ORIGIN,
      targetDeviceId: ORIGIN,
    })
    expect(delegationApprovalAudienceOf(self)).toEqual([ORIGIN])
  })

  it('③ 同一用户的第三台设备看得见但答不了(角色 foreign)', () => {
    const t = ticket()
    expect(delegationActorRoleOf(t, ORIGIN)).toBe('origin')
    expect(delegationActorRoleOf(t, TARGET)).toBe('target')
    expect(delegationActorRoleOf(t, THIRD)).toBe('foreign')
    expect(delegationApprovalAudienceOf(t)).not.toContain(THIRD)
  })
})

describe('跨设备委派审批 —— 先答者胜', () => {
  it('④ 执行方先答 → applied,票迁 approved', () => {
    const t = ticket()
    const r = resolveDelegationAnswer(t, { deviceId: TARGET, decision: true, seq: 0 })
    expect(r.verdict).toBe('applied')
    expect(r.ticket.state).toBe('approved')
    expect(r.ticket.answeredBy).toBe(TARGET)
    expect(r.ticket.seq).toBe(1)
  })

  it('⑤ 提问方随后再答 → duplicate,不翻案(先答者胜的主判据)', () => {
    const first = resolveDelegationAnswer(ticket(), { deviceId: TARGET, decision: true, seq: 0 })
    const second = resolveDelegationAnswer(first.ticket, {
      deviceId: ORIGIN,
      decision: false,
      seq: first.ticket.seq,
    })
    expect(second.verdict).toBe('duplicate')
    expect(second.ticket.state).toBe('approved')
    expect(second.ticket.answeredBy).toBe(TARGET)
  })

  it('⑥ 幂等:同一回答重投两次,第二次零变化且返回原引用', () => {
    const first = resolveDelegationAnswer(ticket(), { deviceId: ORIGIN, decision: true, seq: 0 })
    const again = resolveDelegationAnswer(first.ticket, {
      deviceId: ORIGIN,
      decision: true,
      seq: first.ticket.seq,
    })
    expect(again.verdict).toBe('duplicate')
    expect(again.ticket).toBe(first.ticket)
  })

  it('⑦ 拒绝即终止:decision=false 落 denied 且委派 taskStatus 转 cancelled', () => {
    const r = resolveDelegationAnswer(ticket(), { deviceId: ORIGIN, decision: false, seq: 0 })
    expect(r.ticket.state).toBe('denied')
    expect(r.ticket.taskStatus).toBe('cancelled')
  })

  it('⑧ 越权:第三台设备回答判 rejected,票面不动', () => {
    const t = ticket()
    const r = resolveDelegationAnswer(t, { deviceId: THIRD, decision: true, seq: 0 })
    expect(r.verdict).toBe('rejected')
    expect(r.ticket).toBe(t)
    expect(r.ticket.state).toBe('awaiting')
  })
})

describe('跨设备委派审批 —— seq 幂等尺', () => {
  it('⑨ stale:低 seq 迟到一律丢弃', () => {
    const first = resolveDelegationAnswer(ticket(), { deviceId: ORIGIN, decision: true, seq: 0 })
    const late = resolveDelegationAnswer(first.ticket, {
      deviceId: TARGET,
      decision: false,
      seq: 0,
    })
    expect(late.verdict).toBe('stale')
    expect(late.ticket).toBe(first.ticket)
  })

  it('⑩ gap:超前 seq 判断链,等补齐再答', () => {
    const t = ticket()
    const r = resolveDelegationAnswer(t, { deviceId: ORIGIN, decision: true, seq: 5 })
    expect(r.verdict).toBe('gap')
    expect(r.ticket).toBe(t)
  })

  it('⑪ missing:无票可答', () => {
    const r = resolveDelegationAnswer(null, { deviceId: ORIGIN, decision: true, seq: 0 })
    expect(r.verdict).toBe('missing')
  })

  it('⑫ 幂等键形状锁定(与 chat-sync 的 (id, rev) 同形)', () => {
    expect(delegationApprovalKey('dlg-1', 3)).toBe('dlg-1@3')
  })
})

describe('跨设备委派审批 —— Stop 覆盖未终态', () => {
  it('⑬ 票还挂在 awaiting 时,任意一端可 stop', () => {
    const r = resolveDelegationStop(ticket(), { deviceId: ORIGIN, seq: 0 })
    expect(r.verdict).toBe('applied')
    expect(r.ticket.state).toBe('stopped')
    expect(r.ticket.taskStatus).toBe('cancelled')
  })

  it('⑭ stop 之后再 stop 判 duplicate,不翻案', () => {
    const first = resolveDelegationStop(ticket(), { deviceId: TARGET, seq: 0 })
    const again = resolveDelegationStop(first.ticket, {
      deviceId: ORIGIN,
      seq: first.ticket.seq,
    })
    expect(again.verdict).toBe('duplicate')
    expect(again.ticket.state).toBe('stopped')
  })

  it('⑮ 已放行的票不能再被 stop(先答者胜同样约束 stop)', () => {
    const approved = resolveDelegationAnswer(ticket(), { deviceId: ORIGIN, decision: true, seq: 0 })
    const stop = resolveDelegationStop(approved.ticket, {
      deviceId: TARGET,
      seq: approved.ticket.seq,
    })
    expect(stop.verdict).toBe('duplicate')
    expect(stop.ticket.state).toBe('approved')
  })

  it('⑯ 越权 stop 判 rejected', () => {
    const t = ticket()
    const r = resolveDelegationStop(t, { deviceId: THIRD, seq: 0 })
    expect(r.verdict).toBe('rejected')
    expect(r.ticket).toBe(t)
  })
})

describe('跨设备委派审批 —— 过期绝不静默放行', () => {
  it('⑰ 超 TTL 落 expired(终止态),不得转 approved', () => {
    const r = resolveDelegationExpiry(ticket(), {
      nowMs: 10_000,
      createdAtMs: 0,
      ttlMs: 5_000,
    })
    expect(r.verdict).toBe('applied')
    expect(r.ticket.state).toBe('expired')
    expect(r.ticket.taskStatus).toBe('cancelled')
  })

  it('⑲ TTL 自包含:票自带 createdAtMs/ttlMs,生产端不再另传时钟', () => {
    const t = openDelegationApproval({
      delegationId: 'dlg-ttl',
      originDeviceId: ORIGIN,
      targetDeviceId: TARGET,
      ttlMs: 1_000,
      nowMs: 0,
    })
    expect(t.createdAtMs).toBe(0)
    expect(t.ttlMs).toBe(1_000)
    const r = resolveTicketExpiry(t, 1_500)
    expect(r?.verdict).toBe('applied')
    expect(r?.ticket.state).toBe('expired')
  })

  it('⑳ 票缺时钟字段 ⇒ 未判定(返回 null),不猜、不默认放行', () => {
    const bare: DelegationApprovalTicket = {
      delegationId: 'dlg-bare',
      originDeviceId: ORIGIN,
      targetDeviceId: TARGET,
      seq: 0,
      state: 'awaiting',
    }
    expect(resolveTicketExpiry(bare, 999_999)).toBeNull()
  })

  it('⑱ 未超 TTL 不迁移(返回原引用),已答票不翻案', () => {
    const t = ticket()
    const early = resolveDelegationExpiry(t, { nowMs: 1_000, createdAtMs: 0, ttlMs: 5_000 })
    expect(early.verdict).toBe('duplicate')
    expect(early.ticket).toBe(t)

    const approved = resolveDelegationAnswer(t, { deviceId: ORIGIN, decision: true, seq: 0 })
    const later = resolveDelegationExpiry(approved.ticket, {
      nowMs: 999_999,
      createdAtMs: 0,
      ttlMs: 5_000,
    })
    expect(later.verdict).toBe('duplicate')
    expect(later.ticket.state).toBe('approved')
  })
})
