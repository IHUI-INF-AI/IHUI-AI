// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useTranslations } from 'next-intl'
import { Loader2, Plus, ShieldCheck, Zap } from 'lucide-react'

import {
  type ConnectorCatalogItem,
  type ConnectorEntry,
} from '@ihui/api-client/endpoints/connectors'
import { Badge } from '@/components/data'
import { Button } from '@ihui/ui-react'

import { PlatformIcon } from './platform-icon'

interface ManagedQuickSectionProps {
  templates: ConnectorCatalogItem[]
  installed: Map<string, ConnectorEntry>
  connectingType: string | null
  onConnect: (type: string, label: string) => void
  onInvoke: (entry: ConnectorEntry) => void
  /** 用户 OAuth 扫码授权自己账号(飞书/钉钉端点已官方核实) */
  onUserAuthorize?: (type: string) => void
}

/**
 * 用户扫码授权入口:仅后端已核实 OAuth 端点且协议提供 per-user token 的平台可见。
 * - 飞书:user_access_token(官方 authen/v2/oauth/token)
 * - 钉钉:userAccessToken(官方 /v1.0/oauth2/userAccessToken)
 * - 企微:旧网页 OAuth 只回 userid/user_ticket,无 per-user token ⇒ 不放行扫码入口;
 *   新的「智能机器人 MCP」走独立 WecomRobotSection(成员授权办公能力),不走此入口。
 */
const USER_OAUTH_PLATFORMS = new Set(['feishu', 'dingtalk'])

/** 预置平台一键接入卡片组(托管凭据,用户不填密钥) */
export function ManagedQuickSection({
  templates,
  installed,
  connectingType,
  onConnect,
  onInvoke,
  onUserAuthorize,
}: ManagedQuickSectionProps) {
  const t = useTranslations('connectors')

  return (
    <section className="space-y-2.5 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
        <div className="space-y-0.5">
          <p className="text-body font-semibold">{t('quickTitle')}</p>
          <p className="text-label text-muted-foreground">{t('quickHint')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[720px]:grid-cols-2">
        {templates.map((tpl: ConnectorCatalogItem) => {
          const entry = installed.get(tpl.type)
          const st = tpl.managed
          const available = Boolean(st?.available)
          const connecting = connectingType === tpl.type
          return (
            <div
              key={tpl.type}
              className="flex flex-col gap-2 rounded-md border border-stroke-subtle bg-muted/20 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <PlatformIcon type={tpl.type} size={18} />
                    <span className="text-label font-semibold text-foreground">{tpl.label}</span>
                    {entry ? (
                      <Badge variant="success">{t('connected')}</Badge>
                    ) : (
                      <Badge variant={available ? 'success' : 'default'}>
                        {available ? t('managedReady') : t('managedNotReady')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{tpl.description}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {t('operationCount', { count: tpl.operations.length })}
                </span>
                {USER_OAUTH_PLATFORMS.has(tpl.type) && onUserAuthorize ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUserAuthorize(tpl.type)}
                    data-testid={`user-oauth-${tpl.type}`}
                  >
                    {t('userAuthorize')}
                  </Button>
                ) : null}
                {entry ? (
                  <Button variant="outline" size="sm" onClick={() => onInvoke(entry)}>
                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                    {t('invoke')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={!available || connecting}
                    onClick={() => onConnect(tpl.type, tpl.label)}
                  >
                    {connecting ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {available ? t('connectNow') : t('managedNotReady')}
                  </Button>
                )}
              </div>
              {!available ? (
                <p className="text-[11px] text-muted-foreground">
                  {st?.reason || t('managedUnavailableHint')}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
