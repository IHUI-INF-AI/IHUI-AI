// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-641(2026-09-30):agent-canvas 落点 —— 节点日志上限 100 条溢出丢最旧必须可见。
 *
 * 钉住:① 节点 data.dropped 携带累计丢弃数;② InspectorPanel 的 LogList 在
 * dropped>0 时渲染 "…(dropped N)" 计数行;③ dropped=0 时不渲染计数行。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }))

import { InspectorPanel } from '../components/inspector-panel'
import type { CanvasNodeData } from '../types'

function makeNode(dropped: number, logCount: number): CanvasNodeData {
  return {
    label: 'node-1',
    nodeType: 'agent',
    params: {},
    status: 'running',
    dropped,
    logs: Array.from({ length: logCount }, (_, i) => ({
      id: `log-${i}`,
      level: 'info' as const,
      message: `m-${i}`,
      timestamp: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    })),
  }
}

describe('canvas 节点日志 dropped 可见性(G-641)', () => {
  afterEach(() => {
    cleanup()
  })

  it('dropped>0 时 LogList 顶部出现计数行', () => {
    render(
      <InspectorPanel
        node={makeNode(7, 3)}
        nodeId="n1"
        onUpdateParams={vi.fn()}
        onRename={vi.fn()}
      />,
    )
    const line = screen.getByTestId('canvas-log-dropped')
    expect(line.textContent).toBe('…(dropped 7)')
    // 既有日志行照常渲染,不因计数行缺席
    expect(screen.getByText('m-0')).toBeTruthy()
  })

  it('dropped=0 时不渲染计数行', () => {
    render(
      <InspectorPanel
        node={makeNode(0, 2)}
        nodeId="n1"
        onUpdateParams={vi.fn()}
        onRename={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('canvas-log-dropped')).toBeNull()
  })
})
