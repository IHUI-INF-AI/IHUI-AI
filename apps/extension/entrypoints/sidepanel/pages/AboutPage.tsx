/**
 * AboutPage — 关于我们(/settings/about,2026-08-21 立)。
 * 展示产品简介、版本号与版权信息。版本号与 apps/extension/package.json 保持一致。
 */
import { Card, CardContent } from '@ihui/ui-react'
import { useI18n } from '../../../src/i18n'

const VERSION = '1.0.0'

export default function AboutPage() {
  const { t } = useI18n()
  const year = new Date().getFullYear()
  return (
    <div className="p-3 md:p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="m-0 text-sm font-semibold">{t('apps.about')}</h3>
      </div>
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-3xl" aria-hidden>
              🤖
            </span>
            <div>
              <div className="font-semibold text-sm">IHUI AI</div>
              <div className="text-xs text-muted-foreground">
                {t('page.about.version')} {VERSION}
              </div>
            </div>
          </div>
          <p className="m-0 text-sm leading-relaxed">{t('page.about.introP1')}</p>
          <p className="m-0 text-sm leading-relaxed">{t('page.about.introP2')}</p>
        </CardContent>
      </Card>
      <p className="m-0 text-xs text-muted-foreground text-center">
        {t('page.about.copyright', { year })}
      </p>
    </div>
  )
}
