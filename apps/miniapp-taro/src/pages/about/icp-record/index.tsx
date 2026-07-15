import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import './index.css'

const VALUES = [
  '粤ICP备2026000001号-1',
  '广州智汇科技有限公司',
  '企业',
  '智汇AI',
  '2026-01-15',
  '广东省通信管理局',
]

export default function IcpRecord() {
  const { t, tList } = useI18n()
  const labels = tList('about.icpRecord.labels')
  const info = labels.map((label, i) => ({ label, value: VALUES[i] || '' }))

  return (
    <View className="page">
      <View className="card">
        {info.map((item, idx) => (
          <View key={item.label} className={`row${idx === info.length - 1 ? ' last' : ''}`}>
            <Text className="label">{item.label}</Text>
            <Text className="value">{item.value}</Text>
          </View>
        ))}
      </View>
      <View className="tips">
        <Text>{t('about.icpRecord.footer')}</Text>
      </View>
    </View>
  )
}
