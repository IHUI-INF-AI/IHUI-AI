import { logger } from '@/utils/logger'
import { View, Text, Switch, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useI18n } from '@/i18n'
import './privacy.css'

// 系统权限项配置:label 走 i18n(settingPrivacy.permissions.<key>)
interface PermissionItem {
  key: string
  scope: string
}

const PERMISSIONS: PermissionItem[] = [
  { key: 'record', scope: 'scope.record' },
  { key: 'camera', scope: 'scope.camera' },
  { key: 'album', scope: 'scope.writePhotosAlbum' },
  { key: 'location', scope: 'scope.userLocation' },
  { key: 'notification', scope: 'subscription' },
]

// 隐私设置项 key
const PRIVACY_KEYS = {
  mute: 'privacy_mute',
  recommend: 'privacy_recommend',
  personalize: 'privacy_personalize',
}

export default function PrivacySettingPage() {
  const { t } = useI18n()
  // 系统权限状态:granted(已授权) / denied(已拒绝) / unknown(未请求)
  const [permStatus, setPermStatus] = useState<Record<string, string>>({})
  // 隐私设置开关
  const [mute, setMute] = useState(false)
  const [recommend, setRecommend] = useState(true)
  const [personalize, setPersonalize] = useState(true)

  // 读取系统权限状态
  const loadPermissions = useCallback(async () => {
    try {
      const setting = await Taro.getSetting()
      const status: Record<string, string> = {}
      for (const item of PERMISSIONS) {
        const auth = setting.authSetting as Record<string, boolean | undefined>
        const val = auth[item.scope]
        if (val === true) status[item.key] = 'granted'
        else if (val === false) status[item.key] = 'denied'
        else status[item.key] = 'unknown'
      }
      setPermStatus(status)
    } catch (e) {
      logger.error('setting/privacy', '获取权限状态', e)
    }
  }, [])

  // 读取本地隐私设置
  const loadPrivacy = useCallback(() => {
    setMute(Taro.getStorageSync(PRIVACY_KEYS.mute) === true)
    setRecommend(Taro.getStorageSync(PRIVACY_KEYS.recommend) !== false)
    setPersonalize(Taro.getStorageSync(PRIVACY_KEYS.personalize) !== false)
  }, [])

  useDidShow(() => {
    loadPermissions()
    loadPrivacy()
  })

  // 打开系统设置页授权
  const onOpenSetting = useCallback(() => {
    Taro.openSetting({
      success: () => loadPermissions(),
    })
  }, [loadPermissions])

  // 切换隐私开关并持久化
  const onToggle = useCallback((key: string, value: boolean) => {
    const storageKey = PRIVACY_KEYS[key as keyof typeof PRIVACY_KEYS]
    if (!storageKey) return
    Taro.setStorageSync(storageKey, value)
    if (key === 'mute') setMute(value)
    else if (key === 'recommend') setRecommend(value)
    else if (key === 'personalize') setPersonalize(value)
  }, [])

  // 跳转隐私政策
  const onPrivacyPolicy = useCallback(() => {
    Taro.navigateTo({ url: '/pages/about/privacy' })
  }, [])

  const statusText = (s: string) => t(`settingPrivacy.status.${s || 'unknown'}`)

  return (
    <View className="page">
      {/* 系统权限引导 */}
      <View className="group-title">{t('settingPrivacy.systemPermissions')}</View>
      <View className="tech-card list">
        {PERMISSIONS.map((item) => (
          <View className="perm-item" key={item.key}>
            <View className="perm-info">
              <Text className="perm-label">{t(`settingPrivacy.permissions.${item.key}`)}</Text>
              <Text className={`perm-status ${permStatus[item.key] || 'unknown'}`}>
                {statusText(permStatus[item.key] || 'unknown')}
              </Text>
            </View>
            <Button className="setting-btn" size="mini" onClick={onOpenSetting}>
              {t('settingPrivacy.goSetting')}
            </Button>
          </View>
        ))}
      </View>

      {/* 隐私设置选项 */}
      <View className="group-title">{t('settingPrivacy.privacySettings')}</View>
      <View className="tech-card list">
        <View className="switch-item">
          <View className="switch-info">
            <Text className="switch-label">{t('settingPrivacy.mute')}</Text>
            <Text className="switch-desc">{t('settingPrivacy.muteDesc')}</Text>
          </View>
          <Switch checked={mute} color="#00f2ff" onChange={(e) => onToggle('mute', e.detail.value)} />
        </View>
        <View className="switch-item">
          <View className="switch-info">
            <Text className="switch-label">{t('settingPrivacy.recommend')}</Text>
            <Text className="switch-desc">{t('settingPrivacy.recommendDesc')}</Text>
          </View>
          <Switch
            checked={recommend}
            color="#00f2ff"
            onChange={(e) => onToggle('recommend', e.detail.value)}
          />
        </View>
        <View className="switch-item">
          <View className="switch-info">
            <Text className="switch-label">{t('settingPrivacy.personalize')}</Text>
            <Text className="switch-desc">{t('settingPrivacy.personalizeDesc')}</Text>
          </View>
          <Switch
            checked={personalize}
            color="#00f2ff"
            onChange={(e) => onToggle('personalize', e.detail.value)}
          />
        </View>
      </View>

      {/* 底部隐私政策链接 */}
      <View className="footer">
        <Text className="policy-link" onClick={onPrivacyPolicy}>
          {t('settingPrivacy.privacyPolicy')}
        </Text>
      </View>
    </View>
  )
}
