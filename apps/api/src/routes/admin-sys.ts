/**
 * admin-sys barrel(原 admin-sys.ts 拆分到 admin-sys/ 子目录)。
 *
 * 拆分原则:
 * - 按 admin 业务域拆分到 admin-sys/ 子目录(menu/role/notice/job/dept/post/config/dict/operlog 等)。
 * - 所有路由保留原始 method + path(API URL 0 改动)。
 * - requireAdmin preHandler + operlog 审计 onResponse 由 admin-sys/index.ts 统一挂载。
 * - 响应格式 { code, message, data } 不变。
 *
 * server.ts 仍通过本文件 import,注册时带 prefix: '/api/admin'。
 */
export { adminSysRoutes, menuRoutersRoutes } from './admin-sys/index.js'
