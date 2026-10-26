// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { refreshAccessToken, TransientRefreshError } from '@ihui/api-client'
import { readExp } from '@ihui/shared/utils/jwt-utils'
import { classifyRefreshFailureStatus } from '@ihui/shared/auth/auto-login-policy'
import { createChromePlatform } from '@ihui/browser-platform'
import { computeRefreshDelay, createInFlightRefresh } from '@ihui/shared/auth/auto-refresh'
import { REFRESH_ALARM_NAME } from './config'
import { getRefreshToken, setTokenPair, clearAllTokens, initApi } from './token'

// re-export 保持外部引用不变(如 tests/refresh-token.test.ts 直接从 token-utils 导入 readExp)
export { readExp }

const platform = createChromePlatform()

const inFlight = createInFlightRefresh<boolean>()

/**
 * 就绪判据(2026-10-26 立,与 background.ts 的 G-933 同型):内存镜像只由 `initApi()`
 * 的 `await chrome.storage.local.get` 回填 ⇒ SW/popup 冷启动第一拍上"读不到 refreshToken"
 * 与"回填还没跑完"同形,旧实现把两者都当成没登录直接 `clearAllTokens()`(三把 key 全删),
 * 这是扩展端「账号总是要重新登录」的主通道。
 * 本包装可重入(同一份 promise);initApi 失败不缓存 rejection——下一 tick 可重试。
 * 惰性用法见 doRefresh:镜像已有值时零额外开销,只有"读不到"才 await 回填。
 */
let apiReadyPromise: Promise<void> | null = null
function ensureApiReady(): Promise<void> {
  if (!apiReadyPromise) {
    apiReadyPromise = initApi().catch((err) => {
      apiReadyPromise = null
      throw err
    })
  }
  return apiReadyPromise
}

export function scheduleRefreshAlarm(accessToken: string): void {
  const delayMs = computeRefreshDelay(accessToken)
  if (delayMs === null) return
  // scheduleOnce 内部已封装 create + addListener + 触发后自动 removeListener,
  // clampToMinutes 由 chrome-impl.ts 内部处理,无需双重 clamp。
  // doRefresh 完成后会递归调用 scheduleRefreshAlarm 排下一次,维持 refresh 链。
  void platform.scheduler.scheduleOnce(REFRESH_ALARM_NAME, delayMs, () => {
    // 2026-10-09:doRefresh 对瞬时失败(网络/5xx)会抛 TransientRefreshError(不清 token)。
    // alarm 回调没有上游可接,在此吞掉避免 unhandledrejection;alarm 链不再续排,
    // 由 startAutoRefresh 的 4 分钟兜底 interval 重试(与 rejected 清 token 后的链条一致)。
    // 2026-10-26:alarm 触发可能落在 SW 冷启动回填之前——就绪判据已收在 doRefresh 内部
    // (动凭据前先 await ensureApiReady),此处无需重复等待。
    void doRefresh().catch(() => {})
  })
}

export async function doRefresh(): Promise<boolean> {
  const existing = inFlight.get()
  if (existing) {
    return (await existing) ?? false
  }
  const promise = (async (): Promise<boolean> => {
    try {
      let refreshToken = getRefreshToken()
      if (!refreshToken) {
        // 2026-10-26:动凭据前先过就绪判据(见 ensureApiReady 头注)。回填也没跑 ⇒ 此刻读不到
        // 什么都证明不了;initApi 自身失败(存储不可读)⇒ 未判定,按瞬时分型外抛——
        // 绝不允许把"判不出"实现成"删用户数据"(§0.3)。
        try {
          await ensureApiReady()
        } catch {
          throw new TransientRefreshError('token mirror not populated (initApi failed)')
        }
        refreshToken = getRefreshToken()
        if (!refreshToken) {
          // 回填落定后确实没有 refreshToken:本端没有可续的凭据。返回 false 交给下一次 tick /
          // 界面侧身份探测去判,**这里永远不清**——销毁凭据的权力只属于服务端明确否定(401/403)。
          return false
        }
      }
      const res = await refreshAccessToken(refreshToken)
      if (res.success && res.data?.accessToken) {
        await setTokenPair({
          accessToken: res.data.accessToken,
          refreshToken: res.data.refreshToken || refreshToken,
          expiresIn: res.data.expiresIn,
        })
        scheduleRefreshAlarm(res.data.accessToken)
        return true
      }
      // 2026-10-09 分型(判据唯一出口 = classifyRefreshFailureStatus):
      // transient(网络/超时/5xx/无 status/REFRESH_TOKEN_STALE 陈旧副本)= 服务暂不可用,凭据没死
      // → 抛 TransientRefreshError,不清 token(refreshViaExtensionStore → refreshAccessTokenOnce
      // 会 catch 住进冷却并置 wasLastRefreshTransient);rejected(401/403)才维持既有处置:清 token + false。
      // 2026-10-26:第二参数 errorCode 一并透传(STALE 算瞬时)。
      if (
        classifyRefreshFailureStatus(res.status, res.success ? undefined : res.errorCode) ===
        'transient'
      ) {
        throw new TransientRefreshError()
      }
      await clearAllTokens()
      return false
    } catch (err) {
      // 瞬时失败按原样外抛(供 401 续期出口分型)。
      if (err instanceof TransientRefreshError) throw err
      // 2026-10-26:走到这里的其他异常(网络层抛错、持久化写失败等)同样**不是服务端否定凭据**
      // ——旧实现的兜底"清 token + false"一次网络抖动就洗光登录态(「总要重新登录」的销毁通道之二),
      // 统一转瞬时分型外抛:调用方(sidepanel / api-client refreshAccessTokenOnce)据此走不清分支,稍后重试。
      throw new TransientRefreshError(err instanceof Error ? err.message : String(err))
    } finally {
      inFlight.clear()
    }
  })()
  inFlight.set(promise)
  return promise
}

// 兜底刷新定时器(scheduleRefreshAlarm 的 chrome.alarms 链若意外中断,由它保证 token 仍会续期)
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
const AUTO_REFRESH_INTERVAL_MS = 4 * 60 * 1000 // 4 分钟

export function startAutoRefresh(): void {
  // scheduleOnce 模式下,listener 由 scheduleRefreshAlarm 内部随 handler 绑定注册,
  // 无需常驻 onAlarm listener;这里额外挂一个 setInterval 兜底:
  // - alarm 链递归续期是主路径(MV3 SW 休眠期间仍可触发)
  // - 若 alarm 链意外断裂(浏览器清理 / schedule 丢失),interval 每 4 分钟兜底 doRefresh
  // - SW 被回收时 interval 自然失效,下次 startAutoRefresh 重新建立,不会重复注册
  if (autoRefreshTimer) return
  autoRefreshTimer = setInterval(() => {
    // 同上:瞬时失败在此吞掉(不产生 unhandledrejection),下一轮 4 分钟后重试。
    // 就绪判据同理由 doRefresh 内部统一把关(2026-10-26)——interval 与 alarm 是同一族触发点,
    // 未回填时读到空凭据不等于没登录,更不等于可以清。
    void doRefresh().catch(() => {})
  }, AUTO_REFRESH_INTERVAL_MS)
}

export function stopAutoRefresh(): void {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
  }
  // clearSchedule 内部已封装 removeListener + clear(仅当存在已注册 listener 时移除)
  void platform.scheduler.clearSchedule(REFRESH_ALARM_NAME)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
