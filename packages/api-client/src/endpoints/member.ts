/**
 * Member / VIP 会员相关跨端共享类型
 *
 * 从 apps/miniapp-taro/src/api/index.ts 下沉,供 web/miniapp-taro/mobile-rn 等端复用。
 * 包含:
 * - MemberInfo:会员信息(GET /member/info)
 * - VipPayInfo:VIP 支付参数(POST /vip/order 响应内的 payInfo)
 * - VipOrderResult:VIP 升级订单结果(POST /vip/order)
 *
 * 注:与 vip.ts 的 MembershipInfo 不同 — MembershipInfo 是后端 /vip/my 返回的当前会员状态,
 * VipPayInfo/VipOrderResult 是下单支付流程的类型。两者语义互补,不重复。
 */

export interface MemberInfo {
  level: string
  integral: number
  growth: number
  coupons: number
}

/** VIP 支付参数(微信 JSAPI / Native / H5 支付统一定义) */
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

/** VIP 升级订单结果 */
export interface VipOrderResult {
  orderId: string
  orderNo: string
  amount: number
  vipLevelId: string
  quantity: number
  payInfo: VipPayInfo
}
