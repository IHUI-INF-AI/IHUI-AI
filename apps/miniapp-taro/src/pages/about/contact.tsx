// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import { getContact } from '@/api'
import telIcon from '@/assets/remote/images/tel_icon.png'
import qqIcon from '@/assets/remote/images/QQ.svg'
import wxIcon from '@/assets/remote/images/wx.svg'
import gongsiIcon from '@/assets/remote/images/gongsi.png'
import sandMsgIcon from '@/assets/remote/images/sand_msg.png'
import ThemeRoot from '@/components/ThemeRoot'

function isImagePath(s: string): boolean {
  return /^(https?:)?\/\//.test(s) || s.startsWith('/') || s.startsWith('data:')
}

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

  const call = useCallback(
    (phone: string) => {
      if (!phone) {
        Taro.showToast({ title: tt('about.contact.noPhone', '暂无电话'), icon: 'none' })
        return
      }
      Taro.makePhoneCall({ phoneNumber: phone })
    },
    [tt],
  )

  const copy = useCallback(
    (text: string, label: string) => {
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
    },
    [tt],
  )

  const openLocation = useCallback(
    (address: string) => {
      if (!address) return
      Taro.setClipboardData({
        data: address,
        success: () => {
          Taro.showToast({ title: tt('about.contact.addressCopied', '地址已复制'), icon: 'none' })
        },
      })
    },
    [tt],
  )

  const contactItems = useMemo<ContactItem[]>(() => {
    const items: ContactItem[] = [
      {
        key: 'phone',
        icon: telIcon,
        label: tt('about.contact.phone', '电话'),
        value: info.phone,
        actionType: 'call',
      },
      {
        key: 'email',
        icon: sandMsgIcon,
        label: tt('about.contact.email', '邮箱'),
        value: info.email,
        actionType: 'copy',
      },
      {
        key: 'qq',
        icon: qqIcon,
        label: tt('about.contact.qq', 'QQ'),
        value: info.qq || '',
        actionType: 'copy',
      },
      {
        key: 'wechat',
        icon: wxIcon,
        label: tt('about.contact.wechat', '微信'),
        value: info.wechat || '',
        actionType: 'copy',
      },
    ]
    return items.filter((item) => item.value)
  }, [info, tt])

  useDidShow(() => load())

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background px-[28rpx] pt-[28rpx] pb-[64rpx]">
        <View className="pt-[32rpx] px-[8rpx] pb-[32rpx] text-center">
          <Text className="block text-[40rpx] font-bold text-foreground">
            {tt('about.contact.title', '联系我们')}
          </Text>
          <Text className="block text-[28rpx] text-muted-foreground mt-[12rpx]">
            {tt('about.contact.headerSub', '我们随时为您提供帮助')}
          </Text>
        </View>

        {contactItems.length > 0 ? (
          <View className="bg-card rounded-[24rpx] border border-border overflow-hidden mb-[24rpx]">
            {contactItems.map((item, idx) => (
              <View
                key={item.key}
                className={`flex items-center p-[28rpx]${idx > 0 ? ' mt-[16rpx]' : ''}`}
                onClick={() =>
                  item.actionType === 'call' ? call(item.value) : copy(item.value, item.label)
                }
                hoverClass="opacity-60"
              >
                {isImagePath(item.icon) ? (
                  <Image
                    src={item.icon}
                    className="w-[40rpx] h-[40rpx] flex-shrink-0"
                    mode="aspectFit"
                  />
                ) : (
                  <Text className="text-[40rpx] flex-shrink-0">{item.icon}</Text>
                )}
                <View className="flex-1 ml-[24rpx] mr-[16rpx]">
                  <Text className="block text-[22rpx] text-[var(--color-text-tertiary)]">
                    {item.label}
                  </Text>
                  <Text className="block text-[28rpx] text-foreground mt-[4rpx] break-all">
                    {item.value}
                  </Text>
                </View>
                <Text className="text-[28rpx] text-primary flex-shrink-0">
                  {item.actionType === 'call'
                    ? tt('about.contact.callBtn', '拨打')
                    : tt('about.contact.copyBtn', '复制')}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {info.address ? (
          <View className="bg-card rounded-[24rpx] border border-border overflow-hidden mb-[24rpx]">
            <View
              className="flex items-center p-[28rpx]"
              onClick={() => openLocation(info.address)}
              hoverClass="opacity-60"
            >
              <Image
                src={gongsiIcon}
                className="w-[40rpx] h-[40rpx] flex-shrink-0"
                mode="aspectFit"
              />
              <View className="flex-1 ml-[24rpx] mr-[16rpx]">
                <Text className="block text-[22rpx] text-[var(--color-text-tertiary)]">
                  {tt('about.contact.address', '地址')}
                </Text>
                <Text className="block text-[28rpx] text-foreground mt-[4rpx] break-all">
                  {info.address}
                </Text>
              </View>
              <Text className="text-[28rpx] text-primary flex-shrink-0">
                {tt('about.contact.copyBtn', '复制')}
              </Text>
            </View>
          </View>
        ) : null}

        <View className="bg-card rounded-[24rpx] border border-border overflow-hidden mb-[24rpx]">
          <View className="flex justify-between items-center py-[28rpx] px-[28rpx]">
            <Text className="text-[28rpx] text-[var(--color-text-medium)]">
              {tt('about.contact.workTimeLabel', '工作时间')}
            </Text>
            <Text className="text-[28rpx] text-[var(--color-text-tertiary)] text-right">
              {tt('about.contact.workTime', '周一至周五 9:00-18:00')}
            </Text>
          </View>
          <View className="flex justify-between items-center py-[28rpx] px-[28rpx] mt-[16rpx]">
            <Text className="text-[28rpx] text-[var(--color-text-medium)]">
              {tt('about.contact.responseLabel', '响应时间')}
            </Text>
            <Text className="text-[28rpx] text-[var(--color-text-tertiary)] text-right">
              {tt('about.contact.responseTime', '工作日内 24 小时内回复')}
            </Text>
          </View>
        </View>

        {info.phone ? (
          <View className="pt-[16rpx] pb-[16rpx]">
            <Button
              className="w-full h-[100rpx] leading-[100rpx] bg-primary text-[var(--color-primary-foreground)] text-[32rpx] font-semibold rounded-[24rpx] m-0 after:border-0"
              onClick={() => call(info.phone)}
            >
              {tt('about.contact.callNow', '立即拨打客服')}
            </Button>
          </View>
        ) : null}

        <View className="text-center pt-[16rpx]">
          <Text className="text-[22rpx] text-[var(--color-text-tertiary)]">
            {tt('about.contact.footer', '感谢您选择智汇 AI')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
