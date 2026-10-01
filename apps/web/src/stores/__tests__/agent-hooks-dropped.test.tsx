// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-641(2026-09-30):agent-hooks 落点 —— 事件日志上限 50 条溢出丢最旧必须可见。
 *
 * 钉住:① 溢出后 store.droppedEvents > 0;② AgentHooksPanel 渲染面出现
 * "…(dropped N)" 计数行;③ clearEvents 连丢弃账一并清零。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('@/components/common', () => ({ toast: { info: vi.fn() } }))
vi.mock('@/stores/integrations', () => ({ forwardToChannels: vi.fn() }))

import { useAgentHooksStore } from '@/stores/agent-hooks'
import { AgentHooksPanel } from '@/components/ai/agent-hooks-panel'

describe('agent-hooks droppedEvents 可见性(G-641)', () => {
  afterEach(() => {
    cleanup()
    useAgentHooksStore.setState({ hooks: [], events: [], droppedEvents: 0 })
  })

  it('溢出后 droppedEvents>0', () => {
    const s = useAgentHooksStore.getState()
    for (let i = 0; i < 55; i++) s.recordEvent('tool.before', `e-${i}`)
    const st = useAgentHooksStore.getState()
    expect(st.events).toHaveLength(50)
    expect(st.droppedEvents).toBe(5)
    expect(st.droppedEvents).toBeGreaterThan(0)
  })

  it('droppedEvents>0 时面板出现计数行', () => {
    const s = useAgentHooksStore.getState()
    for (let i = 0; i < 55; i++) s.recordEvent('tool.after', `e-${i}`)
    render(<AgentHooksPanel />)
    const line = screen.getByTestId('agent-hooks-events-dropped')
    expect(line.textContent).toBe('…(dropped 5)')
  })

  it('clearEvents 连丢弃账一并清零', () => {
    const s = useAgentHooksStore.getState()
    for (let i = 0; i < 55; i++) s.recordEvent('session.start', `e-${i}`)
    s.clearEvents()
    expect(useAgentHooksStore.getState().droppedEvents).toBe(0)
  })
})
