// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import type { ReactNode } from 'react'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@ihui/ui-react'
import { CATEGORY_LABELS, fmtTime, reviewLabel, templateLabel } from './helpers'
import type { SmsStatus } from './types'

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <Badge variant={ok ? 'default' : 'destructive'}>{ok ? '已配置' : '未配置'}</Badge>
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
  const { tencent, aliyun, proxy, callback, compliance } = status
  const codeTemplateList = Object.entries(tencent.codeTemplates)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">当前通道</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Row label="SMS_PROVIDER" value={status.provider} />
            <Row
              label="腾讯云"
              value={
                <Badge variant={tencent.configured ? 'default' : 'outline'}>
                  {tencent.configured ? '可用' : '缺凭据'}
                </Badge>
              }
            />
            <Row
              label="阿里云"
              value={
                <Badge variant={aliyun.configured ? 'default' : 'outline'}>
                  {aliyun.configured ? '可用' : '缺凭据'}
                </Badge>
              }
            />
            <Row
              label="自建代理"
              value={
                <Badge variant={proxy.configured ? 'default' : 'outline'}>
                  {proxy.configured ? '可用' : '未配置'}
                </Badge>
              }
            />
            <p className="mt-2 text-xs text-muted-foreground">
              auto 模式优先使用已回填模板的通道,未回填时回落阿里云通知模板。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">腾讯云</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Row label="签名" value={tencent.signName} />
            <Row
              label="签名审核"
              value={
                tencent.signReview ? (
                  <Badge variant={reviewLabel(tencent.signReview.status).tone}>
                    {reviewLabel(tencent.signReview.status).label}
                  </Badge>
                ) : (
                  <Badge variant="outline">{tencent.signId ? '状态未知' : '未登记签名 ID'}</Badge>
                )
              }
            />
            {tencent.signReview?.reply && (
              <p
                className="break-all text-xs text-muted-foreground"
                title={tencent.signReview.reply}
              >
                {tencent.signReview.reply}
              </p>
            )}
            <Row label="签名 ID" value={tencent.signId} />
            <Row label="SDKAppId" value={tencent.sdkAppId} />
            <Row label="地域" value={tencent.region} />
            <div className="mt-1 border-t pt-1">
              {codeTemplateList.map(([key, id]) => (
                <Row key={key} label={`验证码 · ${key}`} value={id} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">阿里云</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Row label="签名" value={aliyun.signName} />
            <Row label="验证码模板" value={aliyun.codeTemplate} />
            <Row label="通知模板" value={aliyun.notifyTemplate} />
            {!aliyun.notifyTemplate && (
              <p className="mt-2 text-xs text-muted-foreground">
                未配置 ALI_SMS_NOTIFY_TEMPLATE_CODE 时,腾讯模板未过审的通知类短信将无兜底通道。
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">回调与合规</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Flag ok={callback.tokenConfigured} label="回调 Token" />
            <Flag ok={callback.ipAllowlistConfigured} label="回调 IP 白名单" />
            <Flag ok={compliance.unsubscribeFailClosed} label="退订黑名单 fail-closed" />
            <Flag ok={compliance.marketingEnabled} label="营销总开关" />
            <Row label="回调路径" value={callback.path} />
            <Row label="营销时段" value={compliance.marketingSendWindow} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">频控与配额</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-1 text-sm md:grid-cols-2 xl:grid-cols-4">
          <Row
            label="通知单号"
            value={`${compliance.noticeHourlyCap} 条/时 · ${compliance.noticeDailyCap} 条/日`}
          />
          <Row
            label="营销单号"
            value={`${compliance.marketingDailyCap} 条/日 · ${compliance.marketingMonthlyCap} 条/月`}
          />
          <Row label="营销全局日上限" value={`${compliance.marketingGlobalDailyCap} 条/日`} />
          <Row label="单次群发上限" value={`${status.broadcastLimit} 条`} />
          <Row label="退订黑名单人数" value={`${compliance.unsubscribeCount}`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">模板矩阵</CardTitle>
          <p className="text-xs text-muted-foreground">
            {status.review.available
              ? `审核状态来自腾讯云,查询时间 ${fmtTime(status.review.checkedAt)}`
              : `审核状态查询不可用${status.review.errorCode ? `(${status.review.errorCode})` : ''},仅显示本地回填情况`}
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">类别</th>
                <th className="px-3 py-2 font-medium">用途</th>
                <th className="px-3 py-2 font-medium">环境变量</th>
                <th className="px-3 py-2 font-medium">腾讯模板 ID</th>
                <th className="px-3 py-2 font-medium">回填</th>
                <th className="px-3 py-2 font-medium">审核状态</th>
                <th className="px-3 py-2 font-medium">审核意见</th>
              </tr>
            </thead>
            <tbody>
              {status.templates.map((row) => {
                const review = reviewLabel(row.reviewStatus)
                return (
                  <tr key={`${row.category}-${row.key}`} className="border-t">
                    <td className="px-3 py-2">{CATEGORY_LABELS[row.category]}</td>
                    <td className="px-3 py-2">{templateLabel(row.key)}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                      {row.envKey}
                    </td>
                    <td className="px-3 py-2 font-mono">{row.templateId ?? '-'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={row.ready ? 'default' : 'outline'}>
                        {row.ready ? '已回填' : '未回填'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={review.tone}>{review.label}</Badge>
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
