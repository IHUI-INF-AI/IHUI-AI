// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * FCM HTTP v1 消息体的 Android 渠道/音源块(2026-11-26)。
 *
 * 判据:
 *  - 有 channelId(+sound) ⇒ body.message.android.notification 带 channel_id(/sound);
 *  - 两者都没有 ⇒ message 下不出现空的 android 对象,保持现网字节不变;
 *  - 静音渠道只有 channel_id,不带 sound。
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { env } from 'node:process'

const CONFIG_KEYS = ['FCM_PROJECT_ID', 'FCM_SERVICE_ACCOUNT_KEY'] as const
const savedEnv: Record<string, string | undefined> = {}
for (const k of CONFIG_KEYS) savedEnv[k] = env[k]

/** 生成一份可被 signJwtRS256 使用的临时 RSA 私钥,让 FCM 分支真跑到 HTTP 层。 */
async function buildFcmServiceAccountKey(): Promise<string> {
  const { privateKey } = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign'],
  )
  const der = await crypto.subtle.exportKey('pkcs8', privateKey)
  const b64 = Buffer.from(der).toString('base64').replace(/(.{64})/g, '$1\n')
  const sa = {
    client_email: 'test@example.iam.gserviceaccount.com',
    private_key: `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`,
    token_uri: 'https://oauth2.example/token',
  }
  return Buffer.from(JSON.stringify(sa)).toString('base64')
}

describe('FCM 消息体 Android 渠道/音源块', () => {
  let fcmServiceAccountKey: string

  beforeAll(async () => {
    fcmServiceAccountKey = await buildFcmServiceAccountKey()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    for (const k of CONFIG_KEYS) {
      if (savedEnv[k] === undefined) delete env[k]
      else env[k] = savedEnv[k]
    }
  })

  async function sendOnce(message: Record<string, unknown>) {
    env.FCM_PROJECT_ID = 'ihui-test'
    env.FCM_SERVICE_ACCOUNT_KEY = fcmServiceAccountKey
    const bodies: unknown[] = []
    const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'at-1' }), { status: 200 })
      }
      bodies.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify({ name: 'projects/ihui-test/messages/1' }), {
        status: 200,
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const mod = (await import('../push-provider.js')) as unknown as {
      sendPush: (
        target: { token: string },
        msg: Record<string, unknown>,
      ) => Promise<{ success: boolean }>
    }
    const { sendPush } = mod
    const result = await sendPush({ token: 'tok-1' }, message)
    return { result, body: bodies[0] as { message: Record<string, unknown> } | undefined }
  }

  it('有 channelId+sound ⇒ android.notification 带 channel_id/sound', async () => {
    const { result, body } = await sendOnce({
      title: 't',
      body: 'b',
      channelId: 'msg-marimba',
      sound: 'ringtone_marimba',
    })

    expect(result.success).toBe(true)
    const android = body?.message.android as { notification: Record<string, string> }
    expect(android.notification.channel_id).toBe('msg-marimba')
    expect(android.notification.sound).toBe('ringtone_marimba')
  })

  it('两者都没有 ⇒ message 下不出现 android 键(现网字节不变)', async () => {
    const { result, body } = await sendOnce({ title: 't', body: 'b' })

    expect(result.success).toBe(true)
    expect(body?.message).not.toHaveProperty('android')
  })

  it('只有 channelId(静音渠道) ⇒ android.notification 只有 channel_id,无 sound', async () => {
    const { body } = await sendOnce({ title: 't', body: 'b', channelId: 'msg-silent' })

    const android = body?.message.android as { notification: Record<string, string> }
    expect(android.notification.channel_id).toBe('msg-silent')
    expect(android.notification).not.toHaveProperty('sound')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
