// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { ShieldCheck, ShieldAlert, Gavel, ScanSearch, History, Loader2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Switch, Button } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'

type GuardPolicy = 'flag' | 'sanitize' | 'refuse'
type ExecPolicyMode = 'enforce' | 'audit' | 'off'

interface AgentSecurityConfig {
  prompt_guard_enabled: boolean
  prompt_guard_policy: GuardPolicy
  exec_policy_mode: ExecPolicyMode
  input_scan_enabled: boolean
  pipeline_record_enabled: boolean
}

export default function AgentSecurityPage() {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const [config, setConfig] = React.useState<AgentSecurityConfig>({
    prompt_guard_enabled: true,
    prompt_guard_policy: 'flag',
    exec_policy_mode: 'enforce',
    input_scan_enabled: true,
    pipeline_record_enabled: false,
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchApi<AgentSecurityConfig>('/agent/security-config')
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setConfig(res.data)
        } else {
          setError(t('agentSecurityLoadFailed'))
        }
      })
      .catch(() => {
        if (cancelled) return
        setError(t('agentSecurityLoadFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [t])

  React.useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const persist = async (
    key: keyof AgentSecurityConfig,
    value: boolean | GuardPolicy | ExecPolicyMode,
  ) => {
    const prev = config
    setConfig((c) => ({ ...c, [key]: value }))
    try {
      const res = await fetchApi('/agent/security-config', {
        method: 'PUT',
        body: JSON.stringify({ [key]: value }),
      })
      if (res.success) {
        setToast({ type: 'success', msg: t('agentSecuritySaveSuccess') })
      } else {
        setConfig((c) => ({ ...c, [key]: prev[key] }))
        setToast({ type: 'error', msg: t('agentSecuritySaveFailed') })
      }
    } catch {
      setConfig((c) => ({ ...c, [key]: prev[key] }))
      setToast({ type: 'error', msg: t('agentSecuritySaveFailed') })
    }
  }

  const switchItems = [
    {
      icon: ShieldCheck,
      title: t('agentSecurityPromptGuard'),
      desc: t('agentSecurityPromptGuardDesc'),
      key: 'prompt_guard_enabled' as const,
    },
    {
      icon: ScanSearch,
      title: t('agentSecurityInputScan'),
      desc: t('agentSecurityInputScanDesc'),
      key: 'input_scan_enabled' as const,
    },
    {
      icon: History,
      title: t('agentSecurityPipelineRecord'),
      desc: t('agentSecurityPipelineRecordDesc'),
      key: 'pipeline_record_enabled' as const,
    },
  ]

  const optionRows = [
    {
      icon: ShieldAlert,
      title: t('agentSecurityPolicy'),
      key: 'prompt_guard_policy' as const,
      options: [
        { value: 'flag' as const, label: t('agentSecurityPolicyFlag') },
        { value: 'sanitize' as const, label: t('agentSecurityPolicySanitize') },
        { value: 'refuse' as const, label: t('agentSecurityPolicyRefuse') },
      ],
    },
    {
      icon: Gavel,
      title: t('agentSecurityExecPolicy'),
      desc: t('agentSecurityExecPolicyDesc'),
      key: 'exec_policy_mode' as const,
      options: [
        { value: 'enforce' as const, label: t('agentSecurityExecEnforce') },
        { value: 'audit' as const, label: t('agentSecurityExecAudit') },
        { value: 'off' as const, label: t('agentSecurityExecOff') },
      ],
    },
  ]

  return (
    <Container maxWidth="full" padding={false} className="px-4 flex h-full flex-col py-4">
      <BackButton />
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('agentSecurityTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('agentSecurityDesc')}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {tc('loading')}
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{error}</p>
        ) : (
          <>
            {switchItems.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.key}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4" />
                      {item.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                        {item.desc}
                      </span>
                      <Switch
                        checked={config[item.key]}
                        onCheckedChange={(v) => persist(item.key, v)}
                        className="shrink-0"
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {optionRows.map((row) => {
              const Icon = row.icon
              return (
                <Card key={row.key}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-4 w-4" />
                      {row.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 text-sm text-muted-foreground">
                        {row.desc}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        {row.options.map((opt) => (
                          <Button
                            key={opt.value}
                            size="sm"
                            variant={config[row.key] === opt.value ? 'default' : 'outline'}
                            onClick={() => persist(row.key, opt.value)}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </>
        )}

        {toast && (
          <div
            className={`fixed right-4 top-4 z-modal rounded-md px-4 py-2 text-sm text-white shadow-lg ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </Container>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
