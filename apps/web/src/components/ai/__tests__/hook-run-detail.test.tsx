// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { HookRunDetail } from '../hook-run-detail'

// 本仓 vitest 未开全局 auto-cleanup:不显式清理会让用例互相撞「Found multiple elements」。
afterEach(() => cleanup())

const t = (key: string, values?: Record<string, string | number>): string => {
  if (key === 'runtimeHookRunTitle') return 'HOOKS'
  if (key === 'runtimeHookRunMeta') return `${values?.tool}/${values?.count}`
  if (key === 'runtimeHookRunOk') return 'OK'
  if (key === 'runtimeHookRunTimeout') return 'TIMEOUT'
  if (key === 'runtimeHookRunError') return 'ERROR'
  return key
}

const run = {
  type: 'hook-run' as const,
  runId: 'r1',
  toolName: 'bash',
  toolCallId: 'tc1',
  sessionId: 's1',
  hooks: [
    { name: 'fmt', kind: 'pre', status: 'ok' as const, durationMs: 12, error: null },
    { name: 'guard', kind: 'pre', status: 'timeout' as const, durationMs: 1500, error: null },
    {
      name: 'audit',
      kind: 'post',
      status: 'error' as const,
      durationMs: 30,
      error: 'exit 1',
    },
  ],
}

describe('HookRunDetail', () => {
  it('标题带工具名与钩子条数(条数按帧内条目,不是帧数)', () => {
    render(<HookRunDetail run={run} t={t} />)
    expect(screen.getByTestId('pane-runtime-hook-runs')).toBeTruthy()
    expect(screen.getByText('bash/3')).toBeTruthy()
  })

  it('逐钩子一行,data-hook-status 与三态文案一一对应', () => {
    render(<HookRunDetail run={run} t={t} />)
    const rows = screen
      .getByTestId('pane-runtime-hook-runs')
      .querySelectorAll('[data-hook-status]')
    expect(rows).toHaveLength(3)
    expect([...rows].map((r) => r.getAttribute('data-hook-status'))).toEqual([
      'ok',
      'timeout',
      'error',
    ])
    expect([...rows].map((r) => r.getAttribute('data-hook-status'))).toEqual([
      'ok',
      'timeout',
      'error',
    ])
    expect(screen.getByText('OK')).toBeTruthy()
    expect(screen.getByText('TIMEOUT')).toBeTruthy()
    expect(screen.getByText('ERROR')).toBeTruthy()
  })

  it('错误文本只挂在出错那条上,正常/超时条目不显示空串', () => {
    render(<HookRunDetail run={run} t={t} />)
    expect(screen.getByText('exit 1')).toBeTruthy()
    expect(screen.queryByText('null')).toBeNull()
  })

  it('工具名缺失时用占位符而不是空白(否则读数像"没跑钩子")', () => {
    render(<HookRunDetail run={{ ...run, toolName: null }} t={t} />)
    expect(screen.getByText('—/3')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
