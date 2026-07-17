import { describe, it, expect, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@tarojs/components', () => {
  const make = (tag: string) => {
    const Comp = (props: Record<string, unknown>) => createElement(tag, props)
    Comp.displayName = `TaroStub_${tag}`
    return Comp
  }
  return {
    View: make('div'),
    Text: make('span'),
    Textarea: make('textarea'),
    Button: make('button'),
    ScrollView: make('div'),
  }
})

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn(async () => {}),
}))

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tList: () => [],
    locale: 'zh-CN',
    setLocale: () => {},
  }),
}))

import AgentRuntimePanel from '../src/components/AgentRuntimePanel'

describe('AgentRuntimePanel smoke', () => {
  it('default export is a function component', () => {
    expect(typeof AgentRuntimePanel).toBe('function')
  })

  it('mounts without crashing in idle state', () => {
    const html = renderToStaticMarkup(createElement(AgentRuntimePanel, {}))
    expect(html).toContain('ai.agentDetail.runtimeTitle')
    expect(html).toContain('ai.agentDetail.runtimeEmpty')
  })

  it('renders session id short prefix when sessionId provided', () => {
    const html = renderToStaticMarkup(
      createElement(AgentRuntimePanel, { sessionId: 'sess-12345678-abc' }),
    )
    expect(html).toContain('#sess-12')
  })
})
