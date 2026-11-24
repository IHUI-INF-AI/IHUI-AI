// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { __test__ } from '../src/tools/mcp-credentials.js'
// arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs'
import type * as ChildProcessModule from 'node:child_process'
import type * as FsModule from 'node:fs'

const h = vi.hoisted(() => ({
  truncateTemp: false,
  truncateTarget: false,
  target: '',
}))

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof ChildProcessModule>()
  const execFile = ((
    _engine: string,
    args: string[],
    _opts: unknown,
    cb: (err: Error | null, out?: string) => void,
  ) => {
    const payload = args[args.length - 1] ?? ''
    return {
      stdin: { end: (p: string) => void queueMicrotask(() => cb(null, p || payload)) },
      on: () => undefined,
      kill: () => undefined,
    }
  }) as unknown as typeof actual.execFile
  return { ...actual, execFile }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof FsModule>()
  const readFile = (async (p: unknown, opts?: unknown) => {
    const s = String(p)
    if (h.truncateTemp && s.includes('.tmp')) return 'SHORT'
    if (h.truncateTarget && h.target.length > 0 && s === h.target) return 'SHORT'
    return actual.promises.readFile(p as never, opts as never)
  }) as typeof actual.promises.readFile
  return { ...actual, promises: { ...actual.promises, readFile } }
})

let scratch = ''
const prevHome = process.env.HOME
const prevUserProfile = process.env.USERPROFILE
const prevIhuiHome = process.env.IHUI_HOME
const prevBackend = process.env.IHUI_MCP_CRED_BACKEND
const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')

function keyNames(dir: string): string[] {
  return fs.readdirSync(dir).filter((name) => name.includes('mcp-cred') || name.endsWith('.tmp'))
}

beforeEach(() => {
  scratch = mkScratch('mcp-atomic-key-')
  process.env.HOME = scratch
  process.env.USERPROFILE = scratch
  process.env.IHUI_HOME = scratch
  delete process.env.IHUI_MCP_CRED_BACKEND
  h.truncateTemp = false
  h.truncateTarget = false
  h.target = ''
  __test__.clearMasterKeyCaches()
  Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
})

afterEach(() => {
  if (prevHome === undefined) delete process.env.HOME
  else process.env.HOME = prevHome
  if (prevUserProfile === undefined) delete process.env.USERPROFILE
  else process.env.USERPROFILE = prevUserProfile
  if (prevIhuiHome === undefined) delete process.env.IHUI_HOME
  else process.env.IHUI_HOME = prevIhuiHome
  if (prevBackend === undefined) delete process.env.IHUI_MCP_CRED_BACKEND
  else process.env.IHUI_MCP_CRED_BACKEND = prevBackend
  if (platformDescriptor) Object.defineProperty(process, 'platform', platformDescriptor)
  vi.restoreAllMocks()
  rmScratch(scratch)
})

