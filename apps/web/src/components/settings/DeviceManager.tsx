'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Monitor, Smartphone, Laptop, LogOut, Loader2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Button } from '@ihui/ui'

interface LoginDevice {
  deviceId: string
  deviceName: string
  loginTime: string
  lastActiveTime: string
  isCurrent?: boolean
}

/**
 * 设备管理：展示当前账号登录设备列表，可踢其他设备下线。
 */
export function DeviceManager() {
  const t = useTranslations('settings')
  const [devices, setDevices] = React.useState<LoginDevice[]>([])
  const [loading, setLoading] = React.useState(true)
  const [removing, setRemoving] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/user/devices')
      const json = (await res.json()) as { code: number; data?: LoginDevice[] }
      if (json.code === 0 && json.data) setDevices(json.data)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleRemove = async (deviceId: string) => {
    setRemoving(deviceId)
    try {
      await fetch(`/api/user/devices/${deviceId}`, { method: 'DELETE' })
      setDevices((prev) => prev.filter((d) => d.deviceId !== deviceId))
    } finally {
      setRemoving(null)
    }
  }

  const iconFor = (name: string) => {
    if (/iPhone|Android|手机/i.test(name)) return Smartphone
    if (/Windows|Mac|桌面/i.test(name)) return Monitor
    return Laptop
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor className="h-4 w-4" />
          {t('device.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('device.empty')}</p>
        ) : (
          devices.map((d) => {
            const Icon = iconFor(d.deviceName)
            return (
              <div key={d.deviceId} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span className="break-words">{d.deviceName}</span>
                    {d.isCurrent && (
                      <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs text-emerald-600">
                        {t('device.current')}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex gap-3 text-xs text-muted-foreground">
                    <span>
                      {t('device.loginTime')}: {d.loginTime}
                    </span>
                    <span>
                      {t('device.lastActive')}: {d.lastActiveTime}
                    </span>
                  </div>
                </div>
                {!d.isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={removing === d.deviceId}
                    onClick={() => handleRemove(d.deviceId)}
                  >
                    {removing === d.deviceId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <LogOut className="mr-1 h-4 w-4" />
                        {t('device.remove')}
                      </>
                    )}
                  </Button>
                )}
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
