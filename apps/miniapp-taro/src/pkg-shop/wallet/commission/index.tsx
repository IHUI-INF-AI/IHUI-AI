// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像 packages/app/src/features/income/IncomeScreen.tsx
import { useI18n } from '@/i18n'
import { View, Text, Button } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import { useState, useRef, useEffect } from 'react'
import { get } from '@/api'
import { formatDate, formatPrice } from '@/utils/time'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
// P2-F 接线:SectionHeader 切换为 Taro 适配层导出(props 契约与旧实现一致)
import { SectionHeader } from '@/components/adapters'
import ThemeRoot from '@/components/ThemeRoot'
import { IncomeItem, type IncomeRow } from './income-item'
import './index.css'

/** 佣金流水行:GET /distribution/list 返回 commission_flows 原始行(amount 单位「分」) */
interface CommissionFlow {
  id: string
  amount: number
  orderId: string | null
  status: number
  createdAt: string
  remark: string | null
}

/** 提现记录行:GET /distribution/withdraw-list(status 2 = completed,method 为到账渠道) */
interface WithdrawalFlow {
  id: string
  amount: number
  method: string
  status: number
  createdAt: string
  processedAt: string | null
}

/** 概览:GET /distribution/overview,与共享屏 data 同源(amount 单位「分」) */
interface Overview {
  totalCommission: number
  availableCommission: number
  pendingCommission: number
  withdrawnCommission: number
}

const PAGE_SIZE = 20
const TIME_FORMAT = 'YYYY-MM-DD HH:mm'
const EMPTY_OVERVIEW: Overview = {
  totalCommission: 0,
  availableCommission: 0,
  pendingCommission: 0,
  withdrawnCommission: 0,
}

/** 今日收益(共享屏数据源为日汇总;本端按流水当日聚合,与原实现同口径) */
function sumToday(flows: CommissionFlow[]): number {
  const today = new Date().toDateString()
  let sum = 0
  for (const flow of flows) {
    const d = new Date(flow.createdAt)
    if (!isNaN(d.getTime()) && d.toDateString() === today && flow.amount > 0) sum += flow.amount
  }
  return sum
}

/**
 * 佣金流水 → 卡片行:下单人与卡片标题同源(共享屏 buyer 取的就是 item.title)。
 * 状态复核(2026-10-30 取证):GET /distribution/list 原样返回 commission_flows 行,
 * 而该表 status 在生产端恒为 1(唯一 insert 硬编码 status:1,全仓无 update) ⇒
 * 「status===0 即 cancelled」条件永假,该死分支已撤(income-item.tsx IncomeStatus)。
 */
function toCommissionRow(flow: CommissionFlow): IncomeRow {
  const title = flow.remark || flow.orderId || ''
  return {
    id: flow.id,
    title,
    buyer: title,
    amount: Number(flow.amount) || 0,
    time: formatDate(flow.createdAt, TIME_FORMAT),
    orderId: flow.orderId || '',
    status: 'pending',
  }
}

/** 提现记录 → 「已结算」行(共享屏 mapWithdrawRecord 同口径:已结算 = 已成功提现) */
function toWithdrawRow(flow: WithdrawalFlow, t: (key: string) => string): IncomeRow {
  return {
    id: flow.id,
    title: flow.method === 'bank' ? t('income.withdrawBank') : t('income.withdrawRecord'),
    buyer: '',
    amount: Number(flow.amount) || 0,
    time: formatDate(flow.processedAt || flow.createdAt, TIME_FORMAT),
    orderId: '',
    status: 'settled',
  }
}

