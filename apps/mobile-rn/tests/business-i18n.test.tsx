import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { I18nProvider, useI18n, getValueByPath, messages, type Locale } from '../src/i18n'

vi.mock('react-native', () => {
  const mk = (name: string) =>
    function MockComp(props: { children?: ReactNode }) {
      return createElement(name, props, props.children)
    }
  return {
    View: mk('View'),
    Text: mk('Text'),
    ActivityIndicator: mk('ActivityIndicator'),
  }
})

function CapturedText({ path, params }: { path: string; params?: Record<string, string | number> }) {
  const { t } = useI18n()
  const text = params ? t(path, params) : t(path)
  return createElement('Text', { 'data-path': path }, text)
}

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

describe('mobile-rn C 端 i18n 5 语言文案 parity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('5 语言都提供 home.welcome', () => {
    expect(typeof getValueByPath(messages['zh-CN'], 'home.welcome')).toBe('string')
    expect(typeof getValueByPath(messages['en'], 'home.welcome')).toBe('string')
    expect(typeof getValueByPath(messages['ja'], 'home.welcome')).toBe('string')
    expect(typeof getValueByPath(messages['ko'], 'home.welcome')).toBe('string')
    expect(typeof getValueByPath(messages['zh-TW'], 'home.welcome')).toBe('string')
  })

  it('5 语言都提供 course.title + live.title + profile.title + order.title', () => {
    for (const loc of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as Locale[]) {
      const m = messages[loc]
      expect(getValueByPath(m, 'course.title')).toBeTruthy()
      expect(getValueByPath(m, 'live.title')).toBeTruthy()
      expect(getValueByPath(m, 'profile.title')).toBeTruthy()
      expect(getValueByPath(m, 'order.title')).toBeTruthy()
    }
  })

  it('order.status.* 7 状态在 5 语言都存在', () => {
    const statuses = [
      'pending',
      'paid',
      'cancelled',
      'refunding',
      'refunded',
      'completed',
      'failed',
    ] as const
    for (const loc of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as Locale[]) {
      const m = messages[loc]
      for (const s of statuses) {
        const v = getValueByPath(m, `order.status.${s}`)
        expect(v, `${loc}.order.status.${s} missing`).toBeTruthy()
      }
    }
  })

  it('nav.* 5 语言含 home/courses/live/profile', () => {
    for (const loc of ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as Locale[]) {
      const m = messages[loc]
      expect(getValueByPath(m, 'nav.home')).toBeTruthy()
      expect(getValueByPath(m, 'nav.courses')).toBeTruthy()
      expect(getValueByPath(m, 'nav.live')).toBeTruthy()
      expect(getValueByPath(m, 'nav.profile')).toBeTruthy()
    }
  })

  it('zh-CN 文案: 5 人学过 / 128 人观看 / 支付 ¥99.00', async () => {
    const { getByText } = render(
      <>
        <CapturedText path="course.studentCount" params={{ count: 5 }} />
        <CapturedText path="live.viewerCount" params={{ count: 128 }} />
        <CapturedText path="course.pay" params={{ amount: '99.00' }} />
      </>,
      { wrapper },
    )
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(getByText('5 人学过')).toBeTruthy()
    expect(getByText('128 人观看')).toBeTruthy()
    expect(getByText('支付 ¥99.00')).toBeTruthy()
  })
})
