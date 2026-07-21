'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Wrench, AppWindow, Newspaper, FileText, Github, Sparkles, Trophy } from 'lucide-react'

import { fetchAiWorld } from './helpers'
import { ItemList } from './ItemList'
import { CategorySidebar } from './CategorySidebar'
import { AiChatSection } from './AiChatSection'
import { HotAppsCard } from './HotAppsCard'
import { RankingTable } from './RankingTable'
import type { ItemKind } from './types'

type TabKey = 'tools' | 'apps' | 'news' | 'papers' | 'projects' | 'rankings' | 'ai'

interface TabDef {
  key: TabKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  kind?: ItemKind
  layout: 'grid' | 'list'
  hasSidebar: boolean
}

const TABS: TabDef[] = [
  { key: 'tools', label: '工具集', icon: Wrench, kind: 'tool', layout: 'grid', hasSidebar: true },
  { key: 'apps', label: '应用集', icon: AppWindow, kind: 'app', layout: 'grid', hasSidebar: true },
  { key: 'news', label: '资讯', icon: Newspaper, kind: 'news', layout: 'list', hasSidebar: false },
  { key: 'papers', label: '论文', icon: FileText, kind: 'paper', layout: 'list', hasSidebar: false },
  { key: 'projects', label: '项目', icon: Github, kind: 'project', layout: 'list', hasSidebar: false },
  { key: 'rankings', label: '模型排行', icon: Trophy, layout: 'list', hasSidebar: false },
  { key: 'ai', label: 'AI 对话', icon: Sparkles, layout: 'list', hasSidebar: false },
]

export default function AiWorldPage() {
  const t = useTranslations('common.aiWorld')
  const [activeTab, setActiveTab] = React.useState<TabKey>('tools')
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null)
  const [aiOpen, setAiOpen] = React.useState(false)

  const { data } = useQuery({
    queryKey: ['ai-world'],
    queryFn: fetchAiWorld,
  })

  const categories = data?.categories ?? []
  const hotApps = (data?.apps ?? []).slice(0, 6).map((a) => ({
    id: a.id,
    name: a.title,
    href: a.url ?? `/ai-world/items/${a.id}`,
  }))

  const activeTabDef = TABS.find((tab) => tab.key === activeTab)!

  // 切换 Tab 时重置分类
  React.useEffect(() => {
    setActiveCategory(null)
  }, [activeTab])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {hotApps.length > 0 && <HotAppsCard hotApps={hotApps} onNavigate={() => setActiveTab('apps')} />}

      {/* Tab 切换 */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-card p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* 主内容区 */}
      {activeTab === 'ai' ? (
        <AiChatSection open={aiOpen} onToggle={() => setAiOpen((v) => !v)} />
      ) : activeTab === 'rankings' ? (
        <RankingTable />
      ) : activeTabDef.hasSidebar ? (
        <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
          <aside className="rounded-lg border bg-card p-2">
            <CategorySidebar
              categories={categories}
              activeCategory={activeCategory}
              onChange={setActiveCategory}
            />
          </aside>
          <ItemList
            kind={activeTabDef.kind!}
            category={activeCategory ?? undefined}
            layout="grid"
            pageSize={12}
            emptyHint="该分类暂无数据,等待下次同步"
          />
        </div>
      ) : (
        <ItemList
          kind={activeTabDef.kind!}
          layout="list"
          pageSize={15}
          emptyHint="暂无数据,等待下次同步"
        />
      )}
    </div>
  )
}
