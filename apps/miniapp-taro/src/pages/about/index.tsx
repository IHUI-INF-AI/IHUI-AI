import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getAbout } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface AboutInfo {
  name: string
  version: string
  intro: string
  logo?: string
}

interface MenuItem {
  key: string
  label: string
  url: string
}

export default function AboutIndexPage() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [info, setInfo] = useState<AboutInfo>({ name: '', version: '', intro: '' })

  const load = useCallback(async () => {
    try {
      setInfo(await getAbout())
    } catch (e) {
      logger.error('about/index', '获取关于信息', e)
      Taro.showToast({ title: tt('common.failed', '加载失败'), icon: 'none' })
    }
  }, [tt])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

  const menus = useMemo<MenuItem[]>(
    () => [
      { key: 'protocol', label: tt('about.protocol.title', '用户协议'), url: '/pages/about/protocol' },
      { key: 'privacy', label: tt('about.privacy.mainTitle', '隐私政策'), url: '/pages/about/privacy' },
      {
        key: 'businessLicense',
        label: tt('about.businessLicense.title', '营业执照'),
        url: '/pages/about/business-license/index',
      },
      {
        key: 'icpRecord',
        label: tt('about.icpRecord.title', 'ICP备案'),
        url: '/pages/about/icp-record/index',
      },
      {
        key: 'modelRecord',
        label: tt('about.modelRecord.title', '模型备案'),
        url: '/pages/about/model-record/index',
      },
      {
        key: 'usageRules',
        label: tt('about.usageRules.title', '使用规则'),
        url: '/pages/about/usage-rules/index',
      },
      {
        key: 'apiSettings',
        label: tt('about.apiSettings.title', 'API 设置'),
        url: '/pages/about/api-settings/index',
      },
      {
        key: 'appPermission',
        label: tt('about.appPermission.title', '应用权限'),
        url: '/pages/about/app-permission/index',
      },
      { key: 'help', label: tt('about.help.title', '帮助中心'), url: '/pages/about/help' },
      { key: 'contact', label: tt('about.contact.title', '联系我们'), url: '/pages/about/contact' },
    ],
    [tt],
  )

  useDidShow(() => load())

  return (
    <View className="page">
      {info.name ? (
        <View className="logo-box">
          <Image className="logo" src={info.logo || '/static/logo.png'} mode="aspectFit" />
          <Text className="name">{info.name}</Text>
          <Text className="version">{t('about.version', { version: info.version })}</Text>
        </View>
      ) : null}

      <View className="card">
        <Text className="intro">{info.intro || tt('about.introFallback', '智汇 AI 致力于打造一站式 AI 服务平台')}</Text>
      </View>

      <View className="menu">
        {menus.map((m) => (
          <View key={m.key} className="menu-item" onClick={() => navigate(m.url)}>
            <Text className="menu-label">{m.label}</Text>
            <Text className="arrow">›</Text>
          </View>
        ))}
      </View>

      <View className="footer">
        <Text className="footer-text">
          {tt('about.copyright', '© 2026 智汇 AI. 保留所有权利')}
        </Text>
      </View>
    </View>
  )
}
