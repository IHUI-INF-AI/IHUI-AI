import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useI18n } from '@/i18n'
import './index.css'

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

  const labels = tList('about.businessLicense.labels')
  const fallbackLabels = [
    '统一社会信用代码',
    '名称',
    '类型',
    '法定代表人',
    '注册资本',
    '成立日期',
    '营业期限',
    '经营范围',
  ]
  const finalLabels =
    labels.length >= VALUES.length ? labels.slice(0, VALUES.length) : fallbackLabels
  const info = finalLabels.map((label, i) => ({ label, value: VALUES[i] || '' }))

  const previewLicense = useCallback(() => {
    if (imgError) return
    Taro.previewImage({ urls: [LICENSE_IMAGE], current: LICENSE_IMAGE })
  }, [imgError])

  return (
    <View className="page">
      <View className="license-wrap">
        {!imgError ? (
          <Image
            className="license-image"
            src={LICENSE_IMAGE}
            mode="widthFix"
            onClick={previewLicense}
            onError={() => setImgError(true)}
          />
        ) : (
          <View className="license-fallback" onClick={previewLicense}>
            <Text className="license-fallback-text">
              {tt('about.businessLicense.tapToView', '点击查看营业执照')}
            </Text>
          </View>
        )}
      </View>

      <View className="card">
        {info.map((item, idx) => (
          <View key={item.label} className={`row${idx === info.length - 1 ? ' last' : ''}`}>
            <Text className="label">{item.label}</Text>
            <Text className="value">{item.value}</Text>
          </View>
        ))}
      </View>

      <View className="card scope-card">
        <Text className="scope-title">
          {tt('about.businessLicense.scopeTitle', '经营范围')}
        </Text>
        <Text className="scope-text">{SCOPE}</Text>
      </View>

      <View className="tips">
        <Text>{tt('about.businessLicense.footer', '以上信息仅供参考,以工商登记为准')}</Text>
      </View>
    </View>
  )
}
