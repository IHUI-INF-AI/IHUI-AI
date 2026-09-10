// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useTt } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { listRecurringContracts, cancelRecurringContract, type WechatPayContract } from '@/api'
import { formatDateByTemplate } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'

// 状态样式走 token:生效中浅绿标签 --color-success-tag-bg(与 RN ModelPlaza 一致);
// pending 用 --color-warning-tint(warning/10 对 var() 色不生效,改用既有 tint token)
const STATUS_STYLE: Record<WechatPayContract['status'], string> = {
  active: 'bg-[var(--color-success-tag-bg)] text-success',
  pending: 'bg-[var(--color-warning-tint)] text-warning',
  cancelled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
}

export default function SubscriptionContractsPage() {
  const tt = useTt()
  const [list, setList] = useState<WechatPayContract[]>([])
  const [loading, setLoading] = useState(false)

  const getStatusText = (status: WechatPayContract['status']) => {
    const map: Record<string, string> = {
      active: tt('subscription.statusActive', '生效中'),
      pending: tt('subscription.statusPending', '待生效'),
      cancelled: tt('subscription.statusCancelled', '已解约'),
      expired: tt('subscription.statusExpired', '已过期'),
    }
    return map[status] || status
  }

  const getLastChargeText = (status: string) => {
    const map: Record<string, string> = {
      success: tt('subscription.chargeSuccess', '扣款成功'),
      failed: tt('subscription.chargeFailed', '扣款失败'),
      pending: tt('subscription.chargePending', '扣款中'),
    }
    return map[status] || status
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listRecurringContracts()
      setList(res.list || [])
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  const onCancel = useCallback(
    (contract: WechatPayContract) => {
      Taro.showModal({
        title: tt('subscription.cancelTitle', '解约确认'),
        content: tt('subscription.cancelContent', '确认取消该自动续费签约?取消后不再自动扣款。'),
        confirmText: tt('subscription.cancelConfirmBtn', '确认解约'),
        cancelText: tt('subscription.cancelThinkBtn', '再想想'),
        // 保留:native API Taro.showModal confirmColor 需 hex,不支持 CSS 变量;
        // 值对齐 --color-danger(亮 #dc2626,取亮值与 theme.json 静态回退一致)
        confirmColor: '#dc2626',
        success: async (modalRes) => {
          if (!modalRes.confirm) return
          Taro.showLoading({ title: tt('subscription.processing', '处理中'), mask: true })
          try {
            await cancelRecurringContract(contract.id)
            Taro.showToast({ title: tt('subscription.cancelSuccess', '已解约'), icon: 'success' })
            await load()
          } catch {
            Taro.showToast({ title: tt('subscription.cancelFailed', '解约失败'), icon: 'none' })
          } finally {
            Taro.hideLoading()
          }
        },
      })
    },
    [load, tt],
  )

  useDidShow(() => {
    load()
  })

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  return (
    // 对齐 RN SubscriptionsScreen 视觉语言:surface.bg 页面底 + 描边卡片(radius 12→24rpx)
    <ThemeRoot>
      <View className="min-h-screen bg-background">
        <View className="px-[20rpx] pt-[24rpx] pb-[8rpx]">
          <Text className="text-[40rpx] text-foreground font-semibold">
            {tt('subscription.contractsTitle', '自动续费管理')}
          </Text>
        </View>
        {list.length > 0 && (
          <View className="px-[20rpx] pb-[64rpx]">
            {list.map((c) => (
              <View
                key={c.id}
                className="bg-background border-[2rpx] border-border rounded-[24rpx] p-[24rpx] mb-[24rpx]"
              >
                <View className="flex justify-between items-center">
                  <Text className="text-[32rpx] text-foreground font-semibold">
                    {c.planId
                      ? `${tt('subscription.planLabel', '套餐')} ${c.planId}`
                      : tt('subscription.autoRenew', '自动续费')}
                  </Text>
                  <Text
                    className={`text-[24rpx] px-[16rpx] py-[4rpx] rounded-[16rpx] ${STATUS_STYLE[c.status]}`}
                  >
                    {getStatusText(c.status)}
                  </Text>
                </View>
                <View className="mt-[20rpx]">
                  <View className="flex justify-between py-[8rpx]">
                    <Text className="text-[28rpx] text-muted-foreground">
                      {tt('subscription.nextCharge', '下次扣款')}
                    </Text>
                    <Text className="text-[28rpx] text-foreground">
                      {formatDateByTemplate(c.nextChargeTime, 'YYYY-MM-DD HH:mm') || '-'}
                    </Text>
                  </View>
                  <View className="flex justify-between py-[8rpx]">
                    <Text className="text-[28rpx] text-muted-foreground">
                      {tt('subscription.lastCharge', '上次扣款')}
                    </Text>
                    <Text className="text-[28rpx] text-foreground">
                      {c.lastChargeTime
                        ? `${formatDateByTemplate(c.lastChargeTime, 'YYYY-MM-DD HH:mm')} ${
                            c.lastChargeStatus ? getLastChargeText(c.lastChargeStatus) : ''
                          }`
                        : '-'}
                    </Text>
                  </View>
                  <View className="flex justify-between py-[8rpx]">
                    <Text className="text-[28rpx] text-muted-foreground">
                      {tt('subscription.signTime', '签约时间')}
                    </Text>
                    <Text className="text-[28rpx] text-foreground">
                      {formatDateByTemplate(c.signedAt || c.createdAt, 'YYYY-MM-DD HH:mm') || '-'}
                    </Text>
                  </View>
                </View>
                {c.status === 'active' && (
                  <View className="mt-[24rpx] text-right">
                    <Text
                      className="inline-block text-[28rpx] font-semibold text-[var(--color-text-medium)] bg-background px-[24rpx] py-[12rpx] border-[2rpx] border-border rounded-[24rpx]"
                      onClick={() => onCancel(c)}
                    >
                      {tt('subscription.cancelBtn', '解约')}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
        {list.length === 0 && !loading && (
          <View className="text-center py-[96rpx] text-muted-foreground">
            <Text className="text-[28rpx]">
              {tt('subscription.contractsEmpty', '暂无自动续费签约')}
            </Text>
          </View>
        )}
        {loading && (
          <View className="text-center py-[96rpx] text-muted-foreground">
            <Text className="text-[28rpx]">{tt('subscription.loadingText', '加载中...')}</Text>
          </View>
        )}
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
