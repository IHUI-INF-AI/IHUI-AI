// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 对齐目标(RN 共享屏): packages/app/src/features/notification-settings/NotificationSettingsScreen.tsx
// 批次 5 薄壳:开关组 + 「更多」入口 + 保存条全部由共享屏渲染;本页只留数据编排。
// 两端显式传值且不同:items(小程序=服务端偏好键 / RN=自身固定 5 键)、showHeader(小程序 false / RN true)、
// extraLinks(小程序 3 条小程序可达目标 / RN 1 条 MessageCenter)。
import { useCallback, useMemo, useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { NotificationSettingsScreen as SharedNotificationSettingsScreen } from '@ihui/rn-app/features/notification-settings/NotificationSettingsScreen'
import type { NotificationSettingsLink, NotificationSettingsRow } from '@ihui/types'
import {
  RINGTONE_IDS,
  resolveRingtoneId,
  type RingtoneId,
} from '@ihui/shared/notifications/ringtone'
import {
  getNotificationSettings,
  getNotificationSettingsKv,
  updateNotificationSettings,
  updateNotificationSettingsKv,
} from '@/api'
import ThemeRoot from '@/components/ThemeRoot'
import Switch from '@/components/Switch'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useI18n } from '@/i18n'
import { useAppTheme } from '@/lib/theme'
import { onToast } from '@/host/on-toast'
import { logger } from '@/utils/logger'
import { requestPushSubscription } from '@/utils/push-init'
import {
  previewRingtone,
  readStoredRingtoneId,
  setSoundEnabled,
  writeStoredRingtoneId,
} from '@/lib/notification-ringtone'
import { useChannelLabel } from './notification-channel-label'

/** 8 个铃声的缺词兜底品类名(真实词条走 i18n;这里只防词典缺失时显示 key) */
const RINGTONE_FALLBACK: Record<RingtoneId, string> = {
  dingdong: '门铃叮咚',
  tritone: '上扬三音',
  waterdrop: '水滴',
  doublebell: '清脆双铃',
  bubble: '气泡',
  marimba: '木琴',
  chime: '和弦铃',
  knock: '轻敲',
}

interface NotificationSettingItem {
  key: string
  title: string
  enabled: boolean
}

