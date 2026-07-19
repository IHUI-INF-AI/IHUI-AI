import { getTranslations } from 'next-intl/server'
import { Search, Sparkles } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'

export default async function SkillsPage() {
  const t = await getTranslations('models')

  const categories = [
    'skills.categories.weather',
    'skills.categories.search',
    'skills.categories.code',
    'skills.categories.productivity',
    'skills.categories.communication',
    'skills.categories.data',
    'skills.categories.media',
    'skills.categories.system',
  ]

  const skills = [
    {
      name: 'weather',
      author: 'yunwu',
      category: 'skills.categories.weather',
      desc: 'skills.items.weather.desc',
      icon: '🌤️',
      installs: '12.3k',
      featured: true,
    },
    {
      name: 'node-connect',
      author: 'mcp',
      category: 'skills.categories.system',
      desc: 'skills.items.nodeConnect.desc',
      icon: '🔌',
      installs: '8.7k',
      featured: true,
    },
    {
      name: 'healthcheck',
      author: 'ops',
      category: 'skills.categories.system',
      desc: 'skills.items.healthcheck.desc',
      icon: '❤️',
      installs: '5.2k',
      featured: false,
    },
    {
      name: 'web-search',
      author: 'search',
      category: 'skills.categories.search',
      desc: 'skills.items.webSearch.desc',
      icon: '🔍',
      installs: '24.1k',
      featured: true,
    },
    {
      name: 'code-runner',
      author: 'dev',
      category: 'skills.categories.code',
      desc: 'skills.items.codeRunner.desc',
      icon: '⚡',
      installs: '18.5k',
      featured: false,
    },
    {
      name: 'pdf-toolkit',
      author: 'doc',
      category: 'skills.categories.productivity',
      desc: 'skills.items.pdfToolkit.desc',
      icon: '📄',
      installs: '15.3k',
      featured: false,
    },
    {
      name: 'email-sender',
      author: 'comm',
      category: 'skills.categories.communication',
      desc: 'skills.items.emailSender.desc',
      icon: '📧',
      installs: '7.9k',
      featured: false,
    },
    {
      name: 'data-viz',
      author: 'data',
      category: 'skills.categories.data',
      desc: 'skills.items.dataViz.desc',
      icon: '📊',
      installs: '9.4k',
      featured: false,
    },
    {
      name: 'image-gen',
      author: 'media',
      category: 'skills.categories.media',
      desc: 'skills.items.imageGen.desc',
      icon: '🎨',
      installs: '21.8k',
      featured: true,
    },
    {
      name: 'audio-transcribe',
      author: 'media',
      category: 'skills.categories.media',
      desc: 'skills.items.audioTranscribe.desc',
      icon: '🎙️',
      installs: '6.7k',
      featured: false,
    },
    {
      name: 'calendar',
      author: 'productivity',
      category: 'skills.categories.productivity',
      desc: 'skills.items.calendar.desc',
      icon: '📅',
      installs: '11.2k',
      featured: false,
    },
    {
      name: 'database-query',
      author: 'data',
      category: 'skills.categories.data',
      desc: 'skills.items.databaseQuery.desc',
      icon: '🗄️',
      installs: '13.6k',
      featured: false,
    },
  ]

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Sparkles className="h-6 w-6 text-primary" />
          {t('skills.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('skills.subtitle')}</p>
      </header>

      {/* 搜索 */}
      <div className="relative w-full sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder={t('skills.searchPlaceholder')}
          className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground/70 focus:border-border focus:outline-none focus:ring-2 focus:ring-ring/20 dark:bg-input/30"
        />
      </div>

      {/* 分类 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map((c, i) => (
          <button
            key={c}
            type="button"
            className={
              i === 0
                ? 'h-8 rounded-full border border-primary bg-primary px-3 text-xs font-medium text-primary-foreground'
                : 'h-8 rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'
            }
          >
            {t(c)}
          </button>
        ))}
      </div>

      {/* 精选 Skills */}
      <div>
        <h2 className="mb-3 text-base font-semibold">{t('skills.featuredTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills
            .filter((s) => s.featured)
            .map((s) => (
              <Card
                key={s.name}
                className="group transition-all hover:border-primary/40 hover:shadow-md"
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                    {s.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold">{s.name}</h3>
                      <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {t('skills.featured')}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">@{s.author}</p>
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{t(s.desc)}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground">
                        {t('skills.installs', { count: s.installs })}
                      </span>
                      <button
                        type="button"
                        className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        {t('skills.install')}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* 全部 Skills */}
      <div>
        <h2 className="mb-3 text-base font-semibold">{t('skills.allTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {skills.map((s) => (
            <Card
              key={s.name}
              className="group transition-all hover:border-primary/40 hover:shadow-md"
            >
              <CardContent className="flex flex-col items-start gap-2 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-lg">
                  {s.icon}
                </div>
                <h3 className="w-full truncate text-sm font-semibold">{s.name}</h3>
                <p className="text-[10px] text-muted-foreground">@{s.author}</p>
                <p className="line-clamp-2 text-[11px] text-muted-foreground">{t(s.desc)}</p>
                <div className="mt-auto flex w-full items-center justify-between pt-1">
                  <span className="text-[10px] text-muted-foreground">{s.installs}</span>
                  <button
                    type="button"
                    className="rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-primary hover:text-primary-foreground"
                  >
                    {t('skills.install')}
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
