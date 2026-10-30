// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 设置页子模块:分组行列表 / 消息通知开关 / 修改密码弹层。
// 拆出只为守住单页 < 250 行(还原度门的载体面会读同目录 ./ 模块),文案键全部取自共享屏
// packages/app/src/features/settings/SettingsScreen.tsx 的同一套 settings.*,不新造键。
import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import Taro from '@tarojs/taro'
import { View, Text, Switch } from '@tarojs/components'
import { useState, useCallback, useEffect } from 'react'
import { getNotificationSettings, updateNotificationSettings, updatePassword } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { FocusInput } from '@/components/FocusField'
import LineIcon from '@/components/LineIcon'
import { getRnTokens } from '@ihui/design-tokens'
import { useAppTheme } from '@/lib/theme'

/** 一行可点条目:与 RN plainRow 同形(左标签 + 右侧箭头)。 */
export interface SettingRow {
  readonly key: string
  readonly label: string
  readonly onPress: () => void
}

/**
 * 分组卡片:对齐 RN Section(标题 14dp→28rpx text.secondary + 距卡片 8dp→16rpx;
 * 卡片圆角 8dp→16rpx + 行间 hairline(2rpx)分隔,底色走 border token)。
 */
export function RowsSection({ title, rows }: { title: string; rows: SettingRow[] }) {
  return (
    <View className="mx-[20rpx] mt-[32rpx]">
      <Text className="mb-[16rpx] block text-[length:28rpx] text-muted-foreground">{title}</Text>
      <View className="flex flex-col gap-[2rpx] overflow-hidden rounded-lg bg-[color:var(--color-border)]">
        {rows.map((row) => (
          <View
            key={row.key}
            className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
            onClick={row.onPress}
            hoverClass="opacity-60"
          >
            {/* rowLabel 对齐 RN: 16dp→32rpx + text.medium 语义映射 muted-foreground */}
            <Text className="text-[length:32rpx] text-muted-foreground">{row.label}</Text>
            {/* arrow 对齐 RN: 20dp→40rpx + text.tertiary */}
            <LineIcon name="chevron-right" size={24} color="var(--color-text-tertiary)" />
          </View>
        ))}
      </View>
    </View>
  )
}

type NotifKey = 'push' | 'message' | 'email'

/** 与 RN 端初值一致(push/message 开、email 关):后端没有这批行时即按默认值展示。 */
const DEFAULT_NOTIFS: Record<NotifKey, boolean> = { push: true, message: true, email: false }

/**
 * 消息通知分区:对齐 RN Section(settings.notification)+ 三条 switchRow。
 * 数据契约 = `GET /api/settings/notification` 的 `{ list: [{ key, enabled }] }`
 * (apps/api/src/routes/miniapp-compat-routes.ts 单数别名,group 取复数 notifications),
 * 切换走 `PUT` 同路径只写被点的那一键。
 */
export function NotificationSection() {
  const { t } = useI18n()
  const { allow } = useAuthReadyGate()
  const { resolved } = useAppTheme()
  /* 微信 <switch color> 走 wxml 原生属性位、不解析 CSS 变量 ⇒ 必须 JS 派生 hex(同 notification 页) */
  const switchInk = getRnTokens(resolved).brand.DEFAULT
  const [values, setValues] = useState<Record<NotifKey, boolean>>(DEFAULT_NOTIFS)

  const load = useCallback(async () => {
    try {
      const res = await getNotificationSettings()
      setValues((prev) => {
        const next = { ...prev }
        for (const item of res.list || []) {
          if (item.key === 'push' || item.key === 'message' || item.key === 'email') {
            next[item.key] = item.enabled
          }
        }
        return next
      })
    } catch (e) {
      // 取不到就保持默认值渲染:开关仍在、交互仍在,只记日志不打断页面
      logger.error('setting/index', '获取通知设置', e)
    }
  }, [])

  // 冷启动门控:该 GET 需鉴权,未就绪/未登录时不发(本页 load 同源门控)
  useEffect(() => {
    if (!allow) return
    void load()
  }, [allow, load])

  const onToggle = useCallback((key: NotifKey, value: boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    updateNotificationSettings({ [key]: value }).catch((e) => {
      logger.error('setting/index', '更新通知设置', e)
      setValues((prev) => ({ ...prev, [key]: !value }))
    })
  }, [])

  const rows: Array<{ key: NotifKey; label: string }> = [
    { key: 'push', label: t('settings.notifPush') },
    { key: 'message', label: t('settings.notifMessage') },
    { key: 'email', label: t('settings.notifEmail') },
  ]

  return (
    <View className="mx-[20rpx] mt-[32rpx]">
      <Text className="mb-[16rpx] block text-[length:28rpx] text-muted-foreground">
        {t('settings.notification')}
      </Text>
      <View className="flex flex-col gap-[2rpx] overflow-hidden rounded-lg bg-[color:var(--color-border)]">
        {rows.map((row) => (
          <View
            key={row.key}
            className="flex min-h-[120rpx] items-center justify-between bg-card px-[24rpx] py-[28rpx] dark:bg-muted"
          >
            <Text className="text-[length:32rpx] text-muted-foreground">{row.label}</Text>
            <Switch
              checked={values[row.key]}
              color={switchInk}
              onChange={(e) => onToggle(row.key, e.detail.value)}
            />
          </View>
        ))}
      </View>
    </View>
  )
}

