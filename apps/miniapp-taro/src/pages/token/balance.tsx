import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import * as api from '@/api'
import { useI18n } from '@/i18n'
import { getUserInfo } from '@/utils/auth'
import './balance.css'

interface ZhRecord {
  id?: string
  agentName?: string
  title?: string
  create_at?: string
  createdAt?: string
  time?: string
  token?: number | string
  amount?: number
}

interface RecordsResponse {
  list?: ZhRecord[]
  total?: number
}

interface BalanceInfo {
  amount?: number
  balance?: number
  token?: number
}

type BarType = 'w' | 'm' | 'y' | 'a'
type ActiveBtn = 'agent' | 'orders'

const PAGE_SIZE = 20

const BAR_LIST: Array<{ value: BarType; key: string; fb: string }> = [
  { value: 'w', key: 'token.balance.bar7d', fb: '7天' },
  { value: 'm', key: 'token.balance.bar1m', fb: '一个月' },
  { value: 'y', key: 'token.balance.bar1y', fb: '近一年' },
  { value: 'a', key: 'token.balance.barAll', fb: '全部' },
]

function getUuid(): string {
  const a = Taro.getStorageSync('data')
  if (a && typeof a === 'object' && (a as { uuid?: string }).uuid)
    return (a as { uuid: string }).uuid
  const b = Taro.getStorageSync('userInfo')
  if (b && typeof b === 'object' && (b as { uuid?: string }).uuid)
    return (b as { uuid: string }).uuid
  return getUserInfo()?.uuid || ''
}

export default function TokenBalance() {
  const { t } = useI18n()
  const [balance, setBalance] = useState<BalanceInfo | null>(null)
  const [zhList, setZhList] = useState<ZhRecord[]>([])
  const [activeButton, setActiveButton] = useState<ActiveBtn>('agent')
  const [type, setType] = useState<BarType>('w')
  const [loading, setLoading] = useState(false)

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const stateRef = useRef<{ type: BarType; orderType: 0 | 1 }>({ type: 'w', orderType: 0 })

  const tt = useCallback(
    (k: string, fb: string) => (t(k) === k ? fb : t(k)),
    [t],
  )

  const loadBalance = useCallback(async () => {
    try {
      const uuid = getUuid()
      const res = (await (api.getTokenBalance as unknown as (
        p?: { uuid?: string },
      ) => Promise<unknown>)(uuid ? { uuid } : undefined)) as BalanceInfo
      setBalance(res)
    } catch {
      // ignore
    }
  }, [])

  const getData = useCallback(async (reset = false) => {
    if (loadingRef.current) return
    const { type: curType, orderType: curOt } = stateRef.current
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setZhList([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const uuid = getUuid()
      const res = (await (api.getTokenRecords as unknown as (p: {
        type: string
        orderType: number
        page: number
        uuid?: string
      }) => Promise<unknown>)({
        type: curType,
        orderType: curOt,
        page: pageRef.current,
        ...(uuid ? { uuid } : {}),
      })) as RecordsResponse
      const items = res?.list || []
      setZhList((prev) => (reset ? items : [...prev, ...items]))
      const tot = res?.total ?? 0
      hasMoreRef.current = pageRef.current * PAGE_SIZE < tot
      pageRef.current++
    } catch {
      // ignore
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const syncState = (next: { type?: BarType; orderType?: 0 | 1 }) => {
    stateRef.current = { ...stateRef.current, ...next }
  }

  const takeAgent = () => {
    if (activeButton === 'agent') return
    setActiveButton('agent')
    setType('w')
    syncState({ type: 'w', orderType: 0 })
    getData(true)
  }

  const takeOrders = () => {
    if (activeButton === 'orders') return
    setActiveButton('orders')
    setType('w')
    syncState({ type: 'w', orderType: 1 })
    getData(true)
  }

  const onTabChange = (val: BarType) => {
    if (type === val) return
    setType(val)
    syncState({ type: val })
    getData(true)
  }

  useDidShow(() => {
    Taro.setNavigationBarTitle({ title: tt('token.balance.title', '我的智汇值') })
    loadBalance()
    getData(true)
  })

  useReachBottom(() => {
    getData(false)
  })

  const balanceValue = balance?.amount ?? balance?.balance ?? balance?.token ?? 0
  const showEmpty = !loading && zhList.length === 0

  return (
    <View className="token-page">
      <View className="balance-card">
        <Text className="balance-label">{tt('token.balance.title', '我的智汇值')}</Text>
        <Text className="balance-value">{balance === null ? '--' : balanceValue}</Text>
      </View>

      <View className="func-bar">
        <View
          className={`func-btn${activeButton === 'agent' ? ' active' : ''}`}
          onClick={takeAgent}
        >
          <Text>{tt('token.balance.agentConsume', '智能体消耗')}</Text>
        </View>
        <View
          className={`func-btn${activeButton === 'orders' ? ' active' : ''}`}
          onClick={takeOrders}
        >
          <Text>{tt('token.balance.ordersConsume', '大模型消耗')}</Text>
        </View>
      </View>

      <View className="tab-bar">
        {BAR_LIST.map((b) => (
          <View
            key={b.value}
            className={`tab-item${type === b.value ? ' active' : ''}`}
            onClick={() => onTabChange(b.value)}
          >
            <Text>{tt(b.key, b.fb)}</Text>
          </View>
        ))}
      </View>

      <View className="records-section">
        {showEmpty ? (
          <Text className="empty-text">
            {tt('token.balance.empty', '暂无智汇值消耗记录')}
          </Text>
        ) : (
          zhList.map((it, idx) => {
            const title =
              it.agentName || it.title || tt('token.balance.agentConsume', '智能体消耗')
            const time = it.create_at || it.createdAt || it.time || ''
            const tokenNum = Number(it.token ?? it.amount ?? 0)
            return (
              <View key={it.id || idx} className="record-item">
                <View className="record-info">
                  <Text className="record-title">{title}</Text>
                  <Text className="record-time">
                    {tt('token.balance.costTime', '花费时间:')}{time}
                  </Text>
                </View>
                <Text className="record-count">
                  {tokenNum > 0 ? `-${tokenNum}` : tokenNum}
                </Text>
              </View>
            )
          })
        )}
        {loading && zhList.length > 0 ? (
          <View className="load-more">
            <Text>{tt('common.loading', '加载中…')}</Text>
          </View>
        ) : null}
        {!loading && zhList.length > 0 && !hasMoreRef.current ? (
          <View className="load-more">
            <Text>{tt('token.balance.noMore', '没有更多了')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
