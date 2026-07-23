import { logger } from '@/utils/logger'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

interface VipPriceData {
  amount: number
}

const DEFAULT_AMOUNT = 1999

// 操盘手权益(对标原 vip/trader.vue features 4 项)
const TRADER_FEATURES = [
  { icon: '🏅', key: 'distribution_qualification', title: '分销资格', desc: '享受大额分销资格,入驻社区服务商名列' },
  { icon: '🎓', key: 'ai_courses', title: 'AI 课程', desc: 'AI深度认知课,降维看世界课程/深度商业课/流量全链路打法课程/免费观看' },
  { icon: '🤝', key: 'founder_qa', title: '创始人答疑', desc: '创始人一对一随时答疑陪跑' },
  { icon: '🧪', key: 'agent_beta', title: 'Agent 内测', desc: '最新研发agent内测资格一年' },
]

export default function VipTraderIndexPage() {
  const { t } = useI18n()
  const tt = useCallback((k: string, fb: string) => {
    const v = t(k)
    return v === k ? fb : v
  }, [t])
  const [amount, setAmount] = useState(DEFAULT_AMOUNT)

  const load = useCallback(async () => {
    try {
      const res = await api.get<VipPriceData>('/vip/price')
      if (res && typeof res.amount === 'number' && res.amount > 0) {
        setAmount(res.amount)
      }
    } catch (e) {
      logger.error('vip-trader', '获取操盘手价格', e)
    }
  }, [])

  useDidShow(load)

  const handlePayment = useCallback(() => {
    Taro.showToast({ title: tt('vipTrader.opened', '开通成功'), icon: 'success' })
  }, [tt])

  const openPopup = useCallback(() => {
    Taro.showModal({
      title: tt('vipTrader.openTitle', '开通会员'),
      content: `${tt('vipTrader.confirmPay', '确认支付')} ¥${amount} ${tt('vipTrader.openTrader', '开通操盘手会员')}?`,
      success: (res) => {
        if (res.confirm) {
          handlePayment()
        }
      },
    })
  }, [amount, handlePayment, tt])

  return (
    <View className="vip-trader-page">
      <View className="trader-header">
        <Text className="trader-title">{tt('vipTrader.brandTitle', 'AI智汇社 操盘手')}</Text>
        <Text className="trader-subtitle">
          {tt('vipTrader.oncePay', '一次性支付')}¥{amount}{tt('vipTrader.lifetimeUse', '元,终身使用')}
        </Text>
        <View className="trader-price-wrap">
          <Text className="trader-price-symbol">¥</Text>
          <Text className="trader-price">{amount}</Text>
        </View>
      </View>

      <View className="trader-section">
        <Text className="section-title">{tt('vipTrader.featureSection', '操盘手权益')}</Text>
        <View className="feature-list">
          {TRADER_FEATURES.map((f) => (
            <View key={f.key} className="feature-item">
              <View className="feature-icon">
                <Text>{f.icon}</Text>
              </View>
              <View className="feature-content">
                <Text className="feature-title">{f.title}</Text>
                <Text className="feature-desc">{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="trader-footer">
        <View className="footer-price">
          <Text className="footer-price-symbol">¥</Text>
          <Text className="footer-price-value">{amount}</Text>
        </View>
        <Button className="footer-btn" onClick={openPopup}>
          {tt('vipTrader.openNow', '一键开通会员')}
        </Button>
      </View>
    </View>
  )
}
