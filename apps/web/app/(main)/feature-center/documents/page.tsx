'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2,
  Search,
  FileText,
  Eye,
  FileType2,
  Clock,
  Copy,
  Check,
  List,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { fetchApi } from '@/lib/api'
import { Card, CardContent, Input, Button } from '@ihui/ui'
import { FeatureCenterHeader, FeatureCenterNav } from '@/components/feature-center'

interface DocItem {
  id: string
  title: string
  description: string
  excerpt: string
  category: string
  format: 'markdown' | 'pdf' | 'html'
  url: string
  updatedAt: string
}

async function fetchDocs(): Promise<DocItem[]> {
  const res = await fetchApi<DocItem[]>('/api/feature-center/documents')
  if (!res.success) throw new Error(res.error)
  return res.data
}

// 分类英文 key → 中文显示映射(与后端 deriveCategory() 输出对齐)
const CATEGORY_LABELS: Record<string, string> = {
  api: 'API 参考',
  sdk: 'SDK',
  integration: '集成',
  'incentive-program': '激励计划',
  development: '开发',
  'getting-started': '入门',
  'user-feature': '功能',
  user: '用户',
  guide: '指南',
  enterprise: '企业服务',
  faq: 'FAQ',
  'best-practice': '最佳实践',
  changelog: '更新日志',
}

// format → 显示标签
const FORMAT_LABELS: Record<string, string> = {
  markdown: 'Markdown',
  pdf: 'PDF',
  html: 'HTML',
}

// TOC 标题项
interface TocItem {
  level: number
  text: string
  id: string
}

// 标题文本 → HTML id(slug)
function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'heading'
  )
}

