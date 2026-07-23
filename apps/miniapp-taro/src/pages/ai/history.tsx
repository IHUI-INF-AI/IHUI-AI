import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useI18n } from '@/i18n'
import './history.css'

interface HistoryItem {
  id: string
  title: string
  time: string
  messages: Array<{ content: string }>
}

const HISTORY_KEY = 'ai_chat_history'

export default function HistoryPage() {
  const { t } = useI18n()
  const [list, setList] = useState<HistoryItem[]>([])

  const load = useCallback(() => {
    try {
      const raw = Taro.getStorageSync(HISTORY_KEY)
      setList(Array.isArray(raw) ? raw : [])
    } catch {
      setList([])
    }
  }, [])

  const goChat = useCallback((h?: HistoryItem) => {
    Taro.navigateTo({ url: `/pages/ai/chat${h ? `?sessionId=${h.id}` : ''}` })
  }, [])

  const onDeleteOne = useCallback(
    (h: HistoryItem) => {
      Taro.showModal({
        title: t('ai.historyPage.deleteOne'),
        content: h.title || h.id,
        confirmText: t('common.confirm'),
        cancelText: t('common.cancel'),
        success: (res) => {
          if (!res.confirm) return
          setList((prev) => {
            const next = prev.filter((x) => x.id !== h.id)
            Taro.setStorageSync(HISTORY_KEY, next)
            return next
          })
          Taro.showToast({ title: t('success.deleted'), icon: 'none' })
        },
      })
    },
    [t],
  )

  const onClearAll = useCallback(() => {
    if (list.length === 0) return
    Taro.showModal({
      title: t('ai.historyPage.clearAll'),
      content: t('ai.historyPage.clearConfirm'),
      confirmText: t('common.confirm'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (!res.confirm) return
        Taro.setStorageSync(HISTORY_KEY, [])
        setList([])
        Taro.showToast({ title: t('ai.historyPage.cleared'), icon: 'none' })
      },
    })
  }, [list.length, t])

  useDidShow(load)

  return (
    <View className="page">
      {list.length ? (
        <View className="list">
          {list.map((h) => (
            <View
              key={h.id}
              className="item"
              onClick={() => goChat(h)}
              onLongPress={() => onDeleteOne(h)}
            >
              <View className="item-body">
                <Text className="title">{h.title}</Text>
                <Text className="preview">
                  {h.messages?.[h.messages.length - 1]?.content || t('ai.historyPage.empty')}
                </Text>
                <Text className="time">{h.time}</Text>
              </View>
            </View>
          ))}
          <Button
            className="w-full mt-[32rpx] bg-[#ef4444] text-white text-[28rpx] h-[80rpx] leading-[80rpx] rounded-[8rpx]"
            onClick={onClearAll}
          >
            {t('ai.historyPage.clearAll')}
          </Button>
        </View>
      ) : (
        <View className="empty">
          <Text>{t('ai.historyPage.empty')}</Text>
          <Button className="btn" onClick={() => goChat()}>
            {t('ai.agentDetail.startChat')}
          </Button>
        </View>
      )}
    </View>
  )
}
