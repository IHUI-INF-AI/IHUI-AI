import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, updateUserAvatar, type UserInfo } from '@/api'
import { useI18n } from '@/i18n'

export default function Profile() {
  const { t } = useI18n()
  const [form, setForm] = useState<Partial<UserInfo>>({})
  const [uploading, setUploading] = useState(false)

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

  // 头像更换:点击头像 → 选图 → 上传 → 更新显示(对标原 account.vue onEditAvatar)
  const chooseAvatar = useCallback(() => {
    if (uploading) return
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: async (res) => {
        const path = res.tempFilePaths[0]!
        const prevAvatar = form.avatar
        try {
          setUploading(true)
          Taro.showLoading({ title: t('user.profile.avatarUploading') })
          setForm((prev) => ({ ...prev, avatar: path }))
          await updateUserAvatar(path)
          Taro.hideLoading()
          Taro.showToast({ title: t('user.avatar.updateSuccess'), icon: 'success' })
        } catch (e) {
          logger.error('user/profile', '更新头像', e)
          setForm((prev) => ({ ...prev, avatar: prevAvatar }))
          Taro.hideLoading()
          Taro.showToast({ title: t('user.profile.avatarUpdateFailed'), icon: 'none' })
        } finally {
          setUploading(false)
        }
      },
    })
  }, [uploading, form.avatar, t])

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
      {/* 身份标签(对标原项目 settings/account)*/}
      <View className="mx-[12px] mt-[12px] tech-card px-[16px] py-[12px] flex items-center justify-between">
        <Text className="text-[14px] text-foreground">{t('user.identity')}</Text>
        <View className="flex items-center">
          {form.isVip ? (
            <Text className="px-[8px] py-[2px] bg-[#8b5cf6] text-white text-[11px] rounded-[4px]">
              {t('user.vipMember')}
            </Text>
          ) : null}
          {(form.roleId ?? 0) >= 1 ? (
            <Text className="ml-[6px] px-[8px] py-[2px] bg-[var(--color-primary)] text-[var(--color-primary-foreground)] text-[11px] rounded-[4px]">
              {t('user.admin')}
            </Text>
          ) : null}
          {!form.isVip && (form.roleId ?? 0) < 1 ? (
            <Text className="px-[8px] py-[2px] bg-muted text-muted-foreground text-[11px] rounded-[4px]">
              {t('user.normalUser')}
            </Text>
          ) : null}
        </View>
      </View>
      <View className="mx-[12px] bg-card rounded-[8px] overflow-hidden">
        {rows.map((row, idx) => (
          <View
            key={row.path}
            className={`flex justify-between items-center px-[16px] py-[16px] ${
              idx < rows.length - 1 ? 'border-b-[1px] border-solid border-border' : ''
            }`}
            onClick={() => (row.isAvatar ? chooseAvatar() : navigate(row.path))}
          >
            <Text className="text-[14px] text-foreground">{row.label}</Text>
            <View className="flex items-center text-[13px] text-muted-foreground">
              {row.isAvatar ? (
                <View className="relative">
                  <Image
                    className="w-[40px] h-[40px] rounded-md bg-muted"
                    src={form.avatar || '/static/default-avatar.png'}
                    mode="aspectFill"
                  />
                  <View className="absolute -bottom-[2px] -right-[2px] w-[14px] h-[14px] bg-primary rounded-sm flex items-center justify-center">
                    <Text className="text-[9px] text-white leading-none">📷</Text>
                  </View>
                </View>
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
