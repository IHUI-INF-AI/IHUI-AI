import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getContact } from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background pb-[60rpx]">
      <View className="pt-[60rpx] px-[32rpx] pb-[40rpx] text-center bg-card">
        <Text className="block text-[36rpx] font-semibold text-foreground">{tt('about.contact.title', '联系我们')}</Text>
        <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">{tt('about.contact.headerSub', '我们随时为您提供帮助')}</Text>
      </View>

      {contactItems.length > 0 ? (
        <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
          {contactItems.map((item, idx) => (
            <View
              key={item.key}
              className={`flex items-center p-[32rpx] active:bg-background${idx > 0 ? ' mt-[16rpx]' : ''}`}
              onClick={() =>
                item.actionType === 'call'
                  ? call(item.value)
                  : copy(item.value, item.label)
              }
            >
              <Text className="text-[40rpx] flex-shrink-0">{item.icon}</Text>
              <View className="flex-1 ml-[24rpx] mr-[16rpx]">
                <Text className="block text-[22rpx] text-muted-foreground">{item.label}</Text>
                <Text className="block text-[28rpx] text-foreground mt-[4rpx] break-all">{item.value}</Text>
              </View>
              <Text className="text-[24rpx] text-primary flex-shrink-0">
                {item.actionType === 'call'
                  ? tt('about.contact.callBtn', '拨打')
                  : tt('about.contact.copyBtn', '复制')}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {info.address ? (
        <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
          <View className="flex items-center p-[32rpx] active:bg-background" onClick={() => openLocation(info.address)}>
            <Text className="text-[40rpx] flex-shrink-0">📍</Text>
            <View className="flex-1 ml-[24rpx] mr-[16rpx]">
              <Text className="block text-[22rpx] text-muted-foreground">{tt('about.contact.address', '地址')}</Text>
              <Text className="block text-[28rpx] text-foreground mt-[4rpx] break-all">{info.address}</Text>
            </View>
            <Text className="text-[24rpx] text-primary flex-shrink-0">{tt('about.contact.copyBtn', '复制')}</Text>
          </View>
        </View>
      ) : null}

      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
        <View className="flex justify-between items-center py-[28rpx] px-[32rpx]">
          <Text className="text-[28rpx] text-foreground">{tt('about.contact.workTimeLabel', '工作时间')}</Text>
          <Text className="text-[26rpx] text-muted-foreground text-right">
            {tt('about.contact.workTime', '周一至周五 9:00-18:00')}
          </Text>
        </View>
        <View className="flex justify-between items-center py-[28rpx] px-[32rpx] mt-[16rpx]">
          <Text className="text-[28rpx] text-foreground">{tt('about.contact.responseLabel', '响应时间')}</Text>
          <Text className="text-[26rpx] text-muted-foreground text-right">
            {tt('about.contact.responseTime', '工作日内 24 小时内回复')}
          </Text>
        </View>
      </View>

      {info.phone ? (
        <View className="pt-[32rpx] px-[24rpx] pb-[16rpx]">
          <Button className="w-full h-[88rpx] leading-[88rpx] bg-primary text-white text-[30rpx] rounded-[12rpx] m-0 after:border-0" onClick={() => call(info.phone)}>
            {tt('about.contact.callNow', '立即拨打客服')}
          </Button>
        </View>
      ) : null}

      <View className="text-center p-[32rpx]">
        <Text className="text-[22rpx] text-muted-foreground">{tt('about.contact.footer', '感谢您选择智汇 AI')}</Text>
      </View>
    </View>
  )
}
