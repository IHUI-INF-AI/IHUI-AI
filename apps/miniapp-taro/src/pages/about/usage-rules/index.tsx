import { View, Text } from '@tarojs/components'
import { useCallback } from 'react'
import { useI18n } from '@/i18n'
import './index.css'

const IP_ITEMS_FB = [
  '用户发布内容须拥有合法知识产权',
  '禁止侵犯他人著作权、商标权等权益',
]

export default function UsageRules() {
  const { t, tList } = useI18n()
  const tt = useCallback(
    (k: string, fb: string) => {
      const v = t(k)
      return v === k ? fb : v
    },
    [t],
  )

  const titles = [
    tt('about.usageRules.titleAccount', '一、账号使用'),
    tt('about.usageRules.titleContent', '二、内容规范'),
    tt('about.usageRules.titleForbid', '三、禁止行为'),
    tt('about.usageRules.titleIP', '四、知识产权'),
    tt('about.usageRules.titleDisclaimer', '五、免责声明'),
  ]
  const ipItems = tList('about.usageRules.ip')
  const sections = [
    tList('about.usageRules.account').slice(0, 2),
    tList('about.usageRules.content').slice(0, 2),
    tList('about.usageRules.usage').slice(0, 2),
    ipItems.length >= 2 ? ipItems.slice(0, 2) : IP_ITEMS_FB,
    tList('about.usageRules.disclaimer').slice(0, 2),
  ]

  let ruleNo = 0

  return (
    <View className="page">
      {titles.map((title, i) => {
        const items = sections[i] || []
        return (
          <View key={title} className="card">
            <Text className="section-title">{title}</Text>
            {items.map((item, idx) => {
              ruleNo += 1
              return (
                <View key={idx} className="rule-item">
                  <Text className="num">{ruleNo}.</Text>
                  <Text className="rule-text">{item}</Text>
                </View>
              )
            })}
          </View>
        )
      })}
      <View className="tips">
        <Text>{t('about.usageRules.footer')}</Text>
      </View>
    </View>
  )
}
