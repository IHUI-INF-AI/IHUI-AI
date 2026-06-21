import type { RouteRecordRaw } from 'vue-router'
import { registerPlatformRoutes } from '../utils/routeMerger'

// H5平台特定路由配置
const h5Routes: Array<RouteRecordRaw> = []

registerPlatformRoutes('h5', h5Routes)

export default h5Routes
