// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/model-income/ModelIncomeScreen.tsx(直载共享屏 + 注入本端事实)
//
// 薄壳口径(与 pages/member/coupon、pages/member/benefits 同一路线):
//   · 版面/样式/词条真相源 = 共享屏;端内只保留业务腿 + 本端事实。
//   · 两路取数(getBuyInfo / getBuyList)、分页、鉴权门、提现明细、两步提现状态机、
//     toast、错误态/重试、返回 —— 全部仍在壳里(共享屏不碰任何平台 API)。
//   · 本端 GET /api/developer/income 的行只有 {id,title,time,amount}(rate/orderId 结构上不存在,
//     见 apps/api/src/routes/developer.ts 的 GET /income),故共享屏的明细卡片按「有值才渲染」,
//     缺列的列/块整块不出现,壳也不再补 0 假值。
//   · 提现弹层(方式选择 → 金额输入)与「提现明细」子视图由壳注入:
//     renderWithdrawModal / renderSubView / onOpenWithdrawDetail + withdrawDetailLabel。

import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'
import { rnRadius, taroSpacing } from '@ihui/design-tokens'
import { rpx } from '@/utils/rpx'
import { getBuyInfo, getBuyList, getDeveloperWithdrawalList, post } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { getUserInfo } from '@/utils/auth'
import { useTt } from '@/i18n'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import { FocusInput } from '@/components/FocusField'
import LineIcon from '@/components/LineIcon'
import { ModelIncomeScreen } from '@ihui/rn-app/features/model-income/ModelIncomeScreen'
import type { ModelIncomeItem, ModelIncomeSummary, ModelIncomeTab } from '@ihui/types'
import { onToast } from '@/host/on-toast'
import './income.css'

interface BuyInfo {
  AccumulatedIncome?: number
  WithdrawableAmount?: number
  WithdrawnAmount?: number
  todayAccount?: number
  PendingSettlement?: number
  accumulatedIncome?: number
  withdrawableAmount?: number
  withdrawnAmount?: number
  todayIncome?: number
  pendingSettlement?: number
  total?: number
  available?: number
  withdrawn?: number
}

interface IncomeItem {
  id: string | number
  title?: string
  name?: string
  time?: string
  createTime?: string
  createdAt?: string
  amount?: number
  money?: number
  settlement?: string | number
  settleStatus?: string | number
  status?: string | number
  /**
   * 可达性复核(2026-10-30 取证):GET /api/developer/income 的响应体在
   * apps/api/src/routes/developer.ts 的 GET /income 处理器里**固定映射**为
   * { id, title, time, amount } 四键,rate/orderId 结构上不可能出现;
   * 且底层 token_flows 表(packages/database/src/schema/wallet.ts)根本没有
   * 分成比例列,无任何接口可按流水补 rate ⇒ 共享屏的 rate 段在本端缺省不渲染。
   * 订单行退用流水 id 渲染(①可达)。
   */
}

interface IncomeListResponse {
  list?: IncomeItem[]
  data?: IncomeItem[]
  dataList?: IncomeItem[]
  total?: number
}

interface CashItem {
  id: string | number
  amount?: number
  time?: string
  createdAt?: string
  status?: string | number
  statusText?: string
}

interface CashListResponse {
  list?: CashItem[]
  data?: CashItem[]
}

const PAGE_SIZE = 10

/**
 * 共享屏取词的回退表:本端词包(packages/i18n/messages/miniapp-taro/zh-CN.json)没有这些
 * modelIncome 键,直接喂 useI18n 的 t 会把键名原样上屏 ⇒ 逐键给端内既有文案。
 * 已有键(accumulated/withdrawable/withdrawn/empty/retry/tip/title/orderLabel/rateLabel/
 * withdrawModal.title|wechat|moreMethods|confirm、common.*)仍走词包,不在此重复。
 */
const SHARED_T_FALLBACKS: Record<string, string> = {
  'modelIncome.tab.all': '全部',
  'modelIncome.tab.pending': '待结算',
  'modelIncome.tab.settled': '已结算',
  'modelIncome.withdrawBtn': '提现',
  'modelIncome.today': '今日收益',
  'modelIncome.pending': '待结算',
  'modelIncome.yuan': '元',
  'modelIncome.withdrawModal.subtitle': '可提现金额',
  'modelIncome.withdrawDetail': '提现明细',
}

