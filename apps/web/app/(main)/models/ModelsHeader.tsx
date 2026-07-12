import { getTranslations } from 'next-intl/server'
import { Bot } from 'lucide-react'

export async function ModelsHeader() {
  const t = await getTranslations('models')

  return (
    <header className="space-y-1">
      <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
        <Bot className="h-7 w-7 text-primary" />
        {t('title')}
      </h1>
      <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
    </header>
  )
}
