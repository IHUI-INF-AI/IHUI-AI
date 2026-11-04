// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 能力上报版本溯源(2026-11-04 立)。
 * 锁的是"上报给服务端的 version 来自运行时 manifest",而不是某个手抄常量 ——
 * 桥里那份 `const VERSION = '1.0.0'` 与下载文件名/下载页的源头(apps/extension/package.json)
 * 各走各的,服务端与 web 端点列表就此显示一个不存在的版本。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/token', () => ({ getToken: () => 'tk' }))
vi.mock('../lib/config', () => ({ getBridgeBaseUrl: () => 'http://127.0.0.1:8802' }))
vi.mock('../lib/ext-ui-forwarder', () => ({ dispatchAgentActionRequest: vi.fn() }))

const fetchMock = vi.fn().mockResolvedValue({ ok: true })
vi.stubGlobal('fetch', fetchMock)
// 桩一个与 package.json 不可能相等的号,才看得出这个值真是从 manifest 取的
;(globalThis as unknown as { chrome: unknown }).chrome = {
  runtime: {
    id: 'test-profile',
    getManifest: () => ({ version: '9.9.9' }),
    onMessage: { addListener: vi.fn() },
  },
  alarms: { create: vi.fn(), onAlarm: { addListener: vi.fn() } },
}

describe('扩展桥能力上报的版本溯源', () => {
  it('init 上报的 version === 运行时 manifest 的版本', async () => {
    const { initAgentControlBridge } = await import('../lib/agent-control-bridge')
    initAgentControlBridge()
    await vi.waitFor(() => {
      const capabilityPost = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/capability'))
      expect(capabilityPost).toBeDefined()
      const body = JSON.parse((capabilityPost?.[1] as { body: string }).body) as {
        version: string
      }
      expect(body.version).toBe('9.9.9')
    })
  })

  it('取不到 manifest 时报 unknown,不编版本号(与上一档成对的反例)', async () => {
    // 非扩展宿主(桥被单测直引、chrome 只是半个桩)走的是 catch 分支;
    // 两档各有一条夹具,否则"回落"只是没量过的假设。
    fetchMock.mockClear()
    const chromeHost = globalThis as unknown as {
      chrome: { runtime: { getManifest: () => never } }
    }
    chromeHost.chrome.runtime.getManifest = () => {
      throw new Error('no manifest in this host')
    }
    vi.resetModules()
    const { initAgentControlBridge } = await import('../lib/agent-control-bridge')
    initAgentControlBridge()
    await vi.waitFor(() => {
      const capabilityPost = fetchMock.mock.calls.find((c) => String(c[0]).endsWith('/capability'))
      expect(capabilityPost).toBeDefined()
      const body = JSON.parse((capabilityPost?.[1] as { body: string }).body) as {
        version: string
      }
      expect(body.version).toBe('unknown')
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
