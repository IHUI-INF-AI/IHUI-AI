// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  Eye,
  Target,
  Sparkles,
  ShieldOff,
  Code2,
  Brain,
  ChartNoAxesColumn,
  Loader2,
} from 'lucide-react'

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
  /**
   * 2026-10-03 新增:部署方全局 env `IHUI_AUTO_MEMORY` 的只读镜像。
   *
   * 为什么需要它:该 env **不是** `NEXT_PUBLIC_` 前缀,不会下发到浏览器。部署方设了
   * `IHUI_AUTO_MEMORY=0` 之后,本页原来仍显示"自动记忆 开启",而 ai-service
   * **实际不提取** —— 界面与事实相反。后端那侧的口径在
   * `apps/ai-service/app/services/auto_memory_optout.py`(判定链第 4 档读它)。
   *
   * 缺省 `true`(= 部署方没关 = 整改前行为):读不到就当没关,而不是当关了 ——
   * 否则端点一抖动,界面会凭空显示成"用户已关闭记忆"。
   *
   * ⚠ 它**不是**用户偏好,不要落库、也不要当 opt-out 用:它是"全局是否强制关闭"
   * 这一格,只能参与下面的合取。
   */
  autoMemoryGloballyEnabled: boolean
  /**
   * 使用情况分析(埋点)。
   *
   * 极性与上面三项**相反**:上面三项是"opt-out 语义"(true = 阻止某事),
   * 这一项是 **opt-in 语义**(true = 允许埋点),与浏览器 Do Not Track 之外的
   * 应用内偏好对齐。读取端在 `apps/web/src/hooks/use-analytics.ts:79`:
   * `res.data?.settings?.analyticsEnabled !== 'false'` ⇒ 只有显式 'false' 才关。
   *
   * 缺省(键不存在)= true = 保持整改前的现状行为(埋点照常上报),不静默改变行为。
   */
  analyticsEnabled: boolean
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
    // 缺省 true = 部署方没关(整改前行为);端点返回前界面不会渲染,不会闪出假状态。
    autoMemoryGloballyEnabled: true,
    analyticsEnabled: true,
  })
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  React.useEffect(() => {
    let cancelled = false
    // 两个 GET 并行:per-user 偏好 + 部署方全局 env 镜像(只读一个布尔)。
    //
    // 用 allSettled 而不是 all:env 镜像端点是**后加的**,它不可用时不该把用户的
    // 隐私偏好一起吞掉(all 会让整个 then 跳过 ⇒ 整页报"加载失败")。
    void Promise.allSettled([
      fetchApi<{ settings: Record<string, string> }>('/settings/privacy'),
      fetchApi<{ autoMemoryGloballyEnabled?: boolean }>('/settings/runtime-flags'),
    ]).then(([prefsSettled, flagsSettled]) => {
        if (cancelled) return
        // 全局闸只在"端点明确回 false"时才关。
        //
        // 判据是 `!( ... === false)` 这个整体取反,而不是 `=== false`:
        // 请求 reject / 端点不存在(部署方还没升级 api)/ success=false / 字段缺失
        // —— 这些都归入"没关"。写成 `=== false` 会把一次接口抖动显示成
        // "用户已关闭记忆",方向与后端 `auto_memory_optout` 的"读不到按现状
        // 行为(开启)放行"相反。隐私页尤其不能错:错的方向会让用户以为
        // 记忆已关、实际还在提取。
        const flagsOff =
          flagsSettled.status === 'fulfilled' &&
          flagsSettled.value?.success === true &&
          flagsSettled.value.data?.autoMemoryGloballyEnabled === false
        const globalEnabled = !flagsOff
        const prefsRes = prefsSettled.status === 'fulfilled' ? prefsSettled.value : undefined
        if (prefsRes?.success) {
          const s = prefsRes.data.settings
          setPrefs({
            dataVisible: s.dataVisible !== 'false',
            adTracking: s.adTracking === 'true',
            personalizedRecommendation: s.personalizedRecommendation !== 'false',
            // 三个新开关:键缺失(= 用户从未改过)一律按 false「未阻止」,
            // 与后端默认行为一致。不给「没设置」编第三种默认语义 ——
            // 那种三态在 UI 上无法呈现,只会让开关的当前状态不可预期。
            llmRawRetentionOptOut: s.llmRawRetentionOptOut === 'true',
            codeIndexEgressOptOut: s.codeIndexEgressOptOut === 'true',
            // ⚠ 极性:这一项是 **opt-out**(true = 已关闭),而全局闸是"是否开启"。
            //    所以合取在这里是 **OR**,不是 AND ——
            //    "记忆当前是关的" = 用户关了 **或** 部署方全局关了。
            //    写成 `s.autoMemoryOptOut === 'true' && globalEnabled` 会得到
            //    "部署方关了 ⇒ 显示未关闭",与事实相反(与本项极性相同的一批
            //    开关都只需原样透传,唯独这一项要参与合取,故在此显式留注释)。
            autoMemoryOptOut: s.autoMemoryOptOut === 'true' || !globalEnabled,
            // opt-in 语义:只有显式 'false' 才关(与 use-analytics.ts 的判定一致)。
            // 写成 `!== 'false'` 而不是 `=== 'true'` —— 后者会让"键存在但值缺失"
            // 变成关闭,与读取端的判定逻辑不一致,开关会显示成与实际相反的状态。
            analyticsEnabled: s.analyticsEnabled !== 'false',
            autoMemoryGloballyEnabled: globalEnabled,
          })
        } else {
          setError(t('privacyLoadFailed'))
        }
        setLoading(false)
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
    // 全局闸关闭时,`autoMemoryOptOut` 这一项**不可写**(界面也已置灰)。
    // 若仍写进去,用户拨成"允许记忆"会落库 'false',而后端因全局闸仍不提取 ——
    // 用户明明亲手开了,界面却不再亮,比"开关是灰的"更难解释。
    // 这里直接忽略并把界面复位到"关"(全局闸下记忆确实是关的)。
    if (key === 'autoMemoryOptOut' && !prefs.autoMemoryGloballyEnabled) {
      setPrefs((prev) => ({ ...prev, autoMemoryOptOut: true }))
      return
    }
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
      // 部署方用 `IHUI_AUTO_MEMORY=0` 全局关闭时置灰:让用户看见"记忆当前是关的",
      // 但不让他拨回开启(拨了后端也不提取,界面会亮着骗人)。见 update() 里的注释。
      disabled: !prefs.autoMemoryGloballyEnabled,
    },
    {
      // ⚠ opt-in 语义(与上面三项相反):true = 允许上报,不是"阻止"。
      // 同一份 items 数组里混着两种极性很容易在后续维护中被"统一"成同一个方向,
      // 故在此显式留注释,写时务必确认 value 传出去是不是符合本项的极性。
      icon: ChartNoAxesColumn,
      title: t('analyticsEnabled'),
      desc: t('analyticsEnabledDesc'),
      key: 'analyticsEnabled' as const,
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
                      disabled={'disabled' in item ? item.disabled : false}
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
