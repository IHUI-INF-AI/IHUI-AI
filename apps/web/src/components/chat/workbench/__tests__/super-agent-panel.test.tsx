// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RP-43 超工值守面板(web):
 * ① hook 只走控制面既有端点(panel / stop / recorded accept),不私拼路径;
 * ② 投影语义:无单不编内容;要人处理单给"停止";记账单按三值建议显示并能点名开工;
 * ③ quietDrops=0 不出健康行(不拿 0 冒充"有过静默")。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `[${key}]`,
  useLocale: () => 'zh-CN',
}))

const panelState = {
  needsPerson: [] as unknown[],
  quietDrops: 0,
  recorded: 0,
  pendingRecords: [] as unknown[],
}

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async (url: string, options?: { method?: string; body?: string }) => {
    if (url === '/super-agent/panel' && !options?.method) {
      return { success: true, data: { ...panelState } }
    }
    return { success: true, data: { disposition: 'accepted' } }
  }),
}))

import { fetchApi } from '@/lib/api'
import { SuperAgentPanel } from '@/components/chat/workbench/super-agent-panel'

afterEach(cleanup)

beforeEach(() => {
  vi.mocked(fetchApi).mockClear()
  panelState.needsPerson = []
  panelState.pendingRecords = []
  panelState.quietDrops = 0
  panelState.recorded = 0
})

function lastPanelRead(): string {
  const call = vi.mocked(fetchApi).mock.calls.find((c) => c[0] === '/super-agent/panel')
  if (!call) throw new Error('面板腿未被调用')
  return call[0] as string
}

function lastWriteCall(): [string, { method?: string; body?: string }] {
  const posts = vi
    .mocked(fetchApi)
    .mock.calls.filter((c) => (c[1] as { method?: string } | undefined)?.method === 'POST')
  const last = posts.at(-1)
  if (!last) throw new Error('没有 POST 写腿')
  return [last[0] as string, last[1] as { method?: string; body?: string }]
}

describe('SuperAgentPanel 投影与控制面端点纪律', () => {
  it('挂载即拉面板;空账 ⇒ 计数 0,正文区缺席(没有单就不编内容)', async () => {
    const { container } = render(<SuperAgentPanel />)
    await waitFor(() => expect(vi.mocked(fetchApi).mock.calls.length).toBeGreaterThan(0))
    expect(lastPanelRead()).toBe('/super-agent/panel')
    const count = container.querySelector('[data-super-agent-count]')
    expect(count?.textContent).toBe('0')
    expect(container.querySelector('[data-super-agent-body]')).toBeNull()
  })

  it('人工展开空账 ⇒ 只出空态文案,不造假单', async () => {
    const { container } = render(<SuperAgentPanel />)
    await waitFor(() => expect(container.querySelector('[data-super-agent-toggle]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-super-agent-toggle]') as HTMLElement)
    const body = container.querySelector('[data-super-agent-body]')
    expect(body).not.toBeNull()
    expect(body?.querySelector('[data-super-agent-ticket]')).toBeNull()
  })

  it('要人处理单:交付失败行 ⇒ 停止走 POST /tickets/:id/stop', async () => {
    panelState.needsPerson = [
      {
        ticketId: 't1',
        stage: { stage: 'person', action: 'delivery' },
        attention: null,
        scope: '把登录页 500 修一下',
        sessionId: 'w1',
        directory: 'd1',
      },
    ]
    const { container } = render(<SuperAgentPanel />)
    await waitFor(() =>
      expect(container.querySelector('[data-super-agent-ticket="t1"]')).not.toBeNull(),
    )
    fireEvent.click(container.querySelector('[data-super-agent-ticket="t1"] button') as HTMLElement)
    await waitFor(() => expect(vi.mocked(fetchApi).mock.calls.length).toBeGreaterThan(1))
    const [url, opts] = lastWriteCall()
    expect(url).toBe('/super-agent/tickets/t1/stop')
    expect(opts?.method).toBe('POST')
    expect(JSON.parse(String(opts?.body)).reason).toBeTruthy()
  })

  it('记账单三值建议:act ⇒ 徽章 + 点名开工走 POST /recorded/:id/accept 且 ruleId=model-slow-path', async () => {
    panelState.pendingRecords = [
      {
        id: 'e1',
        text: '登录页又炸了有人吗',
        reason: 'inferred',
        decision: { verdict: 'act', reason: '求助', at: 1 },
      },
    ]
    const { container } = render(<SuperAgentPanel />)
    await waitFor(() =>
      expect(container.querySelector('[data-super-agent-record="e1"]')).not.toBeNull(),
    )
    const row = container.querySelector('[data-super-agent-record="e1"]') as HTMLElement
    expect(row.dataset.verdict).toBe('act')
    expect(row.textContent).toContain('[superAgentVerdictAct]')
    fireEvent.click(row.querySelectorAll('button')[0] as HTMLElement)
    await waitFor(() => expect(vi.mocked(fetchApi).mock.calls.length).toBeGreaterThan(1))
    const [url, opts] = lastWriteCall()
    expect(url).toBe('/super-agent/recorded/e1/accept')
    expect(JSON.parse(String(opts?.body))).toEqual({ ruleId: 'model-slow-path' })
  })

  it('ignore 建议只读展示不自动开工;行上只给点名按钮(人是最终门)', async () => {
    panelState.pendingRecords = [
      {
        id: 'e2',
        text: '周报已发',
        reason: 'inferred',
        decision: { verdict: 'ignore', reason: '通知', at: 1 },
      },
    ]
    const { container } = render(<SuperAgentPanel />)
    await waitFor(() =>
      expect(container.querySelector('[data-super-agent-record="e2"]')).not.toBeNull(),
    )
    const row = container.querySelector('[data-super-agent-record="e2"]') as HTMLElement
    expect(row.dataset.verdict).toBe('ignore')
    expect(row.textContent).toContain('[superAgentVerdictIgnore]')
    // mount 拉面板之外没有第三条写腿:自动路径零 POST
    const posts = vi
      .mocked(fetchApi)
      .mock.calls.filter((c) => (c[1] as { method?: string })?.method === 'POST')
    expect(posts).toHaveLength(0)
  })

  it('quietDrops>0 才出健康行(展开后);=0 不拿零冒充有过静默', async () => {
    panelState.quietDrops = 7
    const { container } = render(<SuperAgentPanel />)
    await waitFor(() => expect(container.querySelector('[data-super-agent-toggle]')).not.toBeNull())
    fireEvent.click(container.querySelector('[data-super-agent-toggle]') as HTMLElement)
    await waitFor(() => expect(container.querySelector('[data-super-agent-quiet]')).not.toBeNull())
    expect(container.querySelector('[data-super-agent-quiet]')?.textContent).toContain(
      '[superAgentQuietDrops]',
    )

    panelState.quietDrops = 0
    cleanup()
    const second = render(<SuperAgentPanel />)
    await waitFor(() =>
      expect(second.container.querySelector('[data-super-agent-count]')).not.toBeNull(),
    )
    fireEvent.click(second.container.querySelector('[data-super-agent-toggle]') as HTMLElement)
    expect(second.container.querySelector('[data-super-agent-quiet]')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
