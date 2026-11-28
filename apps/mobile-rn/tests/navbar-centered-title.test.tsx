// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 顶栏标题必须相对**整行**居中,而不是在左右槽之间的剩余空间里居中。
 *
 * 起因(用户实拍 2026-11-23):首页「智汇AI社区」明显偏左,设置页「设置」也偏左。
 * 根因是 center 用了 flex:1 —— 标题中点 = 剩余空间中点,偏移量 =(左槽宽 − 右槽宽)/ 2;
 * 首页左 1 个菜单钮、右 搜索+加入+分享,读数约左偏 42dp。
 *
 * 本用例锁的是**几何结构**:标题层必须四边铺满(flex 分配权被摘掉)、左右槽绝对定位。
 * 不锁像素宽度 —— jsdom 没有布局,锁值会变成"测一个不存在的排版";锁结构才拦得住回退。
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../src/i18n', () => ({
  t: (key: string) => key,
  I18nProvider: ({ children }: { children: unknown }) => children,
  useI18n: () => ({ t: (key: string) => key }),
}))

import { NavBar } from '../src/components/NavBar'
import { Asterisk, Sparkles, Star } from 'lucide-react-native'

/** 取行盒:container(最外层)→ row(左/中/右三槽) */
function rowOf(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild as HTMLElement | null
  const row = root?.firstElementChild as HTMLElement | null
  if (!row) throw new Error('NavBar 没有渲染出行盒')
  return row
}

function px(style: CSSStyleDeclaration, key: 'left' | 'right' | 'top' | 'bottom'): number {
  return Number.parseFloat(style[key] || '0')
}

describe('NavBar 标题层独立居中', () => {
  it('标题层四边铺满整行,左右槽绝对定位(不再用 flex 挤压标题)', () => {
    const { container } = render(<NavBar title="设置" onBack={() => {}} rightText="菜单" />)
    const row = rowOf(container as HTMLElement)
    const left = row.children[0] as HTMLElement
    const center = row.children[1] as HTMLElement
    const right = row.children[2] as HTMLElement

    expect(row.style.position).toBe('relative')
    expect(left.style.position).toBe('absolute')
    expect(right.style.position).toBe('absolute')

    // 关键回归面:标题层若退回 flex:1,这里 position 就不再是 absolute
    expect(center.style.position).toBe('absolute')
    expect(px(center.style, 'left')).toBe(0)
    expect(px(center.style, 'right')).toBe(0)
    expect(px(center.style, 'top')).toBe(0)
    expect(px(center.style, 'bottom')).toBe(0)
    expect(center.style.alignItems).toBe('center')
    expect(center.style.justifyContent).toBe('center')

    // 侧槽各自贴边 10(NAVBAR_SIDE_PADDING_PX),与标题层互不占位
    expect(px(left.style, 'left')).toBe(10)
    expect(px(right.style, 'right')).toBe(10)

    // 标题真的住在这一层,父层的居中才作用到它
    const title = screen.getByText('设置')
    expect(title.parentElement).toBe(center)
  })

  it('左右槽宽度悬殊(右三钮)也不改变标题层几何', () => {
    const { container } = render(
      <NavBar
        title="智汇AI社区"
        onMenuClick={() => {}}
        rightText="菜单"
        rightActions={[
          { icon: Star, onPress: () => {} },
          { icon: Sparkles, onPress: () => {} },
          { icon: Asterisk, onPress: () => {} },
        ]}
      />,
    )
    const row = rowOf(container as HTMLElement)
    const center = row.children[1] as HTMLElement
    expect(center.style.position).toBe('absolute')
    expect(px(center.style, 'left')).toBe(0)
    expect(px(center.style, 'right')).toBe(0)
    expect(px(center.style, 'top')).toBe(0)
    expect(px(center.style, 'bottom')).toBe(0)
    expect((screen.getByText('智汇AI社区') as HTMLElement).parentElement).toBe(center)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
