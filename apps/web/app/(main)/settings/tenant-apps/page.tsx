// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { Building2, Loader2, RefreshCw } from 'lucide-react'
import { BackButton } from '@/components/common'
import { Alert, confirmDialog } from '@/components/feedback'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@ihui/ui-react'
import { fetchApi, type ApiFailure } from '@/lib/api'
import TenantAppCard from './TenantAppCard'
import { PLATFORM_META, type TenantApp } from './types'

const RESERVED_SUBDOMAINS = ['www', 'api', 'admin', 'file', 'bsm', 'ai']

/** 把后端失败结果转成带状态码的 Error,供错误文案按 401/403/404 分型。 */
function failureFromResult(
  res: { success: false; error?: string; status?: number },
  fallback: string,
): ApiFailure {
  const err = new Error(res.error || fallback) as ApiFailure
  err.status = res.status
  return err
}

/** 按 HTTP 状态码给出明确的无权限/失败文案;其余透传后端 message。 */
function describeFailure(err: unknown, fallback: string): string {
  const status = (err as ApiFailure | undefined)?.status
  if (status === 401) return '请先登录后再查看企业应用凭据'
  if (status === 403) return '需要租户管理员权限才能管理企业应用凭据'
  if (status === 404) return '当前租户不存在，或你无权访问该租户的应用凭据'
  return (err as Error).message || fallback
}

function readSubdomain(): string {
  if (typeof window === 'undefined') return ''
  const host = window.location.hostname.split(':')[0] ?? ''
  const parts = host.split('.')
  if (parts.length < 3) return ''
  const first = parts[0]
  if (!first || RESERVED_SUBDOMAINS.includes(first)) return ''
  return first
}

export default function TenantAppsPage() {
  const [tenantKey, setTenantKey] = React.useState('')
  const [apps, setApps] = React.useState<TenantApp[]>([])
  const [secrets, setSecrets] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState('')
  const [message, setMessage] = React.useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  )

  const headers = React.useMemo(
    () => (tenantKey.trim() ? { 'X-Tenant-Id': tenantKey.trim() } : undefined),
    [tenantKey],
  )

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<{ tenantId: string; apps: TenantApp[] }>(
        '/api/tenant-platform-apps/',
        { headers },
      )
      if (!res.success) throw failureFromResult(res, '读取失败')
      if (!res.data) throw new Error('读取失败')
      setApps(res.data.apps)
      setMessage(null)
    } catch (err) {
      setMessage({ type: 'error', text: describeFailure(err, '读取租户应用凭据失败') })
    } finally {
      setLoading(false)
    }
  }, [headers])

  React.useEffect(() => {
    const saved = localStorage.getItem('ihui_tenant_apps_tenant')
    setTenantKey(saved || readSubdomain())
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const saveTenantKey = (value: string): void => {
    setTenantKey(value)
    localStorage.setItem('ihui_tenant_apps_tenant', value)
  }

  const patchApp = (platform: string, patch: Partial<TenantApp>): void => {
    setApps((prev) => prev.map((app) => (app.platform === platform ? { ...app, ...patch } : app)))
  }

  const save = async (app: TenantApp): Promise<void> => {
    setBusy(app.platform)
    setMessage(null)
    try {
      const body: Record<string, unknown> = {
        appId: app.appId,
        enabled: app.enabled,
        extra: app.extra,
      }
      const secretInput = (secrets[app.platform] ?? '').trim()
      if (secretInput) body.appSecret = secretInput
      const res = await fetchApi<TenantApp>(`/api/tenant-platform-apps/${app.platform}`, {
        method: 'PUT',
        body: JSON.stringify(body),
        headers,
      })
      if (!res.success) throw failureFromResult(res, '保存失败')
      setSecrets((prev) => ({ ...prev, [app.platform]: '' }))
      setMessage({
        type: 'success',
        text: `${PLATFORM_META[app.platform]?.label ?? app.platform} 已保存`,
      })
      await load()
    } catch (err) {
      setMessage({ type: 'error', text: describeFailure(err, '保存失败') })
    } finally {
      setBusy('')
    }
  }

  const remove = async (app: TenantApp): Promise<void> => {
    const label = PLATFORM_META[app.platform]?.label ?? app.platform
    if (!(await confirmDialog({ title: `删除 ${label} 的本租户凭据？` }))) return
    setBusy(app.platform)
    try {
      const res = await fetchApi(`/api/tenant-platform-apps/${app.platform}`, {
        method: 'DELETE',
        headers,
      })
      if (!res.success) throw failureFromResult(res, '删除失败')
      await load()
    } catch (err) {
      setMessage({ type: 'error', text: describeFailure(err, '删除失败') })
    } finally {
      setBusy('')
    }
  }

  const importEnv = async (): Promise<void> => {
    setBusy('import')
    try {
      const res = await fetchApi<{ imported: string[]; skipped: string[] }>(
        '/api/tenant-platform-apps/import-env',
        { method: 'POST', body: JSON.stringify({}), headers },
      )
      if (!res.success) throw failureFromResult(res, '导入失败')
      setMessage({
        type: 'success',
        text: `已导入 ${res.data?.imported.length ?? 0} 个平台，跳过 ${res.data?.skipped.length ?? 0} 个`,
      })
      await load()
    } catch (err) {
      setMessage({ type: 'error', text: describeFailure(err, '导入失败') })
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <BackButton />
      <div>
        <h1 className="flex items-center gap-2 text-display font-bold tracking-tight">
          <Building2 className="h-6 w-6 text-primary" aria-hidden="true" />
          <span>企业应用凭据</span>
        </h1>
        <p className="mt-1 text-body text-muted-foreground">
          每个企业客户填写本企业自建的飞书/钉钉/企微/微信应用；密钥只以密文落库，列表只回掩码。
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-body">当前租户</CardTitle>
          <CardDescription>
            访问租户子域名时可留空；本地开发或主域访问时填租户 UUID/slug。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 min-[640px]:flex-row">
          <Input
            value={tenantKey}
            onChange={(e) => saveTenantKey(e.target.value)}
            placeholder="租户 UUID 或 slug，例如 acme"
            aria-label="租户标识"
          />
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>刷新</span>
          </Button>
          <Button variant="outline" onClick={() => void importEnv()} disabled={busy === 'import'}>
            <span>导入现有环境凭据</span>
          </Button>
        </CardContent>
      </Card>

      {message && (
        <Alert
          variant={message.type === 'error' ? 'danger' : 'success'}
          description={message.text}
        />
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-body text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在读取…
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
          {apps.map((app) => {
            const meta = PLATFORM_META[app.platform]
            if (!meta) return null
            return (
              <TenantAppCard
                key={app.platform}
                app={app}
                meta={meta}
                busy={busy === app.platform}
                secret={secrets[app.platform] ?? ''}
                onPatch={(patch) => patchApp(app.platform, patch)}
                onSecretChange={(value) =>
                  setSecrets((prev) => ({ ...prev, [app.platform]: value }))
                }
                onSave={() => void save(app)}
                onRemove={() => void remove(app)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
