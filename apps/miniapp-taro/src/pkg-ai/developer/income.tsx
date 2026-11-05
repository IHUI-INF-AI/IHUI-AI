// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/model-income/ModelIncomeScreen.tsx

import { useTt, useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import { FocusInput } from '@/components/FocusField'
import { useState, useCallback } from 'react'
import { rnRadius, taroSpacing } from '@ihui/design-tokens'
import { rpx } from '@/utils/rpx'
import Taro, { useDidShow } from '@tarojs/taro'
import { getBuyInfo, getBuyList, getDeveloperWithdrawalList, post } from '@/api'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import { getUserInfo } from '@/utils/auth'
import ThemeRoot from '@/components/ThemeRoot'
import { useTheme } from '@/rn-compat/theme'
import './income.css'
import LineIcon from '@/components/LineIcon'
import { onToast } from '@/host/on-toast'
import {
  ModelIncomeScreen as SharedModelIncomeScreen,
  type ModelIncomeItem,
  type ModelIncomeTab,
} from '@ihui/rn-app/features/model-income/ModelIncomeScreen'

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
   * 分成比例列,无任何接口可按流水补 rate ⇒ 共享屏的 rateLabel 一支在本端
   * 是死分支,已撤(宁可门报缺 1 键,不留假绿)。订单行退用流水 id 渲染(①可达)。
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

export default function DeveloperIncome() {
  const tt = useTt()
  const { t } = useI18n()
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
  const [showPopup, setShowPopup] = useState(false)
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const getUuid = useCallback(() => getUserInfo()?.uuid || '', [])

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
  // setLoading(true) 一并挪进门后:落定时同步执行,序列与原来逐字相同;
  // 未落定期间不去翻加载态(该枚 loading 初值本就是 true,等待期仍显示既有"加载中"文案)。
  // loadCashList(GET /api/developer/withdrawals,同组 requireAuth)由点击"提现明细"触发,
  // 不属挂载抢跑,原样不动。
  // 共享屏的 ErrorState + 重试(modelIncome.retry):两路取数任一失败即挂错误条,重试原样重跑
  // 首屏那一组请求 —— 门控语义不变(仍由 useAuthReadyGate 准入,setLoading 仍在门后)。
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

  const accumulated =
    buyInfo?.AccumulatedIncome ?? buyInfo?.accumulatedIncome ?? buyInfo?.total ?? 0
  const available =
    buyInfo?.WithdrawableAmount ?? buyInfo?.withdrawableAmount ?? buyInfo?.available ?? 0
  const withdrawn = buyInfo?.WithdrawnAmount ?? buyInfo?.withdrawnAmount ?? buyInfo?.withdrawn ?? 0
  const todayAccount = buyInfo?.todayAccount ?? buyInfo?.todayIncome ?? 0
  const pendingSettlement = buyInfo?.PendingSettlement ?? buyInfo?.pendingSettlement ?? 0

  const onChangeSettlement = (st: string) => {
    setSettlement(st)
    fetchIncomeList(1, st, false)
  }

  const onSwitchToDetail = () => {
    setTitle('detail')
    if (!cashLoaded) loadCashList()
  }

  const backToIncome = () => {
    setTitle('income')
  }

  const openIncomePopup = () => {
    setShowIncomePopup(true)
  }

  const closeIncomePopup = () => {
    if (!submitting) setShowIncomePopup(false)
  }

  const onIncomeMethodConfirm = () => {
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

  const cashTime = (item: CashItem) => item.time || item.createdAt || ''
  const cashStatusText = (item: CashItem) => {
    const s = String(item.statusText || item.status || '').toLowerCase()
    if (['success', 'completed', '2', 'paid', 'finished'].includes(s))
      return tt('developer.income.settled', '已结算')
    return tt('developer.income.processing', '处理中')
  }

  const hasMore = incomeList.length < total
  const activeTab: ModelIncomeTab =
    settlement === '1' ? 'pending' : settlement === '2' ? 'settled' : 'all'
  const onChangeTab = (tab: ModelIncomeTab) => {
    onChangeSettlement(tab === 'pending' ? '1' : tab === 'settled' ? '2' : '')
  }
  /**
   * 数据层 → 共享屏条目:
   * - orderId 退用接口流水 id(订单号未出网,见 GET /developer/income 契约);
   * - status 用本次请求的 settlement 过滤结果(接口无状态列);
   * - 平台无 userNickname/orderAmount/rate,以 title 作名称、金额只给 commissionAmount,
   *   缺省字段交给共享屏可选渲染,不补 0、不造假。
   */
  const sharedItems: ModelIncomeItem[] = incomeList.map((item, idx) => {
    const flowId = typeof item.id === 'string' || typeof item.id === 'number' ? String(item.id) : ''
    const rawAmount = item.amount ?? item.money
    return {
      id: flowId || String(idx),
      orderId: flowId,
      status: String(item.settlement ?? item.settleStatus ?? item.status ?? ''),
      createdAt: displayTime(item),
      userNickname: displayTitle(item),
      commissionAmount: rawAmount === undefined ? undefined : Number(rawAmount),
    }
  })

  return (
    <ThemeRoot className="min-h-screen bg-background">
      {title === 'income' ? (
        <>
          <SharedModelIncomeScreen
            t={t}
            items={sharedItems}
            summary={{
              totalCommission: accumulated,
              availableCommission: available,
              withdrawnCommission: withdrawn,
              pendingCommission: pendingSettlement,
              day: todayAccount,
            }}
            loading={loading}
            refreshing={false}
            error={error ? tt('common.failed', '加载失败') : ''}
            activeTab={activeTab}
            onSelectTab={onChangeTab}
            onRefresh={reload}
            showWithdrawModal={showIncomePopup}
            onOpenWithdraw={openIncomePopup}
            onCloseWithdraw={closeIncomePopup}
            onConfirmWithdraw={onIncomeMethodConfirm}
            withdrawDisabled={available <= 0}
            loadingMore={loadingMore}
            hasMore={hasMore}
            onLoadMore={() => {
              if (!loadingMore && incomeList.length < total) {
                void fetchIncomeList(page + 1, settlement, true)
              }
            }}
            onBack={() => void Taro.navigateBack()}
            onRetry={reload}
            colorScheme={resolvedTheme}
          />
          {loading || error ? null : (
            <>
              {/* 缺段:服务费提示行(共享屏无此渲染槽;RN 侧无对应文案/数据,按约束留页内) */}
              <View className="income-fee-tip">
                <Text>{tt('developer.income.feeTip', '平台限时不收取任何服务费')}</Text>
              </View>
              {/* 缺段:提现明细入口(RN 数据链只取 overview/commission/dayMonth,无法供提现记录) */}
              <View
                className="mx-[20rpx] mt-[16rpx] px-[20rpx] py-[16rpx] rounded-lg bg-[var(--color-muted)] flex items-center justify-between"
                onClick={onSwitchToDetail}
                hoverClass="opacity-60"
              >
                <Text className="income-stat-label">
                  {tt('developer.income.cashDetail', '提现明细')}
                </Text>
                <LineIcon name="chevron-right" size={24} color="var(--color-foreground)" />
              </View>
            </>
          )}
        </>
      ) : (
        <View className="income-page">
          <View className="income-header">
            <Text className="income-title">{tt('developer.income.titleDetail', '提现明细')}</Text>
          </View>
          <View className="cash-list">
            {/* back-label-exempt: 面板内视图回退(提现明细→收入概览),非页面级返回键 until 2026-12-31 */}
            <View
              onClick={backToIncome}
              hoverClass="opacity-60"
              style={{ marginBottom: 'var(--spacing-sm)' }}
            >
              <Text className="income-item-time">{tt('common.back', '返回')}</Text>
            </View>
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
              <Text className="income-empty">
                {tt('developer.income.cashEmpty', '暂无提现明细')}
              </Text>
            )}
          </View>
        </View>
      )}

      {showPopup ? (
        <View className="income-popup-mask" onClick={closePopup}>
          <View
            className="income-popup"
            style={{ alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
            hoverClass="opacity-60"
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
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
