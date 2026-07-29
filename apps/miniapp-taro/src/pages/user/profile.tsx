import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getProfile, updateUserAvatar, type UserInfo } from '@/api'
import { useI18n, useTt } from '@/i18n'
import './profile.css'

export default function Profile() {
  const { t } = useI18n()
  const tt = useTt()
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

  const accountRows = [
    {
      label: t('user.profile.nickname'),
      path: '/pages/user/nickname',
      value: form.nickname || t('user.profile.notSet'),
    },
    {
      label: t('user.profile.phone'),
      path: '/pages/user/phone',
      value: form.phone || t('user.profile.unbound'),
    },
    {
      label: t('user.profile.email'),
      path: '/pages/user/email',
      value: form.email || t('user.profile.unbound'),
    },
  ]

  const securityRows = [
    {
      label: t('user.profile.password'),
      path: '/pages/user/password',
      value: '',
    },
    {
      label: t('user.profile.realname'),
      path: '/pages/user/realname',
      value: form.realName ? t('user.profile.verified') : t('user.profile.unverified'),
    },
  ]

  return (
    <View className="pf-page">
      {/* 身份标签行(对齐原项目 identity-tag) */}
      <View className="pf-identity-row">
        <Text className="pf-identity-label">{t('user.identity')}</Text>
        <View className="pf-identity-tags">
          {form.isVip ? (
            <Text className="pf-tag pf-tag-vip">{t('user.vipMember')}</Text>
          ) : null}
          {(form.roleId ?? 0) >= 1 ? (
            <Text className="pf-tag pf-tag-admin">{t('user.admin')}</Text>
          ) : null}
          {!form.isVip && (form.roleId ?? 0) < 1 ? (
            <Text className="pf-tag pf-tag-normal">{t('user.normalUser')}</Text>
          ) : null}
        </View>
      </View>

      {/* 头像 section */}
      <View className="pf-section">
        <Text className="pf-section-title">{t('user.profile.avatar')}</Text>
        <View className="pf-section-card">
          <View
            className="pf-item pf-item-avatar"
            onClick={chooseAvatar}
          >
            <View className="pf-avatar-wrap">
              <Image
                className="pf-avatar-img"
                src={form.avatar || '/static/default-avatar.png'}
                mode="aspectFill"
              />
              <View className="pf-avatar-edit-tip">
                <Text>{tt('user.profile.changeAvatar', '更换')}</Text>
              </View>
            </View>
            <Text className="pf-avatar-hint">
              {tt('user.profile.clickToChange', '点击更换头像')}
            </Text>
            <Text className="pf-arrow">›</Text>
          </View>
        </View>
      </View>

      {/* 账号信息 section */}
      <View className="pf-section">
        <Text className="pf-section-title">{tt('user.profile.accountInfo', '账号信息')}</Text>
        <View className="pf-section-card">
          {accountRows.map((row) => (
            <View
              key={row.path}
              className="pf-item"
              onClick={() => navigate(row.path)}
            >
              <Text className="pf-item-label">{row.label}</Text>
              <View className="pf-item-right">
                <Text className="pf-item-value">{row.value}</Text>
                <Text className="pf-arrow">›</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 安全设置 section */}
      <View className="pf-section">
        <Text className="pf-section-title">{tt('user.profile.security', '安全设置')}</Text>
        <View className="pf-section-card">
          {securityRows.map((row) => (
            <View
              key={row.path}
              className="pf-item"
              onClick={() => navigate(row.path)}
            >
              <Text className="pf-item-label">{row.label}</Text>
              <View className="pf-item-right">
                {row.value ? <Text className="pf-item-value">{row.value}</Text> : null}
                <Text className="pf-arrow">›</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 反馈 section */}
      <View className="pf-section">
        <Text className="pf-section-title">{tt('user.profile.other', '其他')}</Text>
        <View className="pf-section-card">
          <View
            className="pf-item"
            onClick={() => navigate('/pages/user/feedback')}
          >
            <Text className="pf-item-label">{t('user.profile.feedback')}</Text>
            <View className="pf-item-right">
              <Text className="pf-arrow">›</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  )
}
