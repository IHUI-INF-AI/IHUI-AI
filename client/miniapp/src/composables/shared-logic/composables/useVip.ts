import { ref, computed } from 'vue'
import { isUniApp } from '../utils/index'
import { request } from '../api/index'
import { useUser } from './useUser'

export interface VipPlan {
  id: string
  name: string
  price: number
  originalPrice: number
  duration: number
  durationUnit: 'day' | 'month' | 'year'
  features: string[]
}

export interface VipPrivilege {
  id: string
  name: string
  description: string
  icon: string
}

const vipPlans = ref<VipPlan[]>([])
const vipPrivileges = ref<VipPrivilege[]>([])

export function useVip() {
  const { userInfo, isLoggedIn } = useUser()

  const isVip = computed(() => {
    if (!userInfo.value) return false
    if (userInfo.value.vipLevel > 0) {
      const expire = new Date(userInfo.value.vipExpireTime).getTime()
      return expire > Date.now()
    }
    return false
  })

  const vipLevel = computed(() => userInfo.value?.vipLevel || 0)

  async function fetchVipPlans() {
    const res = await request({ url: '/api/vip/plans', method: 'GET' })
    vipPlans.value = res.data
    return res.data
  }

  async function fetchVipPrivileges() {
    const res = await request({ url: '/api/vip/privileges', method: 'GET' })
    vipPrivileges.value = res.data
    return res.data
  }

  async function createOrder(planId: string) {
    const res = await request({ url: '/api/vip/order/create', method: 'POST', data: { planId } })
    return res.data
  }

  async function checkOrderStatus(orderId: string) {
    const res = await request({ url: `/api/vip/order/status/${orderId}`, method: 'GET' })
    return res.data
  }

  async function purchaseVip(planId: string, payMethod: 'wechat' | 'alipay' = 'wechat') {
    const order = await createOrder(planId)
    if (isUniApp()) {
      // #ifdef MP-WEIXIN
      const payParams = order.payParams
      await new Promise<void>((resolve, reject) => {
        void uni.requestPayment({
          provider: 'wxpay',
          ...payParams,
          success: () => resolve(),
          fail: (err: unknown) => reject(err),
        })
      })
      // #endif
    } else {
      // Web端跳转支付页面或弹出支付弹窗
      return { orderId: order.orderId, payUrl: order.payUrl }
    }
    const result = await checkOrderStatus(order.orderId)
    return result
  }

  return {
    vipPlans,
    vipPrivileges,
    isVip,
    vipLevel,
    fetchVipPlans,
    fetchVipPrivileges,
    createOrder,
    checkOrderStatus,
    purchaseVip,
  }
}