/** 密码输入位:复用项目唯一聚焦描边实现(FocusInput,门 212),样式与弹层同一档。 */
function PwdField({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <FocusInput
      className="box-border h-[88rpx] w-full rounded-sm bg-muted px-[24rpx] text-[length:30rpx] text-foreground"
      password
      maxlength={20}
      placeholder={placeholder}
      value={value}
      onInput={(e) => onChange(e.detail.value)}
    />
  )
}

/**
 * 修改密码弹层:对齐 RN 共享屏内置的密码 Modal(三输入 + 三条校验 + 成败提示)。
 * 提交走 `updatePassword` → `POST /api/user/password { oldPwd, newPwd }`
 * (apps/miniapp-taro/src/api/index.ts:1023,与 pkg-user/user/password 同一接口)。
 */
export function PasswordModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const [oldPwd, setOldPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const close = useCallback(() => {
    setOldPwd('')
    setNewPwd('')
    setConfirmPwd('')
    setSubmitting(false)
    onClose()
  }, [onClose])

  const submit = useCallback(async () => {
    if (submitting) return
    if (!oldPwd || !newPwd || !confirmPwd) {
      Taro.showToast({ title: t('settings.pwdFieldsRequired'), icon: 'none' })
      return
    }
    if (newPwd.length < 6) {
      Taro.showToast({ title: t('settings.pwdTooShort'), icon: 'none' })
      return
    }
    if (newPwd !== confirmPwd) {
      Taro.showToast({ title: t('settings.pwdNotMatch'), icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await updatePassword(oldPwd, newPwd)
      close()
      Taro.showToast({ title: t('settings.pwdChanged'), icon: 'success' })
    } catch (e) {
      logger.error('setting/index', '修改密码', e)
      Taro.showToast({ title: t('settings.pwdChangeFailed'), icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }, [close, confirmPwd, newPwd, oldPwd, submitting, t])

  if (!visible) return null

  return (
    <View className="fixed inset-0 z-[1040] flex items-center justify-center">
      <View className="absolute inset-0 bg-[var(--color-black-50)]" onClick={close} />
      <View className="relative mx-[40rpx] w-full rounded-lg bg-background p-[28rpx]">
        <Text className="mb-[20rpx] block text-[length:32rpx] font-semibold text-foreground">
          {t('settings.changePassword')}
        </Text>
        <View className="flex flex-col gap-[16rpx]">
          <PwdField placeholder={t('settings.oldPassword')} value={oldPwd} onChange={setOldPwd} />
          <PwdField placeholder={t('settings.newPassword')} value={newPwd} onChange={setNewPwd} />
          <PwdField
            placeholder={t('settings.confirmPassword')}
            value={confirmPwd}
            onChange={setConfirmPwd}
          />
        </View>
        <View className="mt-[24rpx] flex gap-[16rpx]">
          <View
            className="flex h-[88rpx] flex-1 items-center justify-center rounded-sm bg-muted"
            onClick={close}
            hoverClass="opacity-60"
          >
            <Text className="text-[length:30rpx] text-foreground">{t('common.cancel')}</Text>
          </View>
          <View
            className="flex h-[88rpx] flex-1 items-center justify-center rounded-sm bg-[color:var(--color-cta)]"
            onClick={() => void submit()}
            hoverClass="opacity-60"
          >
            <Text className="text-[length:30rpx] font-semibold text-[color:var(--color-cta-foreground)]">
              {submitting ? t('common.loading') : t('common.confirm')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
