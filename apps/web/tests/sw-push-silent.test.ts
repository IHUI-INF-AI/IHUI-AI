// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Web SW 推送双响治理(2026-11-26 立)。
 *
 * 背景:页面在前台时页面内 playRingtone 已响铃,SW 通知若再带系统声就会双响;
 * 前台可见窗口 ⇒ 通知 silent: true(声音交给页面内),App 全关 / 仅后台 ⇒ 不带 silent
 * 键保留系统声,matchAll 异常一律回落不静默。
 *
 * sw.js 是 service worker 脚本(非 ES module,顶层直接 self.addEventListener),不能 import;
 * 本文件用 node:vm 读源文本在最小桩 sandbox 里执行,从全局取顶层纯函数,并捕获注册的
 * push handler 做接线验证。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

import { describe, expect, it } from 'vitest'

const SW_SRC = readFileSync(join(process.cwd(), 'public', 'sw.js'), 'utf8')

interface LoadedSw {
  registered: Record<string, Array<(event: unknown) => void>>
  notifications: Array<{ title: string; options: Record<string, unknown> }>
  sandbox: Record<string, unknown>
  matchAll: () => Promise<unknown[]>
}

function loadSw(matchAllImpl?: () => Promise<unknown[]>): LoadedSw {
  const registered: Record<string, Array<(event: unknown) => void>> = {}
  const notifications: Array<{ title: string; options: Record<string, unknown> }> = []

  const clientsApi = {
    matchAll: async (): Promise<unknown[]> => {
      if (matchAllImpl) return matchAllImpl()
      return []
    },
  }

  const sandbox: Record<string, unknown> = {
    console,
    URL,
    fetch: async () => {
      throw new Error('fetch 仅在 SW handler 内使用,解析期不应被调用')
    },
    caches: {
      open: async () => ({ addAll: async () => undefined }),
      keys: async () => [],
      delete: async () => true,
      match: async () => undefined,
    },
  }
  sandbox.self = {
    addEventListener(type: string, fn: (event: unknown) => void) {
      ;(registered[type] ??= []).push(fn)
    },
    clients: clientsApi,
    registration: {
      showNotification(title: string, options: Record<string, unknown>) {
        notifications.push({ title, options })
        return Promise.resolve()
      },
    },
    location: { origin: 'http://localhost' },
    skipWaiting() {},
    claim() {},
  }
  // SW 脚本内部以 self.xxx 访问全局;vm 顶层函数声明挂在 context 全局(sandbox)上。
  sandbox.self.self = sandbox.self

  vm.runInNewContext(SW_SRC, sandbox, { filename: 'sw.js' })

  return { registered, notifications, sandbox, matchAll: clientsApi.matchAll }
}

/** 从 sandbox 取顶层纯函数;非严格脚本的顶层 function 声明会挂到 context 全局。 */
function fns(sandbox: Record<string, unknown>) {
  return {
    hasVisibleClient: sandbox.hasVisibleClient as (list: unknown) => boolean,
    buildPushNotificationOptions: sandbox.buildPushNotificationOptions as (
      args: Record<string, unknown>,
    ) => Record<string, unknown>,
    resolvePushSilent: sandbox.resolvePushSilent as (
      clientsApi: { matchAll: (opts: object) => Promise<unknown[]> },
    ) => Promise<boolean>,
  }
}

