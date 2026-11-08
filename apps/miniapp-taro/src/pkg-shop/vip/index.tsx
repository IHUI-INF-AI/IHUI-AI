// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/vip/VipScreen.tsx
// 薄壳(第 4 批):套餐/续费/底部购买栏/7 个弹层全部交给共享屏 VipScreen;
//   本端只保留 ① G-933 冷启动鉴权门控;② 数据拉取与支付分发;③ 弹窗状态机(只存状态,不渲染)。

import './index.css'
import { useTt, useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo } from 'react'
import {
  getVipInfo,
  getVipPrivilege,
  getVipLevels,
  upgradeVip,
  signRecurringContract,
  type VipInfo,
  type VipPayInfo,
  type VipLevel,
} from '@/api'
import { requestWxPayment, type AnyPayParams } from '@/utils/pay'
import { formatDateByTemplate } from '@ihui/shared'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import type { PriceOption, VipBenefit } from '@/components'
import { VipScreen as SharedVipScreen } from '@ihui/rn-app/features/vip/VipScreen'
import {
  buildVipIndexFeatures,
  buildVipIndexOverlay,
  type VipIndexOverlayHandlers,
} from './vip-index-props'
import type { TFunction, VipBenefitCardItem, VipLevelItem2 } from '@ihui/types'

interface VipMineRow {
  levelValue?: number
  levelName?: string
  endTime?: string
}

/** 与 RN 端 normalizeBenefits 同口径:字符串或 { name } 对象都归一为文案数组 */
function normalizeLevelBenefits(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const text = item.trim()
      if (text) out.push(text)
      continue
    }
    if (item && typeof item === 'object') {
      const value = (item as { name?: unknown }).name
      if (typeof value === 'string' && value.trim()) out.push(value.trim())
    }
  }
  return out
}

function toVipInfo(raw: VipInfo): VipInfo {
  const row = (raw as unknown as { vip?: VipMineRow | null }).vip
  if (!row) return raw
  return {
    ...raw,
    level: row.levelValue ?? 0,
    name: row.levelName ?? '',
    expireTime: row.endTime ?? '',
  }
}

/** /vip/my 无会员记录时返回 null(XUI-003 拆包后),页面必须落空态而非读 undefined 字段。 */
const EMPTY_VIP_INFO: VipInfo = { level: 0, name: '' }

function daysUntil(expire: string): number | null {
  const at = Date.parse(expire)
  if (!Number.isFinite(at)) return null
  return Math.max(0, Math.ceil((at - Date.now()) / 86400000))
}

