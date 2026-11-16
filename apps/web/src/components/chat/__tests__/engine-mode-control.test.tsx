// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * EngineModeControl — AI 面板标题栏引擎切换控件测试(2026-11-15)。
 *
 * 锁定的行为:
 *  1. 渲染 testid=engine-mode-control 容器 + 内含 EngineModeToggle(role=radiogroup)。
 *  2. 当前 mode 对应的按钮 aria-checked=true。
 *  3. 点另一档 → setMode 被调(经 store 桥接同步全局单例)。
 *  4. disabled=true 时按钮不可点。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

import { getGlobalEngineMode, setGlobalEngineMode } from '@ihui/shared'
import { EngineModeControl } from '../engine-mode-button'
import { useEngineModeStore } from '@/stores/engine-mode'

// i18n 改造(2026-11-15)后组件走 next-intl;mock 取词函数返回中文引擎标签,
// 匹配下方断言用到的「本地/云端/自动」可访问名(与生产 zh-CN 语言包一致)。
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: 'agent 执行引擎',
      local: '本地',
      cloud: '云端',
      auto: '自动',
    }
    return map[key] ?? key
  },
}))

describe('EngineModeControl(标题栏引擎切换)', () => {
  beforeEach(() => {
    useEngineModeStore.setState({ mode: 'auto' })
    setGlobalEngineMode('auto')
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('渲染容器 + radiogroup,当前档 aria-checked', () => {
    render(<EngineModeControl />)
    const control = screen.getByTestId('engine-mode-control')
    expect(control).toBeTruthy()
    const group = screen.getByRole('radiogroup')
    expect(group).toBeTruthy()
    // 默认 auto:对应「自动」按钮被选中
    const autoBtn = screen.getByRole('radio', { name: '自动' })
    expect(autoBtn.getAttribute('aria-checked')).toBe('true')
  })

  it('点「本地」→ store + 全局单例同步为 local', () => {
    render(<EngineModeControl />)
    const localBtn = screen.getByRole('radio', { name: '本地' })
    fireEvent.click(localBtn)
    expect(useEngineModeStore.getState().mode).toBe('local')
    expect(getGlobalEngineMode()).toBe('local')
  })

  it('disabled=true 时按钮禁用不可点', () => {
    render(<EngineModeControl disabled />)
    const localBtn = screen.getByRole('radio', { name: '本地' })
    expect((localBtn as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(localBtn)
    // 禁用态点击不改模式
    expect(useEngineModeStore.getState().mode).toBe('auto')
  })

  it('mode 从 store 变化时选中态跟随(受控)', () => {
    const { unmount } = render(<EngineModeControl />)
    useEngineModeStore.setState({ mode: 'cloud' })
    expect(useEngineModeStore.getState().mode).toBe('cloud')
    unmount()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
