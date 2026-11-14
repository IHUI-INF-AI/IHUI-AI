// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import { parseSSEChunk } from '../sse-parse'

function one(line: string) {
  const { events } = parseSSEChunk(`data: ${line}\n`)
  return events[0]
}

/**
 * question-resolved(提问结算帧)两端同源锁。
 *
 * 立因(2026-11-13 实测):api-client 自 2026-11-08 起就解析这一帧(client.ts:4684
 * `tryParseQuestionResolved`),而 shared 的 sse-parse **完全没接** —— 小程序端走
 * sse-parse 这条腿,于是提问被回答/超时/撤回/打断后永远收不到结算,界面上的问题卡
 * 停在"待回答"不变(用户以为还能点,点了也没反应)。
 * 守门 `scripts/check-sse-parser-parity.mjs` 把它报成「api-client 已解析但 sse-parse
 * 未解析 ⇒ 小程序端会静默丢帧」,本册是该帧在解析层的接线锁。
 *
 * 判据方向刻意与 api-client 逐字对齐(同一个四值 status 白名单、同一套结构校验),
 * 而不是"尽量宽松地收下" —— 旧/坏帧能伪造终态的代价比丢帧更大。
 */
describe('sse-parse question-resolved 帧(与 api-client 同源)', () => {
  it('四值 status 全部认领,并原样带出 questionId', () => {
    for (const status of ['answered', 'timeout', 'withdrawn', 'interrupted'] as const) {
      const evt = one(`{"type":"question-resolved","questionId":"q_1","status":"${status}"}`)
      expect(evt?.type).toBe('question-resolved')
      expect(evt?.questionResolved?.status).toBe(status)
      expect(evt?.questionResolved?.questionId).toBe('q_1')
    }
  })

  it('answered 带上选择项与自定义文本;非字符串项被逐条剔除(不整帧丢弃)', () => {
    const evt = one(
      '{"type":"question-resolved","questionId":"q_2","status":"answered","selectedOptionIds":["a","b",3,null],"customText":"我的回答"}',
    )
    expect(evt?.questionResolved?.selectedOptionIds).toEqual(['a', 'b'])
    expect(evt?.questionResolved?.customText).toBe('我的回答')
  })

  it('缺席 selectedOptionIds ⇒ 空数组(不是 undefined);customText 缺席 ⇒ 不带键', () => {
    const evt = one('{"type":"question-resolved","questionId":"q_3","status":"timeout"}')
    expect(evt?.questionResolved?.selectedOptionIds).toEqual([])
    expect(Object.prototype.hasOwnProperty.call(evt?.questionResolved ?? {}, 'customText')).toBe(
      false,
    )
  })

  it('未知 status 不认领 —— 旧/坏帧不得伪造终态', () => {
    const evt = one('{"type":"question-resolved","questionId":"q_4","status":"pending-new"}')
    expect(evt?.type).not.toBe('question-resolved')
    expect(evt?.questionResolved).toBeUndefined()
  })

  it('questionId 缺失或空串不认领', () => {
    expect(one('{"type":"question-resolved","status":"answered"}')?.questionResolved).toBeUndefined()
    expect(
      one('{"type":"question-resolved","questionId":"","status":"answered"}')?.questionResolved,
    ).toBeUndefined()
  })

  it('与 question(提问)帧互不误认:两者判别键不同', () => {
    const asked = one('{"type":"question","question":{"id":"q_5","text":"选一个"}}')
    expect(asked?.type).toBe('question')
    expect(asked?.questionResolved).toBeUndefined()
    const resolved = one('{"type":"question-resolved","questionId":"q_5","status":"answered"}')
    expect(resolved?.type).toBe('question-resolved')
    expect(resolved?.question).toBeUndefined()
  })
})
