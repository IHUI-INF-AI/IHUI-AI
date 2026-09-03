// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n, t } from '@/i18n'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import ThemeRoot from '@/components/ThemeRoot'

const LICENSE_IMAGE = '/static/images/yyzz.jpg'

const VALUES = [
  '91440101MA9X0000X1',
  t('aboutBusinesslicense.r1'),
  t('message.demo.zhangsan'),
  t('aboutBusinesslicense.r2'),
  '2023-06-15',
  t('aboutBusinesslicense.r3'),
  t('aboutBusinesslicense.r4'),
  t('aboutBusinesslicense.r5'),
]

const SCOPE = t('aboutBusinesslicense.r6')

export default function BusinessLicense() {
  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: tt('about.businessLicense.title', '营业执照') })
  })
  const { t, tList } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [imgError, setImgError] = useState(false)

  const labels = tList('about.businessLicense.labels').slice(0, VALUES.length)
  const info = labels.map((label, i) => ({ label, value: VALUES[i] || '' }))

  const previewLicense = useCallback(() => {
    if (imgError) return
    Taro.previewImage({ urls: [LICENSE_IMAGE], current: LICENSE_IMAGE })
  }, [imgError])

  return (
    <ThemeRoot>
      <View className="min-h-screen bg-background pb-[48rpx]">
        <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden p-[24rpx] box-border">
          {!imgError ? (
            <Image
              className="w-full block rounded-[8rpx]"
              src={LICENSE_IMAGE}
              mode="widthFix"
              onClick={previewLicense}
              onError={() => setImgError(true)}
            />
          ) : (
            <View
              className="flex items-center justify-center h-[400rpx] bg-muted rounded-[8rpx]"
              onClick={previewLicense}
            >
              <Text className="text-[28rpx] text-muted-foreground">
                {tt('about.businessLicense.tapToView', '点击查看营业执照')}
              </Text>
            </View>
          )}
        </View>

        <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
          {info.map((item, idx) => (
            <View
              key={item.label}
              className={`flex justify-between items-center p-[32rpx]${idx === 0 ? '' : ' mt-[16rpx]'}`}
            >
              <Text className="text-[28rpx] text-muted-foreground flex-shrink-0">{item.label}</Text>
              <Text className="text-[28rpx] text-foreground text-right ml-[24rpx] break-all">
                {item.value}
              </Text>
            </View>
          ))}
        </View>

        <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden p-[32rpx]">
          <Text className="block text-[28rpx] text-foreground font-medium mb-[16rpx]">
            {tt('about.businessLicense.scopeTitle', '经营范围')}
          </Text>
          <Text className="text-[26rpx] text-muted-foreground leading-[1.8]">{SCOPE}</Text>
        </View>

        <View className="py-[24rpx] px-[32rpx]">
          <Text className="text-[22rpx] text-muted-foreground leading-[1.7]">
            {tt('about.businessLicense.footer', '以上信息仅供参考,以工商登记为准')}
          </Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
