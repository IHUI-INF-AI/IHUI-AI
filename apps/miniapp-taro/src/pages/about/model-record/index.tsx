import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useI18n } from '@/i18n'

const IMAGE_LIST = [
  '/static/images/modelRecord1.png',
  '/static/images/modelRecord2.png',
  '/static/images/modelRecord3.png',
  '/static/images/modelRecord4.png',
]

const VALUES = [
  '智汇AI对话大模型',
  '粤网信备4401060000001号',
  '广州智汇科技有限公司',
  '生成合成类(深度合成)',
  '2026-02-20',
]

export default function ModelRecord() {
  const { t } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )
  const [errorSet, setErrorSet] = useState<Set<number>>(new Set())

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: tt('about.modelRecord.title', '模型备案') })
  })

  const labels = [
    tt('about.modelRecord.modelName', '模型名称'),
    tt('about.modelRecord.recordNo', '备案号'),
    tt('about.modelRecord.provider', '提供方'),
    tt('about.modelRecord.algoType', '算法类型'),
    tt('about.modelRecord.recordDate', '备案日期'),
  ]
  const info = labels.map((label, i) => ({ label, value: VALUES[i] || '' }))

  const validImages = IMAGE_LIST.filter((_, i) => !errorSet.has(i))

  const previewImages = useCallback(
    (current: number) => {
      if (validImages.length === 0) return
      const currentUrl = IMAGE_LIST[current]
      Taro.previewImage({ urls: validImages, current: currentUrl })
    },
    [validImages],
  )

  const markError = useCallback((index: number) => {
    setErrorSet((prev) => {
      const next = new Set(prev)
      next.add(index)
      return next
    })
  }, [])

  return (
    <View className="min-h-screen bg-background pb-[48rpx]">
      <View className="pt-[32rpx] px-[32rpx]">
        <Text className="text-[30rpx] text-foreground font-semibold">
          {tt('about.modelRecord.tableTitle', '大模型备案信息')}
        </Text>
      </View>

      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden">
        {info.map((item, idx) => (
          <View
            key={item.label}
            className={`flex items-start py-[28rpx] px-[32rpx]${idx === 0 ? '' : ' mt-[16rpx]'}`}
          >
            <Text className="text-[26rpx] text-muted-foreground flex-shrink-0 w-[160rpx]">
              {item.label}
            </Text>
            <Text className="flex-1 text-[26rpx] text-foreground break-all">{item.value}</Text>
          </View>
        ))}
      </View>

      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden p-[24rpx] box-border">
        {IMAGE_LIST.map((img, index) =>
          errorSet.has(index) ? null : (
            <Image
              key={index}
              className="w-full block rounded-[8rpx] mb-[24rpx]"
              src={img}
              mode="widthFix"
              onClick={() => previewImages(index)}
              onError={() => markError(index)}
            />
          ),
        )}
        {validImages.length === 0 ? (
          <View className="flex items-center justify-center h-[300rpx]">
            <Text className="text-[26rpx] text-muted-foreground">
              {tt('about.modelRecord.imageUnavailable', '备案图片暂未上传')}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="m-[24rpx] bg-card rounded-[16rpx] overflow-hidden p-[32rpx]">
        <Text className="block text-[28rpx] text-foreground font-medium mb-[16rpx]">
          {tt('about.modelRecord.noticeTitle', '模型信息公示')}
        </Text>
        <Text className="text-[26rpx] text-muted-foreground leading-[1.8]">
          {tt(
            'about.modelRecord.noticeText',
            '本应用使用人工智能技术,以下为所用模型信息',
          )}
        </Text>
      </View>

      <View className="text-center p-[32rpx]">
        <Text className="text-[22rpx] text-muted-foreground">
          {tt('about.modelRecord.footer', '模型信息仅供参考')}
        </Text>
      </View>
    </View>
  )
}