describe('sw push 静默分档:顶层纯函数', () => {
  it('任一 visibilityState=visible 的窗口 ⇒ true', () => {
    const { sandbox } = loadSw()
    const { hasVisibleClient } = fns(sandbox)
    expect(hasVisibleClient([{ visibilityState: 'hidden' }, { visibilityState: 'visible' }])).toBe(
      true,
    )
  })

  it('只有 hidden 窗口 ⇒ false', () => {
    const { sandbox } = loadSw()
    const { hasVisibleClient } = fns(sandbox)
    expect(hasVisibleClient([{ visibilityState: 'hidden' }])).toBe(false)
  })

  it('空数组 ⇒ false', () => {
    const { sandbox } = loadSw()
    const { hasVisibleClient } = fns(sandbox)
    expect(hasVisibleClient([])).toBe(false)
  })

  it('null / undefined / 非数组 ⇒ false(防御脏值)', () => {
    const { sandbox } = loadSw()
    const { hasVisibleClient } = fns(sandbox)
    expect(hasVisibleClient(null)).toBe(false)
    expect(hasVisibleClient(undefined)).toBe(false)
    expect(hasVisibleClient('not-an-array')).toBe(false)
    expect(hasVisibleClient({ length: 0 })).toBe(false)
  })

  it('silent=true ⇒ options 带 silent: true', () => {
    const { sandbox } = loadSw()
    const { buildPushNotificationOptions } = fns(sandbox)
    const opts = buildPushNotificationOptions({ title: 'T', body: 'B', url: '/x', silent: true })
    expect(opts.silent).toBe(true)
    expect(opts.data).toEqual({ url: '/x' })
    expect(opts.tag).toBe('ihui-push')
    expect(opts.body).toBe('B')
  })

  it('silent=false ⇒ 整个 silent 键不出现(保留系统声)', () => {
    const { sandbox } = loadSw()
    const { buildPushNotificationOptions } = fns(sandbox)
    const opts = buildPushNotificationOptions({ title: 'T', body: 'B', url: '/x', silent: false })
    expect('silent' in opts).toBe(false)
    expect(opts.data).toEqual({ url: '/x' })
    expect(opts.tag).toBe('ihui-push')
  })

  it('resolvePushSilent:matchAll 返回 visible 窗口 ⇒ true', async () => {
    const { sandbox } = loadSw(async () => [{ visibilityState: 'visible' }])
    const { resolvePushSilent } = fns(sandbox)
    const silent = await resolvePushSilent({
      matchAll: async () => [{ visibilityState: 'visible' }],
    })
    expect(silent).toBe(true)
  })

  it('resolvePushSilent:只有 hidden 窗口 ⇒ false(无 silent 键)', async () => {
    const { sandbox } = loadSw()
    const { resolvePushSilent } = fns(sandbox)
    const silent = await resolvePushSilent({
      matchAll: async () => [{ visibilityState: 'hidden' }],
    })
    expect(silent).toBe(false)
  })

  it('resolvePushSilent:空数组 ⇒ false(无 silent 键)', async () => {
    const { sandbox } = loadSw()
    const { resolvePushSilent } = fns(sandbox)
    const silent = await resolvePushSilent({ matchAll: async () => [] })
    expect(silent).toBe(false)
  })

  it('resolvePushSilent:matchAll 抛错 ⇒ 回落 false(不能无声)', async () => {
    const { sandbox } = loadSw()
    const { resolvePushSilent } = fns(sandbox)
    const silent = await resolvePushSilent({
      matchAll: async () => {
        throw new Error('matchAll unavailable')
      },
    })
    expect(silent).toBe(false)
  })

  it('resolvePushSilent:matchAll 返回非数组 ⇒ false', async () => {
    const { sandbox } = loadSw()
    const { resolvePushSilent } = fns(sandbox)
    const silent = await resolvePushSilent({ matchAll: async () => ({}) })
    expect(silent).toBe(false)
  })
})

describe('sw push 接线:handler 真的把分档结果传给 showNotification', () => {
  function firePush(
    loaded: LoadedSw,
    data: { json: () => unknown; text?: () => string },
  ): Promise<unknown[]> {
    const pushHandler = loaded.registered['push'][0]
    expect(pushHandler).toBeTypeOf('function')
    const waiters: Array<Promise<unknown>> = []
    pushHandler({
      data,
      waitUntil: (p: Promise<unknown>) => waiters.push(p),
    })
    return Promise.all(waiters)
  }

  it('页面可见 ⇒ showNotification 实收 options.silent === true', async () => {
    const loaded = loadSw(async () => [{ visibilityState: 'visible' }])
    await firePush(loaded, { json: () => ({ title: 'T', body: 'B', url: '/x' }) })
    expect(loaded.notifications).toHaveLength(1)
    const opts = loaded.notifications[0].options
    expect(opts.silent).toBe(true)
    expect(opts.data).toEqual({ url: '/x' })
    expect(opts.tag).toBe('ihui-push')
    expect(loaded.notifications[0].title).toBe('T')
  })

  it('仅隐藏窗口 ⇒ showNotification 的 options 无 silent 键', async () => {
    const loaded = loadSw(async () => [{ visibilityState: 'hidden' }])
    await firePush(loaded, { json: () => ({ title: 'T', body: 'B', url: '/x' }) })
    expect(loaded.notifications).toHaveLength(1)
    expect('silent' in loaded.notifications[0].options).toBe(false)
  })

  it('无窗口(matchAll 空)⇒ showNotification 的 options 无 silent 键', async () => {
    const loaded = loadSw(async () => [])
    await firePush(loaded, { json: () => ({ title: 'T', body: 'B', url: '/x' }) })
    expect(loaded.notifications).toHaveLength(1)
    expect('silent' in loaded.notifications[0].options).toBe(false)
  })

  it('matchAll 抛错 ⇒ 回落不静默,showNotification 仍被调用且无 silent 键', async () => {
    const loaded = loadSw(async () => {
      throw new Error('matchAll failed')
    })
    await firePush(loaded, { json: () => ({ title: 'T', body: 'B', url: '/x' }) })
    expect(loaded.notifications).toHaveLength(1)
    expect('silent' in loaded.notifications[0].options).toBe(false)
  })

  it('payload 解析坏掉(json 抛)⇒ 仍走 text() 兜底并 showNotification', async () => {
    const loaded = loadSw(async () => [{ visibilityState: 'hidden' }])
    await firePush(loaded, {
      json: () => {
        throw new Error('invalid payload')
      },
      text: () => 'fallback body',
    })
    expect(loaded.notifications).toHaveLength(1)
    const opts = loaded.notifications[0].options
    expect(opts.body).toBe('fallback body')
    expect('silent' in opts).toBe(false)
    // title 缺省回落 'IHUI AI',url 缺省 '/'
    expect(loaded.notifications[0].title).toBe('IHUI AI')
    expect(opts.data).toEqual({ url: '/' })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
