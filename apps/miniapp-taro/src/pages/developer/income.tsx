import { View, Text, Input } from '@tarojs/components'
import { useState, useCallback } from 'react'
import { useDidShow, useReachBottom, navigateBack, showToast } from '@tarojs/taro'
import { getBuyInfo, getBuyList, getDeveloperWithdrawalList, post } from '@/api'
import { getUserInfo } from '@/utils/auth'
import { useI18n } from '@/i18n'

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
  const { t } = useI18n()
  const tt = (k: string, fb: string) => (t(k) === k ? fb : t(k))

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
    const base = 'text-[22rpx] px-[14rpx] py-[4rpx] rounded-[8rpx] bg-background text-muted-foreground'
    if (s === '2') return `${base} bg-[#e9f7ef] text-[#34c759]`
    if (s === '1') return `${base} bg-[#fff4e6] text-[#ff9500]`
    return base
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
    <View className="min-h-screen bg-background">
      <View className="relative flex items-center justify-center px-[30rpx] py-[24rpx] bg-card">
        <Text className="absolute left-[20rpx] top-1/2 -translate-y-1/2 text-[44rpx] text-foreground px-[12rpx] leading-none" onClick={onBack}>
          ‹
        </Text>
        <Text className="text-[34rpx] font-semibold text-foreground">{headerTitle}</Text>
      </View>

      {title === 'income' ? (
        <View>
          <View className="mx-[20rpx] my-[20rpx] p-[30rpx] bg-card rounded-[24rpx]">
            <View className="flex items-start justify-between mb-[30rpx]">
              <View className="flex flex-col">
                <Text className="text-[24rpx] text-muted-foreground mb-[12rpx]">
                  {tt('developer.income.accumulatedYuan', '累积收入(元)')}
                </Text>
                <Text className="text-[52rpx] font-bold text-[#7b61ff] leading-[1.1]">
                  {loading ? '--' : accumulated}
                </Text>
              </View>
              <View
                className={`px-[36rpx] py-[14rpx] bg-accent rounded-[12rpx]${available <= 0 ? ' opacity-40' : ''}`}
                onClick={openIncomePopup}
              >
                <Text className="text-accent-foreground text-[26rpx] font-semibold">
                  {tt('developer.income.withdrawPopup', '提现')}
                </Text>
              </View>
            </View>
            <View className="flex mb-[30rpx]">
              <View className="flex-1 text-center">
                <Text className="block text-[22rpx] text-muted-foreground mb-[10rpx]">
                  {tt('developer.income.withdrawableYuan', '可提现金额(元)')}
                </Text>
                <Text className="text-[32rpx] text-foreground font-semibold">
                  {loading ? '--' : available}
                </Text>
              </View>
              <View className="flex-1 text-center">
                <Text className="block text-[22rpx] text-muted-foreground mb-[10rpx]">
                  {tt('developer.income.withdrawnAmountYuan', '已提现金额(元)')}
                </Text>
                <Text className="text-[32rpx] text-foreground font-semibold">
                  {loading ? '--' : withdrawn}
                </Text>
              </View>
              <View className="flex-1 text-center" onClick={onSwitchToDetail}>
                <Text className="block text-[22rpx] text-muted-foreground mb-[10rpx]">
                  {tt('developer.income.cashDetail', '提现明细')}
                </Text>
                <Text className="text-[32rpx] text-foreground font-semibold text-accent text-[40rpx]">›</Text>
              </View>
            </View>
            <View className="flex">
              <View className="flex-1 text-center">
                <Text className="block text-[22rpx] text-muted-foreground mb-[10rpx]">
                  {tt('developer.income.todayIncome', '今日收入')}
                </Text>
                <Text className="text-[32rpx] text-foreground font-semibold">
                  {loading ? '--' : todayAccount}
                </Text>
              </View>
              <View className="flex-1 text-center">
                <Text className="block text-[22rpx] text-muted-foreground mb-[10rpx]">
                  {tt('developer.income.pendingSettlement', '待结算金额')}
                </Text>
                <Text className="text-[32rpx] text-foreground font-semibold">
                  {loading ? '--' : pendingSettlement}
                </Text>
              </View>
            </View>
          </View>

          <View className="flex items-center px-[20rpx] mb-[20rpx]">
            <Text className="w-[32rpx] h-[32rpx] leading-[32rpx] text-center bg-accent text-accent-foreground rounded-[8rpx] text-[22rpx] mr-[12rpx]">¥</Text>
            <Text className="text-[24rpx] text-muted-foreground">
              {tt('developer.income.feeTip', '平台限时不收取任何服务费')}
            </Text>
          </View>

          <View className="flex mx-[20rpx] mb-[20rpx] p-[6rpx] bg-background rounded-[16rpx]">
            {tabs.map((tab) => (
              <View
                key={tab.id || 'all'}
                className={`flex-1 text-center py-[16rpx] rounded-[12rpx] text-muted-foreground text-[26rpx]${settlement === tab.id ? ' bg-card text-foreground font-semibold' : ''}`}
                onClick={() => onChangeSettlement(tab.id)}
              >
                <Text>{tab.name}</Text>
              </View>
            ))}
          </View>

          <View className="px-[20rpx] pb-[40rpx]">
            {loading ? (
              <Text className="block text-center text-muted-foreground py-[80rpx] text-[26rpx]">
                {tt('common.loading', '加载中…')}
              </Text>
            ) : incomeList.length ? (
              incomeList.map((item, idx) => (
                <View key={item.id ?? idx} className="flex items-center justify-between bg-card rounded-[20rpx] p-[24rpx] mb-[16rpx]">
                  <View className="flex-1">
                    <Text className="block text-[28rpx] text-foreground mb-[8rpx]">{displayTitle(item)}</Text>
                    <Text className="text-[24rpx] text-muted-foreground">{displayTime(item)}</Text>
                  </View>
                  <View className="flex flex-col items-end">
                    <Text className="text-[30rpx] text-[#34c759] font-semibold mb-[8rpx]">
                      +¥{displayAmount(item)}
                    </Text>
                    {settleText(item) ? (
                      <Text className={settleClass(item)}>{settleText(item)}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            ) : (
              <Text className="block text-center text-muted-foreground py-[80rpx] text-[26rpx]">
                {tt('developer.income.empty', '暂无收入记录')}
              </Text>
            )}
            {incomeList.length > 0 && !hasMore ? (
              <Text className="block text-center text-muted-foreground py-[20rpx] text-[24rpx]">
                {tt('developer.income.noMore', '没有更多了')}
              </Text>
            ) : null}
            {loadingMore ? (
              <Text className="block text-center text-muted-foreground py-[20rpx] text-[24rpx]">
                {tt('common.loading', '加载中…')}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View className="p-[20rpx]">
          {!cashLoaded ? (
            <Text className="block text-center text-muted-foreground py-[80rpx] text-[26rpx]">
              {tt('common.loading', '加载中…')}
            </Text>
          ) : cashList.length ? (
            cashList.map((item, idx) => (
              <View key={item.id ?? idx} className="flex items-center justify-between bg-card rounded-[20rpx] p-[24rpx] mb-[16rpx]">
                <View className="flex flex-col">
                  <Text className="text-[30rpx] text-foreground font-semibold mb-[8rpx]">
                    -¥{Number(item.amount ?? 0)}
                  </Text>
                  <Text className="text-[24rpx] text-muted-foreground">{cashTime(item)}</Text>
                </View>
                <Text className="text-[24rpx] text-muted-foreground">{cashStatusText(item)}</Text>
              </View>
            ))
          ) : (
            <Text className="block text-center text-muted-foreground py-[80rpx] text-[26rpx]">
              {tt('developer.income.cashEmpty', '暂无提现明细')}
            </Text>
          )}
        </View>
      )}

      {showIncomePopup ? (
        <View className="fixed left-0 top-0 right-0 bottom-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[1000]" onClick={closeIncomePopup}>
          <View
            className="w-[600rpx] bg-card rounded-[24rpx] px-[32rpx] py-[40rpx] flex flex-col items-stretch"
            onClick={(e) => e.stopPropagation()}
          >
            <View className="flex items-center mb-[12rpx]">
              <Text className="w-[44rpx] h-[44rpx] leading-[44rpx] text-center bg-[#7b61ff] text-white rounded-[10rpx] text-[24rpx] mr-[16rpx]">¥</Text>
              <Text className="text-[30rpx] font-semibold text-foreground">
                {tt('developer.income.selectMethod', '请选择提现方式')}
              </Text>
            </View>
            <Text className="text-[22rpx] text-muted-foreground mb-[28rpx]">
              {tt('developer.income.moreMethod', '更多提现方式可使用官方APP')}
            </Text>
            <View
              className={`flex items-center w-full p-[20rpx] bg-background rounded-[12rpx] mb-[28rpx] box-border${incomeType === 'wechat' ? ' bg-[#f3eeff]' : ''}`}
              onClick={() => setIncomeType((prev) => (prev === 'wechat' ? '' : 'wechat'))}
            >
              <View className="w-[48rpx] h-[48rpx] leading-[48rpx] text-center bg-[#07c160] text-white rounded-[10rpx] text-[24rpx] mr-[16rpx]">
                <Text className="text-white">微</Text>
              </View>
              <Text className="flex-1 text-[28rpx] text-foreground">
                {tt('developer.income.wechat', '微信')}
              </Text>
              <Text className={`w-[36rpx] text-center text-muted-foreground text-[28rpx]${incomeType === 'wechat' ? ' text-[#07c160] text-[32rpx]' : ''}`}>
                {incomeType === 'wechat' ? '✓' : ''}
              </Text>
            </View>
            <View className="flex w-full gap-[20rpx]">
              <View className="flex-1 text-center py-[20rpx] rounded-[16rpx] bg-background" onClick={closeIncomePopup}>
                <Text className="text-[28rpx] text-muted-foreground">
                  {tt('common.cancel', '取消')}
                </Text>
              </View>
              <View className="flex-1 text-center py-[20rpx] rounded-[16rpx] bg-accent" onClick={onIncomeMethodConfirm}>
                <Text className="text-[28rpx] text-accent-foreground font-semibold">
                  {tt('developer.income.withdrawPopup', '提现')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {showPopup ? (
        <View className="fixed left-0 top-0 right-0 bottom-0 bg-[rgba(0,0,0,0.5)] flex items-center justify-center z-[1000]" onClick={closePopup}>
          <View className="w-[600rpx] bg-card rounded-[24rpx] px-[32rpx] py-[40rpx] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <Text className="text-[32rpx] font-semibold text-foreground mb-[24rpx]">
              {tt('developer.income.withdrawPopup', '提现')}
            </Text>
            <Text className="text-[24rpx] text-muted-foreground mb-[24rpx]">
              {tt('developer.income.withdrawAvailable', '可提现金额 ¥')}
              {available}
            </Text>
            <View className="flex items-center w-full bg-background rounded-[16rpx] px-[20rpx] py-[16rpx] box-border mb-[16rpx]">
              <Text className="text-[32rpx] text-foreground font-semibold mr-[12rpx]">¥</Text>
              <Input
                className="flex-1 text-[32rpx] text-foreground"
                type="digit"
                placeholder={tt('developer.income.withdrawPlaceholder', '请输入提现金额')}
                value={amount}
                onInput={(e) => setAmount(e.detail.value)}
              />
            </View>
            <View className="self-end mb-[32rpx]" onClick={() => setAmount(String(available))}>
              <Text className="text-[24rpx] text-accent">
                {tt('developer.income.withdrawAll', '全部提现')}
              </Text>
            </View>
            <View className="flex w-full gap-[20rpx]">
              <View className="flex-1 text-center py-[20rpx] rounded-[16rpx] bg-background" onClick={closePopup}>
                <Text className="text-[28rpx] text-muted-foreground">
                  {tt('common.cancel', '取消')}
                </Text>
              </View>
              <View className="flex-1 text-center py-[20rpx] rounded-[16rpx] bg-accent" onClick={confirmWithdraw}>
                <Text className="text-[28rpx] text-accent-foreground font-semibold">
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
