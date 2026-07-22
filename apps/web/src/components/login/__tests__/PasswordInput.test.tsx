// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, fireEvent, cleanup, screen } from '@testing-library/react'

// Mock next-intl:PasswordInput 用 useTranslations('a11y') 解析切换按钮的 aria-label。
// 单元测试不依赖真实 messages 文件,直接提供 5 语言字面值,验证:
//   1. 默认态 aria-label = "显示密码"(中文)/对应翻译
//   2. 切换后 aria-label 翻转("隐藏密码"/对应翻译)
//   3. aria-pressed 跟随 visible 状态翻转
const { MESSAGES_BY_LOCALE, currentLocale } = vi.hoisted(() => {
  const map: Record<string, Record<string, Record<string, string>>> = {
    'zh-CN': { a11y: { showPassword: '显示密码', hidePassword: '隐藏密码' } },
    en: { a11y: { showPassword: 'Show password', hidePassword: 'Hide password' } },
    ja: { a11y: { showPassword: 'パスワードを表示', hidePassword: 'パスワードを隠す' } },
    ko: { a11y: { showPassword: '비밀번호 표시', hidePassword: '비밀번호 숨기기' } },
    'zh-TW': { a11y: { showPassword: '顯示密碼', hidePassword: '隱藏密碼' } },
  }
  return {
    MESSAGES_BY_LOCALE: map,
    currentLocale: { value: 'zh-CN' as keyof typeof map },
  }
})

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const msgs = MESSAGES_BY_LOCALE[currentLocale.value]?.[ns] ?? {}
    return (key: string) => msgs[key] ?? key
  },
}))

import { PasswordInput } from '../PasswordInput'

describe('PasswordInput 密码显隐切换', () => {
  afterEach(() => {
    cleanup()
    currentLocale.value = 'zh-CN'
  })

  it('默认渲染:type=password,aria-label=显示密码,aria-pressed=false', () => {
    render(<PasswordInput data-testid="pwd" />)
    const input = screen.getByTestId('pwd') as HTMLInputElement
    const toggle = screen.getByTestId('password-toggle')

    expect(input.type).toBe('password')
    expect(toggle.getAttribute('aria-label')).toBe('显示密码')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('点击切换按钮:input.type → text,aria-label → 隐藏密码,aria-pressed → true', () => {
    render(<PasswordInput data-testid="pwd" />)
    const input = screen.getByTestId('pwd') as HTMLInputElement
    const toggle = screen.getByTestId('password-toggle')

    fireEvent.click(toggle)
    expect(input.type).toBe('text')
    expect(toggle.getAttribute('aria-label')).toBe('隐藏密码')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')

    // 再点一次回到隐藏
    fireEvent.click(toggle)
    expect(input.type).toBe('password')
    expect(toggle.getAttribute('aria-label')).toBe('显示密码')
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
  })

  it('接受受控 value + onChange,透传 e.target.value', () => {
    let captured = ''
    render(
      <PasswordInput
        data-testid="pwd"
        value={captured}
        onChange={(e) => {
          captured = e.target.value
        }}
      />,
    )
    const input = screen.getByTestId('pwd') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'secret123' } })
    expect(captured).toBe('secret123')
  })

  it('defaultVisible=true 时初始 type=text', () => {
    render(<PasswordInput data-testid="pwd" defaultVisible />)
    const input = screen.getByTestId('pwd') as HTMLInputElement
    const toggle = screen.getByTestId('password-toggle')
    expect(input.type).toBe('text')
    expect(toggle.getAttribute('aria-label')).toBe('隐藏密码')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
  })

  it('showLabel / hideLabel 自定义 prop 覆盖默认 i18n', () => {
    render(
      <PasswordInput
        data-testid="pwd"
        showLabel="自定义显示"
        hideLabel="自定义隐藏"
      />,
    )
    const toggle = screen.getByTestId('password-toggle')
    expect(toggle.getAttribute('aria-label')).toBe('自定义显示')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-label')).toBe('自定义隐藏')
  })

  it('type=button:点击切换按钮不会触发表单 submit', () => {
    let submitted = false
    render(
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitted = true
        }}
      >
        <PasswordInput data-testid="pwd" />
      </form>,
    )
    fireEvent.click(screen.getByTestId('password-toggle'))
    expect(submitted).toBe(false)
  })

  it('i18n:5 语言切换 aria-label 跟随翻译', () => {
    const cases: Array<{
      locale: 'zh-CN' | 'en' | 'ja' | 'ko' | 'zh-TW'
      showLabel: string
      hideLabel: string
    }> = [
      { locale: 'zh-CN', showLabel: '显示密码', hideLabel: '隐藏密码' },
      { locale: 'en', showLabel: 'Show password', hideLabel: 'Hide password' },
      { locale: 'ja', showLabel: 'パスワードを表示', hideLabel: 'パスワードを隠す' },
      { locale: 'ko', showLabel: '비밀번호 표시', hideLabel: '비밀번호 숨기기' },
      { locale: 'zh-TW', showLabel: '顯示密碼', hideLabel: '隱藏密碼' },
    ]
    for (const { locale, showLabel, hideLabel } of cases) {
      currentLocale.value = locale
      const { unmount } = render(<PasswordInput data-testid="pwd" />)
      const toggle = screen.getByTestId('password-toggle')
      expect(toggle.getAttribute('aria-label')).toBe(showLabel)
      fireEvent.click(toggle)
      expect(toggle.getAttribute('aria-label')).toBe(hideLabel)
      unmount()
    }
  })

  it('ref 转发到底层 input', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(<PasswordInput ref={ref} data-testid="pwd" />)
    expect(ref.current).not.toBeNull()
    expect(ref.current?.type).toBe('password')
  })

  it('外层 className 与默认 pr-10 共存(input 留出右侧切换按钮空间)', () => {
    render(<PasswordInput data-testid="pwd" className="h-10" />)
    const input = screen.getByTestId('pwd')
    const cls = input.getAttribute('class') ?? ''
    expect(cls).toContain('h-10')
    expect(cls).toContain('pr-10')
  })
})
