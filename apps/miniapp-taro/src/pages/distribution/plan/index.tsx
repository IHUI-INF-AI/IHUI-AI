import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'

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
    <View className="min-h-screen bg-background p-[24rpx] pb-[200rpx]">
      <View className="bg-card border border-border rounded-[16rpx] py-[40rpx] px-[32rpx] mb-[24rpx]">
        <Text className="block text-[36rpx] font-bold text-foreground">
          {tt('distribution.plan.introTitle', '邀请好友,赚取佣金')}
        </Text>
        <Text className="block text-[26rpx] text-muted-foreground mt-[16rpx] leading-[1.6]">
          {tt(
            'distribution.plan.introDesc',
            '加入我们的分佣计划,邀请好友注册成为会员,您将获得会员费20%的佣金收益',
          )}
        </Text>
      </View>

      <View className="flex bg-card border border-border rounded-[16rpx] py-[32rpx] mb-[24rpx]">
        <View className="flex-1 text-center">
          <Text className="block text-[40rpx] font-bold text-primary">¥{totalEarnings.toFixed(2)}</Text>
          <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
            {tt('distribution.plan.totalEarnings', '累计收益')}
          </Text>
        </View>
        <View className="flex-1 text-center">
          <Text className="block text-[40rpx] font-bold text-primary">{inviteCount}</Text>
          <Text className="block text-[24rpx] text-muted-foreground mt-[12rpx]">
            {tt('distribution.plan.inviteCount', '邀请人数')}
          </Text>
        </View>
      </View>

      <View className="bg-card border border-border rounded-[16rpx] p-[32rpx]">
        <Text className="block text-[30rpx] font-semibold text-foreground mb-[24rpx]">
          {tt('distribution.plan.rulesTitle', '分佣规则')}
        </Text>
        <View className="flex flex-col gap-[16rpx]">
          {rules.map((r, i) => (
            <View key={i} className="flex items-start">
              <View className="w-[40rpx] h-[40rpx] rounded-md bg-primary text-primary-foreground text-[24rpx] font-bold flex items-center justify-center mr-[20rpx] flex-shrink-0">
                <Text>{i + 1}</Text>
              </View>
              <Text className="flex-1 text-[26rpx] text-foreground leading-[1.6] pt-[2rpx]">{r}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="fixed left-0 right-0 bottom-0 pt-[24rpx] px-[32rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))] bg-card shadow-[0_-4rpx_16rpx_rgba(0,0,0,0.3)]">
        <View className="h-[88rpx] leading-[88rpx] text-center bg-primary text-primary-foreground text-[30rpx] font-semibold rounded-[12rpx] active:opacity-85" onClick={onOpenVip}>
          <Text>{tt('distribution.plan.openVipBtn', '开通VIP会员 参与分佣计划')}</Text>
        </View>
      </View>
    </View>
  )
}
