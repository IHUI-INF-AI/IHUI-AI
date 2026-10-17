// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 业务表单帧的行级认领规则(D77)。锁的是**判据本身**,每条都配一枚反向用例 ——
// 因为这一族的失效形态从来不是报错,而是"帧到了设备却被静默丢掉"(同 D113 tool-delta)。
import { describe, expect, it } from 'vitest'

import { FORM_REQUEST_FRAME_TYPE, maybeFormRequestLine, parseFormRequestLine } from '../form-request-frame'

const line = (obj: unknown): string => `data: ${JSON.stringify(obj)}`

const GOOD = {
  type: FORM_REQUEST_FRAME_TYPE,
  requestId: 'req-1',
  kind: 'create_course',
  fields: [{ key: 'title', type: 'text', required: true }],
  actions: ['approve', 'reject'],
}

describe('form_request 认领:正例', () => {
  it('完整合法帧逐字段交出,不带 type 判别位', () => {
    const got = parseFormRequestLine(line({ ...GOOD, sessionId: 's-9', messageId: 'm-3' }))
    expect(got).toEqual({
      requestId: 'req-1',
      kind: 'create_course',
      fields: [{ key: 'title', type: 'text', required: true }],
      actions: ['approve', 'reject'],
      sessionId: 's-9',
      messageId: 'm-3',
    })
    expect((got as unknown as Record<string, unknown>).type).toBeUndefined()
  })

  it('`data:` 带不带前导空格都认(前缀规矩只有一份,复用 sse-parse 的 dataPayloadOfLine)', () => {
    const bare = `data:${JSON.stringify(GOOD)}`
    expect(parseFormRequestLine(bare)).toEqual(parseFormRequestLine(`data: ${JSON.stringify(GOOD)}`))
  })

  it('可选槽缺省时**不写空串也不写 undefined 键**(端内不得把"不知道是哪条流"伪装成知道)', () => {
    const got = parseFormRequestLine(line(GOOD))
    expect(Object.prototype.hasOwnProperty.call(got, 'sessionId')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(got, 'messageId')).toBe(false)
    // 非 string 的脏值同样不进对象
    const dirty = parseFormRequestLine(line({ ...GOOD, sessionId: 12 }))
    expect(Object.prototype.hasOwnProperty.call(dirty, 'sessionId')).toBe(false)
  })

  it('单项 type 缺省落 text、required 只在 === true 时为真(不猜"缺字段=必填")', () => {
    const got = parseFormRequestLine(
      line({ ...GOOD, fields: [{ key: 'a' }, { key: 'b', required: 'yes', type: 7 }] }),
    )
    expect(got?.fields).toEqual([
      { key: 'a', type: 'text', required: false },
      { key: 'b', type: 'text', required: false },
    ])
  })

  it('占位键只在为非空 string 时带上', () => {
    const withPh = parseFormRequestLine(line({ ...GOOD, fields: [{ key: 'a', placeholderKey: 'p' }] }))
    expect(withPh?.fields[0]?.placeholderKey).toBe('p')
    const noPh = parseFormRequestLine(line({ ...GOOD, fields: [{ key: 'a', placeholderKey: 5 }] }))
    expect(Object.prototype.hasOwnProperty.call(noPh?.fields[0], 'placeholderKey')).toBe(false)
  })
})

describe('form_request 认领:反例(每条都必须整帧丢弃)', () => {
  it('锚点缺失或为空串', () => {
    expect(parseFormRequestLine(line({ ...GOOD, requestId: '' }))).toBeNull()
    expect(parseFormRequestLine(line({ ...GOOD, requestId: 1 }))).toBeNull()
    expect(parseFormRequestLine(line({ ...GOOD, kind: '' }))).toBeNull()
    expect(parseFormRequestLine(line({ ...GOOD, kind: undefined }))).toBeNull()
  })

  it('fields 空数组、非数组、或过滤后变空 —— 三种都是"给端上一张填不了的表单"', () => {
    expect(parseFormRequestLine(line({ ...GOOD, fields: [] }))).toBeNull()
    expect(parseFormRequestLine(line({ ...GOOD, fields: 'x' }))).toBeNull()
    expect(parseFormRequestLine(line({ ...GOOD, fields: [{ key: '' }, 3, null] }))).toBeNull()
  })

  it('actions 不成对:只给批准等于替用户做完决定,只给拒绝等于什么都不做', () => {
    expect(parseFormRequestLine(line({ ...GOOD, actions: ['approve'] }))).toBeNull()
    expect(parseFormRequestLine(line({ ...GOOD, actions: ['reject'] }))).toBeNull()
    expect(parseFormRequestLine(line({ ...GOOD, actions: 'approve,reject' }))).toBeNull()
    expect(parseFormRequestLine(line({ ...GOOD, actions: ['approve', 'reject', 7] }))).not.toBeNull()
  })

  it('非本族帧 / 非 JSON / 非 data 行,一律 null 且不抛', () => {
    expect(parseFormRequestLine(line({ ...GOOD, type: 'tool-approval' }))).toBeNull()
    expect(parseFormRequestLine('data: {坏 JSON')).toBeNull()
    expect(parseFormRequestLine(': ping')).toBeNull()
    expect(parseFormRequestLine('event: form_request')).toBeNull()
    expect(parseFormRequestLine('data: [DONE]')).toBeNull()
    expect(parseFormRequestLine('')).toBeNull()
  })

  it('预筛是超集不是判据:真帧必过预筛,别的帧过不了', () => {
    expect(maybeFormRequestLine(line(GOOD))).toBe(true)
    expect(maybeFormRequestLine(line({ type: 'chunk', text: 'hi' }))).toBe(false)
    // 判别值以带引号形态出现在任何位置都能进 parse(随后由 type 判掉),所以预筛不会漏帧
    expect(maybeFormRequestLine(`data: {"x":"${FORM_REQUEST_FRAME_TYPE}"}`)).toBe(true)
    expect(parseFormRequestLine(`data: {"x":"${FORM_REQUEST_FRAME_TYPE}"}`)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
