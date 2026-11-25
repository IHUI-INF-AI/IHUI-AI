// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Loader2, RefreshCw, Workflow } from 'lucide-react'

import { fetchWechatAccounts, fetchWechatCapabilities } from '@ihui/api-client'
import type { WechatAccountView, WechatBackendCapability } from '@ihui/types'
import { Badge } from '@/components/data'
import { Button } from '@ihui/ui-react'

import { PlatformIcon } from './platform-icon'

type AccountStatus = WechatAccountView['status']

const STATUS_VARIANT: Record<AccountStatus, 'success' | 'warning' | 'default'> = {
  online: 'success',
  connecting: 'warning',
  awaiting_scan: 'warning',
  expired: 'warning',
  error: 'warning',
  disconnected: 'default',
}

/**
 * 微信自动化(微信智联 wechat-hub)入口卡片。
 *
 * 微信自动化是完整独立系统(扫码登录/会话/联系人/群/朋友圈/自动回复/AI 分析/审计),
 * 已有专属管理台 /admin/wechat-hub。这里不重复造功能，只在连接器页提供:
 * - 复用 api-client 的 fetchWechatAccounts/fetchWechatCapabilities 展示真实账号与后端能力
 * - 一键跳转到完整配置台
 * 让用户能从「连接器」统一入口发现微信自动化能力。
 */
export function WechatHubSection() {
  const t = useTranslations('connectors')
  const [accounts, setAccounts] = useState<WechatAccountView[]>([])
  const [backends, setBackends] = useState<WechatBackendCapability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [acc, caps] = await Promise.all([fetchWechatAccounts(), fetchWechatCapabilities()])
      setAccounts(acc)
      setBackends(caps)
    } catch {
      setError(t('wechatHubLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <section className="space-y-2.5 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-2">
        <PlatformIcon type="wechat" size={18} className="mt-0.5" />
        <div className="flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-semibold">{t('wechatHubTitle')}</p>
            <Badge variant="default">{t('wechatHubBadge')}</Badge>
          </div>
          <p className="text-label text-muted-foreground">{t('wechatHubHint')}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} aria-label="refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-label text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('wechatHubLoading')}
        </div>
      ) : error ? (
        <p className="py-2 text-label text-destructive">{error}</p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {backends.map((b) => (
              <Badge key={b.backend} variant="default">
                {b.label}
              </Badge>
            ))}
          </div>
          {accounts.length === 0 ? (
            <p className="py-1 text-label text-muted-foreground">{t('wechatHubEmpty')}</p>
          ) : (
            <ul className="space-y-1.5">
              {accounts.slice(0, 5).map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-stroke-subtle bg-muted/20 px-3 py-1.5"
                >
                  <Workflow className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-label font-medium">{a.label}</p>
                    <p className="break-words text-[11px] text-muted-foreground">{a.backend}</p>
                  </div>
                  <Badge variant={STATUS_VARIANT[a.status] ?? 'default'}>{a.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stroke-subtle pt-2">
        <p className="text-[11px] text-muted-foreground">{t('wechatHubNote')}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/wechat-hub">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {t('wechatHubConfigure')}
          </Link>
        </Button>
      </div>
    </section>
  )
}
