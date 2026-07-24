/**
 * ChatTemplatesPage — 对话模板网格(2026-07-25 立)。
 *
 * 数据源:GET /api/chat/templates(分页 PageData<ChatTemplate>)。
 * 网格项:模板名 + 描述 + 图标 + 使用次数,点击 chrome.tabs.create 跳 web 使用模板。
 */
import { useEffect, useState } from 'react'
import { fetchApi, type PageData } from '@ihui/api-client'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const WEB_BASE = 'https://ihui.ai'

interface ChatTemplate {
  id: string
  name: string
  description?: string | null
  icon?: string | null
  useCount?: number
}

export default function ChatTemplatesPage() {
  const { t } = useI18n()
  const [items, setItems] = useState<ChatTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<PageData<ChatTemplate>>('/api/chat/templates', {
        params: { page: 1, pageSize: 30 },
      })
      if (res.success) setItems(res.data.list)
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

  const openInWeb = (id: string) => {
    void chrome.tabs.create({ url: `${WEB_BASE}/chat/templates/${encodeURIComponent(id)}` })
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
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((tpl) => (
            <Card
              key={tpl.id}
              className="rounded-md border-border shadow-none cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => openInWeb(tpl.id)}
            >
              <CardContent className="p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-base shrink-0" aria-hidden>
                    {tpl.icon || '📋'}
                  </span>
                  <div className="font-medium text-xs truncate flex-1 min-w-0">{tpl.name}</div>
                </div>
                {tpl.description ? (
                  <p className="m-0 mt-1 text-[11px] text-muted-foreground line-clamp-2">
                    {tpl.description}
                  </p>
                ) : null}
                {typeof tpl.useCount === 'number' ? (
                  <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                    {tpl.useCount} 次
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
