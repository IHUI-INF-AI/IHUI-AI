import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useI18n } from '@/i18n'
import './index.css'

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
    <View className="page">
      <View className="table-title">
        <Text>{tt('about.modelRecord.tableTitle', '大模型备案信息')}</Text>
      </View>

      <View className="card table">
        {info.map((item, idx) => (
          <View key={item.label} className={`table-row${idx === info.length - 1 ? ' last' : ''}`}>
            <Text className="cell-label">{item.label}</Text>
            <Text className="cell-value">{item.value}</Text>
          </View>
        ))}
      </View>

      <View className="card-wrap">
        {IMAGE_LIST.map((img, index) =>
          errorSet.has(index) ? null : (
            <Image
              key={index}
              className="record-image"
              src={img}
              mode="widthFix"
              onClick={() => previewImages(index)}
              onError={() => markError(index)}
            />
          ),
        )}
        {validImages.length === 0 ? (
          <View className="image-fallback">
            <Text className="image-fallback-text">
              {tt('about.modelRecord.imageUnavailable', '备案图片暂未上传')}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="card notice-card">
        <Text className="notice-title">
          {tt('about.modelRecord.noticeTitle', '模型信息公示')}
        </Text>
        <Text className="notice-text">
          {tt(
            'about.modelRecord.noticeText',
            '本应用使用人工智能技术,以下为所用模型信息',
          )}
        </Text>
      </View>

      <View className="tips">
        <Text>{tt('about.modelRecord.footer', '模型信息仅供参考')}</Text>
      </View>
    </View>
  )
}
