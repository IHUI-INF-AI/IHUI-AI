import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn(),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'zh-CN' as const,
    setLocale: () => {},
  }),
}))

import { AgentRuntimePanel } from '../entrypoints/sidepanel/components/AgentRuntimePanel'

describe('AgentRuntimePanel', () => {
  it('mounts without crashing', () => {
    const html = renderToStaticMarkup(<AgentRuntimePanel agentId="test-agent-1" />)
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('agent-runtime-panel')
  })

  it('renders textarea and send button in idle state', () => {
    const html = renderToStaticMarkup(<AgentRuntimePanel agentId="test-agent-2" />)
    expect(html).toContain('agent-runtime-input')
    expect(html).toContain('agent-runtime-send')
    expect(html).toContain('agent-runtime-panel')
  })
})
