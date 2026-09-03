// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useTranslations } from 'next-intl'
import { Pencil, X, Check, Ban, Loader2 } from 'lucide-react'
import { Button, Badge } from '@ihui/ui-react'
import { Textarea } from '@/components/form'
import { Tooltip } from '@/components/feedback/Tooltip'
import type { AgentPlanDetail } from '@ihui/api-client'
import { StatusBadge } from './StatusBadge'

interface Props {
  detail: AgentPlanDetail
  busy: boolean
  editedMd: string
  isEditing: boolean
  onEditedMdChange: (value: string) => void
  onToggleEdit: () => void
  onApprove: () => void
  onReject: () => void
}

export function AgentPlanView({
  detail,
  busy,
  editedMd,
  isEditing,
  onEditedMdChange,
  onToggleEdit,
  onApprove,
  onReject,
}: Props) {
  const t = useTranslations('agentPlan')

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

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{t('planTitle')}</span>
          {!busy && (
            <Button variant="ghost" size="sm" onClick={onToggleEdit} className="gap-1.5">
              {isEditing ? (
                <>
                  <X />
                  {t('cancel')}
                </>
              ) : (
                <>
                  <Pencil />
                  {t('edit')}
                </>
              )}
            </Button>
          )}
        </div>

        {isEditing ? (
          <Textarea
            autoResize
            value={editedMd}
            onChange={(e) => onEditedMdChange(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-muted p-4 font-mono text-sm">
            {detail.plan_md}
          </pre>
        )}
        {isEditing && <p className="text-xs text-muted-foreground">{t('editHint')}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t('readonlyTools')}</span>
        <div className="flex flex-wrap gap-2 rounded-md bg-muted p-3">
          {detail.readonly_tools.length === 0 ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            detail.readonly_tools.map((tool) => (
              <Badge key={tool} variant="secondary" className="font-mono">
                {tool}
              </Badge>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onApprove} disabled={busy}>
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              {t('executing')}
            </>
          ) : (
            <>
              <Check />
              {t('approve')}
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onReject} disabled={busy}>
          <Ban />
          {t('reject')}
        </Button>
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" />
          {t('executing')}
        </p>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
