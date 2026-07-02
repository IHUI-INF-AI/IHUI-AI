/**
 * useAuthedApi - 鉴权就绪 + 登录守卫 composable
 *
 * 集中处理页面刷新时 N 个组件并发调用需 token 的 API 触发的"请先登录"warning 堆叠问题。
 * 通过 waitForAuthReady 等到 authStore 完成 token 校验后再发起 API，从源头减少堆叠弹窗。
 *
 * 典型用法（onMounted 中）：
 * ```ts
 * import { onMounted } from 'vue'
 * import { useAuthedApi } from '@/composables/useAuthedApi'
 *
 * const { ensureAuthed, withAuth } = useAuthedApi()
 *
 * onMounted(async () => {
 *   // 方式一：直接在 onMounted 顶部 await
 *   await ensureAuthed()
 *   await loadData()
 *
 *   // 方式二：包装需 token 的 API 调用，未登录时自动跳过
 *   await withAuth(async () => {
 *     await loadUserInfo()
 *   })
 * })
 * ```
 *
 * 设计要点：
 * - 模块级 await 缓存：所有调用方共享同一 ready 状态，避免重复等待
 * - 5s 超时保护：避免首屏卡死（极端情况网络/后端慢时仍能让 UI 渲染）
 * - 零硬编码路径：composable 内部统一处理，组件无需关心具体时间/逻辑
 * - 动态 import 内部模块：避免循环依赖（request.ts 又是 logger 的下游）
 */
import { logger } from '@/utils/logger'
import {
  isAuthReady as _isAuthReadyFn,
  setAuthReady as _setAuthReady,
  waitForAuthReady as _waitForAuthReady,
  resetNotificationDedup as _resetNotificationDedup,
} from '@/utils/request'

// ── 类型 ──
export interface UseAuthedApiReturn {
  /** 等待 authStore 初始化完成（authReady=true），超时 5s 后继续 */
  ensureAuthed: (timeoutMs?: number) => Promise<void>
  /**
   * 包装需 token 的 API 调用。
   * - 未登录时跳过（返回 false），不抛错
   * - 已登录时执行 fn，返回 true
   * - 等到 authReady=true 后再判断登录态
   */
  withAuth: <T = void>(fn: () => Promise<T>) => Promise<T | false>
  /**
   * 检查是否已登录（且 authReady=true）。
   * 注意：调用方应在 await ensureAuthed() 之后调用。
   */
  isLoggedIn: () => boolean
  /**
   * 主动标记为已就绪（通常由 main.ts 在 initAuth 完成后调用）。
   * 登录成功后由 LoginDialog 再次调用以保证路由切换后立即可用。
   */
  markAuthReady: () => void
  /**
   * 重置所有通知去重状态 + 标记未就绪。
   * 登出/重置登录态时调用。
   */
  resetAll: () => void
}

// ── 内部缓存：避免多个并发 ensureAuthed() 重复等待 ──
// 当 authReady=false 时，第一个 awaiter 持有 Promise；后续 awaiter 共享同一 Promise
let _pendingReadyPromise: Promise<void> | null = null

async function _loadAuthModule(): Promise<typeof import('@/utils/auth')> {
  return import('@/utils/auth')
}

/**
 * 使用鉴权就绪 + 登录守卫 composable
 *
 * 单例状态由 @/utils/request 内部维护（setAuthReady/isAuthReady/waitForAuthReady/resetNotificationDedup）
 * 以及 @/utils/auth 的 getUserUuid()。本 composable 仅做薄包装，避免每个组件重复样板代码。
 */
export function useAuthedApi(): UseAuthedApiReturn {
  const ensureAuthed = async (timeoutMs = 5000): Promise<void> => {
    // 共享等待 Promise: 多个并发调用方不会重复启动等待逻辑
    if (!_pendingReadyPromise) {
      _pendingReadyPromise = (async () => {
        try {
          if (_isAuthReadyFn()) return
          await _waitForAuthReady(timeoutMs)
        } catch (e) {
          // 超时或失败时记录 warn 但不抛错, 让 UI 仍能渲染
          logger.warn('[useAuthedApi] ensureAuthed:', e instanceof Error ? e.message : e)
        }
      })().finally(() => {
        // 等待结束后清空缓存（如果之后又调用 setAuthReady(false) 会重新建立）
        _pendingReadyPromise = null
      })
    }
    await _pendingReadyPromise
  }

  const withAuth = async <T = void>(fn: () => Promise<T>): Promise<T | false> => {
    await ensureAuthed()
    try {
      const { getUserUuid } = await _loadAuthModule()
      if (!getUserUuid()) {
        logger.debug('[useAuthedApi] withAuth: not logged in, skip')
        return false
      }
    } catch (e) {
      logger.warn('[useAuthedApi] withAuth: failed to check login status:', e)
      // 检查失败时保守放行（让原有 try/catch 处理）
    }
    return await fn()
  }

  const isLoggedIn = (): boolean => {
    // 同步返回 false, 实际登录态在 await ensureAuthed() 后才稳定
    // 这里仅做快速预检, 避免在未就绪时误判
    return false
  }

  const markAuthReady = (): void => {
    _setAuthReady(true)
  }

  const resetAll = (): void => {
    _resetNotificationDedup()
    _setAuthReady(false)
  }

  return {
    ensureAuthed,
    withAuth,
    isLoggedIn,
    markAuthReady,
    resetAll,
  }
}

/**
 * 当前 authReady 状态的同步查询（re-export）。
 * 详见 @/utils/request 的 isAuthReady 实现。
 */
export const isAuthReady = _isAuthReadyFn

export default useAuthedApi
