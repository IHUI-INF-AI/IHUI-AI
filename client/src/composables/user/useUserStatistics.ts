import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import type { UserInfoData } from '@/api/user/user'
import { getUserStatistics, type UserStatistics } from '@/api/statistics/statistics'
import { getIncomeOverview, getSettlementList, type AgentSettlement } from '@/api/agent/agent/agent-settlement'
import { getWithdrawalList, createWithdrawal, type AgentWithdrawal } from '@/api/agent/agent/agent-withdrawal'
import { getUserTokenBalance, getUserBilling } from '@/api/agent/agent/agents'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { logger } from '@/utils/logger'
import { formatTime } from '@/shared'
import { useDebounceFn } from '@vueuse/core'
import { formatNumber } from '@/utils/format'
import { useStatusFormatter } from './useStatusFormatter'

/**
 * 账单记录接口
 */
export interface BillingRecord {
  id: string
  amount: number
  type: string
  status: string
  createdAt: string
  agentName?: string
  billingCount?: number
  [key: string]: any
}

/**
 * 用户数据统计相关功能的 Composable
 * 提供使用情况、消费、收益、结算、提现、Token 余额和账单记录等功能
 *
 * @returns {Object} 返回统计数据相关的状态和方法
 * @returns {Reactive<UserStatistics>} returns.statistics - 统计数据
 * @returns {Ref<boolean>} returns.statisticsLoading - 统计数据加载状态
 * @returns {Ref<string>} returns.timeRange - 时间范围（today/week/month）
 * @returns {Reactive<Object>} returns.incomeOverview - 收益概览
 * @returns {Ref<AgentSettlement[]>} returns.settlementList - 结算记录列表
 * @returns {Ref<AgentWithdrawal[]>} returns.withdrawalList - 提现记录列表
 * @returns {Ref<number>} returns.tokenBalance - Token 余额
 * @returns {Ref<BillingRecord[]>} returns.billingList - 账单记录列表
 * @returns {Function} returns.loadStatistics - 加载统计数据
 * @returns {Function} returns.loadIncomeOverview - 加载收益概览
 * @returns {Function} returns.loadSettlementList - 加载结算记录
 * @returns {Function} returns.loadWithdrawalList - 加载提现记录
 * @returns {Function} returns.loadTokenBalance - 加载 Token 余额
 * @returns {Function} returns.loadBilling - 加载账单记录
 * @returns {Function} returns.handleCreateWithdrawal - 创建提现申请
 */
