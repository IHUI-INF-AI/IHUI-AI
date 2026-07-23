import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import './index.css'

export default function DistributionPlan() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [inviteCount, setInviteCount] = useState(0)

  useDidShow(() => {
    api
      .getDistributionInfo()
      .then((res) => {
        setTotalEarnings(
          (res as unknown as { totalCommission?: number }).totalCommission ?? 0,
        )
      })
      .catch(() => {})
    api
      .getDistributionTeam({ page: 1, pageSize: 1 })
      .then((res) => {
        setInviteCount(res.total ?? 0)
      })
      .catch(() => {})
  })

  const onOpenVip = () => {
    Taro.showModal({
      title: tt('distribution.plan.openVipTitle', '开通VIP会员'),
      content: tt(
        'distribution.plan.openVipContent',
        '是否前往开通VIP会员,参与分佣计划?',
      ),
      confirmText: tt('distribution.plan.confirm', '确认'),
      cancelText: tt('distribution.plan.cancel', '取消'),
      success: (res) => {
        if (res.confirm) {
          Taro.navigateTo({ url: '/pages/vip/index' })
        }
      },
    })
  }

  const rules = [
    tt('distribution.plan.rule1', '成为VIP会员后可参与分佣计划'),
    tt('distribution.plan.rule2', '邀请好友成为会员,您将获得会员费20%的佣金'),
    tt(
      'distribution.plan.rule3',
      '佣金将在好友支付成功后24小时内自动结算到您的账户',
    ),
    tt('distribution.plan.rule4', '账户余额满100元可申请提现到微信或支付宝'),
  ]

  return (
    <View className="plan-page">
      <View className="plan-intro">
        <Text className="plan-intro-title">
          {tt('distribution.plan.introTitle', '邀请好友,赚取佣金')}
        </Text>
        <Text className="plan-intro-desc">
          {tt(
            'distribution.plan.introDesc',
            '加入我们的分佣计划,邀请好友注册成为会员,您将获得会员费20%的佣金收益',
          )}
        </Text>
      </View>

      <View className="plan-stats">
        <View className="plan-stats-item">
          <Text className="plan-stats-num">¥{totalEarnings.toFixed(2)}</Text>
          <Text className="plan-stats-label">
            {tt('distribution.plan.totalEarnings', '累计收益')}
          </Text>
        </View>
        <View className="plan-stats-item">
          <Text className="plan-stats-num">{inviteCount}</Text>
          <Text className="plan-stats-label">
            {tt('distribution.plan.inviteCount', '邀请人数')}
          </Text>
        </View>
      </View>

      <View className="plan-rules">
        <Text className="plan-rules-title">
          {tt('distribution.plan.rulesTitle', '分佣规则')}
        </Text>
        <View className="plan-rules-list">
          {rules.map((r, i) => (
            <View key={i} className="plan-rules-item">
              <Text className="plan-rules-index">{i + 1}.</Text>
              <Text className="plan-rules-text">{r}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="plan-footer">
        <View className="plan-footer-btn" onClick={onOpenVip}>
          <Text>{tt('distribution.plan.openVipBtn', '开通VIP会员 参与分佣计划')}</Text>
        </View>
      </View>
    </View>
  )
}