export default function CommissionPage() {
  const { t } = useI18n()
  const gate = useAuthReadyGate()
  const [overview, setOverview] = useState<Overview>(EMPTY_OVERVIEW)
  const [todayCommission, setTodayCommission] = useState(0)
  const [rows, setRows] = useState<IncomeRow[]>([])
  const [settledRows, setSettledRows] = useState<IncomeRow[]>([])
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const loadingRef = useRef(false)

  const loadSummary = async () => {
    try {
      setOverview(await get<Overview>('/distribution/overview'))
    } catch {
      // 概览失败不阻塞明细,保持零值(与原实现同口径)
    }
  }

  /**
   * 已结算 = 已成功提现的记录(共享屏 mapWithdrawRecord 同口径:仅 status=2 计入)。
   * 佣金流水表没有「已结算」字段,这一支只能由提现记录补,否则该状态永远不可达。
   */
  const loadSettled = async () => {
    try {
      const res = await get<{ list: WithdrawalFlow[] }>('/distribution/withdraw-list', {
        page: 1,
        pageSize: 50,
      })
      setSettledRows(
        (res.list || []).filter((w) => Number(w.status) === 2).map((w) => toWithdrawRow(w, t)),
      )
    } catch {
      setSettledRows([])
    }
  }

  const load = async (reset = false) => {
    if (loadingRef.current) return
    if (reset) {
      pageRef.current = 1
      hasMoreRef.current = true
      setRows([])
    }
    if (!hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      // 原实现打的 /distribution/commission 后端从未注册(现读 routes/distribution.ts 只有
      // /distribution/list),404 被 catch 吞成空列表 ⇒ 用户以为没有收益记录。改打真路由。
      const res = await get<{ list: CommissionFlow[]; total: number }>('/distribution/list', {
        page: pageRef.current,
        pageSize: PAGE_SIZE,
      })
      const flows = res.list || []
      const items = flows.map(toCommissionRow)
      setRows((prev) => (reset ? items : [...prev, ...items]))
      setTodayCommission((prev) => (reset ? sumToday(flows) : prev + sumToday(flows)))
      hasMoreRef.current = pageRef.current * PAGE_SIZE < res.total
      pageRef.current++
    } catch {
      // 明细失败保留现有列表(与原实现同口径)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    // G-933 冷启动门控:概览/提现记录(GET /distribution/*,distribution 组级 authenticate)需鉴权 ⇒ 挡
    const cancel = gate.waitUntilReady(() => {
      void loadSummary()
      void loadSettled()
    })
    void load(true)
    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useReachBottom(() => {
    void load()
  })

  const goWithdraw = () => {
    Taro.navigateTo({ url: '/pkg-shop/wallet/withdrawal/index' })
  }

  const allRows = rows.concat(settledRows)

  return (
    <ThemeRoot>
      <View className="wc-page">
        <SectionHeader title={t('income.title')} showMore={false} className="mb-[16rpx]" />
        <View className="wc-stats">
          <View className="wc-stat-item">
            <Text className="wc-stat-label">{t('income.today')}</Text>
            <Text className="wc-stat-value">¥{formatPrice(todayCommission)}</Text>
          </View>
          <View className="wc-stat-item">
            <Text className="wc-stat-label">{t('income.total')}</Text>
            <Text className="wc-stat-value">¥{formatPrice(overview.totalCommission)}</Text>
          </View>
          <View className="wc-stat-item">
            <Text className="wc-stat-label">{t('income.withdrawable')}</Text>
            <Text className="wc-stat-value">¥{formatPrice(overview.availableCommission)}</Text>
          </View>
        </View>
        <View className="wc-stats mt-[16rpx]">
          <View className="wc-stat-item">
            <Text className="wc-stat-label">{t('income.pending')}</Text>
            <Text className="wc-stat-value">¥{formatPrice(overview.pendingCommission)}</Text>
          </View>
          <View className="wc-stat-item">
            <Text className="wc-stat-label">{t('income.withdrawn')}</Text>
            <Text className="wc-stat-value">¥{formatPrice(overview.withdrawnCommission)}</Text>
          </View>
        </View>
        <Button className="wc-withdraw-btn" onClick={goWithdraw}>
          {t('income.withdraw')}
        </Button>

        <View className="wc-list-section">
          <Text className="wc-list-title">{t('income.sectionTitle')}</Text>
          {allRows.length > 0 ? (
            <View className="wc-list">
              {allRows.map((row) => (
                <IncomeItem key={row.id} row={row} />
              ))}
            </View>
          ) : null}
          {allRows.length === 0 && !loading ? (
            <Text className="wc-empty">{t('income.empty')}</Text>
          ) : null}
          {loading ? (
            <Text className="wc-loading">{t('distribution.commission.loading')}</Text>
          ) : null}
        </View>
      </View>
    </ThemeRoot>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
