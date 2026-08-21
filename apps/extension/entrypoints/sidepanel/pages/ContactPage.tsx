/**
 * ContactPage — 联系我们(/settings/contact,2026-08-21 立)。
 * 展示官方联系方式与意见反馈入口(chrome.tabs.create 打开网页版反馈页)。
 */
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'
import { openInWeb } from '../../../lib/open-in-web'

export default function ContactPage() {
  const { t } = useI18n()
  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.contact')}</h3>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <p className="m-0 text-sm leading-relaxed text-muted-foreground">
            {t('page.contact.desc')}
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2">
              <span aria-hidden>📮</span>
              <span className="text-muted-foreground shrink-0">{t('page.contact.email')}:</span>
              <span className="truncate">support@ihui-ai.com</span>
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden>💬</span>
              <span className="text-muted-foreground shrink-0">{t('page.contact.wechat')}:</span>
              <span>{t('page.contact.wechatValue')}</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{t('page.contact.serviceTime')}</div>
          <button
            type="button"
            onClick={() => openInWeb('/feedback')}
            className="mt-1 px-3 py-1.5 text-xs rounded-md border border-border bg-card text-foreground cursor-pointer hover:bg-muted/50 transition-colors self-start"
          >
            {t('page.contact.feedback')} ↗
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
