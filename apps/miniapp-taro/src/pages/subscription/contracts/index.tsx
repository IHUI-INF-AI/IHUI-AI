import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { listRecurringContracts, cancelRecurringContract, type WechatPayContract } from '@/api'
import { useI18n } from '@/i18n'

const STATUS_STYLE: Record<WechatPayContract['status'], string> = {
  active: 'bg-[#e8f5e9] text-[#4caf50]',
  pending: 'bg-[rgba(245, 158, 11, 0.1)] text-[#ff9a3c]',
  cancelled: 'bg-muted text-muted-foreground',
  expired: 'bg-muted text-muted-foreground',
}

function formatTime(str?: string): string {
  if (!str) return '-'
  const d = new Date(str)
  if (isNaN(d.getTime())) return str
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function SubscriptionContractsPage() {
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))
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
        confirmColor: '#dd524d',
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
    [load],
  )

  useDidShow(() => {
    load()
  })

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  return (
    <View className="min-h-screen bg-background">
      <View className="px-[24rpx] pt-[24rpx] pb-[16rpx]">
        <Text className="text-[28rpx] text-foreground font-semibold">{tt('subscription.contractsTitle', '自动续费管理')}</Text>
      </View>
      {list.length > 0 && (
        <View className="px-[24rpx] pb-[24rpx]">
          {list.map((c) => (
            <View key={c.id} className="bg-card rounded-[16rpx] p-[32rpx] mb-[24rpx]">
              <View className="flex justify-between items-center">
                <Text className="text-[30rpx] text-foreground font-semibold">
                  {c.planId ? `${tt('subscription.planLabel', '套餐')} ${c.planId}` : tt('subscription.autoRenew', '自动续费')}
                </Text>
                <Text
                  className={`text-[22rpx] px-[16rpx] py-[4rpx] rounded-[8rpx] ${STATUS_STYLE[c.status]}`}
                >
                  {getStatusText(c.status)}
                </Text>
              </View>
              <View className="mt-[20rpx]">
                <View className="flex justify-between py-[8rpx]">
                  <Text className="text-[24rpx] text-muted-foreground">{tt('subscription.nextCharge', '下次扣款')}</Text>
                  <Text className="text-[24rpx] text-foreground">{formatTime(c.nextChargeTime)}</Text>
                </View>
                <View className="flex justify-between py-[8rpx]">
                  <Text className="text-[24rpx] text-muted-foreground">{tt('subscription.lastCharge', '上次扣款')}</Text>
                  <Text className="text-[24rpx] text-foreground">
                    {c.lastChargeTime
                      ? `${formatTime(c.lastChargeTime)} ${
                          c.lastChargeStatus ? getLastChargeText(c.lastChargeStatus) : ''
                        }`
                      : '-'}
                  </Text>
                </View>
                <View className="flex justify-between py-[8rpx]">
                  <Text className="text-[24rpx] text-muted-foreground">{tt('subscription.signTime', '签约时间')}</Text>
                  <Text className="text-[24rpx] text-foreground">
                    {formatTime(c.signedAt || c.createdAt)}
                  </Text>
                </View>
              </View>
              {c.status === 'active' && (
                <View className="mt-[24rpx] text-right">
                  <Text
                    className="inline-block text-[24rpx] text-[#dd524d] px-[24rpx] py-[8rpx] border-[2rpx] border-[#dd524d] rounded-[8rpx]"
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
        <View className="text-center py-[120rpx] text-muted-foreground">
          <Text className="text-[26rpx]">{tt('subscription.contractsEmpty', '暂无自动续费签约')}</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-[120rpx] text-muted-foreground">
          <Text className="text-[26rpx]">{tt('subscription.loadingText', '加载中...')}</Text>
        </View>
      )}
    </View>
  )
}
