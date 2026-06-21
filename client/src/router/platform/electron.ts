import type { RouteRecordRaw } from 'vue-router'
import { registerPlatformRoutes } from '../utils/routeMerger'

// Electron平台特定路由配置
const electronRoutes: Array<RouteRecordRaw> = []

registerPlatformRoutes('electron', electronRoutes)

export default electronRoutes
