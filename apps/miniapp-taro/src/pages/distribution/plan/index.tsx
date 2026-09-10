// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import * as api from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

export default function DistributionPlan() {
  const tt = useTt()
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [inviteCount, setInviteCount] = useState(0)

  useDidShow(() => {
    api
      .getDistributionInfo()
      .then((res) => {
        setTotalEarnings((res as unknown as { totalCommission?: number }).totalCommission ?? 0)
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
      content: tt('distribution.plan.openVipContent', '是否前往开通VIP会员,参与分佣计划?'),
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
    tt('distribution.plan.rule3', '佣金将在好友支付成功后24小时内自动结算到您的账户'),
    tt('distribution.plan.rule4', '账户余额满100元可申请提现到微信或支付宝'),
  ]

  return (
    <ThemeRoot className="min-h-screen bg-background p-[28rpx] pb-[200rpx]">
      {/* 对齐 RN EarnCommissionScreen introCard:标题+描述+统计同卡,内容居中 */}
      <View className="bg-card rounded-[24rpx] p-[28rpx] flex flex-col items-center gap-[24rpx]">
        <Text className="block text-[36rpx] font-bold text-foreground text-center">
          {tt('distribution.plan.introTitle', '邀请好友,赚取佣金')}
        </Text>
        <Text className="block text-[28rpx] text-muted-foreground text-center leading-[40rpx]">
          {tt(
            'distribution.plan.introDesc',
            '加入我们的分佣计划,邀请好友注册成为会员,您将获得会员费20%的佣金收益',
          )}
        </Text>
        <View className="flex flex-row justify-around w-full mt-[16rpx]">
          <View className="flex flex-col items-center gap-[12rpx]">
            <Text className="block text-[44rpx] font-bold text-[var(--color-primary)]">
              ¥{totalEarnings.toFixed(2)}
            </Text>
            <Text className="block text-[28rpx] text-muted-foreground">
              {tt('distribution.plan.totalEarnings', '累计收益')}
            </Text>
          </View>
          <View className="flex flex-col items-center gap-[12rpx]">
            <Text className="block text-[44rpx] font-bold text-[var(--color-primary)]">
              {inviteCount}
            </Text>
            <Text className="block text-[28rpx] text-muted-foreground">
              {tt('distribution.plan.inviteCount', '邀请人数')}
            </Text>
          </View>
        </View>
      </View>

      {/* 对齐 RN sectionCard:白卡 + 居中标题 + 圆形序号规则列表 */}
      <View className="bg-card rounded-[24rpx] p-[28rpx] mt-[24rpx] flex flex-col gap-[24rpx]">
        <Text className="block text-[32rpx] font-semibold text-foreground text-center">
          {tt('distribution.plan.rulesTitle', '分佣规则')}
        </Text>
        {rules.map((r, i) => (
          <View key={i} className="flex flex-row items-center gap-[24rpx]">
            <View className="w-[44rpx] h-[44rpx] rounded-full bg-primary text-primary-foreground text-[28rpx] font-semibold flex items-center justify-center flex-shrink-0">
              <Text>{i + 1}</Text>
            </View>
            <Text className="flex-1 text-[28rpx] text-foreground leading-[38rpx]">{r}</Text>
          </View>
        ))}
      </View>

      <View className="fixed left-0 right-0 bottom-0 pt-[24rpx] px-[28rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))] bg-card">
        <View
          className="h-[100rpx] leading-[100rpx] text-center bg-primary text-primary-foreground text-[32rpx] font-semibold rounded-[24rpx]"
          onClick={onOpenVip}
          hoverClass="opacity-60"
        >
          <Text>{tt('distribution.plan.openVipBtn', '开通VIP会员 参与分佣计划')}</Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
