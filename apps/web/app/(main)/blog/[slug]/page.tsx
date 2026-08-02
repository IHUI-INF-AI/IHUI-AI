import * as React from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getTranslations, getLocale } from 'next-intl/server'
import { ArrowLeft, Calendar, Clock, Tag, BookOpen } from 'lucide-react'

import { Badge, Card, CardContent } from '@ihui/ui-react'
import { getBlogPost, listBlogPosts } from '@/lib/blog'
import { BlogPostContent } from './BlogPostContent'
import { generateArticleSchema } from '@/lib/seo/schema-article'

interface PageProps {
  params: Promise<{ slug: string }>
}

/** 预生成所有 blog 路由(静态导出) */
export function generateStaticParams() {
  return listBlogPosts().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) return { title: 'Not Found' }
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      tags: post.tags,
    },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  const t = await getTranslations('blog')
  const locale = await getLocale()

  const dateFmt = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // 相关文章:同分类的其他文章,最多 4 篇
  const related = listBlogPosts()
    .filter((p) => p.category === post.category && p.slug !== post.slug)
    .slice(0, 4)

  // 2026-08-02 P0-5 GEO 强化:Article JSON-LD 注入(供 GPTBot/ClaudeBot/PerplexityBot/Googlebot 结构化解析)
  const articleJsonLd = generateArticleSchema({
    headline: post.title,
    description: post.description || post.title,
    url: `https://aizhs.top/blog/${post.slug}`,
    datePublished: post.date,
    authorName: '智汇 AI 编辑部',
    keywords: post.tags.length > 0 ? post.tags : [post.category],
    articleBody: post.content.replace(/[#*`>\-]/g, '').slice(0, 5000),
    articleSection: post.category,
    inLanguage: locale === 'zh-TW' ? 'zh-TW' : 'zh-CN',
  })

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8 min-[768px]:py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="font-normal">
            {post.category}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <time dateTime={post.date}>{dateFmt.format(new Date(post.date))}</time>
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {t('readMinutes', { count: post.readMinutes })}
          </span>
        </div>

        <h1 className="text-2xl min-[768px]:text-3xl min-[1024px]:text-4xl font-bold leading-tight tracking-tight">
          {post.title}
        </h1>

        {post.description && <p className="text-lg text-muted-foreground">{post.description}</p>}

        {post.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {post.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </header>

      <div className="h-px bg-border" aria-hidden />

      <BlogPostContent content={post.content} />

      {related.length > 0 && (
        <section className="space-y-3 pt-8">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <BookOpen className="h-5 w-5 text-primary" />
            {t('relatedTitle')}
          </h2>
          <ul className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2">
            {related.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/blog/${p.slug}`}
                  className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full transition-colors hover:bg-accent/40 hover:border-primary/40">
                    <CardContent className="space-y-2 p-4">
                      <div className="text-xs text-muted-foreground">
                        <time dateTime={p.date}>{dateFmt.format(new Date(p.date))}</time>
                        {' · '}
                        {t('readMinutes', { count: p.readMinutes })}
                      </div>
                      <h3 className="line-clamp-2 font-semibold text-foreground">{p.title}</h3>
                      {p.description && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
