// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { Button } from '@ihui/ui-react'
import { Tooltip } from '@/components/feedback/Tooltip'
import type { AgentPlanDetail } from '@ihui/api-client'
import { StatusBadge } from './StatusBadge'

interface Props {
  detail: AgentPlanDetail
  onReset: () => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="break-words font-mono text-sm">{value}</span>
    </div>
  )
}

export function AgentPlanResult({ detail, onReset }: Props) {
  const t = useTranslations('agentPlan')
  const isRejected = detail.status === 'rejected'
  const result = detail.result

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={detail.status} />
        <Tooltip content={detail.plan_id}>
          <span className="font-mono text-xs text-muted-foreground">
            {detail.plan_id.slice(0, 8)}…
          </span>
        </Tooltip>
      </div>

      {isRejected ? (
        <div className="flex flex-col gap-1 rounded-md bg-muted p-4">
          <span className="text-sm font-medium">{t('rejectedTitle')}</span>
          <span className="text-sm text-muted-foreground">{t('rejectedDesc')}</span>
        </div>
      ) : (
        result && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('stopReason')} value={String(result.stop_reason ?? '—')} />
              <Field label={t('iterations')} value={String(result.iterations ?? 0)} />
            </div>
            {result.error ? <Field label={t('error')} value={String(result.error)} /> : null}
            <div className="flex flex-col gap-1 rounded-md bg-muted p-3">
              <span className="text-xs font-medium text-muted-foreground">
                {t('finalResponse')}
              </span>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm">
                {result.final_response || '—'}
              </pre>
            </div>
          </div>
        )
      )}

      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={onReset}>
          <RotateCcw />
          {t('reset')}
        </Button>
      </div>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
