'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ApiResult } from '@ihui/types'
import {
  signRecurringContract,
  listRecurringContracts,
  cancelRecurringContract,
  getSubscriptionStatus,
  type WechatPayContract,
  type SubscriptionStatus,
  type SignContractResponse,
} from '@ihui/api-client'

async function unwrap<T>(p: Promise<ApiResult<T>>): Promise<T> {
  const r = await p
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function useSubscriptionStatus() {
  return useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: () => unwrap(getSubscriptionStatus()),
    staleTime: 60 * 1000,
  })
}

export function useRecurringContracts() {
  return useQuery({
    queryKey: ['subscription', 'contracts'],
    queryFn: async (): Promise<WechatPayContract[]> => {
      const r = await listRecurringContracts()
      if (!r.success) throw new Error(r.error)
      return r.data.list
    },
    staleTime: 60 * 1000,
  })
}

export function useSignContract() {
  const qc = useQueryClient()
  return useMutation<
    SignContractResponse,
    Error,
    { planId: string; productId?: string; openid?: string }
  >({
    mutationFn: (params) => unwrap(signRecurringContract(params)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

export function useCancelContract() {
  const qc = useQueryClient()
  return useMutation<{ cancelled: boolean }, Error, { id: number; reason?: string }>({
    mutationFn: (params) => unwrap(cancelRecurringContract(params.id, params.reason)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscription'] })
    },
  })
}

export type { WechatPayContract, SubscriptionStatus, SignContractResponse }
