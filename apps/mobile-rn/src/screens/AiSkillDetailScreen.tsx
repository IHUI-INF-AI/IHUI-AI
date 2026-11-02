// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform, Share } from 'react-native'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { File, Paths } from 'expo-file-system'
import {
  exportAiSkill,
  getAiSkill,
  getAiSkillRatings,
  invokeAiSkill,
  rateAiSkill,
  type AiSkillMeta,
  type RatingStats,
} from '@ihui/api-client'
import {
  AiSkillDetailScreen as SharedAiSkillDetailScreen,
  type AiSkillDetailData,
  type SkillInvokeResult,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { appAlert } from '../components/BottomPops'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type RouteProps = RouteProp<RootStackParamList, 'AiSkillDetail'>

/** HTML 结果暂不引入 WebView(等待 T0-5 人工闸门),按原文展示并附一句提示 */
const HTML_RESULT_HINT = 'HTML 结果暂以原文展示（富文本渲染待确认）'

/** AiSkillMeta(API)→ 共享层 AiSkillDetailData 映射 */
function toData(skill: AiSkillMeta): AiSkillDetailData {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    category: skill.category,
    tags: skill.tags,
    promptTemplate: skill.promptTemplate,
    source: skill.source,
    sourceUrl: skill.sourceUrl || null,
  }
}

/**
 * AI 技能详情(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑已下沉共享层 @ihui/rn-app SharedAiSkillDetailScreen。
 * 本 wrapper 保留平台特定职责:
 * - 数据:getAiSkill / 评分列表 getAiSkillRatings + 重试
 * - P1-3a invoke:invokeAiSkill(仅 text/json;html 按原文 + 提示,不引 WebView)
 * - P1-3b export:exportAiSkill → expo-file-system 写 JSON → 分享(无 expo-sharing 时 iOS 用
 *   RN 内置 Share.share({url}),Android 明确降级提示)
 * - P1-3c rate:rateAiSkill({rating,comment});未登录不渲染评分表单
 * - 导航:goBack;顶部标题沿用路由参数 name;主题色 / i18n 注入
 */
export function AiSkillDetailScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProps>()
  const [skill, setSkill] = useState<AiSkillMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [variables, setVariables] = useState<Record<string, string>>({})
  const [invoking, setInvoking] = useState(false)
  const [invokeError, setInvokeError] = useState('')
  const [invokeResult, setInvokeResult] = useState<SkillInvokeResult | undefined>()

  const [exporting, setExporting] = useState(false)

  const [ratingStats, setRatingStats] = useState<RatingStats | null>(null)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [ratingError, setRatingError] = useState('')
  const ratingPending = useRef(false)

  const loggedIn = !!user

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await getAiSkill(route.params.id)
      if (!res.success) throw new Error()
      setSkill(res.data)
    } catch {
      setError(t('aiSkillDetail.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [route.params.id, t])

  useEffect(() => {
    void load()
  }, [load])

  // 切换技能时清空调用/评分本地态
  useEffect(() => {
    setVariables({})
    setInvokeResult(undefined)
    setInvokeError('')
    setRatingSubmitted(false)
    setRatingError('')
  }, [route.params.id])

  const loadRatings = useCallback(async () => {
    try {
      const res = await getAiSkillRatings(route.params.id)
      if (res.success && res.data?.stats) setRatingStats(res.data.stats)
    } catch {
      // 评分列表是附加信息,失败不影响详情主流程
    }
  }, [route.params.id])

  useEffect(() => {
    void loadRatings()
  }, [loadRatings])

  /** P1-3a:变量按 skill 定义提交;ok=false 落错误态,结果只按 text/json 渲染 */
  const handleInvoke = useCallback(async () => {
    if (!skill || invoking) return
    setInvoking(true)
    setInvokeError('')
    setInvokeResult(undefined)
    try {
      const res = await invokeAiSkill(skill.id, { variables })
      if (!res.success) {
        setInvokeError(res.error || t('aiSkillDetail.invokeFailed'))
        return
      }
      const data = res.data
      if (!data.ok) {
        setInvokeError(data.error || data.guidance || t('aiSkillDetail.invokeFailed'))
        return
      }
      if (data.contentType === 'json') {
        try {
          setInvokeResult({ kind: 'json', json: JSON.parse(data.content) })
        } catch {
          // 非法 JSON 按纯文本展示,不抛错
          setInvokeResult({ kind: 'text', text: data.content })
        }
        return
      }
      const text =
        data.contentType === 'html'
          ? `${data.content}\n\n${HTML_RESULT_HINT}`
          : data.content || data.guidance
      setInvokeResult({ kind: 'text', text })
    } catch {
      setInvokeError(t('aiSkillDetail.invokeFailed'))
    } finally {
      setInvoking(false)
    }
  }, [invoking, skill, t, variables])

  /** P1-3b:exportAiSkill → 落盘 → 分享(无 expo-sharing,按平台降级) */
  const handleExport = useCallback(async () => {
    if (!skill || exporting) return
    setExporting(true)
    try {
      const res = await exportAiSkill(skill.id)
      if (!res.success) {
        appAlert(t('aiSkillDetail.exportFailed'), res.error || t('aiSkillDetail.exportFailed'))
        return
      }
      const safeId = skill.id.replace(/[^\w.-]/g, '_')
      const file = new File(Paths.cache, `${safeId}.json`)
      file.write(JSON.stringify(res.data, null, 2))
      if (Platform.OS === 'ios') {
        await Share.share({ url: file.uri, title: `${safeId}.json` })
      } else {
        // Android 内置 Share 不支持 file url(无 expo-sharing),明确降级并给出落盘路径
        appAlert(t('aiSkillDetail.exportBlocked'), file.uri)
      }
    } catch {
      appAlert(t('aiSkillDetail.exportFailed'))
    } finally {
      setExporting(false)
    }
  }, [exporting, skill, t])

  /** P1-3c:提交体严格 {rating, comment};1-5 越界直接拒绝 */
  const handleRate = useCallback(
    async (rating: number, comment?: string) => {
      if (!skill || ratingPending.current) return
      if (rating < 1 || rating > 5) return
      ratingPending.current = true
      setRatingError('')
      try {
        const res = await rateAiSkill(skill.id, rating, comment?.trim() || undefined)
        if (!res.success) {
          setRatingError(res.error || t('aiSkillDetail.ratingFailed'))
          return
        }
        setRatingSubmitted(true)
        void loadRatings()
      } catch {
        setRatingError(t('aiSkillDetail.ratingFailed'))
      } finally {
        ratingPending.current = false
      }
    },
    [loadRatings, skill, t],
  )

  return (
    <SharedAiSkillDetailScreen
      t={t}
      title={route.params.name}
      skill={skill ? toData(skill) : null}
      loading={loading}
      error={error}
      onRetry={() => {
        setLoading(true)
        void load()
      }}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
      variables={variables}
      onVariableChange={(key, value) => setVariables((prev) => ({ ...prev, [key]: value }))}
      onInvoke={loggedIn && skill?.available ? handleInvoke : undefined}
      invoking={invoking}
      invokeError={invokeError || undefined}
      invokeResult={invokeResult}
      onExport={skill ? handleExport : undefined}
      exporting={exporting}
      onRate={loggedIn ? handleRate : undefined}
      ratingStats={ratingStats ?? undefined}
      ratingSubmitted={ratingSubmitted}
      ratingError={ratingError || undefined}
      ratingLoginHint={loggedIn ? undefined : t('aiSkillDetail.ratingLoginHint')}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
