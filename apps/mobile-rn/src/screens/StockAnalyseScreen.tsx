// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getStockAnalyseHistory,
  getStockAnalyseTokenBalance,
  postStockAnalyse,
  type StockAnalyseResult,
} from '@ihui/api-client'
import {
  StockAnalyseScreen as SharedStockAnalyseScreen,
  type StockAnalyseResultView,
} from '@ihui/rn-app'
import { clampPercent } from '@ihui/shared/utils/clamp-percent'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/** web 同值（apps/web/app/(main)/stock/page.tsx:66 HISTORY_PAGE_SIZE = 10） */
const HISTORY_PAGE_SIZE = 10
/** web 同值（apps/web/app/(main)/stock/page.tsx:67 QUESTION_MAX_LENGTH = 2000） */
const QUESTION_MAX_LENGTH = 2000

const NS = 'stockAnalysePage'

/**
 * RN 端「AI 股票分析」薄壳 —— 承载 web /stock。渲染全部委托共享屏，本文件只管:
 * 取数 GET /api/stock/token-balance（apps/api/src/routes/stock.ts:29-33）
 * + POST /api/stock/analyse（stock.ts:36-50）
 * + GET /api/stock/history（stock.ts:53-63）、
 * 已用百分比（clampPercent 唯一出口）、时间 Intl 格式化（与 web 同参 年月日时分）、
 * 登录门（web useAuthGate 同口径，未登录不发注定 401 的请求）。
 *
 * 口径差（如实登记，详见 manifest ledger）：
 *  - web 时间格式化用 Intl.DateTimeFormat(undefined, ...)（浏览器默认 locale），
 *    RN 用当前 App locale（thin shell 注入），参数档（年/月/日/时/分）一致。
 *  - 后端未配置股票 AI 服务时 analyse 返回 mock 结果
 *    （apps/api/src/services/stock-service.ts:240-250），
 *    RN 保留 web 同款 mock 警告分支，不假装修成真实分析。
 *  - 余额不足时后端返 402（apps/api/src/routes/stock.ts:47），RN 区分
 *    「余额不足」与「一般错误」两种文案（与 web 同口径）。
 */
export function StockAnalyseScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [balance, setBalance] = useState({ total: 0, used: 0, remaining: 0 })
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  const [symbol, setSymbol] = useState('')
  const [question, setQuestion] = useState('')
  const [analysing, setAnalysing] = useState(false)
  const [result, setResult] = useState<StockAnalyseResultView | null>(null)
  const [analyseError, setAnalyseError] = useState<string | null>(null)
  const [analyseErrorKind, setAnalyseErrorKind] = useState<'balance' | 'general'>('general')

  const [historyRows, setHistoryRows] = useState<StockAnalyseResultView[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [detail, setDetail] = useState<StockAnalyseResultView | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const fmtDate = useCallback(
    (value: string): string => {
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? value : dateFmt.format(d)
    },
    [dateFmt],
  )

  const toView = useCallback(
    (item: StockAnalyseResult): StockAnalyseResultView => ({
      conversationId: item.conversationId,
      symbol: item.symbol,
      analysis: item.analysis,
      tokensUsed: item.tokensUsed,
      timeText: fmtDate(item.createdAt),
      errorText: item.error ?? '',
    }),
    [fmtDate],
  )

  const loadBalance = useCallback(async () => {
    if (!user) return
    setBalanceLoading(true)
    try {
      const res = await getStockAnalyseTokenBalance()
      if (!res.success || !res.data) {
        setBalanceError(t('common.loadFailed'))
        return
      }
      setBalanceError(null)
      setBalance({
        total: res.data.total ?? 0,
        used: res.data.used ?? 0,
        remaining: res.data.remaining ?? 0,
      })
    } catch {
      setBalanceError(t('common.loadFailed'))
    } finally {
      setBalanceLoading(false)
    }
  }, [user, t])

  const loadHistory = useCallback(async () => {
    if (!user) return
    setHistoryLoading(true)
    try {
      const res = await getStockAnalyseHistory({ page: 1, pageSize: HISTORY_PAGE_SIZE })
      if (!res.success || !res.data) {
        setHistoryError(t('common.loadFailed'))
        return
      }
      setHistoryError(null)
      setHistoryRows((res.data.list ?? []).map(toView))
    } catch {
      setHistoryError(t('common.loadFailed'))
    } finally {
      setHistoryLoading(false)
    }
  }, [user, toView, t])

  useEffect(() => {
    void loadBalance()
    void loadHistory()
  }, [loadBalance, loadHistory])

  const canAnalyse = symbol.trim().length > 0 && question.trim().length > 0 && !analysing

  const handleAnalyse = useCallback(async () => {
    if (!canAnalyse || !user) return
    setAnalysing(true)
    setAnalyseError(null)
    setResult(null)
    try {
      const res = await postStockAnalyse({
        symbol: symbol.trim(),
        question: question.trim(),
      })
      if (!res.success || !res.data) {
        setAnalyseErrorKind(res.status === 402 ? 'balance' : 'general')
        setAnalyseError(t('common.loadFailed'))
        return
      }
      setResult(toView(res.data))
      // web 同口径:分析成功后刷新余额与历史
      void loadBalance()
      void loadHistory()
    } catch {
      setAnalyseErrorKind('general')
      setAnalyseError(t('common.loadFailed'))
    } finally {
      setAnalysing(false)
    }
  }, [canAnalyse, user, toView, loadBalance, loadHistory, symbol, question, t])

  const usedPercent = useMemo(
    () => (balance.total > 0 ? clampPercent((balance.used / balance.total) * 100) : 0),
    [balance.total, balance.used],
  )

  const analyseErrorTitle =
    analyseErrorKind === 'balance' ? t(`${NS}.needBalance`) : t(`${NS}.error`)

  return (
    <SharedStockAnalyseScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      balance={balance}
      usedPercent={usedPercent}
      balanceLoading={balanceLoading}
      balanceError={balanceError}
      symbolValue={symbol}
      onSymbolChange={setSymbol}
      questionValue={question}
      onQuestionChange={setQuestion}
      questionMaxLength={QUESTION_MAX_LENGTH}
      analysing={analysing}
      canAnalyse={canAnalyse}
      onAnalyse={() => void handleAnalyse()}
      analyseError={analyseError}
      analyseErrorTitle={analyseErrorTitle}
      result={result}
      mockWarningText={t(`${NS}.mockWarning`)}
      historyLoading={historyLoading}
      historyError={historyError}
      historyRows={historyRows}
      onSelectHistory={(conversationId: string) => {
        const hit = historyRows.find((row) => row.conversationId === conversationId)
        if (hit) setDetail(hit)
      }}
      detailVisible={detail !== null}
      detail={detail}
      onCloseDetail={() => setDetail(null)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
