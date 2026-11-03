// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 小程序 UI 桥定址投递客户端侧测试(2026-09-26,把 extension / 桌面桥那组不变量装到
 * miniapp_ui 端)。与 RN 端同一套断言 —— 三桥判定语义必须逐字相同,不得某一端放宽。
 *
 * 三条钉死:
 *  - 非指派到本端:不执行、不回执,且留 logger.warn 可诊断痕迹(不得静默 return);
 *  - 指派端:回执带 responded{自报实例 + 原样回显服务端 token};
 *  - 无 assignment 的旧服务端载荷 ⇒ 与改前逐字同行为。
 * 判据住 `@ihui/shared/utils/agent-action-addressing`,此处不 mock 它(装车证明)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WSNotification } from '@ihui/types'

const h = vi.hoisted(() => ({
  posts: [] as Array<{ url: string; body: Record<string, unknown> }>,
  execute: vi.fn(),
  warns: [] as unknown[][],
}))

vi.mock('@tarojs/taro', () => ({
  default: { eventCenter: { trigger: vi.fn() }, onAppShow: vi.fn(), onAppHide: vi.fn() },
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: (url: string, opts: { body?: string }) => {
    h.posts.push({ url, body: JSON.parse(String(opts.body)) as Record<string, unknown> })
    return Promise.resolve({ success: true })
  },
  createNotificationClient: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
}))

vi.mock('@/lib/ui-action-registry', () => ({
  configureTaroUiBridge: vi.fn(),
  resetTaroUiBridge: vi.fn(),
  executeTaroUiAction: h.execute,
}))

vi.mock('@/utils/auth', () => ({ getToken: () => 'test-token' }))
vi.mock('@/utils/taro-websocket-adapter', () => ({ taroWebSocketFactory: vi.fn() }))
vi.mock('@/utils/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => {
      h.warns.push(args)
    },
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import { __test__, getTaroInstanceId } from '../src/hooks/use-ui-control-bridge'

const { handleWsNotification } = __test__

/** 每条用例换新 requestId:桥层去重集是模块级常驻的,复用会撞已记的 id */
let seq = 0
function frame(assignment?: Record<string, unknown>): WSNotification {
  seq += 1
  return {
    type: 'notification',
    data: {
      type: 'agent.action',
      request: { requestId: `req-${seq}`, category: 'miniapp_ui', action: 'describe', params: {} },
      ...(assignment ? { assignment } : {}),
    },
  } as unknown as WSNotification
}

function resultPosts() {
  return h.posts.filter((p) => p.url === '/api/agent-control/result')
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
}

beforeEach(() => {
  h.posts.length = 0
  h.warns.length = 0
  h.execute.mockReset()
  h.execute.mockResolvedValue({ ok: true, data: { page: 'pages/index/index' } })
})

describe('小程序桥 assignment 定址', () => {
  it('非指派到本端:不执行、不回执,且留 logger.warn 痕迹(不得静默 return)', async () => {
    handleWsNotification(
      frame({ endpoint: 'miniapp', instanceId: 'taro-other-device', token: 'tk-1' }),
    )
    await flush()
    expect(h.execute).not.toHaveBeenCalled()
    expect(resultPosts()).toHaveLength(0)
    expect(h.warns.flat().join(' ')).toContain('taro-other-device')
  })

  it('他端种类(串投)同样不执行,哪怕实例 id 巧合', async () => {
    handleWsNotification(frame({ endpoint: 'rn', instanceId: getTaroInstanceId(), token: 'tk-2' }))
    await flush()
    expect(h.execute).not.toHaveBeenCalled()
    expect(resultPosts()).toHaveLength(0)
  })

  it('指派端回执带 responded{自报实例 + 回显服务端 token}', async () => {
    const token = 'tk-' + Math.random().toString(36).slice(2)
    handleWsNotification(frame({ endpoint: 'miniapp', instanceId: getTaroInstanceId(), token }))
    await flush()
    const posts = resultPosts()
    expect(posts).toHaveLength(1)
    expect(posts[0]?.body.responded).toEqual({
      instanceId: getTaroInstanceId(),
      assignmentToken: token,
    })
  })

  it('旧服务端(无 assignment)逐字旧行为:照常执行、无 responded、data.instanceId 仍在', async () => {
    handleWsNotification(frame())
    await flush()
    expect(h.execute).toHaveBeenCalledTimes(1)
    const posts = resultPosts()
    expect(posts).toHaveLength(1)
    expect(posts[0]?.body.responded).toBeUndefined()
    expect(posts[0]?.body.data).toMatchObject({ instanceId: getTaroInstanceId() })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
