/**
 * DevEnterCoverScreen 开发者开通封面(mobile-rn 端)
 *
 * 对齐历史项目 pagesA/dev_enter/cover.vue(开发者包月/包年 + 一键开通):
 * - 原「一键开通」= 微信支付(pay 商品类型 3,月/年套餐),支付成功 emit('go') 返回
 * - RN:选套餐(month/year) + getDeveloperPrice 取价 + useWechatPayment 发起微信支付(orderType=5 开发者订阅)
 * - 支付成功 → goBack 回开发者空间页(DeveloperScreen)刷新开通状态
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getDeveloperPrice } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { useWechatPayment } from '../hooks/useWechatPayment'
import { DevEnterCoverScreen as SharedDevEnterCoverScreen } from '@ihui/rn-app'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>
type PlanType = 'month' | 'year'

export function DevEnterCoverScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [selected, setSelected] = useState<PlanType>('year')
  const [price, setPrice] = useState<{ month: number; year: number }>({ month: 100, year: 1000 })
  const [submitting, setSubmitting] = useState(false)

  // 真实微信支付链(对齐原 cover.vue pay:开发者套餐订阅,orderType=5 与 DeveloperScreen 原实现一致)
  const { paying, pay } = useWechatPayment({
    orderType: 5,
    onSuccess: () => {
      // 支付成功 → 返回开发者空间页刷新开通状态(对齐原 emit('go'))
      navigation.goBack()
    },
  })

  // 拉取开发者套餐价格(对齐原 getDevInfo price.month/price.year;失败保留默认 100/1000)
  const loadPrice = useCallback(async (): Promise<void> => {
    try {
      const res = await getDeveloperPrice()
      if (res.success && res.data) {
        const d = res.data as { price?: number; monthPrice?: number; yearPrice?: number }
        setPrice({
          month:
            typeof d.monthPrice === 'number' ? d.monthPrice : Math.round((d.price ?? 1000) / 10),
          year: typeof d.yearPrice === 'number' ? d.yearPrice : (d.price ?? 1000),
        })
      }
    } catch {
      // 价格加载失败:保持默认,不阻塞开通
    }
  }, [])

  useEffect(() => {
    void loadPrice()
  }, [loadPrice])

  const onEnter = (): void => {
    if (paying || submitting) return
    const amountCents = Math.round(price[selected] * 100)
    if (!amountCents || amountCents <= 0) {
      Alert.alert(t('common.hint'), '套餐价格异常,请稍后重试')
      return
    }
    setSubmitting(true)
    void pay(amountCents, `开发者${selected === 'year' ? '包年' : '包月'}订阅`).finally(() => {
      setSubmitting(false)
    })
  }

  return (
    <SharedDevEnterCoverScreen
      t={t}
      planType={selected}
      loading={submitting || paying}
      onSelectPlan={setSelected}
      onNavigate={onEnter}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}

export default DevEnterCoverScreen
