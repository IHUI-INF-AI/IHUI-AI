// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 大屏指挥台 · 遥测条接线锁(2026-10-29 立):
// ① 从未跑过 ⇒ 不渲染(不占 28px);② 有账 ⇒ 阶段 + 读数齐全且单行;
// ③ 失败工具才出失败格(0 不渲染,不拿 0 冒充)。
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      `[${key}]`,
  useLocale: () => 'zh-CN',
}))

const telemetryState = {
  phase: 'writing' as const,
  elapsedMs: 8_400,
  ttftMs: 620,
  charsPerSec: 86,
  tokensPerSec: 150 as number | null,
  hasRun: true,
  tokens: 1_260 as number | null,
  toolCount: 3,
  failedTools: 0,
  rateSamples: [12, 40, 25],
}

vi.mock('@/hooks/use-stream-telemetry', () => ({
  useStreamTelemetry: () => telemetryState,
}))

import { StreamTelemetryBar } from '@/components/chat/workbench/stream-telemetry-bar'

afterEach(cleanup)

describe('StreamTelemetryBar', () => {
  it('从未跑过 ⇒ 不渲染', () => {
    const original = telemetryState.hasRun
    telemetryState.hasRun = false
    render(<StreamTelemetryBar />)
    expect(document.querySelector('[data-stream-telemetry]')).toBeNull()
    telemetryState.hasRun = original
  })

  it('流式中 ⇒ 阶段 + 耗时 + 首字 + 速率 + tokens + 工具数', () => {
    render(<StreamTelemetryBar />)
    const bar = document.querySelector('[data-stream-telemetry]') as HTMLElement
    expect(bar).not.toBeNull()
    expect(bar.dataset.phase).toBe('writing')
    const text = bar.textContent ?? ''
    expect(text).toContain('[telemetryWriting]')
    expect(text).toContain('8.4s')
    expect(text).toContain('0.6s')
    expect(text).toContain('[telemetryRateValue]')
    expect(text).toContain('1.3k')
    expect(text).toContain('[telemetryTools]')
    expect(text).not.toContain('[telemetryFailed]')
    expect(document.querySelector('[data-telemetry-sparkline]')).not.toBeNull()
  })

  it('采样不足两个点不画火花线（不拿一个点冒充趋势）', () => {
    const original = telemetryState.rateSamples
    telemetryState.rateSamples = [42]
    render(<StreamTelemetryBar />)
    expect(document.querySelector('[data-telemetry-sparkline]')).toBeNull()
    telemetryState.rateSamples = original
  })

  it('失败工具 > 0 才出失败格', () => {
    telemetryState.failedTools = 2
    render(<StreamTelemetryBar />)
    const bar = document.querySelector('[data-stream-telemetry]') as HTMLElement
    expect(bar.textContent).toContain('[telemetryFailed]')
    telemetryState.failedTools = 0
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
