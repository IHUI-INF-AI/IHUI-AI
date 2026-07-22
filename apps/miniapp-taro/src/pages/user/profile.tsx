import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, type UserInfo } from '@/api'
import { useI18n } from '@/i18n'

export default function Profile() {
  const { t } = useI18n()
  const [form, setForm] = useState<Partial<UserInfo>>({})

  const load = useCallback(async () => {
    try {
      setForm(await getProfile())
    } catch (e) {
      logger.error('user/profile', '获取用户信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  function navigate(url: string) {
    Taro.navigateTo({ url })
  }

  useDidShow(() => {
    load()
  })

  const rows = [
    { label: t('user.profile.avatar'), path: '/pages/user/avatar', value: null, isAvatar: true },
    {
      label: t('user.profile.nickname'),
      path: '/pages/user/nickname',
      value: form.nickname || t('user.profile.notSet'),
      isAvatar: false,
    },
    {
      label: t('user.profile.phone'),
      path: '/pages/user/phone',
      value: form.phone || t('user.profile.unbound'),
      isAvatar: false,
    },
    {
      label: t('user.profile.email'),
      path: '/pages/user/email',
      value: form.email || t('user.profile.unbound'),
      isAvatar: false,
    },
    {
      label: t('user.profile.password'),
      path: '/pages/user/password',
      value: null,
      isAvatar: false,
    },
    {
      label: t('user.profile.realname'),
      path: '/pages/user/realname',
      value: form.realName ? t('user.profile.verified') : t('user.profile.unverified'),
      isAvatar: false,
    },
  ]

  return (
    <View className="min-h-screen bg-background">
      <View className="mx-[12px] bg-card rounded-[8px] overflow-hidden">
        {rows.map((row, idx) => (
          <View
            key={row.path}
            className={`flex justify-between items-center px-[16px] py-[16px] ${
              idx < rows.length - 1 ? 'border-b-[1px] border-solid border-border' : ''
            }`}
            onClick={() => navigate(row.path)}
          >
            <Text className="text-[14px] text-foreground">{row.label}</Text>
            <View className="flex items-center text-[13px] text-muted-foreground">
              {row.isAvatar ? (
                <Image
                  className="w-[40px] h-[40px] rounded-md bg-muted"
                  src={form.avatar || '/static/default-avatar.png'}
                  mode="aspectFill"
                />
              ) : (
                <Text>{row.value}</Text>
              )}
              <Text className="text-muted-foreground ml-[8px]">›</Text>
            </View>
          </View>
        ))}
      </View>
      <View className="mx-[12px] bg-card rounded-[8px] overflow-hidden">
        <View
          className="flex justify-between items-center px-[16px] py-[16px]"
          onClick={() => navigate('/pages/user/feedback')}
        >
          <Text className="text-[14px] text-foreground">{t('user.profile.feedback')}</Text>
          <View className="flex items-center text-muted-foreground">
            <Text>›</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
