// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * doom-loop 反思沉淀「出网面」隐私锁(2026-09-27 修真缺陷)。
 *
 * 病灶:`persistDoomLoopProcedural` 曾把 `opts.ctx.workspacePath` 原文塞进
 * `metadata.workspacePath` POST 到服务端 —— 那是用户机器上的绝对路径,含账户名与目录结构,
 * 而服务端 `/api/memory/procedural` 对这一格**零读者**(全仓 `grep metadata.workspacePath`
 * 只命中本文件的构造处)。同一天该请求的 `pattern` 段刚从"入参原文"改成 SHA-256(见
 * tests/doom-loop-input-hash.test.ts),留这一格是同一型的残余。
 *
 * 钉死五条:
 *   ① metadata 里必须没有 workspacePath 键(改回即红)
 *   ② 必须有 workspaceDigest,且恒为 64 位小写十六进制
 *   ③ 整条请求体(不只是 metadata)不得出现哨兵路径子串 —— 防"换个键名继续外发"
 *   ④ 同一 workspace 两次调用同值 / 不同 workspace 不同值(摘要仍可用于聚合,不是随机数)
 *   ⑤ 缺 userId 时不发请求(原有早退语义不因本次改动漂移)
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { persistDoomLoopProcedural, type RunToolLoopOptions } from '../src/commands/agent.js'

const HEX64 = /^[0-9a-f]{64}$/
/** 模拟用户机器上的真实绝对路径:含账户名 + 含目录结构 */
const SENTINEL = 'D:/Users/liuchunchuan/sentinel-workspace-dir/invoice-app'

type Probe = { body: string; url: string }

function stubFetch(): Probe[] {
  const probes: Probe[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init: unknown) => {
      const i = init as { body?: string }
      probes.push({ url: String(url), body: String(i?.body ?? '') })
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({}) }
    }),
  )
  return probes
}

function opts(workspacePath: string): RunToolLoopOptions {
  return {
    userId: 'user-1',
    sessionId: 'sess-1',
    ctx: { workspacePath },
  } as unknown as RunToolLoopOptions
}

const ALERTS = [
  {
    toolName: 'file_read',
    inputHash: 'a'.repeat(64),
    repeatCount: 3,
    message: '同一入参连续失败 3 次',
    suggestion: '换策略',
  },
] as unknown as Parameters<typeof persistDoomLoopProcedural>[1]

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('doom-loop 反思沉淀不得把用户机器路径送出机', () => {
  it('① metadata 里没有 workspacePath 键', async () => {
    const probes = stubFetch()
    await persistDoomLoopProcedural(opts(SENTINEL), ALERTS)
    expect(probes).toHaveLength(1)
    const body = JSON.parse(probes[0]!.body) as { metadata: Record<string, unknown> }
    expect(body.metadata).not.toHaveProperty('workspacePath')
  })

  it('② metadata.workspaceDigest 是 64 位小写十六进制', async () => {
    const probes = stubFetch()
    await persistDoomLoopProcedural(opts(SENTINEL), ALERTS)
    const body = JSON.parse(probes[0]!.body) as { metadata: Record<string, unknown> }
    expect(typeof body.metadata.workspaceDigest).toBe('string')
    expect(body.metadata.workspaceDigest).toMatch(HEX64)
  })

  it('③ 整条请求体任何一格都不含哨兵路径(防换键名继续外发)', async () => {
    const probes = stubFetch()
    await persistDoomLoopProcedural(opts(SENTINEL), ALERTS)
    expect(probes[0]!.body).not.toContain('sentinel-workspace-dir')
    expect(probes[0]!.body).not.toContain('liuchunchuan')
  })

  it('④ 摘要确定性:同路径同值、异路径异值(可聚合,但不是随机数)', async () => {
    const probes = stubFetch()
    await persistDoomLoopProcedural(opts(SENTINEL), ALERTS)
    await persistDoomLoopProcedural(opts(SENTINEL), ALERTS)
    await persistDoomLoopProcedural(opts('/other/somewhere-else'), ALERTS)
    const digests = probes.map((p) => {
      const b = JSON.parse(p.body) as { metadata: Record<string, unknown> }
      return String(b.metadata.workspaceDigest)
    })
    expect(digests).toHaveLength(3)
    expect(digests[0]).toBe(digests[1])
    expect(digests[2]).not.toBe(digests[0])
  })

  it('⑤ 缺 userId ⇒ 一次请求都不发(原有早退语义未被改动)', async () => {
    const probes = stubFetch()
    const noUser = { ctx: { workspacePath: SENTINEL } } as unknown as RunToolLoopOptions
    await persistDoomLoopProcedural(noUser, ALERTS)
    expect(probes).toHaveLength(0)
  })
})
