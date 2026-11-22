// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// D38 插话能力协商 RN 消费端测试(utils/interjection-capability + QueueInteractionBar 接线)
//
// 覆盖两条契约:
// ① **缺失 ⇒ false**:没有声明 / 声明里没这个字段 / 字段非布尔 ⇒ false
//    (与改造前宿主硬编码 false 逐字节同行为,零回归的判据就在这几条上)
// ② **true / false 分别透传**:声明给什么就读什么 —— 组件层的可观测后果是
//    「打断并执行」被许可门放行与否、steer 偏好是否降级(降级句渲染与否)
//
// 注:react-native mock 把 Pressable 渲染成 <button>;RN mock 的 t() 返回键名,
// 故断言走文本(键路径)。React DOM 会丢弃 testID,不按 testID 取元素。
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

vi.mock('../src/i18n', () => {
  const t = (key: string) => key
  return { useI18n: () => ({ t, locale: 'zh-CN', setLocale: async () => {} }) }
})

import {
  INTERJECTION_CAPABILITY_PATHS,
  readInterjectionCapability,
  resolveInterjectionCapability,
} from '../src/utils/interjection-capability'
import { QueueInteractionBar } from '../src/components/ai/QueueInteractionBar'

const DENIED_INTERJECT = 'ai.pane.inputNotices.queue.denied.interject'
const DEGRADED = 'ai.pane.queueOps.degraded.runtimeNoInterject'

describe('插话能力读数(缺失 ⇒ false,零耦合回落)', () => {
  it('① 完全没有声明(null/undefined/空对象/非对象)⇒ false', () => {
    expect(readInterjectionCapability(undefined)).toBe(false)
    expect(readInterjectionCapability(null)).toBe(false)
    expect(readInterjectionCapability({})).toBe(false)
    expect(readInterjectionCapability([])).toBe(false)
    expect(readInterjectionCapability('true')).toBe(false)
    expect(readInterjectionCapability(42)).toBe(false)
  })

  it('① 声明里有别的键、但没能力字段 ⇒ false(不臆造)', () => {
    expect(readInterjectionCapability({ conversationId: 'c-1', model: 'gpt' })).toBe(false)
    expect(readInterjectionCapability({ capabilities: {} })).toBe(false)
    expect(readInterjectionCapability({ capabilities: { compaction: true } })).toBe(false)
  })

  it('① 能力字段是非布尔(字符串/数字/null)⇒ false(把"没判"写成"判过了"那一型要挡住)', () => {
    expect(readInterjectionCapability({ capabilities: { interjection: 'true' } })).toBe(false)
    expect(readInterjectionCapability({ capabilities: { interjection: 1 } })).toBe(false)
    expect(readInterjectionCapability({ runtimeSupportsInterjection: null })).toBe(false)
  })

  it('① 多来源合成:全缺席 ⇒ false;显式 false 覆盖缺席 ⇒ false', () => {
    expect(resolveInterjectionCapability([])).toBe(false)
    expect(resolveInterjectionCapability([null, undefined, {}])).toBe(false)
    expect(resolveInterjectionCapability([{ runtimeSupportsInterjection: false }, null])).toBe(
      false,
    )
  })

  it('② true 透传:任一候选路径命中布尔 true 即 true', () => {
    for (const path of INTERJECTION_CAPABILITY_PATHS) {
      const source: Record<string, unknown> = {}
      const keys = path.split('.')
      let cursor: Record<string, unknown> = source
      keys.forEach((k, i) => {
        cursor[k] = i === keys.length - 1 ? true : {}
        cursor = cursor[k] as Record<string, unknown>
      })
      expect(readInterjectionCapability(source)).toBe(true)
    }
  })

  it('② false 透传:声明显式给 false ⇒ false(不与"缺失"混淆,同为 false)', () => {
    expect(readInterjectionCapability({ runtimeSupportsInterjection: false })).toBe(false)
    expect(readInterjectionCapability({ capabilities: { interjection: false } })).toBe(false)
    // 与"缺失"区分不了结果、也不需要区分:二者都按"不支持插话"处理
    expect(readInterjectionCapability({ runtimeSupportsInterjection: false })).toBe(
      readInterjectionCapability({}),
    )
  })

  it('② 多来源合成:任一来源显式 true ⇒ true(一票放量)', () => {
    expect(
      resolveInterjectionCapability([
        { capabilities: { interjection: false } },
        { capabilities: { interjection: true } },
      ]),
    ).toBe(true)
    expect(resolveInterjectionCapability([null, { runtimeSupportsInterjection: true }])).toBe(true)
  })
})

describe('QueueInteractionBar 能力接线(宿主注入 → 判定面透传)', () => {
  const items = [{ id: 'sq-1', text: '补一条测试' }]

  it('① 不传 runtimeSupportsInterjection(声明缺失)⇒ 回落 false:打断被拒 + steer 降级', () => {
    const onInterruptAndRun = vi.fn()
    const { container, getByText } = render(
      <QueueInteractionBar
        items={items}
        streaming={true}
        mode="steer"
        onInterruptAndRun={onInterruptAndRun}
      />,
    )
    fireEvent.click(getByText('ai.pane.queueOps.interruptAndRun'))
    expect(onInterruptAndRun).not.toHaveBeenCalled()
    expect(container.textContent).toContain(DENIED_INTERJECT)
    // steer 偏好遇不支持插话 ⇒ 显式降级句,不得静默降级
    expect(container.textContent).toContain(DEGRADED)
  })

  it('① 显式传 false ⇒ 同缺失:打断被拒 + steer 降级', () => {
    const onInterruptAndRun = vi.fn()
    const { container, getByText } = render(
      <QueueInteractionBar
        items={items}
        streaming={true}
        mode="steer"
        runtimeSupportsInterjection={false}
        onInterruptAndRun={onInterruptAndRun}
      />,
    )
    fireEvent.click(getByText('ai.pane.queueOps.interruptAndRun'))
    expect(onInterruptAndRun).not.toHaveBeenCalled()
    expect(container.textContent).toContain(DENIED_INTERJECT)
    expect(container.textContent).toContain(DEGRADED)
  })

  it('② 传 true ⇒ 打断并执行放行(回调上抛),且不渲染降级句', () => {
    const onInterruptAndRun = vi.fn()
    const { container, getByText } = render(
      <QueueInteractionBar
        items={items}
        streaming={true}
        mode="steer"
        runtimeSupportsInterjection={true}
        onInterruptAndRun={onInterruptAndRun}
      />,
    )
    fireEvent.click(getByText('ai.pane.queueOps.interruptAndRun'))
    expect(onInterruptAndRun).toHaveBeenCalledTimes(1)
    expect(container.textContent).not.toContain(DENIED_INTERJECT)
    expect(container.textContent).not.toContain(DEGRADED)
  })
})
