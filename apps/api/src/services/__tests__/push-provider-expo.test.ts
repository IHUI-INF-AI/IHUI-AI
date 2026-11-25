// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Expo 托管推送腿（2026-11-26）。
 *
 * 判据：
 *  - RN `getExpoPushTokenAsync()` 产出的 `ExponentPushToken[...]` 必须走 exp.host，
 *    绝不能落到 FCM（FCM v1 会按无效 registration token 拒收，整条铃声链路静默死掉）；
 *  - 请求体是官方数组契约，Android 渠道只传 channelId、不传 sound（音源由渠道承载）；
 *  - 票据 status=error 必须回报失败，而不是"发出去了"。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { env } from 'node:process'
import { isExpoPushToken, sendPush } from '../push-provider'

const CONFIG_KEYS = [
  'FCM_PROJECT_ID',
  'FCM_SERVICE_ACCOUNT_KEY',
  'GETUI_APP_ID',
  'GETUI_APP_KEY',
  'GETUI_MASTER_SECRET',
  'EXPO_ACCESS_TOKEN',
] as const
const savedEnv: Record<string, string | undefined> = {}
for (const k of CONFIG_KEYS) savedEnv[k] = env[k]

function clearConfig(): void {
  for (const k of CONFIG_KEYS) delete env[k]
}

function stubFetch(response: { ok?: boolean; status?: number; body: string }) {
  const fetchMock = vi.fn(async () => ({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    text: async () => response.body,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  clearConfig()
  for (const k of CONFIG_KEYS) {
    if (savedEnv[k] !== undefined) env[k] = savedEnv[k]
  }
})

describe('isExpoPushToken', () => {
  it('认 Expo(nent)PushToken 两种形态', () => {
    expect(isExpoPushToken('ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true)
    expect(isExpoPushToken('ExpoPushToken[abc]')).toBe(true)
  })

  it('不认 FCM / 个推 / 畸形 token', () => {
    expect(isExpoPushToken('fcm-registration-token-abc')).toBe(false)
    expect(isExpoPushToken('ExponentPushToken[]')).toBe(false)
    expect(isExpoPushToken('ExponentPushToken[has space]')).toBe(false)
    expect(isExpoPushToken('')).toBe(false)
  })
})

describe('sendPush — Expo token 形态优先分流', () => {
  it('即便配置了 FCM，Expo token 也走 exp.host，且请求体是数组契约', async () => {
    env.FCM_PROJECT_ID = 'ihui-test'
    env.FCM_SERVICE_ACCOUNT_KEY = 'not-a-real-key'
    const fetchMock = stubFetch({ body: JSON.stringify({ data: [{ status: 'ok', id: 'ticket-1' }] }) })

    const result = await sendPush(
      { token: 'ExponentPushToken[dev-1]' },
      { title: '新消息', body: '你好', channelId: 'ringtone_dingdong', data: { kind: 'chat' } },
    )

    expect(result).toMatchObject({ provider: 'expo', success: true, messageId: 'ticket-1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string; headers: Record<string, string> }]
    expect(url).toBe('https://exp.host/--/api/v2/push/send')
    const payload = JSON.parse(init.body) as Array<Record<string, unknown>>
    expect(Array.isArray(payload)).toBe(true)
    expect(payload).toHaveLength(1)
    expect(payload[0]).toMatchObject({
      to: 'ExponentPushToken[dev-1]',
      title: '新消息',
      body: '你好',
      channelId: 'ringtone_dingdong',
      priority: 'high',
    })
    // 渠道音源在 App 内，服务端不传 sound，也不出现 FCM 的 android 块
    expect(payload[0]).not.toHaveProperty('sound')
    expect(payload[0]).not.toHaveProperty('android')
    expect(init.headers.Authorization).toBeUndefined()
  })

  it('无 channelId 时不写该键（保持消息体最小）', async () => {
    const fetchMock = stubFetch({ body: JSON.stringify({ data: [{ status: 'ok', id: 'ticket-2' }] }) })
    await sendPush({ token: 'ExpoPushToken[x]' }, { title: 't', body: 'b' })
    const payload = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body,
    ) as Array<Record<string, unknown>>
    expect(payload[0]).not.toHaveProperty('channelId')
    expect(payload[0]).not.toHaveProperty('data')
  })

  it('配置 EXPO_ACCESS_TOKEN 时带 Bearer 头', async () => {
    env.EXPO_ACCESS_TOKEN = 'expo-token'
    const fetchMock = stubFetch({ body: JSON.stringify({ data: { status: 'ok', id: 'ticket-3' } }) })
    const result = await sendPush({ token: 'ExpoPushToken[x]' }, { title: 't', body: 'b' })
    const init = (fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }])[1]
    expect(init.headers.Authorization).toBe('Bearer expo-token')
    // data 也可能是对象而非数组，两种都要解
    expect(result).toMatchObject({ provider: 'expo', success: true, messageId: 'ticket-3' })
  })

  it('票据 error 必须回报失败并带排障码', async () => {
    stubFetch({
      body: JSON.stringify({
        data: [
          {
            status: 'error',
            message: 'The device push token is invalid',
            details: { error: 'DeviceNotRegistered' },
          },
        ],
      }),
    })
    const result = await sendPush({ token: 'ExponentPushToken[stale]' }, { title: 't', body: 'b' })
    expect(result.success).toBe(false)
    expect(result.provider).toBe('expo')
    expect(result.error).toContain('invalid')
    expect(result.error).toContain('DeviceNotRegistered')
  })

  it('HTTP 非 2xx 回报失败并截断正文', async () => {
    stubFetch({ ok: false, status: 502, body: 'upstream boom' })
    const result = await sendPush({ token: 'ExpoPushToken[x]' }, { title: 't', body: 'b' })
    expect(result).toMatchObject({ provider: 'expo', success: false })
    expect(result.error).toContain('Expo 502')
  })

  it('响应不是 JSON 时不抛错，按失败回报', async () => {
    stubFetch({ body: 'not-json' })
    const result = await sendPush({ token: 'ExpoPushToken[x]' }, { title: 't', body: 'b' })
    expect(result).toMatchObject({ provider: 'expo', success: false, error: 'Expo 响应不是 JSON' })
  })

  it('非 Expo token 且无任何 provider 配置时仍是 stub fail-closed', async () => {
    const fetchMock = stubFetch({ body: '{}' })
    const result = await sendPush({ token: 'plain-device-token' }, { title: 't', body: 'b' })
    expect(result).toMatchObject({ provider: 'stub', success: false, error: 'push_not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