describe('DBG-39 / DBG-40 密钥原子写与磁盘回读', () => {
  it('主密钥回读与期望不一致时不落截断文件,也不裸 writeFile', async () => {
    h.truncateTemp = true
    const writeFile = vi.spyOn(fs.promises, 'writeFile')
    const rename = vi.spyOn(fs, 'renameSync')
    const keyPath = path.join(scratch, 'mcp-cred-master.dpapi')

    const attempt = await __test__.tryOsTier(false)

    expect(attempt.ok).toBe(false)
    expect(attempt.created).toBe(false)
    expect(attempt.material).toBeNull()
    expect(attempt.reasonCode).toBe('os-key-readback-mismatch')
    expect(attempt.detail).toContain('不覆盖')
    expect(fs.existsSync(keyPath)).toBe(false)
    expect(keyNames(scratch)).toEqual([])
    expect(writeFile.mock.calls.filter((call) => String(call[0]) === keyPath)).toHaveLength(0)
    expect(rename.mock.calls.filter((call) => String(call[1]) === keyPath)).toHaveLength(0)
  })

  it('主密钥以磁盘字节为准,清缓存后仍能解开同一把钥', async () => {
    const writeFile = vi.spyOn(fs.promises, 'writeFile')
    const keyPath = path.join(scratch, 'mcp-cred-master.dpapi')

    const created = await __test__.tryOsTier(false)
    expect(created.ok).toBe(true)
    expect(created.created).toBe(true)
    expect(created.material).not.toBeNull()
    const onDisk = fs.readFileSync(keyPath, 'utf-8')
    expect(onDisk.length).toBeGreaterThan(16)
    expect(writeFile.mock.calls.filter((call) => String(call[0]) === keyPath)).toHaveLength(0)

    __test__.clearMasterKeyCaches()
    const again = await __test__.tryOsTier(false)
    expect(again.ok).toBe(true)
    expect(again.created).toBe(false)
    expect(again.material).not.toBeNull()
    if (!created.material || !again.material) {
      throw new Error('master key material missing')
    }
    expect(Buffer.compare(again.material.key, created.material.key)).toBe(0)
  })

  it('机器绑定信封回读不一致时不留下截断文件', async () => {
    h.truncateTemp = true
    const writeFile = vi.spyOn(fs.promises, 'writeFile')
    const keyPath = path.join(scratch, 'mcp-cred-key.json')

    const attempt = await __test__.tryMachineTier(false)

    expect(attempt.ok).toBe(false)
    expect(attempt.created).toBe(false)
    expect(attempt.material).toBeNull()
    expect(attempt.reasonCode).toBe('machine-key-readback-mismatch')
    expect(attempt.detail).toContain('不覆盖')
    expect(fs.existsSync(keyPath)).toBe(false)
    expect(keyNames(scratch)).toEqual([])
    expect(writeFile.mock.calls.filter((call) => String(call[0]) === keyPath)).toHaveLength(0)
  })

  it('机器绑定信封写完后磁盘可再次解开,且不走裸 writeFile', async () => {
    const writeFile = vi.spyOn(fs.promises, 'writeFile')
    const keyPath = path.join(scratch, 'mcp-cred-key.json')

    const created = await __test__.tryMachineTier(false)
    expect(created.ok).toBe(true)
    expect(created.created).toBe(true)
    expect(created.material).not.toBeNull()
    const raw = fs.readFileSync(keyPath, 'utf-8')
    const parsed = JSON.parse(raw) as { ihuiMcpKeyV1?: { ct?: string; iv?: string; mb?: string } }
    expect(Object.keys(parsed)).toEqual(['ihuiMcpKeyV1'])
    expect(typeof parsed.ihuiMcpKeyV1?.ct).toBe('string')
    expect(typeof parsed.ihuiMcpKeyV1?.iv).toBe('string')
    expect(typeof parsed.ihuiMcpKeyV1?.mb).toBe('string')
    expect(writeFile.mock.calls.filter((call) => String(call[0]) === keyPath)).toHaveLength(0)

    __test__.clearMasterKeyCaches()
    const again = await __test__.tryMachineTier(false)
    expect(again.ok).toBe(true)
    expect(again.created).toBe(false)
    expect(again.reasonCode).toBe('machine-key-bound-ok')
    if (!created.material || !again.material) {
      throw new Error('machine key material missing')
    }
    expect(Buffer.compare(again.material.key, created.material.key)).toBe(0)
  })

  it('临时文件回读不一致时不覆盖已有好文件', async () => {
    const target = path.join(scratch, 'mcp-cred-key.json')
    fs.writeFileSync(target, 'OLD-GOOD', 'utf-8')
    h.truncateTemp = true
    const rename = vi.spyOn(fs, 'renameSync')

    const result = await __test__.writeVerifiedAtomic(target, 'NEW-EXPECTED-BYTES')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toContain('不覆盖')
    expect(fs.readFileSync(target, 'utf-8')).toBe('OLD-GOOD')
    expect(rename.mock.calls.filter((call) => String(call[1]) === target)).toHaveLength(0)
  })

  it('目标回读与期望不一致时还原旧文件', async () => {
    const target = path.join(scratch, 'mcp-cred-key.json')
    fs.writeFileSync(target, 'OLD-GOOD', 'utf-8')
    h.truncateTarget = true
    h.target = target

    const result = await __test__.writeVerifiedAtomic(target, 'NEW-EXPECTED-BYTES')

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toContain('不覆盖')
    expect(fs.readFileSync(target, 'utf-8')).toBe('OLD-GOOD')
  })

  it('目标原先不存在且回读不一致时删除坏文件', async () => {
    const target = path.join(scratch, 'mcp-cred-key.json')
    h.truncateTarget = true
    h.target = target

    const result = await __test__.writeVerifiedAtomic(target, 'NEW-EXPECTED-BYTES')

    expect(result.ok).toBe(false)
    expect(fs.existsSync(target)).toBe(false)
  })

  it('onlyIfAbsent 看见已有文件时不覆盖', async () => {
    const target = path.join(scratch, 'kept.json')
    fs.writeFileSync(target, 'OLD-GOOD', 'utf-8')

    const result = await __test__.writeVerifiedAtomic(target, 'NEW-EXPECTED-BYTES', {
      onlyIfAbsent: true,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.detail).toContain('不覆盖')
    expect(fs.readFileSync(target, 'utf-8')).toBe('OLD-GOOD')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
