// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ListChecks } from 'lucide-react'

import { GOAL_STATUSES, type GoalStatus } from '@ihui/types'
import { listMyGoals, type MyGoalRow } from '@ihui/api-client'

import { cn } from '@/lib/utils'
import {
  groupQuestsByWorkspace,
  questStatusCounts,
  useQuestsStore,
  type QuestEntry,
  type QuestStatus,
} from '@/stores/quests'

/**
 * MyQuestsBoard — 票77(2026-10-18)「My Quests 跨 workspace 全局看板」前端切片。
 *
 * 数据面 = `stores/quests` 端内登记表(goal 生命周期自动登记 + 手动自评估);
 * 挂载时经 `GET /api/sessions/goals`(票77 服务端聚合腿)灌入跨会话目标与真实 workspaceId,
 * 灌入失败(网络/服务不可达)静默保留端内登记表,看板照常可用(D152 兜底)。
 * 不另造第二套状态词汇:六档取自 `@ihui/types` 的 `GOAL_STATUSES`,
 * 状态取词沿用 goalCard 四旧词 + chat.goal.status 两新词(goal-card.tsx 同一张映射,
 * 此处按取词位置重抄一份 —— goal-card 与本板互不 import,避免环;词汇本体仍单源)。
 */

/** 六档 → 取词位置(goal-card.tsx 的 STATUS_LABEL 同一张表,词汇源同 @ihui/types) */
const STATUS_LABEL: Record<QuestStatus, readonly ['goalCard' | 'chat.goal.status', string]> = {
  active: ['goalCard', 'statusActive'],
  paused: ['goalCard', 'statusPaused'],
  blocked: ['goalCard', 'statusBlocked'],
  done: ['goalCard', 'statusDone'],
  usageLimited: ['chat.goal.status', 'usageLimited'],
  budgetLimited: ['chat.goal.status', 'budgetLimited'],
}

const STATUS_TONE: Record<QuestStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-600',
  paused: 'bg-amber-500/15 text-amber-600',
  blocked: 'bg-destructive/10 text-destructive',
  done: 'bg-primary/15 text-primary',
  usageLimited: 'bg-orange-500/15 text-orange-600',
  budgetLimited: 'bg-violet-500/15 text-violet-600',
}

function statusTone(status: QuestStatus): string {
  return STATUS_TONE[status]
}

function QuestRow({
  quest,
  label,
  onAssess,
}: {
  quest: QuestEntry
  label: string
  onAssess: (goalId: string, summary: string) => void
}) {
  const t = useTranslations('myQuests')
  const [draft, setDraft] = React.useState('')
  const latest = quest.assessments[quest.assessments.length - 1]
  const submit = () => {
    if (!draft.trim()) return
    onAssess(quest.goalId, draft)
    setDraft('')
  }
  return (
    <div
      data-testid={`my-quests-row-${quest.goalId}`}
      className="space-y-1 rounded-md border px-2 py-1.5"
    >
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-xs" title={quest.text}>
          {quest.text}
        </span>
        <span
          data-testid={`my-quests-status-${quest.goalId}`}
          className={cn(
            'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
            statusTone(quest.status),
          )}
        >
          {label}
        </span>
        <span
          data-testid={`my-quests-progress-${quest.goalId}`}
          className="shrink-0 text-xs text-muted-foreground"
        >
          {quest.progress}%
        </span>
      </div>
      <p
        data-testid={`my-quests-latest-${quest.goalId}`}
        className="truncate text-xs text-muted-foreground"
      >
        {t('latestAssessment')}
        {': '}
        {latest && latest.summary ? latest.summary : t('noAssessment')}
      </p>
      <div className="flex gap-1.5">
        <input
          data-testid={`my-quests-assess-input-${quest.goalId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={t('assessmentPlaceholder')}
          className="min-w-0 flex-1 rounded-sm border bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          data-testid={`my-quests-assess-add-${quest.goalId}`}
          onClick={submit}
          className="flex shrink-0 items-center gap-0.5 rounded-sm border px-2 py-1 text-xs transition-colors hover:bg-accent"
        >
          {t('addAssessment')}
        </button>
      </div>
    </div>
  )
}

export function MyQuestsBoard({
  loadGoals = listMyGoals,
}: {
  /** 测试注入口;生产恒为 api-client 的 listMyGoals */
  loadGoals?: () => Promise<MyGoalRow[]>
} = {}) {
  const t = useTranslations('myQuests')
  const tGoalCard = useTranslations('goalCard')
  const tShared = useTranslations('chat.goal.status')
  const entries = useQuestsStore((s) => s.entries)
  const recordAssessment = useQuestsStore((s) => s.recordAssessment)
  const hydrateFromServer = useQuestsStore((s) => s.hydrateFromServer)

  React.useEffect(() => {
    let cancelled = false
    loadGoals()
      .then((rows) => {
        if (!cancelled) hydrateFromServer(rows)
      })
      .catch(() => {
        // 服务端聚合不可达 ⇒ 保留端内登记表(D152 兜底),看板不因网络失败而空
      })
    return () => {
      cancelled = true
    }
  }, [loadGoals, hydrateFromServer])

  const counts = questStatusCounts(entries)
  const groups = groupQuestsByWorkspace(entries)

  const statusLabel = (status: GoalStatus): string => {
    const [ns, key] = STATUS_LABEL[status]
    return ns === 'goalCard' ? tGoalCard(key) : tShared(key)
  }

  const handleAssess = (goalId: string, summary: string) => {
    recordAssessment(goalId, { summary })
  }

  return (
    <div data-testid="my-quests-board" className="space-y-2 pt-2">
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <ListChecks className="h-3 w-3" />
        <span data-testid="my-quests-title">{t('title')}</span>
        <span data-testid="my-quests-total" className="font-normal">
          {t('total', { count: counts.total })}
        </span>
      </p>
      {counts.total === 0 ? (
        <p data-testid="my-quests-empty" className="text-xs text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1" data-testid="my-quests-counts">
            {GOAL_STATUSES.filter((status) => counts[status] > 0).map((status) => (
              <span
                key={status}
                data-testid={`my-quests-count-${status}`}
                className={cn(
                  'rounded-sm px-1.5 py-0.5 text-[10px] font-medium',
                  statusTone(status),
                )}
              >
                {statusLabel(status)} × {counts[status]}
              </span>
            ))}
          </div>
          {groups.map((group) => (
            <div key={group.workspaceId} className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {group.workspaceId || t('currentWorkspace')}
              </p>
              {group.quests.map((quest) => (
                <QuestRow
                  key={quest.goalId}
                  quest={quest}
                  label={statusLabel(quest.status)}
                  onAssess={handleAssess}
                />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