export default function VipIndexPage() {
  const { t } = useI18n()
  const tt = useTt()
  const { resolvedTheme } = useTheme()

  const defaultPlans = useMemo<PriceOption[]>(
    () => [
      {
        id: 'monthly',
        name: tt('vip.plan.monthly', '月度会员'),
        price: 30,
        period: tt('vip.plan.monthlyPeriod', '30天'),
      },
      {
        id: 'quarterly',
        name: tt('vip.plan.quarterly', '季度会员'),
        price: 88,
        period: tt('vip.plan.quarterlyPeriod', '90天'),
      },
      {
        id: 'yearly',
        name: tt('vip.plan.yearly', '年度会员'),
        price: 299,
        period: tt('vip.plan.yearlyPeriod', '365天'),
      },
    ],
    [tt],
  )

  const [info, setInfo] = useState<VipInfo>(EMPTY_VIP_INFO)
  const [levels, setLevels] = useState<VipLevel[]>([])
  const [levelsLoaded, setLevelsLoaded] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [benefits, setBenefits] = useState<VipBenefit[]>([])
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>(defaultPlans)
  const [selectedPlan, setSelectedPlan] = useState<PriceOption | null>(defaultPlans[0] ?? null)
  const [showBenefits, setShowBenefits] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat')
  const [autoRenew, setAutoRenew] = useState(false)
  const [showIntroduce, setShowIntroduce] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showNotice, setShowNotice] = useState(false)
  const [showPayMethod, setShowPayMethod] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [noticeAgreed, setNoticeAgreed] = useState(false)

  const dispatchVipPay = useCallback(
    (payInfo: VipPayInfo, orderNo: string, amount: number, planName: string) => {
      const successUrl = `/pkg-shop/vip/success?orderNo=${orderNo}&amount=${amount}&planName=${encodeURIComponent(planName)}`
      if (
        payInfo.method === 'jsapi' &&
        payInfo.timeStamp &&
        payInfo.nonceStr &&
        payInfo.package &&
        payInfo.signType &&
        payInfo.paySign
      ) {
        requestWxPayment(payInfo as AnyPayParams)
          .then(() => Taro.redirectTo({ url: successUrl }))
          .catch(() =>
            Taro.redirectTo({ url: `/pkg-shop/pay/result/index?orderNo=${orderNo}&status=failed` }),
          )
        return
      }
      if (payInfo.method === 'h5' && payInfo.h5Url && process.env.TARO_ENV === 'h5') {
        window.location.href = payInfo.h5Url
        return
      }
      if (payInfo.mock && payInfo.error) {
        onToast(t('vip.index.configNotReady'), { kind: 'error' })
      }
      Taro.redirectTo({ url: successUrl })
    },
    [t],
  )

  const load = useCallback(async () => {
    Taro.showLoading({ title: t('common.loading'), mask: true })
    try {
      const [i, p, lv] = await Promise.all([getVipInfo(), getVipPrivilege(), getVipLevels()])
      setInfo(i ? toVipInfo(i) : EMPTY_VIP_INFO)
      setLevels(lv.items || [])
      setLevelsLoaded(true)
      const list = (p.list || []).map((item) => ({
        id: String(item.id),
        title: item.title,
        desc: item.desc,
      }))
      setBenefits(list)
      const opts = (lv.items || []).map((l) => ({
        id: String(l.id),
        name: l.levelName,
        price: Number(l.price ?? 0) / 100,
        period: `${l.durationDays}${t('page.vip.dayUnit')}`,
      }))
      const finalOpts = opts.length > 0 ? opts : defaultPlans
      setPriceOptions(finalOpts)
      setSelectedPlan((prev) => prev ?? finalOpts[0] ?? null)
      setLoadFailed(false)
    } catch (e) {
      logger.error('vip/index', '获取VIP信息', e)
      setPriceOptions(defaultPlans)
      setSelectedPlan((prev) => prev ?? defaultPlans[0] ?? null)
      setLoadFailed(true)
      onToast(t('common.failed'), { kind: 'error' })
    } finally {
      Taro.hideLoading()
    }
  }, [t, defaultPlans])

  const onSelectPlan = useCallback(
    (id: string) => {
      const plan = priceOptions.find((opt) => opt.id === id)
      if (plan) setSelectedPlan(plan)
    },
    [priceOptions],
  )

  // 等级卡片上的「开通会员」:与底部购买栏同一条支付链路 —— 先选中该等级,再走确认弹窗
  const onLevelPurchase = useCallback(
    (levelId: string) => {
      const plan = priceOptions.find((opt) => opt.id === levelId)
      if (!plan) {
        onToast(t('vip.selectPlanFirst'), { kind: 'info' })
        return
      }
      setSelectedPlan(plan)
      setShowPayConfirm(true)
    },
    [priceOptions, t],
  )

  const onUpgradeClick = useCallback(() => {
    if (!selectedPlan) {
      onToast(t('vip.selectPlanFirst'), { kind: 'info' })
      return
    }
    setShowPayConfirm(true)
  }, [selectedPlan, t])

  const onConfirmPay = useCallback(async () => {
    if (!selectedPlan) return
    setShowPayConfirm(false)
    try {
      if (autoRenew) {
        const signRes = await signRecurringContract({ planId: selectedPlan.id })
        Taro.navigateTo({
          url: `/pages/webview/index?url=${encodeURIComponent(signRes.signUrl)}`,
        })
        return
      }
      const res = await upgradeVip(selectedPlan.id)
      dispatchVipPay(res.payInfo, res.orderNo, selectedPlan.price, selectedPlan.name)
    } catch (e) {
      logger.error('vip/index', '开通VIP', e)
      onToast(t('common.failed'), { kind: 'error' })
    }
  }, [selectedPlan, autoRenew, t, dispatchVipPay])

  const onBenefitsClick = useCallback(() => setShowBenefits(true), [])
  const onIntroduceClick = useCallback(() => setShowIntroduce(true), [])
  const onIntroduceSubscribe = useCallback(() => {
    if (!selectedPlan) {
      onToast(t('vip.selectPlanFirst'), { kind: 'info' })
      return
    }
    setShowIntroduce(false)
    setShowConfirm(true)
  }, [selectedPlan, t])
  const onConfirmNext = useCallback(() => {
    setShowConfirm(false)
    setNoticeAgreed(false)
    setShowNotice(true)
  }, [])
  const onNoticeContinue = useCallback(() => {
    if (!noticeAgreed) {
      onToast(t('vip.index.agreeFirst'), { kind: 'info' })
      return
    }
    setShowNotice(false)
    setShowPayMethod(true)
  }, [noticeAgreed, t])
  const onPayMethodConfirm = useCallback(() => {
    setShowPayMethod(false)
    // XUI-038:选完支付方式必须走真实下单+requestPayment 链路,不能在本地直接置成功态。
    void onConfirmPay()
  }, [onConfirmPay])
  const onSuccessViewBenefits = useCallback(() => {
    setShowSuccess(false)
    setShowBenefits(true)
  }, [])

  // G-933 冷启动门控：load 内是 Promise.all([getVipInfo(需鉴权)、getVipPrivilege、getVipLevels])
  // 且共用同一次 showLoading/hideLoading —— 拆支会改该页加载态语义，故整块延后到鉴权判定落定。
  const { waitUntilReady } = useAuthReadyGate()
  useDidShow(() => {
    waitUntilReady(() => {
      void load()
    })
  })

  const currentPrice = selectedPlan?.price ?? 0
  const daysLeft = info.expireTime ? daysUntil(info.expireTime) : null

  const benefitItems = useMemo<VipBenefitCardItem[]>(() => {
    const seen = new Set<string>()
    const items: VipBenefitCardItem[] = []
    for (const level of levels) {
      for (const title of normalizeLevelBenefits(level.benefits)) {
        if (seen.has(title)) continue
        seen.add(title)
        items.push({ key: title, title })
      }
    }
    return items
  }, [levels])

  const overlayHandlers: VipIndexOverlayHandlers = {
    onCloseBenefits: () => setShowBenefits(false),
    onUpgradeFromBenefits: () => {
      setShowBenefits(false)
      setShowPayConfirm(true)
    },
    onClosePayConfirm: () => setShowPayConfirm(false),
    onConfirmPay: () => void onConfirmPay(),
    onSelectPayMethod: (method) => setPayMethod(method),
    onCloseIntroduce: () => setShowIntroduce(false),
    onIntroduceSubscribe,
    onCloseConfirm: () => setShowConfirm(false),
    onConfirmNext,
    onCloseNotice: () => setShowNotice(false),
    onToggleNoticeAgree: () => setNoticeAgreed((v) => !v),
    onNoticeContinue,
    onClosePayMethod: () => setShowPayMethod(false),
    onPayMethodConfirm,
    onSuccessViewBenefits,
  }

  return (
    <ThemeRoot>
      <SharedVipScreen
        t={t as unknown as TFunction}
        levels={levels.map<VipLevelItem2>((l) => ({
          id: String(l.id),
          levelName: l.levelName,
          levelValue: l.levelValue ?? 0,
          price: Number(l.price ?? 0) / 100,
          durationDays: l.durationDays,
          status: 1,
          benefits: normalizeLevelBenefits(l.benefits),
        }))}
        membership={
          info.level > 0
            ? {
                isActive: true,
                level: info.level,
                levelName: info.name,
                expireTime: info.expireTime
                  ? formatDateByTemplate(info.expireTime, 'YYYY-MM-DD')
                  : '',
                daysRemaining: daysLeft ?? 0,
              }
            : null
        }
        loading={!levelsLoaded && !loadFailed}
        refreshing={false}
        error=""
        toast={loadFailed ? t('common.failed') : ''}
        purchasingId={null}
        onRefresh={() => void load()}
        onPurchase={(level: VipLevelItem2) => onLevelPurchase(level.id)}
        onBack={() => {
          void Taro.navigateBack()
        }}
        colorScheme={resolvedTheme}
        benefitItems={benefitItems}
        onNavigate={() => {}}
        onToast={onToast}
        headerPrice={currentPrice}
        introduce={{ label: t('vip.index.introduce'), onPress: onIntroduceClick }}
        features={buildVipIndexFeatures(tt)}
        viewBenefits={{ label: t('vip.viewAllBenefits'), onPress: onBenefitsClick }}
        plans={{
          title: t('vip.plans'),
          options: priceOptions,
          selectedId: selectedPlan?.id ?? '',
          onSelect: onSelectPlan,
          autoRenewLabel: t('vip.index.autoRenew'),
          autoRenew,
          onToggleAutoRenew: () => setAutoRenew((v) => !v),
          manageLabel: t('vip.index.manageAutoRenew'),
          onManage: () => Taro.navigateTo({ url: '/pkg-learn/subscription/contracts/index' }),
          memberDescTitle: t('vip.memberDesc'),
          memberDescText: t('vip.memberDescText'),
        }}
        buyBar={{ price: currentPrice, label: t('vip.subscribe'), onPress: onUpgradeClick }}
        overlay={buildVipIndexOverlay(
          {
            showBenefits,
            showPayConfirm,
            showIntroduce,
            showConfirm,
            showNotice,
            showPayMethod,
            showSuccess,
            noticeAgreed,
            payMethod,
            plan: selectedPlan
              ? {
                  name: selectedPlan.name,
                  price: selectedPlan.price,
                  period: selectedPlan.period,
                  originalPrice: selectedPlan.originalPrice,
                }
              : null,
            benefits: benefits.map((item) => ({
              key: String(item.id),
              title: String(item.title ?? ''),
              desc: String(item.desc ?? ''),
            })),
          },
          overlayHandlers,
          tt,
        )}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
