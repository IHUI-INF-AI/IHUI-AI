// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D77(2026-10-17 落地小程序腿)—— form-request-frame 的投影判据 + 线帧认领层判据。
//
// 投影部分与 apps/web/src/components/chat/__tests__/form-request-frame.test.ts 逐例同值
// (那份经 re-export 指回本实现;两份正反例共同钉住迁移前后行为一字不改)。
// 认领部分(parseFormRequestLine)是小程序腿新增:字段收窄口径与 @ihui/api-client 的
// tryParseFormRequest 逐字同(镜像锁另见 miniapp business-form-wiring.test.ts)。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { FormRequestFramePayload } from '../../sse/contract'
import {
  maybeFormRequestLine,
  parseFormRequestLine,
  projectFormRequestFrame,
} from '../form-request-frame'

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

describe('form_request 投影 / 正例(与 web 旧测试逐例同值)', () => {
  it('成对动作 + 已知 kind ⇒ 落成一条 pending 渲染态,挂到帧自带的 messageId', () => {
    const entry = projectFormRequestFrame(
      frame({ messageId: 'msg-from-frame' }),
      FALLBACK_MESSAGE_ID,
    )
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

  it('缺 sessionId ⇒ 仍渲染(用户该能看到请求),但键根本不存在(有键即诱导下游以为有通道)', () => {
    const entry = projectFormRequestFrame(
      {
        requestId: 'frm-no-sess',
        kind: 'email',
        fields: [{ key: 'to', type: 'email', required: true }],
        actions: ['approve', 'reject'],
      },
      FALLBACK_MESSAGE_ID,
    )
    expect(entry).not.toBeNull()
    expect('sessionId' in (entry ?? {})).toBe(false)
  })
})

describe('form_request 投影 / 四种不渲染', () => {
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

// ---------------------------------------------------------------------------
// 认领层(parseFormRequestLine):SSE 整行 → 解析后事件
// ---------------------------------------------------------------------------

const VALID_LINE = `data: ${JSON.stringify({
  type: 'form_request',
  requestId: 'frm-100',
  sessionId: 'sess-100',
  messageId: 'msg-100',
  kind: 'email',
  fields: [{ key: 'to', type: 'email', required: true, placeholderKey: 'to' }],
  actions: ['approve', 'reject'],
})}`

describe('form_request 认领 / 正例', () => {
  it('完整 data: 行 ⇒ 解析出载荷,type 键不进返回对象(契约刻意不含 type)', () => {
    const evt = parseFormRequestLine(VALID_LINE)
    expect(evt).not.toBeNull()
    expect(evt).toMatchObject({
      requestId: 'frm-100',
      sessionId: 'sess-100',
      messageId: 'msg-100',
      kind: 'email',
      actions: ['approve', 'reject'],
    })
    expect('type' in (evt ?? {})).toBe(false)
  })

  it('无 data: 前缀的裸 JSON 行同样认领(SSE 消费者两种形态都产)', () => {
    const evt = parseFormRequestLine(VALID_LINE.slice('data: '.length))
    expect(evt?.requestId).toBe('frm-100')
  })

  it('缺 sessionId/messageId 两可选键 ⇒ 不带键(不写空串顶掉"未知"态)', () => {
    const line = `data: ${JSON.stringify({
      type: 'form_request',
      requestId: 'frm-101',
      kind: 'calendarEvent',
      fields: [{ key: 'start' }],
      actions: ['approve', 'reject'],
    })}`
    const evt = parseFormRequestLine(line)
    expect('sessionId' in (evt ?? {})).toBe(false)
    expect('messageId' in (evt ?? {})).toBe(false)
    // 字段收窄:type 缺省 'text',required 仅 true 才算,placeholderKey 缺席不带键
    expect(evt?.fields).toEqual([{ key: 'start', type: 'text', required: false }])
  })

  it('字段坏项逐项丢弃,收窄后仍非空 ⇒ 整帧保留(与 api-client 的 continue 同纪律)', () => {
    const line = `data: ${JSON.stringify({
      type: 'form_request',
      requestId: 'frm-102',
      kind: 'email',
      fields: [null, 42, { noKey: true }, { key: 'to', required: 'yes' }, { key: 'subject' }],
      actions: ['approve', 'reject'],
    })}`
    const evt = parseFormRequestLine(line)
    expect(evt?.fields).toEqual([
      { key: 'to', type: 'text', required: false },
      { key: 'subject', type: 'text', required: false },
    ])
  })

  it('maybeFormRequestLine 廉价预筛:含标记才 true(正文 delta 热路径零成本直返)', () => {
    expect(maybeFormRequestLine(VALID_LINE)).toBe(true)
    expect(maybeFormRequestLine('data: {"type":"delta","text":"hi"}')).toBe(false)
  })
})

describe('form_request 认领 / 畸形帧一律 null(绝不半帧放行)', () => {
  it('缺 requestId / 空 requestId ⇒ null', () => {
    const base = {
      type: 'form_request',
      kind: 'email',
      fields: [{ key: 'to' }],
      actions: ['approve', 'reject'],
    }
    expect(parseFormRequestLine(`data: ${JSON.stringify({ ...base, requestId: '' })}`)).toBeNull()
    expect(parseFormRequestLine(`data: ${JSON.stringify({ ...base })}`)).toBeNull()
  })

  it('缺 kind / 空 kind ⇒ null', () => {
    const base = {
      type: 'form_request',
      requestId: 'r',
      fields: [{ key: 'to' }],
      actions: ['approve', 'reject'],
    }
    expect(parseFormRequestLine(`data: ${JSON.stringify({ ...base, kind: '' })}`)).toBeNull()
    expect(parseFormRequestLine(`data: ${JSON.stringify(base)}`)).toBeNull()
  })

  it('fields 缺席 / 空数组 / 全坏项 ⇒ null(解析层不放空卡过桥)', () => {
    const base = {
      type: 'form_request',
      requestId: 'r',
      kind: 'email',
      actions: ['approve', 'reject'],
    }
    expect(parseFormRequestLine(`data: ${JSON.stringify({ ...base })}`)).toBeNull()
    expect(parseFormRequestLine(`data: ${JSON.stringify({ ...base, fields: [] })}`)).toBeNull()
    expect(
      parseFormRequestLine(`data: ${JSON.stringify({ ...base, fields: [null, 7] })}`),
    ).toBeNull()
  })

  it('actions 不成对(缺 approve 或缺 reject)⇒ null(解析层就拦,不给投影层漏)', () => {
    const base = { type: 'form_request', requestId: 'r', kind: 'email', fields: [{ key: 'to' }] }
    expect(
      parseFormRequestLine(`data: ${JSON.stringify({ ...base, actions: ['approve'] })}`),
    ).toBeNull()
    expect(
      parseFormRequestLine(`data: ${JSON.stringify({ ...base, actions: ['reject'] })}`),
    ).toBeNull()
    expect(parseFormRequestLine(`data: ${JSON.stringify({ ...base })}`)).toBeNull()
  })

  it('非本族帧 / 坏 JSON / [DONE] / event: 行 ⇒ null', () => {
    expect(parseFormRequestLine('data: {"type":"delta","text":"hi"}')).toBeNull()
    expect(parseFormRequestLine('data: {not-json}')).toBeNull()
    expect(parseFormRequestLine('data: [DONE]')).toBeNull()
    expect(parseFormRequestLine('event: message')).toBeNull()
    expect(parseFormRequestLine('id: 3')).toBeNull()
    expect(parseFormRequestLine(': keep-alive')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 镜像锁(对 api-client 源码钉住"读哪些线字段";测试 import 源脚本判据,不复制常量)
// ---------------------------------------------------------------------------

describe('form_request 认领 / 镜像锁(与 @ihui/api-client 的 tryParseFormRequest 逐字同)', () => {
  const apiClientSrc = readFileSync(
    fileURLToPath(new URL('../../../../../packages/api-client/src/client.ts', import.meta.url)),
    'utf8',
  )
  // 抽出 tryParseFormRequest 函数体(箭头函数,从声明到下一个顶层 export)
  const fnStart = apiClientSrc.indexOf('const tryParseFormRequest =')
  const fnBody = fnStart >= 0 ? apiClientSrc.slice(fnStart, fnStart + 4000) : ''
  const endMarker = fnBody.indexOf('\nexport ')
  const fn = endMarker > 0 ? fnBody.slice(0, endMarker) : fnBody

  it('api-client 的 tryParseFormRequest 存在(镜像对象在场)', () => {
    expect(fnStart).toBeGreaterThan(-1)
    expect(fn).toContain('json.requestId')
    expect(fn).toContain('json.kind')
    expect(fn).toContain('json.fields')
    expect(fn).toContain('json.actions')
    expect(fn).toContain('json.sessionId')
    expect(fn).toContain('json.messageId')
  })

  it('共享认领层读的线字段键集与 api-client 一致(缺一侧即漂移)', () => {
    const sharedSrc = readFileSync(
      fileURLToPath(new URL('../form-request-frame.ts', import.meta.url)),
      'utf8',
    )
    for (const key of ['requestId', 'kind', 'fields', 'actions', 'sessionId', 'messageId']) {
      expect(fn).toContain(`json.${key}`)
      expect(sharedSrc).toContain(`json.${key}`)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
