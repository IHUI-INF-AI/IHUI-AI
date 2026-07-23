import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getLiveCalendar, subscribeLive, type Live } from '@/api'
import { useI18n } from '@/i18n'
import './calendar.css'

type LiveStatus = Live['status']

interface StatusCfg {
  labelKey: string
  labelFb: string
  actionKey: string
  actionFb: string
  badge: string
  actionCls: string
}

const STATUS_CFG: Record<LiveStatus, StatusCfg> = {
  upcoming: {
    labelKey: 'live.calendar.upcoming',
    labelFb: '即将开始',
    actionKey: 'live.subscribe.subscribe',
    actionFb: '订阅提醒',
    badge: 'cal-badge-upcoming',
    actionCls: 'cal-action-upcoming',
  },
  living: {
    labelKey: 'live.liveNow',
    labelFb: '进行中',
    actionKey: 'live.calendar.watchNow',
    actionFb: '立即观看',
    badge: 'cal-badge-living',
    actionCls: 'cal-action-living',
  },
  ended: {
    labelKey: 'live.ended',
    labelFb: '已结束',
    actionKey: 'live.replay',
    actionFb: '回放',
    badge: 'cal-badge-ended',
    actionCls: 'cal-action-ended',
  },
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmtMonth = (y: number, m: number) => `${y}-${pad(m + 1)}`
const fmtDate = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

const WEEK_FALLBACK = ['日', '一', '二', '三', '四', '五', '六']

export default function LiveCalendar() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selected, setSelected] = useState(
    fmtDate(today.getFullYear(), today.getMonth(), today.getDate()),
  )
  const [groups, setGroups] = useState<Array<{ date: string; lives: Live[] }>>([])

  const liveMap = useMemo(() => {
    const m = new Map<string, Live[]>()
    groups.forEach((g) => m.set(g.date, g.lives))
    return m
  }, [groups])

  const monthTotal = useMemo(
    () => groups.reduce((n, g) => n + g.lives.length, 0),
    [groups],
  )

  const load = useCallback(
    async (y: number, m: number) => {
      try {
        const res = await getLiveCalendar({ month: fmtMonth(y, m) })
        setGroups(res.list || [])
      } catch (e) {
        logger.error('live/calendar', '获取直播日历', e)
        Taro.showToast({
          title: tt('live.calendar.loadFailed', '日历加载失败'),
          icon: 'none',
        })
      }
    },
    [tt],
  )

  useDidShow(() => {
    load(year, month)
  })

  const shift = (delta: number) => {
    let y = year
    let m = month + delta
    if (m < 0) {
      m = 11
      y--
    } else if (m > 11) {
      m = 0
      y++
    }
    setYear(y)
    setMonth(m)
    load(y, m)
  }

  const goToday = () => {
    const d = new Date()
    setYear(d.getFullYear())
    setMonth(d.getMonth())
    setSelected(fmtDate(d.getFullYear(), d.getMonth(), d.getDate()))
    load(d.getFullYear(), d.getMonth())
  }

  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const selectedLives = liveMap.get(selected) || []
  const goDetail = (id: string | number) =>
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })

  const onAction = (live: Live) => {
    if (live.status === 'upcoming') {
      subscribeLive(live.id)
        .then(() =>
          Taro.showToast({
            title: tt('live.subscribe.subscribeSuccess', '订阅成功'),
            icon: 'success',
          }),
        )
        .catch((e) => logger.error('live/calendar', '订阅直播', e))
    } else {
      goDetail(live.id)
    }
  }

  const weekLabels = WEEK_FALLBACK.map((w, i) => tt(`live.calendar.w${i}`, w))

  return (
    <View className="cal-page">
      <View className="cal-header">
        <View className="cal-nav">
          <Text className="cal-nav-btn" onClick={() => shift(-1)}>
            {tt('live.calendar.prevMonth', '‹')}
          </Text>
          <Text className="cal-title">
            {year}
            {tt('live.calendar.year', '年')}
            {month + 1}
            {tt('live.calendar.month', '月')}
          </Text>
          <Text className="cal-nav-btn" onClick={() => shift(1)}>
            {tt('live.calendar.nextMonth', '›')}
          </Text>
        </View>
        <Text className="cal-today-btn" onClick={goToday}>
          {tt('live.calendar.today', '今天')}
        </Text>
      </View>
      <View className="cal-stat">
        <Text>{tt('live.calendar.monthStat', '本月')}</Text>
        <Text className="cal-stat-num">{monthTotal}</Text>
        <Text>{tt('live.calendar.sessions', '场直播')}</Text>
      </View>
      <View className="cal-week">
        {weekLabels.map((w, i) => (
          <Text key={i} className="cal-week-cell">
            {w}
          </Text>
        ))}
      </View>
      <View className="cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <View key={i} className="cal-cell-empty" />
          const ds = fmtDate(year, month, d)
          const has = liveMap.has(ds)
          const active = ds === selected
          return (
            <View
              key={i}
              className={`cal-cell${active ? ' cal-cell-active' : ''}`}
              onClick={() => setSelected(ds)}
            >
              <Text className="cal-cell-num">{d}</Text>
              {has && <View className="cal-dot" />}
            </View>
          )
        })}
      </View>
      <Text className="cal-section-title">
        {selected} {tt('live.calendar.liveList', '直播安排')}
      </Text>
      {selectedLives.length > 0 ? (
        selectedLives.map((live) => {
          const cfg = STATUS_CFG[live.status]
          return (
            <View key={live.id} className="cal-card">
              <Image className="cal-card-cover" src={live.coverUrl} mode="aspectFill" />
              <View className="cal-card-row">
                <Text className="cal-card-title">{live.title}</Text>
                <Text className={`cal-badge ${cfg.badge}`}>
                  {tt(cfg.labelKey, cfg.labelFb)}
                </Text>
              </View>
              <View className="cal-card-meta">
                {live.anchor && (
                  <Text>
                    {tt('live.calendar.anchor', '主播')}: {live.anchor}
                  </Text>
                )}
                {live.startTime && <Text>{live.startTime}</Text>}
              </View>
              <Text
                className={`cal-action ${cfg.actionCls}`}
                onClick={() => onAction(live)}
              >
                {tt(cfg.actionKey, cfg.actionFb)}
              </Text>
            </View>
          )
        })
      ) : (
        <View className="cal-empty">
          <Text>{tt('live.calendar.noLive', '当日暂无直播安排')}</Text>
        </View>
      )}
    </View>
  )
}
