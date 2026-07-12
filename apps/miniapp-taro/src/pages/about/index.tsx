import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getAbout } from '@/api'
import './index.css'

interface AboutInfo {
  name: string
  version: string
  intro: string
  logo?: string
}

export default function AboutIndexPage() {
  const [info, setInfo] = useState<AboutInfo>({ name: '', version: '', intro: '' })

  const load = useCallback(async () => {
    try {
      setInfo(await getAbout())
    } catch (e) {
      console.error('[about/index] 获取关于信息 failed:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

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
          <Text className="version">V{info.version}</Text>
        </View>
      ) : null}

      <View className="card">
        <Text className="intro">{info.intro}</Text>
      </View>

      <View className="menu">
        <View className="menu-item" onClick={() => navigate('/pages/about/help')}>
          <Text>帮助中心</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/about/protocol')}>
          <Text>用户协议</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/about/privacy')}>
          <Text>隐私政策</Text>
          <Text className="arrow">›</Text>
        </View>
        <View className="menu-item" onClick={() => navigate('/pages/about/contact')}>
          <Text>联系我们</Text>
          <Text className="arrow">›</Text>
        </View>
      </View>
    </View>
  )
}
