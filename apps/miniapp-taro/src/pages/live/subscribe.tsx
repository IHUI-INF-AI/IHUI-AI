import { logger } from '@/utils/logger'
import { View, Text, Image, Switch } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getLiveList, type Live } from '@/api'
import { del } from '@/utils/request'
import { useI18n } from '@/i18n'
import './subscribe.css'

const REMINDER_KEY = 'live_reminder_enabled'

const STATUS_BADGE: Record<Live['status'], string> = {
  upcoming: 'sub-badge-upcoming',
  living: 'sub-badge-living',
  ended: 'sub-badge-ended',
}

const STATUS_LABEL: Record<Live['status'], { key: string; fb: string }> = {
  upcoming: { key: 'live.calendar.upcoming', fb: '即将开始' },
  living: { key: 'live.liveNow', fb: '进行中' },
  ended: { key: 'live.ended', fb: '已结束' },
}

export default function LiveSubscribe() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

  const [list, setList] = useState<Live[]>([])
  const [loading, setLoading] = useState(false)
  const [reminder, setReminder] = useState<boolean>(
    Taro.getStorageSync(REMINDER_KEY) === 'true',
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getLiveList({ status: 'upcoming' })
      setList(res.list || [])
    } catch (e) {
      logger.error('live/subscribe', '获取订阅列表', e)
      Taro.showToast({
        title: tt('live.subscribe.loadFailed', '订阅操作失败'),
        icon: 'none',
      })
    } finally {
      setLoading(false)
    }
  }, [tt])

  useDidShow(() => {
    load()
  })

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const onUnsubscribe = useCallback(
    async (id: string | number) => {
      try {
        await del(`/live/${id}/unsubscribe`)
        setList((prev) => prev.filter((l) => l.id !== id))
        Taro.showToast({
          title: tt('live.subscribe.unsubscribed', '已取消订阅'),
          icon: 'success',
        })
      } catch (e) {
        logger.error('live/subscribe', '取消订阅', e)
      }
    },
    [tt],
  )

  const toggleReminder = (val: boolean) => {
    setReminder(val)
    Taro.setStorageSync(REMINDER_KEY, String(val))
    Taro.showToast({
      title: tt('live.subscribe.reminderSaved', '设置已保存'),
      icon: 'success',
    })
  }

  const goDetail = (id: string | number) =>
    Taro.navigateTo({ url: `/pages/live/detail?id=${id}` })

  const goDiscover = () => Taro.navigateTo({ url: '/pages/live/list' })

  const statusText = (s: Live['status']) =>
    tt(STATUS_LABEL[s].key, STATUS_LABEL[s].fb)

  return (
    <View className="sub-page">
      <View className="sub-stat">
        <Text>{tt('live.subscribe.count', '已订阅')}</Text>
        <Text className="sub-stat-num">{list.length}</Text>
        <Text>{tt('live.subscribe.unit', '场')}</Text>
      </View>

      <View className="sub-reminder">
        <View>
          <Text className="sub-reminder-label">
            {tt('live.subscribe.reminder', '开播前提醒')}
          </Text>
          <Text className="sub-reminder-desc">
            {tt('live.subscribe.reminderDesc', '订阅直播开播前 10 分钟通知')}
          </Text>
        </View>
        <Switch checked={reminder} onChange={(e) => toggleReminder(e.detail.value)} />
      </View>

      {list.length > 0 ? (
        <View className="sub-list">
          {list.map((l) => (
            <View key={l.id} className="sub-card">
              <Image
                className="sub-card-cover"
                src={l.coverUrl}
                mode="aspectFill"
                onClick={() => goDetail(l.id)}
              />
              <View className="sub-card-body" onClick={() => goDetail(l.id)}>
                <Text className="sub-card-title">{l.title}</Text>
                {l.anchor && <Text className="sub-card-meta">{l.anchor}</Text>}
                {l.startTime && (
                  <Text className="sub-card-meta">{l.startTime}</Text>
                )}
                <View className="sub-card-bottom">
                  <Text className={`sub-badge ${STATUS_BADGE[l.status]}`}>
                    {statusText(l.status)}
                  </Text>
                  <Text
                    className="sub-cancel-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onUnsubscribe(l.id)
                    }}
                  >
                    {tt('live.subscribe.unsubscribe', '取消订阅')}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="sub-empty">
          <Text className="sub-empty-text">
            {tt('live.subscribe.empty', '暂无订阅')}
          </Text>
          <Text className="sub-discover-btn" onClick={goDiscover}>
            {tt('live.subscribe.discover', '去发现直播')}
          </Text>
        </View>
      )}

      {loading && (
        <View className="sub-loading">
          <Text>{tt('common.loading', '加载中…')}</Text>
        </View>
      )}
    </View>
  )
}
