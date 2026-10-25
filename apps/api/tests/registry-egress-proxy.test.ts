// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * registry-sync 外网出口代理闸单测(2026-10-25 立)。
 *
 * 全程离线(§5 测试隔离:不触真网/真库):
 *  E1 未配键 ⇒ 走的必须是**全局 fetch**(今天的直连形态逐字节保留);
 *  E2 合法代理值 ⇒ 单槽成对返回 ProxyAgent(构造不建连,ProxyAgent 是懒池);
 *  E3 坏值 ⇒ null + warn 一次(回落直连 = 降级,不谎称成功;warn 不逐请求刷屏);
 *  E4 装车锁:fetchWithTimeout 本体必须真把 dispatcher 接上 undici 配对出口,
 *     并保留 AbortController 超时(闸装了没咬合 = 没有,§0.9)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ProxyAgent } from 'undici'
import {
  EGRESS_PROXY_ENV,
  fetchWithTimeout,
  registryEgressDispatcher,
} from '../src/services/registry-sync/types'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('E1 未配键 = 原样直连', () => {
  it('env 无该键 ⇒ 全局 fetch 被调,不经过 undici 分支', async () => {
    const spy = vi.fn(async () => new Response('{"ok":1}', { status: 200 }))
    vi.stubGlobal('fetch', spy)
    const res = await fetchWithTimeout('https://example.invalid/anything', {}, 5000, {})
    expect(spy).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
  })
  it('键存在但为空白 = 不配', async () => {
    expect(registryEgressDispatcher({ [EGRESS_PROXY_ENV]: '   ' })).toBeNull()
  })
})

describe('E2 合法值 ⇒ 代理 dispatcher 成对单槽', () => {
  it('http 代理 URL 构造成功且同值复用(不重复建对象)', () => {
    const env = { [EGRESS_PROXY_ENV]: 'http://127.0.0.1:34567' }
    const a = registryEgressDispatcher(env)
    const b = registryEgressDispatcher(env)
    expect(a).toBeInstanceOf(ProxyAgent)
    expect(b).toBe(a)
  })
})

describe('E3 坏值 = 一次 warn + 回落直连', () => {
  it('无 scheme 的坏 URL 返回 null;重复请求不二次告警(缓存了失败)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = { [EGRESS_PROXY_ENV]: 'definitely not a proxy url' }
    expect(registryEgressDispatcher(env)).toBeNull()
    registryEgressDispatcher(env)
    expect(warn.mock.calls.filter((c) => String(c[0]).includes(EGRESS_PROXY_ENV)).length).toBe(1)
    // 回落形态与不配同形:取数回到全局 fetch
  })
})

describe('E4 装车锁:闸必须咬合在唯一出口上', () => {
  const SRC = readFileSync(
    join(__dirname, '..', 'src', 'services', 'registry-sync', 'types.ts'),
    'utf8',
  )
  it('fetchWithTimeout 本体接线:dispatcher 从单一 builder 取,取到就走 undiciFetch 成对出口', () => {
    expect(SRC).toMatch(/registryEgressDispatcher\(env\)[\s\S]*undiciFetch\(url, \{[\s\S]*dispatcher,?[\s\S]*\}\)/)
    expect(SRC).toMatch(/const dispatcher = registryEgressDispatcher\(env\)/)
    // AbortController 超时臂必须还在(代理分支不得吞掉超时)
    expect(SRC).toMatch(/controller\.abort\(\), timeoutMs/)
    expect(SRC).toMatch(/signal: controller\.signal,[\s\S]*dispatcher/)
  })
  it('四个适配器都只能从本出口取数,不得有人绕过再裸 fetch', () => {
    for (const f of ['github-adapter', 'npm-adapter', 'mcp-marketplace-adapter', 'custom-registry-adapter']) {
      const src = readFileSync(join(__dirname, '..', 'src', 'services', 'registry-sync', `${f}.ts`), 'utf8')
      expect(src, `${f} 必须 import fetchWithTimeout`).toMatch(/fetchWithTimeout/)
      // 不得出现绕闸的裸 `await fetch(`(import 行以外的直接调用形态)
      const body = src.replace(/^import[\s\S]*?from .*$/gm, '')
      expect(body, `${f} 不得裸 fetch(那是绕过出口代理闸的第二把出口)`).not.toMatch(/\bawait fetch\(/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
