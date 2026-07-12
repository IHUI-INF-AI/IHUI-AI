import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { cn } from '@/lib/utils'
import { PROVIDERS } from './helpers'
import type { Provider } from './types'

interface Props {
  active: Provider | 'all'
}

export async function ModelsNav({ active }: Props) {
  const t = await getTranslations('models')

  const tabs: { key: Provider | 'all'; label: string }[] = [
    { key: 'all', label: t('all') },
    ...PROVIDERS.map((p) => ({ key: p, label: t(`providers.${p}`) })),
  ]

  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        const href = tab.key === 'all' ? '/models' : `/models?provider=${tab.key}`
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
