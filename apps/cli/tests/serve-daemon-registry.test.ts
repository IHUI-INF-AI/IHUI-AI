// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-04 装车钉：registry 三判据预检接进 `ihui serve` 绑定前路径。
 *
 * 验收口径（零缺省行为变化）：
 *  ① 空台账（等价「无注册表文件」）⇒ 三判据全过也无条目 ⇒ 照旧走原绑定流程，startAgentServer 被调；
 *  ② 命中在跑实例 ⇒ 显式阻断退出 1，startAgentServer 未被调，报错带对方 pid/port/host/identity；
 *  ③ 存活判据未判定（探针返回 null）⇒ 回落原绑定流程，不拦截；
 *  ④ 台账读失败（store.list 抛错）⇒ unjudged 回落原绑定流程，不新增失败分支；
 *  ⑤ 预检出口映射：running / none / unjudged 三态原样上交，storeError 透传。
 *
 * 真实 server / 内核全部 mock：测试不绑端口、不启 AgentCore、不落盘台账（MemoryStore）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Command } from 'commander'
import type * as SettingsModule from '../src/commands/settings.js'

const h = vi.hoisted(() => ({
  startAgentServer: vi.fn(),
  attachWsBridge: vi.fn(),
}))

vi.mock('../src/commands/settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SettingsModule>()
  return {
    ...actual,
    loadSettings: () => ({ serve: {} }),
    resolveEffectiveConfig: () => ({
      apiUrl: 'http://test.local',
      apiKey: 'ihui_test_key',
      apiSecret: 'sk_test_secret',
      credentialKind: 'api_key',
    }),
  }
})

vi.mock('../src/server/index.js', () => ({
  AgentCore: vi.fn(function AgentCore() {}),
  startAgentServer: h.startAgentServer,
  attachWsBridge: h.attachWsBridge,
}))

import {
  DaemonRegistry,
  MemoryRegistryStore,
  RegistryStoreError,
  matchIdentityProbe,
  type DaemonRegistryEntry,
  type RegistryProbes,
  type RegistryStore,
} from '../src/daemon/registry.js'
import {
  __setRegistryFactoryForTest,
  checkExistingServeInstance,
  registerServeCommand,
  serveIdentityFingerprint,
  SERVE_REGISTRY_KIND,
} from '../src/commands/serve.js'

const LIVE_PROBES: RegistryProbes = {
  isAlive: () => true,
  isIdentityCurrent: () => true,
  isPortOpen: () => true,
}

let exitCodes: Array<number | undefined> = []
let stdoutWrites: string[] = []
let exitSpy: { mockRestore: () => void }
let outSpy: { mockRestore: () => void }

function buildRegistry(store: RegistryStore, probes: RegistryProbes): DaemonRegistry {
  return new DaemonRegistry(store, probes)
}

function runningEntry(overrides: Partial<DaemonRegistryEntry> = {}): DaemonRegistryEntry {
  return {
    pid: 4321,
    identity: serveIdentityFingerprint(),
    port: 8841,
    host: '127.0.0.1',
    kind: SERVE_REGISTRY_KIND,
    registeredAtMs: 1_000,
    ...overrides,
  }
}

async function runServe(args: string[] = []): Promise<void> {
  const program = new Command()
  registerServeCommand(program)
  await program.parseAsync(['serve', '--json', ...args], { from: 'user' })
}

function readyEvents(): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = []
  for (const raw of stdoutWrites) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed.type === 'ready') events.push(parsed)
    } catch {
      // 非 JSON 行不参与判定
    }
  }
  return events
}

function errorEvents(): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = []
  for (const raw of stdoutWrites) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (parsed.type === 'error') events.push(parsed)
    } catch {
      // 非 JSON 行不参与判定
    }
  }
  return events
}

