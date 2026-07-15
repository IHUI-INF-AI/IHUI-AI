import { logger } from '@/utils/logger'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getAbout } from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface AboutInfo {
  name: string
  version: string
  intro: string
  logo?: string
}

export default function AboutIndexPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<AboutInfo>({ name: '', version: '', intro: '' })

  const load = useCallback(async () => {
    try {
      setInfo(await getAbout())
    } catch (e) {
      logger.error('about/index', '获取关于信息', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

  const navigate = useCallback((url: string) => {
    Taro.navigateTo({ url })
  }, [])

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
        <Text className="intro">{info.intro}</Text>
      </View>

      <View className="menu">
        <View className="menu-item" onClick={() => navigate('/pages/about/help')}>
          <Text>{t('about.help.title')}</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/about/protocol')}>
          <Text>{t('about.protocol')}</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/about/privacy')}>
          <Text>{t('about.privacy')}</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/about/contact')}>
          <Text>{t('about.contact.title')}</Text>
          <Text className="arrow">›</Text>
        </View>
      </View>
    </View>
  )
}
