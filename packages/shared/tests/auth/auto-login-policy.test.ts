// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 冷启动静默登回判据(跨端唯一实现)的用例。
 *
 * 三档成对,不得只测正例(2026-09-27 任务 #29):
 *  ① 登出标记在 + 有凭据 + 开关开 ⇒ **不登回**
 *  ② 无登出标记 + 有凭据 + 开关开 ⇒ 登回
 *  ③ 缺任一条件 ⇒ 不登回
 * 末例判的是"三端必须落在同一个 storage key 上"——名字漂移等于三端各有各的标记。
 */
import { describe, it, expect } from 'vitest'

import {
  canSilentlyReLogin,
  shouldAttemptAutoLogin,
  shouldExpireSession,
  classifyRefreshFailureStatus,
  REFRESH_TOKEN_STALE_ERROR_CODE,
  SESSION_LOGGED_OUT_STORAGE_KEY,
} from '../../src/auth/auto-login-policy'

const d = (sessionLoggedOut: boolean, flag: boolean, remembered: boolean): boolean =>
  shouldAttemptAutoLogin({
    sessionLoggedOut: () => sessionLoggedOut,
    hasAutoLoginFlag: () => flag,
    hasRememberedCredentials: () => remembered,
  })

describe('shouldAttemptAutoLogin(账密静默重登)', () => {
  it('① 登出标记压过历史勾选:两个勾选位都成立也不登回', () => {
    expect(d(true, true, true)).toBe(false)
  })

  it('② 正当路径不被误伤:未登出 + 勾选齐 ⇒ 登回', () => {
    expect(d(false, true, true)).toBe(true)
  })

  it('③ 两个勾选位缺一不可', () => {
    expect(d(false, false, true)).toBe(false)
    expect(d(false, true, false)).toBe(false)
    expect(d(false, false, false)).toBe(false)
  })

  it('③ 反向对照:登出标记单独成立时不因"没有任何勾选"而变成通过', () => {
    // 这一例与上一例方向相反:证明红的成因是登出标记,而不是缺勾选 ——
    // 否则把判据写成 `flag && remembered && !loggedOut` 与写成 `!loggedOut` 短路,账面一样绿。
    expect(d(true, false, false)).toBe(false)
    expect(d(true, false, true)).toBe(false)
  })
})

describe('canSilentlyReLogin(各端自定义准入条件)', () => {
  it('无 gates 时只判登出标记(小程序静默登录那一型:平台 code 登录没有勾选位)', () => {
    expect(canSilentlyReLogin({ sessionLoggedOut: () => false })).toBe(true)
    expect(canSilentlyReLogin({ sessionLoggedOut: () => true })).toBe(false)
    expect(canSilentlyReLogin({ sessionLoggedOut: () => true, gates: [] })).toBe(false)
  })

  it('gates 全部成立才通过,任一不成立即不登回', () => {
    const platformOk = () => true
    expect(canSilentlyReLogin({ sessionLoggedOut: () => false, gates: [platformOk] })).toBe(true)
    expect(
      canSilentlyReLogin({
        sessionLoggedOut: () => false,
        gates: [platformOk, () => false],
      }),
    ).toBe(false)
    // 登出标记排在最前:哪怕 gates 全开
    expect(
      canSilentlyReLogin({ sessionLoggedOut: () => true, gates: [platformOk, () => true] }),
    ).toBe(false)
  })

  it('账密形状必须与直接调 canSilentlyReLogin 同结论(同一实现的两条投影,不得各算各的)', () => {
    for (const loggedOut of [true, false]) {
      for (const flag of [true, false]) {
        for (const remembered of [true, false]) {
          expect(d(loggedOut, flag, remembered)).toBe(
            canSilentlyReLogin({
              sessionLoggedOut: () => loggedOut,
              gates: [() => flag, () => remembered],
            }),
          )
        }
      }
    }
  })

  it('三端共用同一个 storage key(名字漂移 = 三端各有各的标记)', () => {
    expect(SESSION_LOGGED_OUT_STORAGE_KEY).toBe('ihui-session-logged-out')
  })
})

describe('classifyRefreshFailureStatus(刷新失败分型)', () => {
  it('401/403 = 凭据被明确拒绝', () => {
    expect(classifyRefreshFailureStatus(401)).toBe('rejected')
    expect(classifyRefreshFailureStatus(403)).toBe('rejected')
  })

  it('5xx = 瞬时不可用(不能误判成凭据失效)', () => {
    expect(classifyRefreshFailureStatus(500)).toBe('transient')
    expect(classifyRefreshFailureStatus(502)).toBe('transient')
    expect(classifyRefreshFailureStatus(503)).toBe('transient')
  })

  it('无 status(网络错误/超时,api 重启窗口的典型返回)与 0 = 瞬时', () => {
    expect(classifyRefreshFailureStatus(undefined)).toBe('transient')
    expect(classifyRefreshFailureStatus(0)).toBe('transient')
  })

  it('其余 4xx 一律瞬时(只有 401/403 才构成"凭据被否定")', () => {
    expect(classifyRefreshFailureStatus(400)).toBe('transient')
    expect(classifyRefreshFailureStatus(404)).toBe('transient')
    expect(classifyRefreshFailureStatus(429)).toBe('transient')
  })

  it('陈旧副本(REFRESH_TOKEN_STALE)虽随 401 到达,但服务端未否定凭据 ⇒ 瞬时、不结束会话', () => {
    // 2026-10-26:后端 stale-sibling 只拒绝本次、不吊销家族;按 401 判 rejected 会清 vault /
    // 结束会话 —— 一次多窗口轮转竞态就变成"偶发要重登"。
    expect(classifyRefreshFailureStatus(401, REFRESH_TOKEN_STALE_ERROR_CODE)).toBe('transient')
    expect(
      shouldExpireSession(classifyRefreshFailureStatus(401, REFRESH_TOKEN_STALE_ERROR_CODE)),
    ).toBe(false)
    // 对照:同状态码但没有该错误码仍是 rejected(判据没有被放宽)
    expect(classifyRefreshFailureStatus(401)).toBe('rejected')
    expect(classifyRefreshFailureStatus(401, 'SOME_OTHER_CODE')).toBe('rejected')
  })
})

describe('shouldExpireSession(要不要结束本地会话)', () => {
  it('rejected ⇒ 结束本地会话(只清凭据,不落登出标记)', () => {
    expect(shouldExpireSession('rejected')).toBe(true)
  })

  it('transient ⇒ 绝不结束会话(2026-10-09 根治「自动登录总被清掉」:api 重启/网络抖动一次就把 30 天 cookie 永久废掉的旧病根)', () => {
    expect(shouldExpireSession('transient')).toBe(false)
  })

  it('null(性质未知:刷新结果被 CAS 丢弃/未注入续期实现)一律不结束会话 —— 与 session-marker 同失效方向,未知不得触发用户可见行为改变', () => {
    expect(shouldExpireSession(null)).toBe(false)
  })

  it('端到端投影:分型 → 结束会话决策,仅 401/403 这一条链路能清凭据', () => {
    for (const status of [401, 403, 500, 502, 503, 400, 404, 429, 0, undefined]) {
      const expected = status === 401 || status === 403
      expect(shouldExpireSession(classifyRefreshFailureStatus(status))).toBe(expected)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
