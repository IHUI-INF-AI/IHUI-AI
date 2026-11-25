// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink, Loader2, PlugZap, RefreshCw } from 'lucide-react'

import {
  connectChannel,
  disconnectChannel,
  listChannels,
  listSupportedChannels,
  type ChannelItem,
} from '@/lib/openclaw-api'
import { Badge } from '@/components/data'
import { Button } from '@ihui/ui-react'

import { PlatformIcon } from './platform-icon'

/** 微信系渠道(OpenClaw/Clawbot 的用户态渠道类型)。 */
const WECHAT_TYPES = new Set(['wechat', 'wechat_mp', 'wechat-work'])

/**
 * 微信 Clawbot 渠道入口。
 *
 * 复用 OpenClaw 用户态 channels API(按 userId 隔离):
 * - 已登记渠道 /api/openclaw/channels(带真实 connected 状态)
 * - 可接入渠道 /api/openclaw/channels/supported
 * - connect/disconnect 走真实后端端点
 * 连接后 AI 可通过 Clawbot 网关向该微信渠道收发消息;完整配对/凭据配置在
 * OpenClaw 集成面板(/openclaw)完成。这里只做状态展示 + 快捷连接 + 跳转入口。
 */
export function WechatClawbotSection() {
  const t = useTranslations('connectors')
  const [channels, setChannels] = useState<ChannelItem[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [registered, supported] = await Promise.all([listChannels(), listSupportedChannels()])
      // 合并:已登记的 connected 状态优先,supported 只补未登记的候选
      const byId = new Map<string, ChannelItem>()
      for (const c of supported) {
        if (WECHAT_TYPES.has(c.type)) byId.set(c.id, { ...c, connected: false })
      }
      for (const c of registered) {
        if (WECHAT_TYPES.has(c.type)) byId.set(c.id, c)
      }
      setChannels([...byId.values()])
    } catch {
      setError(t('wechatClawbotLoadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const toggle = async (ch: ChannelItem) => {
    setBusyId(ch.id)
    setError('')
    try {
      const ok = ch.connected ? await disconnectChannel(ch.id) : await connectChannel(ch.id)
      if (!ok) setError(t('wechatClawbotActionFailed'))
      await refresh()
    } catch {
      setError(t('wechatClawbotActionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-2.5 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-2">
        <PlatformIcon type="wechat" size={18} className="mt-0.5" />
        <div className="flex-1 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body font-semibold">{t('wechatClawbotTitle')}</p>
            <Badge variant="default">{t('wechatClawbotBadge')}</Badge>
          </div>
          <p className="text-label text-muted-foreground">{t('wechatClawbotHint')}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} aria-label="refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2 text-label text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('wechatClawbotLoading')}
        </div>
      ) : channels.length === 0 ? (
        <p className="py-2 text-label text-muted-foreground">{t('wechatClawbotEmpty')}</p>
      ) : (
        <ul className="space-y-2">
          {channels.map((ch) => (
            <li
              key={ch.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-stroke-subtle bg-muted/20 px-3 py-2"
            >
              <PlugZap
                className={`h-4 w-4 shrink-0 ${ch.connected ? 'text-primary' : 'text-muted-foreground'}`}
              />
              <div className="min-w-0 flex-1">
                <p className="break-words text-label font-medium">{ch.name}</p>
                <p className="break-words text-[11px] text-muted-foreground">{ch.type}</p>
              </div>
              <Badge variant={ch.connected ? 'success' : 'default'}>
                {ch.connected ? t('wechatClawbotConnected') : t('wechatClawbotDisconnected')}
              </Badge>
              <Button
                variant={ch.connected ? 'outline' : 'default'}
                size="sm"
                onClick={() => void toggle(ch)}
                disabled={busyId === ch.id}
              >
                {busyId === ch.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {ch.connected ? t('wechatClawbotDisconnect') : t('wechatClawbotConnect')}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stroke-subtle pt-2">
        <p className="text-[11px] text-muted-foreground">{t('wechatClawbotNote')}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/openclaw">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            {t('wechatClawbotConfigure')}
          </Link>
        </Button>
      </div>
    </section>
  )
}
