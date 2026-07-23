import { logger } from '@/utils/logger'
import { View, Text, Switch, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import './privacy.css'

// 系统权限项配置
interface PermissionItem {
  key: string
  label: string
  scope: string
}

const PERMISSIONS: PermissionItem[] = [
  { key: 'record', label: '麦克风', scope: 'scope.record' },
  { key: 'camera', label: '相机', scope: 'scope.camera' },
  { key: 'album', label: '相册', scope: 'scope.writePhotosAlbum' },
  { key: 'location', label: '位置', scope: 'scope.userLocation' },
  { key: 'notification', label: '通知', scope: 'subscription' },
]

// 隐私设置项 key
const PRIVACY_KEYS = {
  mute: 'privacy_mute',
  recommend: 'privacy_recommend',
  personalize: 'privacy_personalize',
}

export default function PrivacySettingPage() {
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

  const statusText = (s: string) => {
    if (s === 'granted') return '已开启'
    if (s === 'denied') return '已拒绝'
    return '未开启'
  }

  return (
    <View className="page">
      {/* 系统权限引导 */}
      <View className="group-title">系统权限</View>
      <View className="tech-card list">
        {PERMISSIONS.map((item) => (
          <View className="perm-item" key={item.key}>
            <View className="perm-info">
              <Text className="perm-label">{item.label}</Text>
              <Text className={`perm-status ${permStatus[item.key] || 'unknown'}`}>
                {statusText(permStatus[item.key] || 'unknown')}
              </Text>
            </View>
            <Button className="setting-btn" size="mini" onClick={onOpenSetting}>
              去设置
            </Button>
          </View>
        ))}
      </View>

      {/* 隐私设置选项 */}
      <View className="group-title">隐私设置</View>
      <View className="tech-card list">
        <View className="switch-item">
          <View className="switch-info">
            <Text className="switch-label">消息免打扰</Text>
            <Text className="switch-desc">关闭后不再接收消息推送</Text>
          </View>
          <Switch checked={mute} color="#00f2ff" onChange={(e) => onToggle('mute', e.detail.value)} />
        </View>
        <View className="switch-item">
          <View className="switch-info">
            <Text className="switch-label">推荐内容</Text>
            <Text className="switch-desc">开启后将为您推荐优质内容</Text>
          </View>
          <Switch
            checked={recommend}
            color="#00f2ff"
            onChange={(e) => onToggle('recommend', e.detail.value)}
          />
        </View>
        <View className="switch-item">
          <View className="switch-info">
            <Text className="switch-label">个性化推荐</Text>
            <Text className="switch-desc">基于兴趣为您提供个性化内容</Text>
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
          隐私政策
        </Text>
      </View>
    </View>
  )
}
