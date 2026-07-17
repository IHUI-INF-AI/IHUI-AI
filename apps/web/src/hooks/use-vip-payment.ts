'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

export interface VipPayInfo {
  mock: boolean
  method: 'jsapi' | 'native' | 'h5'
  timeStamp?: string
  nonceStr?: string
  package?: string
  signType?: string
  paySign?: string
  codeUrl?: string
  h5Url?: string
  error?: string
}

export interface CreateOrderResult {
  orderId: string
  orderNo: string
  amount: number
  vipLevelId: string
  quantity: number
  payInfo: VipPayInfo
}

export interface PayInfoResult {
  status: string
  payInfo?: VipPayInfo
}

export interface UseVipPaymentReturn {
  paying: boolean
  payMethod: string
  setPayMethod: (method: string) => void
  createOrder: (levelId: string) => Promise<CreateOrderResult | null>
  queryOrder: (orderNo: string) => Promise<string>
  fetchPayInfo: (orderNo: string) => Promise<PayInfoResult | null>
}

/** VIP 支付 Hook，创建支付订单并轮询支付状态 */
export function useVipPayment(): UseVipPaymentReturn {
  const toast = useToast()
  const [paying, setPaying] = React.useState(false)
  const [payMethod, setPayMethod] = React.useState('wechat_native')

  const createOrder = React.useCallback(
    async (levelId: string): Promise<CreateOrderResult | null> => {
      setPaying(true)
      try {
        const res = await fetchApi<CreateOrderResult>('/vip/order', {
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

  const fetchPayInfo = React.useCallback(
    async (orderNo: string): Promise<PayInfoResult | null> => {
      const res = await fetchApi<PayInfoResult>(`/vip/order/${orderNo}/payinfo`)
      if (res.success) {
        return res.data
      }
      toast.error('获取支付信息失败', res.error)
      return null
    },
    [toast],
  )

  return { paying, payMethod, setPayMethod, createOrder, queryOrder, fetchPayInfo }
}
