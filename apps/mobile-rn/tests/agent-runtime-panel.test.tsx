import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('react-native', () => {
  const mk = (name: string) =>
    function MockComp(props: { children?: ReactNode }) {
      return createElement(name, props, props.children)
    }
  return {
    View: mk('View'),
    Text: mk('Text'),
    TextInput: mk('TextInput'),
    Pressable: mk('Pressable'),
    ScrollView: mk('ScrollView'),
    ActivityIndicator: mk('ActivityIndicator'),
  }
})

import { AgentRuntimePanel } from '../src/components/AgentRuntimePanel'

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

describe('AgentRuntimePanel (mobile-rn)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing in idle state', () => {
    const { container } = render(<AgentRuntimePanel />, { wrapper })
    expect(container).toBeTruthy()
  })

  it('renders empty hint text in idle state', () => {
    const { getByText } = render(<AgentRuntimePanel />, { wrapper })
    expect(() => getByText('输入任务,开始 Agent 执行')).not.toThrow()
  })

  it('renders execute button when not running', () => {
    const { getByText } = render(<AgentRuntimePanel />, { wrapper })
    expect(() => getByText('执行')).not.toThrow()
  })
})
