// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Eye, Target, Sparkles, ShieldOff, Code2, Brain, Loader2 } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent, Switch } from '@ihui/ui-react'
import { BackButton } from '@/components/common'
import { Container } from '@/components/layout'
import { fetchApi } from '@/lib/api'

interface PrivacyPrefs {
  dataVisible: boolean
  adTracking: boolean
  personalizedRecommendation: boolean
  /**
   * 2026-10-03 数据出域合规整改新增的三个开关。
   *
   * 这三个与上面三个是**不同性质**的东西:上面三个管的是"资料可见性 / 广告 /
   * 推荐",与数据是否离开本机无关;这三个管的正是"内容会不会发出去、会不会留存"。
   * 整改前本页只有前者,于是"隐私设置"这个标题下没有任何一个开关能真正阻止
   * 数据出域 —— 用户找不到出口,只能选择相信平台(参照 2026-09 智谱 ZCode 事件:
   * 道歉之后紧急上线的正是这种开关)。
   *
   * 默认值全部为"保留/开启"(false = 不阻止),与后端现状一致 —— 这样开关上线
   * 不会让任何人的行为突然改变;但三项都摆在明面上,用户可以逐项关掉。
   */
  /** 不落 LLM 调用原文(提问与回答正文不写入数据库)。后端已就绪,写入即不留。 */
  llmRawRetentionOptOut: boolean
  /** 不建代码语义索引(代码切片不外发做向量化)。后端已就绪,未授权时懒索引也不触发。 */
  codeIndexEgressOptOut: boolean
  /** 不自动写入长期记忆(不把对话提炼成跨会话偏好/约定)。 */
  autoMemoryOptOut: boolean
}

export default function PrivacyPage() {
  const t = useTranslations('settings')
  const tc = useTranslations('common')
  const [prefs, setPrefs] = React.useState<PrivacyPrefs>({
    dataVisible: true,
    adTracking: false,
    personalizedRecommendation: true,
    llmRawRetentionOptOut: false,
    codeIndexEgressOptOut: false,
    autoMemoryOptOut: false,
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetchApi<{ settings: Record<string, string> }>('/settings/privacy')
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          const s = res.data.settings
          setPrefs({
            dataVisible: s.dataVisible !== 'false',
            adTracking: s.adTracking === 'true',
            personalizedRecommendation: s.personalizedRecommendation !== 'false',
            // 三个新开关:键缺失(= 用户从未改过)一律按 false「未阻止」,
            // 与后端默认行为一致。不给「没设置」编第三种默认语义 ——
            // 那种三态在 UI 上无法呈现,只会让开关的当前状态不可预期。
            llmRawRetentionOptOut: s.llmRawRetentionOptOut === 'true',
            codeIndexEgressOptOut: s.codeIndexEgressOptOut === 'true',
            autoMemoryOptOut: s.autoMemoryOptOut === 'true',
          })
        } else {
          setError(t('privacyLoadFailed'))
        }
      })
      .catch(() => {
        if (cancelled) return
        setError(t('privacyLoadFailed'))
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

  const update = async (key: keyof PrivacyPrefs, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
    try {
      const res = await fetchApi('/settings/privacy', {
        method: 'PUT',
        body: JSON.stringify({ [key]: String(value) }),
      })
      if (res.success) {
        setToast({ type: 'success', msg: t('privacySaveSuccess') })
      } else {
        setToast({ type: 'error', msg: t('privacySaveFailed') })
      }
    } catch {
      setToast({ type: 'error', msg: t('privacySaveFailed') })
    }
  }

  const items = [
    {
      icon: Eye,
      title: t('dataVisibility'),
      desc: t('dataVisibilityDesc'),
      key: 'dataVisible' as const,
    },
    {
      icon: Target,
      title: t('adTracking'),
      desc: t('adTrackingDesc'),
      key: 'adTracking' as const,
    },
    {
      icon: Sparkles,
      title: t('personalizedRecommendation'),
      desc: t('personalizedRecommendationDesc'),
      key: 'personalizedRecommendation' as const,
    },
    // ── 以下三项:数据出域与留存(2026-10-03 数据出域合规整改)──────────────
    // 放在最后并各自带一句"会发生什么"的白话描述,而不是只给开关名:
    // 用户要能据此判断"关掉它我会失去什么",否则这只是一排没有语义的 toggle。
    {
      icon: ShieldOff,
      title: t('llmRawRetentionOptOut'),
      desc: t('llmRawRetentionOptOutDesc'),
      key: 'llmRawRetentionOptOut' as const,
    },
    {
      icon: Code2,
      title: t('codeIndexEgressOptOut'),
      desc: t('codeIndexEgressOptOutDesc'),
      key: 'codeIndexEgressOptOut' as const,
    },
    {
      icon: Brain,
      title: t('autoMemoryOptOut'),
      desc: t('autoMemoryOptOutDesc'),
      key: 'autoMemoryOptOut' as const,
    },
  ]

  return (
    <Container maxWidth="full" padding={false} className="px-4 flex h-full flex-col py-4">
      <BackButton />
      <div className="shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">{t('privacyTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('privacyDesc')}</p>
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
          items.map((item) => {
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
                      checked={prefs[item.key]}
                      onCheckedChange={(v) => update(item.key, v)}
                      className="shrink-0"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })
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
