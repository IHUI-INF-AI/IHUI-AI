// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { fetchApi } from '@/lib/api'
import { AuthGatePrompt } from '@/components/common'
import { useAuthGate } from '@/hooks/use-auth-gate'
import { useTheme } from '@/hooks/use-theme'
import { BankCardScreen as SharedBankCardScreen } from '@ihui/rn-app/features/bank-card/BankCardScreen'
import type { BankCardInput, BankCardItem, TFunction } from '@ihui/types'

type LoadMode = 'initial' | 'refresh' | 'silent'

/**
 * 钱包银行卡管理页（2026-11-27）。
 *
 * 版面与新增/删除/设默认交互全部由共享屏
 * `@ihui/rn-app/features/bank-card/BankCardScreen`（react-native-web）输出；
 * web 侧只保留鉴权门、列表取数与写端点接线。
 *
 * 与 RN / 小程序的同源点：
 * - 同一 DTO `BankCardItem`、同一写入参 `BankCardInput`；
 * - 同一端点 `GET/POST/DELETE/PATCH /api/wallet/bank-cards`；
 * - 历史提现投影卡的 `readOnly` 由共享屏统一隐藏写按钮；
 * - 完整卡号只在新增表单出现，列表始终使用后端掩码。
 */
export default function BankCardsPage() {
  const t = useTranslations()
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { allow } = useAuthGate()
  const [items, setItems] = React.useState<BankCardItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState('')

  const load = React.useCallback(async (mode: LoadMode = 'initial') => {
    if (mode === 'initial') setLoading(true)
    if (mode === 'refresh') setRefreshing(true)
    if (mode !== 'silent') setError('')
    try {
      const r = await fetchApi<BankCardItem[]>('/api/wallet/bank-cards')
      if (!r.success) throw new Error(r.error || '加载银行卡失败')
      setItems(Array.isArray(r.data) ? r.data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载银行卡失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    if (!allow) {
      setLoading(false)
      return
    }
    void load('initial')
  }, [allow, load])

  const addCard = React.useCallback(
    async (input: BankCardInput) => {
      const r = await fetchApi<BankCardItem>('/api/wallet/bank-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!r.success) throw new Error(r.error || '添加银行卡失败')
      await load('silent')
    },
    [load],
  )

  const deleteCard = React.useCallback(
    async (id: string) => {
      const r = await fetchApi<{ deleted?: boolean }>(
        `/api/wallet/bank-cards/${encodeURIComponent(id)}`,
        { method: 'DELETE' },
      )
      if (!r.success) throw new Error(r.error || '删除银行卡失败')
      await load('silent')
    },
    [load],
  )

  const setDefaultCard = React.useCallback(
    async (id: string) => {
      const r = await fetchApi<{ isDefault?: boolean }>(
        `/api/wallet/bank-cards/${encodeURIComponent(id)}/default`,
        { method: 'PATCH' },
      )
      if (!r.success) throw new Error(r.error || '设置默认银行卡失败')
      await load('silent')
    },
    [load],
  )

  return (
    <div className="px-4 py-4 mx-auto w-full max-w-md space-y-4">
      {!allow ? (
        <AuthGatePrompt message="请先登录后管理银行卡" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <SharedBankCardScreen
            t={t as unknown as TFunction}
            items={items}
            loading={loading}
            refreshing={refreshing}
            error={error}
            onRefresh={() => void load('refresh')}
            onBack={() => router.push('/wallet')}
            onAddCard={addCard}
            onDeleteCard={deleteCard}
            onSetDefaultCard={setDefaultCard}
            colorScheme={resolvedTheme === 'dark' ? 'dark' : 'light'}
          />
        </div>
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
