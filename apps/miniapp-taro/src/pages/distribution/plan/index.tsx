// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 镜像 packages/app/src/features/earn-commission/EarnCommissionScreen.tsx

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import * as api from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'

/** 分佣比例卡 —— 真值接 GET /distribution/commission-rates(distributionRoutes 在册的
 *  「佣金比例配置」端点,读 system_configs category='distribution')。
 *  原 VIP 20% / SVIP 25% 两行是与后端结算口径不同的硬编错文案:后端实算比例在
 *  identity_proportions(管理端可配,vip_proportion 等字段,无 SVIP 档),
 *  共享屏 EarnCommissionScreen 的 RATE_TABLE 同为字面量,不可作取信源。 */
interface RateRow {
  level: string
  rate: string
}

export default function DistributionPlan() {
  const tt = useTt()
  const gate = useAuthReadyGate()
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [inviteCount, setInviteCount] = useState(0)
  const [rateRows, setRateRows] = useState<RateRow[]>([])

  // G-933 冷启动抢跑门控:两发 GET /api/distribution/overview 与
  // GET /api/distribution/invited-users 都由 distributionRoutes 的统一 preHandler 守
  // (`apps/api/src/routes/distribution.ts:24` addHook authenticate)⇒ 需鉴权,整块挡到门后。
  // commission-rates 同挂该 preHandler,一并挡门后。
  useDidShow(() => {
    gate.waitUntilReady(() => {
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
      api
        .get<{ rates?: Record<string, string> }>('/distribution/commission-rates')
        .then((res) => {
          const rates = res?.rates ?? {}
          setRateRows(
            Object.entries(rates).map(([level, value]) => ({ level, rate: String(value ?? '') })),
          )
        })
        .catch(() => {
          setRateRows([])
        })
    })
  })

  const onOpenVip = () => {
    Taro.showModal({
      title: tt('distribution.plan.openVipTitle', '开通VIP会员'),
      content: tt('distribution.plan.openVipContent', '是否前往开通VIP会员,参与分佣计划?'),
      confirmText: tt('distribution.plan.confirm', '确认'),
      cancelText: tt('distribution.plan.cancel', '取消'),
      success: (res) => {
        if (res.confirm) {
          Taro.navigateTo({ url: '/pkg-shop/vip/index' })
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
      {/* 对齐 RN header(返回 + 标题):小程序返回键由原生导航栏承担,标题按共享屏同一层级写在页内
          —— config 的 navigationBarTitleText 取不到 t(),这里才是唯一可取词的标题位 */}
      <View className="flex flex-row items-center pb-[24rpx]">
        <Text className="block text-[length:40rpx] font-semibold text-foreground">
          {tt('earnCommission.title', '分佣计划')}
        </Text>
      </View>
      {/* 对齐 RN EarnCommissionScreen introCard:标题+描述+统计同卡,内容居中 */}
      <View className="bg-card ui-card rounded-lg p-[28rpx] flex flex-col items-center gap-[24rpx]">
        <Text className="block text-[length:36rpx] font-bold text-foreground text-center">
          {tt('distribution.plan.introTitle', '邀请好友,赚取佣金')}
        </Text>
        <Text className="block text-[length:28rpx] text-muted-foreground text-center leading-[40rpx]">
          {tt(
            'earnCommission.introDesc',
            '加入分佣计划,邀请好友注册成为会员,即可获得会员费 20% 的佣金收益',
          )}
        </Text>
        <View className="flex flex-row justify-around w-full mt-[16rpx]">
          <View className="flex flex-col items-center gap-[12rpx]">
            <Text className="block text-[length:44rpx] font-bold text-[var(--color-primary)]">
              ¥{totalEarnings.toFixed(2)}
            </Text>
            <Text className="block text-[length:28rpx] text-muted-foreground">
              {tt('distribution.plan.totalEarnings', '累计收益')}
            </Text>
          </View>
          <View className="flex flex-col items-center gap-[12rpx]">
            <Text className="block text-[length:44rpx] font-bold text-[var(--color-primary)]">
              {inviteCount}
            </Text>
            <Text className="block text-[length:28rpx] text-muted-foreground">
              {tt('distribution.plan.inviteCount', '邀请人数')}
            </Text>
          </View>
        </View>
      </View>

      {/* 对齐 RN sectionCard:白卡 + 居中标题 + 圆形序号规则列表 */}
      <View className="bg-card ui-card rounded-lg p-[28rpx] mt-[24rpx] flex flex-col gap-[24rpx]">
        <Text className="block text-[length:32rpx] font-semibold text-foreground text-center">
          {tt('distribution.plan.rulesTitle', '分佣规则')}
        </Text>
        {rules.map((r, i) => (
          <View key={i} className="flex flex-row items-center gap-[24rpx]">
            <View className="w-[44rpx] h-[44rpx] rounded-full bg-primary text-primary-foreground text-[length:28rpx] font-semibold flex items-center justify-center flex-shrink-0">
              <Text>{i + 1}</Text>
            </View>
            <Text className="flex-1 text-[length:28rpx] text-foreground leading-[38rpx]">{r}</Text>
          </View>
        ))}
      </View>

      {/* 分佣比例:档位/比例逐行取自 GET /distribution/commission-rates 的在册配置;
          未配置时该面为空,如实渲染空态,不再以硬编数字顶位 */}
      <View className="bg-card ui-card rounded-lg p-[28rpx] mt-[24rpx] flex flex-col gap-[24rpx]">
        <Text className="block text-[length:32rpx] font-semibold text-foreground text-center">
          {tt('earnCommission.rateTitle', '分佣比例')}
        </Text>
        {rateRows.map((row) => (
          <View
            key={row.level}
            className="flex flex-row items-center gap-[24rpx] bg-[var(--color-muted)] rounded-sm px-[24rpx] py-[20rpx]"
          >
            <Text className="flex-1 text-[length:28rpx] font-medium text-foreground">
              {row.level}
            </Text>
            <Text className="text-[length:32rpx] font-bold text-[var(--color-primary)] min-w-[88rpx]">
              {row.rate}
            </Text>
          </View>
        ))}
        {!rateRows.length ? (
          <Text className="block text-center text-[length:28rpx] text-muted-foreground py-[16rpx]">
            {tt('common.empty', '暂无数据')}
          </Text>
        ) : null}
      </View>

      <View className="fixed left-0 right-0 bottom-0 pt-[24rpx] px-[28rpx] pb-[calc(24rpx+env(safe-area-inset-bottom))] bg-card">
        <View
          className="h-[100rpx] leading-[100rpx] text-center bg-cta text-cta-foreground text-[length:32rpx] font-semibold rounded-xl"
          onClick={onOpenVip}
          hoverClass="opacity-60"
        >
          <Text>{tt('earnCommission.openVip', '开通 VIP 会员 参与分佣计划')}</Text>
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
