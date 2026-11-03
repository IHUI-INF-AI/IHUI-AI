// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D106 收尾:steer 历史读回映射(readSteerAppliedFromMetadata)。
// api 侧已把 onSteer 载荷落库 chat_messages.metadata.steerApplied(形状 [{text, timestamp?}]),
// 本测试锁住读回映射的守卫口径(对齐 web readSteerAppliedFromMetadata):
//   - 数组才采,非数组/空数组 → undefined
//   - 逐条 text 必须非空字符串(非对象/缺 text/空文本/纯空白整条丢弃)
//   - timestamp 仅 string 才带(缺省不写空字段)
//   - phase 恒 'injected';复用 appendSteerFrames → 单消息 8 条封顶
//   - 全坏 → undefined,不渲染空态
import { describe, expect, it } from 'vitest'

import {
  STEER_NOTICE_MAX_PER_MESSAGE,
  readSteerAppliedFromMetadata,
} from '../src/utils/chat-render-model'

describe('readSteerAppliedFromMetadata(D106 收尾:历史读回映射)', () => {
  it('合法数组 → SteerNotice[],phase 恒 injected,text/timestamp 逐字段承接', () => {
    const out = readSteerAppliedFromMetadata([
      { text: '回答时优先引用项目内文档', timestamp: '2026-09-24T08:00:00.000Z' },
      { text: '语气再正式一点' },
    ])
    expect(out).toEqual([
      {
        phase: 'injected',
        text: '回答时优先引用项目内文档',
        timestamp: '2026-09-24T08:00:00.000Z',
      },
      { phase: 'injected', text: '语气再正式一点' },
    ])
  })

  it('非数组(undefined/null/对象/字符串)→ undefined,不写字段', () => {
    expect(readSteerAppliedFromMetadata(undefined)).toBeUndefined()
    expect(readSteerAppliedFromMetadata(null)).toBeUndefined()
    expect(readSteerAppliedFromMetadata({ text: '伪装对象' })).toBeUndefined()
    expect(readSteerAppliedFromMetadata('steer')).toBeUndefined()
  })

  it('空数组 → undefined,不渲染空态', () => {
    expect(readSteerAppliedFromMetadata([])).toBeUndefined()
  })

  it('坏项逐条剔除:非对象 / 缺 text / 空文本 / 纯空白 / text 非字符串', () => {
    const out = readSteerAppliedFromMetadata([
      null,
      42,
      'steer',
      {},
      { text: '' },
      { text: '   \n\t ' },
      { text: 123 },
      { text: '合法引导' },
    ])
    expect(out).toEqual([{ phase: 'injected', text: '合法引导' }])
  })

  it('全坏 → undefined(与"合法但为空"同判据,不给渲染层造空数组)', () => {
    expect(readSteerAppliedFromMetadata([{ text: '' }, { foo: 'bar' }, null])).toBeUndefined()
  })

  it('timestamp 仅 string 才带:数字/对象/空串一律不写 timestamp 键', () => {
    const out = readSteerAppliedFromMetadata([
      { text: 'a', timestamp: 1727164800000 },
      { text: 'b', timestamp: { iso: '2026-09-24' } },
      { text: 'c', timestamp: '' },
    ])
    expect(out).toHaveLength(3)
    for (const notice of out ?? []) {
      expect('timestamp' in notice).toBe(false)
    }
  })

  it(`超过 ${STEER_NOTICE_MAX_PER_MESSAGE} 条封顶(复用 appendSteerFrames 口径),只留前 8 条`, () => {
    const raw = Array.from({ length: STEER_NOTICE_MAX_PER_MESSAGE + 3 }, (_, i) => ({
      text: `引导 ${i}`,
    }))
    const out = readSteerAppliedFromMetadata(raw)
    expect(out).toHaveLength(STEER_NOTICE_MAX_PER_MESSAGE)
    expect(out?.map((x) => x.text)).toEqual(
      Array.from({ length: STEER_NOTICE_MAX_PER_MESSAGE }, (_, i) => `引导 ${i}`),
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
