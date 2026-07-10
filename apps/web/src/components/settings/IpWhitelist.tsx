'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Shield, Plus, Trash2, Loader2 } from 'lucide-react'
import { z } from 'zod'

import { Card, CardHeader, CardTitle, CardContent, Button, Input } from '@ihui/ui'

const ipSchema = z.string().ip()

/**
 * IP 白名单：列表 + 添加 + 删除，仅白名单内 IP 可登录。
 */
export function IpWhitelist() {
  const t = useTranslations('settings')
  const [ips, setIps] = React.useState<string[]>([])
  const [newIp, setNewIp] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [adding, setAdding] = React.useState(false)
  const [removing, setRemoving] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/ip-whitelist')
      const json = (await res.json()) as { code: number; data?: string[] }
      if (json.code === 0 && json.data) setIps(json.data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleAdd = async () => {
    setError(null)
    const parsed = ipSchema.safeParse(newIp.trim())
    if (!parsed.success) {
      setError(t('ip.invalid'))
      return
    }
    if (ips.includes(parsed.data)) {
      setError(t('ip.exists'))
      return
    }
    setAdding(true)
    try {
      const res = await fetch('/api/user/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: parsed.data }),
      })
      const json = (await res.json()) as { code: number }
      if (json.code === 0) {
        setIps((prev) => [...prev, parsed.data])
        setNewIp('')
      }
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (ip: string) => {
    setRemoving(ip)
    try {
      await fetch(`/api/user/ip-whitelist?ip=${encodeURIComponent(ip)}`, { method: 'DELETE' })
      setIps((prev) => prev.filter((x) => x !== ip))
    } finally {
      setRemoving(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          {t('ip.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={t('ip.placeholder')}
            value={newIp}
            onChange={(e) => setNewIp(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button type="button" disabled={adding} onClick={handleAdd} className="shrink-0">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ips.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t('ip.empty')}</p>
        ) : (
          <div className="space-y-1.5">
            {ips.map((ip) => (
              <div key={ip} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <code className="font-mono">{ip}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removing === ip}
                  onClick={() => handleRemove(ip)}
                >
                  {removing === ip ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 text-destructive" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
