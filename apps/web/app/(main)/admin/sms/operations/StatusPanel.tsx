// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import {
  CATEGORY_LABEL_KEYS,
  TEMPLATE_LABEL_KEYS,
  codeLabel,
  fmtTime,
  reviewLabel,
  type BadgeTone,
} from './helpers'
import type { SmsStatus } from './types'

function Flag({ ok, label }: { ok: boolean; label: string }) {
  const t = useTranslations('admin.smsOperations')
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={ok ? 'default' : 'destructive'}>
        {t(ok ? 'status.configured' : 'status.notConfigured')}
      </Badge>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="break-all text-right font-medium">{value || '-'}</span>
    </div>
  )
}

export function StatusPanel({ status }: { status: SmsStatus }) {
  const t = useTranslations('admin.smsOperations')
  const { tencent, aliyun, proxy, callback, compliance } = status
  const codeTemplateList = Object.entries(tencent.codeTemplates)
  /** 通道可用性徽标:凭据型通道缺凭据,自建代理缺的是配置,两者文案不同。 */
  const channelBadge = (configured: boolean, offKey: string): { key: string; tone: BadgeTone } =>
    configured ? { key: 'status.available', tone: 'default' } : { key: offKey, tone: 'outline' }
  const tencentBadge = channelBadge(tencent.configured, 'status.missingCredentials')
  const aliyunBadge = channelBadge(aliyun.configured, 'status.missingCredentials')
  const proxyBadge = channelBadge(proxy.configured, 'status.notConfigured')
  const signReviewBadge = tencent.signReview
    ? reviewLabel(tencent.signReview.status)
    : {
        key: tencent.signId ? 'review.unknown' : 'status.signIdNotRegistered',
        tone: 'outline' as BadgeTone,
      }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('status.cardCurrentChannel')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Row label="SMS_PROVIDER" value={status.provider} />
            <Row
              label={t('provider.tencent')}
              value={<Badge variant={tencentBadge.tone}>{t(tencentBadge.key)}</Badge>}
            />
            <Row
              label={t('provider.aliyun')}
              value={<Badge variant={aliyunBadge.tone}>{t(aliyunBadge.key)}</Badge>}
            />
            <Row
              label={t('provider.proxy')}
              value={<Badge variant={proxyBadge.tone}>{t(proxyBadge.key)}</Badge>}
            />
            <p className="mt-2 text-xs text-muted-foreground">{t('status.autoModeHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('provider.tencent')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Row label={t('status.signName')} value={tencent.signName} />
            <Row
              label={t('status.signReview')}
              value={<Badge variant={signReviewBadge.tone}>{t(signReviewBadge.key)}</Badge>}
            />
            {tencent.signReview?.reply && (
              <p
                className="break-all text-xs text-muted-foreground"
                title={tencent.signReview.reply}
              >
                {tencent.signReview.reply}
              </p>
            )}
            <Row label={t('status.signId')} value={tencent.signId} />
            <Row label="SDKAppId" value={tencent.sdkAppId} />
            <Row label={t('status.region')} value={tencent.region} />
            <div className="mt-1 border-t pt-1">
              {codeTemplateList.map(([key, id]) => (
                <Row key={key} label={t('status.codeTemplate', { code: key })} value={id} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('provider.aliyun')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Row label={t('status.signName')} value={aliyun.signName} />
            <Row label={t('status.codeTemplateColumn')} value={aliyun.codeTemplate} />
            <Row label={t('status.notifyTemplate')} value={aliyun.notifyTemplate} />
            {!aliyun.notifyTemplate && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('status.noNotifyTemplateHint')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('status.cardCallbackCompliance')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Flag ok={callback.tokenConfigured} label={t('status.callbackToken')} />
            <Flag ok={callback.ipAllowlistConfigured} label={t('status.callbackIpAllowlist')} />
            <Flag ok={compliance.unsubscribeFailClosed} label={t('status.unsubscribeFailClosed')} />
            <Flag ok={compliance.marketingEnabled} label={t('status.marketingSwitch')} />
            <Row label={t('status.callbackPath')} value={callback.path} />
            <Row label={t('status.marketingWindow')} value={compliance.marketingSendWindow} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('status.cardRateLimit')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-1 text-sm md:grid-cols-2 xl:grid-cols-4">
          <Row
            label={t('status.noticePerNumber')}
            value={t('status.perHourPerDay', {
              hourly: compliance.noticeHourlyCap,
              daily: compliance.noticeDailyCap,
            })}
          />
          <Row
            label={t('status.marketingPerNumber')}
            value={t('status.perDayPerMonth', {
              daily: compliance.marketingDailyCap,
              monthly: compliance.marketingMonthlyCap,
            })}
          />
          <Row
            label={t('status.marketingGlobalDailyCap')}
            value={t('status.perDay', { count: compliance.marketingGlobalDailyCap })}
          />
          <Row
            label={t('status.broadcastLimit')}
            value={t('status.countUnit', { count: status.broadcastLimit })}
          />
          <Row label={t('status.unsubscribeCount')} value={`${compliance.unsubscribeCount}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('status.cardTemplateMatrix')}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {status.review.available
              ? t('status.reviewSource', { time: fmtTime(status.review.checkedAt) })
              : status.review.errorCode
                ? t('status.reviewUnavailableWithCode', { code: status.review.errorCode })
                : t('status.reviewUnavailable')}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t('field.category')}</th>
                <th className="px-3 py-2 font-medium">{t('field.usage')}</th>
                <th className="px-3 py-2 font-medium">{t('status.colEnvKey')}</th>
                <th className="px-3 py-2 font-medium">{t('status.colTencentTemplateId')}</th>
                <th className="px-3 py-2 font-medium">{t('status.colBackfilled')}</th>
                <th className="px-3 py-2 font-medium">{t('status.colReviewStatus')}</th>
                <th className="px-3 py-2 font-medium">{t('status.colReviewReply')}</th>
              </tr>
            </thead>
            <tbody>
              {status.templates.map((row) => {
                const review = reviewLabel(row.reviewStatus)
                return (
                  <tr key={`${row.category}-${row.key}`} className="border-t">
                    <td className="px-3 py-2">{t(CATEGORY_LABEL_KEYS[row.category])}</td>
                    <td className="px-3 py-2">{codeLabel(TEMPLATE_LABEL_KEYS, row.key, t)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {row.envKey}
                    </td>
                    <td className="px-3 py-2 font-mono">{row.templateId ?? '-'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={row.ready ? 'default' : 'outline'}>
                        {t(row.ready ? 'status.backfilled' : 'status.notBackfilled')}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={review.tone}>{t(review.key)}</Badge>
                    </td>
                    <td
                      className="max-w-72 truncate px-3 py-2 text-xs text-muted-foreground"
                      title={row.reviewReply ?? ''}
                    >
                      {row.reviewReply ?? '-'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
