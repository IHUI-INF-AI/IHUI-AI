'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Users, Loader2, LogOut } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'

interface Session {
  sessionId: string
  device: string
  ip: string
  location: string
  lastActive: string
  isCurrent?: boolean
}

/**
 * 会话管理：在线会话列表，可主动结束其他会话。
 */
export function SessionManager() {
  const t = useTranslations('settings')
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [loading, setLoading] = React.useState(true)
  const [ending, setEnding] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/sessions')
      const json = (await res.json()) as { code: number; data?: Session[] }
      if (json.code === 0 && json.data) setSessions(json.data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleEnd = async (sessionId: string) => {
    setEnding(sessionId)
    try {
      await fetch(`/api/user/sessions/${sessionId}`, { method: 'DELETE' })
      setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId))
    } finally {
      setEnding(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          {t('session.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('session.empty')}</p>
        ) : (
          sessions.map((s) => (
            <div key={s.sessionId} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="break-words">{s.device}</span>
                  {s.isCurrent && (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">
                      {t('session.current')}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="font-mono">{s.ip}</span>
                  <span>{s.location}</span>
                  <span>{s.lastActive}</span>
                </div>
              </div>
              {!s.isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={ending === s.sessionId}
                  onClick={() => handleEnd(s.sessionId)}
                >
                  {ending === s.sessionId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="mr-1 h-4 w-4" />
                      {t('session.end')}
                    </>
                  )}
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
