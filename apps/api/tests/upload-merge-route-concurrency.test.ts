// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 合并并发闸 · 路由级真并发回归(任务书 ①②④ 的"不是读常量"那一半)
//
// 与 upload-merge-gate.test.ts 的分工:那份测闸本身(工厂级,注入时钟/台账);这份从
// **真实 HTTP 处理器**驱动 4 枚并发 merge,并发计数取自带入 mock 的 `hashFile` 入口
// —— 即"合并磁盘段真的进到几路"由被审代码自己的调用序列报出,与闸的自述计数无关。
// 磁盘护栏一并复核:成功合并后**恰好**删掉该会话的 <chunks>/<uploadId>/,未动的目录
// 原样在位(判据是"恰 N 份",不是"≥1 份" —— §15/§26 整片删同族)。
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
// 仅类型引用(给 vi.mock 工厂的 importOriginal 泛型用);运行时上面那行 mock 才生效。
import type * as UploadIntegrity from '../src/services/upload-integrity.js'

const BOOT = vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  // 独立临时根(不是生产 uploads/);afterAll 整根删除的只可能是这个自造目录。
  const dir = `${process.env.TEMP || process.env.TMP || '/tmp'}/ihui-merge-gate-route-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  process.env.UPLOAD_DIR = dir
  const tracker = {
    live: 0,
    peak: 0,
    /** 进入(且未离开)合并段 hashFile 的调用序列 —— 并发计数的独立来源。 */
    entries: [] as string[],
    /** hold=true 时 hashFile 挂起,让测试亲手控制"几路在段内"。 */
    hold: false,
    resolvers: [] as Array<() => void>,
  }
  const rows: unknown[] = []
  return { dir, tracker, rows }
})

vi.mock('../src/services/upload-integrity.js', async (importOriginal) => {
  const mod = await importOriginal<typeof UploadIntegrity>()
  const realHash = mod.hashFile
  return {
    ...mod,
    hashFile: async (p: string) => {
      const t = BOOT.tracker
      t.live += 1
      if (t.live > t.peak) t.peak = t.live
      t.entries.push(p)
      if (t.hold) await new Promise<void>((r) => t.resolvers.push(r))
      try {
        return await realHash(p)
      } finally {
        t.live -= 1
      }
    },
  }
})

vi.mock('@ihui/auth', () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({
    userId: 'mock-user-id',
    phone: '13800000000',
    familyId: '11111111-1111-4111-8111-111111111111',
    roleId: 1,
  }),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))
vi.mock('jose', () => ({ decodeJwt: vi.fn(() => ({ type: 'access' })) }))

vi.mock('../src/db/index.js', () => {
  interface DbChain {
    then: (resolve: (value: unknown[]) => unknown) => Promise<unknown>
    from: () => DbChain
    where: () => DbChain
    limit: () => DbChain
    values: () => DbChain
    set: () => DbChain
    returning: () => DbChain
  }
  function createChain(result: unknown[] = []): DbChain {
    const chain: DbChain = {
      then: (resolve) => Promise.resolve(result).then(resolve),
      from: () => chain,
      where: () => chain,
      limit: () => chain,
      values: () => chain,
      set: () => chain,
      returning: () => chain,
    }
    return chain
  }
  return {
    db: {
      execute: vi.fn().mockResolvedValue([]),
      // merge 处理器只读一行会话;给一份定长 fixture(所有 uploadId 共用同值字段),
      // 会话行的 uploadId 列本来就不参与磁盘路径(路径取自请求体)。
      select: vi.fn(() => createChain(BOOT.rows)),
      insert: vi.fn(() => createChain()),
      update: vi.fn(() => createChain()),
      delete: vi.fn(() => createChain()),
    },
  }
})

import { chunkedUploadRoutes } from '../src/routes/chunked-upload.js'
import {
  UPLOAD_MERGE_ENV_KEY,
  getUploadMergeGateFacts,
  resetUploadMergeGateForTests,
} from '../src/services/upload-merge-gate.js'
import { PROTOCOL_UPLOAD_LIMITS } from '../src/services/upload-integrity.js'

const AUTH_HEADERS = { authorization: 'Bearer mock-access-token' }
const PART_A = Buffer.from('ihui-merge-gate-part-A-'.repeat(200))
const PART_B = Buffer.from('ihui-merge-gate-part-B-'.repeat(200))
/** 会话 fixture:2 片,声明 md5 = 两片实算拼接值(成功路径,校验必过)。 */
const SESSION = {
  uploadId: 'fixture-row-uploadId',
  status: 'uploading',
  totalChunks: 2,
  fileMd5: createHash('md5').update(Buffer.concat([PART_A, PART_B])).digest('hex'),
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
async function waitFor(pred: () => boolean, what: string, ms = 4000) {
  const t0 = Date.now()
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error(`waitFor 超时:${what}`)
    await delay(10)
  }
}
function makeUpload(): string {
  const uploadId = randomUUID()
  const dir = join(BOOT.dir, 'chunks', uploadId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '1.part'), PART_A)
  writeFileSync(join(dir, '2.part'), PART_B)
  return uploadId
}
function resetTracker(hold: boolean) {
  BOOT.tracker.live = 0
  BOOT.tracker.peak = 0
  BOOT.tracker.entries.length = 0
  BOOT.tracker.resolvers.length = 0
  BOOT.tracker.hold = hold
}
function mergeRequest(uploadId: string) {
  return appInject({
    method: 'POST',
    url: '/api/chunked-upload/merge',
    headers: AUTH_HEADERS,
    body: { uploadId },
  })
}

let app: FastifyInstance
let appInject: FastifyInstance['inject']

beforeAll(async () => {
  app = Fastify({ logger: false })
  await app.register(chunkedUploadRoutes, { prefix: '/api' })
  await app.ready()
  appInject = app.inject.bind(app)
  BOOT.rows.push(SESSION)
})

afterAll(async () => {
  await app.close()
  rmSync(BOOT.dir, { recursive: true, force: true })
})

describe('路由级:merge 段真并发过闸(app.inject 并发驱动,计数来自被 mock 的 hashFile 入口)', () => {
  it('A. 默认上限下 4 路并发 merge:段内并发从不超过默认档;第 3、4 路排队后全部 200', async () => {
    delete process.env[UPLOAD_MERGE_ENV_KEY]
    resetUploadMergeGateForTests()
    resetTracker(true)
    const limit = PROTOCOL_UPLOAD_LIMITS.maxConcurrentUploads
    expect(limit).toBe(2) // 默认档现值(不是把断言写死成别处看不见的数)

    const ids = [makeUpload(), makeUpload(), makeUpload(), makeUpload()]
    // 阳性对照前置:先证明确有 4 枚独立目录、各**恰 2 份**分片在位。
    for (const id of ids) {
      expect(readdirSync(join(BOOT.dir, 'chunks', id)).sort()).toEqual(['1.part', '2.part'])
    }

    const settled: number[] = []
    const ps = ids.map((id) =>
      mergeRequest(id).then((r) => {
        settled.push(r.statusCode)
        return r
      }),
    )

    // 前 2 路进入磁盘段(挂在受控的 hashFile 里),第 3、4 路必须在队列里等:
    await waitFor(() => BOOT.tracker.entries.length === limit, '两路进入合并段')
    await delay(80)
    expect(BOOT.tracker.entries.length).toBe(limit) // 第 3 路没进段
    expect(settled.length).toBe(0) // ② 也没任何一枚因"超限"提前返回

    // 放一路 ⇒ 队列头部顶上,段内并发仍是 limit(不是 limit+1)
    BOOT.tracker.resolvers.shift()!()
    await waitFor(() => BOOT.tracker.entries.length === limit + 1, '排队者补位进入合并段')
    expect(BOOT.tracker.live).toBeLessThanOrEqual(limit)

    // 全放:剩余在飞的先放行,等第 4 路进段后再放它自己那一次 hashFile。
    while (BOOT.tracker.resolvers.length) BOOT.tracker.resolvers.shift()!()
    await waitFor(() => BOOT.tracker.entries.length === 4, '第四路进入合并段')
    while (BOOT.tracker.resolvers.length) BOOT.tracker.resolvers.shift()!()

    const res = await Promise.all(ps)
    expect(res.map((r) => r.statusCode)).toEqual([200, 200, 200, 200])
    for (const r of res) {
      const body = r.json()
      expect(body.code).toBe(0)
      expect(body.data.url).toContain('/uploads/')
    }
    // ① 的核心读数:并发峰值取自被审代码自己的调用序列,从任务开始到结束未越过上限。
    expect(BOOT.tracker.peak).toBe(limit)

    // 台账:确有 2 次排队,且等待时长被记成事实(不是只有布尔"成功")。
    const f = getUploadMergeGateFacts()
    expect(f.queuedTotal).toBe(2)
    expect(f.admittedTotal).toBe(4)
    expect(f.maxWaitMs).toBeGreaterThan(0)
    expect(f.peakActive).toBe(limit)
    expect(f.effectiveLimit).toBe(limit)
    expect(f.limitSource).toBe('default')

    // 磁盘护栏:成功合并把**恰该会话**的 <chunks>/<uploadId>/ 删净;
    // 对照目录(另一枚未合并的会话)原样在位 —— "恰 N 份"两侧都对账。
    for (const id of ids) expect(existsSync(join(BOOT.dir, 'chunks', id))).toBe(false)
    const bystander = makeUpload()
    expect(readdirSync(join(BOOT.dir, 'chunks', bystander))).toHaveLength(2)
    BOOT.tracker.hold = false // 必须先解除挂起,再发请求(否则 bystander 自己会卡住)
    const res5 = await mergeRequest(bystander)
    await waitFor(() => !existsSync(join(BOOT.dir, 'chunks', bystander)), 'bystander 合并完成')
    expect(res5.statusCode).toBe(200)
  })

  it('B. env=1 覆盖:生效值随事实报出,且真的串行化(段内并发从不超过 1)', async () => {
    process.env[UPLOAD_MERGE_ENV_KEY] = '1'
    resetUploadMergeGateForTests()
    resetTracker(true)

    const id1 = makeUpload()
    const id2 = makeUpload()
    const p1 = mergeRequest(id1)
    const p2 = mergeRequest(id2)

    await waitFor(() => BOOT.tracker.entries.length === 1, '第一路进入合并段')
    await delay(80)
    expect(BOOT.tracker.entries.length).toBe(1) // 第二路在等,不是被拒
    BOOT.tracker.resolvers.shift()!()
    await waitFor(() => BOOT.tracker.entries.length === 2, '第二路补位')
    BOOT.tracker.resolvers.shift()!()

    const [r1, r2] = await Promise.all([p1, p2])
    expect([r1.statusCode, r2.statusCode]).toEqual([200, 200])
    expect(BOOT.tracker.peak).toBe(1)

    // ④ 覆盖生效 ⇒ 事实出口必须说得出"现在限 1,来源是 env,原始值是 '1'"。
    const f = getUploadMergeGateFacts()
    expect(f).toMatchObject({
      effectiveLimit: 1,
      limitSource: 'env',
      envRaw: '1',
      queuedTotal: 1,
      peakActive: 1,
    })

    delete process.env[UPLOAD_MERGE_ENV_KEY]
    resetUploadMergeGateForTests()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
