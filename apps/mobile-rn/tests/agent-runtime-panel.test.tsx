// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { I18nProvider } from '../src/i18n'

vi.mock('@ihui/api-client', () => ({
  executeAgentRuntimeStream: vi.fn().mockResolvedValue(undefined),
}))

/**
 * 不再内联 mock('react-native') / mock('@ihui/ui-native'):
 * 面板已在 packages/app(pnpm 软链目录)下解析 `@ihui/ui-native`,与端内测试文件的模块 id
 * 不同 ⇒ 内联替身拦截不到它,真 Input 的数组 style 会直落 react-dom 并抛
 * "'set' on proxy: trap returned falsish"。改由配置层 alias 的共享替身接住
 * (tests/__mocks__/react-native.ts 已 flattenStyle 数组/函数,ui-native 用真身)。
 */

import { AgentRuntimePanel } from '@ihui/rn-app/features/agent-runtime/AgentRuntimePanel'
import { agentRuntimePanelLabels } from '../src/components/agent-runtime-panel-labels'
import { useI18n } from '../src/i18n'

const wrapper = ({ children }: { children: ReactNode }) => <I18nProvider>{children}</I18nProvider>

/**
 * 端侧接线壳:共享层不自取词,本用例用**端内真 I18nProvider**解析文案后注入,
 * 断言值仍是端内真实词包,不是测试内字面映射。
 */
function Panel() {
  const { t } = useI18n()
  return <AgentRuntimePanel t={t} labels={agentRuntimePanelLabels(t)} />
}

describe('AgentRuntimePanel (mobile-rn)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing in idle state', () => {
    const { container } = render(<Panel />, { wrapper })
    expect(container).toBeTruthy()
  })

  it('renders empty hint text in idle state', () => {
    const { getByText } = render(<Panel />, { wrapper })
    expect(() => getByText('暂无运行记录')).not.toThrow()
  })

  it('renders execute button when not running', () => {
    const { getByText } = render(<Panel />, { wrapper })
    expect(() => getByText('发送')).not.toThrow()
  })
})

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PANEL_SOURCE = readFileSync(
  join(__dirname, '../../../packages/app/src/features/agent-runtime/AgentRuntimePanel.tsx'),
  'utf8',
)

describe('AgentRuntimePanel 共享层落地(阴性对照)', () => {
  it('RN 端从 packages/app 消费,端内私有实现不得复活', () => {
    const screen = readFileSync(join(__dirname, '../src/screens/ShareScreen.tsx'), 'utf8')
    expect(screen).toContain(
      "import { AgentRuntimePanel } from '@ihui/rn-app/features/agent-runtime/AgentRuntimePanel'",
    )
    expect(screen).not.toContain("from '../components/AgentRuntimePanel'")
    // 阴性对照:把面板改回端内私有实现(恢复该文件 / 改回端内 import)⇒ 本用例立即变红
    expect(() =>
      readFileSync(join(__dirname, '../src/components/AgentRuntimePanel.tsx'), 'utf8'),
    ).toThrow()
  })

  it('共享组件零平台 API,注入面(labels.* / t(`…`))必须在场', () => {
    const code = stripComments(PANEL_SOURCE)
    expect(code).not.toMatch(/\bTaro\b/)
    expect(code).not.toMatch(/getStorageSync|setStorageSync|AsyncStorage/)
    expect(code).not.toMatch(/navigateTo|redirectTo/)
    expect(code).not.toMatch(/useI18n|\bwx\./)
    // 阴性对照:摘掉文案注入(labels)或动态取词(t)⇒ 本用例立即变红
    expect(code).toMatch(/labels\.(title|clear|plan|permission|output|error|empty|stop|send)/)
    expect(code).toMatch(/t\(\s*`stepDecision\./)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
