'use client'

import * as React from 'react'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import {
  Map as MapIcon,
  Layers,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  BookOpen,
  Users,
  Sparkles,
  Info,
} from 'lucide-react'

import { fetchApi } from '@/lib/api'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@ihui/ui-react'
import { Alert } from '@/components/feedback'
import { BackButton } from '@/components/common'

// =============================================================================
// 类型定义(与 packages/database/src/schema 对齐,禁止 any)
// =============================================================================

/** 学习地图(learn_maps 表)。content 为 jsonb 地图节点/路径配置。 */
interface LearnMap {
  id: string
  title: string
  description?: string | null
  cover?: string | null
  content?: MapContent | null
  sort?: number
  isPublished?: boolean
  createdAt?: string
  updatedAt?: string
}

/** learn_maps.content 的结构:地图节点数组。 */
interface MapContentNode {
  id?: string
  title?: string
  description?: string
  status?: string
  progress?: number
}

interface MapContent {
  nodes?: MapContentNode[]
}

/** 学习地图列表响应:GET /api/learn/map */
interface LearnMapListData {
  list: LearnMap[]
  total: number
}

/** 学习专题(learn_topic 表)。 */
interface LearnTopic {
  id: string
  title: string
  image?: string | null
  description?: string | null
  status?: string
  slug?: string | null
  sort?: number
  isShowIndex?: boolean
  price?: string | null
  originalPrice?: string | null
  createdAt?: string
  updatedAt?: string
}

/** 专题列表响应:GET /api/learn/topics */
interface LearnTopicListData {
  list: LearnTopic[]
  total: number
  page: number
  pageSize: number
}

/** 专题详情响应:GET /api/learn/topics/:id */
interface LearnTopicDetailData {
  topic: LearnTopic
}

/** 学习地图详情响应:GET /api/learn/maps/:id(附关联专题 id 列表) */
interface LearnMapDetailData {
  map: LearnMap
  topics: string[]
}

/** 专题关联课程(lessons 表,经 learn_topic_lesson 关联)。 */
interface LessonItem {
  id: string
  title: string
  coverImage?: string | null
  intro?: string | null
  lecturerName?: string | null
  isFree?: boolean
  lessonCount?: number
  signupCount?: number
}

/** 专题课程列表响应:GET /api/learn/premium-topics/:id/lessons */
interface LearnTopicLessonsData {
  list: LessonItem[]
  total: number
}

const PAGE_SIZE = 12

async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 提取地图 content 中的节点列表(兼容缺省/空结构)。 */
function extractNodes(content?: MapContent | null): MapContentNode[] {
  if (!content) return []
  if (Array.isArray(content)) return content as MapContentNode[]
  return content.nodes ?? []
}

/** 封面图兜底:空字符串或缺失时返回 undefined,交给占位图标渲染。 */
function coverSrc(url?: string | null): string | undefined {
  return url && url.trim() ? url : undefined
}