export default function NotificationPage() {
  const { t } = useI18n()
  const { resolved } = useAppTheme()
  const channelLabel = useChannelLabel()
  const gate = useAuthReadyGate()
  const [list, setList] = useState<NotificationSettingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // XUI-066:加载失败曾只剩一次性 toast,屏内无失败留痕也无法重试。
  const [loadError, setLoadError] = useState('')
  // 通知铃声(2026-11-26):声音开关默认开启;铃声 id 先取本地缓存,进页后以后端 KV 校正。
  const [soundEnabled, setSoundEnabledState] = useState(true)
  const [ringtoneId, setRingtoneId] = useState<RingtoneId>(() => readStoredRingtoneId())
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await getNotificationSettings()
      setList(res.list || [])
    } catch (e) {
      logger.error('setting/notification', '获取通知设置', e)
      setLoadError(tt('common.loadFailed', '加载失败'))
      onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
    } finally {
      setLoading(false)
    }
  }, [tt])

  // 铃声 / 声音开关走复数权威腿 KV(回传原始字符串值);失败回退本地缓存,不打断页面。
  const loadRingtonePrefs = useCallback(async () => {
    try {
      const res = await getNotificationSettingsKv()
      const settings = res.settings ?? {}
      const soundRaw = settings.soundEnabled
      const enabled =
        soundRaw === undefined || soundRaw === null
          ? true
          : String(soundRaw).toLowerCase() !== 'false' && String(soundRaw) !== '0'
      setSoundEnabledState(enabled)
      setSoundEnabled(enabled)
      const resolved = resolveRingtoneId(settings.ringtone)
      setRingtoneId(resolved)
      writeStoredRingtoneId(resolved)
    } catch (e) {
      logger.error('setting/notification', '获取铃声偏好', e)
    }
  }, [])

  // G-933 冷启动抢跑门控:挂载唯一一支 GET /api/settings/notification 需鉴权
  // (apps/api/src/routes/miniapp-compat-routes.ts:2707 handler 内 checkAuth)⇒ 挡到门后。
  useDidShow(() => {
    gate.waitUntilReady(() => {
      void load()
      void loadRingtonePrefs()
    })
  })

  const onToggleSound = useCallback(
    (enabled: boolean) => {
      setSoundEnabledState(enabled)
      setSoundEnabled(enabled)
      updateNotificationSettingsKv({ soundEnabled: enabled }).catch((e) => {
        logger.error('setting/notification', '更新声音开关', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      })
    },
    [tt],
  )

  const onSelectRingtone = useCallback(
    (id: RingtoneId) => {
      setRingtoneId(id)
      writeStoredRingtoneId(id)
      updateNotificationSettingsKv({ ringtone: id }).catch((e) => {
        logger.error('setting/notification', '更新铃声', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      })
    },
    [tt],
  )

  const onPreviewRingtone = useCallback((id: RingtoneId) => {
    previewRingtone(id)
  }, [])

  const items: readonly NotificationSettingsRow[] = useMemo(
    () =>
      list.map((item) => ({
        key: item.key,
        label: channelLabel(item.key, item.title),
        enabled: item.enabled,
      })),
    [channelLabel, list],
  )

  const onToggle = useCallback(
    (key: string, value: boolean) => {
      setList((prev) => prev.map((item) => (item.key === key ? { ...item, enabled: value } : item)))
      updateNotificationSettings({ [key]: value }).catch((e) => {
        logger.error('setting/notification', '更新通知设置', e)
        onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
      })
    },
    [tt],
  )

  // 开关即时生效(既有交互),保存按钮做一次全量确认提交 —— 幂等,失败明确回吐。
  const onSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const payload: Record<string, boolean> = {}
      list.forEach((item) => {
        payload[item.key] = item.enabled
      })
      await updateNotificationSettings(payload)
      onToast(t('notificationSettings.saved'), { kind: 'success' })
    } catch (e) {
      logger.error('setting/notification', '保存通知设置', e)
      onToast(tt('setting.operationFailed', '操作失败'), { kind: 'error' })
    } finally {
      setSaving(false)
    }
  }, [list, saving, t, tt])

  const onBack = useCallback(() => {
    void Taro.navigateBack()
  }, [])

  // 微信订阅消息授权(一次性授权,消耗后需再次订阅才能收到下一条推送)
  const onSubscribeWx = useCallback(async () => {
    const accepted = await requestPushSubscription()
    if (accepted) {
      onToast(tt('setting.notification.subscribed', '已开启提醒订阅'), { kind: 'success' })
    } else {
      logger.info('setting/notification', 'subscribe-rejected', '用户未同意订阅或未配置模板')
      onToast(tt('setting.notification.subscribeFailed', '未开启订阅,可稍后重试'), {
        kind: 'error',
      })
    }
  }, [tt])

  // 小程序专有三条入口(微信订阅走 wx.requestSubscribeMessage;账单/通知详情跳小程序路由)。
  // 共享屏只负责渲染这一段数据,不内联任何端侧导航 —— RN 侧另传它自己的入口。
  const extraLinks: readonly NotificationSettingsLink[] = useMemo(
    () => [
      {
        key: 'wx-subscribe',
        label: tt('setting.notification.wxSubscribe', '微信催费提醒'),
        desc: t('bill.wxSubscribeDesc'),
        onPress: () => void onSubscribeWx(),
      },
      {
        key: 'bills',
        label: tt('setting.notification.myBills', '我的学费账单'),
        desc: tt('setting.notification.myBillsDesc', '查看应缴/已缴/欠费并在线缴费'),
        onPress: () => void Taro.navigateTo({ url: '/pkg-user/bill/index' }),
      },
      {
        key: 'detail',
        label: tt('setting.notification.detail', '通知详情'),
        desc: tt('setting.notification.detailDesc', '查看历史通知消息'),
        onPress: () => void Taro.navigateTo({ url: '/pkg-user/message/index' }),
      },
    ],
    [onSubscribeWx, t, tt],
  )

  return (
    <ThemeRoot className="min-h-screen bg-background">
      <SharedNotificationSettingsScreen
        t={t}
        items={items}
        showHeader={false}
        extraLinks={extraLinks}
        extraLinksTitle={tt('setting.notification.moreTitle', '更多')}
        loading={loading}
        saving={saving}
        error={loadError}
        success=""
        onToggle={onToggle}
        onSave={() => void onSave()}
        onBack={onBack}
        onRetry={() => void load()}
        colorScheme={resolved}
      />
      <View className="px-[20rpx] pb-[24rpx]">
        {/* 新消息提示音:默认开启,关闭立即静音并同步后端 soundEnabled */}
        <View className="flex items-center justify-between p-[20rpx] bg-card rounded-lg mb-[16rpx]">
          <Text className="text-body text-foreground">
            {tt('setting.notification.soundLabel', '新消息提示音')}
          </Text>
          <Switch checked={soundEnabled} onCheckedChange={onToggleSound} />
        </View>

        {/* 通知铃声:8 个自制合成音,点选写入后端 ringtone + 本地缓存,右侧可试听 */}
        <View className="p-[20rpx] bg-card rounded-lg">
          <Text className="block text-strong font-semibold text-foreground mb-[8rpx]">
            {tt('setting.notification.ringtoneTitle', '通知铃声')}
          </Text>
          <View className="flex flex-col">
            {RINGTONE_IDS.map((id) => {
              const active = id === ringtoneId
              return (
                <View
                  key={id}
                  role="radio"
                  aria-checked={active}
                  className="flex items-center justify-between py-[20rpx]"
                  hoverClass="opacity-60"
                  onClick={() => onSelectRingtone(id)}
                >
                  <Text
                    className={
                      active
                        ? 'text-body font-semibold text-foreground'
                        : 'text-body text-foreground'
                    }
                  >
                    {tt(`setting.notification.ringtone.${id}`, RINGTONE_FALLBACK[id])}
                  </Text>
                  <View className="flex flex-row items-center gap-[16rpx]">
                    <View
                      role="button"
                      aria-label={tt('setting.notification.ringtonePreview', '试听')}
                      onClick={(e) => {
                        e.stopPropagation()
                        onPreviewRingtone(id)
                      }}
                      className="px-[16rpx] h-[48rpx] leading-[48rpx] rounded-sm bg-muted text-muted-foreground text-body-sm"
                    >
                      {tt('setting.notification.ringtonePreview', '试听')}
                    </View>
                    {active ? (
                      <Image src="/static/images/icons/check.svg" className="h-6 w-6" />
                    ) : null}
                  </View>
                </View>
              )
            })}
          </View>
        </View>
      </View>
    </ThemeRoot>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
