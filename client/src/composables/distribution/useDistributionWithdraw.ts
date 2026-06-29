/**
 * Distribution 提现管理 Composable
 *
 * 负责提现表单管理、提现记录加载和提现申请处理
 *
 * @packageDocumentation
 */

import { ref, computed } from 'vue'
import { logger } from '@/utils/logger'
import { useI18n } from 'vue-i18n'
import { useOperationFeedback } from '@/composables/useOperationFeedback'
import { getWithdrawList, applyWithdraw } from '@/api/commission'
import type { FormInstance } from 'element-plus'
import type { WithdrawRecord } from '@/types/user'
import { usePagination } from '@/composables/user/usePagination'

/**
 * 提现表单数据接口
 */
export interface WithdrawFormData {
  amount: string
  method: 'alipay' | 'wechat' | 'bank'
  account: string
  realName: string
  bankName: string
  remark: string
}

/**
 * useDistributionWithdraw 配置选项
 */
export interface UseDistributionWithdrawOptions {
  /** 初始每页数量 */
  initialPageSize?: number
  /** 可用余额（用于验证） */
  availableBalance?: number
  /** 提现成功后回调*/
  onWithdrawSuccess?: () => void
}

/**
 * Distribution 提现管理 Composable
 *
 * @param options - 配置选项
 * @returns 返回提现状态和方法
 */
