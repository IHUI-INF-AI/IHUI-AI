// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

// 组件级验证(O29):admin 页需登录态(httpOnly cookie,无法在自动化里安全注入凭据),
// 故按 AGENTS §17 豁免路径以组件测试钉死「维护公告邮件」入口的渲染与调用契约。
const sendMock = vi.hoisted(() => vi.fn())

vi.mock('@ihui/api-client', () => ({
  sendMaintenanceNoticeEmail: sendMock,
}))

vi.mock('next-intl', () => ({
  useTranslations: (ns: string) => (key: string, params?: Record<string, string | number>) =>
    params ? `${ns}.${key}:${JSON.stringify(params)}` : `${ns}.${key}`,
}))

import { MaintenanceNoticeDialog } from '../../app/(main)/admin/announcements/MaintenanceNoticeDialog'
import { AnnouncementFilter } from '../../app/(main)/admin/announcements/AnnouncementFilter'

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('MaintenanceNoticeDialog(O29 维护公告邮件)', () => {
  beforeEach(() => sendMock.mockReset())
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('open 时渲染三个字段 + 上限 + 试运行勾选框(装车证明)', () => {
    wrap(<MaintenanceNoticeDialog open onClose={() => {}} />)
    expect(screen.getByText('admin.announcements.maintenanceNotice.title')).toBeTruthy()
    for (const id of ['mn-window', 'mn-scope', 'mn-downtime', 'mn-limit']) {
      expect(document.getElementById(id)).toBeTruthy()
    }
    expect(document.querySelector('input[type="checkbox"]')).toBeTruthy()
  })

  it('必填缺一 → 不发请求,显示 required 错误', async () => {
    wrap(<MaintenanceNoticeDialog open onClose={() => {}} />)
    fireEvent.input(document.getElementById('mn-window') as HTMLElement, {
      target: { value: '2026-09-25 02:00' },
    })
    fireEvent.click(screen.getByText('admin.announcements.maintenanceNotice.send'))
    await waitFor(() => {
      expect(screen.getByText('admin.announcements.maintenanceNotice.required')).toBeTruthy()
    })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('limit 非整数 → limitInvalid,不发请求', async () => {
    wrap(<MaintenanceNoticeDialog open onClose={() => {}} />)
    fireEvent.input(document.getElementById('mn-window') as HTMLElement, {
      target: { value: 'w' },
    })
    fireEvent.input(document.getElementById('mn-scope') as HTMLElement, {
      target: { value: 's' },
    })
    fireEvent.input(document.getElementById('mn-downtime') as HTMLElement, {
      target: { value: 'd' },
    })
    fireEvent.input(document.getElementById('mn-limit') as HTMLElement, {
      target: { value: '1.5' },
    })
    fireEvent.click(screen.getByText('admin.announcements.maintenanceNotice.send'))
    await waitFor(() => {
      expect(screen.getByText('admin.announcements.maintenanceNotice.limitInvalid')).toBeTruthy()
    })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('填全字段实发 → api-client 收到契约入参,成功后展示 resultSent 统计', async () => {
    sendMock.mockResolvedValue({
      success: true,
      data: {
        dryRun: false,
        total: 2,
        pool: 5,
        subject: '【智汇AI】例行维护通知',
        stats: { sent: 2, failed: 0, stubbed: 0 },
      },
    })
    wrap(<MaintenanceNoticeDialog open onClose={() => {}} />)
    fireEvent.input(document.getElementById('mn-window') as HTMLElement, {
      target: { value: '2026-09-25 02:00–04:00' },
    })
    fireEvent.input(document.getElementById('mn-scope') as HTMLElement, {
      target: { value: 'API 与控制台' },
    })
    fireEvent.input(document.getElementById('mn-downtime') as HTMLElement, {
      target: { value: '2 小时' },
    })
    fireEvent.input(document.getElementById('mn-limit') as HTMLElement, {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByText('admin.announcements.maintenanceNotice.send'))
    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1))
    expect(sendMock.mock.calls[0]?.[0]).toEqual({
      window: '2026-09-25 02:00–04:00',
      scope: 'API 与控制台',
      downtime: '2 小时',
      dryRun: false,
      limit: 2,
    })
    await waitFor(() => {
      expect(screen.getByText(/admin\.announcements\.maintenanceNotice\.resultSent/)).toBeTruthy()
    })
  })

  it('勾选试运行 → 请求带 dryRun=true 且 limit 留空为 undefined', async () => {
    sendMock.mockResolvedValue({
      success: true,
      data: { dryRun: true, total: 5, pool: 5, subject: 'x' },
    })
    wrap(<MaintenanceNoticeDialog open onClose={() => {}} />)
    fireEvent.input(document.getElementById('mn-window') as HTMLElement, {
      target: { value: 'w' },
    })
    fireEvent.input(document.getElementById('mn-scope') as HTMLElement, {
      target: { value: 's' },
    })
    fireEvent.input(document.getElementById('mn-downtime') as HTMLElement, {
      target: { value: 'd' },
    })
    const checkbox = document.querySelector('input[type="checkbox"]') as HTMLInputElement
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByText('admin.announcements.maintenanceNotice.send'))
    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1))
    expect(sendMock.mock.calls[0]?.[0]).toEqual({
      window: 'w',
      scope: 's',
      downtime: 'd',
      dryRun: true,
      limit: undefined,
    })
    await waitFor(() => {
      expect(screen.getByText(/admin\.announcements\.maintenanceNotice\.resultDryRun/)).toBeTruthy()
    })
  })

  it('接口失败(ApiResult.success=false)→ 展示后端错误文案', async () => {
    sendMock.mockResolvedValue({ success: false, error: '需要管理员权限' })
    wrap(<MaintenanceNoticeDialog open onClose={() => {}} />)
    fireEvent.input(document.getElementById('mn-window') as HTMLElement, {
      target: { value: 'w' },
    })
    fireEvent.input(document.getElementById('mn-scope') as HTMLElement, {
      target: { value: 's' },
    })
    fireEvent.input(document.getElementById('mn-downtime') as HTMLElement, {
      target: { value: 'd' },
    })
    fireEvent.click(screen.getByText('admin.announcements.maintenanceNotice.send'))
    await waitFor(() => {
      expect(screen.getByText('需要管理员权限')).toBeTruthy()
    })
  })
})

describe('AnnouncementFilter 维护公告入口', () => {
  afterEach(cleanup)
  it('渲染「维护公告邮件」按钮并回调 onSendNotice', () => {
    const onSendNotice = vi.fn()
    render(<AnnouncementFilter onCreate={() => {}} onSendNotice={onSendNotice} />)
    fireEvent.click(screen.getByText('admin.announcements.maintenanceNotice.action'))
    expect(onSendNotice).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
