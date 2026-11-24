// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bot, Loader2, RefreshCw } from 'lucide-react'

import {
  authorizeWecomRobot,
  getWecomRobotStatus,
  listWecomRobotTools,
} from '@ihui/api-client/endpoints/connectors'
import { Badge } from '@/components/data'
import { Button, Input } from '@ihui/ui-react'

type RobotStatus = {
  authorized: boolean
  capability: string
  expired: boolean
  message: string
}

/**
 * 企业微信智能机器人授权(2026-11 新能力)。
 *
 * 与飞书/钉钉的 OAuth 扫码不同:企微「可使用权限」授权发生在企微客户端,
 * 用户复制 MCP URL/JSON Config 粘贴回来;apikey 服务端加密落库,7 天到期需重新粘贴。
 * 这里只做引导 + 粘贴入口 + 状态展示,不接触 apikey 明文回显。
 */
export function WecomRobotSection() {
  const t = useTranslations('connectors')
  const [status, setStatus] = useState<RobotStatus | null>(null)
  const [config, setConfig] = useState('')
  const [busy, setBusy] = useState(false)
  const [tools, setTools] = useState<string[]>([])
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    const r = await getWecomRobotStatus()
    if (r.success && r.data) setStatus(r.data)
    else setError(r.error || 'status failed')
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const submit = async () => {
    if (!config.trim()) return
    setBusy(true)
    setError('')
    try {
      const r = await authorizeWecomRobot(config.trim())
      if (r.success && r.data) {
        setStatus(r.data)
        setConfig('')
      } else {
        setError(r.error || 'authorize failed')
      }
    } finally {
      setBusy(false)
    }
  }

  const showTools = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await listWecomRobotTools()
      if (r.success && r.data) setTools(r.data.tools.map((x) => x.name))
      else setError(r.error || 'tools failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-2.5 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 h-4 w-4 text-primary" />
        <div className="flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <p className="text-body font-semibold">{t('wecomRobotTitle')}</p>
            {status?.authorized ? (
              <Badge variant="success">{t('wecomRobotAuthorized')}</Badge>
            ) : status?.expired ? (
              <Badge variant="danger">{t('wecomRobotExpired')}</Badge>
            ) : null}
          </div>
          <p className="text-label text-muted-foreground">{t('wecomRobotHint')}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void refresh()} aria-label="refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-col gap-2 min-[720px]:flex-row">
        <Input
          value={config}
          onChange={(e) => setConfig(e.target.value)}
          placeholder={t('wecomRobotPastePlaceholder')}
          aria-label={t('wecomRobotPasteLabel')}
          className="min-w-0 flex-1"
        />
        <Button variant="outline" size="sm" onClick={() => void submit()} disabled={busy || !config.trim()}>
          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {t('wecomRobotSubmit')}
        </Button>
        {status?.authorized ? (
          <Button variant="outline" size="sm" onClick={() => void showTools()} disabled={busy}>
            {t('wecomRobotTools')}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
      {tools.length ? (
        <p className="text-[11px] text-muted-foreground">{tools.join(' · ')}</p>
      ) : null}
    </section>
  )
}
