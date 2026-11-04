// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

interface NavChapter {
  href: string
  num: string
  title: string
}

interface ManualNavProps {
  prev?: NavChapter
  next?: NavChapter
}

function titleKey(ch: NavChapter): string {
  return `manual.${ch.href.split('/').pop()}.title`
}

export async function ManualNav({ prev, next }: ManualNavProps) {
  const t = await getTranslations('docs')
  return (
    <nav className="mt-12 grid grid-cols-1 gap-3 min-[768px]:grid-cols-2">
      {prev ? (
        <Link
          href={prev.href}
          className="group rounded-lg border bg-card p-3 transition-colors hover:bg-accent"
        >
          <div className="text-xs font-mono text-muted-foreground">
            ← {t('common.chapterBadge', { num: prev.num })}
          </div>
          <div className="mt-1 text-body font-medium">{t(titleKey(prev))}</div>
        </Link>
      ) : (
        <div className="rounded-lg border bg-muted/20 p-3 opacity-50">
          <div className="text-xs font-mono text-muted-foreground">
            ← {t('common.firstChapter')}
          </div>
          <div className="mt-1 text-body">无</div>
        </div>
      )}
      {next ? (
        <Link
          href={next.href}
          className="group rounded-lg border bg-card p-3 text-right transition-colors hover:bg-accent"
        >
          <div className="text-xs font-mono text-muted-foreground">
            {t('common.chapterBadge', { num: next.num })} →
          </div>
          <div className="mt-1 text-body font-medium">{t(titleKey(next))}</div>
        </Link>
      ) : (
        <div className="rounded-lg border bg-muted/20 p-3 text-right opacity-50">
          <div className="text-xs font-mono text-muted-foreground">{t('common.lastChapter')} →</div>
          <div className="mt-1 text-body">无</div>
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
