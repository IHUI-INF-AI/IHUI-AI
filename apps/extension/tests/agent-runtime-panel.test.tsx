// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn(),
  sendToolApprovalResponse: vi.fn(),
  getWorkspacePermissionDefault: vi.fn(() => Promise.resolve({ success: false })),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'zh-CN' as const,
    setLocale: () => {},
  }),
}))

import {
  AgentRuntimePanel,
  WorkspacePermissionTierRow,
} from '../entrypoints/sidepanel/components/AgentRuntimePanel'

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

describe('WorkspacePermissionTierRow(D111:权限档交代行)', () => {
  it('有档位时出档名与后果两段词表键(取词走共享 permissionTierWordKeys)', () => {
    const html = renderToStaticMarkup(<WorkspacePermissionTierRow tier="accept-edits" />)
    expect(html).toContain('workspace-permission-tier')
    expect(html).toContain('permissionTier.label')
    expect(html).toContain('permissionTier.mode.accept-edits.title')
    expect(html).toContain('permissionTier.mode.accept-edits.desc')
  })

  it('未知档落 unknown 键,绝不显示成 default 档(授权误导防线)', () => {
    const html = renderToStaticMarkup(<WorkspacePermissionTierRow tier="yolo" />)
    expect(html).toContain('permissionTier.mode.unknown.title')
    expect(html).not.toContain('permissionTier.mode.default.title')
  })

  it('tier=null(取数失败)整行不渲染 —— 不假装知道档位', () => {
    const html = renderToStaticMarkup(<WorkspacePermissionTierRow tier={null} />)
    expect(html).not.toContain('workspace-permission-tier')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
