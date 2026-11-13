// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-380 回归锁(2026-11-13)。
 *
 * 病灶:POST /api/chunked-upload/merge 不校验会话状态 —— completed/cancelled 会话可被
 * 反复合并:无前置判断直接置 merging 再置 completed,每次多产出一份 uploads/public
 * 文件(配额重复计),已取消上传也能被「复活」。
 *
 * 本文件锁:
 *   ① uploading:条件迁移 uploading→merging 命中,正常合并并返回公开 url;
 *   ② completed:409,且**不进合并段**(不产生成品文件、分片目录原样);
 *   ③ cancelled:同上 409;
 *   ④ merging(并发的后到者):同样 409。
 *
 * 只 mock checkAuth / db,不连真实 PG;磁盘用独立临时 UPLOAD_DIR。
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const BOOT = vi.hoisted(() => {
  // 独立临时根(不是生产 uploads/);afterAll 整根删除的只可能是这个自造目录。
  // UPLOAD_DIR 必须在路由模块求值前就位(chunked-upload.ts 顶层即读取)。
  const dir = `${process.env.TEMP || process.env.TMP || '/tmp'}/ihui-f380-merge-status-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  process.env.UPLOAD_DIR = dir
  return {
    dir,
    state: {
      /** 当前会话行(fixture);每个用例自己设定。 */
      row: null as Record<string, unknown> | null,
      /** 记录每次 update 的 SET 与条件更新是否命中。 */
      updates: [] as Array<{ set: Record<string, unknown>; claimed: boolean }>,
    },
  }
})

vi.mock('../src/plugins/auth.js', () => ({
  checkAuth: async (request: { userId?: string }) => {
    request.userId = 'f380-user'
    return true
  },
}))

// 桩替身模拟 drizzle 查询链:select 返回当前 fixture;update 的 returning() 按
// 「仅 status='uploading' 才可从 uploading 迁到 merging」这一 SQL 条件语义给出命中行。
vi.mock('../src/db/index.js', () => {
  interface DbChain {
    from: () => DbChain
    where: () => DbChain
    limit: () => DbChain
    set: (values: Record<string, unknown>) => DbChain
    returning: () => Promise<unknown[]>
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
  }

  const state = BOOT.state

  function readChain(result: unknown[]): DbChain {
    const chain = {} as DbChain
    chain.from = () => chain
    chain.where = () => chain
    chain.limit = () => chain
    chain.set = () => chain
    chain.returning = () => Promise.resolve(result)
    chain.then = (resolve) => Promise.resolve(result).then(resolve)
    return chain
  }

  return {
    db: {
      select: vi.fn(() => readChain(state.row ? [state.row] : [])),
      insert: vi.fn(() => readChain([])),
      delete: vi.fn(() => readChain([])),
      update: vi.fn(() => {
        let setValues: Record<string, unknown> = {}
        const chain = {} as DbChain
        chain.set = (values) => {
          setValues = values
          return chain
        }
        chain.where = () => chain
        chain.returning = () => {
          const row = state.row
          const claimed = Boolean(
            row && setValues.status === 'merging' && row.status === 'uploading',
          )
          if (claimed && row) row.status = 'merging'
          state.updates.push({ set: setValues, claimed })
          return Promise.resolve(claimed && row ? [{ uploadId: row.uploadId }] : [])
        }
        chain.then = (resolve) => {
          if (state.row && setValues.status === 'completed' && state.row.status === 'merging') {
            state.row.status = 'completed'
          }
          state.updates.push({ set: setValues, claimed: false })
          return Promise.resolve([]).then(resolve)
        }
        return chain
      }),
    },
  }
})

import { chunkedUploadRoutes } from '../src/routes/chunked-upload.js'

const UPLOAD_ID = 'f380-fixture-upload'
// PNG 魔数取自 file-type-validator.ts(合并段末尾的内容类型闸要求文件头与扩展名一致)。
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PART = Buffer.concat([PNG_MAGIC, Buffer.from('f380-chunked-merge-status-'.repeat(40))])

function setSession(status: string): void {
  BOOT.state.row = {
    uploadId: UPLOAD_ID,
    userId: 'f380-user',
    status,
    totalChunks: 1,
    fileName: 'f380.png',
    mimeType: 'image/png',
    fileMd5: createHash('md5').update(PART).digest('hex'),
  }
}

/** 造「分片已收齐」的目录:让 completed/cancelled 的拒绝不可能被解释成「缺片」。 */
function writeChunkDir(): string {
  const dir = join(BOOT.dir, 'chunks', UPLOAD_ID)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '1.part'), PART)
  return dir
}

function publicFiles(): string[] {
  const dir = join(BOOT.dir, 'public')
  return existsSync(dir) ? readdirSync(dir) : []
}

let app: FastifyInstance

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(chunkedUploadRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
  rmSync(BOOT.dir, { recursive: true, force: true })
})

beforeEach(() => {
  BOOT.state.row = null
  BOOT.state.updates.length = 0
  rmSync(join(BOOT.dir, 'chunks'), { recursive: true, force: true })
  rmSync(join(BOOT.dir, 'public'), { recursive: true, force: true })
})

const merge = () =>
  app.inject({
    method: 'POST',
    url: '/api/chunked-upload/merge',
    headers: { authorization: 'Bearer mock-access-token' },
    body: { uploadId: UPLOAD_ID },
  })

describe('F-380 merge 入口只允许 uploading 会话进入合并', () => {
  it('uploading:条件迁移命中,正常合并并返回公开 url', async () => {
    setSession('uploading')
    const chunkDir = writeChunkDir()

    const res = await merge()
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.code).toBe(0)
    expect(body.data.url).toContain('/uploads/')

    // 合并真的发生了:产出恰一份成品,分片目录被清。
    expect(publicFiles()).toHaveLength(1)
    expect(existsSync(chunkDir)).toBe(false)
    const claim = BOOT.state.updates.find((u) => u.set.status === 'merging')
    expect(claim?.claimed).toBe(true)
  })

  it.each(['completed', 'cancelled', 'merging'])(
    '%s:409,不进入合并段(不写盘、不产成品、分片目录原样)',
    async (status) => {
      setSession(status)
      const chunkDir = writeChunkDir()
      const before = readdirSync(chunkDir).sort()

      const res = await merge()
      expect(res.statusCode).toBe(409)
      expect(res.json().code).toBe(409)

      // 「不得进入实际合并与后续写盘」的三条独立读数。
      expect(publicFiles()).toEqual([])
      expect(existsSync(chunkDir)).toBe(true)
      expect(readdirSync(chunkDir).sort()).toEqual(before)
      // 也没有发生 uploading→merging 的条件迁移。
      expect(BOOT.state.updates.filter((u) => u.set.status === 'merging')).toHaveLength(0)
    },
  )
})
