// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 对齐目标(RN 共享屏): packages/app/src/features/vip/VipScreen.tsx
//
// 本页是**薄壳**:版面(头部/会员状态卡/特权清单/权益详情/等级目录/套餐区/底部购买栏)全部由共享屏渲染;
// 本端只保留不可上提的平台事实:
//   ① 取数(getVipInfo/getVipPrivilege/getVipLevels)+ G-933 冷启动鉴权门控 + useDidShow 重拉
//   ② 套餐数据与选中态、自动续费开关状态
//   ③ 支付分发 requestWxPayment / 签约跳转 / 成功页跳转(平台专属)
//   ④ toast、导航、loading/刷新/错误重试状态
//   ⑤ 背景图资源 URI 与端内图标体系(LineIcon)注入
//   ⑥ 购买流程 5 弹层 + 既有两个弹窗组件(见 ./purchase-overlays.tsx)
import { useTt, useI18n } from '@/i18n'
import { logger } from '@/utils/logger'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import LineIcon, { type IconName } from '@/components/LineIcon'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback, useMemo, useRef } from 'react'
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
import { type VipBenefit, type PriceOption } from '@/components'
import { VipScreen as SharedVipScreen } from '@ihui/rn-app/features/vip/VipScreen'
import type {
  OnNavigate,
  VipLevelItem2,
  VipMembershipInfo,
  VipPlanItem,
  VipPrivilegeItem,
} from '@ihui/types'
import './index.css'
import { aizhsUrl } from '@/constants/icon-urls'
import { useTheme } from '@/rn-compat/theme'
import { onToast } from '@/host/on-toast'
import VipPurchaseOverlays from './purchase-overlays'

// 6 项会员特权(对齐原项目 zhs_app-ZZ,垂直列表展示)
interface VipFeature {
  id: string
  icon: string
  title: string
  desc: string
}

/** GET /api/vip/my 的真实回包 = { vip: userVips 行 + levelName }(apps/api/src/routes/vip.ts),
 *  与 api 层 VipInfo 的扁平声明不同形;两种形态都认,否则「当前等级 / 到期时间」恒读成未开通。 */
interface VipMineRow {
  levelValue?: number
  levelName?: string
  endTime?: string
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

/** 剩余天数只做算术、不承担格式展示;有效期缺失/不可解析 ⇒ null(判不出就不渲染这一天) */
function daysUntil(expire: string): number | null {
  const at = Date.parse(expire)
  if (!Number.isFinite(at)) return null
  return Math.max(0, Math.ceil((at - Date.now()) / 86400000))
}

/**
 * 等级权益归一 —— 与 RN 端 apps/mobile-rn/src/screens/VipScreen.tsx:57 normalizeBenefits 同口径:
 * 接口 benefits 实返数组(字符串或 { name } 对象),api-client 声明成 Record 属历史漂移;
 * 取不到 / 非数组一律空 ⇒ 按「该等级无权益数据」处理,不造词。
 */
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
      const name = (item as { name?: unknown }).name
      if (typeof name === 'string' && name.trim()) out.push(name.trim())
    }
  }
  return out
}

/** 后端 price 单位为分,共享屏等级卡按元展示 ⇒ 在此换算,显示与旧端 formatPrice 一致 */
function toLevelItem(level: VipLevel): VipLevelItem2 {
  return {
    id: String(level.id),
    levelName: level.levelName,
    levelValue: level.levelValue,
    price: level.price / 100,
    durationDays: level.durationDays,
    status: level.status,
    benefits: normalizeLevelBenefits(level.benefits),
  }
}

/**
 * B1 契约冻结:共享屏只 assert 端口、尚未调用导航;落空必须可见失败,不静默吞。
 */
