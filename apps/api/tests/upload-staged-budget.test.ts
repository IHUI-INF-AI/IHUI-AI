// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 分片上传跨会话聚合预算回归锁(2026-09-30,票 b76-12c-3)。
 *
 * 病灶:分片上传只有「单片上限 + TTL + 合并并发」三档,全是**每会话/每片**口径 ——
 * 单会话寿命内能开多少 uploadId、进程此刻总共暂存多少字节,没有任何一档在管;
 * 且全仓没有「传入上限只可收紧」的钳制器,PROTOCOL_UPLOAD_LIMITS 被 spread 改大无感知。
 *
 * 锁四件事(判据直接打在生产消费链上:路由级经真 Fastify inject,判据层打 upload-integrity 导出):
 *  a) 单用户并发 uploadId 超档 → 429 且**不建目录不建行**(零资源占用);
 *  b) 全局暂存字节超档 → 429 拒收**新片**,既有会话不被清(fail closed 不误伤);
 *  c) clampUploadLimit('maxChunkBytes', 512MiB) 结果仍是协议值(只可收紧);
 *  d) clampUploadLimit 传 0/NaN/负数必抛。
 * 测试隔离铁律(AGENTS §5):全程不连生产 PostgreSQL(8810)/Redis(8811),db 与 auth 全桩。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const testState = await vi.hoisted(async () => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.NODE_ENV = 'test'
  // hoisted 先于顶层 import 绑定初始化,node 依赖在此动态导入
  const { mkdtempSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const uploadRoot = mkdtempSync(join(tmpdir(), 'upload-budget-'))
  process.env.UPLOAD_DIR = uploadRoot
  return {
    uploadRoot,
    chunksRoot: join(uploadRoot, 'chunks'),
    insertedRows: [] as unknown[],
    updatedSets: [] as unknown[],
    selectResult: [] as unknown[],
    stagedBytesOverride: null as number | null,
  }
})

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({
      values: (v: unknown) => {
        testState.insertedRows.push(v)
        return Promise.resolve()
      },
    }),
    select: () => ({
      from: () => ({
        where: () => {
          const result = testState.selectResult
          // drizzle 查询构建器:where() 的产物既可直接 await(init 处无 limit),也接 .limit(1)
          return {
            limit: () => Promise.resolve(result),
            then: (
              resolve: (v: unknown) => void,
              reject?: (v: unknown) => void,
            ): Promise<unknown> => Promise.resolve(result).then(resolve, reject),
          }
        },
      }),
    }),
    update: () => ({
      set: (v: unknown) => ({
        where: () => {
          testState.updatedSets.push(v)
          return Promise.resolve()
        },
      }),
    }),
    delete: () => ({ where: () => Promise.resolve() }),
  },
}))

// @ihui/database 的 schema/index.ts 当前被他人半成品引用(./points-mall.js 未落盘)拖挂,
// 全仓既有 upload-merge-gate.test.ts 同样进不来 —— 本文件以桩替身隔离,词表值与真身一致。
vi.mock('@ihui/database', () => {
  const stub = new Proxy(
    {},
    {
      get: (_t, prop) => ({ name: String(prop), [Symbol.toPrimitive]: () => String(prop) }),
    },
  )
  return {
    uploadSessions: stub,
    UPLOAD_SESSION_STATUS: {
      uploading: 'uploading',
      merging: 'merging',
      completed: 'completed',
      cancelled: 'cancelled',
      checksumMismatch: 'checksum_mismatch',
    },
    UPLOAD_SESSION_TERMINAL_STATUSES: ['completed', 'cancelled', 'checksum_mismatch'],
    UPLOAD_SESSION_REAPABLE_STATUSES: ['uploading', 'merging'],
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: (request: { userId?: string }) => {
    request.userId = 'user-budget-test'
    return Promise.resolve(true)
  },
}))

// 只覆盖 measureStagedBytes(b 用例注入超档读数);其余判据与常量保持生产真身
vi.mock('../src/services/upload-integrity.js', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    measureStagedBytes: (chunksRoot?: string) =>
      testState.stagedBytesOverride ?? (
        actual.measureStagedBytes as (chunksRoot?: string) => number
      )(chunksRoot),
  }
})

import {
  PROTOCOL_UPLOAD_LIMITS,
  clampUploadLimit,
  isPerUserSessionBudgetExceeded,
  wouldStagedBudgetOverflow,
  measureStagedBytes,
} from '../src/services/upload-integrity.js'

let server: FastifyInstance

beforeAll(async () => {
  const mod = await import('../src/routes/chunked-upload.js')
  server = Fastify()
  await server.register(mod.chunkedUploadRoutes)
  await server.ready()
})

afterAll(async () => {
  await server?.close()
  rmSync(testState.uploadRoot, { recursive: true, force: true })
})

function fakeSessionRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uploadId: randomUUID(),
    userId: 'user-budget-test',
    status: 'uploading',
    totalChunks: 3,
    uploadedChunks: 0,
    fileName: 'a.bin',
    fileSize: 100,
    ...overrides,
  }
}

