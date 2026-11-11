// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DBG-66 web 侧发送端单测(2026-11-11 立):ext-auth-relay 的消息形状与降级路径。
 *
 * 钉两档:
 *   ① 消息形状 —— 与 apps/extension/lib/external-auth.ts 的接收判据逐键对齐
 *      (type 字面量 'ihui.ext_auth.token'、accessToken 必填非空、
 *       refreshToken/expiresIn 可选且「缺省即不发」,不带上 undefined 键);
 *   ② 降级路径 —— 票面「失败静默降级(不影响 web 登录本身)」:扩展未装 /
 *      ID 未配置 / 空 token / 发送被拒(Promise reject)/ 同步抛错,
 *      全部静默返回、永不抛错。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { notifyExtensionAuth, resolveExtensionId } from '../ext-auth-relay'

/** 商店 ID 风格的 32 位夹具(不臆造真实 ID,env 注入路径与生产一致) */
const EXT_ID = 'abcdefghijklmnopabcdefghijklmnop'
const ENV_KEY = 'NEXT_PUBLIC_IHUI_EXTENSION_ID'

let originalEnv: string | undefined

beforeEach(() => {
  originalEnv = process.env[ENV_KEY]
  process.env[ENV_KEY] = EXT_ID
})

afterEach(() => {
  if (originalEnv === undefined) delete process.env[ENV_KEY]
  else process.env[ENV_KEY] = originalEnv
  vi.unstubAllGlobals()
})

/** 装一个「扩展已安装」的 window.chrome.runtime.sendMessage,返回 spy */
function installFakeRuntime(impl?: (id: string, msg: Record<string, unknown>) => unknown) {
  const sendMessage = vi.fn(impl ?? (() => Promise.resolve()))
  const runtime = { sendMessage }
  vi.stubGlobal('chrome', { runtime })
  return sendMessage
}

describe('ext-auth-relay 消息形状(与扩展侧接收判据对齐)', () => {
  it('全量 token:以 extensionId 发送 type/accessToken/refreshToken/expiresIn', () => {
    const sendMessage = installFakeRuntime()
    const dispatched = notifyExtensionAuth({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      expiresIn: 3600,
    })
    expect(dispatched).toBe(true)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    const [id, message] = sendMessage.mock.calls[0] as [string, Record<string, unknown>]
    expect(id).toBe(EXT_ID)
    expect(message).toEqual({
      type: 'ihui.ext_auth.token',
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      expiresIn: 3600,
    })
  })

  it('只有 accessToken:可选键缺省即不发(不携带 undefined 键)', () => {
    const sendMessage = installFakeRuntime()
    expect(notifyExtensionAuth({ accessToken: 'at-1' })).toBe(true)
    const [, message] = sendMessage.mock.calls[0] as [string, Record<string, unknown>]
    expect(Object.keys(message).sort()).toEqual(['accessToken', 'type'])
  })

  it('脏可选值按接收端同款归一丢弃:空白 refreshToken / 非正数 expiresIn 不进消息', () => {
    const sendMessage = installFakeRuntime()
    expect(
      notifyExtensionAuth({ accessToken: 'at-1', refreshToken: '   ', expiresIn: Number.NaN }),
    ).toBe(true)
    let message = (sendMessage.mock.calls[0] as [string, Record<string, unknown>])[1]
    expect(Object.keys(message).sort()).toEqual(['accessToken', 'type'])
    expect(notifyExtensionAuth({ accessToken: 'at-1', expiresIn: 0 })).toBe(true)
    message = (sendMessage.mock.calls[1] as [string, Record<string, unknown>])[1]
    expect(message.expiresIn).toBeUndefined()
  })

  it('accessToken 两端空白被 trim 后发送(接收端同样 trim,判据对齐)', () => {
    const sendMessage = installFakeRuntime()
    expect(notifyExtensionAuth({ accessToken: '  at-1  ' })).toBe(true)
    const [, message] = sendMessage.mock.calls[0] as [string, Record<string, unknown>]
    expect(message.accessToken).toBe('at-1')
  })
})

describe('ext-auth-relay 降级路径(永不抛错,不影响 web 登录)', () => {
  it('扩展未安装:window 上没有 chrome.runtime.sendMessage ⇒ 静默 false', () => {
    vi.stubGlobal('chrome', undefined)
    expect(notifyExtensionAuth({ accessToken: 'at-1' })).toBe(false)
    const runtimeOnly = { chrome: { runtime: {} } }
    vi.stubGlobal('chrome', runtimeOnly.chrome)
    expect(notifyExtensionAuth({ accessToken: 'at-1' })).toBe(false)
  })

  it('extensionId 未配置(env 空/缺)⇒ 不发送,即便扩展已安装', () => {
    const sendMessage = installFakeRuntime()
    delete process.env[ENV_KEY]
    expect(resolveExtensionId()).toBe('')
    expect(notifyExtensionAuth({ accessToken: 'at-1' })).toBe(false)
    process.env[ENV_KEY] = '   '
    expect(notifyExtensionAuth({ accessToken: 'at-1' })).toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('accessToken 空/缺失 ⇒ 不发送(接收端判据 3 同形:空串整条拒收,发了也是噪声)', () => {
    const sendMessage = installFakeRuntime()
    expect(notifyExtensionAuth({ accessToken: '' })).toBe(false)
    expect(notifyExtensionAuth({ accessToken: '   ' })).toBe(false)
    expect(notifyExtensionAuth({ accessToken: undefined })).toBe(false)
    expect(notifyExtensionAuth({})).toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('发送被拒(ID 不存在/来源不在白名单)⇒ Promise reject 被吞,登录链路不受波及', async () => {
    installFakeRuntime(() => Promise.reject(new Error('Extension not found')))
    expect(() => notifyExtensionAuth({ accessToken: 'at-1' })).not.toThrow()
    // 让 rejection 微任务真正落地:若 catch 没挂上,这里会以 unhandled rejection 冒出来
    await Promise.resolve()
    await Promise.resolve()
  })

  it('sendMessage 同步抛错 ⇒ 静默 false,永不冒泡', () => {
    installFakeRuntime(() => {
      throw new Error('runtime blew up')
    })
    expect(() => notifyExtensionAuth({ accessToken: 'at-1' })).not.toThrow()
    expect(notifyExtensionAuth({ accessToken: 'at-1' })).toBe(false)
  })

  it('SSR(无 window)⇒ 静默 false', () => {
    vi.stubGlobal('window', undefined)
    expect(notifyExtensionAuth({ accessToken: 'at-1' })).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