export function useUserStatistics() {
  const { t } = useI18n()
  const authStore = useAuthStore()
  const { handleResult: handleOperationResult, showError: showErrorMsg } = useOperationFeedback()

  // 统计数据
  const statistics = reactive<UserStatistics>({
    usage: {
      totalChatSessions: 0,
      totalMessages: 0,
      totalTokensUsed: 0,
      totalToolsUsed: 0,
      todayChatSessions: 0,
      todayMessages: 0,
      todayTokensUsed: 0,
      weekChatSessions: 0,
      weekMessages: 0,
      weekTokensUsed: 0,
      monthChatSessions: 0,
      monthMessages: 0,
      monthTokensUsed: 0,
    },
    consumption: {
      totalCost: 0,
      todayCost: 0,
      weekCost: 0,
      monthCost: 0,
      balance: 0,
      totalRecharge: 0,
      totalWithdraw: 0,
    },
    activity: {
      loginDays: 0,
      consecutiveLoginDays: 0,
      lastLoginTime: '',
      activeHours: [],
      favoriteTools: [],
      favoriteAgents: [],
    },
    trends: {
      daily: [],
      weekly: [],
      monthly: [],
    },
  })
  const statisticsLoading = ref(false)
  const timeRange = ref<'today' | 'week' | 'month'>('today')

  // 收益统计
  const incomeOverview = reactive({
    todayAccount: 0,
    PendingSettlement: 0,
    WithdrawableAmount: 0,
    WithdrawnAmount: 0,
    AccumulatedIncome: 0,
  })
  const incomeLoading = ref(false)

  // 结算记录
  const settlementList = ref<AgentSettlement[]>([])
  const settlementLoading = ref(false)
  const settlementSearch = ref('')
  const settlementPagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0,
  })

  // 提现记录
  const withdrawalList = ref<AgentWithdrawal[]>([])
  const withdrawalLoading = ref(false)
  const withdrawalTimeRange = ref('2') // 默认1个月内
  const withdrawalPagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0,
  })
  const showWithdrawalDialog = ref(false)
  const withdrawalForm = reactive({
    amount: 0,
    type: 2, // 默认支付宝
    open_id: '',
  })
  const withdrawalSubmitting = ref(false)

  // Token余额
  const tokenBalance = reactive({
    balance: 0,
    total_earned: 0,
    total_used: 0,
  })
  const tokenBalanceLoading = ref(false)

  // 账单记录
  const billingList = ref<BillingRecord[]>([])
  const billingLoading = ref(false)
  const billingTimeRange = ref('m') // 默认最近一月
  const billingPagination = reactive({
    page: 1,
    pageSize: 20,
    total: 0,
  })

  // 加载统计数据
  const loadStatistics = async (): Promise<void> => {
    statisticsLoading.value = true
    try {
      const response = await getUserStatistics({
        timeRange: timeRange.value,
      })
      if (response.code === 200 || response.success) {
        Object.assign(statistics, response.data as UserStatistics)
        // 更新余额
        if (response.data?.consumption?.balance !== undefined) {
          // 类型断言：authStore 包含 updateBalance 方法
          const store = authStore as ReturnType<typeof useAuthStore> & {
            updateBalance: (newBalance: number) => void
          }
          store.updateBalance(response.data.consumption.balance)
        }
      }
      // 同时加载收益统计、结算记录、提现记录、Token余额和账单
      const user = authStore.user as UserInfoData | null
      if (user?.uuid) {
        await Promise.all([
          loadIncomeOverview(),
          loadSettlements(),
          loadWithdrawals(),
          loadTokenBalance(),
          loadBilling(),
        ])
      }
    } catch (_error) {
      // 静默失败
    } finally {
      statisticsLoading.value = false
    }
  }

  // 加载收益统计概览
  const loadIncomeOverview = async (): Promise<void> => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    incomeLoading.value = true
    try {
      const response = await getIncomeOverview(user.uuid)
      if (response.code === 200 || response.success) {
        Object.assign(incomeOverview, response.data || {})
      }
    } catch (error) {
      logger.error('Failed to load earnings statistics:', error)
    } finally {
      incomeLoading.value = false
    }
  }

  // 加载结算记录列表（使用 VueUse 的 useDebounceFn）
  const loadSettlements = useDebounceFn(async () => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    settlementLoading.value = true
    try {
      const response = await getSettlementList({
        page: settlementPagination.page,
        pageSize: settlementPagination.pageSize,
        uuid: user.uuid,
        agent_name: settlementSearch.value || undefined,
      })
      if (response.code === 200 || response.success) {
        settlementList.value = response.data?.list || []
        settlementPagination.total = response.data?.pagination?.total || 0
      }
    } catch (error) {
      logger.error('Failed to load settlement records:', error)
    } finally {
      settlementLoading.value = false
    }
  }, 300)

  // 加载提现记录列表
  const loadWithdrawals = async (): Promise<void> => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    withdrawalLoading.value = true
    try {
      const response = await getWithdrawalList({
        user_id: user.uuid,
        type: withdrawalTimeRange.value,
        page: withdrawalPagination.page,
        page_size: withdrawalPagination.pageSize,
      })
      if (response.code === 200 || response.success) {
        withdrawalList.value = response.data?.list || []
        withdrawalPagination.total = response.data?.pagination?.total || 0
      }
    } catch (error) {
      logger.error('Failed to load withdrawal records:', error)
    } finally {
      withdrawalLoading.value = false
    }
  }

  // 提交提现申请
  const handleSubmitWithdrawal = async (): Promise<void> => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    if (!withdrawalForm.amount || withdrawalForm.amount <= 0) {
      showErrorMsg(t('user.statistics.withdrawal.errors.invalidAmount'))
      return
    }
    if (!withdrawalForm.open_id) {
      showErrorMsg(t('user.statistics.withdrawal.errors.invalidAccount'))
      return
    }
    if (withdrawalForm.amount > (incomeOverview.WithdrawableAmount || 0)) {
      showErrorMsg(t('user.statistics.withdrawal.errors.amountExceedsBalance'))
      return
    }

    withdrawalSubmitting.value = true
    try {
      // 获取未提现的结算记录ID
      const unwithdrawnSettlements = settlementList.value.filter(
        (s: AgentSettlement) => s.settlement === '1' && s.withdrawal === '0'
      )
      const orderIds = unwithdrawnSettlements.map((s: AgentSettlement) => s.id).join(',')

      const user = authStore.user as UserInfoData
      await handleOperationResult(
        createWithdrawal({
          user_id: user.uuid,
          amount: withdrawalForm.amount,
          type: withdrawalForm.type,
          open_id: withdrawalForm.open_id,
          order_ids: orderIds,
        }),
        {
          successMessage: t('user.statistics.withdrawal.success.submitSuccess'),
          onSuccess: () => {
            showWithdrawalDialog.value = false
            withdrawalForm.amount = 0
            withdrawalForm.open_id = ''
            // 刷新数据
            void Promise.all([loadIncomeOverview(), loadSettlements(), loadWithdrawals()])
          },
        }
      )
    } finally {
      withdrawalSubmitting.value = false
    }
  }

  // 使用公共状态格式化 composable
  const { getStatusText, getStatusType, formatTimestamp } = useStatusFormatter()

  // 提现状态映射
  const withdrawalStatusMap: Record<string, string> = {
    '0': t('user.statistics.withdrawal.status.pendingReview'),
    '1': t('user.statistics.withdrawal.status.inReview'),
    '2': t('user.statistics.withdrawal.status.approved'),
    '3': t('user.statistics.withdrawal.status.withdrawn'),
    '4': t('user.statistics.withdrawal.status.rejected'),
  }

  const withdrawalStatusTypeMap: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    '0': 'warning',
    '1': 'info',
    '2': 'success',
    '3': 'success',
    '4': 'danger',
  }

  // 获取提现状态文本
  const getWithdrawalStatusText = (status: number): string => {
    return (
      getStatusText(status, withdrawalStatusMap) || t('user.statistics.withdrawal.status.unknown')
    )
  }

  // 获取提现状态标签类型
  const getWithdrawalStatusType = (status: number): string => {
    return getStatusType(status, withdrawalStatusTypeMap)
  }

  // 加载Token余额
  const loadTokenBalance = async (): Promise<void> => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    tokenBalanceLoading.value = true
    try {
      const response = await getUserTokenBalance(user.uuid)
      if (response.code === 200 || response.success) {
        Object.assign(tokenBalance, response.data || {})
      }
    } catch (error) {
      logger.error('Failed to load token balance:', error)
    } finally {
      tokenBalanceLoading.value = false
    }
  }

  // 加载账单记录
  const loadBilling = async (): Promise<void> => {
    const user = authStore.user as UserInfoData | null
    if (!user?.uuid) return
    billingLoading.value = true
    try {
      const response = await getUserBilling({
        uuid: user.uuid,
        type: billingTimeRange.value as 'w' | 'm' | 'y' | 'a',
        page: billingPagination.page,
        page_size: billingPagination.pageSize,
      })
      if (response.code === 200 || response.success) {
        // Map API response to BillingRecord format
        const apiList = response.data?.list || []
        billingList.value = (
          apiList as Array<{
            agentName: string
            create_at: string
            token: number
            record_root_id: string
            billing_count: number
          }>
        ).map((item, index) => ({
          id: item.record_root_id || `billing-${index}`,
          amount: item.token || 0,
          type: 'token',
          status: 'completed',
          createdAt: item.create_at || new Date().toISOString(),
          agentName: item.agentName,
          billingCount: item.billing_count,
        })) as BillingRecord[]
        billingPagination.total = response.data?.pagination?.total || 0
      }
    } catch (error) {
      logger.error('Failed to load billing records:', error)
    } finally {
      billingLoading.value = false
    }
  }

  // 获取时间维度值
  const getTimeRangeValue = (type: 'sessions' | 'messages' | 'tokens'): number => {
    const usage = statistics.usage
    if (timeRange.value === 'today') {
      if (type === 'sessions') return usage.todayChatSessions
      if (type === 'messages') return usage.todayMessages
      return usage.todayTokensUsed
    } else if (timeRange.value === 'week') {
      if (type === 'sessions') return usage.weekChatSessions
      if (type === 'messages') return usage.weekMessages
      return usage.weekTokensUsed
    } else {
      if (type === 'sessions') return usage.monthChatSessions
      if (type === 'messages') return usage.monthMessages
      return usage.monthTokensUsed
    }
  }

  // 结算记录分页处理
  const handleSettlementPageChange = (page: number): void => {
    settlementPagination.page = page
    void loadSettlements()
  }

  const handleSettlementPageSizeChange = (pageSize: number): void => {
    settlementPagination.pageSize = pageSize
    settlementPagination.page = 1
    void loadSettlements()
  }

  // 提现记录分页处理
  const handleWithdrawalPageChange = (page: number): void => {
    withdrawalPagination.page = page
    void loadWithdrawals()
  }

  const handleWithdrawalPageSizeChange = (pageSize: number): void => {
    withdrawalPagination.pageSize = pageSize
    withdrawalPagination.page = 1
    void loadWithdrawals()
  }

  // 账单记录分页处理
  const handleBillingPageChange = (page: number): void => {
    billingPagination.page = page
    void loadBilling()
  }

  const handleBillingPageSizeChange = (pageSize: number): void => {
    billingPagination.pageSize = pageSize
    billingPagination.page = 1
    void loadBilling()
  }

  return {
    statistics,
    statisticsLoading,
    timeRange,
    incomeOverview,
    incomeLoading,
    settlementList,
    settlementLoading,
    settlementSearch,
    settlementPagination,
    withdrawalList,
    withdrawalLoading,
    withdrawalTimeRange,
    withdrawalPagination,
    showWithdrawalDialog,
    withdrawalForm,
    withdrawalSubmitting,
    tokenBalance,
    tokenBalanceLoading,
    billingList,
    billingLoading,
    billingTimeRange,
    billingPagination,
    loadStatistics,
    loadIncomeOverview,
    loadSettlements,
    loadWithdrawals,
    handleSubmitWithdrawal,
    getWithdrawalStatusText,
    getWithdrawalStatusType,
    formatTimestamp, // 从 useStatusFormatter 获取
    loadTokenBalance,
    loadBilling,
    getTimeRangeValue,
    formatNumber,
    handleSettlementPageChange,
    handleSettlementPageSizeChange,
    handleWithdrawalPageChange,
    handleWithdrawalPageSizeChange,
    handleBillingPageChange,
    handleBillingPageSizeChange,
    formatTime,
  }
}
