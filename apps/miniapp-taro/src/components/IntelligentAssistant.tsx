import { View, Text } from '@tarojs/components'
import { useI18n } from '@/i18n'
import './IntelligentAssistant.css'

export interface IntelligentAssistantProps {
  /** Token 余额(智汇值),由父组件传入 */
  tokenBalance?: number
  /** 是否已登录 */
  isLoggedIn?: boolean
  /** 点击充值按钮回调 */
  onRecharge?: () => void
}

function formatTokenValue(count: number): string {
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K'
  return String(count)
}

export default function IntelligentAssistant({
  tokenBalance = 0,
  isLoggedIn = false,
  onRecharge,
}: IntelligentAssistantProps) {
  const { t } = useI18n()
  return (
    <View className="ia-card">
      <Text className="ia-robot ia-float">🤖</Text>
      <View className="ia-content">
        <Text className="ia-greeting">{t('ai.intelligentAssistant.greeting')}</Text>
        <Text className="ia-subtitle">{t('ai.intelligentAssistant.subtitle')}</Text>
        <View className="ia-token-row">
          <Text className="ia-token-text">
            {isLoggedIn
              ? t('ai.intelligentAssistant.tokenBalance', { n: formatTokenValue(tokenBalance) })
              : t('ai.intelligentAssistant.loginRequired')}
          </Text>
          {isLoggedIn && (
            <Text className="ia-recharge-btn" onClick={onRecharge}>
              {t('ai.intelligentAssistant.recharge')}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}
