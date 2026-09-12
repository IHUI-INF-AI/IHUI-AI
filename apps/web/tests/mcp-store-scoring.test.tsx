// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * MCP 市场评分徽章 + 质量看板接线测试(P1 1-4 / P2-5 / H8,2026-09-12 立)
 *
 * 覆盖:
 * - ScoringBadges:质量徽章(等级 + 数值分)+ 风险徽章文案,Tooltip 提示完整分数
 * - 回归:徽章不得使用原生 title 属性(规范要求 hover 提示必须走 Tooltip)
 * - ReviewBadge:三种审核状态文案
 * - McpQualityDashboard:端点失败时静默降级(不渲染、不报错);
 *   成功时渲染 server 行与指标
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import React from 'react'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { ScoringBadges, ReviewBadge } from '../src/components/mcp/mcp-scoring-badges'
import { McpQualityDashboard } from '../src/components/mcp/mcp-quality-dashboard'
import { TooltipProvider } from '@/components/feedback'
import { getMcpQualityDashboard } from '@ihui/api-client/endpoints/mcp'

// ─── next-intl mock:t 函数查表 + {param} 插值(key 为命名空间内相对 key) ──
vi.mock('next-intl', () => {
  const I18N_MAP: Record<string, string> = {
    quality: '质量',
    qualityScore: '质量分: {score}/100',
    securityScore: '安全分: {score}/100',
    riskLow: '低风险',
    riskMedium: '中风险',
    riskHigh: '高风险',
    riskCritical: '严重风险',
    reviewPending: '待审核',
    reviewApproved: '已通过',
    reviewRejected: '已驳回',
    dashboardTitle: '质量看板',
    dashboardSubtitle: '各 MCP Server 运行时指标与质量 / 安全评分',
    dashboardServer: 'Server',
    dashboardScoring: '评分',
    dashboardCalls: '调用次数',
    dashboardSuccessRate: '成功率',
    dashboardAvgLatency: '平均延迟',
    dashboardNoData: '暂无数据',
    dashboardLatency: '{value}s',
  }
  return {
    useTranslations: () => (key: string, params?: Record<string, string | number>) => {
      const tmpl = I18N_MAP[key] ?? key
      if (!params) return tmpl
      return tmpl.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))
    },
  }
})

// ─── @radix-ui/react-tooltip mock:Tooltip 内容直接内联渲染(不依赖 Portal/交互) ──
vi.mock('@radix-ui/react-tooltip', () => {
  const passthrough = ({ children }: { children: React.ReactNode }) => <>{children}</>
  return {
    __esModule: true,
    Provider: passthrough,
    Root: passthrough,
    Trigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Portal: passthrough,
    Content: ({ children }: { children: React.ReactNode }) => <div role="tooltip">{children}</div>,
    Arrow: () => null,
  }
})

// ─── api-client mock:看板端点可注入 成功/失败 两种返回 ──
const { getMcpQualityDashboardMock } = vi.hoisted(() => ({
  getMcpQualityDashboardMock: vi.fn(),
}))
vi.mock('@ihui/api-client/endpoints/mcp', () => ({
  getMcpQualityDashboard: getMcpQualityDashboardMock,
}))

afterEach(() => {
  cleanup()
  getMcpQualityDashboardMock.mockReset()
})

describe('ScoringBadges(质量分徽章 + 权限风险等级)', () => {
  it('渲染质量等级/数值分与风险等级,Tooltip 提示完整分数且不用原生 title', () => {
    render(
      <TooltipProvider>
        <ScoringBadges score={92} grade="A" securityScore={85} securityLevel="low" />
      </TooltipProvider>,
    )

    // 徽章文案:质量 A 92 / 低风险
    expect(screen.getByText('质量 A 92')).toBeTruthy()
    expect(screen.getByText('低风险')).toBeTruthy()
    // Tooltip 内容(完整分数)
    expect(screen.getByText('质量分: 92/100')).toBeTruthy()
    expect(screen.getByText('安全分: 85/100')).toBeTruthy()
    // 回归规范:hover 提示禁原生 title 属性
    expect(document.querySelectorAll('[title]').length).toBe(0)
  })

  it('高风险等级映射 danger 徽章文案', () => {
    render(
      <TooltipProvider>
        <ScoringBadges score={40} grade="D" securityScore={35} securityLevel="critical" />
      </TooltipProvider>,
    )
    expect(screen.getByText('质量 D 40')).toBeTruthy()
    expect(screen.getByText('严重风险')).toBeTruthy()
  })
})

describe('ReviewBadge(市场审核状态)', () => {
  it.each([
    ['pending', '待审核'],
    ['approved', '已通过'],
    ['rejected', '已驳回'],
  ] as const)('%s → %s', (status, label) => {
    render(
      <TooltipProvider>
        <ReviewBadge status={status} />
      </TooltipProvider>,
    )
    expect(screen.getByText(label)).toBeTruthy()
  })
})

describe('McpQualityDashboard(质量看板,静默降级)', () => {
  const renderDashboard = () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={qc}>
        <McpQualityDashboard />
      </QueryClientProvider>,
    )
  }

  it('端点失败:不渲染区块、不抛错(静默降级)', async () => {
    getMcpQualityDashboardMock.mockResolvedValue({ success: false, error: 'service down' })
    const { container } = renderDashboard()
    await waitFor(() => expect(getMcpQualityDashboard).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })

  it('端点成功:渲染 server 行与运行时指标', async () => {
    getMcpQualityDashboardMock.mockResolvedValue({
      success: true,
      data: {
        count: 1,
        servers: [
          {
            key: 'filesystem',
            name: 'Filesystem',
            metrics: {
              calls: 10,
              successes: 9,
              failures: 1,
              success_rate: 0.9,
              avg_latency_s: 0.42,
              schema_mismatches: 0,
              schema_compatibility: 1,
              tools: 3,
              collision_tools: 0,
            },
            quality: { score: 88.5, grade: 'A', dimensions: [] },
            security: { score: 75, level: 'medium', risk_factors: [] },
          },
        ],
      },
    })
    renderDashboard()

    expect(await screen.findByText('质量看板')).toBeTruthy()
    expect(screen.getByText('Filesystem')).toBeTruthy()
    expect(screen.getByText('质量 A 88.5')).toBeTruthy()
    expect(screen.getByText('中风险')).toBeTruthy()
    expect(screen.getByText('90.0%')).toBeTruthy()
    expect(screen.getByText('0.42s')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
