import fs from 'node:fs'
import path from 'node:path'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

import { Card, CardContent } from '@ihui/ui'
import { cn } from '@/lib/utils'
import { slugify } from '@/lib/content'
import { MarkdownViewer } from '@/components/media'

const DOCS_DIR = path.join(process.cwd(), 'public', 'docs')

function extractToc(markdown: string) {
  const items: { id: string; text: string; level: number }[] = []
  for (const line of markdown.split('\n')) {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (!m || !m[1] || !m[2]) continue
    const level = m[1].length
    const text = m[2].replace(/[*_`]/g, '')
    items.push({ id: slugify(text), text, level })
  }
  return items
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

function readDoc(rel: string): string {
  return fs.readFileSync(path.join(DOCS_DIR, rel), 'utf-8')
}

export function generateStaticParams() {
  return scanDocs(DOCS_DIR).map((rel) => ({
    slug: rel.replace(/\.md$/, '').split('/'),
  }))
}

export default async function DocDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>
}) {
  const { slug } = await params
  const t = await getTranslations('docs')
  const relPath = slug.join('/').replace(/\.md$/, '')
  const filePath = path.join(DOCS_DIR, `${relPath}.md`)

  if (!relPath || relPath.includes('..') || !fs.existsSync(filePath)) notFound()

  const content = readDoc(`${relPath}.md`)
  const title = extractTitle(content)
  const toc = extractToc(content)

  const allDocs = scanDocs(DOCS_DIR)
  const idx = allDocs.indexOf(`${relPath}.md`)
  const prev = idx > 0 ? allDocs[idx - 1] : null
  const next = idx >= 0 && idx < allDocs.length - 1 ? allDocs[idx + 1] : null
  const href = (rel: string) => `/docs/${rel.replace(/\.md$/, '')}`

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/docs"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row">
        <article className="min-w-0 flex-1">
          <MarkdownViewer content={content} />
        </article>

        {toc.length > 0 && (
          <aside className="w-full shrink-0 lg:w-56">
            <div className="lg:sticky lg:top-4">
              <Card>
                <CardContent className="p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('toc')}
                  </p>
                  <nav className="space-y-1">
                    {toc.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={cn(
                          'block rounded px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                          item.level === 3 && 'pl-4',
                        )}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            </div>
          </aside>
        )}
      </div>

      <nav className="flex items-center justify-between border-t pt-4">
        {prev ? (
          <Link
            href={href(prev)}
            className="group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
            <span>
              <span className="block text-xs text-muted-foreground">{t('prev')}</span>
              <span className="font-medium">{extractTitle(readDoc(prev))}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={href(next)}
            className="group flex items-center gap-2 rounded-md px-3 py-2 text-right text-sm transition-colors hover:bg-accent"
          >
            <span>
              <span className="block text-xs text-muted-foreground">{t('next')}</span>
              <span className="font-medium">{extractTitle(readDoc(next))}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  )
}
