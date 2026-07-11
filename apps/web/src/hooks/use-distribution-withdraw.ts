'use client'

import * as React from 'react'

import {
  getWithdrawList,
  requestWithdraw,
  type CommissionWithdrawRecord,
} from '@/lib/distribution-api'
import { useToast } from '@/hooks/use-toast'

export interface UseDistributionWithdrawReturn {
  records: CommissionWithdrawRecord[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  submitting: boolean
  fetchRecords: (page?: number) => Promise<void>
  withdraw: (input: { amount: number; account: string; accountType: string }) => Promise<boolean>
}

/** 分销提现 Hook，管理提现记录与提现申请 */
export function useDistributionWithdraw(initialPageSize = 10): UseDistributionWithdrawReturn {
  const toast = useToast()
  const [records, setRecords] = React.useState<CommissionWithdrawRecord[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const fetchRecords = React.useCallback(
    async (p = 1) => {
      setLoading(true)
      try {
        const res = await getWithdrawList({ page: p, pageSize: initialPageSize })
        if (res.success) {
          setRecords(res.data.list)
          setTotal(res.data.total)
          setPage(p)
        }
      } finally {
        setLoading(false)
      }
    },
    [initialPageSize],
  )

  const withdraw = React.useCallback(
    async (input: { amount: number; account: string; accountType: string }): Promise<boolean> => {
      setSubmitting(true)
      try {
        const res = await requestWithdraw(input)
        if (res.success) {
          toast.success('提现申请已提交')
          await fetchRecords(1)
          return true
        }
        toast.error('提现失败', res.error)
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [fetchRecords, toast],
  )

  return {
    records,
    total,
    page,
    pageSize: initialPageSize,
    loading,
    submitting,
    fetchRecords,
    withdraw,
  }
}
