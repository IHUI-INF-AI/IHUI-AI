import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Layers } from 'lucide-react'

import { BrandIcon } from '@/components/ai/brand-icon'
import { cn } from '@/lib/utils'
import { PROVIDER_GROUPS } from './helpers'
import type { Provider, ProviderGroup } from './types'

interface Props {
  active: Provider | 'all'
}

const GROUP_ORDER: ProviderGroup[] = [
  'international',
  'domestic',
  'inference',
  'cloud',
  'aggregator',
  'local',
]

/**
 * 模型市场厂商 nav:
 * - 紧凑 pill 风格(对齐 FilterChip)+ BrandIcon(厂商真实矢量 SVG)
 * - 6 个分组 inline label 分组(国际/国内/推理/云/聚合/本地),降低 80+ 厂商认知负担
 * - active 态:bg-primary + text-primary-foreground(主色填充,无下划线)
 * - hover 态:bg-accent + text-accent-foreground(subtle 容器色变化,无蓝光描边)
 * - 顶层"全部"独立一行(Layers icon),与分组厂商视觉区分
 * - 整体容器:bg-muted/30 浅灰底,subtle 容器边界,符合"不要单边 border 分割线"规则
 */
export async function ModelsNav({ active }: Props) {
  const t = await getTranslations('models')

  return (
    <nav
      aria-label={t('navAriaLabel')}
      className="flex flex-col gap-3 rounded-lg bg-muted/30 p-3"
    >
      {/* 顶部"全部"速选 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <ProviderPill
          href="/models"
          label={t('all')}
          icon={<Layers className="h-3.5 w-3.5" aria-hidden="true" />}
          active={active === 'all'}
        />
      </div>

      {/* 6 个分组:每组 inline label + 该组厂商 pills */}
      {GROUP_ORDER.map((groupKey) => {
        const group = PROVIDER_GROUPS.find((g) => g.key === groupKey)
        if (!group) return null
        return (
          <div key={groupKey} className="flex flex-wrap items-center gap-1.5">
            <span
              className="mr-1 inline-flex h-7 items-center rounded-md bg-background/60 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
              data-group-label={groupKey}
            >
              {t(`providerGroups.${groupKey}`)}
            </span>
            {group.providers.map((p) => (
              <ProviderPill
                key={p}
                href={`/models?provider=${p}`}
                label={t(`providers.${p}`)}
                icon={<BrandIcon vendor={p} size={14} />}
                active={active === p}
              />
            ))}
          </div>
        )
      })}
    </nav>
  )
}

function ProviderPill({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-transparent bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  )
}
