'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export interface PaymentOrder {
  orderId: string
  payUrl: string
  payMethod: string
  amount: number
}

export interface UseVipPaymentReturn {
  paying: boolean
  payMethod: string
  setPayMethod: (method: string) => void
  createOrder: (levelId: string) => Promise<PaymentOrder | null>
  queryOrder: (orderId: string) => Promise<boolean>
}

/** VIP 支付 Hook，创建支付订单并轮询支付状态 */
export function useVipPayment(): UseVipPaymentReturn {
  const toast = useToast()
  const [paying, setPaying] = React.useState(false)
  const [payMethod, setPayMethod] = React.useState('wechat')

  const createOrder = React.useCallback(
    async (levelId: string): Promise<PaymentOrder | null> => {
      setPaying(true)
      try {
        const res = await fetchApi<PaymentOrder>('/vip/order', {
          method: 'POST',
          body: JSON.stringify({ levelId, payMethod }),
        })
        if (res.success) {
          return res.data
        }
        toast.error('创建订单失败', res.error)
        return null
      } finally {
        setPaying(false)
      }
    },
    [payMethod, toast],
  )

  const queryOrder = React.useCallback(
    async (orderId: string): Promise<boolean> => {
      const res = await fetchApi<{ status: string }>(`/vip/order/${orderId}`)
      if (res.success && res.data.status === 'paid') {
        toast.success('支付成功')
        return true
      }
      return false
    },
    [toast],
  )

  return { paying, payMethod, setPayMethod, createOrder, queryOrder }
}
