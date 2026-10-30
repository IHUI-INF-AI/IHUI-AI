// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, updateChatSettings } from '@ihui/api-client'
import { FALLBACK_MODELS } from '@ihui/shared'
import {
  ChatSettingsScreen as SharedChatSettingsScreen,
  type ChatModelOptionView,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'chatSettingsPage'

/** GET /api/v2/user/llm-providers 响应中本屏消费的字段子集(web helpers-v2 ProviderListData 同源形态) */
interface V2ProviderLite {
  models?: Array<{ modelId?: string; displayName?: string | null; enabled?: boolean }>
}

/** 表单形态与 web page.tsx:23-28 ChatSettings 同构(字符串值,提交时 Number 化) */
interface ChatSettingsForm {
  model: string
  temperature: string
  maxTokens: string
  systemPrompt: string
}

/**
 * RN 端「聊天设置」薄壳 —— 承载 web /chat/settings。渲染委托共享屏,本文件只管:
 * 模型下拉数据 = GET /api/v2/user/llm-providers 取 groups→providers→models(filter enabled,
 * web useConfiguredModels 同语义;失败/空 → 降级 FALLBACK_MODELS,chat settings page.tsx:45 同式),
 * web 同型 quirk 亦保留:初值取 FALLBACK 首项 useState 一次求值,后端列表稍后返回只换 options
 * 不回写 form.model(web select / RN chip 列同呈"未选中",不擅动加同步),
 * 校验照抄 web submit(temperature 0-2、maxTokens 1-32768 前端口径,严于后端 2_000_000 上限),
 * 提交 PUT /api/chat/settings(contract endpoints/chat-settings.ts 现读注释),
 * systemPrompt 空串 → undefined = 后端不修改旧值(web page.tsx:72 同式),
 * 登录门:未登录不发注定 401 的模型查询(web useAuthGate 同口径)。
 */
export function ChatSettingsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [models, setModels] = useState<ChatModelOptionView[]>(() =>
    FALLBACK_MODELS.map((f) => ({ value: f.value, label: f.label })),
  )
  const [form, setForm] = useState<ChatSettingsForm>({
    model: FALLBACK_MODELS[0]?.value ?? '',
    temperature: '0.7',
    maxTokens: '2048',
    systemPrompt: '',
  })
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    let alive = true
    void (async () => {
      try {
        const res = await fetchApi<{ groups?: { providers?: V2ProviderLite[] }[] }>(
          '/api/v2/user/llm-providers',
        )
        if (!alive || !res.success || !res.data) return
        const configured = (res.data.groups ?? [])
          .flatMap((g) => g.providers ?? [])
          .flatMap((p) => (p.models ?? []).filter((m) => m.enabled).map((m) => ({
            value: m.modelId ?? '',
            label: m.displayName ?? m.modelId ?? '',
          })))
          .filter((o) => o.value !== '')
        // 空/无数据保持 FALLBACK(web useConfiguredModels 同式,chat settings page.tsx:40-47)
        if (configured.length > 0) setModels(configured)
      } catch {
        // 静默:保持 FALLBACK_MODELS 降级(与 web query 失败行为一致)
      }
    })()
    return () => {
      alive = false
    }
  }, [user])

  const onField = useCallback(
    (field: 'model' | 'temperature' | 'maxTokens' | 'systemPrompt', value: string) => {
      setForm((f) => ({ ...f, [field]: value }))
    },
    [],
  )

  const submit = useCallback(async () => {
    setErr(null)
    const temp = Number(form.temperature)
    const maxT = Number(form.maxTokens)
    if (Number.isNaN(temp) || temp < 0 || temp > 2) {
      setErr(t(`${NS}.errorTempRange`))
      return
    }
    if (Number.isNaN(maxT) || maxT < 1 || maxT > 32768) {
      setErr(t(`${NS}.errorMaxTokensRange`))
      return
    }
    setSaving(true)
    try {
      const res = await updateChatSettings({
        model: form.model,
        // Number(x) || 0.7 / || 2048:照抄 web page.tsx:70-71 兜底式(校验已拦 NaN,保留同式不擅改)
        temperature: Number(form.temperature) || 0.7,
        maxTokens: Number(form.maxTokens) || 2048,
        systemPrompt: form.systemPrompt.trim() || undefined,
      })
      if (!res.success) {
        setErr(res.error ?? t(`${NS}.saveFailed`))
        return
      }
      // web = toast(t('saved')) + push('/chat');RN 统一替代物 appAlert(BottomPops,禁原生弹窗),
      // 确认即返回(本端 chat 域入口是导航来路,goBack 等价 web 回跳),口径差见共享屏头注。
      appAlert(t(`${NS}.saved`), undefined, [
        { text: t('common.ok'), onPress: () => navigation.goBack() },
      ])
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : t(`${NS}.saveFailed`))
    } finally {
      setSaving(false)
    }
  }, [form.model, form.temperature, form.maxTokens, form.systemPrompt, t, navigation])

  return (
    <SharedChatSettingsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      models={models}
      model={form.model}
      temperature={form.temperature}
      maxTokens={form.maxTokens}
      systemPrompt={form.systemPrompt}
      onField={onField}
      error={err}
      saving={saving}
      onSubmit={() => void submit()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
