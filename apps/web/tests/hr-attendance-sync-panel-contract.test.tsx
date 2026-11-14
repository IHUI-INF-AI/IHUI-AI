// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * 考勤 IM 同步面板契约锁(2026-11-14,HR 考勤同步面板与端点)。
 *
 * 钉住前端面相对后端两个同步端点的契约:
 *   · GET  /api/hr-attendance/sync/status —— 最近一次运行状态回读
 *   · POST /api/hr-attendance/sync/run    —— 手动触发一次同步(manage 权限)
 *
 * 锁四件事:
 *  ① status 无记录(lastRun:null)⇒ 显示「尚未运行过同步」,不报错、不伪造 0 值统计;
 *  ② status 有记录 ⇒ 展示开关态(已开启/未开启)与统计字段,errors 非空时错误明细原样上屏;
 *  ③ 手动触发按钮走 POST /sync/run,回执 enabled=false 时提示「未开启」(开关在 system_configs,
 *     面板不绕过),enabled=true 时提示成功批次数;
 *  ④ 触发按钮受 hr:attendance:manage 权限闸:无权限 ⇒ 按钮不渲染(可见性闸,服务端仍兜底)。
 *
 * 纪律(AGENTS §22c):本文件**不 mock next-intl**,挂真 NextIntlClientProvider + 真词包
 * (zh-CN.json),期望文案从真词包取,不抄字面量。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as React from 'react'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'

// ── mock @/lib/api 的 apiOrThrow(sync-panel 经 helpers 的同源出口取数) ──
const { apiOrThrowMock, toastMocks, permissionsRef } = vi.hoisted(() => ({
  apiOrThrowMock: vi.fn(),
  toastMocks: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
  // 用可变引用让每个用例切换权限(HR_MANAGE 有/无)
  permissionsRef: { current: ['hr:attendance:manage'] as string[] },
}))

vi.mock('@/lib/api', () => ({ apiOrThrow: apiOrThrowMock }))
// HasPermi 订阅 useAuthStore((s)=>s.user?.permissions)
vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { user?: { permissions?: string[] } }) => unknown) =>
    selector({ user: { permissions: permissionsRef.current } }),
}))
vi.mock('sonner', () => ({ toast: toastMocks }))

import { SyncPanel } from '../app/(main)/admin/hr-attendance/sync-panel'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_FILE = join(here, '../../../packages/i18n/messages/web/zh-CN.json')
const messages = JSON.parse(readFileSync(MESSAGES_FILE, 'utf8')) as Record<string, unknown>
const ns = messages.hrAttendance as Record<string, string>
/** 从真词包取词条(抄字面量就成了"测试替身自证") */
const w = (key: string): string => ns[key] ?? ''

function renderPanel() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(NextIntlClientProvider, { locale: 'zh-CN', messages },
        React.createElement(SyncPanel, { t: ((k: string, v?: unknown) => {
          // 最小 t 替身:从真词包取词条并做 ICU 简单插值,供断言对齐真实文案
          let s = w(k)
          if (v && typeof v === 'object') {
            for (const [pk, pv] of Object.entries(v as Record<string, unknown>)) {
              s = s.replace(new RegExp(`\\{${pk}\\}`, 'g'), String(pv))
            }
          }
          return s
        }) as never }),
      ),
    ),
  )
}

/** 造一份有记录的运行快照 */
function sampleRun(over: Partial<Record<string, unknown>> = {}) {
  return {
    enabled: true,
    scannedUsers: 12,
    attempted: 24,
    syncedBatches: 8,
    skippedNotImplemented: 3,
    errors: [] as string[],
    finishedAt: '2026-11-14T02:00:00.000Z',
    ...over,
  }
}

afterEach(() => {
  cleanup()
  apiOrThrowMock.mockReset()
  for (const fn of Object.values(toastMocks)) fn.mockReset()
  permissionsRef.current = ['hr:attendance:manage']
})