// 从 markdown 提取 TOC 标题(仅 ## 和 ###,避免 # 一级标题过多)
function extractToc(content: string): TocItem[] {
  const lines = content.split('\n')
  const items: TocItem[] = []
  let inCodeBlock = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue
    const m = line.match(/^(#{2,3})\s+(.+?)\s*$/)
    if (!m || !m[1] || !m[2]) continue
    const level = m[1].length
    const text = m[2].replace(/[*`_~]/g, '').trim()
    if (!text) continue
    items.push({ level, text, id: slugifyHeading(text) })
  }
  return items
}

// 把 ReactNode 拍平为纯文本(用于代码块复制按钮)
function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (React.isValidElement(node)) {
    return extractText((node.props as { children?: React.ReactNode }).children)
  }
  return ''
}

// 代码块:语言徽章 + 一键复制按钮(重写 pre 组件,inline code 不受影响)
function CodeBlock({ children, ...props }: React.ComponentProps<'pre'>) {
  const [copied, setCopied] = React.useState(false)
  const childArr = React.Children.toArray(children)
  const codeEl = childArr.find(
    (c): c is React.ReactElement<{ className?: string; children?: React.ReactNode }> =>
      React.isValidElement(c) && c.type === 'code',
  )
  if (!codeEl) return <pre {...props}>{children}</pre>
  const className = codeEl.props.className ?? ''
  const match = /language-([\w-]+)/.exec(className)
  const lang = match?.[1] ?? ''
  const rawText = extractText(codeEl.props.children)

  function handleCopy() {
    if (!rawText) return
    navigator.clipboard
      .writeText(rawText)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        // 忽略复制失败(无 clipboard 权限或非 https)
      })
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-md bg-muted/60">
      <div className="flex items-center justify-between bg-muted px-3 py-1">
        <span className="font-mono text-xs text-muted-foreground">{lang || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label="复制代码"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-relaxed" {...props}>
        <code className={className}>{codeEl.props.children}</code>
      </pre>
    </div>
  )
}

export default function DocumentsPage() {
  const t = useTranslations('featureCenter.documents')
  const { data, isLoading } = useQuery({
    queryKey: ['feature-center-docs'],
    queryFn: fetchDocs,
  })
  const [keyword, setKeyword] = React.useState('')
  const [category, setCategory] = React.useState('全部')
  const [previewId, setPreviewId] = React.useState<string | null>(null)
  // 用户通过点击 markdown 内部 .md 链接跳转的目标 slug(覆盖 previewSlug)
  const [navigatedSlug, setNavigatedSlug] = React.useState<string | null>(null)
  // 预览内容区 ref,用于 TOC 点击滚动
  const contentRef = React.useRef<HTMLDivElement>(null)
  // 当前滚动高亮的 TOC 项 id
  const [activeHeadingId, setActiveHeadingId] = React.useState<string | null>(null)
  // 阅读进度百分比(0-100)
  const [progress, setProgress] = React.useState(0)
  // 移动端 TOC 抽屉开关(md 以下小屏才显示)
  const [showTocDrawer, setShowTocDrawer] = React.useState(false)

  // 动态生成分类按钮(从返回数据的 unique category 值)
  const categories = React.useMemo(() => {
    const unique = [...new Set((data ?? []).map((d) => d.category))]
    return ['全部', ...unique.sort()]
  }, [data])

  const list = React.useMemo(() => {
    const all = data ?? []
    return all.filter((item) => {
      const matchKeyword =
        !keyword ||
        item.title.toLowerCase().includes(keyword.toLowerCase()) ||
        item.excerpt.toLowerCase().includes(keyword.toLowerCase())
      const matchCategory = category === '全部' || item.category === category
      return matchKeyword && matchCategory
    })
  }, [data, keyword, category])

  const previewDoc = list.find((d) => d.id === previewId) ?? null

  // 当前预览文档的 slug(含子目录路径,如 developer/incentive-program/course)
  // 用于 ReactMarkdown 改写相对图片路径 ./images/xxx.png → /api/feature-center/documents/asset/<dir>/images/xxx.png
  const previewSlug = React.useMemo(() => {
    if (!previewDoc) return ''
    return previewDoc.url
      ? previewDoc.url.replace('/docs/', '')
      : previewDoc.id.replace('file:', '')
  }, [previewDoc])

  // 点击 preview 时加载 markdown 内容(DB 优先,文件兜底)
  const { data: previewContent, isLoading: previewLoading } = useQuery({
    queryKey: ['doc-content', previewId],
    queryFn: async () => {
      if (!previewId) return ''
      const doc = (data ?? []).find((d) => d.id === previewId)
      if (!doc) return ''
      const slug = doc.url ? doc.url.replace('/docs/', '') : doc.id.replace('file:', '')
      const res = await fetchApi<{ content: string }>(
        `/api/feature-center/documents/${slug}/content`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data.content
    },
    enabled: !!previewId,
  })

  // 点击 markdown 内部 .md 链接时加载目标文档内容(覆盖 previewContent)
  const { data: navigatedContent, isLoading: navigatedLoading } = useQuery({
    queryKey: ['doc-content-nav', navigatedSlug],
    queryFn: async () => {
      if (!navigatedSlug) return ''
      const res = await fetchApi<{ content: string }>(
        `/api/feature-center/documents/${navigatedSlug}/content`,
      )
      if (!res.success) throw new Error(res.error)
      return res.data.content
    },
    enabled: !!navigatedSlug,
  })

  // 实际显示的内容与 slug(navigated 优先,覆盖 preview)
  const displayContent = navigatedSlug ? (navigatedContent ?? '') : (previewContent ?? '')
  const displaySlug = navigatedSlug ?? previewSlug
  const displayLoading = navigatedSlug ? navigatedLoading : previewLoading

  // 从当前显示内容提取 TOC
  const tocItems = React.useMemo(() => extractToc(displayContent), [displayContent])

  // 阅读时长估算:中文按 300 字/分钟(英文按字符近似估算)
  const readingTime = React.useMemo(() => {
    if (!displayContent) return 0
    const chars = displayContent.replace(/\s+/g, '').length
    return Math.max(1, Math.ceil(chars / 300))
  }, [displayContent])

  // 当前预览文档在 list 中的索引(navigatedSlug 跳转不影响,基于 previewDoc 位置)
  const navIndex = React.useMemo(() => {
    if (!previewDoc) return -1
    return list.findIndex((d) => d.id === previewDoc.id)
  }, [list, previewDoc])
  // 上一篇 / 下一篇文档(提取为局部变量以便 TS 类型收窄)
  const navPrev = navIndex > 0 ? list[navIndex - 1] : undefined
  const navNext =
    navIndex >= 0 && navIndex < list.length - 1 ? list[navIndex + 1] : undefined

  // 点击 TOC 项:滚动到对应标题
  function scrollToHeading(id: string) {
    const container = contentRef.current
    if (!container) return
    const el = container.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null
    if (!el) return
    setActiveHeadingId(id)
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 内容滚动时:1)更新阅读进度条;2)高亮当前可视 TOC 标题
  function handleContentScroll() {
    const container = contentRef.current
    if (!container) return
    // 1. 进度条
    const max = container.scrollHeight - container.clientHeight
    const p = max > 0 ? (container.scrollTop / max) * 100 : 0
    setProgress(Math.min(100, Math.max(0, p)))
    // 2. TOC 高亮
    if (tocItems.length === 0) return
    const scrollTop = container.scrollTop
    // 找到最后一个顶部位置 <= scrollTop+80 的标题
    let current: string | null = null
    for (const item of tocItems) {
      const el = container.querySelector(`#${CSS.escape(item.id)}`) as HTMLElement | null
      if (!el) continue
      const top = el.offsetTop
      if (top <= scrollTop + 80) {
        current = item.id
      }
    }
    setActiveHeadingId(current)
  }

  // 切换文档(navigatedSlug 或 previewSlug 变化)时重置进度、高亮,并滚动到顶部
  React.useEffect(() => {
    setProgress(0)
    setActiveHeadingId(null)
    contentRef.current?.scrollTo(0, 0)
  }, [displaySlug])

  // ESC 关闭预览 modal
  React.useEffect(() => {
    if (!previewDoc) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closePreview()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewDoc])

  // 把 markdown 中的相对 .md 链接改写为可点击的内部导航
  // ./xxx.md 或 ./dir/xxx.md → 基于 displaySlug 推导 dirBase,组合成绝对 slug
  // ../xxx.md 或 ../../xxx.md → 逐级回退 dirBase
  function resolveMdLink(href: string): string | null {
    if (!href.endsWith('.md') && !href.includes('.md#')) return null
    const hashIdx = href.indexOf('#')
    const mdPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href
    const hash = hashIdx >= 0 ? href.slice(hashIdx) : ''
    const dirBase = displaySlug.includes('/')
      ? displaySlug.slice(0, displaySlug.lastIndexOf('/'))
      : ''
    let target: string
    if (mdPart.startsWith('./')) {
      target = mdPart.slice(2)
      target = dirBase ? `${dirBase}/${target}` : target
    } else if (mdPart.startsWith('../')) {
      const parts = mdPart.split('/')
      let cur = dirBase ? dirBase.split('/') : []
      for (const p of parts) {
        if (p === '..') {
          cur = cur.slice(0, -1)
        } else if (p === '.' || p === '') {
          continue
        } else {
          cur = [...cur, p]
        }
      }
      target = cur.join('/')
    } else if (mdPart.startsWith('/')) {
      target = mdPart.slice(1)
    } else {
      target = mdPart
      if (dirBase) target = `${dirBase}/${target}`
    }
    return target.replace(/\.md$/, '') + hash
  }

  // 关闭预览时清空 navigated 状态
  function closePreview() {
    setPreviewId(null)
    setNavigatedSlug(null)
  }

  // 上一篇/下一篇导航:切换 previewId 并清空 navigated 状态(滚动到顶部由 displaySlug effect 处理)
  function goToDoc(doc: DocItem) {
    setPreviewId(doc.id)
    setNavigatedSlug(null)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <FeatureCenterHeader title={t('title')} description={t('description')} />
      <FeatureCenterNav />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={
                'rounded-md border px-3 py-1 text-sm transition-colors ' +
                (category === c
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted')
              }
            >
              {c === '全部' ? t('catAll') : (CATEGORY_LABELS[c] ?? c)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t('loading')}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {t('noMatch')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((item) => {
            const formatLabel = FORMAT_LABELS[item.format] ?? item.format
            const categoryLabel = CATEGORY_LABELS[item.category] ?? item.category
            return (
              <Card
                key={item.id}
                className="flex h-full flex-col transition-shadow hover:shadow-md"
              >
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  {/* 顶部:format 标签 + 分类徽章 */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <FileType2 className="h-3 w-3" />
                      {formatLabel}
                    </span>
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {categoryLabel}
                    </span>
                  </div>

                  {/* 标题 */}
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
                    {item.title}
                  </h3>

                  {/* excerpt 缩略预览 */}
                  {item.excerpt && (
                    <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.excerpt}
                    </p>
                  )}

                  {/* 底部:日期 + 预览按钮 */}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    {item.updatedAt ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span />
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setPreviewId(item.id)}>
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      {t('preview')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {previewDoc && (
        <Card className="fixed inset-4 z-modal flex flex-col overflow-hidden md:inset-x-1/4 md:top-1/4 md:bottom-1/4">
          <CardContent className="flex flex-1 flex-col gap-3 p-6">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <h3 className="flex min-w-0 flex-1 items-center gap-2 text-lg font-semibold">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <span className="truncate">{previewDoc.title}</span>
                {readingTime > 0 && (
                  <span className="shrink-0 text-xs font-normal text-muted-foreground">
                    {readingTime} 分钟阅读
                  </span>
                )}
                {navigatedSlug && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNavigatedSlug(null)}
                    className="h-7 shrink-0 px-2 text-xs"
                  >
                    返回原文
                  </Button>
                )}
              </h3>
              <div className="flex shrink-0 items-center gap-1">
                {tocItems.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTocDrawer(true)}
                    className="md:hidden"
                    aria-label="打开目录"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={closePreview}>
                  {t('close')}
                </Button>
              </div>
            </div>
            {/* 阅读进度条:2px 高,随内容滚动百分比填充 */}
            <div className="h-0.5 shrink-0 overflow-hidden rounded-sm bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-100 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* 上一篇 / 下一篇文档导航 */}
            {navIndex >= 0 && (navPrev || navNext) && (
              <div className="flex shrink-0 items-center justify-between gap-2">
                {navPrev ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToDoc(navPrev)}
                    className="min-w-0"
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0" />
                    <span className="max-w-[200px] truncate">
                      上一篇:{navPrev.title}
                    </span>
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled>
                    <ChevronLeft className="h-4 w-4" />
                    上一篇
                  </Button>
                )}
                {navNext ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => goToDoc(navNext)}
                    className="min-w-0"
                  >
                    <span className="max-w-[200px] truncate">
                      下一篇:{navNext.title}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled>
                    下一篇
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            {displayLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('loading')}
              </div>
            ) : (
              <div className="flex flex-1 gap-4 overflow-hidden">
                {/* TOC 侧边栏(仅当有标题时显示) */}
                {tocItems.length > 0 && (
                  <nav className="hidden w-56 shrink-0 overflow-y-auto rounded-md bg-muted/40 p-2 md:block">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      目录
                    </div>
                    <ul className="space-y-0.5">
                      {tocItems.map((item) => (
                        <li
                          key={item.id}
                          style={{
                            paddingLeft: `${(item.level - 2) * 12}px`,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => scrollToHeading(item.id)}
                            className={
                              'block w-full truncate rounded px-2 py-1 text-left text-xs transition-colors ' +
                              (activeHeadingId === item.id
                                ? 'bg-primary/10 font-medium text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                            }
                            title={item.text}
                          >
                            {item.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
                {/* 内容区 */}
                <div
                  ref={contentRef}
                  onScroll={handleContentScroll}
                  className="prose prose-sm dark:prose-invert max-w-none flex-1 overflow-y-auto pr-2"
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: CodeBlock,
                      h2: ({ children, ...props }) => {
                        const text = String(children ?? '')
                        return (
                          <h2 id={slugifyHeading(text)} {...props}>
                            {children}
                          </h2>
                        )
                      },
                      h3: ({ children, ...props }) => {
                        const text = String(children ?? '')
                        return (
                          <h3 id={slugifyHeading(text)} {...props}>
                            {children}
                          </h3>
                        )
                      },
                      img: ({ src, alt, ...props }) => {
                        if (!src) return <img src={src} alt={alt} {...props} />
                        const isHttp = /^(https?:)?\/\//.test(String(src))
                        const isAbsolute = String(src).startsWith('/')
                        let finalSrc = String(src)
                        if (!isHttp && !isAbsolute && displaySlug) {
                          const dirBase = displaySlug.includes('/')
                            ? displaySlug.slice(0, displaySlug.lastIndexOf('/'))
                            : ''
                          const cleanSrc = String(src)
                            .replace(/^\.\//, '')
                            .replace(/^\.\.\//, '')
                          finalSrc = dirBase
                            ? `/api/feature-center/documents/asset/${dirBase}/${cleanSrc}`
                            : `/api/feature-center/documents/asset/${cleanSrc}`
                        }
                        return (
                          <img
                            src={finalSrc}
                            alt={alt}
                            {...props}
                            className="max-h-[480px] w-auto rounded-md"
                          />
                        )
                      },
                      a: ({ href, children, ...props }) => {
                        if (!href) return <a href={href}>{children}</a>
                        const targetSlug = resolveMdLink(String(href))
                        if (targetSlug) {
                          return (
                            <a
                              href={`#doc-${targetSlug}`}
                              onClick={(e) => {
                                e.preventDefault()
                                setNavigatedSlug(targetSlug)
                              }}
                              className="text-primary underline underline-offset-2 hover:opacity-80"
                              {...props}
                            >
                              {children}
                            </a>
                          )
                        }
                        const isHttp = /^(https?:)?\/\//.test(String(href))
                        if (isHttp) {
                          return (
                            <a
                              href={String(href)}
                              target="_blank"
                              rel="noopener noreferrer"
                              {...props}
                            >
                              {children}
                            </a>
                          )
                        }
                        return <a href={String(href)}>{children}</a>
                      },
                    }}
                  >
                    {displayContent}
                  </ReactMarkdown>
                </div>
                {/* 移动端 TOC 抽屉:fixed 覆盖在内容区上方 */}
                {showTocDrawer && tocItems.length > 0 && (
                  <div className="fixed inset-y-0 right-0 z-10 w-64 overflow-y-auto bg-card p-3 shadow-lg md:hidden">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        目录
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowTocDrawer(false)}
                        className="h-7 w-7 p-0"
                        aria-label="关闭目录"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <ul className="space-y-0.5">
                      {tocItems.map((item) => (
                        <li
                          key={item.id}
                          style={{
                            paddingLeft: `${(item.level - 2) * 12}px`,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              scrollToHeading(item.id)
                              setShowTocDrawer(false)
                            }}
                            className={
                              'block w-full truncate rounded px-2 py-1 text-left text-xs transition-colors ' +
                              (activeHeadingId === item.id
                                ? 'bg-primary/10 font-medium text-primary'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                            }
                            title={item.text}
                          >
                            {item.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
