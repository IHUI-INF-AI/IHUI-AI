// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-641(2026-09-30):integrations 落点 —— 转发日志上限 50 条溢出丢最旧必须可见。
 *
 * 钉住:① 溢出后 store.droppedLog > 0;② IntegrationsPanel 渲染面出现
 * "…(dropped N)" 计数行;③ clearLog 连丢弃账一并清零。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))
vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))
vi.mock('@/components/common', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))

import { useIntegrationsStore } from '@/stores/integrations'
import { IntegrationsPanel } from '@/components/ai/integrations-panel'

describe('integrations droppedLog 可见性(G-641)', () => {
  afterEach(() => {
    cleanup()
    useIntegrationsStore.setState({ log: [], droppedLog: 0 })
  })

  it('溢出后 droppedLog>0', () => {
    const s = useIntegrationsStore.getState()
    for (let i = 0; i < 55; i++) s.recordLog('github', 'tool.after', `e-${i}`)
    const st = useIntegrationsStore.getState()
    expect(st.log).toHaveLength(50)
    expect(st.droppedLog).toBe(5)
    expect(st.droppedLog).toBeGreaterThan(0)
  })

  it('droppedLog>0 时面板出现计数行', () => {
    const s = useIntegrationsStore.getState()
    for (let i = 0; i < 55; i++) s.recordLog('slack', 'tool.before', `e-${i}`)
    render(<IntegrationsPanel />)
    const line = screen.getByTestId('integrations-log-dropped')
    expect(line.textContent).toBe('…(dropped 5)')
  })

  it('clearLog 连丢弃账一并清零', () => {
    const s = useIntegrationsStore.getState()
    for (let i = 0; i < 55; i++) s.recordLog('push', 'error', `e-${i}`)
    s.clearLog()
    expect(useIntegrationsStore.getState().droppedLog).toBe(0)
  })
})
