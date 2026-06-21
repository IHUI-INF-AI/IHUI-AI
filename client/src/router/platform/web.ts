import type { RouteRecordRaw } from 'vue-router'
import { registerPlatformRoutes } from '../utils/routeMerger'

// Web平台特定路由配置
// 注：/admin 和 /dashboard 已在 modules/admin.ts 中定义，此处不再重复
const webRoutes: Array<RouteRecordRaw> = []

registerPlatformRoutes('web', webRoutes)

export default webRoutes
