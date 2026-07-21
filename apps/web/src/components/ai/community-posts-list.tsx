'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Clock, Heart, MessageCircle, Share2, Bookmark } from 'lucide-react'
import { Button } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { cn } from '@/lib/utils'
import type { CommunityPost } from './community-feed-panel'

interface CommunityPostsListProps {
  posts: CommunityPost[]
  onComment: (post: CommunityPost) => void
}

type TranslationFn = ReturnType<typeof useTranslations>

// 相对时间格式化:刚刚 / X 分钟前 / X 小时前 / X 天前
function formatRelativeTime(time: string, t: TranslationFn): string {
  const date = new Date(time)
  if (isNaN(date.getTime())) return '-'
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return t('justNow')
  if (minutes < 60) return t('minutesAgo', { minutes })
  if (hours < 24) return t('hoursAgo', { hours })
  if (days < 7) return t('daysAgo', { days })
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
}

/**
 * CommunityPostsList - 社区动态 Tab 内容
 * 顶部发布动态入口 + 动态列表(头像/用户名/时间/内容/点赞数/评论数)
 * 点赞 / 收藏 / 评论 / 分享 4 个 action 按钮
 */
export function CommunityPostsList({ posts, onComment }: CommunityPostsListProps) {
  const tc = useTranslations('community')
  const [publishContent, setPublishContent] = React.useState('')
  const [postList, setPostList] = React.useState<CommunityPost[]>(posts)
  const [likedIds, setLikedIds] = React.useState<Set<string>>(new Set())
  const [favoritedIds, setFavoritedIds] = React.useState<Set<string>>(new Set())

  React.useEffect(() => {
    setPostList(posts)
  }, [posts])

  const handlePublish = () => {
    if (!publishContent.trim()) {
      toast.error(tc('contentRequired'))
      return
    }
    // mock:前置插入一条新动态
    const newPost: CommunityPost = {
      id: `p-${Date.now()}`,
      userId: 'me',
      userName: '我',
      userAvatar: '',
      content: publishContent.trim(),
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
    }
    setPostList((prev) => [newPost, ...prev])
    setPublishContent('')
    toast.success(tc('publishSuccess'))
  }

  const toggleLike = (id: string) => {
    setPostList((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              likes: likedIds.has(id) ? Math.max(0, p.likes - 1) : p.likes + 1,
            }
          : p,
      ),
    )
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleFavorite = (id: string) => {
    setFavoritedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        toast.success(tc('unfavoriteSuccess'))
      } else {
        next.add(id)
        toast.success(tc('favoriteSuccess'))
      }
      return next
    })
  }

  const handleShare = (post: CommunityPost) => {
    const url = `${window.location.origin}/community/posts/${post.id}`
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success(tc('linkCopied')))
      .catch(() => toast.error(tc('copyFailed')))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 发布动态入口 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Avatar name="我" size="md" />
          <input
            value={publishContent}
            onChange={(e) => setPublishContent(e.target.value)}
            placeholder={tc('postContent')}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button size="sm" onClick={handlePublish}>
            <span>{tc('publishPost')}</span>
          </Button>
        </div>
      </div>

      {/* 动态列表 / 空态 */}
      {postList.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {tc('noPosts')}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {postList.map((post) => {
            const liked = likedIds.has(post.id)
            const favorited = favoritedIds.has(post.id)
            return (
              <div key={post.id} className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50">
                {/* 头部:头像 + 用户名 + 时间 */}
                <div className="mb-3 flex items-center gap-3">
                  <Avatar src={post.userAvatar} name={post.userName} size="md" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{post.userName}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatRelativeTime(post.createdAt, tc)}</span>
                    </div>
                  </div>
                </div>

                {/* 内容 */}
                <p className="mb-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{post.content}</p>

                {/* action 按钮组 */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toggleLike(post.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      liked ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Heart className={cn('h-3.5 w-3.5', liked && 'fill-current')} />
                    <span>{post.likes}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onComment(post)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>{post.comments}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(post.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      favorited ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Bookmark className={cn('h-3.5 w-3.5', favorited && 'fill-current')} />
                    <span>{tc('favorite')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleShare(post)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>分享</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
