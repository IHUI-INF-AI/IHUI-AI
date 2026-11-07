// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 门 285 B 组:NavBar 20 条小程序专属离散槽位在 RN 侧真实现。
// 本测试逐槽位点击,断言每个 prop 都真的驱动渲染/回调,而不是只加声明。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

import { NavBar } from '../src/components/NavBar'

describe('NavBar ai-home 离散槽位真消费', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('showBack=false 时默认变体不出返回键;true 时出', () => {
    const onBack = vi.fn()
    const { rerender } = render(<NavBar title="T" onBack={onBack} showBack={false} />)
    expect(screen.queryByLabelText('common.back')).toBeNull()
    rerender(<NavBar title="T" onBack={onBack} showBack />)
    expect(screen.getByLabelText('common.back')).toBeTruthy()
  })

  it('bgColor / textColor 落到容器与标题墨迹', () => {
    const { container } = render(<NavBar title="T" bgColor="#f0f0f0" textColor="#112233" />)
    expect((container.firstChild as HTMLElement).style.backgroundColor).not.toBe('')
    expect((screen.getByText('T') as HTMLElement).style.color).not.toBe('')
  })

  it('rightText/onRightClick、notification/onClose 真回调', () => {
    const onRightClick = vi.fn()
    const onClose = vi.fn()
    render(
      <NavBar
        title="T"
        rightText="设置"
        onRightClick={onRightClick}
        notification={{ text: '通知文案', onClose }}
      />,
    )
    fireEvent.click(screen.getByText('设置'))
    expect(onRightClick).toHaveBeenCalledTimes(1)
    expect(screen.getByText('通知文案')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('common.close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ai-home:菜单/加入/分类/搜索/反馈五个槽位点击各自回调', () => {
    const onMenuClick = vi.fn()
    const onJoinClick = vi.fn()
    const onFenLeiClick = vi.fn()
    const onSearchClick = vi.fn()
    const onFeedbackClick = vi.fn()
    render(
      <NavBar
        variant="ai-home"
        title="T"
        menuIcon="☰"
        onMenuClick={onMenuClick}
        joinText="JOIN"
        onJoinClick={onJoinClick}
        showFenLei
        onFenLeiClick={onFenLeiClick}
        showSearch
        onSearchClick={onSearchClick}
        showFeedback
        onFeedbackClick={onFeedbackClick}
      />,
    )
    fireEvent.click(screen.getByText('☰'))
    fireEvent.click(screen.getByText('JOIN'))
    fireEvent.click(screen.getByLabelText('NavBar.fenlei'))
    fireEvent.click(screen.getByLabelText('common.search'))
    fireEvent.click(screen.getByLabelText('NavBar.feedback'))
    expect(onMenuClick).toHaveBeenCalledTimes(1)
    expect(onJoinClick).toHaveBeenCalledTimes(1)
    expect(onFenLeiClick).toHaveBeenCalledTimes(1)
    expect(onSearchClick).toHaveBeenCalledTimes(1)
    expect(onFeedbackClick).toHaveBeenCalledTimes(1)
  })

  it('onPack 返回首页与 activeTitleIndex/onActiveNav 标题切换', () => {
    const onPack = vi.fn()
    const onActiveNav = vi.fn()
    render(
      <NavBar
        variant="ai-home"
        title="T"
        onPack={onPack}
        activeTitleIndex={0}
        onActiveNav={onActiveNav}
      />,
    )
    fireEvent.click(screen.getByLabelText('common.back'))
    fireEvent.click(screen.getByText('ranking.title'))
    expect(onPack).toHaveBeenCalledTimes(1)
    expect(onActiveNav).toHaveBeenCalledWith(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
