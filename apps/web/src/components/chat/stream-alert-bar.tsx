// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D155(2026-09-29 立):输入区上方的下行告警条(config-warning / deprecation-notice /
// guardian-warning 三档)。消费 `@ihui/api-client` 已解析的三档命名帧(message/severity
// 及各自可选字段,契约见 shared contract.ts 的 SSE_ALERT_EVENTS 段;生产判定点在
// ai-service,现场释放)。落点数据在 `@/hooks/use-chat/stream-alerts`(帧 → 模块级态),
// 本组件只读不算第二份数。未收到任何告警帧 ⇒ 整条不渲染不占位(与 ContextBudgetBar 同纪律)。
// 措辞纪律:chrome 文案(档位名/强度名/关掉)一律走五语言词表;帧上的 message 是
// 生产端措辞,原样作正文渲染(端内不翻译、不拼接 —— 翻了反而冒充生产端说过它没说的话)。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  clearStreamAlert,
  getStreamAlerts,
  getStreamAlertsServerSnapshot,
  STREAM_ALERT_KINDS,
  subscribeStreamAlerts,
  type StreamAlertKind,
} from '@/hooks/use-chat/stream-alerts'

/** 强度 → 色档:info 蓝 / warning 琥珀 / critical 红(与 ContextBudgetBar 的 warning/critical 同族) */
const SEVERITY_STYLES: Record<string, string> = {
  info: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  critical: 'bg-red-500/10 text-red-700 dark:text-red-400',
}

export function StreamAlertBar() {
  const alerts = React.useSyncExternalStore(
    subscribeStreamAlerts,
    getStreamAlerts,
    getStreamAlertsServerSnapshot,
  )
  const t = useTranslations('chat')

  const active = STREAM_ALERT_KINDS.map((kind) => ({ kind, alert: alerts[kind] })).filter(
    (entry) => entry.alert !== null,
  )
  if (active.length === 0) return null

  return (
    // 间距由唯一挂载点 InputStatusSlot 统一接管(2026-09-30),不再自带 mx-4 mb-2
    <div role="status" data-testid="stream-alert-bar" className="space-y-1">
      {active.map(({ kind, alert }) => (
        <div
          key={kind}
          data-testid={`stream-alert-${kind}`}
          data-severity={alert.severity}
          className={cn(
            'ui-card flex min-w-0 items-start gap-2 rounded-lg px-3 py-2 text-xs',
            SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.warning,
          )}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="shrink-0 font-medium">{t(`streamAlert.${kind}.title`)}</span>
          <span className="min-w-0 flex-1 break-words opacity-90">{alert.message}</span>
          <span className="shrink-0 rounded bg-black/5 px-1 py-0.5 text-[10px] font-semibold leading-none dark:bg-white/10">
            {t(`streamAlert.severity.${alert.severity}`)}
          </span>
          <button
            type="button"
            data-testid={`stream-alert-dismiss-${kind}`}
            aria-label={t('streamAlert.dismiss')}
            onClick={() => clearStreamAlert(kind)}
            className="shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