describe('serve 单例预检（B4-04 装车）', () => {
  beforeEach(() => {
    exitCodes = []
    stdoutWrites = []
    h.startAgentServer.mockReset()
    h.attachWsBridge.mockReset()
    h.startAgentServer.mockResolvedValue({ server: {}, port: 8841, close: async () => {} })
    h.attachWsBridge.mockResolvedValue(undefined)
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitCodes.push(code)
    }) as never)
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
      stdoutWrites.push(String(chunk))
      return true
    }) as never)
  })

  afterEach(() => {
    exitSpy.mockRestore()
    outSpy.mockRestore()
  })

  it('空台账（等价无注册表文件）⇒ 回落原绑定流程，startAgentServer 被调、无阻断退出', async () => {
    const registry = buildRegistry(new MemoryRegistryStore(), LIVE_PROBES)
    __setRegistryFactoryForTest(() => registry)

    await runServe()

    expect(h.startAgentServer).toHaveBeenCalledTimes(1)
    expect(exitCodes).toEqual([])
    expect(readyEvents()).toHaveLength(1)
    expect(errorEvents()).toHaveLength(0)
  })

  it('命中在跑实例 ⇒ 阻断退出 1，startAgentServer 未被调，报错带对方 pid/port/host/identity', async () => {
    const store = new MemoryRegistryStore()
    store.upsert(runningEntry())
    const registry = buildRegistry(store, LIVE_PROBES)
    __setRegistryFactoryForTest(() => registry)

    await runServe()

    expect(h.startAgentServer).not.toHaveBeenCalled()
    expect(exitCodes).toEqual([1])

    const errors = errorEvents()
    expect(errors).toHaveLength(1)
    const message = String(errors[0]?.message ?? '')
    expect(message).toContain('pid=4321')
    expect(message).toContain('port=8841')
    expect(message).toContain('host=127.0.0.1')
    expect(message).toContain(`identity=${serveIdentityFingerprint()}`)
  })

  it('存活判据未判定（探针 null）⇒ unjudged 回落原绑定流程，不拦截', async () => {
    const store = new MemoryRegistryStore()
    store.upsert(runningEntry())
    const probes: RegistryProbes = {
      ...LIVE_PROBES,
      isAlive: () => null,
    }
    const registry = buildRegistry(store, probes)
    __setRegistryFactoryForTest(() => registry)

    await runServe()

    expect(h.startAgentServer).toHaveBeenCalledTimes(1)
    expect(exitCodes).toEqual([])
    expect(errorEvents()).toHaveLength(0)
  })

  it('台账读失败（store.list 抛错）⇒ unjudged 回落原绑定流程，不新增失败分支', async () => {
    const failingStore: RegistryStore = {
      list: () => {
        throw new RegistryStoreError('io', 'registry-file-read-failed: boom')
      },
      upsert: () => {},
      remove: () => {},
    }
    const registry = buildRegistry(failingStore, LIVE_PROBES)
    __setRegistryFactoryForTest(() => registry)

    await runServe()

    expect(h.startAgentServer).toHaveBeenCalledTimes(1)
    expect(exitCodes).toEqual([])
    expect(errorEvents()).toHaveLength(0)
  })

  it('预检出口映射：running / none / unjudged 三态原样上交，storeError 透传', async () => {
    const hitStore = new MemoryRegistryStore()
    hitStore.upsert(runningEntry())
    const hit = await checkExistingServeInstance(buildRegistry(hitStore, LIVE_PROBES), {
      host: '127.0.0.1',
    })
    expect(hit.status).toBe('running')
    expect(hit.entry?.pid).toBe(4321)
    expect(hit.storeError).toBeNull()

    const empty = await checkExistingServeInstance(
      buildRegistry(new MemoryRegistryStore(), LIVE_PROBES),
      { host: '127.0.0.1' },
    )
    expect(empty.status).toBe('none')
    expect(empty.entry).toBeNull()

    const failingStore: RegistryStore = {
      list: () => {
        throw new RegistryStoreError('corrupt', 'registry-file-json-parse-failed')
      },
      upsert: () => {},
      remove: () => {},
    }
    const unjudged = await checkExistingServeInstance(buildRegistry(failingStore, LIVE_PROBES), {
      host: '127.0.0.1',
    })
    expect(unjudged.status).toBe('unjudged')
    expect(unjudged.entry).toBeNull()
    expect(unjudged.storeError).toContain('json-parse-failed')
  })

  it('身份谓词按当前版本指纹比对：身份不符 ⇒ stale 不拦截，回落原绑定流程', async () => {
    const store = new MemoryRegistryStore()
    store.upsert(runningEntry({ identity: 'cli@0.0.0-stale' }))
    const probes: RegistryProbes = {
      ...LIVE_PROBES,
      isIdentityCurrent: matchIdentityProbe(serveIdentityFingerprint()),
    }
    const registry = buildRegistry(store, probes)
    __setRegistryFactoryForTest(() => registry)

    await runServe()

    expect(h.startAgentServer).toHaveBeenCalledTimes(1)
    expect(exitCodes).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
