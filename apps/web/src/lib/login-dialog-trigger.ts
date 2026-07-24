/**
 * 登录弹窗懒触发统一决策中心(2026-07-24 深度根治)。
 *
 * 设计目的:从机制上杜绝"刷新进项目就弹窗"回归。
 *
 * 历史教训:
 * - a0bc9e5c5 只修了 cookie 分支的 isPublicPath 检查,reauth 分支"保持不变"导致回归
 * - api.ts 的 401 拦截有自己的 loginDialogOpenGuard,LoginRedirectListener 没有,并发触发会弹两次
 * - isPublicPath 白名单只在 LoginRedirectListener 定义,api.ts 401 拦截根本没检查公开路径
 *
 * 根治方案:
 * - 所有触发点(LoginRedirectListener reauth/cookie 分支 + api.ts 401 拦截)统一调用 openLoginDialogOnce
 * - 公开路径白名单只在此处维护一份,新增公开页面只改这里
 * - 模块级 openGuard 跨所有触发点共享,防并发弹窗/StrictMode 双调用
 *
 * 懒触发策略(memory: 登录弹窗懒触发策略):
 * - 公开页面(/ /login /register 等)不主动弹窗
 * - 仅受保护页/用户主动操作(非 GET 401)时弹
 */

import { useLoginDialogStore } from '@/stores/login-dialog'

/**
 * 公开路径白名单:首页 / 登录注册 / 找回密码 / SSO 入口 / 营销页 / 健康检查。
 * 这些路径即使携带 login_redirect cookie 或 reauth=1 参数也不弹窗(避免刷新进项目即弹窗)。
 * 新增公开页面只需在此处添加。
 */
export const PUBLIC_PATHS = new Set<string>([
  '/',
  '/login',
  '/register',
  '/sso/login',
  '/sso/register',
  '/forgot-password',
  '/reset-password',
  '/about',
  '/contact',
  '/pricing',
  '/docs',
  '/api/health',
])

/**
 * 判断路径是否为公开路径(不需要登录即可访问)。
 * 注意:仅检查 path 部分,不检查 query。`/sso/redirect?redirect=x` 的 path 是 `/sso/redirect`,不算公开。
 */
export function isPublicPath(path: string): boolean {
  if (!path) return true
  // 取 path 部分(去掉 query/hash),因为白名单只匹配 path
  const pathOnly = path.split('?')[0].split('#')[0]
  return PUBLIC_PATHS.has(pathOnly)
}

/**
 * 全局去重 guard:同一时刻只允许一个登录弹窗。
 * 跨所有触发点(reauth / cookie / 401)共享,防并发弹窗 + React StrictMode 双调用。
 */
let openGuard = false

/**
 * 统一打开登录弹窗(带去重 guard)。
 *
 * @param target 登录成功后回跳的目标路径
 * @returns true=已触发弹窗;false=被 guard 拦截(已有弹窗在打开)
 */
export function openLoginDialogOnce(target: string): boolean {
  if (typeof window === 'undefined') return false
  if (openGuard) return false
  openGuard = true
  useLoginDialogStore.getState().open('login', target)
  let unsub: (() => void) | undefined = undefined
  unsub = useLoginDialogStore.subscribe((s) => {
    if (!s.isOpen) {
      openGuard = false
      unsub?.()
    }
  })
  return true
}

/**
 * 重置 guard(仅测试用,生产代码不要调)。
 * 测试场景:每个 case 需要重置 guard 状态,避免上一个 case 的 guard 影响下一个。
 */
export function __resetOpenGuardForTest(): void {
  openGuard = false
}
