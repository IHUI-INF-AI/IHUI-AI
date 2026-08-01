import Link from 'next/link'

interface NavChapter {
  href: string
  num: string
  title: string
}

interface ManualNavProps {
  prev?: NavChapter
  next?: NavChapter
}

export function ManualNav({ prev, next }: ManualNavProps) {
  return (
    <nav className="mt-12 grid grid-cols-1 gap-3 min-[768px]:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="group rounded-xl border bg-card p-4 transition-colors hover:bg-accent"
        >
          <div className="text-xs font-mono text-muted-foreground">← 第 {prev.num} 章</div>
          <div className="mt-1 text-sm font-medium">{prev.title}</div>
        </Link>
      ) : (
        <div className="rounded-xl border bg-muted/20 p-4 opacity-50">
          <div className="text-xs font-mono text-muted-foreground">← 已是第一章</div>
          <div className="mt-1 text-sm">无</div>
        </div>
      )}
      {next ? (
        <Link
          href={next.href}
          className="group rounded-xl border bg-card p-4 text-right transition-colors hover:bg-accent"
        >
          <div className="text-xs font-mono text-muted-foreground">第 {next.num} 章 →</div>
          <div className="mt-1 text-sm font-medium">{next.title}</div>
        </Link>
      ) : (
        <div className="rounded-xl border bg-muted/20 p-4 text-right opacity-50">
          <div className="text-xs font-mono text-muted-foreground">已是最后一章 →</div>
          <div className="mt-1 text-sm">无</div>
        </div>
      )}
    </nav>
  )
}

export const chapters = {
  '01': { href: '/docs/manual/getting-started', num: '01', title: '开始使用' },
  '02': { href: '/docs/manual/ai-chat', num: '02', title: 'AI 对话' },
  '03': { href: '/docs/manual/agent', num: '03', title: '使用 Agent' },
  '04': { href: '/docs/manual/knowledge-base', num: '04', title: '知识库' },
  '05': { href: '/docs/manual/billing', num: '05', title: '积分与订阅' },
  '06': { href: '/docs/manual/account', num: '06', title: '账户设置' },
  '07': { href: '/docs/manual/faq', num: '07', title: '常见问题' },
} as const

export type ChapterKey = keyof typeof chapters
