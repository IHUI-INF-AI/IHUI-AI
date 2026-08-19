import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getDeveloperPrice } from '@ihui/api-client'
import {
  DeveloperScreen as SharedDeveloperScreen,
  type DeveloperFeature,
  type DeveloperPlan,
  type DeveloperPlanType,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useWechatPayment } from '../hooks/useWechatPayment'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const FEATURES: DeveloperFeature[] = [
  { title: '上架智能体', desc: '创建并发布你的 AI 助手' },
  { title: '收益分成', desc: '限时 0 服务费,全额到账' },
  { title: '数据分析', desc: '实时查看调用与收益' },
  { title: 'n8n 工作流', desc: '接入 n8n 自动化能力' },
]

function buildPlans(priceData: { price: number; [key: string]: unknown }): DeveloperPlan[] {
  const monthPrice =
    typeof priceData.monthPrice === 'number'
      ? priceData.monthPrice
      : Math.round(priceData.price / 10)
  const yearPrice = typeof priceData.yearPrice === 'number' ? priceData.yearPrice : priceData.price
  return [
    {
      type: 'month',
      label: '开发者包月',
      price: monthPrice,
      unit: '月',
      perks: ['智能体上架 10 个', '收益结算 T+1', '基础数据分析'],
    },
    {
      type: 'year',
      label: '开发者包年',
      price: yearPrice,
      unit: '年',
      perks: ['智能体上架 100 个', '收益结算 T+0', '高级数据分析', '专属客服'],
    },
  ]
}

export default function DeveloperScreen() {
  const { t } = useI18n()
  const navigation = useNavigation<NavigationProp>()
  const [selected, setSelected] = useState<DeveloperPlanType>('year')
  const [submitting, setSubmitting] = useState(false)
  const [plans, setPlans] = useState<DeveloperPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // 真实微信支付链(对齐 VipScreen 范式):orderType=5 开发者套餐订阅
  const { paying, pay } = useWechatPayment({
    orderType: 5,
    onSuccess: () => {
      // 订阅成功后返回,让来源页刷新订阅状态
      navigation.goBack()
    },
  })

  const load = useCallback(async () => {
    setError('')
    try {
      const resp = await getDeveloperPrice()
      if (!resp.success) throw new Error(resp.error)
      setPlans(buildPlans(resp.data))
    } catch {
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = () => {
    setRefreshing(true)
    void load()
  }

  // 提交订阅:按所选套餐价格发起微信支付(替换原 setTimeout mock)
  const handleOpen = () => {
    const plan = plans.find((p) => p.type === selected)
    if (!plan || paying) return
    const amountCents = Math.round(plan.price * 100)
    if (!amountCents || amountCents <= 0) return
    setSubmitting(true)
    void pay(amountCents, `开发者${plan.type === 'year' ? '包年' : '包月'}订阅`).finally(() => {
      setSubmitting(false)
    })
  }

  return (
    <SharedDeveloperScreen
      t={t}
      features={FEATURES}
      plans={plans}
      selected={selected}
      loading={loading}
      refreshing={refreshing}
      error={error}
      submitting={submitting}
      onSelectChange={setSelected}
      onRefresh={onRefresh}
      onSubmit={handleOpen}
    />
  )
}
