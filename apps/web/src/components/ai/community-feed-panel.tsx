'use client'

import * as React from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { Search, Heart } from 'lucide-react'
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger, TabsContent } from '@ihui/ui'
import { Avatar } from '@/components/data/Avatar'
import { cn } from '@/lib/utils'

// 创作条目类型(导出供外部使用)
export interface CommunityItem {
  id: string
  title: string
  cover: string
  author: string
  avatar: string
  likes: number
  type: string
}

interface Creator {
  id: string
  name: string
  avatar: string
  followers: number
  isFollowing: boolean
}

// mock 数据(避免依赖后端)
const mockCreations: CommunityItem[] = [
  { id: '1', title: 'Midjourney 风景作品', cover: 'https://placehold.co/300x200/png', author: 'AI艺术家', avatar: '', likes: 1280, type: 'image' },
  { id: '2', title: 'Sora 视频创作', cover: 'https://placehold.co/300x200/png', author: '创作者小王', avatar: '', likes: 892, type: 'video' },
  { id: '3', title: 'Suno 音乐作品', cover: 'https://placehold.co/300x200/png', author: '音乐人小李', avatar: '', likes: 458, type: 'music' },
]

const mockCreators: Creator[] = [
  { id: 'c1', name: 'AI艺术家', avatar: '', followers: 12800, isFollowing: false },
  { id: 'c2', name: '创作者小王', avatar: '', followers: 8920, isFollowing: false },
  { id: 'c3', name: '音乐人小李', avatar: '', followers: 4580, isFollowing: true },
  { id: 'c4', name: '代码诗人', avatar: '', followers: 3210, isFollowing: false },
  { id: 'c5', name: '视觉工坊', avatar: '', followers: 2150, isFollowing: false },
]

const mockTags = ['AI绘画', 'Midjourney', 'Sora', 'Suno', 'Claude']

const filterTypes = ['all', 'image', 'video', 'audio', 'music', 'article', 'code'] as const
const sortOptions = ['latest', 'popular', 'trending'] as const

// 选中/未选中样式(无蓝色发光边框,subtle bg 变化)
const chipBase = 'rounded-md px-3 py-1 text-sm transition'
const chipActive = 'bg-primary text-primary-foreground'
const chipIdle = 'bg-muted text-muted-foreground hover:bg-accent'

export function CommunityFeedPanel() {
  const t = useTranslations('aiCommunity')
  const tCommon = useTranslations('common')
  const [searchKeyword, setSearchKeyword] = React.useState('')
  const [activeType, setActiveType] = React.useState<string>('all')
  const [activeSort, setActiveSort] = React.useState<string>('latest')
  const [creators, setCreators] = React.useState<Creator[]>(mockCreators)

  const handleSearch = () => {
    console.log('search:', searchKeyword)
    toast.success(`${tCommon('search')}: ${searchKeyword || '-'}`)
  }

  const handleFollow = (id: string) => {
    setCreators((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isFollowing: !c.isFollowing } : c)),
    )
    const target = creators.find((c) => c.id === id)
    toast.success(target?.isFollowing ? t('sidebar.unfollowSuccess') : t('sidebar.followSuccess'))
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Hero 区 */}
      <section className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t('heroTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('heroSubtitle')}</p>
        <div className="mt-4 flex gap-2">
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
      </section>

      {/* 主体:左主区 + 右侧栏 */}
      <div className="flex flex-col gap-6 md:flex-row">
        {/* 左主区 */}
        <div className="w-full md:w-2/3">
          <Tabs defaultValue="creations">
            <TabsList>
              <TabsTrigger value="creations">{t('tabs.creations')}</TabsTrigger>
              <TabsTrigger value="posts">{t('tabs.posts')}</TabsTrigger>
            </TabsList>

            {/* 创作广场 */}
            <TabsContent value="creations">
              {/* 过滤 + 排序 */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {filterTypes.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setActiveType(f)}
                    className={cn(chipBase, activeType === f ? chipActive : chipIdle)}
                  >
                    {t(`filters.${f}`)}
                  </button>
                ))}
                <div className="ml-auto flex gap-2">
                  {sortOptions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActiveSort(s)}
                      className={cn(chipBase, activeSort === s ? chipActive : chipIdle)}
                    >
                      {t(`sort.${s}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 创作列表 */}
              <div className="flex flex-col gap-3">
                {mockCreations.map((c) => (
                  <Card key={c.id} className="transition hover:bg-muted/50">
                    <div className="flex gap-3 p-4">
                      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-md bg-muted">
                        <Image src={c.cover} alt={c.title} fill className="object-cover" />
                      </div>
                      <div className="flex flex-1 flex-col gap-2">
                        <h3 className="font-medium">{c.title}</h3>
                        <div className="flex items-center gap-2">
                          <Avatar src={c.avatar} name={c.author} size="sm" />
                          <span className="text-sm text-muted-foreground">{c.author}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Heart className="h-4 w-4" />
                          <span>{c.likes}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* 社区动态(空态占位) */}
            <TabsContent value="posts">
              <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground">
                {t('empty.title')}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* 右侧栏 */}
        <aside className="w-full md:w-1/3">
          <div className="sticky top-20 flex flex-col gap-4">
            {/* 热门创作者 */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{t('sidebar.hotCreators')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 p-4 pt-2">
                {creators.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <Avatar src={c.avatar} name={c.name} size="sm" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.followers} {t('sidebar.followers')}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={c.isFollowing ? 'secondary' : 'default'}
                      onClick={() => handleFollow(c.id)}
                    >
                      <span>{c.isFollowing ? t('sidebar.following') : t('sidebar.follow')}</span>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* 热门标签 */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base">{t('sidebar.hotTags')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 p-4 pt-2">
                {mockTags.map((tag) => (
                  <span
                    key={tag}
                    className={cn(chipBase, chipIdle, 'cursor-pointer')}
                  >
                    #{tag}
                  </span>
                ))}
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default CommunityFeedPanel
