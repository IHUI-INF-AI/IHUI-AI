import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useI18n } from '@/i18n'

const LICENSE_IMAGE = '/static/images/yyzz.jpg'

const VALUES = [
  '91440101MA9X0000X1',
  '广州智汇科技有限公司',
  '张三',
  '1000万元人民币',
  '2023-06-15',
  '2023-06-15 至 长期',
  '有限责任公司',
  '广州市市场监督管理局',
]

const SCOPE =
  '技术服务、技术开发、技术咨询、技术交流、技术转让、技术推广；软件开发；信息系统集成服务；信息技术咨询服务；互联网信息服务。'

export default function BusinessLicense() {
  const { t, tList } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [imgError, setImgError] = useState(false)

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: tt('about.businessLicense.title', '营业执照') })
  })

  const labels = tList('about.businessLicense.labels').slice(0, VALUES.length)
  const info = labels.map((label, i) => ({ label, value: VALUES[i] || '' }))

  const previewLicense = useCallback(() => {
    if (imgError) return
    Taro.previewImage({ urls: [LICENSE_IMAGE], current: LICENSE_IMAGE })
  }, [imgError])

  return (
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
  )
}
