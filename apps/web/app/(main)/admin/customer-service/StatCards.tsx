import { Headphones, Clock, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CsStats } from './types'

const STAT_CARDS = [
  {
    key: 'online',
    label: '在线客服',
    icon: Headphones,
    cls: 'text-emerald-600',
    value: (s: CsStats) => s.onlineAgents,
  },
  {
    key: 'waiting',
    label: '等待中',
    icon: Clock,
    cls: 'text-amber-600',
    value: (s: CsStats) => s.waiting,
  },
  {
    key: 'processed',
    label: '今日已处理',
    icon: CheckCircle,
    cls: 'text-primary',
    value: (s: CsStats) => s.todayProcessed,
  },
]

export function StatCards({ stats }: { stats: CsStats }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {STAT_CARDS.map((c) => (
        <div key={c.key} className="flex items-center gap-3 rounded-lg border bg-card p-3">
          <c.icon className={cn('h-5 w-5', c.cls)} />
          <div>
            <p className="text-lg font-semibold">{c.value(stats)}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
