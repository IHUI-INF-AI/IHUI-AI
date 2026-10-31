// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐 packages/app/src/features/share/ShareScreen.tsx:备注 → 生成分享 → 链接/分享码/有效期 → 立即分享。
// 数据腿 = POST /shares(apps/api/src/routes/other/share-routes.ts)⇒ { shareUrl, shareCode, expireAt }。
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useState } from 'react'
import { formatDateByTemplate } from '@ihui/shared'
import { useI18n } from '@/i18n'
import { post } from '@/api'
import { isLoggedIn } from '@/utils/auth'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { useFieldFocus } from '@/hooks/use-field-focus'

interface ShareLinkResult {
  shareUrl: string
  shareCode: string
  expireAt: string
}

/** 分享星球自身的分享目标(后端只校验形态:targetType ≤32、targetId ≤100) */
const SHARE_TARGET = { targetType: 'share-planet', targetId: 'share-planet' }

export default function ShareCard() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [remark, setRemark] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ShareLinkResult | null>(null)
  // 小程序 wxss 无 :focus 伪类 ⇒ 备注输入盒的聚焦描边只能运行时切(与提现页同档)
  const ffRemark = useFieldFocus()

  const create = useCallback(async () => {
    setLoading(true)
    try {
      const res = await post<ShareLinkResult>('/shares', {
        ...SHARE_TARGET,
        remark: remark.trim(),
      })
      setResult(res)
    } catch {
      Taro.showToast({ title: t('common.failed'), icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [remark, t])

  // G-933:POST /shares 由 otherRoutes 的统一 preHandler 守鉴权(auth 钩子),冷启动未落定时照发会抢跑
  const onCreate = useCallback(() => {
    if (loading) return
    gate.waitUntilReady(() => {
      if (!isLoggedIn()) {
        Taro.showToast({ title: t('common.failed'), icon: 'none' })
        return
      }
      void create()
    })
  }, [gate, loading, create, t])

  const onShare = useCallback(() => {
    if (!result) return
    Taro.setClipboardData({
      data: result.shareUrl,
      success: () => Taro.showToast({ title: t('share.success'), icon: 'success' }),
      fail: () => Taro.showToast({ title: t('common.failed'), icon: 'none' }),
    })
  }, [result, t])

  return (
    <View className="mx-[20rpx] mt-[20rpx] bg-card border border-border rounded-lg p-[24rpx]">
      <Text className="block text-[length:32rpx] font-semibold text-foreground">
        {t('share.title')}
      </Text>
      <Text className="block mt-[16rpx] text-[length:26rpx] text-muted-foreground">
        {t('share.remark')}
      </Text>
      <View
        className="mt-[12rpx] flex items-center h-[88rpx] px-[24rpx] rounded-xl border border-border bg-[var(--color-muted)]"
        style={ffRemark.focusStyle}
      >
        <Input
          className="flex-1 text-body text-foreground"
          {...ffRemark.spread}
          value={remark}
          onInput={(e) => setRemark(e.detail.value)}
          maxlength={100}
          placeholder={t('share.remarkPlaceholder')}
          placeholder-style="color: var(--color-text-tertiary)"
        />
      </View>
      <View
        className={`mt-[24rpx] flex h-[88rpx] items-center justify-center rounded-sm text-[length:30rpx] font-semibold ${
          loading
            ? 'bg-[var(--color-text-tertiary)] text-[var(--color-surface-light)]'
            : 'bg-cta text-cta-foreground'
        }`}
        hoverClass="opacity-70"
        onClick={onCreate}
      >
        <Text>{loading ? t('common.loading') : t('share.create')}</Text>
      </View>
      {result ? (
        <View className="mt-[24rpx] border border-border rounded-lg p-[24rpx]">
          <Text className="block text-label text-[var(--color-text-tertiary)]">
            {t('share.url')}
          </Text>
          <Text className="block mt-[8rpx] text-body text-foreground break-all">
            {result.shareUrl}
          </Text>
          <Text className="block mt-[16rpx] text-label text-[var(--color-text-tertiary)]">
            {t('share.code')}
          </Text>
          <Text className="block mt-[8rpx] text-body text-foreground">
            {result.shareCode}
          </Text>
          <Text className="block mt-[16rpx] text-label text-[var(--color-text-tertiary)]">
            {t('share.expireAt')}
          </Text>
          <Text className="block mt-[8rpx] text-body text-foreground">
            {result.expireAt ? formatDateByTemplate(result.expireAt, 'YYYY-MM-DD HH:mm') : ''}
          </Text>
        </View>
      ) : null}
      {result ? (
        <View
          className="mt-[24rpx] flex h-[88rpx] items-center justify-center rounded-sm bg-cta text-[length:30rpx] font-semibold text-cta-foreground"
          hoverClass="opacity-70"
          onClick={onShare}
        >
          <Text>{t('share.shareNow')}</Text>
        </View>
      ) : null}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
