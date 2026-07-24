/**
 * AnnouncementsPage — 内容中心 / 公告列表(2026-07-25 立)。
 *
 * 数据源:getAnnouncements() → GET /api/announcements(分页 PageData<Announcement>)。
 * 列表项:标题 + 时间 + 内容摘要,点击展开/收起正文;"在网页版打开"按钮跳 web。
 */
import { useEffect, useState } from 'react'
import { getAnnouncements, type Announcement } from '@ihui/api-client'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const WEB_BASE = 'https://ihui.ai'

function fmtDate(s: string | null | undefined): string {
  if (!s) return ''
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(s))
  } catch {
    return ''
  }
}

function stripHtml(s: string | undefined | null): string {
  if (!s) return ''
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

const PINNED_LABEL: Record<string, string> = {
  'zh-CN': '置顶',
  'zh-TW': '置頂',
  en: 'Pinned',
  ja: 'ピン留め',
  ko: '고정',
}

export default function AnnouncementsPage() {
  const { t, locale } = useI18n()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await getAnnouncements({ page: 1, pageSize: 20 })
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

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }))
  const openInWeb = (id: string) => {
    void chrome.tabs.create({ url: `${WEB_BASE}/announcements/${encodeURIComponent(id)}` })
  }

  if (loading) {
    return (
      <div className="text-center text-muted-foreground py-8 px-4 text-sm">{t('common.loading')}</div>
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
        <h3 className="m-0 text-sm font-semibold">{t('apps.announcements')}</h3>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8 px-4 text-sm">
          {t('common.empty')}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((a) => {
            const isOpen = !!expanded[a.id]
            const preview = stripHtml(a.content).slice(0, 80)
            return (
              <Card key={a.id} className="rounded-md border-border shadow-none">
                <CardHeader
                  className="px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggle(a.id)}
                >
                  <div className="flex items-center gap-1.5">
                    {a.isPinned ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {PINNED_LABEL[locale] || 'Pinned'}
                      </Badge>
                    ) : null}
                    <CardTitle className="text-sm leading-snug line-clamp-2 flex-1">{a.title}</CardTitle>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                    <span>{a.category || '—'}</span>
                    <span className="whitespace-nowrap">{fmtDate(a.publishTime || a.createdAt)}</span>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-2 -mt-1">
                  {isOpen ? (
                    <div className="text-xs text-foreground whitespace-pre-wrap break-words">
                      {stripHtml(a.content) || t('common.empty')}
                    </div>
                  ) : (
                    <p className="m-0 text-xs text-muted-foreground line-clamp-2">
                      {preview || t('common.empty')}
                    </p>
                  )}
                  <div className="mt-1.5 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => openInWeb(a.id)}
                      className="text-[11px] text-primary cursor-pointer hover:underline bg-transparent border-none p-0"
                    >
                      {t('apps.openInWeb')} ↗
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
