// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D64④ 后台子任务 — extension 端消费 element-pack 判定层的定向回归(H18 跨端消费矩阵)。
 *
 * 断言:状态点色档不再由端内手写 switch 决定,而是
 * backgroundTaskView(fromAgentStatus(status)).tone 的确定性映射;
 * 面板初始(idle)渲染的圆点 class 与该判据一致。
 */
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
  agentStatusDotClass,
} from '../entrypoints/sidepanel/components/AgentRuntimePanel'
import { backgroundTaskView, fromAgentStatus } from '@ihui/shared/chat/element-pack'

const TONE_EXPECTED_CLASS: Record<string, string> = {
  neutral: 'bg-muted-foreground',
  info: 'bg-primary',
  success: 'bg-success',
  danger: 'bg-destructive',
}

describe('D64④ AgentRuntimePanel × element-pack', () => {
  it('四态色档逐位等于共享层 backgroundTaskView tone 派发(无端内第二判据)', () => {
    for (const s of ['idle', 'running', 'completed', 'failed'] as const) {
      const tone = backgroundTaskView(fromAgentStatus(s)).tone
      expect(agentStatusDotClass(s)).toBe(TONE_EXPECTED_CLASS[tone])
    }
    // 判据本身:running→info(可停),completed→success,failed→danger(可重试)
    expect(backgroundTaskView(fromAgentStatus('running'))).toMatchObject({
      tone: 'info',
      action: 'stop',
      busy: true,
    })
    expect(backgroundTaskView(fromAgentStatus('failed'))).toMatchObject({
      tone: 'danger',
      action: 'retry',
      terminal: true,
    })
  })

  it('面板初始 idle 渲染的中性点与判据同源', () => {
    const html = renderToStaticMarkup(<AgentRuntimePanel agentId="test-agent-d64" />)
    expect(html).toContain('bg-muted-foreground')
    expect(html).toContain(agentStatusDotClass('idle'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
