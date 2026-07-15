import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import './index.css'

const VALUES = [
  '智汇AI对话大模型',
  '粤网信备4401060000001号',
  '广州智汇科技有限公司',
  '生成合成类（深度合成）',
  '语言模型（LLM）',
  '文本对话、内容创作、智能问答',
  '2026-02-20',
  '2026-02-20 至 2029-02-19',
]

export default function ModelRecord() {
  const { t, tList } = useI18n()
  const labels = tList('about.modelRecord.labels')
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
      <View className="card notice-card">
        <Text className="notice-title">{t('about.modelRecord.noticeTitle')}</Text>
        <Text className="notice-text">{t('about.modelRecord.noticeText')}</Text>
      </View>
      <View className="tips">
        <Text>{t('about.modelRecord.footer')}</Text>
      </View>
    </View>
  )
}
