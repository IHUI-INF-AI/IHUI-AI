import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { PluginMarketplace } from './PluginMarketplace'

export const metadata: Metadata = {
  title: '插件市场',
  description: '探索本项目内置插件与全网热门 AI 插件脚本市场',
}

export default async function PluginsPage() {
  const t = await getTranslations('plugins')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold leading-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <PluginMarketplace />
    </div>
  )
}