/** tab key ↔ 后端 settlement 档位('' 全部 / '1' 待结算 / '2' 已结算) */
function tabToSettlement(tab: ModelIncomeTab): string {
  if (tab === 'pending') return '1'
  if (tab === 'settled') return '2'
  return ''
}

function settlementToTab(settlement: string): ModelIncomeTab {
  if (settlement === '1') return 'pending'
  if (settlement === '2') return 'settled'
  return 'all'
}

export default function DeveloperIncome() {
  const tt = useTt()
  const { resolvedTheme } = useTheme()
  const gate = useAuthReadyGate()

  const [title, setTitle] = useState<'income' | 'detail'>('income')
  const [settlement, setSettlement] = useState('')
  const [buyInfo, setBuyInfo] = useState<BuyInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [incomeList, setIncomeList] = useState<IncomeItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cashList, setCashList] = useState<CashItem[]>([])
  const [cashLoaded, setCashLoaded] = useState(false)

  const [showIncomePopup, setShowIncomePopup] = useState(false)
  const [incomeType, setIncomeType] = useState<'wechat' | ''>('wechat')
  const [showPopup, setShowPopup] = useState(false)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const getUuid = useCallback(() => getUserInfo()?.uuid || '', [])

  // 共享屏取词:先查端内词包,再按回退表,最后才是键名(与 useTt 同形的三级回落)
  const tShared = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      tt(key, SHARED_T_FALLBACKS[key] ?? key, params),
    [tt],
  )

  const loadBuyInfo = useCallback(async (): Promise<boolean> => {
    try {
      const res = (await getBuyInfo({ uuid: getUuid() })) as BuyInfo
      setBuyInfo(res)
      return true
    } catch {
      // 失败由调用方合成错误态(共享屏 ErrorState + 重试)
      return false
    }
  }, [getUuid])

  const fetchIncomeList = useCallback(
    async (p: number, st: string, append: boolean): Promise<boolean> => {
      if (append) setLoadingMore(true)
      try {
        const res = (await getBuyList({
          page: p,
          page_size: PAGE_SIZE,
          settlement: st,
          uuid: getUuid(),
        })) as IncomeListResponse
        const items = res?.list || res?.data || res?.dataList || []
        setIncomeList((prev) => (append ? [...prev, ...items] : items))
        setTotal(res?.total ?? items.length)
        setPage(p)
        return true
      } catch {
        return false
      } finally {
        setLoadingMore(false)
      }
    },
    [getUuid],
  )

  const loadCashList = useCallback(async () => {
    try {
      const res = (await getDeveloperWithdrawalList()) as CashListResponse
      setCashList(res?.list || res?.data || [])
    } catch {
      // ignore
    } finally {
      setCashLoaded(true)
    }
  }, [])

  // G-933 冷启动抢跑门控:挂载那两支 GET /api/developer/income(loadBuyInfo 与
  // fetchIncomeList 同一端点,apps/api/src/routes/developer.ts:334)整组开发者路由由
  // 统一 preHandler 守(developer.ts:152 `server.addHook('preHandler', requireAuth)`,
  // 注册前缀 /api/developer 见 routes/index.ts:794)⇒ 需鉴权,整块挡到门后。
  // setLoading(true) 一并挪进门后:落定时同步执行,序列与原来逐字相同。
  // loadCashList(GET /api/developer/withdrawals,同组 requireAuth)由点击"提现明细"触发,
  // 不属挂载抢跑,原样不动。
  const reload = useCallback(() => {
    setLoading(true)
    setError(false)
    void Promise.all([loadBuyInfo(), fetchIncomeList(1, '', false)])
      .then(([infoOk, listOk]) => setError(!infoOk || !listOk))
      .finally(() => setLoading(false))
  }, [fetchIncomeList, loadBuyInfo])

  useDidShow(() => {
    gate.waitUntilReady(reload)
  })

  const hasMore = incomeList.length < total
  // 双通道触底(页面级 useReachBottom + 共享屏 ScrollView onScrollToLower)可能同帧各发一次,
  // 用 ref 做同步闸,确保与原页一样「一次滚动只取一页」
  const loadMoreGuard = useRef(false)
  const loadMore = useCallback(() => {
    if (title !== 'income' || loadingMore || loadMoreGuard.current) return
    if (incomeList.length >= total) return
    loadMoreGuard.current = true
    void fetchIncomeList(page + 1, settlement, true).finally(() => {
      loadMoreGuard.current = false
    })
  }, [title, loadingMore, incomeList.length, total, fetchIncomeList, page, settlement])

  // 触底续取:页面级手势(原实现)保留;共享屏 FlatList 的 onEndReached 也接同一支(两支都有 loadingMore 闸)
  useReachBottom(loadMore)

  const accumulated =
    buyInfo?.AccumulatedIncome ?? buyInfo?.accumulatedIncome ?? buyInfo?.total ?? 0
  const available =
    buyInfo?.WithdrawableAmount ?? buyInfo?.withdrawableAmount ?? buyInfo?.available ?? 0
  const withdrawn = buyInfo?.WithdrawnAmount ?? buyInfo?.withdrawnAmount ?? buyInfo?.withdrawn ?? 0
  const todayAccount = buyInfo?.todayAccount ?? buyInfo?.todayIncome ?? 0
  const pendingSettlement = buyInfo?.PendingSettlement ?? buyInfo?.pendingSettlement ?? 0

  const onChangeTab = (tab: ModelIncomeTab) => {
    const st = tabToSettlement(tab)
    setSettlement(st)
    void fetchIncomeList(1, st, false)
  }

  const onSwitchToDetail = () => {
    setTitle('detail')
    if (!cashLoaded) void loadCashList()
  }

  const backToIncome = () => {
    setTitle('income')
  }

  const openIncomePopup = () => {
    if (available <= 0) {
      onToast(tt('developer.income.noAvailable', '暂无可提现金额'), { kind: 'info' })
      return
    }
    setIncomeType('wechat')
    setShowIncomePopup(true)
  }

  const closeIncomePopup = () => {
    if (!submitting) setShowIncomePopup(false)
  }

  const onIncomeMethodConfirm = () => {
    if (!incomeType) {
      onToast(tt('developer.income.selectMethod', '请选择提现方式'), { kind: 'info' })
      return
    }
    setShowIncomePopup(false)
    setAmount('')
    setShowPopup(true)
  }

  const closePopup = () => {
    if (!submitting) setShowPopup(false)
  }

  const confirmWithdraw = async () => {
    const num = Number(amount)
    if (!num || num <= 0) {
      onToast(tt('developer.income.invalidAmount', '请输入有效金额'), { kind: 'error' })
      return
    }
    if (num > available) {
      onToast(tt('developer.income.exceedAvailable', '提现金额超出可提现额度'), { kind: 'error' })
      return
    }
    setSubmitting(true)
    try {
      await post('/developer/withdrawals', { amount: num })
      onToast(tt('developer.income.withdrawSubmitted', '提现申请已提交'), { kind: 'success' })
      setShowPopup(false)
      await Promise.all([loadBuyInfo(), fetchIncomeList(1, settlement, false)])
    } catch {
      onToast(tt('developer.income.withdrawFailed', '提现失败,请稍后重试'), { kind: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const displayTime = (item: IncomeItem) => item.time || item.createTime || item.createdAt || ''
  const displayTitle = (item: IncomeItem) =>
    item.title || item.name || tt('developer.income.titleIncome', '智能体收入')

  /** 结算状态 → 共享屏词汇;原页只识别 '2' 已结算 / '1' 待结算,其余一律「未知」不上面 */
  const displayStatus = (item: IncomeItem): string | undefined => {
    const s = item.settlement ?? item.settleStatus ?? item.status
    if (s === '2' || s === 'settled') return 'settled'
    if (s === '1' || s === 'pending') return 'pending'
    return undefined
  }

  const displayAmount = (item: IncomeItem): number | undefined => {
    const v = item.amount ?? item.money
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined
  }

  const cashTime = (item: CashItem) => item.time || item.createdAt || ''
  const cashStatusText = (item: CashItem) => {
    const s = String(item.statusText || item.status || '').toLowerCase()
    if (['success', 'completed', '2', 'paid', 'finished'].includes(s))
      return tt('developer.income.settled', '已结算')
    return tt('developer.income.processing', '处理中')
  }

  const items: ModelIncomeItem[] = incomeList.map((item) => {
    const time = displayTime(item)
    const status = displayStatus(item)
    const amountOfRow = displayAmount(item)
    return {
      id: String(item.id),
      // 后端只出 id ⇒ 订单行按既定口径退用流水 id(键可达)
      orderId: String(item.id),
      title: displayTitle(item),
      ...(time ? { createdAt: time } : {}),
      ...(status ? { status } : {}),
      ...(amountOfRow !== undefined ? { commissionAmount: amountOfRow } : {}),
    }
  })

  const summary: ModelIncomeSummary = {
    totalCommission: accumulated,
    availableCommission: available,
    withdrawnCommission: withdrawn,
    pendingCommission: pendingSettlement,
    day: todayAccount,
  }

  // 「提现明细」子视图:由壳渲染、共享屏只保留页头(收入列表本身仍由共享屏渲染)
  const cashView = (
    <View className="cash-list">
      {!cashLoaded ? (
        <Text className="income-empty">{tt('common.loading', '加载中…')}</Text>
      ) : cashList.length ? (
        cashList.map((item, idx) => (
          <View key={item.id ?? idx} className="cash-item">
            <View>
              <Text className="income-item-amount">-¥{Number(item.amount ?? 0)}</Text>
              <Text className="income-item-time">{cashTime(item)}</Text>
            </View>
            <Text className="income-item-time">{cashStatusText(item)}</Text>
          </View>
        ))
      ) : (
        <Text className="income-empty">{tt('developer.income.cashEmpty', '暂无提现明细')}</Text>
      )}
    </View>
  )

  // 两步提现弹层(方式选择 → 金额输入):共享屏 renderWithdrawModal 的注入物
  const withdrawModalView = () => (
    <>
      {showIncomePopup ? (
        <View className="income-popup-mask" onClick={closeIncomePopup}>
          <View className="income-popup" onClick={(e) => e.stopPropagation()}>
            <View
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: 'var(--spacing-xs-loose)',
              }}
            >
              <Text
                style={{
                  width: '72rpx',
                  height: '72rpx',
                  lineHeight: '72rpx',
                  textAlign: 'center',
                  background: 'var(--color-primary)',
                  color: 'var(--color-primary-foreground)',
                  borderRadius: rnRadius.xl,
                  fontSize: '32rpx',
                  marginRight: 'var(--spacing-sm)',
                }}
              >
                ¥
              </Text>
              <Text className="income-popup-title">
                {tt('modelIncome.withdrawModal.title', '选择提现方式')}
              </Text>
            </View>
            <Text
              className="income-popup-sub"
              style={{ marginBottom: rpx(taroSpacing['md-loose']) }}
            >
              {tt('modelIncome.withdrawModal.moreMethods', '更多提现方式')}
            </Text>
            <View
              className="income-popup-sub"
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                padding: 'var(--spacing-sm-loose)',
                background:
                  incomeType === 'wechat' ? 'var(--color-muted)' : 'var(--color-background)',
                borderRadius: rnRadius.md,
                marginBottom: rpx(taroSpacing['md-loose']),
                boxSizing: 'border-box',
              }}
              onClick={() => setIncomeType((prev) => (prev === 'wechat' ? '' : 'wechat'))}
              hoverClass="opacity-60"
            >
              <Text
                style={{
                  width: '72rpx',
                  height: '72rpx',
                  lineHeight: '72rpx',
                  textAlign: 'center',
                  background: 'var(--color-wechat-green)',
                  color: 'var(--color-surface-light)',
                  borderRadius: rnRadius.xl,
                  fontSize: '32rpx',
                  marginRight: 'var(--spacing-sm)',
                }}
              >
                微
              </Text>
              <Text style={{ flex: 1, fontSize: '28rpx', color: 'var(--color-foreground)' }}>
                {tt('modelIncome.withdrawModal.wechat', '微信提现')}
              </Text>
              <View
                style={{
                  width: '36rpx',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                {incomeType === 'wechat' ? (
                  <LineIcon name="check" size={32} color="var(--color-primary)" />
                ) : null}
              </View>
            </View>
            <View style={{ display: 'flex', width: '100%', gap: 'var(--spacing-sm-loose)' }}>
              <View
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: `${rpx(taroSpacing['sm-loose'])} 0`,
                  borderRadius: rnRadius.xl,
                  background: 'var(--color-secondary)',
                }}
                onClick={closeIncomePopup}
                hoverClass="opacity-60"
              >
                <Text style={{ fontSize: '28rpx', color: 'var(--color-secondary-foreground)' }}>
                  {tt('common.cancel', '取消')}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: `${rpx(taroSpacing['sm-loose'])} 0`,
                  borderRadius: rnRadius.xl,
                  background: 'var(--color-primary)',
                }}
                onClick={onIncomeMethodConfirm}
                hoverClass="opacity-60"
              >
                <Text
                  style={{
                    fontSize: '28rpx',
                    color: 'var(--color-primary-foreground)',
                    fontWeight: 600,
                  }}
                >
                  {tt('developer.income.withdrawPopup', '提现')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {showPopup ? (
        <View className="income-popup-mask" onClick={closePopup}>
          <View
            className="income-popup"
            style={{ alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <Text
              style={{
                fontSize: '36rpx',
                fontWeight: 600,
                color: 'var(--color-foreground)',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              {tt('developer.income.withdrawPopup', '提现')}
            </Text>
            <Text
              style={{
                fontSize: '28rpx',
                color: 'var(--color-muted-foreground)',
                marginBottom: 'var(--spacing-md)',
              }}
            >
              {tt('developer.income.withdrawAvailable', '可提现金额 ¥')}
              {available}
            </Text>
            <View
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                background: 'var(--color-muted)',
                borderRadius: rnRadius.xl,
                padding: `${rpx(taroSpacing.sm)} ${rpx(taroSpacing['sm-loose'])}`,
                boxSizing: 'border-box',
                marginBottom: 'var(--spacing-sm)',
              }}
            >
              <Text
                style={{
                  fontSize: '32rpx',
                  fontWeight: 600,
                  color: 'var(--color-foreground)',
                  marginRight: 'var(--spacing-xs-loose)',
                }}
              >
                ¥
              </Text>
              <FocusInput
                style={{ flex: 1, fontSize: '32rpx', color: 'var(--color-foreground)' }}
                type="digit"
                placeholder={tt('developer.income.withdrawPlaceholder', '请输入提现金额')}
                value={amount}
                onInput={(e) => setAmount(e.detail.value)}
              />
            </View>
            <View
              style={{ alignSelf: 'flex-end', marginBottom: 'var(--spacing-lg)' }}
              onClick={() => setAmount(String(available))}
              hoverClass="opacity-60"
            >
              <Text style={{ fontSize: '28rpx', color: 'var(--color-primary)' }}>
                {tt('developer.income.withdrawAll', '全部提现')}
              </Text>
            </View>
            <View style={{ display: 'flex', width: '100%', gap: 'var(--spacing-sm-loose)' }}>
              <View
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: `${rpx(taroSpacing['sm-loose'])} 0`,
                  borderRadius: rnRadius.xl,
                  background: 'var(--color-secondary)',
                }}
                onClick={closePopup}
                hoverClass="opacity-60"
              >
                <Text style={{ fontSize: '28rpx', color: 'var(--color-secondary-foreground)' }}>
                  {tt('common.cancel', '取消')}
                </Text>
              </View>
              <View
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: `${rpx(taroSpacing['sm-loose'])} 0`,
                  borderRadius: rnRadius.xl,
                  background: 'var(--color-primary)',
                }}
                onClick={confirmWithdraw}
                hoverClass="opacity-60"
              >
                <Text
                  style={{
                    fontSize: '28rpx',
                    color: 'var(--color-primary-foreground)',
                    fontWeight: 600,
                  }}
                >
                  {submitting
                    ? tt('common.loading', '加载中…')
                    : tt('modelIncome.withdrawModal.confirm', '确认提现')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </>
  )

  return (
    <ThemeRoot>
      <ModelIncomeScreen
        t={tShared}
        items={items}
        summary={summary}
        loading={loading}
        refreshing={false}
        error={error ? tt('common.failed', '加载失败') : ''}
        activeTab={settlementToTab(settlement)}
        onSelectTab={onChangeTab}
        onRefresh={reload}
        showWithdrawModal={false}
        onOpenWithdraw={openIncomePopup}
        onCloseWithdraw={closeIncomePopup}
        onConfirmWithdraw={onIncomeMethodConfirm}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onBack={() => {
          if (title === 'detail') {
            backToIncome()
            return
          }
          void Taro.navigateBack()
        }}
        onRetry={reload}
        colorScheme={resolvedTheme}
        headerTitle={
          title === 'detail' ? tt('developer.income.titleDetail', '提现明细') : undefined
        }
        feeTip={
          title === 'income'
            ? tt('developer.income.feeTip', '平台限时不收取任何服务费')
            : undefined
        }
        onOpenWithdrawDetail={onSwitchToDetail}
        withdrawDetailLabel={tt('developer.income.cashDetail', '提现明细')}
        renderSubView={title === 'detail' ? cashView : undefined}
        renderWithdrawModal={withdrawModalView}
      />
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
