import { getTranslations } from 'next-intl/server'
import { Bot, Sparkles, Building2, Gift } from 'lucide-react'

import { cn } from '@/lib/utils'

interface Props {
  /** 当前可见模型总数(已应用 provider 过滤) */
  total: number
  /** 免费模型数量 */
  freeCount: number
  /** 当前可见的厂商数量 */
  providerCount: number
  /** 推荐(highlight)模型数量 */
  highlightCount: number
}

/**
 * 模型广场页头:标题 + 副标题 + 4 项快速统计
 * 统计卡片使用容器背景色对比区分(无单边 border,符合项目规范)
 */
export async function ModelsHeader({ total, freeCount, providerCount, highlightCount }: Props) {
  const t = await getTranslations('models')

  const stats = [
    {
      key: 'total',
      icon: Bot,
      label: t('header.stats.total'),
      value: total,
      tone: 'primary' as const,
    },
    {
      key: 'highlight',
      icon: Sparkles,
      label: t('header.stats.highlight'),
      value: highlightCount,
      tone: 'amber' as const,
    },
    {
      key: 'free',
      icon: Gift,
      label: t('header.stats.free'),
      value: freeCount,
      tone: 'emerald' as const,
    },
    {
      key: 'providers',
      icon: Building2,
      label: t('header.stats.providers'),
      value: providerCount,
      tone: 'sky' as const,
    },
  ]

  const toneClass: Record<'primary' | 'amber' | 'emerald' | 'sky', string> = {
    primary: 'bg-primary/10 text-primary',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  }

  return (
    <header className="space-y-4">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl [&>span]:translate-y-[0.5px]">
          <Bot className="h-7 w-7 text-primary" />
          <span>{t('title')}</span>
        </h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div
              key={s.key}
              className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted/70"
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                  toneClass[s.tone],
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold leading-tight">{s.value}</div>
                <div className="truncate text-[11px] text-muted-foreground">{s.label}</div>
              </div>
            </div>
          )
        })}
      </div>
    </header>
  )
}