describe('begin 处·单用户活跃会话预算(a)', () => {
  it('活跃会话已达档位 → 429,且不建行不建目录', async () => {
    testState.selectResult = [1, 2, 3, 4, 5].map(() => fakeSessionRow())
    testState.insertedRows.length = 0
    const res = await server.inject({
      method: 'POST',
      url: '/chunked-upload/init',
      payload: { fileName: 'a.bin', fileSize: 100, totalChunks: 1, chunkSize: 1024 },
    })
    expect(res.statusCode).toBe(429)
    expect(testState.insertedRows.length).toBe(0)
    expect(existsSync(testState.chunksRoot)).toBe(false)
  })

  it('低于档位照常放行(不误伤正常用户)', async () => {
    testState.selectResult = [1, 2, 3, 4].map(() => fakeSessionRow())
    const res = await server.inject({
      method: 'POST',
      url: '/chunked-upload/init',
      payload: { fileName: 'a.bin', fileSize: 100, totalChunks: 1, chunkSize: 1024 },
    })
    expect(res.statusCode).toBe(201)
    expect(testState.insertedRows.length).toBe(1)
  })
})

describe('每片落盘处·全局暂存字节预算(b)', () => {
  it('暂存将超预算 → 429 拒新片,既有会话不被清(零 delete/零状态变更)', async () => {
    const session = fakeSessionRow()
    testState.selectResult = [session]
    testState.updatedSets.length = 0
    // 预算 2GiB,存量已到 2GiB - 1KiB,再收 2KiB 就超
    testState.stagedBytesOverride = PROTOCOL_UPLOAD_LIMITS.maxStagedBytesGlobal - 1024
    const res = await server.inject({
      method: 'POST',
      url: '/chunked-upload/upload',
      headers: {
        'content-type': 'application/octet-stream',
        'x-upload-id': String(session.uploadId),
        'x-chunk-number': '1',
      },
      payload: Buffer.alloc(2048, 7),
    })
    testState.stagedBytesOverride = null
    expect(res.statusCode).toBe(429)
    // 既有会话不被清:进度 update 没发生,更没有任何"清存量"动作
    expect(testState.updatedSets.length).toBe(0)
  })

  it('预算未超照常收片(不误伤)', async () => {
    const session = fakeSessionRow()
    testState.selectResult = [session]
    testState.updatedSets.length = 0
    testState.stagedBytesOverride = 1024
    mkdirSync(testState.chunksRoot, { recursive: true })
    const res = await server.inject({
      method: 'POST',
      url: '/chunked-upload/upload',
      headers: {
        'content-type': 'application/octet-stream',
        'x-upload-id': String(session.uploadId),
        'x-chunk-number': '1',
      },
      payload: Buffer.alloc(2048, 7),
    })
    testState.stagedBytesOverride = null
    expect(res.statusCode).toBe(200)
    expect(testState.updatedSets.length).toBe(1)
  })
})

describe('钳制器 clampUploadLimit(c/d)', () => {
  it('c) 传 512MiB 仍被钳回协议档(只可收紧,不可放宽)', () => {
    expect(clampUploadLimit('maxChunkBytes', 512 * 1024 * 1024)).toBe(
      PROTOCOL_UPLOAD_LIMITS.maxChunkBytes,
    )
    // 收紧方向放行
    expect(clampUploadLimit('maxChunkBytes', 4096)).toBe(4096)
    expect(clampUploadLimit('maxActiveSessionsPerUser', 3)).toBe(3)
  })

  it('d) 传 0/NaN/负数/Infinity 必抛', () => {
    for (const bad of [0, Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(() => clampUploadLimit('maxChunkBytes', bad)).toThrow()
    }
  })
})

describe('纯判据与实测度量', () => {
  it('isPerUserSessionBudgetExceeded:达到档位即超(=limit 拒),留一档余量给在途', () => {
    expect(isPerUserSessionBudgetExceeded(PROTOCOL_UPLOAD_LIMITS.maxActiveSessionsPerUser)).toBe(true)
    expect(isPerUserSessionBudgetExceeded(PROTOCOL_UPLOAD_LIMITS.maxActiveSessionsPerUser - 1)).toBe(false)
  })

  it('wouldStagedBudgetOverflow:恰好到顶不超,再进 1 字节即超', () => {
    const budget = 1000
    expect(wouldStagedBudgetOverflow(600, 400, budget)).toBe(false)
    expect(wouldStagedBudgetOverflow(600, 401, budget)).toBe(true)
  })

  it('measureStagedBytes 只认 <uuid>/<n>.part,杂目录与杂文件不计入', () => {
    const root = mkdtempSync(join(tmpdir(), 'measure-'))
    try {
      const id = randomUUID()
      const dir = join(root, id)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, '1.part'), Buffer.alloc(100))
      writeFileSync(join(dir, '2.part'), Buffer.alloc(50))
      writeFileSync(join(dir, 'junk.txt'), Buffer.alloc(500))
      mkdirSync(join(root, 'not-a-uuid'), { recursive: true })
      writeFileSync(join(root, 'not-a-uuid', '3.part'), Buffer.alloc(999))
      expect(measureStagedBytes(root)).toBe(150)
      expect(existsSync(join(root, id))).toBe(true)
      expect(readdirSync(dir).length).toBe(3)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
