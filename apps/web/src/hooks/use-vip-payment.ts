'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export interface PaymentOrder {
  orderId: string
  orderNo: string
  amount: number
  vipLevelId?: string
  quantity?: number
  payUrl?: string
}

export interface UseVipPaymentReturn {
  paying: boolean
  payMethod: string
  setPayMethod: (method: string) => void
  createOrder: (levelId: string) => Promise<PaymentOrder | null>
  queryOrder: (orderNo: string) => Promise<string>
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
          body: JSON.stringify({ vipLevelId: levelId, paymentMethod: payMethod, quantity: 1 }),
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

  const queryOrder = React.useCallback(async (orderNo: string): Promise<string> => {
    const res = await fetchApi<{ order: { status: string } }>(`/payment/orders/${orderNo}`)
    if (res.success) {
      return res.data.order.status
    }
    return 'pending'
  }, [])

  return { paying, payMethod, setPayMethod, createOrder, queryOrder }
}
