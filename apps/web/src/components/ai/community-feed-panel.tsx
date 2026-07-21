'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Search, Plus, Heart, Loader2 } from 'lucide-react'
import { Button, Input, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { Badge } from '@/components/data/Badge'
import { cn } from '@/lib/utils'
import { CommunityStats } from './community-stats'
import { CommunityPostsList } from './community-posts-list'
import { CommunityPublishDialog } from './community-publish-dialog'
import { CommunityDetailDialog } from './community-detail-dialog'
import { CommentDialog } from './comment-dialog'
import { AiToolsSidebar } from './ai-tools-sidebar'

// ==================== 共享类型(子组件 import) ====================
export interface CommunityItem { id: string; title: string; cover: string; author: string; avatar: string; likes: number; type: string; model: string; prompt: string; createdAt: string }
export interface CommunityPost { id: string; userId: string; userName: string; userAvatar: string; content: string; createdAt: string; likes: number; comments: number }
export interface HotCreator { id: string; name: string; avatar: string; followers: number; isFollowing: boolean }
export interface AiTool { id: string; nameKey: string; icon: string; href: string }

// ==================== mock 数据 ====================
const MOCK_CREATIONS: CommunityItem[] = [
  { id: '1', title: 'Midjourney 风景作品', cover: 'https://placehold.co/300x200/png', author: 'AI艺术家', avatar: '', likes: 1280, type: 'image', model: 'Midjourney v6', prompt: 'cyberpunk city, neon lights, ultra detailed', createdAt: '2026-07-15T10:00:00Z' },
  { id: '2', title: 'Sora 视频创作', cover: 'https://placehold.co/300x200/png', author: '创作者小王', avatar: '', likes: 892, type: 'video', model: 'Sora', prompt: 'a cat playing piano in space', createdAt: '2026-07-14T15:30:00Z' },
  { id: '3', title: 'Suno 音乐作品', cover: 'https://placehold.co/300x200/png', author: '音乐人小李', avatar: '', likes: 458, type: 'music', model: 'Suno v3.5', prompt: 'lofi hip hop, rainy night, chill beats', createdAt: '2026-07-13T08:00:00Z' },
  { id: '4', title: 'Claude 诗歌创作', cover: 'https://placehold.co/300x200/png', author: '诗人小张', avatar: '', likes: 326, type: 'article', model: 'Claude 3.5', prompt: '写一首关于秋天的现代诗', createdAt: '2026-07-12T20:00:00Z' },
  { id: '5', title: 'GPT 代码生成', cover: 'https://placehold.co/300x200/png', author: '代码诗人', avatar: '', likes: 215, type: 'code', model: 'GPT-4o', prompt: 'react component with tailwind', createdAt: '2026-07-11T12:00:00Z' },
  { id: '6', title: 'DALL-E 插画作品', cover: 'https://placehold.co/300x200/png', author: '视觉工坊', avatar: '', likes: 154, type: 'image', model: 'DALL-E 3', prompt: 'watercolor portrait, dreamy atmosphere', createdAt: '2026-07-10T09:30:00Z' },
]

const MOCK_POSTS: CommunityPost[] = [
  { id: 'p1', userId: 'u1', userName: 'AI艺术家', userAvatar: '', content: '今天用 Midjourney 创作了一组赛博朋克城市风景,分享给大家!', createdAt: '2026-07-21T09:00:00Z', likes: 42, comments: 8 },
  { id: 'p2', userId: 'u2', userName: '创作者小王', userAvatar: '', content: 'Sora 的视频生成质量越来越高了,期待后续版本更新。', createdAt: '2026-07-20T14:30:00Z', likes: 28, comments: 5 },
  { id: 'p3', userId: 'u3', userName: '音乐人小李', userAvatar: '', content: 'Suno v3.5 的音乐生成真的太赞了,推荐大家试试。', createdAt: '2026-07-19T18:00:00Z', likes: 35, comments: 12 },
  { id: 'p4', userId: 'u4', userName: '诗人小张', userAvatar: '', content: 'Claude 写的诗越来越有韵味了,AI 创作的未来可期。', createdAt: '2026-07-18T11:00:00Z', likes: 19, comments: 3 },
  { id: 'p5', userId: 'u5', userName: '代码诗人', userAvatar: '', content: 'GPT-4o 生成的代码质量非常稳定,工作效率提升明显。', createdAt: '2026-07-17T16:00:00Z', likes: 24, comments: 7 },
]

const MOCK_CREATORS: HotCreator[] = [
  { id: 'c1', name: 'AI艺术家', avatar: '', followers: 12800, isFollowing: false },
  { id: 'c2', name: '创作者小王', avatar: '', followers: 8920, isFollowing: false },
  { id: 'c3', name: '音乐人小李', avatar: '', followers: 4580, isFollowing: true },
  { id: 'c4', name: '代码诗人', avatar: '', followers: 3210, isFollowing: false },
  { id: 'c5', name: '视觉工坊', avatar: '', followers: 2150, isFollowing: false },
]

const MOCK_TAGS = ['AI绘画', 'Midjourney', 'Sora', 'Suno', 'Claude', 'GPT-4', 'DALL-E', 'Stable Diffusion']

const MOCK_TOOLS: AiTool[] = [
  { id: 't1', nameKey: 'Midjourney', icon: 'imageGeneration', href: 'https://midjourney.com' },
  { id: 't2', nameKey: 'Suno', icon: 'musicCreation', href: 'https://suno.com' },
  { id: 't3', nameKey: 'Sora', icon: 'videoGeneration', href: 'https://openai.com/sora' },
  { id: 't4', nameKey: 'Claude', icon: 'writingAssistant', href: 'https://claude.ai' },
]

const FILTER_TYPES = ['all', 'image', 'video', 'audio', 'music', 'article', 'code'] as const
const SORT_OPTIONS = ['latest', 'popular', 'trending'] as const
const CHIP_BASE = 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors'
const CHIP_ACTIVE = 'bg-primary text-primary-foreground'
const CHIP_IDLE = 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
const TYPE_BADGE_VARIANT: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  image: 'primary', video: 'success', audio: 'warning', music: 'warning', article: 'default', code: 'default',
}

