// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
//
// /admin/monitor/alerts 契约回归锁(2026-10-31 立)。
// 事故形态:后端 `registerCrud('/monitor/alerts', monitorAlerts)` 的 GET 走 `db.select()` 全列,
// 真实列是 `name / severity / status(firing|suppressed|resolved) / firedAt ...`,
// 而旧前端类型臆造了 `level / title / active / acknowledged`:
//   · `LEVEL_STYLE[a.level]` 取到 undefined 再 `.icon` ⇒ TypeError 崩整表
//     (现读 monitor_alerts 0 行,读作空态 = 潜伏态,第一条告警落地即崩);
//   · 汇总卡按 `'active'` 计数恒 0;确认按钮条件永不成立;状态列空白。
// 本档喂**真列名 fixture**,钉死:渲染不抛、文案与名称可见、确认按钮存在、
// 以及词表完备性(已知值全有标签/样式;未知值走兜底而**不是 undefined**)。
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MONITOR_ALERT_SEVERITIES, MONITOR_ALERT_STATUSES } from '@ihui/types'
import {
  SEVERITY_STYLE,
  severityStyle,
  statusLabel,
  statusStyle,
} from '../app/(main)/admin/monitor/alerts/helpers'
import type { Alert, AlertRule } from '../app/(main)/admin/monitor/alerts/types'

const apiOrThrowMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
  apiOrThrow: apiOrThrowMock,
}))

vi.mock('@/components/common', () => ({ BackButton: () => null }))

import AdminMonitorAlertsPage from '../app/(main)/admin/monitor/alerts/page'

// —— 真列名 fixture(字段逐字对齐 packages/database/src/schema/monitor.ts)——
const FIRING_ALERT: Alert = {
  id: '3f2a1b0c-0000-4000-8000-000000000001',
  name: '磁盘使用率超阈值',
  source: 'node-exporter',
  severity: 'critical',
  status: 'firing',
  message: '/ 分区使用率 92%',
  labels: { team: 'ops' },
  annotations: {},
  firedAt: '2026-10-31T02:00:00.000Z',
  resolvedAt: null,
  createdAt: '2026-10-31T02:00:00.000Z',
}

// 库里 severity/status 是裸 varchar(无 CHECK):历史脏值必须走兜底而不是崩表。
const LEGACY_ALERT: Alert = {
  ...FIRING_ALERT,
  id: '3f2a1b0c-0000-4000-8000-000000000002',
  name: '历史脏值告警',
  severity: 'fatal',
  status: 'active',
}

const RULE: AlertRule = {
  id: '9e8d7c6b-0000-4000-8000-000000000009',
  name: '夜间维护窗口',
  matchLabels: { env: 'prod' },
  matchSource: 'node-exporter',
  isActive: true,
  suppressMinutes: 30,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
}

function wrap() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <AdminMonitorAlertsPage />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('/admin/monitor/alerts 真列渲染', () => {
  it('喂真列 fixture:render 不抛,名称/状态文案/确认按钮齐备', async () => {
    apiOrThrowMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('alert-rules') ? { list: [RULE] } : { list: [FIRING_ALERT] }),
    )

    expect(() => wrap()).not.toThrow()
    // a.name 取代旧 a.title(库里根本没有 title 列)
    expect(await screen.findByText(FIRING_ALERT.name)).toBeTruthy()
    // firing → 「触发中」(旧词表 active/acknowledged 在库里不存在,状态列此前恒空白)
    expect(screen.getByText('触发中')).toBeTruthy()
    expect(screen.getByText('严重')).toBeTruthy()
    // 确认按钮条件 status === 'firing' 成立(旧 'active' 恒不成立 ⇒ 按钮永不出现)
    expect(await screen.findByRole('button', { name: '确认' })).toBeTruthy()
    // 规则卡按 suppression_rules 真列渲染(旧 metric/operator/threshold 均不存在)
    expect(await screen.findByText(/抑制 30 分钟/)).toBeTruthy()
  })

  it('库侧裸 varchar 脏值(fatal/active)原样兜底显示,不崩表', async () => {
    apiOrThrowMock.mockImplementation((url: string) =>
      Promise.resolve(url.includes('alert-rules') ? { list: [] } : { list: [LEGACY_ALERT] }),
    )

    expect(() => wrap()).not.toThrow()
    expect(await screen.findByText(LEGACY_ALERT.name)).toBeTruthy()
    // 未知状态原样显示(词表头注:读侧兜底=原样,不冒充 firing)
    expect(screen.getByText('active')).toBeTruthy()
    // 未知严重度落 info 档 ⇒ 有文案(「信息」),而不是 undefined.icon 崩表
    expect(screen.getByText('信息')).toBeTruthy()
    // 非 firing ⇒ 不出现确认按钮
    expect(screen.queryByRole('button', { name: '确认' })).toBeNull()
  })
})

describe('监控告警词表完备性(回归锁)', () => {
  it('MONITOR_ALERT_STATUSES 逐值:statusLabel/statusStyle 均返回非空', () => {
    for (const s of MONITOR_ALERT_STATUSES) {
      expect(statusLabel(s).length).toBeGreaterThan(0)
      expect(statusStyle(s).length).toBeGreaterThan(0)
    }
  })

  it('MONITOR_ALERT_SEVERITIES 逐值:severityStyle 有标签有图标', () => {
    for (const s of MONITOR_ALERT_SEVERITIES) {
      const st = severityStyle(s)
      expect(st.label.length).toBeGreaterThan(0)
      expect(st.icon).toBeTruthy()
    }
  })

  it("未知值('active'/'acknowledged'/''/undefined/null)返回兜底而不是 undefined", () => {
    for (const v of ['active', 'acknowledged', '', undefined, null]) {
      expect(statusLabel(v)).toBeDefined()
      expect(statusLabel(v).length).toBeGreaterThan(0)
      expect(statusStyle(v)).toBeDefined()
      expect(statusStyle(v).length).toBeGreaterThan(0)
      expect(severityStyle(v)).toBeDefined()
      expect(severityStyle(v).icon).toBeTruthy()
    }
    // 未知严重度显式落 info 档
    expect(severityStyle('active')).toBe(SEVERITY_STYLE.info)
    // 已知词表之外的旧词必须逐字等于共享词表的合法键集(防词表再次漂移)
    expect(MONITOR_ALERT_STATUSES).toEqual(['firing', 'suppressed', 'resolved'])
    expect(MONITOR_ALERT_SEVERITIES).toEqual(['info', 'warning', 'critical'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
