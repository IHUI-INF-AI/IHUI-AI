import { View, Text } from '@tarojs/components'
import { useCallback } from 'react'
import { useI18n } from '@/i18n'
import './index.css'

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

  const labels = [
    tt('about.modelRecord.modelName', '模型名称'),
    tt('about.modelRecord.recordNo', '备案号'),
    tt('about.modelRecord.provider', '提供方'),
    tt('about.modelRecord.algoType', '算法类型'),
    tt('about.modelRecord.recordDate', '备案日期'),
  ]
  const info = labels.map((label, i) => ({ label, value: VALUES[i] || '' }))

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
