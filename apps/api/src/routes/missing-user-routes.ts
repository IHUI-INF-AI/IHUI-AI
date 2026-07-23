/**
 * 用户端路由补建 barrel(原 missing-user-routes.ts 拆分到 user/ 子目录)。
 *
 * 拆分原则:
 * - 按业务域拆分到 user/ 子目录,每文件单一业务域。
 * - 所有路由保留原始 method + path(API URL 0 改动)。
 * - authenticate preHandler 由 user/index.ts 统一挂载,所有子路由继承。
 * - 响应格式 { code, message, data } 不变。
 *
 * server.ts 仍通过本文件 import,注册时带 prefix: '/api'。
 */
export { missingUserRoutes } from './user/index.js'
