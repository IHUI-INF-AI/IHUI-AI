// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 大屏指挥台 · 流式遥测条(2026-10-29 立)。
 *
 * 只挂工作台(全屏形态),不挂停靠侧栏:它是"看得见的一轮在怎么跑"的经营面板,
 * 不是每条聊天都必须付的 28px。读数三纪律:
 * ① 只显示取得到的值(缺 token/缺首字就不显示那格,不拿 0 冒充);
 * ② 一律单行 + `tabular-nums`(读数不得断行/不跳动);
 * ③ 数字用紧凑档(1.2k/8.4s),单位进 i18n 文案,不在组件里拼中英文。
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Activity, CheckCircle2 } from 'lucide-react'

import { useStreamTelemetry } from '@/hooks/use-stream-telemetry'
import {
  formatCompactCount,
  formatElapsedShort,
  type StreamTelemetryPhase,
} from '@/lib/stream-telemetry'
import { cn } from '@/lib/utils'

const PHASE_KEYS: Readonly<Record<StreamTelemetryPhase, string>> = {
  waiting: 'telemetryWaiting',
  thinking: 'telemetryThinking',
  tool: 'telemetryTool',
  writing: 'telemetryWriting',
  done: 'telemetryDone',
}

function Readout({
  label,
  value,
  danger,
  testId,
}: {
  label: string
  value: string
  danger?: boolean
  testId?: string
}) {
  return (
    <span
      className="flex shrink-0 items-baseline gap-1 whitespace-nowrap tabular-nums"
      data-telemetry-readout={testId}
    >
      <span className="text-muted-foreground/60">{label}</span>
      <span className={cn('font-medium text-foreground/85', danger && 'text-red-500')}>
        {value}
      </span>
    </span>
  )
}

/** 速率火花线:最近 24 拍(含 0 停顿样本)。纯 SVG,无渐变、无第三方图表库。 */
function RateSparkline({ samples }: { samples: number[] }) {
  if (samples.length < 2) return null
  const width = 64
  const height = 16
  const max = Math.max(...samples, 1)
  const step = width / (samples.length - 1)
  const points = samples
    .map((value, index) => {
      const x = index * step
      const y = height - 1 - (Math.max(0, value) / max) * (height - 3)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="ml-auto h-4 w-16 shrink-0 text-primary/60"
      aria-hidden
      data-telemetry-sparkline=""
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function StreamTelemetryBar({ className }: { className?: string }) {
  const t = useTranslations('chat')
  const telemetry = useStreamTelemetry()
  if (!telemetry.hasRun) return null

  const running = telemetry.phase !== 'done'
  const rateText =
    telemetry.charsPerSec > 0 ? t('telemetryRateValue', { n: telemetry.charsPerSec }) : ''

  return (
    <div
      role="status"
      aria-live="off"
      aria-label={t(PHASE_KEYS[telemetry.phase])}
      data-stream-telemetry=""
      data-phase={telemetry.phase}
      className={cn(
        'flex h-7 shrink-0 items-center gap-3 overflow-hidden border-b border-border bg-muted/20 px-4 text-[11px] leading-none text-muted-foreground',
        className,
      )}
    >
      <span className="flex shrink-0 items-center gap-1.5">
        {running ? (
          <Activity className="h-3 w-3 animate-pulse text-primary" aria-hidden />
        ) : (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" aria-hidden />
        )}
        <span className={cn('font-medium', running ? 'text-foreground' : 'text-muted-foreground')}>
          {t(PHASE_KEYS[telemetry.phase])}
        </span>
      </span>
      <Readout
        label={t('telemetryElapsed')}
        value={formatElapsedShort(telemetry.elapsedMs)}
        testId="elapsed"
      />
      {telemetry.ttftMs !== null && (
        <Readout
          label={t('telemetryTtft')}
          value={formatElapsedShort(telemetry.ttftMs)}
          testId="ttft"
        />
      )}
      {rateText !== '' && <Readout label={t('telemetryRate')} value={rateText} testId="rate" />}
      {telemetry.tokens !== null && (
        <Readout
          label={t('telemetryTokens')}
          value={formatCompactCount(telemetry.tokens)}
          testId="tokens"
        />
      )}
      {telemetry.toolCount > 0 && (
        <Readout label={t('telemetryTools')} value={String(telemetry.toolCount)} testId="tools" />
      )}
      {telemetry.failedTools > 0 && (
        <Readout
          label={t('telemetryFailed')}
          value={String(telemetry.failedTools)}
          danger
          testId="failed"
        />
      )}
      <RateSparkline samples={telemetry.rateSamples} />
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
