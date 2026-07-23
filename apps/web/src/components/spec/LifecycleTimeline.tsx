'use client'

import {
  SPEC_LIFECYCLE_STAGES,
  type SpecLifecycleStage,
} from '@ihui/shared/spec/index'

interface LifecycleTimelineProps {
  proposedAt?: string
  approvedAt?: string
  implementingAt?: string
  verifiedAt?: string
}

const stageOrder: SpecLifecycleStage[] = [
  'proposed',
  'approved',
  'implementing',
  'verified',
]

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

/** 生命周期时间轴:四阶段 proposed → approved → implementing → verified */
export function LifecycleTimeline({
  proposedAt,
  approvedAt,
  implementingAt,
  verifiedAt,
}: LifecycleTimelineProps) {
  const ts: Record<SpecLifecycleStage, string | undefined> = {
    proposed: proposedAt,
    approved: approvedAt,
    implementing: implementingAt,
    verified: verifiedAt,
  }

  // 当前阶段 = 最后一个有时间戳的阶段
  let currentStage: SpecLifecycleStage = 'proposed'
  for (const stage of stageOrder) {
    if (ts[stage]) currentStage = stage
  }
  const currentIndex = stageOrder.indexOf(currentStage)

  return (
    <ol className="space-y-1">
      {SPEC_LIFECYCLE_STAGES.map((meta, i) => {
        const stamp = ts[meta.value]
        const completed = i <= currentIndex
        const isCurrent = i === currentIndex
        return (
          <li key={meta.value} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-medium ${
                  completed ? meta.color : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </span>
              {i < SPEC_LIFECYCLE_STAGES.length - 1 && (
                <span
                  className={`mt-1 w-px flex-1 ${i < currentIndex ? 'bg-foreground/30' : 'bg-border'}`}
                  style={{ minHeight: '0.75rem' }}
                />
              )}
            </div>
            <div className="flex-1 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{meta.label}</span>
                {isCurrent && (
                  <span className={`rounded-md px-1.5 py-0.5 text-xs ${meta.color}`}>
                    当前
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
              {stamp && (
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {formatDate(stamp)}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
