// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * B4-04 daemon 跨进程注册表镜像测试 —— 三判据注入 + 过滤顺序 + 陈旧回收 + store 接口。
 *
 * 用例对应票面验收：
 *  ① 准入：条目形状不合规 ⇒ 具名原因，不落库
 *  ② 三谓词短路顺序：存活 → 身份 → host → 端口；前一维未过，后维 spy 零调用
 *  ③ 三谓词各一条失败断言：pid 不活 / 身份非当前 / 端口不通；host 不符同档
 *  ④ 未判定三态：存活 / 身份 / 端口观测取不到 ⇒ unjudged，绝不冒「死了 / 不通 / 无实例」
 *  ⑤ findRunning：命中第一条 running；全 stale ⇒ none；夹 unjudged ⇒ unjudged；store 抛错 ⇒ unjudged
 *  ⑥ pruneStale：只删确凿 stale；unjudged 保留；remove 失败进 failed 不丢其余
 *  ⑦ JsonFileRegistryStore：往返一致 / remove 清空 / 破损文件 corrupt 报错（不当空表）
 *  ⑧ probePortOpen：非法端口 / 空 host ⇒ null（未判定），不抛
 */

import { describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import path from 'node:path'
import {
  DaemonRegistry,
  JsonFileRegistryStore,
  MemoryRegistryStore,
  RegistryStoreError,
  REGISTRY_FILE_ENV,
  defaultAliveProbe,
  defaultRegistryFilePath,
  evaluateEntry,
  matchIdentityProbe,
  probePortOpen,
  validateEntry,
  type DaemonRegistryEntry,
  type RegistryProbes,
  type RegistryStore,
} from '../src/daemon/registry.js'

const BASE: DaemonRegistryEntry = {
  pid: 12345,
  identity: 'build-abc123-start-1000',
  port: 8841,
  host: '127.0.0.1',
  kind: 'daemon',
  registeredAtMs: 1_000,
}

const liveProbes: RegistryProbes = {
  isAlive: () => true,
  isIdentityCurrent: () => true,
  isPortOpen: () => true,
}

function probesSpy(overrides: Partial<RegistryProbes> = {}): {
  probes: RegistryProbes
  spies: Record<'isAlive' | 'isIdentityCurrent' | 'isPortOpen', ReturnType<typeof vi.fn>>
} {
  const spies = {
    isAlive: vi.fn<(pid: number) => boolean | null>(() => true),
    isIdentityCurrent: vi.fn<(entry: DaemonRegistryEntry) => boolean | null>(() => true),
    isPortOpen: vi.fn<
      (host: string, port: number) => boolean | null | Promise<boolean | null>
    >(() => true),
  }
  if (overrides.isAlive) spies.isAlive.mockImplementation(overrides.isAlive)
  if (overrides.isIdentityCurrent) spies.isIdentityCurrent.mockImplementation(overrides.isIdentityCurrent)
  if (overrides.isPortOpen) spies.isPortOpen.mockImplementation(overrides.isPortOpen)
  return { probes: spies, spies }
}

describe('validateEntry（准入）', () => {
  it('合规条目通过并 trim 空白', () => {
    const result = validateEntry({ ...BASE, identity: '  ident-x ', host: '  127.0.0.1  ' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.entry.identity).toBe('ident-x')
      expect(result.entry.host).toBe('127.0.0.1')
    }
  })

  it.each([
    [{ ...BASE, pid: 0 }, 'pid-invalid'],
    [{ ...BASE, pid: -3 }, 'pid-invalid'],
    [{ ...BASE, pid: 1.5 }, 'pid-invalid'],
    [{ ...BASE, identity: '' }, 'identity-empty'],
    [{ ...BASE, identity: '   ' }, 'identity-empty'],
    [{ ...BASE, port: 0 }, 'port-invalid'],
    [{ ...BASE, port: 70_000 }, 'port-invalid'],
    [{ ...BASE, host: '' }, 'host-empty'],
    [{ ...BASE, kind: '' }, 'kind-empty'],
    [{ ...BASE, registeredAtMs: NaN }, 'registered-at-invalid'],
  ])('不合规形状 ⇒ 具名原因 %#', (raw, reason) => {
    const result = validateEntry(raw)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe(reason)
  })

  it('非对象输入 ⇒ entry-not-object', () => {
    expect(validateEntry(null)).toEqual({ ok: false, reason: 'entry-not-object' })
    expect(validateEntry('nope')).toEqual({ ok: false, reason: 'entry-not-object' })
  })
})

describe('evaluateEntry（纯判据，短路顺序）', () => {
  it('⑤ 三维全过 ⇒ running', async () => {
    const verdict = await evaluateEntry(BASE, {}, liveProbes)
    expect(verdict).toEqual({ status: 'running', entry: BASE })
  })

  it('① pid 不活 ⇒ stale dead；身份 / 端口探针零调用', async () => {
    const { probes, spies } = probesSpy({ isAlive: () => false })
    const verdict = await evaluateEntry(BASE, {}, probes)
    expect(verdict).toEqual({ status: 'stale', reason: 'dead' })
    expect(spies.isAlive).toHaveBeenCalledTimes(1)
    expect(spies.isIdentityCurrent).not.toHaveBeenCalled()
    expect(spies.isPortOpen).not.toHaveBeenCalled()
  })

  it('② pid 活、身份非当前 ⇒ stale identity-mismatch；端口探针零调用', async () => {
    const { probes, spies } = probesSpy({ isIdentityCurrent: () => false })
    const verdict = await evaluateEntry(BASE, {}, probes)
    expect(verdict).toEqual({ status: 'stale', reason: 'identity-mismatch' })
    expect(spies.isPortOpen).not.toHaveBeenCalled()
  })

  it('③ host 不符 ⇒ stale host-mismatch', async () => {
    const verdict = await evaluateEntry(BASE, { host: '10.0.0.9' }, liveProbes)
    expect(verdict).toEqual({ status: 'stale', reason: 'host-mismatch' })
  })

  it('④ 端口不通 ⇒ stale port-closed', async () => {
    const { probes } = probesSpy({ isPortOpen: () => false })
    const verdict = await evaluateEntry(BASE, {}, probes)
    expect(verdict).toEqual({ status: 'stale', reason: 'port-closed' })
  })

  it('⑥ 存活未判定 ⇒ unjudged alive-unmeasured（不冒死）', async () => {
    const { probes, spies } = probesSpy({ isAlive: () => null })
    const verdict = await evaluateEntry(BASE, {}, probes)
    expect(verdict).toEqual({ status: 'unjudged', reason: 'alive-unmeasured' })
    expect(spies.isIdentityCurrent).not.toHaveBeenCalled()
  })

  it('⑦ 身份未判定 ⇒ unjudged identity-unmeasured', async () => {
    const { probes, spies } = probesSpy({ isIdentityCurrent: () => null })
    const verdict = await evaluateEntry(BASE, {}, probes)
    expect(verdict).toEqual({ status: 'unjudged', reason: 'identity-unmeasured' })
    expect(spies.isPortOpen).not.toHaveBeenCalled()
  })

  it('⑧ 端口未判定 ⇒ unjudged port-unmeasured（不冒不通）', async () => {
    const { probes } = probesSpy({ isPortOpen: () => null })
    const verdict = await evaluateEntry(BASE, {}, probes)
    expect(verdict).toEqual({ status: 'unjudged', reason: 'port-unmeasured' })
  })

  it('身份谓词支持异步端口探针', async () => {
    const probes: RegistryProbes = {
      isAlive: () => true,
      isIdentityCurrent: () => true,
      isPortOpen: async () => true,
    }
    const verdict = await evaluateEntry(BASE, {}, probes)
    expect(verdict.status).toBe('running')
  })
})

describe('DaemonRegistry.findRunning（单例探测）', () => {
  it('第一条 running 命中；stale 条目入 stale 清单', async () => {
    const store = new MemoryRegistryStore()
    store.upsert(BASE)
    store.upsert({ ...BASE, pid: 22222, port: 9001 })
    const probes: RegistryProbes = {
      isAlive: (pid) => (pid === BASE.pid ? true : false),
      isIdentityCurrent: () => true,
      isPortOpen: () => true,
    }
    const registry = new DaemonRegistry(store, probes)
    const result = await registry.findRunning()
    expect(result.status).toBe('running')
    expect(result.entry?.pid).toBe(BASE.pid)
    expect(result.stale.map((item) => item.reason)).toEqual(['dead'])
    expect(result.unjudged).toEqual([])
  })

  it('全 stale ⇒ none（不冒在跑实例）', async () => {
    const store = new MemoryRegistryStore()
    store.upsert(BASE)
    const registry = new DaemonRegistry(store, {
      isAlive: () => false,
      isIdentityCurrent: () => true,
      isPortOpen: () => true,
    })
    const result = await registry.findRunning()
    expect(result.status).toBe('none')
    expect(result.entry).toBeNull()
  })

  it('夹未判定条目 ⇒ unjudged，不冒「无实例」', async () => {
    const store = new MemoryRegistryStore()
    store.upsert(BASE)
    const registry = new DaemonRegistry(store, {
      isAlive: () => null,
      isIdentityCurrent: () => true,
      isPortOpen: () => true,
    })
    const result = await registry.findRunning()
    expect(result.status).toBe('unjudged')
    expect(result.entry).toBeNull()
    expect(result.unjudged.map((item) => item.reason)).toEqual(['alive-unmeasured'])
  })

  it('store 读抛错 ⇒ unjudged + storeError 点名，不冒空表', async () => {
    const store: RegistryStore = {
      list: () => {
        throw new Error('boom')
      },
      upsert: () => undefined,
      remove: () => undefined,
    }
    const registry = new DaemonRegistry(store, liveProbes)
    const result = await registry.findRunning()
    expect(result.status).toBe('unjudged')
    expect(result.storeError).toBe('boom')
  })

  it('kind 不符的条目跳过，不参与裁决', async () => {
    const store = new MemoryRegistryStore()
    store.upsert({ ...BASE, kind: 'worker' })
    const registry = new DaemonRegistry(store, liveProbes)
    const result = await registry.findRunning({ kind: 'daemon' })
    expect(result.status).toBe('none')
  })

  it('register 形状不合规不落库并返回具名原因', async () => {
    const store = new MemoryRegistryStore()
    const registry = new DaemonRegistry(store, liveProbes)
    const result = registry.register({ ...BASE, port: 0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('port-invalid')
    expect(await store.list()).toEqual([])
  })
})

describe('DaemonRegistry.pruneStale（陈旧回收）', () => {
  it('dead / identity-mismatch / port-closed 被删；running 与 unjudged 保留', async () => {
    const store = new MemoryRegistryStore()
    const dead = { ...BASE, pid: 11111 }
    const identityMismatch = { ...BASE, pid: 22222, identity: 'stale-build' }
    const portClosed = { ...BASE, pid: 33333, port: 9003 }
    const kept = { ...BASE, pid: 44444 }
    const unjudged = { ...BASE, pid: 55555 }
    for (const entry of [dead, identityMismatch, portClosed, kept, unjudged]) {
      store.upsert(entry)
    }
    const probes: RegistryProbes = {
      isAlive: (pid) => (pid === unjudged.pid ? null : pid !== dead.pid),
      isIdentityCurrent: (entry) => entry.pid !== identityMismatch.pid,
      isPortOpen: (_host, port) => port !== portClosed.port,
    }
    const registry = new DaemonRegistry(store, probes)
    const report = await registry.pruneStale()

    expect(report.removed.map((item) => item.entry.pid).sort()).toEqual([11111, 22222, 33333])
    expect(report.keptRunning.map((entry) => entry.pid)).toEqual([44444])
    expect(report.keptUnjudged.map((item) => item.entry.pid)).toEqual([55555])
    expect((await store.list()).map((entry) => entry.pid).sort()).toEqual([44444, 55555])
  })

  it('remove 失败进 failed 清单，其余条目不丢', async () => {
    const store = new MemoryRegistryStore()
    store.upsert(BASE)
    const failingStore: RegistryStore = {
      list: () => store.list(),
      upsert: (entry) => store.upsert(entry),
      remove: () => {
        throw new Error('unlink-failed')
      },
    }
    const registry = new DaemonRegistry(failingStore, {
      isAlive: () => false,
      isIdentityCurrent: () => true,
      isPortOpen: () => true,
    })
    const report = await registry.pruneStale()
    expect(report.removed).toEqual([])
    expect(report.failed.map((item) => item.reason)).toEqual(['dead'])
    expect((await store.list())).toHaveLength(1)
  })
})

describe('JsonFileRegistryStore（本地台账）', () => {
  function tmpFile(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-daemon-reg-'))
    return path.join(dir, 'registry.json')
  }

  it('upsert → list 往返一致；同 pid 覆盖不重复', () => {
    const file = tmpFile()
    const store = new JsonFileRegistryStore(file)
    store.upsert(BASE)
    store.upsert({ ...BASE, port: 9001 })
    const list = store.list()
    expect(list).toEqual([{ ...BASE, port: 9001 }])
  })

  it('remove 后表为空', () => {
    const store = new JsonFileRegistryStore(tmpFile())
    store.upsert(BASE)
    store.remove(BASE.pid)
    expect(store.list()).toEqual([])
  })

  it('文件不存在 ⇒ 空表（不当错误）', () => {
    expect(new JsonFileRegistryStore(tmpFile()).list()).toEqual([])
  })

  it('破损 JSON ⇒ RegistryStoreError corrupt，不当空表冒绿', () => {
    const file = tmpFile()
    fs.writeFileSync(file, '{not-json', 'utf8')
    expect(() => new JsonFileRegistryStore(file).list()).toThrow(RegistryStoreError)
    try {
      new JsonFileRegistryStore(file).list()
    } catch (e) {
      expect((e as RegistryStoreError).reason).toBe('corrupt')
    }
  })

  it('schema 版本不符 ⇒ corrupt', () => {
    const file = tmpFile()
    fs.writeFileSync(file, JSON.stringify({ v: 999, entries: [] }), 'utf8')
    expect(() => new JsonFileRegistryStore(file).list()).toThrow(RegistryStoreError)
  })
})

describe('probePortOpen（runner 探针）', () => {
  it('非法端口 ⇒ null（未判定），不抛', async () => {
    await expect(probePortOpen('127.0.0.1', 0)).resolves.toBeNull()
    await expect(probePortOpen('127.0.0.1', 70_000)).resolves.toBeNull()
  })

  it('空 host ⇒ null（未判定）', async () => {
    await expect(probePortOpen('   ', 8841)).resolves.toBeNull()
  })
})

describe('matchIdentityProbe（身份谓词工厂）', () => {
  it('身份相等 ⇒ true；不等 ⇒ false', () => {
    const probe = matchIdentityProbe('build-abc123-start-1000')
    expect(probe(BASE)).toBe(true)
    expect(probe({ ...BASE, identity: 'other' })).toBe(false)
  })
})

describe('默认 runner 出口', () => {
  it('defaultAliveProbe 委托 observeProcessAlive：当前进程 pid 判活', () => {
    expect(defaultAliveProbe(process.pid)).toBe(true)
  })

  it('defaultRegistryFilePath：env 覆盖优先；缺省落 ~/.ihui/daemon/registry.json', () => {
    process.env[REGISTRY_FILE_ENV] = 'D:/custom/registry.json'
    expect(defaultRegistryFilePath()).toBe('D:/custom/registry.json')
    delete process.env[REGISTRY_FILE_ENV]
    expect(defaultRegistryFilePath().endsWith(path.join('.ihui', 'daemon', 'registry.json'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
