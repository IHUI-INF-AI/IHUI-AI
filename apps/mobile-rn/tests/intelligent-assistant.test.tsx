import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { type ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react')
  const mk = (name: string) =>
    function MockComp(props: {
      children?: ReactNode
      style?: unknown
      onPress?: () => void
      [k: string]: unknown
    }) {
      const { style, onPress, ...rest } = props
      const mergedStyle = Array.isArray(style)
        ? Object.assign({}, ...(style.filter(Boolean) as Record<string, unknown>[]))
        : style
      return h(name, { ...rest, onClick: onPress, style: mergedStyle }, props.children)
    }
  return {
    View: mk('div'),
    Text: mk('span'),
    TouchableOpacity: mk('button'),
    Image: mk('img'),
    StyleSheet: { create: (s: Record<string, unknown>) => s },
  }
})

import IntelligentAssistant from '../src/components/IntelligentAssistant'

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

describe('IntelligentAssistant (mobile-rn)', () => {
  it('renders without crashing with default props', () => {
    const { container } = render(<IntelligentAssistant />, { wrapper })
    expect(container).toBeTruthy()
  })

  it('displays default token quantity as 0', () => {
    const { getByText } = render(<IntelligentAssistant />, { wrapper })
    expect(getByText('剩余智汇值:')).toBeTruthy()
    expect(getByText('0')).toBeTruthy()
  })

  it('formats token quantity >= 10000 as "万"', () => {
    const { getByText } = render(<IntelligentAssistant tokenQuantity={15000} />, { wrapper })
    expect(getByText('1.5万')).toBeTruthy()
  })

  it('shows recharge button when onRecharge is provided', () => {
    const { getByText } = render(<IntelligentAssistant onRecharge={() => {}} />, { wrapper })
    expect(() => getByText('充值')).not.toThrow()
  })

  it('hides recharge button when onRecharge is not provided', () => {
    const { queryByText } = render(<IntelligentAssistant />, { wrapper })
    expect(queryByText('充值')).toBeNull()
  })

  it('renders welcome text', () => {
    const { getByText } = render(<IntelligentAssistant />, { wrapper })
    expect(getByText('Hi, 我是您的AI助手小方👋')).toBeTruthy()
    expect(getByText('用AI.找AI.学AI到AI智汇社区就够了')).toBeTruthy()
  })

  it('renders floating decoration image when robotImage provided', () => {
    const { container } = render(
      <IntelligentAssistant robotImage="https://example.com/xiaofang.png" />,
      { wrapper },
    )
    const images = container.querySelectorAll('img')
    expect(images.length).toBe(1)
  })

  it('does not render decoration when robotImage is omitted', () => {
    const { container } = render(<IntelligentAssistant />, { wrapper })
    const images = container.querySelectorAll('img')
    expect(images.length).toBe(0)
  })
})
