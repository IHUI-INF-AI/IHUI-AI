/**
 * AiSkillsPage — AI 技能市场(2026-07-25 立)。
 * 数据源:listAiSkills() → GET /api/ai-skills(19 个 skill 元数据)。
 * 列表项:图标 + 名称 + 描述 + 分类徽章 + 标签,点击 chrome.tabs.create 跳 web 详情。
 * 注:AiSkillMeta 未暴露调用次数/评分字段,改用 category 徽章 + tags 替代展示。
 */
import { useEffect, useMemo, useState } from 'react'
import { listAiSkills, type AiSkillMeta } from '@ihui/api-client'
import { Card, CardContent, CardHeader, CardTitle, Input } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const WEB_BASE = 'https://ihui.ai'

const CATEGORY_LABEL: Record<AiSkillMeta['category'], string> = {
  code: 'Code',
  media: 'Media',
  'ai-top': 'AI Top',
}

export default function AiSkillsPage() {
  const { t } = useI18n()
  const [skills, setSkills] = useState<AiSkillMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listAiSkills()
      if (res.success) setSkills(res.data)
      else setError(res.error || t('common.failed'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.failed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return skills
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(kw) ||
        (s.description || '').toLowerCase().includes(kw),
    )
  }, [skills, keyword])

  const openInWeb = (id: string) => {
    void chrome.tabs.create({ url: `${WEB_BASE}/ai-skills/${encodeURIComponent(id)}` })
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">
        {t('common.loading')}
      </div>
    )
  }
  if (error) {
    return (
      <div className="m-2 flex flex-col items-center gap-2">
        <div className="bg-destructive/10 text-destructive px-2.5 py-2 rounded-md border border-destructive text-xs text-center">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors"
        >
          {t('common.retry')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.aiSkills')}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{filtered.length}</span>
      </div>
      <Input
        type="search"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder={t('common.search')}
        className="text-sm h-9"
        aria-label={t('common.search')}
      />
      {filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s) => (
            <Card
              key={s.id}
              className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => openInWeb(s.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openInWeb(s.id)
                }
              }}
            >
              <CardHeader className="px-3 py-2 space-y-0">
                <div className="flex items-center gap-2">
                  <span className="text-base shrink-0" aria-hidden>
                    {s.icon || '⚡'}
                  </span>
                  <CardTitle className="text-sm leading-snug flex-1 min-w-0 truncate">
                    {s.name}
                  </CardTitle>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">
                    {CATEGORY_LABEL[s.category] || s.category}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="px-3 pb-2 -mt-1">
                <p className="m-0 text-xs text-muted-foreground line-clamp-2">
                  {s.description || '—'}
                </p>
                {s.tags.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {s.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
