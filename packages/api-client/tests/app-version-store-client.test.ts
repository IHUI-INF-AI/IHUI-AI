// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'

import { setTransport, type Transport } from '../src/transport.js'
import { checkAppVersion, getAppVersions, getLatestVersion } from '../src/endpoints/system.js'

/**
 * app-version 消费侧的 store(分发渠道)出站形状锁(台账 Y-70 子句④)。
 *
 * 立因:服务端 `apps/api/src/routes/app-version.ts` 已带 store 维度(迁移 0364,
 * 同一 platform 可按渠道各存一条 latest),但 api-client 此前根本不认识 store,
 * 且 `getLatestVersion` 的返回声明把 data 当成行对象 —— 服务端实际包在 `data.latest`
 * 里,取不到行时 data 是空对象(Y-14 线上实测形态)。声明错了,调用方就会把
 * "取不到包"读成"字段都是 undefined"。本文件锁三件事:
 *   C1 getLatestVersion 带 store ⇒ query 真的多出 store=xxx;不带 ⇒ 一条 store 键都不发
 *      (与服务端"不带 store 不加谓词"的回归锁 R1 同向)。
 *   C2 store 空串 ⇒ 不发 store 键(buildQs 折空 + 服务端 emptyToUndefined 双保险)。
 *   C3 checkAppVersion 带 store ⇒ 同形透传;getAppVersions 的筛选项透传。
 * 返回形状 data.latest 由服务端自己锁(app-version-store-dimension.test.ts R1 第三条),
 * 这里只锁客户端"发出去的是什么"。
 */

let captured: { url: string } | null = null

function stubTransport(): void {
  const transport = vi.fn(async (url: string) => {
    captured = { url }
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => '',
      json: async () => ({ code: 0, message: 'success', data: {} }),
    }
  })
  setTransport(transport as unknown as Transport)
}

function search(): URLSearchParams {
  if (!captured) throw new Error('没有捕获到请求 URL')
  const q = captured.url.indexOf('?')
  return new URLSearchParams(q === -1 ? '' : captured.url.slice(q + 1))
}

describe('app-version store 出站形状(C1–C3)', () => {
  afterEach(() => {
    captured = null
    setTransport(undefined as unknown as Transport)
  })

  it('C1a getLatestVersion(android, huawei) ⇒ ?platform=android&store=huawei', async () => {
    stubTransport()
    await getLatestVersion('android', 'huawei')
    expect(captured?.url.startsWith('/api/app-version/latest?')).toBe(true)
    expect(search().get('platform')).toBe('android')
    expect(search().get('store')).toBe('huawei')
  })

  it('C1b getLatestVersion(android) ⇒ 整条 query 里不出现 store 键', async () => {
    stubTransport()
    await getLatestVersion('android')
    expect(captured?.url).toBe('/api/app-version/latest?platform=android')
    expect(search().has('store')).toBe(false)
  })

  it('C2 store 传空串 ⇒ 不发 store 键(空串=不带渠道,与服务端 emptyToUndefined 同形)', async () => {
    stubTransport()
    await getLatestVersion('android', '')
    expect(search().has('store')).toBe(false)
  })

  it('C3a checkAppVersion 带 store ⇒ 透传;不带 ⇒ 不出现', async () => {
    stubTransport()
    await checkAppVersion({ version: '1.0.0', platform: 'android', store: 'google_play' })
    expect(captured?.url).toContain('/api/app-version/check-update?')
    expect(search().get('store')).toBe('google_play')
    expect(search().get('version')).toBe('1.0.0')

    captured = null
    await checkAppVersion({ version: '1.0.0', platform: 'web' })
    expect(search().has('store')).toBe(false)
  })

  it('C3b getAppVersions 的 platform/store 筛选项透传', async () => {
    stubTransport()
    await getAppVersions({ platform: 'harmony', store: 'website', page: 2 })
    expect(search().get('platform')).toBe('harmony')
    expect(search().get('store')).toBe('website')
    expect(search().get('page')).toBe('2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
