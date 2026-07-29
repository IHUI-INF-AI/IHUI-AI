import { View, Text, Input } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow, useReachBottom, navigateBack, showToast } from '@tarojs/taro'
import { getBuyInfo, getBuyList, getDeveloperWithdrawalList, post } from '@/api'
import { getUserInfo } from '@/utils/auth'
import { useTt } from '@/i18n'
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

  const [title, setTitle] = useState<'income' | 'detail'>('income')
  const [settlement, setSettlement] = useState('')
  const [buyInfo, setBuyInfo] = useState<BuyInfo | null>(null)
  const [loading, setLoading] = useState(true)
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

  const loadBuyInfo = useCallback(async () => {
    try {
      const res = (await getBuyInfo({ uuid: getUuid() })) as BuyInfo
      setBuyInfo(res)
    } catch {
      // ignore
    }
  }, [getUuid])

  const fetchIncomeList = useCallback(
    async (p: number, st: string, append: boolean) => {
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
      } catch {
        // ignore
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

  useDidShow(() => {
    setLoading(true)
    Promise.all([loadBuyInfo(), fetchIncomeList(1, '', false)]).finally(() =>
      setLoading(false),
    )
  })

  useReachBottom(() => {
    if (title === 'income' && !loadingMore && incomeList.length < total) {
      fetchIncomeList(page + 1, settlement, true)
    }
  })

  const accumulated =
    buyInfo?.AccumulatedIncome ?? buyInfo?.accumulatedIncome ?? buyInfo?.total ?? 0
  const available =
    buyInfo?.WithdrawableAmount ?? buyInfo?.withdrawableAmount ?? buyInfo?.available ?? 0
  const withdrawn =
    buyInfo?.WithdrawnAmount ?? buyInfo?.withdrawnAmount ?? buyInfo?.withdrawn ?? 0
  const todayAccount = buyInfo?.todayAccount ?? buyInfo?.todayIncome ?? 0
  const pendingSettlement =
    buyInfo?.PendingSettlement ?? buyInfo?.pendingSettlement ?? 0

  const onChangeSettlement = (st: string) => {
    setSettlement(st)
    fetchIncomeList(1, st, false)
  }

  const onSwitchToDetail = () => {
    setTitle('detail')
    if (!cashLoaded) loadCashList()
  }

  const onBack = () => {
    if (title === 'detail') {
      setTitle('income')
    } else {
      navigateBack({ delta: 1 }).catch(() => {})
    }
  }

  const openIncomePopup = () => {
    if (available <= 0) {
      showToast({
        title: tt('developer.income.noAvailable', '暂无可提现金额'),
        icon: 'none',
      })
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
      showToast({
        title: tt('developer.income.selectMethod', '请选择提现方式'),
        icon: 'none',
      })
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
      showToast({
        title: tt('developer.income.invalidAmount', '请输入有效金额'),
        icon: 'none',
      })
      return
    }
    if (num > available) {
      showToast({
        title: tt('developer.income.exceedAvailable', '提现金额超出可提现额度'),
        icon: 'none',
      })
      return
    }
    setSubmitting(true)
    try {
      await post('/developer/withdrawals', { amount: num })
      showToast({
        title: tt('developer.income.withdrawSubmitted', '提现申请已提交'),
        icon: 'success',
      })
      setShowPopup(false)
      await Promise.all([loadBuyInfo(), fetchIncomeList(1, settlement, false)])
    } catch {
      showToast({
        title: tt('developer.income.withdrawFailed', '提现失败,请稍后重试'),
        icon: 'none',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const settleText = (item: IncomeItem) => {
    const s = String(item.settlement ?? item.settleStatus ?? item.status ?? '')
    if (s === '2') return tt('developer.income.settled', '已结算')
    if (s === '1') return tt('developer.income.pending', '待结算')
    return ''
  }
  const settleClass = (item: IncomeItem) => {
    const s = String(item.settlement ?? item.settleStatus ?? item.status ?? '')
    if (s === '2') return 'income-item-badge settled'
    if (s === '1') return 'income-item-badge pending'
    return 'income-item-badge'
  }
  const displayTime = (item: IncomeItem) =>
    item.time || item.createTime || item.createdAt || ''
  const displayAmount = (item: IncomeItem) => Number(item.amount ?? item.money ?? 0)
  const displayTitle = (item: IncomeItem) =>
    item.title || item.name || tt('developer.income.titleIncome', '智能体收入')

  const cashTime = (item: CashItem) => item.time || item.createdAt || ''
  const cashStatusText = (item: CashItem) => {
    const s = String(item.statusText || item.status || '').toLowerCase()
    if (['success', 'completed', '2', 'paid', 'finished'].includes(s))
      return tt('developer.income.settled', '已结算')
    return tt('developer.income.processing', '处理中')
  }

  const headerTitle =
    title === 'detail'
      ? tt('developer.income.titleDetail', '提现明细')
      : tt('developer.income.titleIncome', '智能体收入')

  const hasMore = incomeList.length < total
  const tabs = [
    { id: '', name: tt('developer.income.tabAll', '全部') },
    { id: '1', name: tt('developer.income.tabPending', '待结算') },
    { id: '2', name: tt('developer.income.tabSettled', '已结算') },
  ]

  return (
    <View className="income-page">
      <View className="income-header">
        <Text className="income-back" onClick={onBack}>‹</Text>
        <Text className="income-title">{headerTitle}</Text>
      </View>

      {title === 'income' ? (
        <View>
          <View className="income-card-wrap">
            <View className="income-card">
              <View className="income-card-top">
                <Text className="income-acc-label">
                  {tt('developer.income.accumulatedYuan', '累积收入')}
                </Text>
                <Text className="income-acc-value">{loading ? '--' : accumulated}</Text>
                <Text className="income-acc-unit">{tt('developer.income.yuan', '元')}</Text>
                <Text
                  className="income-withdraw-btn"
                  onClick={openIncomePopup}
                >
                  {tt('developer.income.withdrawPopup', '提现')}
                </Text>
              </View>
              <View className="income-stats-row">
                <View className="income-stat-item">
                  <Text className="income-stat-label">{tt('developer.income.withdrawableYuan', '可提现金额(元)')}</Text>
                  <Text className="income-stat-value">{loading ? '--' : available}</Text>
                </View>
                <View className="income-stat-item">
                  <Text className="income-stat-label">{tt('developer.income.withdrawnAmountYuan', '已提现金额(元)')}</Text>
                  <Text className="income-stat-value">{loading ? '--' : withdrawn}</Text>
                </View>
                <View className="income-stat-item" onClick={onSwitchToDetail}>
                  <Text className="income-stat-label">{tt('developer.income.cashDetail', '提现明细')}</Text>
                  <Text className="income-stat-value">›</Text>
                </View>
              </View>
              <View className="income-card-bottom">
                <View className="income-stat-item">
                  <Text className="income-stat-label">{tt('developer.income.todayIncome', '今日收入')}</Text>
                  <Text className="income-stat-value">{loading ? '--' : todayAccount}</Text>
                </View>
                <View className="income-stat-item">
                  <Text className="income-stat-label">{tt('developer.income.pendingSettlement', '待结算金额')}</Text>
                  <Text className="income-stat-value">{loading ? '--' : pendingSettlement}</Text>
                </View>
              </View>
            </View>
          </View>

          <View className="income-fee-tip">
            <Text className="income-fee-icon">¥</Text>
            <Text>{tt('developer.income.feeTip', '平台限时不收取任何服务费')}</Text>
          </View>

          <View className="income-tabs">
            {tabs.map((tab) => (
              <View
                key={tab.id || 'all'}
                className={`income-tab${settlement === tab.id ? ' active' : ''}`}
                onClick={() => onChangeSettlement(tab.id)}
              >
                <Text>{tab.name}</Text>
              </View>
            ))}
          </View>

          <View className="income-list">
            {loading ? (
              <Text className="income-empty">{tt('common.loading', '加载中…')}</Text>
            ) : incomeList.length ? (
              incomeList.map((item, idx) => (
                <View key={item.id ?? idx} className="income-list-item">
                  <View>
                    <Text className="income-item-title">{displayTitle(item)}</Text>
                    <Text className="income-item-time">{displayTime(item)}</Text>
                  </View>
                  <View>
                    <Text className="income-item-amount">+¥{displayAmount(item)}</Text>
                    {settleText(item) ? (
                      <Text className={settleClass(item)}>{settleText(item)}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text className="income-empty">{tt('developer.income.empty', '暂无收入记录')}</Text>
            )}
            {incomeList.length > 0 && !hasMore ? (
              <Text className="income-empty">{tt('developer.income.noMore', '没有更多了')}</Text>
            ) : null}
            {loadingMore ? (
              <Text className="income-empty">{tt('common.loading', '加载中…')}</Text>
            ) : null}
          </View>
        </View>
      ) : (
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
      )}

      {showIncomePopup ? (
        <View className="income-popup-mask" onClick={closeIncomePopup}>
          <View
            className="income-popup"
            onClick={(e) => e.stopPropagation()}
          >
            <View style={{ display: 'flex', alignItems: 'center', marginBottom: '12rpx' }}>
              <Text style={{ width: '44rpx', height: '44rpx', lineHeight: '44rpx', textAlign: 'center', background: '#7b61ff', color: '#fff', borderRadius: '10rpx', fontSize: '24rpx', marginRight: '16rpx' }}>¥</Text>
              <Text className="income-popup-title">
                {tt('developer.income.selectMethod', '请选择提现方式')}
              </Text>
            </View>
            <Text className="income-popup-sub" style={{ marginBottom: '28rpx' }}>
              {tt('developer.income.moreMethod', '更多提现方式可使用官方APP')}
            </Text>
            <View
              className="income-popup-sub"
              style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '20rpx', background: incomeType === 'wechat' ? '#f3eeff' : 'var(--color-background)', borderRadius: '12rpx', marginBottom: '28rpx', boxSizing: 'border-box' }}
              onClick={() => setIncomeType((prev) => (prev === 'wechat' ? '' : 'wechat'))}
            >
              <Text style={{ width: '48rpx', height: '48rpx', lineHeight: '48rpx', textAlign: 'center', background: 'var(--color-wechat-green)', color: '#fff', borderRadius: '10rpx', fontSize: '24rpx', marginRight: '16rpx' }}>微</Text>
              <Text style={{ flex: 1, fontSize: '28rpx', color: 'var(--color-foreground)' }}>
                {tt('developer.income.wechat', '微信')}
              </Text>
              <Text style={{ width: '36rpx', textAlign: 'center', color: incomeType === 'wechat' ? 'var(--color-wechat-green)' : 'var(--color-muted-foreground)', fontSize: '32rpx' }}>
                {incomeType === 'wechat' ? '✓' : ''}
              </Text>
            </View>
            <View style={{ display: 'flex', width: '100%', gap: '20rpx' }}>
              <View style={{ flex: 1, textAlign: 'center', padding: '20rpx 0', borderRadius: '16rpx', background: 'var(--color-background)' }} onClick={closeIncomePopup}>
                <Text style={{ fontSize: '28rpx', color: 'var(--color-muted-foreground)' }}>
                  {tt('common.cancel', '取消')}
                </Text>
              </View>
              <View style={{ flex: 1, textAlign: 'center', padding: '20rpx 0', borderRadius: '16rpx', background: 'var(--color-accent)' }} onClick={onIncomeMethodConfirm}>
                <Text style={{ fontSize: '28rpx', color: 'var(--color-accent-foreground)', fontWeight: 600 }}>
                  {tt('developer.income.withdrawPopup', '提现')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {showPopup ? (
        <View className="income-popup-mask" onClick={closePopup}>
          <View className="income-popup" style={{ alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <Text style={{ fontSize: '32rpx', fontWeight: 600, color: 'var(--color-foreground)', marginBottom: '24rpx' }}>
              {tt('developer.income.withdrawPopup', '提现')}
            </Text>
            <Text style={{ fontSize: '24rpx', color: 'var(--color-muted-foreground)', marginBottom: '24rpx' }}>
              {tt('developer.income.withdrawAvailable', '可提现金额 ¥')}{available}
            </Text>
            <View style={{ display: 'flex', alignItems: 'center', width: '100%', background: 'var(--color-background)', borderRadius: '16rpx', padding: '16rpx 20rpx', boxSizing: 'border-box', marginBottom: '16rpx' }}>
              <Text style={{ fontSize: '32rpx', fontWeight: 600, color: 'var(--color-foreground)', marginRight: '12rpx' }}>¥</Text>
              <Input
                style={{ flex: 1, fontSize: '32rpx', color: 'var(--color-foreground)' }}
                type="digit"
                placeholder={tt('developer.income.withdrawPlaceholder', '请输入提现金额')}
                value={amount}
                onInput={(e) => setAmount(e.detail.value)}
              />
            </View>
            <View style={{ alignSelf: 'flex-end', marginBottom: '32rpx' }} onClick={() => setAmount(String(available))}>
              <Text style={{ fontSize: '24rpx', color: 'var(--color-accent)' }}>
                {tt('developer.income.withdrawAll', '全部提现')}
              </Text>
            </View>
            <View style={{ display: 'flex', width: '100%', gap: '20rpx' }}>
              <View style={{ flex: 1, textAlign: 'center', padding: '20rpx 0', borderRadius: '16rpx', background: 'var(--color-background)' }} onClick={closePopup}>
                <Text style={{ fontSize: '28rpx', color: 'var(--color-muted-foreground)' }}>
                  {tt('common.cancel', '取消')}
                </Text>
              </View>
              <View style={{ flex: 1, textAlign: 'center', padding: '20rpx 0', borderRadius: '16rpx', background: 'var(--color-accent)' }} onClick={confirmWithdraw}>
                <Text style={{ fontSize: '28rpx', color: 'var(--color-accent-foreground)', fontWeight: 600 }}>
                  {submitting
                    ? tt('common.loading', '加载中…')
                    : tt('common.confirm', '确认')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  )
}
