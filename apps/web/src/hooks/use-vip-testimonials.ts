'use client'

import * as React from 'react'

import { fetchApi } from '@/lib/api'

export interface VipTestimonial {
  id: string
  userId: string
  nickname: string
  avatar: string | null
  level: number
  content: string
  rating: number
  createdAt: string
}

export interface UseVipTestimonialsReturn {
  testimonials: VipTestimonial[]
  loading: boolean
  fetchTestimonials: () => Promise<void>
}

/** VIP 评价 Hook，获取会员用户评价列表 */
export function useVipTestimonials(): UseVipTestimonialsReturn {
  const [testimonials, setTestimonials] = React.useState<VipTestimonial[]>([])
  const [loading, setLoading] = React.useState(false)

  const fetchTestimonials = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi<VipTestimonial[]>('/vip/testimonials')
      if (res.success) setTestimonials(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  return { testimonials, loading, fetchTestimonials }
}