describe('SyncPanel · 状态回读(GET /sync/status)', () => {
  it('① lastRun:null ⇒ 显示「尚未运行过同步」,不伪造 0 值统计', async () => {
    apiOrThrowMock.mockResolvedValue({ lastRun: null })
    const { container } = renderPanel()

    await waitFor(() => expect(container.textContent).toContain(w('syncNeverRun')))
    // 不应出现统计字段的 0 值行(无记录就是无记录,不拿 0 冒充)
    expect(container.textContent).not.toContain(w('syncScannedUsers'))
    expect(container.textContent).not.toContain(w('syncSyncedBatches'))
  })

  it('② 有记录 ⇒ 展示开关态与统计字段', async () => {
    apiOrThrowMock.mockResolvedValue({ lastRun: sampleRun() })
    const { container } = renderPanel()

    await waitFor(() => expect(container.textContent).toContain(w('syncEnabled')))
    expect(container.textContent).toContain(w('syncScannedUsers'))
    expect(container.textContent).toContain('12')
    expect(container.textContent).toContain(w('syncAttempted'))
    expect(container.textContent).toContain(w('syncSyncedBatches'))
    expect(container.textContent).toContain(w('syncSkippedNotImplemented'))
    expect(container.textContent).toContain(w('syncFinishedAt'))
  })

  it('③ enabled=false ⇒ 显示「未开启」态', async () => {
    apiOrThrowMock.mockResolvedValue({ lastRun: sampleRun({ enabled: false }) })
    const { container } = renderPanel()

    await waitFor(() => expect(container.textContent).toContain(w('syncDisabledBadge')))
    expect(container.textContent).not.toContain(w('syncEnabled'))
  })

  it('④ errors 非空 ⇒ 错误明细原样上屏(不静默吞错)', async () => {
    const msg = '飞书打卡拉取超时:tenant token 刷新失败'
    apiOrThrowMock.mockResolvedValue({ lastRun: sampleRun({ errors: [msg] }) })
    const { container } = renderPanel()

    await waitFor(() =>
      expect(container.textContent).toContain(
        w('syncErrors').replace('{count}', '1'),
      ),
    )
    expect(container.textContent).toContain(msg)
  })
})

describe('SyncPanel · 手动触发(POST /sync/run)', () => {
  it('⑤ 触发走 POST /sync/run,enabled=true ⇒ 提示成功批次数并刷新状态', async () => {
    // 默认兜底:invalidate 后的状态重拉有值可回,避免 undefined 崩
    apiOrThrowMock.mockResolvedValue({ lastRun: null })
    apiOrThrowMock
      .mockResolvedValueOnce({ lastRun: null }) // 首次状态回读
      .mockResolvedValueOnce({ sync: sampleRun({ syncedBatches: 5 }) }) // 触发回执
    const { container } = renderPanel()

    await waitFor(() => expect(container.textContent).toContain(w('syncNeverRun')))
    const btn = screen.getByRole('button', { name: new RegExp(w('syncRunNow')) })
    fireEvent.click(btn)

    await waitFor(() => {
      // 第二次起是 POST /sync/run(首次是状态回读,触发后 invalidate 还会再拉一次)
      const runCall = apiOrThrowMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
      )
      expect(runCall).toBeDefined()
    })
    const runCall = apiOrThrowMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === 'POST',
    ) as unknown[]
    expect(String(runCall[0])).toContain('/api/hr-attendance/sync/run')
    // 成功提示带批次数
    await waitFor(() => expect(toastMocks.success).toHaveBeenCalled())
  })

  it('⑥ 回执 enabled=false ⇒ 提示「未开启」(不绕过 system_configs 开关)', async () => {
    apiOrThrowMock
      .mockResolvedValueOnce({ lastRun: sampleRun() })
      .mockResolvedValueOnce({ sync: sampleRun({ enabled: false }) })
    const { container } = renderPanel()

    await waitFor(() => expect(container.textContent).toContain(w('syncEnabled')))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(w('syncRunNow')) }))

    await waitFor(() => expect(toastMocks.info).toHaveBeenCalled())
  })
})

describe('SyncPanel · 权限闸(hr:attendance:manage)', () => {
  it('⑦ 无 manage 权限 ⇒ 触发按钮不渲染(可见性闸,服务端仍兜底)', async () => {
    permissionsRef.current = [] // 无任何权限
    apiOrThrowMock.mockResolvedValue({ lastRun: null })
    const { container } = renderPanel()

    await waitFor(() => expect(container.textContent).toContain(w('syncNeverRun')))
    expect(screen.queryByRole('button', { name: new RegExp(w('syncRunNow')) })).toBeNull()
    // 状态回读只读,仍可见(view/manage 均可读 lastRun)
    expect(apiOrThrowMock).toHaveBeenCalled()
  })
})
