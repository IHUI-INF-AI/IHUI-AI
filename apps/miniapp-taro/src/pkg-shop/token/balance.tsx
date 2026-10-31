// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useI18n } from '@/i18n'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow, useReachBottom } from '@tarojs/taro'
import { useState, useRef, useCallback } from 'react'
import * as api from '@/api'
import { fetchApi } from '@ihui/api-client'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import ThemeRoot from '@/components/ThemeRoot'
import TokenBalanceCard from './token-balance-card'
import TokenPackages from './token-packages'
import TokenRecord, { type ZhRecord } from './token-record'
import TokenFilterBar, {
  type TokenBarType as BarType,
  type TokenActiveBtn as ActiveBtn,
} from './token-filter-bar'
import './balance.css'

interface RecordsResponse {
  list?: ZhRecord[]
  total?: number
}

interface BalanceInfo {
  /** GET /token/balance 仅回这三列(miniapp-compat-routes.ts 的 /token/balance SELECT) */
  balance?: number
  frozenBalance?: number
  updatedAt?: string
}

/** GET /api/user/token-balance 的累计口径:user-extras.ts 走 getTokenFlowTotals(),
 *  按 token_flows.op_type 全量聚合(0,3,4,5,6=累计获得、1=累计消耗),不分页。 */
interface TokenAggregate {
  balance?: number
  totalEarned?: number
  totalUsed?: number
}

const PAGE_SIZE = 20

export default function TokenBalance() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [balance, setBalance] = useState<BalanceInfo | null>(null)
  const [totalCost, setTotalCost] = useState<number | null>(null)
  const [zhList, setZhList] = useState<ZhRecord[]>([])
  const [activeButton, setActiveButton] = useState<ActiveBtn>('agent')
  const [type, setType] = useState<BarType>('w')
  const [loading, setLoading] = useState(false)

  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)
  const stateRef = useRef<{ type: BarType; orderType: 0 | 1 }>({ type: 'w', orderType: 0 })

  const tt = useCallback((k: string, fb: string) => (t(k) === k ? fb : t(k)), [t])

  const loadBalance = useCallback(async () => {
    try {
      // GET /token/balance 的身份取令牌主体(checkAuth),端点无 uuid 入参 ⇒ 不再传被丢弃的参数
      setBalance((await api.getTokenBalance()) as BalanceInfo)
    } catch {
      // ignore
    }
  }, [])

  // 「总消费」必须是全量口径:只认 GET /api/user/token-balance 的 totalUsed(user-extras.ts
  // 走 getTokenFlowTotals(),库侧按 token_flows.op_type=1 sum,不分页)。
  // 取不到就是取不到 ⇒ 置 null 让卡片渲染 '--';严禁拿分页窗口内的合计冒充「总」消费。
  const loadTotalCost = useCallback(async () => {
    try {
      const res = await fetchApi<TokenAggregate>('/api/user/token-balance')
      setTotalCost(res.success ? Number(res.data?.totalUsed ?? 0) : null)
    } catch {
      setTotalCost(null)
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
      // 旧形态把整个 {type,orderType,page,uuid} 对象当 getTokenRecords(page:number) 的实参传,
      // 于是 query 里出现 page=[object Object] ⇒ 后端 pageQuerySchema.coerce 出 NaN ⇒ 整条流水恒失败,
      // 页面永远显示「暂无数据」。这里直连在册端点 GET /token/records,按它真正解析的键发参。
      // type / orderType 后端当前不参读(只按令牌主体过滤 userId),保留传参以登记口径,不冒充已过滤。
      const res = await api.get<RecordsResponse>('/token/records', {
        type: curType,
        orderType: curOt,
        page: pageRef.current,
        pageSize: PAGE_SIZE,
      })
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

  // 对齐共享屏 onRecharge 的信息层级:套餐是前端静态配置(与 TokenValueScreen 的 PACKAGES 同值),
  // 小程序端充值只落到统一充值页(在册路由 /pkg-shop/wallet/recharge/index,见 app.config.ts),
  // 端内无「按套餐下单」入参口 —— 后端也没有在册的套餐下单端点,不得伪造选中态。
  const handleRecharge = useCallback(() => {
    Taro.navigateTo({ url: '/pkg-shop/wallet/recharge/index' })
  }, [])

  useDidShow(() => {
    // G-933 冷启动门控:智汇值余额/累计消耗/流水三枚需鉴权请求在判定落定前不发
    gate.waitUntilReady(() => {
      void loadBalance()
      void loadTotalCost()
      void getData(true)
    })
  })

  useReachBottom(() => {
    getData(false)
  })

  // 三枚读数各自独立:没取到就是 null(卡片渲染 '--'),不得用 0 冒充「余额/冻结/总消费都是 0」。
  const showEmpty = !loading && zhList.length === 0

  return (
    <View className="token-page">
      <View className="flex items-center px-[20rpx] pt-[24rpx]">
        <Text className="text-heading font-semibold text-foreground">
          {tt('tokenValue.title', '智汇值')}
        </Text>
      </View>

      <TokenBalanceCard
        tt={tt}
        balance={balance === null ? null : Number(balance.balance ?? 0)}
        frozen={balance === null ? null : Number(balance.frozenBalance ?? 0)}
        totalCost={totalCost}
      />

      <TokenPackages tt={tt} onSelect={handleRecharge} />

      <TokenFilterBar
        tt={tt}
        active={activeButton}
        range={type}
        onPickAgent={takeAgent}
        onPickOrders={takeOrders}
        onPickRange={onTabChange}
      />

      <View className="records-section">
        <Text className="block mb-[24rpx] text-title font-semibold text-foreground">
          {tt('tokenValue.recordsTitle', '交易记录')}
        </Text>
        {showEmpty ? (
          <Text className="empty-text">{tt('tokenValue.empty', '暂无数据')}</Text>
        ) : (
          zhList.map((it, idx) => (
            <ThemeRoot key={it.id || idx}>
              <TokenRecord item={it} tt={tt} />
            </ThemeRoot>
          ))
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