export default function EduAiLearnMapPage() {
  const t = useTranslations('eduAi.map')

  const [keyword, setKeyword] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [selectedMapId, setSelectedMapId] = React.useState<string | null>(null)
  const [mapDetailOpen, setMapDetailOpen] = React.useState(false)
  const [selectedTopicId, setSelectedTopicId] = React.useState<string | null>(null)
  const [topicDetailOpen, setTopicDetailOpen] = React.useState(false)

  React.useEffect(() => {
    const tm = setTimeout(() => {
      setDebounced(keyword)
      setPage(1)
    }, 300)
    return () => clearTimeout(tm)
  }, [keyword])

  // 学习地图列表
  const mapQuery = useQuery({
    queryKey: ['edu-ai', 'learn-map', 'maps'],
    queryFn: () => api<LearnMapListData>('/api/learn/maps'),
  })

  // 专题列表(分页 + 搜索)
  const topicQuery = useQuery({
    queryKey: ['edu-ai', 'learn-map', 'topics', debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status: 'published',
      })
      if (debounced) qs.set('search', debounced)
      return api<LearnTopicListData>(`/api/learn/premium-topics?${qs.toString()}`)
    },
  })

  // 地图详情(含 content 节点)
  const mapDetailQuery = useQuery({
    queryKey: ['edu-ai', 'learn-map', 'map-detail', selectedMapId],
    queryFn: () => {
      if (selectedMapId === null) throw new Error('missing map id')
      return api<LearnMapDetailData>(`/api/learn/maps/${selectedMapId}`)
    },
    enabled: selectedMapId !== null,
  })

  // 专题详情
  const topicDetailQuery = useQuery({
    queryKey: ['edu-ai', 'learn-map', 'topic-detail', selectedTopicId],
    queryFn: () => {
      if (selectedTopicId === null) throw new Error('missing topic id')
      return api<LearnTopicDetailData>(`/api/learn/premium-topics/${selectedTopicId}`)
    },
    enabled: selectedTopicId !== null,
  })

  // 专题关联课程
  const topicLessonsQuery = useQuery({
    queryKey: ['edu-ai', 'learn-map', 'topic-lessons', selectedTopicId],
    queryFn: () => {
      if (selectedTopicId === null) throw new Error('missing topic id')
      return api<LearnTopicLessonsData>(`/api/learn/premium-topics/${selectedTopicId}/lessons`)
    },
    enabled: selectedTopicId !== null && topicDetailOpen,
  })

  const maps = mapQuery.data?.list ?? []
  const topicTotal = topicQuery.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(topicTotal / PAGE_SIZE))
  const topics = topicQuery.data?.list ?? []
  const mapDetail = mapDetailQuery.data?.map
  const mapDetailTopicIds = mapDetailQuery.data?.topics ?? []
  const topicDetail = topicDetailQuery.data?.topic
  const topicLessons = topicLessonsQuery.data?.list ?? []

  const openMapDetail = (id: string) => {
    setSelectedMapId(id)
    setMapDetailOpen(true)
  }

  const openTopicDetail = (id: string) => {
    setSelectedTopicId(id)
    setTopicDetailOpen(true)
  }

  return (
    <div className="space-y-6 px-4 py-6">
      <BackButton fallbackHref="/edu" />

      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MapIcon className="h-7 w-7 text-primary" />
          {t('title')}
        </h1>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </header>

      {/* 学习地图区 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MapIcon className="h-5 w-5 text-primary" />
          {t('maps')}
        </h2>

        {mapQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : mapQuery.error ? (
          <Alert variant="danger" description={(mapQuery.error as Error).message} />
        ) : maps.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
            <MapIcon className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {maps.map((map) => {
              const cover = coverSrc(map.cover)
              const nodeCount = extractNodes(map.content).length
              return (
                <Card
                  key={map.id}
                  className="flex cursor-pointer flex-col overflow-hidden transition-colors hover:bg-accent"
                  onClick={() => openMapDetail(map.id)}
                >
                  <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                    {cover ? (
                      <Image
                        fill
                        src={cover}
                        alt={map.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <MapIcon className="h-10 w-10 text-primary/40" />
                    )}
                  </div>
                  <CardContent className="flex min-w-0 flex-1 flex-col gap-2 p-4">
                    <div className="min-w-0">
                      <p className="line-clamp-1 font-medium">{map.title}</p>
                      {map.description && (
                        <p className="line-clamp-2 mt-1 text-sm text-muted-foreground">
                          {map.description}
                        </p>
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      {nodeCount > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <BookOpen className="h-3.5 w-3.5" />
                          {nodeCount}
                        </span>
                      )}
                      <span className="ml-auto flex items-center gap-1 text-xs text-primary">
                        {t('viewDetail')}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* 专题课程区 */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="h-5 w-5 text-primary" />
          {t('topics')}
        </h2>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('search')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>

        {topicQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t('loading')}
          </div>
        ) : topicQuery.error ? (
          <Alert variant="danger" description={(topicQuery.error as Error).message} />
        ) : topics.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-8">
            <Layers className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
            {topics.map((topic) => (
              <Card
                key={topic.id}
                className="flex cursor-pointer flex-col overflow-hidden transition-colors hover:bg-accent"
                onClick={() => openTopicDetail(topic.id)}
              >
                <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                  {coverSrc(topic.image) ? (
                    <Image
                      fill
                      src={coverSrc(topic.image)!}
                      alt={topic.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Layers className="h-10 w-10 text-primary/40" />
                  )}
                  {topic.price && Number(topic.price) > 0 && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 shadow-sm backdrop-blur-sm dark:text-amber-300">
                      <Sparkles className="h-3 w-3" />
                      ¥{topic.price}
                    </span>
                  )}
                </div>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{topic.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 p-4 pt-0 text-xs text-muted-foreground">
                  {topic.description && <p className="line-clamp-2 break-words">{topic.description}</p>}
                  <span className="flex items-center gap-1 text-primary">
                    {t('viewDetail')}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {topicTotal > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('page', { page, total: totalPages })}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* 学习地图详情 Dialog */}
      <Dialog open={mapDetailOpen} onOpenChange={setMapDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <MapIcon className="h-5 w-5 shrink-0 text-primary" />
              {mapDetail?.title}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-2">
              {mapDetail ? (
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  {t('topics')}: {mapDetailTopicIds.length}
                </span>
              ) : (
                t('loading')
              )}
            </DialogDescription>
          </DialogHeader>

          {mapDetailQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : mapDetailQuery.isError ? (
            <Alert variant="danger" description={(mapDetailQuery.error as Error).message} />
          ) : mapDetail ? (
            <div className="space-y-4 text-sm">
              {coverSrc(mapDetail.cover) && (
                <div className="relative h-44 overflow-hidden rounded-lg">
                  <Image
                    fill
                    src={coverSrc(mapDetail.cover)!}
                    alt={mapDetail.title}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              {mapDetail.description && (
                <p className="whitespace-pre-line text-muted-foreground">{mapDetail.description}</p>
              )}

              {extractNodes(mapDetail.content).length > 0 && (
                <div>
                  <h3 className="mb-2 flex items-center gap-1.5 font-medium">
                    <BookOpen className="h-4 w-4 text-primary/70" />
                    {t('maps')}
                  </h3>
                  <ol className="space-y-2">
                    {extractNodes(mapDetail.content).map((node, idx) => (
                      <li key={node.id ?? `${idx}-${node.title ?? ''}`} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-medium text-primary">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          {node.title && <p className="font-medium">{node.title}</p>}
                          {node.description && (
                            <p className="text-xs text-muted-foreground">{node.description}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* 专题详情 Dialog */}
      <Dialog open={topicDetailOpen} onOpenChange={setTopicDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
              {topicDetail?.title ?? t('loading')}
            </DialogTitle>
            <DialogDescription>
              {topicDetail ? (
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" />
                  {t('topics')}
                </span>
              ) : (
                t('loading')
              )}
            </DialogDescription>
          </DialogHeader>

          {topicDetailQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loading')}
            </div>
          ) : topicDetailQuery.isError ? (
            <Alert variant="danger" description={(topicDetailQuery.error as Error).message} />
          ) : topicDetail ? (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {t('topics')}
                </span>
                {topicDetail.price && Number(topicDetail.price) > 0 ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    ¥{topicDetail.price}
                  </span>
                ) : null}
              </div>

              {topicDetail.description && (
                <p className="whitespace-pre-line text-muted-foreground">{topicDetail.description}</p>
              )}

              {/* 关联课程 */}
              <div>
                <h3 className="mb-2 flex items-center gap-1.5 font-medium">
                  <BookOpen className="h-4 w-4 text-primary/70" />
                  {t('relatedCourses')}
                </h3>

                {topicLessonsQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('loading')}
                  </div>
                ) : topicLessonsQuery.isError ? (
                  <Alert variant="danger" description={(topicLessonsQuery.error as Error).message} />
                ) : topicLessons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-6">
                    <Info className="h-6 w-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{t('noCourses')}</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {topicLessons.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10">
                          {coverSrc(lesson.coverImage) ? (
                            <Image
                              fill
                              src={coverSrc(lesson.coverImage)!}
                              alt={lesson.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <BookOpen className="h-4 w-4 text-primary/50" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-medium">{lesson.title}</p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            {lesson.lecturerName && <span className="line-clamp-1">{lesson.lecturerName}</span>}
                            {typeof lesson.lessonCount === 'number' && lesson.lessonCount > 0 && (
                              <span className="flex items-center gap-0.5">
                                <BookOpen className="h-3 w-3" />
                                {lesson.lessonCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
