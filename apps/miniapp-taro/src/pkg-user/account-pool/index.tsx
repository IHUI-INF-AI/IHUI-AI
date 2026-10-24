// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/account-pool/AccountPoolScreen.tsx
import { useCallback, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import * as api from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { AddForm, PROVIDERS, type PoolDraft } from './add-form'
import { PoolRowCard, type PoolRow } from './pool-row'

const EMPTY: PoolDraft = { providerCode: PROVIDERS[0], name: '', token: '', refreshToken: '' }

/**
 * 个人号池(2026-10-23 立):与 Web `/account-pool`、RN `AccountPool` 打同一组用户态端点
 * (/api/account-pool*),按登录用户 owner_user_id 分池 ⇒ 三端数据互通;
 * 池内账号即签到助手账号,由 ai-service 调度器每日自动签到领免费积分。
 * 行卡片与录入表单外移至 pool-row.tsx / add-form.tsx(§3 单文件 < 250 行)。
 */
export default function AccountPool() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [rows, setRows] = useState<PoolRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PoolDraft>(EMPTY)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<{ list: PoolRow[]; total: number }>('/account-pool')
      setRows(data.list ?? [])
    } catch {
      Taro.showToast({ title: t('accountPool.actionFailed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [t])

  useDidShow(() => {
    gate.waitUntilReady(() => {
      void load()
    })
  })

  const fail = (e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e ?? '')
    Taro.showToast({
      title: `${t('accountPool.actionFailed')}${msg ? `:${msg}` : ''}`,
      icon: 'none',
    })
  }

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    try {
      await action()
      void load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const checkin = (row: PoolRow) =>
    run(async () => {
      await api.post(`/account-pool/${row.id}/checkin`)
    })

  const toggle = (row: PoolRow) =>
    run(async () => {
      await api.patch(`/account-pool/${row.id}`, { isEnabled: !row.isEnabled })
    })

  /** 删除走二次确认:第一下只把该行切成确认态(web 端同款交互) */
  const remove = (row: PoolRow) => {
    if (confirmId !== row.id) {
      setConfirmId(row.id)
      return
    }
    setConfirmId(null)
    void run(async () => {
      await api.del(`/account-pool/${row.id}`)
    })
  }

  const save = () =>
    run(async () => {
      await api.post('/account-pool', {
        providerCode: draft.providerCode,
        name: draft.name.trim(),
        token: draft.token.trim(),
        refreshToken: draft.refreshToken.trim() || undefined,
      })
      setDraft(EMPTY)
      setAdding(false)
      Taro.showToast({ title: t('accountPool.addSuccess'), icon: 'success' })
    })

  return (
    <ThemeRoot>
      <ScrollView scrollY className="min-h-screen bg-background">
        <View className="px-[28rpx] pt-[24rpx] pb-[64rpx]">
          <View className="flex items-center justify-between">
            <Text className="block text-[length:40rpx] font-bold text-foreground">
              {t('accountPool.title')}
            </Text>
            <Text
              className="rounded-sm border border-border px-[20rpx] py-[10rpx] text-[length:24rpx] text-foreground"
              onClick={() => setAdding((v) => !v)}
            >
              {t('accountPool.add')}
            </Text>
          </View>
          <Text className="mt-[8rpx] block text-[length:26rpx] leading-[38rpx] text-muted-foreground">
            {t('accountPool.subtitle')}
          </Text>

          {adding ? (
            <AddForm
              t={t}
              draft={draft}
              busy={busy}
              onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
              onSave={() => void save()}
              onCancel={() => setAdding(false)}
            />
          ) : null}

          {loading ? (
            <Text className="block py-[64rpx] text-center text-[length:28rpx] text-muted-foreground">
              {t('accountPool.loading')}
            </Text>
          ) : rows.length === 0 ? (
            <View className="mt-[24rpx] rounded-lg border border-border bg-card p-[28rpx] text-center">
              <Text className="block text-[length:28rpx] font-medium text-foreground">
                {t('accountPool.empty')}
              </Text>
              <Text className="mt-[8rpx] block text-[length:26rpx] text-muted-foreground">
                {t('accountPool.emptyHint')}
              </Text>
            </View>
          ) : (
            <View className="mt-[24rpx] flex flex-col gap-[16rpx]">
              {rows.map((row) => (
                <PoolRowCard
                  key={row.id}
                  row={row}
                  t={t}
                  confirmId={confirmId}
                  onCheckin={checkin}
                  onToggle={toggle}
                  onDelete={remove}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
