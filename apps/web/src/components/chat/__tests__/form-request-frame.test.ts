// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// V3 #63(2026-09-27 立)—— `form_request` 帧 → 端内渲染态的投影判据。
//
// 这张表就是"什么样的帧才配变成屏幕上一张能填能交的表单"的**唯一**判据
// (判据写在 apps/web/src/hooks/use-chat/form-request-frame.ts)。
// 四条 null 各有独立理由,故正反成对写:一条判据失效就少一格红灯。
import { describe, expect, it } from 'vitest'

import type { FormRequestFramePayload } from '@ihui/shared'

import { projectFormRequestFrame } from '@/hooks/use-chat/form-request-frame'

const FALLBACK_MESSAGE_ID = 'msg-assistant-live'

function frame(overrides: Partial<FormRequestFramePayload> = {}): FormRequestFramePayload {
  return {
    requestId: 'frm-001',
    sessionId: 'sess-001',
    kind: 'email',
    fields: [{ key: 'to', type: 'email', required: true }],
    actions: ['approve', 'reject'],
    ...overrides,
  }
}

describe('V3 #63 form_request 投影 / 正例', () => {
  it('成对动作 + 已知 kind ⇒ 落成一条 pending 渲染态,挂到帧自带的 messageId', () => {
    const entry = projectFormRequestFrame(frame({ messageId: 'msg-from-frame' }), FALLBACK_MESSAGE_ID)
    expect(entry).not.toBeNull()
    expect(entry).toMatchObject({
      requestId: 'frm-001',
      sessionId: 'sess-001',
      kind: 'email',
      messageId: 'msg-from-frame',
      actions: ['approve', 'reject'],
      status: 'pending',
    })
  })

  it('帧未带 messageId ⇒ 回退到本轮流的 assistant 消息(与 onCitations/onSteer 同一姿势)', () => {
    const entry = projectFormRequestFrame(frame(), FALLBACK_MESSAGE_ID)
    expect(entry?.messageId).toBe(FALLBACK_MESSAGE_ID)
  })

  it('calendarEvent 同样是已知 kind(判定层 BUSINESS_FORM_KINDS 的两个成员都收)', () => {
    const entry = projectFormRequestFrame(frame({ kind: 'calendarEvent' }), FALLBACK_MESSAGE_ID)
    expect(entry?.kind).toBe('calendarEvent')
  })

  it('缺 sessionId ⇒ 仍渲染(用户该能看到请求),但回传通道为空由宿主如实置 failed', () => {
    const entry = projectFormRequestFrame(
      {
        requestId: 'frm-no-sess',
        kind: 'email',
        // 解析层已保证 fields 非空才发回调,这里给一条真字段而不是 []:
        // 给 [] 等于测一个上游根本产不出的形状,判据会跟着失真。
        fields: [{ key: 'to', type: 'email', required: true }],
        actions: ['approve', 'reject'],
      },
      FALLBACK_MESSAGE_ID,
    )
    expect(entry).not.toBeNull()
    // 不是 undefined 字段,是根本不存在该键(有键即诱导下游以为有通道)
    expect('sessionId' in (entry ?? {})).toBe(false)
  })
})

describe('V3 #63 form_request 投影 / 四种不渲染', () => {
  it('未知 kind ⇒ null(字段表按 kind 在判定层派发,未知 kind 只能给一张空卡)', () => {
    expect(projectFormRequestFrame(frame({ kind: 'taxReturn' }), FALLBACK_MESSAGE_ID)).toBeNull()
  })

  it('缺 requestId ⇒ null(应答没有锚点,用户填完也关联不回这次请求)', () => {
    expect(projectFormRequestFrame(frame({ requestId: '' }), FALLBACK_MESSAGE_ID)).toBeNull()
  })

  it('动作不成对 ⇒ null(只有 approve 就是"不许拒绝",违反拒绝零副作用那条硬约束)', () => {
    expect(projectFormRequestFrame(frame({ actions: ['approve'] }), FALLBACK_MESSAGE_ID)).toBeNull()
    expect(projectFormRequestFrame(frame({ actions: ['reject'] }), FALLBACK_MESSAGE_ID)).toBeNull()
    expect(projectFormRequestFrame(frame({ actions: [] }), FALLBACK_MESSAGE_ID)).toBeNull()
  })

  it('既无 messageId 又无回退锚点 ⇒ null(挂不到任何一条消息上,不造孤儿卡)', () => {
    expect(projectFormRequestFrame(frame(), '')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
