// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { View, Text } from '@tarojs/components'

export interface PoolRow {
  id: string
  providerCode: string
  uid: string
  name: string
  isEnabled: boolean
  checkinPending: boolean
}

type Tx = (key: string, vars?: Record<string, string | number>) => string

export interface PoolRowCardProps {
  row: PoolRow
  t: Tx
  /** 处于"再点一次才真删"确认态的行 id(web 端同款二次确认语义) */
  confirmId: string | null
  onCheckin: (row: PoolRow) => void
  onToggle: (row: PoolRow) => void
  onDelete: (row: PoolRow) => void
}

/** 个人号池单行卡片(与 web /account-pool 逐元素对齐;色档走受管 token) */
export function PoolRowCard({
  row,
  t,
  confirmId,
  onCheckin,
  onToggle,
  onDelete,
}: PoolRowCardProps) {
  const confirming = confirmId === row.id
  return (
    <View className="rounded-lg border border-border bg-card p-[24rpx]">
      <View className="flex flex-wrap items-center gap-[12rpx]">
        <Text className="rounded-sm bg-muted px-[12rpx] py-[4rpx] text-[length:22rpx] text-muted-foreground">
          {row.providerCode}
        </Text>
        <Text className="max-w-[380rpx] shrink basis-0 truncate text-[length:28rpx] font-medium text-foreground">
          {row.name}
        </Text>
        <Text
          className={`rounded-sm px-[12rpx] py-[4rpx] text-[length:22rpx] ${
            row.isEnabled
              ? 'bg-[var(--color-success-light)] text-[var(--color-success-text)]'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.isEnabled ? t('accountPool.enabled') : t('accountPool.disabled')}
        </Text>
        {row.checkinPending ? (
          <Text className="rounded-sm bg-[var(--color-warning-amber-light)] px-[12rpx] py-[4rpx] text-[length:22rpx] text-[var(--color-warning-amber-text)]">
            {t('accountPool.syncPending')}
          </Text>
        ) : null}
      </View>
      <Text className="mt-[8rpx] block truncate text-[length:24rpx] text-muted-foreground">
        {t('accountPool.uid')}: {row.uid}
      </Text>
      <View className="mt-[16rpx] flex flex-wrap gap-[12rpx]">
        <Text
          className="rounded-md bg-muted px-[20rpx] py-[10rpx] text-[length:24rpx] text-foreground"
          onClick={() => onCheckin(row)}
        >
          {t('accountPool.checkin')}
        </Text>
        <Text
          className="rounded-md bg-muted px-[20rpx] py-[10rpx] text-[length:24rpx] text-foreground"
          onClick={() => onToggle(row)}
        >
          {row.isEnabled ? t('accountPool.disable') : t('accountPool.enable')}
        </Text>
        <Text
          className={`rounded-md px-[20rpx] py-[10rpx] text-[length:24rpx] ${
            confirming
              ? 'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]'
              : 'bg-muted text-muted-foreground'
          }`}
          onClick={() => onDelete(row)}
        >
          {confirming ? t('accountPool.confirmDelete') : t('accountPool.delete')}
        </Text>
      </View>
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
