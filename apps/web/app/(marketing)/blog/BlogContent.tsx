'use client'

import * as React from 'react'
import { ArrowRight, Calendar } from 'lucide-react'
import { Button, Card, CardContent } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { posts, type BlogPost } from './posts'

/**
 * 博客聚合页客户端组件
 *
 * - Hero + 分类筛选 + 卡片网格
 * - 卡片 hover 用 subtle 颜色变化(border-primary/40 bg-primary/5),无蓝色发光
 * - 圆角用 rounded-md/rounded-lg,禁 rounded-full
 * - "阅读原文"外链到 GitHub docs/blog/ 对应 markdown 文件
 */

const CATEGORIES = [
  '全部',
  'AI 工程',
  'AI 商业',
  'AI 协议',
  '前端架构',
  'AI 产品',
  '开源商业化',
] as const

const GITHUB_BLOG_URL = 'https://github.com/IHUI-INF-AI/IHUI-AI/blob/main/docs/blog'

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function BlogContent() {
  const [activeCategory, setActiveCategory] = React.useState<string>('全部')

  const filteredPosts = React.useMemo(() => {
    if (activeCategory === '全部') return posts
    return posts.filter((p) => p.category === activeCategory)
  }, [activeCategory])

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
        {/* Hero */}
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">IHUI AI 技术博客</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            AI 工程实战 / 开源变现 / 架构设计
          </p>
        </header>

        {/* 分类筛选 */}
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors md:text-sm',
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <span>{cat}</span>
            </button>
          ))}
        </div>

        {/* 博客卡片网格 */}
        {filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            暂无该分类的文章
          </div>
        )}
      </div>
    </main>
  )
}

function BlogCard({ post }: { post: BlogPost }) {
  const formattedDate = dateFormatter.format(new Date(post.date))
  const githubUrl = `${GITHUB_BLOG_URL}/${post.fileName}`

  return (
    <Card className="group flex flex-col transition-colors hover:border-primary/40 hover:bg-primary/5">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        {/* 分类徽章 + 日期 */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {post.category}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {formattedDate}
          </span>
        </div>

        {/* 标题 */}
        <h2 className="text-base font-semibold leading-snug md:text-lg">{post.title}</h2>

        {/* 描述 */}
        <p className="flex-1 text-sm text-muted-foreground line-clamp-3">{post.description}</p>

        {/* 标签 */}
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* 阅读原文按钮(外链到 GitHub docs/blog/)*/}
        <Button asChild variant="outline" size="sm" className="w-full">
          <a href={githubUrl} target="_blank" rel="noopener noreferrer">
            阅读原文
            <ArrowRight className="ml-auto" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