export function useDistributionWithdraw(options: UseDistributionWithdrawOptions = {}) {
  const { initialPageSize = 20, availableBalance = 0, onWithdrawSuccess } = options
  const { t } = useI18n()
  const { showSuccess, showError: showErrorMsg } = useOperationFeedback()

  // 对话框状态
  const showWithdrawDialog = ref(false)
  const withdrawing = ref(false)

  // 提现表单
  const withdrawForm = ref<WithdrawFormData>({
    amount: '',
    method: 'alipay',
    account: '',
    realName: '',
    bankName: '',
    remark: '',
  })

  const withdrawFormRef = ref<FormInstance | null>(null)

  // 提现记录列表
  const allWithdrawals = ref<WithdrawRecord[]>([])

  // 筛选
  const withdrawStatusFilter = ref('')
  const withdrawDateRange = ref<[string, string] | []>([])

  // 加载状态
  const loadingWithdrawals = ref(false)

  // 分页
  const paginationComposable = usePagination({
    initialPage: 1,
    initialPageSize: initialPageSize,
  })

  /**
   * 提现表单验证规则
   */
  const withdrawRules = computed(() => ({
    amount: [
      {
        required: true,
        message: t('distribution.enterWithdrawAmount'),
        trigger: 'blur',
      },
      {
        validator: (_rule: unknown, value: number, callback: (error?: Error) => void) => {
          if (value < 100) {
            callback(new Error(t('distribution.minWithdrawAmountError')))
          } else if (availableBalance > 0 && value > availableBalance) {
            callback(new Error(t('distribution.amountExceedBalance')))
          } else {
            callback()
          }
        },
        trigger: 'blur',
      },
    ],
    method: [
      {
        required: true,
        message: t('distribution.selectWithdrawMethod'),
        trigger: 'change',
      },
    ],
    account: [
      {
        required: true,
        message: t('distribution.enterAccountInfo'),
        trigger: 'blur',
      },
    ],
    realName: [
      {
        required: true,
        message: t('distribution.enterRealName'),
        trigger: 'blur',
      },
    ],
    bankName: [
      {
        required: true,
        message: t('distribution.enterBankName'),
        trigger: 'blur',
      },
    ],
  }))

  /**
   * 加载提现记录
   */
  const loadWithdrawals = async (): Promise<void> => {
    try {
      loadingWithdrawals.value = true
      const response = await getWithdrawList({
        page: paginationComposable.pagination.page,
        pageSize: paginationComposable.pagination.pageSize,
        status: (withdrawStatusFilter.value || undefined) as
          | 'pending'
          | 'processing'
          | 'completed'
          | 'rejected'
          | undefined,
        startTime: withdrawDateRange.value?.[0] || undefined,
        endTime: withdrawDateRange.value?.[1] || undefined,
      })

      if (response.code === 200 && response.data) {
        allWithdrawals.value = response.data.list || []
        paginationComposable.pagination.total =
          (response.data as { pagination?: { total?: number }; total?: number })?.pagination
            ?.total ||
          (response.data as { total?: number })?.total ||
          0
      }
    } catch (error) {
      logger.error('[DistributionWithdraw] Failed to load withdrawal records:', error)
      showErrorMsg(t('distribution.loadFailed'))
    } finally {
      loadingWithdrawals.value = false
    }
  }

  /**
   * 处理提现申请
   */
  const handleWithdraw = async (): Promise<void> => {
    if (!withdrawFormRef.value) return

    try {
      await withdrawFormRef.value.validate(undefined)
      withdrawing.value = true

      // 构建提现请求数据
      interface WithdrawRequestData {
        amount: number
        type: 'bank' | 'alipay' | 'wechat'
        bankInfo?: {
          bankName: string
          accountName: string
          accountNumber: string
          branchName?: string
        }
        alipayInfo?: {
          account: string
          name: string
        }
        wechatInfo?: {
          account: string
          name: string
        }
      }
      const withdrawData: WithdrawRequestData = {
        amount: parseFloat(withdrawForm.value.amount),
        type: withdrawForm.value.method as 'bank' | 'alipay' | 'wechat',
      }

      // 根据提现方式设置不同的账户信息
      if (withdrawForm.value.method === 'bank') {
        withdrawData.bankInfo = {
          bankName: withdrawForm.value.bankName || '',
          accountName: withdrawForm.value.realName || '',
          accountNumber: withdrawForm.value.account || '',
        }
      } else if (withdrawForm.value.method === 'alipay') {
        withdrawData.alipayInfo = {
          account: withdrawForm.value.account || '',
          name: withdrawForm.value.realName || '',
        }
      } else if (withdrawForm.value.method === 'wechat') {
        withdrawData.wechatInfo = {
          account: withdrawForm.value.account || '',
          name: withdrawForm.value.realName || '',
        }
      }

      const response = await applyWithdraw(withdrawData)

      if (response.code === 200 || response.success) {
        showWithdrawDialog.value = false
        showSuccess(t('distribution.withdrawSubmitted'))

        // 重新加载提现记录
        await loadWithdrawals()

        // 重置表单
        resetForm()

        // 调用成功回调
        if (onWithdrawSuccess) {
          onWithdrawSuccess()
        }
      } else {
        showErrorMsg(response.message || t('distribution.withdrawFailed'))
      }
    } catch (error) {
      logger.error('[DistributionWithdraw] Withdrawal application failed:', error)
      showErrorMsg(t('distribution.withdrawFailed'))
    } finally {
      withdrawing.value = false
    }
  }

  /**
   * 处理提现筛选
   */
  const handleWithdrawFilter = (status: string, dateRange: [string, string] | []): void => {
    withdrawStatusFilter.value = status
    withdrawDateRange.value = dateRange
    paginationComposable.pagination.page = 1 // 重置到第一
  }

  /**
   * 重置表单
   */
  const resetForm = (): void => {
    withdrawForm.value = {
      amount: '',
      method: 'alipay',
      account: '',
      realName: '',
      bankName: '',
      remark: '',
    }
    withdrawFormRef.value?.resetFields()
  }

  /**
   * 打开提现对话框
   */
  const openWithdrawDialog = (): void => {
    showWithdrawDialog.value = true
  }

  /**
   * 关闭提现对话框
   */
  const closeWithdrawDialog = (): void => {
    showWithdrawDialog.value = false
    resetForm()
  }

  // 计算属性：筛选后的提现记录
  const filteredWithdrawals = computed(() => {
    let result = allWithdrawals.value

    if (withdrawStatusFilter.value) {
      result = result.filter(withdrawal => {
        const status = withdrawal.status as string
        return status === withdrawStatusFilter.value
      })
    }

    return result
  })

  // 计算属性：分页后的提现记录
  const paginatedWithdrawals = computed(() => {
    const start =
      (paginationComposable.pagination.page - 1) * paginationComposable.pagination.pageSize
    const end = start + paginationComposable.pagination.pageSize
    return filteredWithdrawals.value.slice(start, end)
  })

  return {
    // 状态
    showWithdrawDialog,
    withdrawing,
    withdrawForm,
    withdrawFormRef,
    withdrawRules,
    allWithdrawals,
    withdrawStatusFilter,
    withdrawDateRange,
    loadingWithdrawals,
    pagination: paginationComposable,

    // 计算属性
    filteredWithdrawals,
    paginatedWithdrawals,

    // 方法
    loadWithdrawals,
    handleWithdraw,
    handleWithdrawFilter,
    resetForm,
    openWithdrawDialog,
    closeWithdrawDialog,
  }
}
