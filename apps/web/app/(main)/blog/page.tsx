import * as React from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { BookOpen, Clock, Tag, ArrowRight } from 'lucide-react'

import { Card, CardContent, Badge } from '@ihui/ui-react'
import { cn } from '@/lib/utils'
import { listBlogPosts, listBlogCategories } from '@/lib/blog'
import { BackButton } from '@/components/common'

export const metadata: Metadata = {
  title: '技术博客',
  description:
    'IHUI AI 团队分享 AI Agent / LLM / RAG / MCP / 多端架构 / 开源商业化等深度技术文章',
}

export default async function BlogIndexPage() {
  const t = await getTranslations('blog')
  const locale = await getLocale()
  const posts = listBlogPosts()
  const categories = listBlogCategories()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-8 min-[768px]:py-8">
      <BackButton />
      <header className="space-y-3 text-center min-[768px]:text-left">
        <div className="flex items-center justify-center gap-2 min-[768px]:justify-start">
          <BookOpen className="h-7 w-7 text-primary" />
          <h1 className="text-2xl min-[768px]:text-3xl min-[1024px]:text-4xl font-bold tracking-tight">{t('title')}</h1>
        </div>
        <p className="text-base text-muted-foreground min-[768px]:text-lg">{t('subtitle')}</p>
        <p className="text-xs text-muted-foreground">
          {t('stats', { count: posts.length })}
        </p>
      </header>

      {categories.length > 0 && (
        <nav className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Tag className="h-4 w-4" />
            {t('categoryLabel')}:
          </span>
          {categories.map((cat) => (
            <Badge key={cat} variant="secondary" className="font-normal">
              {cat}
            </Badge>
          ))}
        </nav>
      )}

      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
              >
                <Card
                  className={cn(
                    'h-full overflow-hidden border-border bg-card transition-colors',
                    'group-hover:border-primary/40 group-hover:bg-accent/40',
                  )}
                >
                  <CardContent className="flex h-full flex-col gap-3 p-5 min-[640px]:p-5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-normal">
                        {post.category}
                      </Badge>
                      <span aria-hidden>·</span>
                      <time dateTime={post.date}>{dateFmt.format(new Date(post.date))}</time>
                    </div>

                    <h2 className="line-clamp-2 text-lg font-semibold leading-tight text-foreground group-hover:text-primary">
                      {post.title}
                    </h2>

                    {post.description && (
                      <p className="line-clamp-3 text-sm text-muted-foreground">
                        {post.description}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {t('readMinutes', { count: post.readMinutes })}
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        {t('readMore')}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
