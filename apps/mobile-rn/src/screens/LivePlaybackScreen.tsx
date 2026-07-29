import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getLiveList, type Live } from '@ihui/api-client'
import {
  LivePlaybackScreen as SharedLivePlaybackScreen,
  type LivePlaybackScreenItem,
} from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'
import { formatDateByTemplate } from '../utils/date-utils'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 计算直播时长文本:start~end 的分钟数(<60m 显示 Nm,≥60m 显示 Nh Mm) */
function durationText(start: string, end: string | null): string {
  if (!end) return '—'
  try {
    const ms = new Date(end).getTime() - new Date(start).getTime()
    const mins = Math.max(0, Math.round(ms / 60000))
    if (mins < 60) return `${mins}m`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
  } catch {
    return '—'
  }
}

/** 把后端 Live 映射为共享层 LivePlaybackScreenItem(已格式化时间/时长) */
function mapLive(l: Live): LivePlaybackScreenItem {
  return {
    id: l.id,
    title: l.title,
    lecturerName: l.lecturerName ?? undefined,
    startTimeText: formatDateByTemplate(l.startTime, 'YYYY-MM-DD HH:mm') || '—',
    durationText: durationText(l.startTime, l.endTime),
    viewCount: l.viewCount,
    playUrl: l.playUrl,
  }
}

export function LivePlaybackScreen() {
  const { t } = useI18n()
  const { user } = useAuth()
  const navigation = useNavigation<NavigationProp>()
  const [lives, setLives] = useState<Live[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState<Live | null>(null)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      setError('')
      const res = await getLiveList({ pageSize: 30 })
      if (res.success) {
        // 仅展示已结束的直播(isLive=false 且 endTime 已过)
        const now = Date.now()
        const ended = (res.data.list ?? []).filter((l) => {
          if (l.isLive) return false
          if (l.endTime) return new Date(l.endTime).getTime() < now
          return true
        })
        setLives(ended)
      } else {
        setError(res.error || t('livePlayback.loadFailed'))
      }
      setLoading(false)
      setRefreshing(false)
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const items = useMemo(() => lives.map(mapLive), [lives])
  const activeItem = useMemo(() => (active ? mapLive(active) : null), [active])
  const userName = user?.nickname ?? user?.username ?? ''

  return (
    <SharedLivePlaybackScreen
      t={t}
      items={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      activeItem={activeItem}
      userName={userName}
      onRefresh={() => load(true)}
      onPressItem={(item) => {
        const target = lives.find((l) => l.id === item.id)
        if (target) setActive(target)
      }}
      onClosePlayer={() => setActive(null)}
      onBack={() => navigation.goBack()}
    />
  )
}
