'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui'
import { Textarea } from '@/components/form/Textarea'
import { CommentItem } from '@/components/business'
import { fetchApi } from '@/lib/api'

interface Comment {
  id: string
  name: string
  avatar?: string
  content: string
  time: string
  likes: number
  liked?: boolean
}

interface ApiComment {
  id: string
  content: string
  createdAt?: string
  likeCount?: number
  likedByMe?: boolean
  authorName?: string | null
  nickname?: string | null
  avatar?: string | null
}

interface CommentListResp {
  list?: ApiComment[]
}

interface CreatedCommentResp {
  comment?: ApiComment
}

interface NewsCommentsProps {
  articleId: string
  className?: string
}

const dateFmt = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function mapComment(c: ApiComment, anonymous: string): Comment {
  return {
    id: c.id,
    name: c.authorName ?? c.nickname ?? anonymous,
    avatar: c.avatar ?? undefined,
    content: c.content,
    time: c.createdAt ? dateFmt.format(new Date(c.createdAt)) : '',
    likes: c.likeCount ?? 0,
    liked: c.likedByMe,
  }
}

export function NewsComments({ articleId, className }: NewsCommentsProps) {
  const t = useTranslations('news.comments')
  const tCommon = useTranslations('common')
  const [comments, setComments] = React.useState<Comment[]>([])
  const [content, setContent] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchApi<CommentListResp>(
      `/api/comments?topicType=news&topicId=${encodeURIComponent(articleId)}`,
    )
      .then((r) => {
        if (cancelled) return
        if (r.success && r.data && Array.isArray(r.data.list)) {
          setComments(r.data.list.map((c) => mapComment(c, t('anonymous'))))
        } else {
          setComments([])
        }
      })
      .catch(() => {
        if (!cancelled) setComments([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [articleId, t])

  const handleSubmit = async () => {
    if (!content.trim()) return
    setSubmitting(true)
    setError(null)
    const r = await fetchApi<CreatedCommentResp>('/api/comments', {
      method: 'POST',
      body: JSON.stringify({ topicType: 'news', topicId: articleId, content: content.trim() }),
    })
    setSubmitting(false)
    const created = r.success ? r.data?.comment : undefined
    if (created) {
      setComments((prev) => [mapComment(created, t('anonymous')), ...prev])
      setContent('')
      return
    }
    setError(t('submitError'))
  }

  return (
    <Card className={className}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-base">
          <MessageSquare className="h-4 w-4" />
          {t('title')}
          <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex gap-3">
          <Textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              if (error) setError(null)
            }}
            placeholder={t('placeholder')}
            maxLength={500}
            showCounter
            autoResize
            className="min-h-[80px]"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSubmit} disabled={!content.trim() || submitting}>
            <Send className="h-3.5 w-3.5" />
            {t('submit')}
          </Button>
        </div>

        <div className="space-y-5 pt-2">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {tCommon('loading')}
            </div>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>
          ) : (
            comments.map((c) => (
              <CommentItem
                key={c.id}
                name={c.name}
                avatar={c.avatar}
                content={c.content}
                time={c.time}
                likes={c.likes}
                liked={c.liked}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
