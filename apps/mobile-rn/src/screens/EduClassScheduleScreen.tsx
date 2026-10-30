// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getEduSchedule, type EduScheduleItem } from '@ihui/api-client'
import {
  EduClassScheduleScreen as SharedEduClassScheduleScreen,
  type EduScheduleDayView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'eduSchedulePage'

/** weekday 语义 0=周一(后端 apps/api/src/routes/edu-frontend-routes.ts:493 `(getDay()+6)%7`) */
const WEEKDAY_KEYS = [
  'eduSchedule.weekday.mon',
  'eduSchedule.weekday.tue',
  'eduSchedule.weekday.wed',
  'eduSchedule.weekday.thu',
  'eduSchedule.weekday.fri',
  'eduSchedule.weekday.sat',
  'eduSchedule.weekday.sun',
] as const

/** 与 web 同式:JS getDay() 0=周日 → 折算成 0=周一(apps/web/app/(main)/edu/schedule/page.tsx:56-57) */
function todayIndex(): number {
  const day = new Date().getDay()
  return day === 0 ? 6 : day - 1
}

function toItemView(item: EduScheduleItem) {
  return {
    id: item.id,
    title: item.title,
    // web 直拼 `${startTime}-${endTime}`(page.tsx:113);考试报名项 endTime 为空串,
    // 直拼会留一个尾随 '-' —— 这里收成单点时间,不复制该瑕疵。
    timeText: item.endTime ? `${item.startTime}-${item.endTime}` : item.startTime,
    instructorText: item.instructor || '-',
    locationText: item.location ?? null,
    kind: item.type,
  }
}

/**
 * RN 端「我的课程表」薄壳 —— 承载 web /edu/schedule。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/edu/schedule(契约 apps/api/src/routes/edu-frontend-routes.ts:461-543,
 * 信封 success({ list, total }),插件级 preHandler 强制登录 :140-142)、
 * 按 weekday(0=周一)分组、weekday 取词(复用同域既有 eduSchedule.weekday.* 五语值)、
 * 「今天」定位(web page.tsx:56-57 同式)、登录门(web useAuthGate 同口径,未登录不发注定 401 的请求)。
 * 口径差:web 七列并排周视图 → RN 按天纵向分节,同一份分组数据。
 */
export function EduClassScheduleScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [items, setItems] = useState<EduScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await getEduSchedule()
      if (!res.success || !res.data) {
        setError(t('common.loadFailed'))
        return
      }
      setItems(res.data.list ?? [])
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [user, t])

  useEffect(() => {
    void load()
  }, [load])

  const days: EduScheduleDayView[] = useMemo(() => {
    const today = todayIndex()
    return WEEKDAY_KEYS.map((key, index) => ({
      key,
      label: t(key),
      isToday: index === today,
      items: items
        .filter((item) => item.weekday === index)
        // web 同序:同一天按 startTime 字典序(page.tsx:52)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
        .map(toItemView),
    }))
  }, [items, t])

  return (
    <SharedEduClassScheduleScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      days={days}
      onRetry={() => void load()}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