const onNavigate: OnNavigate = (target) => {
  onToast(`导航未接入: ${target}`, { kind: 'error' })
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

  const features = useMemo<ReadonlyArray<VipFeature>>(
    () => [
      {
        id: 'ai_copywriting',
        icon: 'sparkles',
        title: tt('vip.feature.aiCopywriting', 'AI营销文案'),
        desc: tt('vip.feature.aiCopywritingDesc', '智能生成各类营销文案'),
      },
      {
        id: 'ai_chat',
        icon: 'message-circle',
        title: tt('vip.feature.aiChat', 'AI智能对话'),
        desc: tt('vip.feature.aiChatDesc', '智能助手解答各类问题'),
      },
      {
        id: 'ai_analysis',
        icon: 'bar-chart-3',
        title: tt('vip.feature.aiAnalysis', 'AI数据分析'),
        desc: tt('vip.feature.aiAnalysisDesc', '智能分析各类数据报表'),
      },
      {
        id: 'ai_design',
        icon: 'palette',
        title: tt('vip.feature.aiDesign', 'AI智能设计'),
        desc: tt('vip.feature.aiDesignDesc', '智能生成图片和设计'),
      },
      {
        id: 'ai_video',
        icon: 'film',
        title: tt('vip.feature.aiVideo', 'AI视频制作'),
        desc: tt('vip.feature.aiVideoDesc', '智能生成视频内容'),
      },
      {
        id: 'ai_live',
        icon: 'radio',
        title: tt('vip.feature.aiLive', 'AI直播助手'),
        desc: tt('vip.feature.aiLiveDesc', '智能直播辅助工具'),
      },
    ],
    [tt],
  )

  const [info, setInfo] = useState<VipInfo>({} as VipInfo)
  const [levels, setLevels] = useState<VipLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [benefits, setBenefits] = useState<VipBenefit[]>([])
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([])
  const [selectedPlan, setSelectedPlan] = useState<PriceOption | null>(null)
  const [showBenefits, setShowBenefits] = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [payMethod, setPayMethod] = useState<'wechat' | 'alipay'>('wechat')
  const [autoRenew, setAutoRenew] = useState(false)
  // 5 弹窗 state
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

  // 首次加载走整屏骨架;回前台/下拉刷新走刷新态,避免每次进页都闪骨架
  const hasLoadedRef = useRef(false)

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = hasLoadedRef.current ? 'refresh' : 'initial') => {
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      try {
        const [i, p, lv] = await Promise.all([getVipInfo(), getVipPrivilege(), getVipLevels()])
        setInfo(toVipInfo(i))
        setLevels(lv.items || [])
        const list = (p.list || []).map((item) => ({
          id: String(item.id),
          title: item.title,
          desc: item.desc,
        })) as VipBenefit[]
        setBenefits(list)
        const opts = (lv.items || []).map((l) => ({
          id: String(l.id),
          name: l.levelName,
          price: l.price / 100,
          period: `${l.durationDays}${t('page.vip.dayUnit')}`,
        })) as PriceOption[]
        const finalOpts = opts.length > 0 ? opts : defaultPlans
        setPriceOptions(finalOpts)
        setSelectedPlan((prev) => prev ?? finalOpts[0] ?? null)
        setLoadFailed(false)
        hasLoadedRef.current = true
      } catch (e) {
        logger.error('vip/index', '获取VIP信息', e)
        setPriceOptions(defaultPlans)
        setSelectedPlan((prev) => prev ?? defaultPlans[0] ?? null)
        setLoadFailed(true)
        onToast(t('common.failed'), { kind: 'error' })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t, defaultPlans],
  )

  const onSelectPlan = useCallback(
    (plan: VipPlanItem) => {
      const opt = priceOptions.find((item) => item.id === plan.id)
      if (opt) setSelectedPlan(opt)
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

  const onManage = useCallback(() => {
    Taro.navigateTo({ url: '/pkg-learn/subscription/contracts/index' })
  }, [])

  const onBenefitsClick = useCallback(() => {
    setShowBenefits(true)
  }, [])

  // 5 弹窗流程 handlers
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
  const onNoticeAgree = useCallback(() => {
    if (!noticeAgreed) {
      onToast(t('vip.index.agreeFirst'), { kind: 'info' })
      return
    }
    setShowNotice(false)
    setShowPayMethod(true)
  }, [noticeAgreed, t])
  const onPayMethodConfirm = useCallback(() => {
    setShowPayMethod(false)
    setShowSuccess(true)
  }, [])
  const onSuccessViewBenefits = useCallback(() => {
    setShowSuccess(false)
    setShowBenefits(true)
  }, [])

  // G-933 冷启动门控：load 内是 Promise.all([getVipInfo(需鉴权，routes/vip.ts 处理器 await authenticate)、
  // getVipPrivilege、getVipLevels(公开)]) 且共用同一次加载态 —— 拆支会改该页加载语义，
  // 故整块延后到「鉴权判定落定」。注意 waitUntilReady 只等落定、不等登录 ⇒ 游客在落定后照样走一次
  // (各支自带 .catch/兜底)，所以这是消掉冷启动那一拍，不是把抢跑换成游客白屏。
  const { waitUntilReady } = useAuthReadyGate()
  useDidShow(() => {
    waitUntilReady(() => {
      void load()
    })
  })

  const currentPrice = selectedPlan?.price ?? 0
  const daysLeft = info.expireTime ? daysUntil(info.expireTime) : null

  const membership = useMemo<VipMembershipInfo>(
    () => ({
      isActive: !!info.level,
      level: info.level ?? 0,
      levelName: info.name ?? '',
      expireTime: info.expireTime ? formatDateByTemplate(info.expireTime, 'YYYY-MM-DD') : '',
      daysRemaining: daysLeft ?? 0,
    }),
    [info, daysLeft],
  )

  const levelItems = useMemo(() => levels.map(toLevelItem), [levels])

  const plans = useMemo<VipPlanItem[]>(
    () =>
      priceOptions.map((opt) => ({
        id: opt.id,
        name: opt.name,
        price: opt.price,
        originalPrice: opt.originalPrice,
        period: opt.period,
      })),
    [priceOptions],
  )

  const privilegeItems = useMemo<VipPrivilegeItem[]>(
    () =>
      features.map((f) => ({
        id: f.id,
        title: f.title,
        desc: f.desc,
        badge: 'VIP',
        icon: (
          <LineIcon name={f.icon as IconName} size={40} color="var(--color-muted-foreground)" />
        ),
      })),
    [features],
  )

  /**
   * 权益详情条目:各等级 benefits 的并集去重(与 RN 端 apps/mobile-rn/src/screens/VipScreen.tsx:464
   * 同口径 —— Set<string> 按标题首见去重、顺序为 levels → benefits 遍历序);标题即接口文案本身,
   * 不另造词,也不带副文案。全部等级都没有 benefits ⇒ 空数组 ⇒ 该区不渲染。
   */
  const benefitItems = useMemo(() => {
    const seen = new Set<string>()
    const items: { key: string; title: string }[] = []
    for (const level of levels) {
      for (const title of normalizeLevelBenefits(level.benefits)) {
        if (seen.has(title)) continue
        seen.add(title)
        items.push({ key: title, title })
      }
    }
    return items
  }, [levels])

  return (
    <ThemeRoot className="vip-shared-root">
      <SharedVipScreen
        t={t}
        levels={levelItems}
        membership={membership}
        loading={loading}
        refreshing={refreshing}
        error={loadFailed ? t('common.failed') : ''}
        toast=""
        purchasingId={null}
        onRefresh={() => void load('refresh')}
        onPurchase={(level) => onLevelPurchase(level.id)}
        onRetry={() => void load('initial')}
        onBack={() => void Taro.navigateBack()}
        colorScheme={resolvedTheme}
        onNavigate={onNavigate}
        onToast={onToast}
        inlineError
        retryLabel={t('vip.retry')}
        headerBackgroundUri={aizhsUrl('remote-images/vip_back.png')}
        headerPrice={currentPrice}
        showBack={false}
        introduceLabel={t('vip.index.introduce')}
        onIntroduce={onIntroduceClick}
        showInactiveMembership
        privilegeItems={privilegeItems}
        onViewAllPrivileges={onBenefitsClick}
        benefitsAfterLevels
        plans={plans}
        selectedPlanId={selectedPlan?.id ?? ''}
        onSelectPlan={onSelectPlan}
        autoRenew={autoRenew}
        onToggleAutoRenew={() => setAutoRenew((v) => !v)}
        autoRenewLabel={t('vip.index.autoRenew')}
        onManage={onManage}
        manageLabel={t('vip.index.manageAutoRenew')}
        purchasePrice={currentPrice}
        onUpgrade={onUpgradeClick}
        purchaseLabel={t('vip.subscribe')}
        benefitItems={benefitItems}
      />

      <VipPurchaseOverlays
        showBenefits={showBenefits}
        benefits={benefits}
        onBenefitsUpgrade={() => {
          setShowBenefits(false)
          setShowPayConfirm(true)
        }}
        onBenefitsClose={() => setShowBenefits(false)}
        showPayConfirm={showPayConfirm}
        plan={selectedPlan}
        payMethod={payMethod}
        onPayConfirm={onConfirmPay}
        onPayCancel={() => setShowPayConfirm(false)}
        onPayMethodChange={setPayMethod}
        showIntroduce={showIntroduce}
        onCloseIntroduce={() => setShowIntroduce(false)}
        onIntroduceSubscribe={onIntroduceSubscribe}
        showConfirm={showConfirm}
        onCloseConfirm={() => setShowConfirm(false)}
        onConfirmNext={onConfirmNext}
        showNotice={showNotice}
        noticeAgreed={noticeAgreed}
        onToggleNoticeAgreed={() => setNoticeAgreed((v) => !v)}
        onCloseNotice={() => setShowNotice(false)}
        onNoticeAgree={onNoticeAgree}
        showPayMethod={showPayMethod}
        onClosePayMethod={() => setShowPayMethod(false)}
        onPayMethodConfirm={onPayMethodConfirm}
        showSuccess={showSuccess}
        onSuccessViewBenefits={onSuccessViewBenefits}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
