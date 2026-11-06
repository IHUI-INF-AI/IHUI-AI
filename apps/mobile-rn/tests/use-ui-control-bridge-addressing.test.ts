// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN UI 桥定址投递客户端侧测试(2026-09-26,把 extension / 桌面桥那组不变量装到 app_ui 端)。
 *
 * 三条钉死:
 *  - 非指派到本机:不执行(executeRnUiAction 零调用)、不回执,且留可诊断日志(不静默 return);
 *  - 指派端:回执带 responded{自报实例 + 原样回显服务端 token};
 *  - 无 assignment 的旧服务端载荷 ⇒ 与改前逐字同行为(照常执行、回执不含 responded,
 *    且 data.instanceId 仍在 —— 那是改前唯一的钉回机制)。
 * 判据住 `@ihui/shared/utils/agent-action-addressing`,此处不 mock 它(装车证明)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WSNotification } from '@ihui/types'

const h = vi.hoisted(() => ({
  posts: [] as Array<{ url: string; body: Record<string, unknown> }>,
  execute: vi.fn(),
  warns: [] as unknown[][],
}))

/**
 * 2026-11-06 修红(同 use-ui-control-bridge.test.ts 的根因):端点层迁移后,桥从
 * `@ihui/api-client` 取 reportAgentControlResult,而端点文件内部
 * `import { fetchApi } from '../client.js'`,不经 barrel —— 整模块替换 barrel 会让端点函数
 * 变 undefined,回执一条也发不出。这里按真实模块 id 部分替换 client,仅打桩 fetchApi
 * 出口(保留真实实现里另外的导出与 normalizeUrl/401 语义);url 取端点源码传入的原始路径。
 */
vi.mock('../../../packages/api-client/src/client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    fetchApi: (url: string, opts: { body?: string }) => {
      h.posts.push({ url, body: JSON.parse(String(opts.body)) as Record<string, unknown> })
      return Promise.resolve({ success: true })
    },
  }
})

/** 只替换通知 WS 工厂,其余导出(端点函数等)保持真实实现 */
vi.mock('@ihui/api-client', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    createNotificationClient: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  }
})

vi.mock('../src/lib/ui-action-registry', () => ({
  configureRnUiBridge: vi.fn(),
  resetRnUiBridge: vi.fn(),
  executeRnUiAction: h.execute,
}))

vi.mock('../src/lib/config', () => ({
  API_BASE_URL: 'http://localhost:8802',
  WS_BASE_URL: 'http://localhost:8802',
}))

import { getRnInstanceId, handleWsNotification } from '../src/hooks/use-ui-control-bridge'

/** 每条用例换新 requestId:桥层去重集是模块级常驻的,复用会撞已记的 id */
let seq = 0
function frame(assignment?: Record<string, unknown>): WSNotification {
  seq += 1
  return {
    type: 'notification',
    data: {
      type: 'agent.action',
      request: { requestId: `req-${seq}`, category: 'app_ui', action: 'describe', params: {} },
      ...(assignment ? { assignment } : {}),
    },
  } as unknown as WSNotification
}

function resultPosts() {
  return h.posts.filter((p) => p.url === '/api/agent-control/result')
}

/** 等 executeRnUiAction → toResponse → reportResult 的 promise 链跑完 */
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
}

beforeEach(() => {
  h.posts.length = 0
  h.warns.length = 0
  h.execute.mockReset()
  h.execute.mockResolvedValue({ ok: true, data: { screen: { name: 'Home' } } })
  vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    h.warns.push(args)
  })
})

describe('RN 桥 assignment 定址', () => {
  it('非指派到本机:不执行、不回执,且留可诊断日志(不得静默 return)', async () => {
    handleWsNotification(frame({ endpoint: 'rn', instanceId: 'rn-other-phone', token: 'tk-1' }))
    await flush()
    expect(h.execute).not.toHaveBeenCalled()
    expect(resultPosts()).toHaveLength(0)
    expect(h.warns.flat().join(' ')).toContain('rn-other-phone')
  })

  it('他端种类(串投到 app_ui 面)同样不执行', async () => {
    handleWsNotification(
      frame({ endpoint: 'miniapp', instanceId: getRnInstanceId(), token: 'tk-2' }),
    )
    await flush()
    expect(h.execute).not.toHaveBeenCalled()
    expect(resultPosts()).toHaveLength(0)
  })

  it('指派端回执带 responded{自报实例 + 回显服务端 token}', async () => {
    const token = 'tk-' + Math.random().toString(36).slice(2)
    handleWsNotification(frame({ endpoint: 'rn', instanceId: getRnInstanceId(), token }))
    await flush()
    const posts = resultPosts()
    expect(posts).toHaveLength(1)
    expect(posts[0]?.body.responded).toEqual({
      instanceId: getRnInstanceId(),
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
    expect(posts[0]?.body.data).toMatchObject({ instanceId: getRnInstanceId() })
  })

  it('旧 targetInstanceId 防撞机制在不带 assignment 时仍生效(兼容性不得因收口而退化)', async () => {
    seq += 1
    handleWsNotification({
      type: 'notification',
      data: {
        type: 'agent.action',
        request: {
          requestId: `req-${seq}`,
          category: 'app_ui',
          action: 'describe',
          params: {},
          targetInstanceId: 'rn-someone-else',
        },
      },
    } as unknown as WSNotification)
    await flush()
    expect(h.execute).not.toHaveBeenCalled()
    expect(resultPosts()).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
