// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { apiFailureToText } from '@ihui/shared/utils'
import {
  LiveLecturerListScreen as SharedLecturerListScreen,
  type LiveLecturerListItem,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * `GET /api/live/lecturers` 的裸行(`live_lecturers` 表列,只声明本屏用到的)。
 * 见 apps/api/src/db/live-queries.ts:264-286(findLecturers 直接回表行,无投影)。
 */
interface LiveLecturerRow {
  id?: string | number
  name?: string | null
  avatar?: string | null
  title?: string | null
  intro?: string | null
  sort?: number | null
  status?: number | null
}

/**
 * 端点回包:`success({ list, total, page, pageSize })`(live.ts:251-259)。
 * 只认 `{ list }` 一种形态会被"后端哪天直出数组"打成空屏,故 toList 同时收裸数组;
 * 其余字段(total/page/pageSize)本屏不分页,不声明 —— 声明了也只有死字段。
 */
interface LecturersPayload {
  list?: LiveLecturerRow[] | null
}

/** 表行 → 屏行。名字为空的行走不到(表列 notNull),仍按 '' 兜底不崩 */
function toListItem(raw: LiveLecturerRow): LiveLecturerListItem {
  return {
    id: String(raw.id ?? ''),
    name: raw.name ?? '',
    avatar: raw.avatar ?? null,
    title: raw.title ?? null,
    intro: raw.intro ?? null,
    sort: typeof raw.sort === 'number' ? raw.sort : undefined,
    status: typeof raw.status === 'number' ? raw.status : undefined,
  }
}

/** 防御性归一:`{ list }` / 裸数组 / null 都收,过滤掉没有 id 的脏行(列表 key 依赖它) */
function toList(
  data: LecturersPayload | LiveLecturerRow[] | null | undefined,
): LiveLecturerListItem[] {
  const rows = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : []
  return rows.map(toListItem).filter((item) => item.id.length > 0)
}

/**
 * 直播讲师列表 —— RN 宿主壳,对齐 web `/lecturers`。
 * 取数 + 导航在此,渲染全在共享屏 `@ihui/rn-app` 的 LiveLecturerListScreen。
 *
 * ⚠️ 与 `TeacherListScreen`(教师域 `/teacher/list`)不是同一物:本屏是**直播讲师**域,
 * 端点 /api/live/lecturers,点卡进 LecturerProfile(不是 TeacherDetail)。
 */
export function LecturerListScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [items, setItems] = useState<LiveLecturerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<LecturersPayload>('/api/live/lecturers')
      if (!res.success) {
        setError(apiFailureToText(res, t('common.loadFailed')))
        return
      }
      setItems(toList(res.data))
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <SharedLecturerListScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onSelect={(item) => navigation.navigate('LecturerProfile', { id: item.id })}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
