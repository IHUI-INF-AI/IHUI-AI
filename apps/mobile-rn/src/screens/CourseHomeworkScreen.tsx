// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  CourseHomeworkScreen as SharedCourseHomeworkScreen,
  type CourseHomeworkItem,
  type CourseHomeworkScreenProps,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type Route = RouteProp<RootStackParamList, 'CourseHomework'>
type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * `learn_homework` 表的裸行(只声明本屏要用的列)。
 * 端点实测见 packages/types/src/learn-homework.ts 头注:没有 `deadline` / `endTime` /
 * 按人的 `submitted`,只有 `dueDate` 与作业自身的 `status`(draft / published)。
 */
interface HomeworkRawRow {
  id?: string
  title?: string | null
  description?: string | null
  dueDate?: string | null
  status?: string | null
}

/** `GET /api/learn/:id/homework` 实回 `success({ list, total })` */
interface HomeworkListPayload {
  list?: HomeworkRawRow[] | null
  total?: number
}

function toItem(raw: HomeworkRawRow): CourseHomeworkItem {
  return {
    id: String(raw.id ?? ''),
    title: raw.title ?? '',
    // 后端没有的字段一律留空:不拿 title 冒充 description,也不编造截止时间
    description: raw.description ?? null,
    dueDate: raw.dueDate ?? null,
    status: raw.status ?? null,
    // 列表不带按人的提交态 ⇒ 交给本会话的提交结果为真值,首帧就是「未知」
    submitted: undefined,
  }
}

/**
 * 课程作业屏 —— RN 宿主壳,对齐 web `/learn/[id]/homework`。
 *
 * ⚠️ 与 `LearnReviewScreen`(SRS 间隔重复复习,`/api/srs-review/*`)**不是同一物**,
 * 数据源与交互都不同,不复用。
 *
 * 取数 / 提交 / 导航在此,渲染全在共享屏 `@ihui/rn-app` 的 CourseHomeworkScreen。
 * 提交 body 必须是 `{ url }`(后端 edu-frontend-routes.ts:100 的 submitHomeworkSchema
 * 要求 1..3000 字符;web 侧裸发 POST 恒 400),所以作答区是显式链接输入。
 */
export function CourseHomeworkScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const route = useRoute<Route>()
  const navigation = useNavigation<NavigationProp>()
  const { id } = route.params

  const [items, setItems] = useState<CourseHomeworkItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [answerUrl, setAnswerUrl] = useState('')
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState('')
  /** 本会话内提交成功的作业 id —— 列表接口不返回提交态,这是唯一可靠的真值来源 */
  const [submittedIds, setSubmittedIds] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchApi<HomeworkListPayload>(
        `/api/learn/${encodeURIComponent(id)}/homework`,
      )
      if (!res.success) {
        setItems([])
        setError(apiFailureToText(res, t('learnHomework.loadFailed')))
        return
      }
      const rows = Array.isArray(res.data?.list) ? res.data?.list : []
      setItems(rows.map(toItem))
    } catch {
      setItems([])
      setError(t('learnHomework.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  /** 点卡片 = 展开/收起作答区;收起与切走都清掉上一题的草稿与错误,避免串题提交 */
  const onSelect = useCallback((hwId: string) => {
    setSelectedId((prev) => (prev === hwId ? null : hwId))
    setAnswerUrl('')
    setSubmitError('')
  }, [])

  const onChangeAnswer = useCallback((text: string) => {
    setAnswerUrl(text)
    setSubmitError('')
  }, [])

  const onSubmit = useCallback(
    async (hwId: string) => {
      const url = answerUrl.trim()
      if (!url) {
        setSubmitError(t('learnHomework.urlRequired'))
        return
      }
      setSubmittingId(hwId)
      setSubmitError('')
      try {
        const res = await fetchApi<unknown>(
          `/api/learn/${encodeURIComponent(id)}/homework/${encodeURIComponent(hwId)}/submit`,
          { method: 'POST', body: JSON.stringify({ url }) },
        )
        if (!res.success) {
          setSubmitError(apiFailureToText(res, t('learnHomework.submitFailed')))
          return
        }
        setSubmittedIds((prev) => (prev.includes(hwId) ? prev : [...prev, hwId]))
        setSelectedId(null)
        setAnswerUrl('')
      } catch {
        setSubmitError(t('learnHomework.submitFailed'))
      } finally {
        setSubmittingId(null)
      }
    },
    [answerUrl, id, t],
  )

  /** 提交态叠加:接口真值未知,但本会话提交成功的那些确实是「已提交」 */
  const viewItems = useMemo<CourseHomeworkItem[]>(
    () =>
      items.map((item) => (submittedIds.includes(item.id) ? { ...item, submitted: true } : item)),
    [items, submittedIds],
  )

  const sharedProps: CourseHomeworkScreenProps = {
    t,
    items: viewItems,
    loading,
    error,
    selectedId,
    answerUrl,
    submittingId,
    submitError,
    onSelect,
    onChangeAnswer,
    onSubmit: (hwId) => void onSubmit(hwId),
    onBack: () => navigation.goBack(),
    onRetry: () => void load(),
    colorScheme: resolvedTheme,
  }

  return <SharedCourseHomeworkScreen {...sharedProps} />
}
