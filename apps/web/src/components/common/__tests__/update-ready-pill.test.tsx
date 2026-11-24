// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// 更新胶囊的渲染锁（2026-11-24）：
//   ① ready=true 才出现；没有 ready 时一个像素都不许有；
//   ② 只有“立即重启”一个按钮，没有关闭/稍后/倒计时；
//   ③ 服务端回退态用回退文案，但仍然是同一个交棒按钮。

import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const hoisted = vi.hoisted(() => ({
  restart: vi.fn(),
  dismiss: vi.fn(),
  notice: null as null | { from: string; to: string; at: number; reason: string },
  status: {
    supported: true,
    current: '0.1.93',
    kind: 'update' as 'update' | 'rollback',
    available: '0.1.94',
    ready: true,
    mandatory: false,
    requiresBootstrap: false,
    notes: null,
    reason: 'staged',
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) =>
    params ? `${key}(${Object.values(params).join(',')})` : key,
}))

vi.mock('@/hooks/use-update-ready', () => ({
  useUpdateReady: () => ({
    status: hoisted.status,
    restarting: false,
    restart: hoisted.restart,
    prepareRollback: vi.fn(),
    rollbackNotice: hoisted.notice,
    dismissRollbackNotice: hoisted.dismiss,
  }),
}))

import { UpdatePrompt } from '../UpdatePrompt'

afterEach(() => {
  cleanup()
  hoisted.restart.mockReset()
  hoisted.dismiss.mockReset()
  hoisted.notice = null
  hoisted.status = { ...hoisted.status, kind: 'update', ready: true, requiresBootstrap: false }
})

describe('UpdatePrompt：常驻胶囊', () => {
  it('ready=false 不渲染任何东西', () => {
    hoisted.status = { ...hoisted.status, ready: false }
    const { container } = render(<UpdatePrompt />)
    expect(container.innerHTML).toBe('')
  })

  it('就绪后只有一个重启按钮，没有关闭/稍后', () => {
    render(<UpdatePrompt />)
    expect(screen.getByTestId('update-ready-pill')).toBeTruthy()
    expect(screen.getByText('readyTitle')).toBeTruthy()
    expect(screen.getByText('readyBody(0.1.94)')).toBeTruthy()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    const button = buttons[0]!
    expect(button.textContent).toBe('readyRestart')
    fireEvent.click(button)
    expect(hoisted.restart).toHaveBeenCalledTimes(1)
  })

  it('回退态用回退文案，仍是同一个交棒按钮', () => {
    hoisted.status = { ...hoisted.status, kind: 'rollback', available: '0.1.93' }
    render(<UpdatePrompt />)
    expect(screen.getByText('readyRollbackTitle')).toBeTruthy()
    expect(screen.getByText('readyRollbackBody(0.1.93)')).toBeTruthy()
    expect(screen.getByRole('button').textContent).toBe('rollbackNow')
  })

  it('启动器太旧时出可操作的引导胶囊，不假装能 zip 自举', () => {
    hoisted.status = {
      ...hoisted.status,
      ready: false,
      requiresBootstrap: true,
      available: '0.1.94',
    }
    render(<UpdatePrompt />)
    expect(screen.getByTestId('update-bootstrap-pill')).toBeTruthy()
    expect(screen.getByText('bootstrapTitle')).toBeTruthy()
    expect(screen.getByRole('button').textContent).toBe('bootstrapAction')
  })

  it('自动回滚通知只出现一次，点“知道了”后消失', () => {
    hoisted.status = { ...hoisted.status, ready: false }
    hoisted.notice = { from: '0.1.94', to: '0.1.93', at: 1, reason: 'boot-failed' }
    render(<UpdatePrompt />)
    expect(screen.getByTestId('update-rollback-notice')).toBeTruthy()
    expect(screen.getByText('rollbackNoticeBody(0.1.94,0.1.93)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    expect(hoisted.dismiss).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
