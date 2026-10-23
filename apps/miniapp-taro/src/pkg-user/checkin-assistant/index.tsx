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

const PLATFORMS = ['trae', 'workbuddy', 'qoder', 'minimax'] as const

interface CheckinAccount {
  id: number
  name: string
  platform: string
  enabled: boolean
  device_map?: Record<string, unknown>
  last_record?: { ok: boolean; credits?: number | null } | null
}

/** 签到助手 + 个人号池(2026-10-23 立):与 Web /checkin 同一后端,数据互通。 */
export default function CheckinAssistant() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [list, setList] = useState<CheckinAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('trae')
  const [name, setName] = useState('')
  const [jwt, setJwt] = useState('')
  const [refreshToken, setRefreshToken] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.get<{ accounts: CheckinAccount[] }>('/checkin/accounts')
      setList(data.accounts ?? [])
    } catch {
      Taro.showToast({ title: t('checkinAssistant.actionFailed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [t])

  useDidShow(() => {
    gate.waitUntilReady(() => {
      void load()
    })
  })

  const checkin = async (acc: CheckinAccount) => {
    try {
      // 端点直接回写库后的那条 record;读它才拿得到本次真值 —— 原先硬编码 credits: 0,
      // 而文案是「上次签到成功 +{credits}」,等于每天替用户谎报一次零收益。
      const record = await api.post<{
        ok?: boolean
        credits?: number | null
        credits_delta?: number | null
      }>(`/checkin/accounts/${acc.id}/checkin`)
      const gained =
        typeof record?.credits_delta === 'number' ? record.credits_delta : record?.credits
      const ok = record?.ok !== false
      Taro.showToast({
        title: !ok
          ? t('checkinAssistant.lastFailed')
          : typeof gained === 'number'
            ? t('checkinAssistant.lastOk', { credits: gained })
            : t('accountPool.checkinSuccess'),
        icon: ok ? 'success' : 'none',
      })
      void load()
    } catch {
      Taro.showToast({ title: t('checkinAssistant.actionFailed'), icon: 'none' })
    }
  }

  const toggle = async (acc: CheckinAccount) => {
    try {
      await api.patch(`/checkin/accounts/${acc.id}/enabled`, { enabled: !acc.enabled })
      void load()
    } catch {
      Taro.showToast({ title: t('checkinAssistant.actionFailed'), icon: 'none' })
    }
  }

  const remove = (acc: CheckinAccount) => {
    void Taro.showModal({
      title: t('checkinAssistant.delete'),
      content: t('checkinAssistant.deleteConfirm', { name: acc.name }),
      success: (res) => {
        if (!res.confirm) return
        void (async () => {
          try {
            await api.del(`/checkin/accounts/${acc.id}`)
            void load()
          } catch {
            Taro.showToast({ title: t('checkinAssistant.actionFailed'), icon: 'none' })
          }
        })()
      },
    })
  }

  const submit = async () => {
    if (!name.trim() || !jwt.trim() || busy) return
    setBusy(true)
    try {
      await api.post('/checkin/accounts', {
        platform,
        name: name.trim(),
        jwt: jwt.trim(),
        device_map: refreshToken.trim() ? { refresh_token: refreshToken.trim() } : {},
      })
      setName('')
      setJwt('')
      setRefreshToken('')
      Taro.showToast({ title: t('checkinAssistant.add'), icon: 'success' })
      void load()
    } catch {
      Taro.showToast({ title: t('checkinAssistant.actionFailed'), icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  const inputStyle = `height:88rpx;background:var(--color-muted);border-radius:${rnRadius.xl}px;padding:0 24rpx;font-size:30rpx;color:var(--color-foreground);width:100%;box-sizing:border-box;margin-top:12rpx;`

  return (
    <ThemeRoot>
      <ScrollView scrollY className="min-h-screen bg-background">
        <View className="px-[28rpx] pt-[24rpx] pb-[64rpx]">
          <Text className="block text-[length:40rpx] font-bold text-foreground">
            {t('checkinAssistant.title')}
          </Text>
          <Text className="mt-[8rpx] block text-[length:26rpx] leading-[38rpx] text-muted-foreground">
            {t('checkinAssistant.subtitle')}
          </Text>

          {loading ? (
            <Text className="block py-[64rpx] text-center text-[length:28rpx] text-muted-foreground">
              {t('common.loading')}
            </Text>
          ) : list.length === 0 ? (
            <View className="mt-[24rpx] rounded-xl border border-border bg-card p-[28rpx]">
              <Text className="block text-[length:30rpx] font-semibold text-foreground">
                {t('checkinAssistant.empty')}
              </Text>
              <Text className="mt-[8rpx] block text-[length:26rpx] text-muted-foreground">
                {t('checkinAssistant.emptyHint')}
              </Text>
            </View>
          ) : (
            list.map((acc) => (
              <View
                key={acc.id}
                className="mt-[20rpx] rounded-xl border border-border bg-card p-[24rpx]"
              >
                <View className="flex flex-wrap items-center justify-between gap-[12rpx]">
                  <Text className="text-[length:30rpx] font-semibold text-foreground">
                    {acc.name}
                  </Text>
                  <View className="flex flex-wrap items-center gap-[8rpx]">
                    <Text className="rounded-md bg-muted px-[10rpx] py-[4rpx] text-[length:22rpx] text-muted-foreground">
                      {acc.platform}
                    </Text>
                    <Text className="rounded-md bg-muted px-[10rpx] py-[4rpx] text-[length:22rpx] text-muted-foreground">
                      {acc.enabled ? t('checkinAssistant.enabled') : t('checkinAssistant.disabled')}
                    </Text>
                    {acc.device_map?.pool_account_id ? (
                      <Text className="rounded-md bg-[var(--color-muted)] px-[10rpx] py-[4rpx] text-[length:22rpx] text-foreground">
                        {t('checkinAssistant.poolSynced')}
                      </Text>
                    ) : null}
                  </View>
                </View>
                {acc.last_record ? (
                  <Text className="mt-[8rpx] block text-[length:24rpx] text-muted-foreground">
                    {acc.last_record.ok
                      ? t('checkinAssistant.lastOk', { credits: acc.last_record.credits ?? 0 })
                      : t('checkinAssistant.lastFailed')}
                  </Text>
                ) : null}
                <View className="mt-[16rpx] flex flex-wrap gap-[12rpx]">
                  <Text
                    className="rounded-lg bg-muted px-[20rpx] py-[10rpx] text-[length:24rpx] text-foreground"
                    onClick={() => void checkin(acc)}
                  >
                    {t('checkinAssistant.checkin')}
                  </Text>
                  <Text
                    className="rounded-lg bg-muted px-[20rpx] py-[10rpx] text-[length:24rpx] text-foreground"
                    onClick={() => void toggle(acc)}
                  >
                    {acc.enabled ? t('checkinAssistant.disable') : t('checkinAssistant.enable')}
                  </Text>
                  <Text
                    className="rounded-lg bg-muted px-[20rpx] py-[10rpx] text-[length:24rpx] text-muted-foreground"
                    onClick={() => remove(acc)}
                  >
                    {t('checkinAssistant.delete')}
                  </Text>
                </View>
              </View>
            ))
          )}

          <View className="mt-[28rpx] rounded-xl border border-border bg-card p-[28rpx]">
            <Text className="block text-[length:30rpx] font-semibold text-foreground">
              {t('checkinAssistant.addTitle')}
            </Text>
            <View className="mt-[16rpx] flex flex-wrap gap-[12rpx]">
              {PLATFORMS.map((p) => (
                <Text
                  key={p}
                  className={`rounded-lg px-[20rpx] py-[10rpx] text-[length:24rpx] ${
                    platform === p
                      ? 'bg-[var(--color-cta)] text-[var(--color-cta-foreground)]'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  onClick={() => setPlatform(p)}
                >
                  {p}
                </Text>
              ))}
            </View>
            <Input
              className="mt-[16rpx]"
              style={inputStyle}
              value={name}
              placeholder={t('checkinAssistant.namePlaceholder')}
              onInput={(e) => setName(e.detail.value)}
            />
            <Input
              style={inputStyle}
              value={jwt}
              placeholder={t('checkinAssistant.tokenPlaceholder')}
              onInput={(e) => setJwt(e.detail.value)}
            />
            <Input
              style={inputStyle}
              value={refreshToken}
              placeholder={t('checkinAssistant.refreshTokenLabel')}
              onInput={(e) => setRefreshToken(e.detail.value)}
            />
            <View
              className={`mt-[24rpx] flex h-[88rpx] items-center justify-center rounded-xl bg-[var(--color-cta)] ${
                busy ? 'opacity-60' : ''
              }`}
              onClick={() => void submit()}
            >
              <Text className="text-[length:30rpx] font-semibold text-[var(--color-cta-foreground)]">
                {busy ? t('checkinAssistant.adding') : t('checkinAssistant.add')}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
