import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useI18n } from '@/i18n'
import './fail.css'

export default function RechargeFail() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const router = useRouter()
  const [orderNo, setOrderNo] = useState('')
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')

  useEffect(() => {
    setOrderNo(decodeURIComponent(router.params.orderNo || ''))
    setAmount(Number(router.params.amount) || 0)
    setReason(decodeURIComponent(router.params.reason || ''))
  }, [router.params.orderNo, router.params.amount, router.params.reason])

  const retry = () => {
    Taro.redirectTo({ url: '/pages/wallet/recharge/index' })
  }

  const goBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/user/index' }) })
  }

  const viewDetail = () => {
    Taro.navigateTo({ url: '/pages/token/balance' })
  }

  return (
    <View className="rf-page">
      <View className="rf-head">
        <View className="rf-icon">
          <Text className="rf-icon-mark">✕</Text>
        </View>
        <Text className="rf-title">{tt('wallet.recharge.fail.title', '充值失败')}</Text>
        <Text className="rf-desc">{tt('wallet.recharge.fail.desc', '充值未成功,请稍后重试')}</Text>
      </View>

      <View className="rf-hint">
        <Text className="rf-hint-title">{tt('wallet.recharge.fail.hintTitle', '温馨提示')}</Text>
        <Text className="rf-hint-text">
          {tt(
            'wallet.recharge.fail.hintText',
            '如充值未到账,请确认支付是否完成。款项将在 1-3 个工作日内原路退回,或联系客服协助处理。',
          )}
        </Text>
      </View>

      {(reason || orderNo || amount > 0) && (
        <View className="rf-card">
          {reason ? (
            <View className="rf-row">
              <Text className="rf-row-label">{tt('wallet.recharge.fail.reasonLabel', '失败原因')}</Text>
              <Text className="rf-row-value rf-row-value--reason">{reason}</Text>
            </View>
          ) : null}
          {orderNo ? (
            <View className="rf-row">
              <Text className="rf-row-label">{tt('wallet.recharge.fail.orderNoLabel', '订单号')}</Text>
              <Text className="rf-row-value rf-row-value--mono">{orderNo}</Text>
            </View>
          ) : null}
          {amount > 0 ? (
            <View className="rf-row">
              <Text className="rf-row-label">{tt('wallet.recharge.fail.amountLabel', '充值金额')}</Text>
              <Text className="rf-row-value rf-row-value--amount">¥{amount.toFixed(2)}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View className="rf-actions">
        <Button className="rf-btn rf-btn--primary" onClick={retry}>
          {tt('wallet.recharge.fail.retry', '重新充值')}
        </Button>
        <Button className="rf-btn rf-btn--ghost" onClick={goBack}>
          {tt('wallet.recharge.fail.backWallet', '返回钱包')}
        </Button>
        <Button className="rf-btn rf-btn--ghost" onClick={viewDetail}>
          {tt('wallet.recharge.fail.viewDetail', '查看明细')}
        </Button>
        <Button className="rf-btn rf-btn--contact" openType="contact">
          {tt('wallet.recharge.fail.contactService', '联系客服')}
        </Button>
      </View>

      <View className="rf-faq">
        <Text className="rf-faq-q">{tt('wallet.recharge.fail.faqQ', '充值失败会扣款吗?')}</Text>
        <Text className="rf-faq-a">
          {tt(
            'wallet.recharge.fail.faqA',
            '若支付未完成则不会扣款;若已扣款但显示失败,款项将原路退回,请留意账户变动。',
          )}
        </Text>
      </View>
    </View>
  )
}
