import { logger } from '@/utils/logger'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getContact } from '@/api'
import { useI18n } from '@/i18n'
import './contact.css'

interface ContactInfo {
  phone: string
  email: string
  address: string
  qq?: string
}

export default function ContactPage() {
  const { t } = useI18n()
  const [info, setInfo] = useState<ContactInfo>({ phone: '', email: '', address: '' })

  const load = useCallback(async () => {
    try {
      setInfo(await getContact())
    } catch (e) {
      logger.error('about/contact', '获取联系方式', e)
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    }
  }, [t])

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
              <Text className="label">{t('about.contact.phone')}</Text>
              <Text className="value">{info.phone}</Text>
            </View>
          </View>
          <View className="row" onClick={() => copy(info.email)}>
            <Text className="icon">✉️</Text>
            <View className="body">
              <Text className="label">{t('about.contact.email')}</Text>
              <Text className="value">{info.email}</Text>
            </View>
          </View>
          <View className="row" onClick={() => copy(info.qq || '')}>
            <Text className="icon">💬</Text>
            <View className="body">
              <Text className="label">{t('about.contact.qq')}</Text>
              <Text className="value">{info.qq}</Text>
            </View>
          </View>
          <View className="row">
            <Text className="icon">📍</Text>
            <View className="body">
              <Text className="label">{t('about.contact.address')}</Text>
              <Text className="value">{info.address}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View className="tips">
        <Text>{t('about.contact.workTime')}</Text>
      </View>
    </View>
  )
}