/**
 * CommunityFeedPanel - AI 创作社区主面板(1:1 复刻 Vue AICommunity.vue)
 * Hero + stats + Tab(创作广场/社区动态) + 右侧栏(创作者/标签/AI 工具)
 */
export function CommunityFeedPanel() {
  const t = useTranslations('aiCommunity')
  const tCommon = useTranslations('common')

  const [searchKeyword, setSearchKeyword] = React.useState('')
  const [activeType, setActiveType] = React.useState<string>('all')
  const [activeSort, setActiveSort] = React.useState<string>('latest')
  const [creations, setCreations] = React.useState<CommunityItem[]>(MOCK_CREATIONS)
  const [loading, setLoading] = React.useState(false)
  const [hasMore] = React.useState(false)
  const [showPublish, setShowPublish] = React.useState(false)
  const [showDetail, setShowDetail] = React.useState(false)
  const [selectedCreation, setSelectedCreation] = React.useState<CommunityItem | null>(null)
  const [showComment, setShowComment] = React.useState(false)
  const [selectedPost, setSelectedPost] = React.useState<CommunityPost | null>(null)

  const filteredCreations = React.useMemo(() => {
    let list = activeType === 'all' ? creations : creations.filter((c) => c.type === activeType)
    if (activeSort === 'popular') list = [...list].sort((a, b) => b.likes - a.likes)
    else if (activeSort === 'trending') list = [...list].sort((a, b) => b.likes * 1.5 - a.likes)
    return list
  }, [creations, activeType, activeSort])

  const handleSearch = () => {
    setLoading(true)
    setTimeout(() => {
      const filtered = MOCK_CREATIONS.filter((c) =>
        searchKeyword ? c.title.includes(searchKeyword) || c.author.includes(searchKeyword) : true,
      )
      setCreations(filtered)
      setLoading(false)
      toast.success(`${tCommon('search')}: ${searchKeyword || '-'}`)
    }, 300)
  }

  const handleCreationClick = (c: CommunityItem) => {
    setSelectedCreation(c)
    setShowDetail(true)
  }

  const handleCommentCreation = (c: CommunityItem) => {
    setShowDetail(false)
    setSelectedPost({
      id: c.id, userId: 'unknown', userName: c.author, userAvatar: c.avatar,
      content: c.title, createdAt: c.createdAt, likes: c.likes, comments: 0,
    })
    setShowComment(true)
  }

  const handleCommentPost = (post: CommunityPost) => {
    setSelectedPost(post)
    setShowComment(true)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Hero 区:徽章 + 标题 + 副标题 + 搜索 + 统计 */}
      <section className="mb-6 flex flex-col items-center gap-3 text-center">
        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-primary/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <span className="h-1.5 w-1.5 rounded-md bg-primary" />
          <span>AI Community</span>
          <span className="h-1.5 w-1.5 rounded-md bg-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t('heroTitle')}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{t('heroSubtitle')}</p>
        <div className="flex w-full max-w-md gap-2">
          <Input
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            placeholder={t('searchPlaceholder')}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch}>
            <Search />
            <span>{tCommon('search')}</span>
          </Button>
        </div>
        <CommunityStats />
      </section>

      {/* 主体:左主区 + 右侧栏 */}
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="w-full md:w-2/3">
          <Tabs defaultValue="creations">
            <TabsList className="mb-4">
              <TabsTrigger value="creations">{t('tabs.creations')}</TabsTrigger>
              <TabsTrigger value="posts">{t('tabs.posts')}</TabsTrigger>
            </TabsList>

            {/* 创作广场 Tab */}
            <TabsContent value="creations">
              {/* 过滤 + 排序 + 发布按钮 */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_TYPES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setActiveType(f)}
                      className={cn(CHIP_BASE, activeType === f ? CHIP_ACTIVE : CHIP_IDLE)}
                    >
                      <span>{t(`filters.${f}`)}</span>
                    </button>
                  ))}
                </div>
                <div className="ml-auto flex gap-1.5">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActiveSort(s)}
                      className={cn(CHIP_BASE, activeSort === s ? CHIP_ACTIVE : CHIP_IDLE)}
                    >
                      <span>{t(`sort.${s}`)}</span>
                    </button>
                  ))}
                  <Button size="sm" onClick={() => setShowPublish(true)}>
                    <Plus />
                    <span>{t('actions.publish')}</span>
                  </Button>
                </div>
              </div>

              {/* 加载中 */}
              {loading && (
                <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card p-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{t('loading')}</span>
                </div>
              )}

              {/* 空态 */}
              {!loading && filteredCreations.length === 0 && (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
                  <p className="text-sm text-muted-foreground">{t('empty.title')}</p>
                  <Button size="sm" onClick={() => setShowPublish(true)}>
                    <Plus />
                    <span>{t('actions.publish')}</span>
                  </Button>
                </div>
              )}

              {/* 创作卡片网格 */}
              {!loading && filteredCreations.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filteredCreations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCreationClick(c)}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
                        <Image src={c.cover} alt={c.title} fill className="object-cover" />
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-1 flex-1 text-sm font-medium">{c.title}</h3>
                        <Badge variant={TYPE_BADGE_VARIANT[c.type] ?? 'default'}>
                          <span>{t(`filters.${c.type}`)}</span>
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar src={c.avatar} name={c.author} size="xs" />
                          <span className="text-xs text-muted-foreground">{c.author}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Heart className="h-3 w-3" />
                          <span>{c.likes}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* 加载更多 / 没有更多 */}
              {!loading && filteredCreations.length > 0 && (
                <div className="mt-6 flex justify-center">
                  {hasMore ? (
                    <Button variant="outline" size="sm" onClick={() => toast.info(t('loadMore'))}>
                      <span>{t('loadMore')}</span>
                    </Button>
                  ) : (
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{t('noMore')}</span>
                  )}
                </div>
              )}
            </TabsContent>

            {/* 社区动态 Tab */}
            <TabsContent value="posts">
              <CommunityPostsList posts={MOCK_POSTS} onComment={handleCommentPost} />
            </TabsContent>
          </Tabs>
        </div>

        {/* 右侧栏:sticky */}
        <aside className="w-full md:w-1/3">
          <div className="sticky top-20">
            <AiToolsSidebar creators={MOCK_CREATORS} tags={MOCK_TAGS} tools={MOCK_TOOLS} />
          </div>
        </aside>
      </div>

      {/* 弹窗:发布 / 详情 / 评论 */}
      <CommunityPublishDialog open={showPublish} onOpenChange={setShowPublish} />
      <CommunityDetailDialog
        open={showDetail}
        onOpenChange={setShowDetail}
        creation={selectedCreation}
        onComment={handleCommentCreation}
      />
      <CommentDialog
        open={showComment}
        onOpenChange={setShowComment}
        post={selectedPost}
        onSubmitSuccess={(p) => setSelectedPost(p)}
      />
    </div>
  )
}

export default CommunityFeedPanel
