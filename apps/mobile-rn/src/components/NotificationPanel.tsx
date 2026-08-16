import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Pressable,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useEffect, useRef } from 'react'
import { rnLightTokens as tokens } from '@ihui/design-tokens'
import { useNotificationStore } from '../stores/notification'
import { formatShortDateTime } from '../utils/date-utils'

/**
 * 通知面板(mobile-rn 端)。
 *
 * 对齐历史项目 components/PushNotification/index.vue 的两种形态:
 * - NotificationPanel(默认导出):通知中心列表面板,从 notificationStore 读取,
 *   支持全部已读 / 清空 / 关闭。原 Uniapp 顶层挂载,RN 端由 RootNavigator 全局挂载。
 * - PushBanner(具名导出):顶部横幅推送通知,对齐原 index.vue 的单条横幅形态
 *   (title/content/相对时间/点击跳转/关闭/自动关闭 5 秒)。
 *   原版通过 uni.$on('showPushNotification') 全局事件触发,RN 端改为 props 驱动,
 *   由调用方在收到 WS 通知时控制(见 RootNavigator useNotificationWebSocket)。
 */
export default function NotificationPanel() {
  const { notifications, visible, markAllRead, setVisible, clearAll } = useNotificationStore()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => setVisible(false)}
    >
      <TouchableOpacity
        className="flex-1 bg-black/20 justify-end"
        activeOpacity={1}
        onPress={() => setVisible(false)}
      >
        <TouchableOpacity
          className="bg-white max-h-[70%] min-h-[40%]"
          style={{ borderTopLeftRadius: 10, borderTopRightRadius: 10 }}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
            <Text className="text-[15px] font-semibold text-gray-900">通知</Text>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                className="px-2.5 py-1 rounded-md border border-gray-200"
                onPress={markAllRead}
              >
                <Text className="text-xs text-gray-700">全部已读</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="px-2.5 py-1 rounded-md border border-gray-200"
                onPress={clearAll}
              >
                <Text className="text-xs text-gray-700">清空</Text>
              </TouchableOpacity>
              <TouchableOpacity className="px-2 py-0.5" onPress={() => setVisible(false)}>
                <Text className="text-[20px] text-gray-500 leading-[22px]">×</Text>
              </TouchableOpacity>
            </View>
          </View>
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className={`px-3 py-2.5 rounded-lg mb-1 ${!item.isRead ? 'bg-gray-100' : ''}`}>
                <Text className="text-[13px] font-medium text-gray-900 mb-0.5">{item.title}</Text>
                {item.content ? (
                  <Text className="text-xs text-gray-500 mb-1">{item.content}</Text>
                ) : null}
                <Text className="text-[11px] text-gray-400">
                  {formatShortDateTime(item.createdAt)}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text className="py-10 text-center text-gray-400 text-[13px]">暂无通知</Text>
            }
            contentContainerStyle={{ padding: 8 }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* PushBanner:顶部横幅推送通知(对齐原 PushNotification/index.vue 单条横幅)     */
/* -------------------------------------------------------------------------- */

export interface PushBannerProps {
  visible: boolean
  /** 标题,默认「新消息」(对齐原 show() 的 options.title 缺省值) */
  title?: string
  /** 正文内容 */
  content?: string
  /** 通知时间戳(ms),用于相对时间显示 */
  timestamp?: number
  /** 自动关闭时长(ms),默认 5000;<=0 时不自动关闭(对齐原 duration 参数) */
  duration?: number
  /** 顶部偏移量(适配状态栏/导航栏),默认 0,由调用方传入 */
  topOffset?: number
  /** 点击横幅回调(对齐原 clickCallback) */
  onClick?: () => void
  /** 关闭回调(对齐原 handleClose) */
  onClose?: () => void
}

/** 相对时间格式化(对齐原 index.vue formatTime computed) */
function formatPushTime(timestamp?: number): string {
  if (!timestamp) return ''
  const diff = Date.now() - timestamp
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  const t = new Date(timestamp)
  const month = t.getMonth() + 1
  const day = t.getDate()
  const hour = t.getHours().toString().padStart(2, '0')
  const minute = t.getMinutes().toString().padStart(2, '0')
  return `${month}-${day} ${hour}:${minute}`
}

export function PushBanner({
  visible,
  title = '新消息',
  content = '',
  timestamp,
  duration = 5000,
  topOffset = 0,
  onClick,
  onClose,
}: PushBannerProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!visible || duration <= 0) return
    timerRef.current = setTimeout(() => onClose?.(), duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [visible, duration, onClose])

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.bannerWrap, { paddingTop: topOffset }]} pointerEvents="box-none">
        <Pressable
          style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
          onPress={() => {
            onClick?.()
            onClose?.()
          }}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          <View style={styles.header}>
            <View style={styles.icon}>
              <Text style={styles.iconText}>🔔</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
              {formatPushTime(timestamp) ? (
                <Text style={styles.time}>{formatPushTime(timestamp)}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation()
                onClose?.()
              }}
              hitSlop={8}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="关闭"
            >
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          {content ? (
            <View style={styles.body}>
              <Text style={styles.message} numberOfLines={2}>
                {content}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
  } as ViewStyle,
  card: {
    backgroundColor: tokens.surface.light,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  } as ViewStyle,
  pressed: { opacity: 0.92 } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  } as ViewStyle,
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  } as ViewStyle,
  iconText: { fontSize: 16 } as TextStyle,
  info: { flex: 1, minWidth: 0 } as ViewStyle,
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: tokens.text.primary,
    marginBottom: 2,
  } as TextStyle,
  time: { fontSize: 12, color: tokens.text.secondary } as TextStyle,
  close: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: tokens.surface.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  } as ViewStyle,
  closeText: { fontSize: 14, color: tokens.text.tertiary } as TextStyle,
  body: { paddingLeft: 40 } as ViewStyle,
  message: {
    fontSize: 14,
    color: tokens.text.medium,
    lineHeight: 20,
  } as TextStyle,
})
