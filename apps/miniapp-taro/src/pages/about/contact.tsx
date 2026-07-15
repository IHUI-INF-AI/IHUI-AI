import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getContact } from '@/api'
import './contact.css'

interface ContactInfo {
  phone: string
  email: string
  address: string
  qq?: string
}

export default function ContactPage() {
  const [info, setInfo] = useState<ContactInfo>({ phone: '', email: '', address: '' })

  const load = useCallback(async () => {
    try {
      setInfo(await getContact())
    } catch (e) {
      logger.error('about/contact', '获取联系方式', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }, [])

  const call = useCallback((phone: string) => {
    Taro.makePhoneCall({ phoneNumber: phone })
  }, [])

  const copy = useCallback((text: string) => {
    Taro.setClipboardData({ data: text })
  }, [])

  useDidShow(() => load())

  return (
    <View className="page">
      {info.phone ? (
        <View className="card">
          <View className="row" onClick={() => call(info.phone)}>
            <Text className="icon">📞</Text>
            <View className="body">
              <Text className="label">客服电话</Text>
              <Text className="value">{info.phone}</Text>
            </View>
          </View>
          <View className="row" onClick={() => copy(info.email)}>
            <Text className="icon">✉️</Text>
            <View className="body">
              <Text className="label">邮箱</Text>
              <Text className="value">{info.email}</Text>
            </View>
          </View>
          <View className="row" onClick={() => copy(info.qq || '')}>
            <Text className="icon">💬</Text>
            <View className="body">
              <Text className="label">QQ</Text>
              <Text className="value">{info.qq}</Text>
            </View>
          </View>
          <View className="row">
            <Text className="icon">📍</Text>
            <View className="body">
              <Text className="label">地址</Text>
              <Text className="value">{info.address}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View className="tips">
        <Text>工作时间：周一至周五 9:00-18:00</Text>
      </View>
    </View>
  )
}
