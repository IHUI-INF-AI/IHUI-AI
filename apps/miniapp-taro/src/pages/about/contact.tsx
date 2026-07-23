import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getContact } from '@/api'
import { useI18n } from '@/i18n'
import './contact.css'

interface ContactInfo {
  phone: string
  email: string
  address: string
  qq?: string
  wechat?: string
}

interface ContactItem {
  key: string
  icon: string
  label: string
  value: string
  actionType: 'call' | 'copy'
}

export default function ContactPage() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [info, setInfo] = useState<ContactInfo>({ phone: '', email: '', address: '' })

  const load = useCallback(async () => {
    try {
      setInfo(await getContact())
    } catch (e) {
      logger.error('about/contact', '获取联系方式', e)
      Taro.showToast({ title: tt('common.failed', '加载失败'), icon: 'none' })
    }
  }, [tt])

  const call = useCallback((phone: string) => {
    if (!phone) {
      Taro.showToast({ title: tt('about.contact.noPhone', '暂无电话'), icon: 'none' })
      return
    }
    Taro.makePhoneCall({ phoneNumber: phone })
  }, [tt])

  const copy = useCallback((text: string, label: string) => {
    if (!text) {
      Taro.showToast({ title: tt('about.contact.empty', '内容为空'), icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: text,
      success: () => {
        Taro.showToast({ title: `${label}${tt('about.contact.copied', '已复制')}`, icon: 'none' })
      },
    })
  }, [tt])

  const openLocation = useCallback((address: string) => {
    if (!address) return
    Taro.setClipboardData({
      data: address,
      success: () => {
        Taro.showToast({ title: tt('about.contact.addressCopied', '地址已复制'), icon: 'none' })
      },
    })
  }, [tt])

  const contactItems = useMemo<ContactItem[]>(() => {
    const items: ContactItem[] = [
      {
        key: 'phone',
        icon: '📞',
        label: tt('about.contact.phone', '电话'),
        value: info.phone,
        actionType: 'call',
      },
      {
        key: 'email',
        icon: '✉️',
        label: tt('about.contact.email', '邮箱'),
        value: info.email,
        actionType: 'copy',
      },
      {
        key: 'qq',
        icon: '💬',
        label: tt('about.contact.qq', 'QQ'),
        value: info.qq || '',
        actionType: 'copy',
      },
      {
        key: 'wechat',
        icon: '👤',
        label: tt('about.contact.wechat', '微信'),
        value: info.wechat || '',
        actionType: 'copy',
      },
    ]
    return items.filter((item) => item.value)
  }, [info, tt])

  useDidShow(() => load())

  return (
    <View className="page">
      <View className="header">
        <Text className="header-title">{tt('about.contact.title', '联系我们')}</Text>
        <Text className="header-sub">{tt('about.contact.headerSub', '我们随时为您提供帮助')}</Text>
      </View>

      {contactItems.length > 0 ? (
        <View className="card">
          {contactItems.map((item, idx) => (
            <View
              key={item.key}
              className={`row${idx === contactItems.length - 1 ? ' last' : ''}`}
              onClick={() =>
                item.actionType === 'call'
                  ? call(item.value)
                  : copy(item.value, item.label)
              }
            >
              <Text className="icon">{item.icon}</Text>
              <View className="body">
                <Text className="label">{item.label}</Text>
                <Text className="value">{item.value}</Text>
              </View>
              <Text className="action-text">
                {item.actionType === 'call'
                  ? tt('about.contact.callBtn', '拨打')
                  : tt('about.contact.copyBtn', '复制')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {info.address ? (
        <View className="card">
          <View className="row last" onClick={() => openLocation(info.address)}>
            <Text className="icon">📍</Text>
            <View className="body">
              <Text className="label">{tt('about.contact.address', '地址')}</Text>
              <Text className="value">{info.address}</Text>
            </View>
            <Text className="action-text">{tt('about.contact.copyBtn', '复制')}</Text>
          </View>
        </View>
      ) : null}

      <View className="card">
        <View className="work-row">
          <Text className="work-label">{tt('about.contact.workTimeLabel', '工作时间')}</Text>
          <Text className="work-value">
            {tt('about.contact.workTime', '周一至周五 9:00-18:00')}
          </Text>
        </View>
        <View className="work-row last">
          <Text className="work-label">{tt('about.contact.responseLabel', '响应时间')}</Text>
          <Text className="work-value">
            {tt('about.contact.responseTime', '工作日内 24 小时内回复')}
          </Text>
        </View>
      </View>

      {info.phone ? (
        <View className="footer">
          <Button className="call-btn" onClick={() => call(info.phone)}>
            {tt('about.contact.callNow', '立即拨打客服')}
          </Button>
        </View>
      ) : null}

      <View className="tips">
        <Text>{tt('about.contact.footer', '感谢您选择智汇 AI')}</Text>
      </View>
    </View>
  )
}
