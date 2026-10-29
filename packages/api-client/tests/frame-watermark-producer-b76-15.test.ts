// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * b76-15(2026-10-29 立):seq 维帧水位生产点的判例表。
 *
 * 本表钉的是「没生产点」那一型的修法本身,所以每条都带**反例同表**:
 * 只测"连续帧不丢"测不出缺生产点(旧实现下恒 undetermined 也是"不丢")。
 * 必须同表钉住 `gap` / `invalid` 真的被算出来、且 `undetermined` 不被读成绿。
 */
import { describe, expect, it } from 'vitest'

import {
  carriesPayloadWatermark,
  createFrameSeqTracker,
  __test__,
} from '../src/frame-watermark-producer'

const { parseSeq } = __test__

describe('b76-15 seq 维水位生产点', () => {
  it('parseSeq:只认非负十进制安全整数(六形态正反例同表)', () => {
    expect(parseSeq('1')).toBe(1)
    expect(parseSeq(' 42 ')).toBe(42)
    expect(parseSeq('0')).toBe(0)
    // 反例:非十进制写法 / 负数 / 空 / 非数字 / 超安全整数 —— 一律 null(不猜)
    expect(parseSeq('0x10')).toBeNull()
    expect(parseSeq('1e3')).toBeNull()
    expect(parseSeq('-1')).toBeNull()
    expect(parseSeq('')).toBeNull()
    expect(parseSeq('abc')).toBeNull()
    expect(parseSeq('9007199254740993')).toBeNull()
  })

  it('id 与 data 配对后判连续:baseline → continuous → continuous', () => {
    const t = createFrameSeqTracker()
    expect(t.observeLine('id: 1').kind).toBe('undetermined')
    expect(t.observeLine('data: {"content":"a"}')).toEqual({ kind: 'baseline', seq: 1 })
    expect(t.cursor()).toBe(1)
    t.observeLine('id: 2')
    expect(t.observeLine('data: {"content":"b"}')).toEqual({ kind: 'continuous', seq: 2 })
    expect(t.cursor()).toBe(2)
  })

  it('断档被算出来:expected/actual 点名,且游标不推进', () => {
    const t = createFrameSeqTracker()
    t.observeLine('id: 1')
    t.observeLine('data: {}')
    t.observeLine('id: 5')
    const v = t.observeLine('data: {}')
    expect(v).toEqual({ kind: 'gap', seq: 5, expected: 2, actual: 5 })
    // 游标停在 1 —— 推进就等于把缺口算成"已应用",再也无法自愈
    expect(t.cursor()).toBe(1)
  })

  it('命名帧字段序:id 与 data 之间隔着 event 行,不得销号(网关 emitNamedEvent 真形态)', () => {
    const t = createFrameSeqTracker()
    t.observeLine('id: 7')
    // 中间那行不是载荷 —— 若在此销号,紧随的 data 行永远认领不到 seq
    expect(t.observeLine('event: usage').kind).toBe('undetermined')
    expect(t.observeLine('data: {"type":"usage"}')).toEqual({ kind: 'baseline', seq: 7 })
  })

  it('畸形 id 行判 invalid 且不认领下一行(序号不得张冠李戴)', () => {
    const t = createFrameSeqTracker()
    t.observeLine('id: 3')
    t.observeLine('data: {}')
    expect(t.observeLine('id: abc').kind).toBe('invalid')
    // 畸形 id 已销号 ⇒ 下一行按"没有可配对 id"未判定,绝不借用上一帧的序号
    expect(t.observeLine('data: {}').kind).toBe('undetermined')
    expect(t.cursor()).toBe(3)
  })

  it('没有 id 行 ⇒ undetermined(未判定不等于没问题,也不立基线)', () => {
    const t = createFrameSeqTracker()
    expect(t.observeLine('data: {"content":"hi"}')).toEqual({
      kind: 'undetermined',
      reason: '本行没有可配对的 id 行',
    })
    expect(t.cursor()).toBeNull()
  })

  it('一个 id 只认领一行:第二行没有配对 ⇒ undetermined', () => {
    const t = createFrameSeqTracker()
    t.observeLine('id: 1')
    expect(t.observeLine('data: {}').kind).toBe('baseline')
    expect(t.observeLine('data: {}').kind).toBe('undetermined')
  })

  it('换流(seq 从 1 重开)命中 gap,不靠假代际标识解释', () => {
    const t = createFrameSeqTracker()
    t.observeLine('id: 1')
    t.observeLine('data: {}')
    t.observeLine('id: 2')
    t.observeLine('data: {}')
    // 新会话换流:seq 从 1 重开 —— 就是断档事实,必须被看见
    t.observeLine('id: 1')
    expect(t.observeLine('data: {}')).toEqual({ kind: 'gap', seq: 1, expected: 3, actual: 1 })
  })

  it('carriesPayloadWatermark:四字段齐备才让位 camel/snake 两族各一例', () => {
    expect(
      carriesPayloadWatermark({ subscriptionId: 's', logEpoch: 1, fromSeq: 0, toSeq: 1 }),
    ).toBe(true)
    expect(carriesPayloadWatermark({ subscription_id: 's', log_epoch: 1, from_seq: 0, to_seq: 1 })).toBe(
      true,
    )
    // 三缺一 ⇒ 不算在场(部分字段不是"有一点",是未判定)
    expect(carriesPayloadWatermark({ subscriptionId: 's', logEpoch: 1, fromSeq: 0 })).toBe(false)
    expect(carriesPayloadWatermark(null)).toBe(false)
    expect(carriesPayloadWatermark([])).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
