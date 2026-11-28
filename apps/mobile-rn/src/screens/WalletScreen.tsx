// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// i18n-content-exempt-file: 多语言常量数据定义(label/title/description等选项值,内容体系定为中文单语,产品决策2026-11-15) until 2027-05-31

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, getBalance, getMarginFlows, type MarginFlowItem } from '@ihui/api-client'
import {
  WalletScreen as SharedWalletScreen,
  type WalletBalance,
  type WalletOverview,
} from '@ihui/rn-app'
import { useAuth } from '../context/AuthContext'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** 资金流水分页大小(与 web /wallet PAGE_SIZE 一致) */
const FLOWS_PAGE_SIZE = 20

/**
 * 对齐说明:Uniapp 历史项目无独立"钱包/余额"页(资金能力分散在
 * pages/tools/token_value.vue 我的智汇值 / pagesA/top-up/index.vue 充值 / withdrawal 提现),
 * 按钮文案对齐 Uniapp:recharge=充值(top-up 标题) / withdraw=提现(withdrawal 标题)。
 * mobile-rn/shared zh-CN 暂无 wallet.* key(translate 缺 key 返回 key 本身),
 * key 就绪后此覆盖可删。
 */
const UNIAPP_TEXT: Record<string, string> = {
  'wallet.title': '我的钱包',
  'wallet.balance': '可用余额',
  'wallet.frozen': '冻结金额',
  'wallet.totalRecharge': '累计充值',
  'wallet.totalWithdraw': '累计提现',
  'wallet.recharge': '充值',
  'wallet.withdraw': '提现',
  'wallet.loadFailed': '加载失败',
}

export function WalletScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user, token } = useAuth()
  /**
   * 登录判定单一真相源(2026-11-26 修):此前只用 `user`,当 token 已写入而 user
   * 对象尚未回填时(小程序端 getPhoneNumber 登录即典型),流水区会误判成"未登录",
   * 出现"余额已经显示真值、资金流水却提示登录后查看"的自相矛盾。改为 user 或
   * token 任一存在即视为已登录,与「我的」页 store 口径一致。
   */
  const loggedIn = Boolean(user || token)
  const navigation = useNavigation<NavigationProp>()
  const [balance, setBalance] = useState<WalletBalance | null>(null)
  const [overview, setOverview] = useState<WalletOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 流水独立分区:失败只影响本卡片,不写余额 error。
  const [flows, setFlows] = useState<MarginFlowItem[]>([])
  const [flowsTotal, setFlowsTotal] = useState(0)
  const [flowsLoading, setFlowsLoading] = useState(false)
  const [flowsLoadingMore, setFlowsLoadingMore] = useState(false)
  const [flowsError, setFlowsError] = useState('')
  const flowsPageRef = useRef(1)
  const flowsBusyRef = useRef(false)

  // t 包装:缺失 key 的中文兜底优先,其余回落 i18n
  const uniappT = useCallback(
    (key: string, params?: Record<string, string | number>) => UNIAPP_TEXT[key] ?? t(key, params),
    [t],
  )

  const fmtTime = useCallback(
    (iso: string) => {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return iso
      return new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setOverview(null)
    try {
      const res = await getBalance()
      if (!res.success || !res.data) throw new Error(res.error)
      // 余额单位是「分」(userMargins.tokenQuantity,与 web /api/finance/margin/balance 同源;
      // web 钱包页按 value/100 渲染),壳内投影 /100,避免共享屏 toFixed(2) 放大 100 倍。
      const d = res.data
      // null 安全:后端缺值时保留 null ⇒ 共享屏显示 — 占位符;
      // 不被 /100 换算强转成 0,避免静默击穿「余额为 null 显示 —」既有特性。
      setBalance({
        balance: Number.isFinite(d.balance) ? d.balance / 100 : null,
        frozenBalance: Number.isFinite(d.frozenBalance) ? d.frozenBalance / 100 : null,
        totalRecharge: Number.isFinite(d.totalRecharge) ? d.totalRecharge / 100 : null,
        totalWithdraw: Number.isFinite(d.totalWithdraw) ? d.totalWithdraw / 100 : null,
      } as WalletBalance)

      // 统一账户总览是增益卡片：单独拉取，失败不拖垮余额主卡。
      const overviewRes = await fetchApi<{
        commissionTotalCents: number
        withdrawableCents: number
        withdrawalPendingCents: number
        withdrawnCents: number
      }>('/api/wallet/overview').catch(() => null)
      if (overviewRes?.success && overviewRes.data) setOverview(overviewRes.data)
    } catch {
      setError(uniappT('wallet.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [uniappT])

  /**
   * 资金流水(独立卡片;金额由共享屏按分→元渲染,行内 balanceAfter 独立展示,
   * 不做任何与 /api/wallet 余额的相加/比对)。
   * 未登录不发请求;append 模式按 total 边界守卫,防重复请求。
   */
  const loadFlows = useCallback(
    async (mode: 'initial' | 'more') => {
      if (!loggedIn) return
      if (flowsBusyRef.current) return
      flowsBusyRef.current = true
      const targetPage = mode === 'more' ? flowsPageRef.current + 1 : 1
      if (mode === 'more') setFlowsLoadingMore(true)
      else setFlowsLoading(true)
      setFlowsError('')
      try {
        const res = await getMarginFlows({ page: targetPage, limit: FLOWS_PAGE_SIZE })
        if (!res.success) throw new Error(res.error)
        const items = res.data?.items ?? []
        setFlows((prev) => (mode === 'more' ? [...prev, ...items] : items))
        setFlowsTotal(res.data?.total ?? 0)
        flowsPageRef.current = targetPage
      } catch {
        if (mode === 'initial') {
          setFlows([])
          setFlowsTotal(0)
          flowsPageRef.current = 1
        }
        setFlowsError(uniappT('wallet.flowsLoadFailed'))
      } finally {
        flowsBusyRef.current = false
        setFlowsLoading(false)
        setFlowsLoadingMore(false)
      }
    },
    [loggedIn, uniappT],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!loggedIn) {
      // 登录门:未登录不发起流水请求,仅由共享屏渲染占位 + 登录入口
      setFlows([])
      setFlowsTotal(0)
      setFlowsError('')
      setFlowsLoading(false)
      setFlowsLoadingMore(false)
      flowsPageRef.current = 1
      return
    }
    void loadFlows('initial')
  }, [loggedIn, loadFlows])

  const flowsState = loggedIn
    ? {
        items: flows.map((item) => ({
          id: item.id,
          opType: item.opType,
          quantity: item.quantity,
          balanceAfter: item.balanceAfter,
          remark: item.remark,
          createdAtText: fmtTime(item.createdAt),
        })),
        total: flowsTotal,
        loading: flowsLoading,
        loadingMore: flowsLoadingMore,
        error: flowsError,
      }
    : { items: [], total: 0, loginRequired: true }

  return (
    <SharedWalletScreen
      t={uniappT}
      balance={balance}
      overview={overview}
      loading={loading}
      error={error}
      onRefresh={() => void load()}
      onAction={(action) => {
        if (action === 'withdraw') navigation.navigate('Withdraw')
        else if (action === 'income') navigation.navigate('Income')
        else navigation.navigate('Recharge')
      }}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
      flows={flowsState}
      onRetryFlows={() => void loadFlows('initial')}
      onLoadMoreFlows={() => {
        if (!loggedIn || flowsBusyRef.current || flows.length >= flowsTotal) return
        void loadFlows('more')
      }}
      onLogin={() => navigation.navigate('Login')}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
