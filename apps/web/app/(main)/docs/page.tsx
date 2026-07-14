import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { BookOpen, FileText, Code, Search } from 'lucide-react'
import type { ComponentType } from 'react'

import { Card, CardHeader, CardTitle, CardDescription } from '@ihui/ui'

const DOCS_DIR = path.join(process.cwd(), 'public', 'docs')

interface DocMeta {
  slug: string
  title: string
  excerpt: string
  category: string
}

const CAT_META: Record<string, { icon: ComponentType<{ className?: string }>; label: string }> = {
  developer: { icon: Code, label: '开发文档' },
  user: { icon: BookOpen, label: '用户文档' },
  'enterprise-service': { icon: FileText, label: '企业服务' },
  root: { icon: FileText, label: '项目文档' },
}

function scanDocs(dir: string, base = ''): string[] {
  const results: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name
    if (entry.isDirectory()) results.push(...scanDocs(path.join(dir, entry.name), rel))
    else if (entry.name.endsWith('.md')) results.push(rel)
  }
  return results.sort()
}

function extractTitle(content: string): string {
  const m = /^#\s+(.+?)\s*$/m.exec(content)
  return m?.[1]?.replace(/[*_`]/g, '') || 'Untitled'
}

function excerpt(content: string, max = 120): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`>\-_~#!]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function loadAllDocs(): DocMeta[] {
  return scanDocs(DOCS_DIR).map((rel) => {
    const content = fs.readFileSync(path.join(DOCS_DIR, rel), 'utf-8')
    const parts = rel.split('/')
    return {
      slug: rel.replace(/\.md$/, ''),
      title: extractTitle(content),
      excerpt: excerpt(content),
      category: parts.length > 1 ? (parts[0] ?? 'root') : 'root',
    }
  })
}

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const t = await getTranslations('docs')
  const { q } = await searchParams
  const query = q?.trim().toLowerCase()
  const allDocs = loadAllDocs()
  const filtered = query
    ? allDocs.filter(
        (d) =>
          d.title.toLowerCase().includes(query) || d.excerpt.toLowerCase().includes(query),
      )
    : null

  const cats = ['developer', 'user', 'enterprise-service', 'root'] as const
  const grouped = cats
    .map((cat) => ({ cat, docs: allDocs.filter((d) => d.category === cat).slice(0, 5) }))
    .filter((g) => g.docs.length > 0)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t('title')}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <form className="relative" action="/docs" method="get">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q || ''}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-md border bg-background py-2 pl-9 pr-4 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </form>

      {filtered ? (
        filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((d) => (
              <Link key={d.slug} href={`/docs/${d.slug}`}>
                <Card className="h-full transition-colors hover:bg-accent hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base">{d.title}</CardTitle>
                    <CardDescription className="min-h-[2.5rem]">{d.excerpt}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('empty')}</p>
          </div>
        )
      ) : (
        <div className="space-y-8">
          {grouped.map(({ cat, docs }) => {
            const meta = CAT_META[cat] ?? { icon: FileText, label: '文档' }
            const Icon = meta.icon
            return (
              <section key={cat} className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Icon className="h-5 w-5 text-primary" />
                  {meta.label}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {docs.map((d) => (
                    <Link key={d.slug} href={`/docs/${d.slug}`}>
                      <Card className="h-full transition-colors hover:bg-accent hover:shadow-md">
                        <CardHeader>
                          <CardTitle className="text-base">{d.title}</CardTitle>
                          <CardDescription className="min-h-[2.5rem]">
                            {d.excerpt}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
