// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// /admin/monitor/dashboard 服务状态契约锁(2026-10-31)。
// 成因:后端 apps/api/src/routes/admin-monitoring-routes.ts 的 checkServiceHealth 对
// api/web/ai-service 返回 status:'running'(进程自报、未经探测、latency 恒 0),只有
// postgres/redis 返回 healthy|unhealthy;旧前端把类型收窄成 'healthy'|'unhealthy' 并
// 按 `s.status === 'healthy'` 上绿/红 ⇒ 三个已启动服务恒显示红叉、头部恒「2/5 健康」。
// 本档钉的是:①读数诚实(在跑 ≠ 已探测健康);②running 不是红叉也不是绿勾,而是独立形态;
// ③redis(unhealthy)必须是红叉 —— 阳性对照,防"全改成绿"式消红;④图标表按真 name 命中;
// ⑤实时 QPS 卡不得再由 Math.random() 驱动(参照 a2ecdb806a3 消除 mock 数据冒充的定档)。
import * as React from 'react'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchApiMock = vi.hoisted(() => vi.fn())
const apiOrThrowMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({
  fetchApi: fetchApiMock,
  apiOrThrow: apiOrThrowMock,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/common', () => ({ BackButton: () => null }))

import AdminMonitorDashboardPage from '../app/(main)/admin/monitor/dashboard/page'

// 逐字取自后端 checkServiceHealth(routes 71-95 行的 services.push 顺序与字面值):
const SERVICES_FIXTURE = [
  { name: 'api', status: 'running', latency: 0 },
  { name: 'web', status: 'running', latency: 0 },
  { name: 'ai-service', status: 'running', latency: 0 },
  { name: 'postgres', status: 'healthy', latency: 3 },
  { name: 'redis', status: 'unhealthy', latency: 0 },
]

// 逐字取自后端 getPerf()(qps/avgResponse/diskUsage 为硬编码 0,注释自认未接入探测):
const PERF_FIXTURE = { cpu: 12.5, memory: 40, qps: 0, avgResponse: 0, diskUsage: 0 }

function stubQueries() {
  apiOrThrowMock.mockImplementation((url: string) =>
    url.includes('/monitor/services')
      ? Promise.resolve({ list: SERVICES_FIXTURE })
      : Promise.resolve(PERF_FIXTURE),
  )
}

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <AdminMonitorDashboardPage />
    </QueryClientProvider>,
  )
}

function rowOf(name: string): HTMLElement {
  const el = document.querySelector(`[data-service="${name}"]`)
  if (!(el instanceof HTMLElement)) throw new Error(`服务行 ${name} 未渲染`)
  return el
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('/admin/monitor/dashboard 服务状态渲染契约', () => {
  it('①头部读数按"在跑"计:running(自报)+healthy 计入,unhealthy 不计 ⇒ 4/5 在跑', async () => {
    stubQueries()
    wrap()
    await waitFor(() => expect(screen.getByText('4/5 在跑')).toBeTruthy())
  })

  it('②api 行(status=running 自报)不是红叉,而是独立"自报"形态,latency 0 不显示 0ms', async () => {
    stubQueries()
    wrap()
    await waitFor(() => expect(document.querySelector('[data-service="api"]')).toBeTruthy())
    const row = rowOf('api')
    expect(row.querySelector('svg.lucide-circle-x')).toBeNull()
    expect(row.querySelector('svg.lucide-circle-dot')).toBeTruthy()
    expect(row.textContent).toContain('自报')
    expect(row.textContent).toContain('—')
    expect(row.textContent).not.toContain('0ms')
  })

  it('③阳性对照:redis(unhealthy)必须仍是红叉,postgres(healthy)绿勾带真延时无「自报」标', async () => {
    stubQueries()
    wrap()
    await waitFor(() => expect(document.querySelector('[data-service="redis"]')).toBeTruthy())
    const redis = rowOf('redis')
    expect(redis.querySelector('svg.lucide-circle-x')).toBeTruthy()
    const postgres = rowOf('postgres')
    expect(postgres.querySelector('svg.lucide-circle-check')).toBeTruthy()
    expect(postgres.textContent).toContain('3ms')
    expect(postgres.textContent).not.toContain('自报')
  })

  it('④五枚真 name 均命中图标表,不退成兜底(web/globe、postgres/database、redis/cpu、ai-service/brain)', async () => {
    stubQueries()
    wrap()
    await waitFor(() => expect(document.querySelector('[data-service="ai-service"]')).toBeTruthy())
    const expected: Record<string, string> = {
      api: 'lucide-server',
      web: 'lucide-globe',
      postgres: 'lucide-database',
      redis: 'lucide-cpu',
      'ai-service': 'lucide-brain',
    }
    for (const [name, iconClass] of Object.entries(expected)) {
      expect(
        rowOf(name).querySelector(`svg.${iconClass}`),
        `行 ${name} 应带 ${iconClass}`,
      ).toBeTruthy()
    }
  })

  it('⑤实时 QPS 卡不再由 Math.random() 驱动:渲染全程零调用,两次渲染逐字节一致,卡面显式「未判定」', async () => {
    stubQueries()
    const randomSpy = vi.spyOn(Math, 'random')

    const first = wrap()
    await waitFor(() => expect(screen.getByText('4/5 在跑')).toBeTruthy())
    const firstHtml = first.container.innerHTML
    first.unmount()

    const second = wrap()
    await waitFor(() => expect(screen.getByText('4/5 在跑')).toBeTruthy())
    expect(second.container.innerHTML).toBe(firstHtml)

    expect(randomSpy).not.toHaveBeenCalled()
    // 假曲线整段摘除,代之以显式未判定占位
    expect(second.container.querySelector('[data-qps-unjudged]')).toBeTruthy()
    expect(second.container.textContent).toContain('未判定')
    // 后端硬编码 0 的三项(qps/avgResponse/diskUsage)在性能卡上显示 —,不冒充 0
    for (const label of ['QPS', '平均响应', '磁盘']) {
      const card = screen.getByText(label).parentElement
      expect(card, `性能卡 ${label} 应存在`).toBeTruthy()
      expect(card?.textContent).toContain('—')
      expect(card?.textContent).not.toMatch(/(^|[^-\d])0(%|ms)?/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
