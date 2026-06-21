import type { RouteRecordRaw } from 'vue-router'
import { registerPlatformRoutes } from '../utils/routeMerger'

// 支付宝小程序平台特定路由配置
const alipayRoutes: Array<RouteRecordRaw> = []

registerPlatformRoutes('alipay', alipayRoutes)

export default alipayRoutes
