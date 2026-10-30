// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 直播详情页的两个附加区块 —— 对齐 RN 共享屏
// packages/app/src/features/live-detail/LiveDetailScreen.tsx 的 introSection / chatSection。
// 拆到同目录子模块只为守住「单页 < 250 行」;门会读同目录 `./` 模块里的文案键。
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { get, post } from '@/api'
import { useI18n } from '@/i18n'
import { getToken } from '@/utils/auth'
import { EmptyState } from '@/components/ScreenStates.taro'
import { FocusInput } from '@/components/FocusField'
import { formatTimeOnly } from '@/utils/time'

/** 直播间消息行:后端 GET/POST `/live/:id/messages` 投影(与 /ws/live-chat 同表同口径) */
interface LiveChatRow {
  id: string
  nickname: string
  content: string
  createdAt: string
}

/** 直播介绍区(对齐 RN introSection:标题 + 正文,空正文落 '—') */
export function LiveIntro({ intro }: { intro?: string | null }) {
  const { t } = useI18n()
  return (
    <View className="px-[20rpx] pb-[16rpx]">
      <Text className="block text-[length:30rpx] font-semibold text-foreground mb-[16rpx]">
        {t('liveDetail.intro')}
      </Text>
      <Text className="block text-[length:28rpx] text-[var(--color-text-medium)]">
        {intro || '—'}
      </Text>
    </View>
  )
}

/**
 * 互动区(对齐 RN chatSection + inputRow)。
 *
 * 数据腿:小程序端走既有的移动端聊天端点 `/live/:id/messages`(GET 最近 50 条历史、
 * POST 发送,数据源 live_comment 与 `/ws/live-chat` 同一张表 —— 见
 * apps/api/src/routes/mobile-chat-routes.ts 头注)。实时广播归 WS 面,本区块不新开第二条真相。
 */
export function LiveChat({ liveId }: { liveId: string | number }) {
  const { t } = useI18n()
  const channelId = Number.parseInt(String(liveId), 10)
  const chatable = Number.isFinite(channelId)
  const [messages, setMessages] = useState<LiveChatRow[]>([])
  const [input, setInput] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    // 游客不发这一枪:/live/:id/messages 是登录态端点,空凭据请求只会换回一次 401(§鉴权面)
    if (!chatable || !getToken()) {
      setLoaded(true)
      return
    }
    let cancelled = false
    get<LiveChatRow[]>(`/live/${channelId}/messages`)
      .then((rows) => {
        if (!cancelled) setMessages(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        // 历史拉取失败只留空态:发送腿独立可用,不在此处二次弹提示
      })
      .finally(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [chatable, channelId])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || sending || !chatable) return
    if (!getToken()) {
      Taro.showToast({ title: t('chat.loginToSend'), icon: 'none' })
      return
    }
    setSending(true)
    try {
      const row = await post<LiveChatRow>(`/live/${channelId}/messages`, { content: text })
      setMessages((prev) => [...prev, row])
      setInput('')
    } catch {
      Taro.showToast({ title: t('liveChat.sendFailed'), icon: 'none' })
    } finally {
      setSending(false)
    }
  }, [input, sending, chatable, channelId, t])

  const disabled = !input.trim() || sending

  return (
    <View className="px-[20rpx] pb-[24rpx]">
      <Text className="block text-[length:30rpx] font-semibold text-foreground mb-[16rpx]">
        {t('liveDetail.chat')}
      </Text>
      {messages.length === 0 ? (
        <EmptyState title={loaded ? t('liveDetail.chatEmpty') : t('common.loading')} />
      ) : (
        <ScrollView scrollY className="h-[420rpx] rounded-xl bg-[var(--color-muted)] p-[16rpx]">
          {messages.map((m) => (
            <View key={m.id} className="mb-[16rpx] p-[16rpx] rounded-xl bg-[var(--color-card)]">
              <View className="flex items-center justify-between gap-[16rpx]">
                <Text className="flex-1 ihui-ellipsis text-[length:22rpx] text-muted-foreground">
                  {m.nickname}
                </Text>
                <Text className="text-[length:22rpx] text-[var(--color-text-tertiary)]">
                  {formatTimeOnly(m.createdAt)}
                </Text>
              </View>
              <Text className="block mt-[8rpx] text-[length:28rpx] text-foreground">
                {m.content}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
      <View className="flex items-center gap-[16rpx] mt-[16rpx]">
        <FocusInput
          className="flex-1 h-[72rpx] px-[16rpx] rounded-md bg-[var(--color-muted)] text-[length:28rpx] text-foreground"
          value={input}
          placeholder={t('liveDetail.chatPlaceholder')}
          confirmType="send"
          onInput={(e) => setInput(e.detail.value)}
          onConfirm={() => {
            void send()
          }}
        />
        <View
          className={`px-[24rpx] h-[72rpx] rounded-md flex items-center justify-center bg-primary ${
            disabled ? 'opacity-50' : ''
          }`}
          onClick={() => {
            void send()
          }}
          hoverClass="opacity-60"
        >
          <Text className="text-[length:28rpx] font-semibold text-[var(--color-primary-foreground)]">
            {t('liveDetail.chatSend')}
          </Text>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
