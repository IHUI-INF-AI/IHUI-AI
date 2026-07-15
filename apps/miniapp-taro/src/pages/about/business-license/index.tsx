import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import './index.css'

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
  const labels = tList('about.businessLicense.labels')
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
      <View className="card scope-card">
        <Text className="scope-title">{t('about.businessLicense.scopeTitle')}</Text>
        <Text className="scope-text">{SCOPE}</Text>
      </View>
      <View className="tips">
        <Text>{t('about.businessLicense.footer')}</Text>
      </View>
    </View>
  )
}
