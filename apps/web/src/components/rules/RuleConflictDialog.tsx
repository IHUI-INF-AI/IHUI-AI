// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Loader2, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import { rulesApi } from './rules-api'
import type { RuleConflict, RuleConflictsResponse, RuleResolveConflictsResult } from './types'
import type { Rule } from '@ihui/types'
import { Button, CloseButton } from '@ihui/ui-react'

interface RuleConflictDialogProps {
  rules: Rule[]
  onClose: () => void
}

/** 冲突类型 -> 语言包 key(界面文案一律走 t(),不得在此硬编码中文) */
const CONFLICT_TYPE_KEYS = {
  name_conflict: 'conflictNameConflict',
  semantic_duplicate: 'conflictSemanticDuplicate',
  priority_collision: 'conflictPriorityCollision',
} as const satisfies Record<RuleConflict['type'], string>

/** 冲突类型徽章样式 */
function conflictBadgeClass(type: RuleConflict['type']): string {
  switch (type) {
    case 'name_conflict':
      return 'bg-yellow-500/10 text-yellow-600'
    case 'semantic_duplicate':
      return 'bg-orange-500/10 text-orange-600'
    case 'priority_collision':
      return 'bg-red-500/10 text-red-600'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function RuleConflictDialog({ rules, onClose }: RuleConflictDialogProps) {
  const t = useTranslations('rules')
  const tCommon = useTranslations('common')
  const conflictLabel = (type: RuleConflict['type']): string => t(CONFLICT_TYPE_KEYS[type])
  const [conflicts, setConflicts] = React.useState<RuleConflict[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [arbitrationContext, setArbitrationContext] = React.useState('')
  const [arbitrating, setArbitrating] = React.useState<number | null>(null)
  const [arbitrationResults, setArbitrationResults] = React.useState<
    Record<number, RuleResolveConflictsResult>
  >({})

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    rulesApi<RuleConflictsResponse>('/api/rules/conflicts')
      .then((res) => {
        if (!cancelled) {
          setConflicts(res.conflicts)
          setLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 规则 ID → 名称映射(用于在冲突详情中显示可读名称)
  const ruleNameMap = React.useMemo(() => new Map(rules.map((r) => [r.id, r.name])), [rules])

  const handleArbitrate = async (idx: number, ruleIds: string[]) => {
    if (!arbitrationContext.trim() || ruleIds.length < 2) return
    setArbitrating(idx)
    try {
      const res = await rulesApi<RuleResolveConflictsResult>('/api/rules/resolve-conflicts', {
        method: 'POST',
        body: JSON.stringify({
          context: arbitrationContext,
          conflictingRules: ruleIds,
        }),
      })
      setArbitrationResults((prev) => ({ ...prev, [idx]: res }))
    } catch (e) {
      setArbitrationResults((prev) => ({
        ...prev,
        [idx]: {
          winningRule: null,
          reason: t('negotiationFailed', { msg: (e as Error).message }),
          alternative: null,
          degraded: true,
        },
      }))
    } finally {
      setArbitrating(null)
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 模态遮罩点击外部关闭;键盘用户通过关闭按钮(X)提供等价交互
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-white/40 p-3 dark:bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col space-y-3 rounded-lg border border-border bg-card p-3 shadow-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">{t('conflictDetectTitle')}</span>
          <CloseButton aria-label={tCommon('close')} onClick={onClose} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('detecting')}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : conflicts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-green-500/10 text-green-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground">{t('noConflict')}</p>
          </div>
        ) : (
          <div className="thin-scroll space-y-2 overflow-y-auto">
            <p className="text-xs text-muted-foreground">
              {t('detectedConflictsHint', { n: conflicts.length })}
            </p>
            <div className="space-y-1">
              <label htmlFor="rule-arb-ctx" className="text-[10px] text-muted-foreground">
                {t('arbitrationContextLabel')}
              </label>
              <textarea
                id="rule-arb-ctx"
                value={arbitrationContext}
                onChange={(e) => setArbitrationContext(e.target.value)}
                placeholder={t('arbitrationContextPlaceholder')}
                rows={2}
                className="thin-scroll w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-xs leading-relaxed outline-none focus:border-foreground/20"
              />
            </div>
            {conflicts.map((conflict, idx) => (
              <div
                key={`${conflict.type}-${idx}`}
                className="space-y-1.5 rounded-md border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'shrink-0 rounded-sm px-2 py-1 text-[10px]',
                      conflictBadgeClass(conflict.type),
                    )}
                  >
                    {conflictLabel(conflict.type)}
                  </span>
                  <span className="flex-1 min-w-0 text-xs text-muted-foreground">
                    {conflict.detail}
                  </span>
                  {conflict.ruleIds.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => handleArbitrate(idx, conflict.ruleIds)}
                      disabled={arbitrating !== null || !arbitrationContext.trim()}
                      className="shrink-0 rounded-sm border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {arbitrating === idx ? t('negotiating') : t('llmNegotiate')}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {conflict.ruleIds.map((rid) => (
                    <span
                      key={rid}
                      className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {ruleNameMap.get(rid) ?? rid}
                    </span>
                  ))}
                </div>
                {arbitrationResults[idx] && (
                  <div className="space-y-1 rounded-sm bg-muted/50 p-2 text-[10px]">
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-green-600" />
                      <span className="font-medium">
                        {t('arbitrationResult')}
                        {arbitrationResults[idx].winningRule
                          ? arbitrationResults[idx].winningRule.name
                          : t('noneLabel')}
                      </span>
                      {arbitrationResults[idx].degraded && (
                        <span className="rounded-sm bg-yellow-500/10 px-1 text-yellow-600">
                          {t('degraded')}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">{arbitrationResults[idx].reason}</p>
                    {arbitrationResults[idx].alternative && (
                      <p className="text-muted-foreground">
                        {t('mergeSuggestion', { text: arbitrationResults[idx].alternative })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            {tCommon('close')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export { RuleConflictDialog }
export type { RuleConflictDialogProps }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
