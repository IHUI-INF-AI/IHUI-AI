/**
 * HelpPage — 帮助中心(/settings/help,2026-08-21 立)。
 * 展示常见问题(Q&A折叠/列表),数据来自扩展 i18n 文案。
 */
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const FAQS = [
  { title: 'page.help.faq1Title', body: 'page.help.faq1Body' },
  { title: 'page.help.faq2Title', body: 'page.help.faq2Body' },
  { title: 'page.help.faq3Title', body: 'page.help.faq3Body' },
  { title: 'page.help.faq4Title', body: 'page.help.faq4Body' },
  { title: 'page.help.faq5Title', body: 'page.help.faq5Body' },
]

export default function HelpPage() {
  const { t } = useI18n()
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.help')}</h3>
      </div>
      <p className="m-0 text-xs text-muted-foreground">{t('page.help.desc')}</p>
      {FAQS.map((faq, idx) => {
        const isOpen = openIdx === idx
        return (
          <Card key={faq.title} className="hover:bg-muted/50 transition-colors">
            <button
              type="button"
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left bg-transparent border-none cursor-pointer"
            >
              <span className="text-sm font-medium">{t(faq.title)}</span>
              <span aria-hidden className="text-muted-foreground text-xs">
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {isOpen ? (
              <CardContent className="px-4 pb-4 pt-1 text-sm leading-relaxed text-muted-foreground">
                {t(faq.body)}
              </CardContent>
            ) : null}
          </Card>
        )
      })}
      <p className="m-0 text-xs text-muted-foreground text-center">{t('page.help.more')}</p>
    </div>
  )
}
