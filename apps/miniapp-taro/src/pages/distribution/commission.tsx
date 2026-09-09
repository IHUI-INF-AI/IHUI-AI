// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { useReachBottom } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { getCommissionRecords, getDistributionInfo } from '@/api'
import ThemeRoot from '@/components/ThemeRoot'

interface CommissionRecord {
  id: string
  amount: number
  type: string
  time: string
  nickname?: string
}

const PAGE_SIZE = 20

export default function DistributionCommission() {
  const { t } = useI18n()
  const [list, setList] = useState<CommissionRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [totalCommission, setTotalCommission] = useState(0)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const loadSummary = async () => {
    try {
      const info = await getDistributionInfo()
      setTotalCommission(info.totalCommission)
    } catch {
      // ignore
    }
  }

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setList([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await getCommissionRecords({ page: pageRef.current, pageSize: PAGE_SIZE })
      const items = res.list || []
      setList((prev) => (reset ? items : [...prev, ...items]))
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
    load(true)
  }, [])

  useReachBottom(() => {
    load()
  })

  return (
    <ThemeRoot className="min-h-screen bg-background">
      {/* 对齐 RN IncomeScreen summaryCard:白卡 + 次级标签 + 大号数值 */}
      <View className="mx-[20rpx] mt-[20rpx] bg-card rounded-[24rpx] p-[28rpx]">
        <Text className="text-[28rpx] text-muted-foreground">
          {t('distribution.commission.total')}
        </Text>
        <Text className="block text-[40rpx] text-foreground font-bold mt-[16rpx]">
          ¥{totalCommission}
        </Text>
      </View>
      {list.length > 0 && (
        <View className="mx-[20rpx] mt-[20rpx]">
          {list.map((r) => (
            <View
              key={r.id}
              className="bg-card border border-border rounded-[24rpx] p-[24rpx] mb-[16rpx]"
            >
              <Text className="block text-[32rpx] font-semibold text-foreground">{r.type}</Text>
              <Text className="block text-[22rpx] text-[var(--color-text-tertiary)] mt-[12rpx]">
                {r.time}
                {r.nickname ? ` · ${r.nickname}` : ''}
              </Text>
              <View className="flex justify-end mt-[16rpx]">
                <Text
                  className={`text-[32rpx] font-bold ${r.amount > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
                >
                  {r.amount > 0 ? '+' : ''}¥{r.amount}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
      {list.length === 0 && !loading && (
        <View className="text-center py-[120rpx] text-[28rpx] text-[var(--color-text-tertiary)]">
          <Text>{t('distribution.commission.empty')}</Text>
        </View>
      )}
      {loading && (
        <View className="text-center py-[40rpx] text-[28rpx] text-[var(--color-text-tertiary)]">
          <Text>{t('distribution.commission.loading')}</Text>
        </View>
      )}
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
