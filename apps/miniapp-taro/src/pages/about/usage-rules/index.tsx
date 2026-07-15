import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import './index.css'

export default function UsageRules() {
  const { t, tList } = useI18n()
  const titles = tList('about.usageRules.titles')
  const sections = [
    tList('about.usageRules.account'),
    tList('about.usageRules.content'),
    tList('about.usageRules.usage'),
    tList('about.usageRules.disclaimer'),
  ]

  return (
    <View className="page">
      {titles.map((title, i) => {
        const items = sections[i] || []
        return (
          <View key={title} className="card">
            <Text className="section-title">{title}</Text>
            {items.map((item, idx) => (
              <View key={idx} className="rule-item">
                <Text className="dot">·</Text>
                <Text className="rule-text">{item}</Text>
              </View>
            ))}
          </View>
        )
      })}
      <View className="tips">
        <Text>{t('about.usageRules.footer')}</Text>
      </View>
    </View>
  )
}
