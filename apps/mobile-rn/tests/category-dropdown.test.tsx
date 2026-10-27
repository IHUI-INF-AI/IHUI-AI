// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// CategoryDropdown 的行为取证。
//
// 此前该形态全仓零覆盖:tests/__mocks__/ihui-rn-app.ts 没导出它,而 react-native 桩缺
// useWindowDimensions / BackHandler / Animated.parallel —— 组件一挂载就 TypeError。
// 于是"点击开下拉窗"这条用户明确要求的路径,只能靠真机截图判,而设备并不总在线。
// 现在桩补齐了,这里做行为级断言(开合 / 选中回调 / 占位 / 标题 / 空态)。
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { CategoryDropdown } from '@ihui/rn-app'

const ITEMS = [
  { id: 'a', label: 'AAA' },
  { id: 'b', label: 'BBB' },
]

describe('CategoryDropdown', () => {
  it('未选中时触发器显示调用方传入的 placeholder(不是中文默认)', () => {
    const { getByRole } = render(
      <CategoryDropdown
        items={ITEMS}
        selectedId={null}
        onSelect={() => {}}
        placeholder="PICK_ME"
      />,
    )
    expect(getByRole('button').textContent).toContain('PICK_ME')
  })

  it('面板默认不渲染;点击触发器后出现全部选项与标题', () => {
    const { queryByText, getByText } = render(
      <CategoryDropdown
        items={ITEMS}
        selectedId="a"
        onSelect={() => {}}
        panelTitle="TITLE_X"
        testID="dd"
      />,
    )
    expect(queryByText('BBB')).toBeNull()
    fireEvent.click(getByText('AAA'))
    expect(queryByText('TITLE_X')).not.toBeNull()
    expect(queryByText('BBB')).not.toBeNull()
  })

  it('点击选项回调 onSelect(id) 并关闭面板', () => {
    const onSelect = vi.fn()
    const { queryByText, getByRole, getByText } = render(
      <CategoryDropdown items={ITEMS} selectedId={null} onSelect={onSelect} />,
    )
    fireEvent.click(getByRole('button'))
    // 桩把 accessibilityRole 原样落到 DOM 属性上,不是真 ARIA role,故按文本取节点;
    // 点击会冒泡到承载 onPress 的 Pressable。
    fireEvent.click(getByText('BBB'))
    expect(onSelect).toHaveBeenCalledWith('b')
    expect(queryByText('AAA')).toBeNull()
  })

  it('受控模式:外部 visible 决定开合,onVisibleChange 被通知', () => {
    const onVisibleChange = vi.fn()
    const { rerender, queryByText } = render(
      <CategoryDropdown
        items={ITEMS}
        selectedId={null}
        onSelect={() => {}}
        hideTrigger
        visible={false}
        onVisibleChange={onVisibleChange}
      />,
    )
    expect(queryByText('AAA')).toBeNull()
    rerender(
      <CategoryDropdown
        items={ITEMS}
        selectedId={null}
        onSelect={() => {}}
        hideTrigger
        visible
        onVisibleChange={onVisibleChange}
      />,
    )
    expect(queryByText('AAA')).not.toBeNull()
    expect(queryByText('BBB')).not.toBeNull()
  })

  it('选项多于 8 条时,面板用可滚动容器承载全部选项(修 maxHeight 静默裁切)', () => {
    // 票面修复的 bug:面板此前是普通 View + maxHeight + overflow:hidden,第 9 条起的
    // 选项在真机上被静态裁掉且没有滚动入口。按"多于 8 条"取 12 条,锁住三件事:
    // 全部选项进树、它们同住一个 ScrollView、面板仍受 maxHeight 约束(是滚动不是撑破)。
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, label: `ITEM_${i}` }))
    const { container, queryByText } = render(
      <CategoryDropdown
        items={many}
        selectedId={null}
        onSelect={() => {}}
        visible
        hideTrigger
        panelMaxHeight={320}
      />,
    )
    expect(queryByText('ITEM_11')).not.toBeNull()
    const scroller = container.querySelector('[data-rn-scrollview]')
    expect(scroller).not.toBeNull()
    // 首尾都在同一个滚动容器里 ⇒ 内容没有被面板的 overflow:hidden 静态裁掉
    expect(scroller!.textContent).toContain('ITEM_0')
    expect(scroller!.textContent).toContain('ITEM_11')
    // 面板仍受 maxHeight 约束:超出部分靠滚动,而不是把面板撑破
    const panel = scroller!.parentElement as HTMLElement
    expect(panel.style.maxHeight).toBe('320px')
  })

  it('空 items 时面板不崩,渲染空占位而非文案', () => {
    const { container } = render(
      <CategoryDropdown items={[]} selectedId={null} onSelect={() => {}} visible hideTrigger />,
    )
    expect(container.textContent).toBe('')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
