// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useI18n } from '@/i18n'
import * as api from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import { rnRadius } from '@ihui/design-tokens'

/** 与 apps/api 的 RELAY_PROVIDERS 同集(codearts 无每日签到引擎,如实列出) */
const PROVIDERS = ['trae', 'workbuddy', 'qoder', 'codearts'] as const

interface PoolRow {
  id: string
  providerCode: string
  uid: string
  name: string
  isEnabled: boolean
  checkinPending: boolean
}

const EMPTY = {
  providerCode: 'trae' as (typeof PROVIDERS)[number],
  name: '',
  token: '',
  refreshToken: '',
}

/**
 * 个人号池(2026-10-23 立):与 Web `/account-pool`、RN `AccountPool` 打同一组用户态端点
 * (/api/account-pool*),按登录用户 owner_user_id 分池 ⇒ 三端数据互通;
 * 池内账号即签到助手账号,由 ai-service 调度器每日自动签到领免费积分。
 */
export default function AccountPool() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [rows, setRows] = useState<PoolRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)

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

  const checkin = async (row: PoolRow) => {
    setBusy(true)
    try {
      await api.post(`/account-pool/${row.id}/checkin`)
      void load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (row: PoolRow) => {
    setBusy(true)
    try {
      await api.patch(`/account-pool/${row.id}`, { isEnabled: !row.isEnabled })
      void load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: PoolRow) => {
    if (confirmId !== row.id) {
      setConfirmId(row.id)
      return
    }
    setBusy(true)
    try {
      await api.del(`/account-pool/${row.id}`)
      setConfirmId(null)
      void load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!form.name.trim() || !form.token.trim() || busy) return
    setBusy(true)
    try {
      await api.post('/account-pool', {
        providerCode: form.providerCode,
        name: form.name.trim(),
        token: form.token.trim(),
        refreshToken: form.refreshToken.trim() || undefined,
      })
      setForm(EMPTY)
      setAdding(false)
      Taro.showToast({ title: t('accountPool.addSuccess'), icon: 'success' })
      void load()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = `height:88rpx;background:var(--color-muted);border-radius:${rnRadius.sm}px;padding:0 24rpx;font-size:28rpx;color:var(--color-foreground);width:100%;box-sizing:border-box;`

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
            <View className="mt-[24rpx] rounded-lg border border-border bg-card p-[28rpx]">
              <Text className="block text-[length:24rpx] text-muted-foreground">
                {t('accountPool.provider')}
              </Text>
              <View className="mt-[12rpx] flex flex-wrap gap-[12rpx]">
                {PROVIDERS.map((p) => (
                  <Text
                    key={p}
                    className={`rounded-md px-[20rpx] py-[10rpx] text-[length:24rpx] ${
                      form.providerCode === p
                        ? 'bg-[var(--color-cta)] text-[var(--color-cta-foreground)]'
                        : 'bg-muted text-muted-foreground'
                    }`}
                    onClick={() => setForm((f) => ({ ...f, providerCode: p }))}
                  >
                    {p}
                  </Text>
                ))}
              </View>
              <Text className="mt-[20rpx] block text-[length:24rpx] text-muted-foreground">
                {t('accountPool.name')}
              </Text>
              <Input
                className="mt-[12rpx]"
                style={inputStyle}
                value={form.name}
                placeholder={t('accountPool.namePlaceholder')}
                onInput={(e) => setForm((f) => ({ ...f, name: e.detail.value }))}
              />
              <Text className="mt-[20rpx] block text-[length:24rpx] text-muted-foreground">
                {t('accountPool.token')}
              </Text>
              <Input
                className="mt-[12rpx]"
                style={inputStyle}
                value={form.token}
                placeholder={t('accountPool.token')}
                onInput={(e) => setForm((f) => ({ ...f, token: e.detail.value }))}
              />
              <Text className="mt-[20rpx] block text-[length:24rpx] text-muted-foreground">
                {t('accountPool.refreshToken')}（{t('accountPool.optional')}）
              </Text>
              <Input
                className="mt-[12rpx]"
                style={inputStyle}
                value={form.refreshToken}
                placeholder={t('accountPool.optional')}
                onInput={(e) => setForm((f) => ({ ...f, refreshToken: e.detail.value }))}
              />
              <View className="mt-[24rpx] flex gap-[16rpx]">
                <Text
                  className="rounded-md px-[24rpx] py-[14rpx] text-[length:26rpx] text-muted-foreground"
                  onClick={() => setAdding(false)}
                >
                  {t('accountPool.cancel')}
                </Text>
                <View
                  className={`flex h-[64rpx] flex-1 items-center justify-center rounded-md bg-[var(--color-cta)] ${
                    !form.name.trim() || !form.token.trim() || busy ? 'opacity-60' : ''
                  }`}
                  onClick={() => void save()}
                >
                  <Text className="text-[length:26rpx] font-semibold text-[var(--color-cta-foreground)]">
                    {busy ? t('accountPool.adding') : t('accountPool.save')}
                  </Text>
                </View>
              </View>
            </View>
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
                <View key={row.id} className="rounded-lg border border-border bg-card p-[24rpx]">
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
                      onClick={() => void checkin(row)}
                    >
                      {t('accountPool.checkin')}
                    </Text>
                    <Text
                      className="rounded-md bg-muted px-[20rpx] py-[10rpx] text-[length:24rpx] text-foreground"
                      onClick={() => void toggle(row)}
                    >
                      {row.isEnabled ? t('accountPool.disable') : t('accountPool.enable')}
                    </Text>
                    <Text
                      className={`rounded-md px-[20rpx] py-[10rpx] text-[length:24rpx] ${
                        confirmId === row.id
                          ? 'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)]'
                          : 'bg-muted text-muted-foreground'
                      }`}
                      onClick={() => void remove(row)}
                    >
                      {confirmId === row.id
                        ? t('accountPool.confirmDelete')
                        : t('accountPool.delete')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
