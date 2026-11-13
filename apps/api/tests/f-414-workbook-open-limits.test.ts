// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-414 回归锁(2026-11-13)。
 *
 * 病灶(修复前):POST /api/workbook/open 对已存在文件无大小/扩展名闸,同步整文件读入并
 * 全量建模;会话表是全局 64 条按 lastUsedAt 的 FIFO ⇒ 单个用户循环 open 就能把别人的
 * 未保存会话挤出表(对方再拿句柄只读到「未判定」410,改动丢失)。
 *
 * 本文件锁四条:
 *  ① 超过 MAX_WORKBOOK_OPEN_BYTES(20MB)的档 ⇒ 413,且不建会话(不读字节、不建模);
 *  ② 扩展名不在白名单(仅 .xlsx/.xlsm)⇒ 415,且不建会话;
 *  ③ 单主体会话上限 MAX_SESSIONS_PER_SUBJECT:超限只逐出**自己**的最旧会话,他人会话照常可用;
 *  ④ TTL 空闲清理:过期会话被清出表,未过期会话不受牵连。
 *
 * 只桩鉴权;storage 走真实实现但目录重定向到 os.tmpdir() 夹具,不连 PG/Redis、不落仓库树。
 */
import { truncateSync } from 'node:fs'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// storage-service 在模块加载时就把 STORAGE_DIR 拍成常量 ⇒ 选址必须早于任何 import。
const fixtureRoot = await vi.hoisted(async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-f414-'))
  fs.mkdirSync(path.join(root, 'uploads'), { recursive: true })
  process.env.STORAGE_DIR = root
  return root
})

const mockAuthState = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('../src/plugins/auth.js', () => ({
  // 形状对齐真 checkAuthOrInternalService:验不过就自己把 401 发出去并返回 false
  checkAuthOrInternalService: vi.fn(async (request: unknown, reply: FastifyReply) => {
    if (!mockAuthState.userId) {
      await reply.status(401).send({ code: 401, message: '请先登录' })
      return false
    }
    ;(request as { userId?: string }).userId = mockAuthState.userId
    return true
  }),
}))

import { saveFile } from '../src/services/storage-service.js'
import {
  MAX_SESSIONS_PER_SUBJECT,
  MAX_WORKBOOK_OPEN_BYTES,
  __test__,
  resetWorkbookSessions,
  sweepExpiredWorkbookSessions,
} from '../src/services/workbook-service.js'
import { workbookRoutes } from '../src/routes/workbook.js'

const USER_A = '11111111-1111-4111-8111-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const SHEET = 'S'

/** 生成合法形态的 fileId(16-64 位 hex/dash)。 */
const fileIdOf = (tag: string): string =>
  `${tag.padEnd(8, '0')}-1111-4111-8111-${tag.padEnd(12, '0')}`

const BIG_ID = fileIdOf('b9')
const TXT_ID = fileIdOf('c1')

interface OpenBody {
  errorCode?: string
  data?: { handle?: string }
}

async function xlsxBytes(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(SHEET)
  ws.getCell('A1').value = 1
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function upload(fileId: string, ownerId: string, name: string, bytes: Buffer): void {
  saveFile(bytes, fileId, { kind: 'ihui-workbook', ownerId, name })
}

let app: FastifyInstance

async function call(
  path: 'open' | 'read',
  body: Record<string, unknown>,
): Promise<{ statusCode: number; body: OpenBody }> {
  const res = await app.inject({ method: 'POST', url: `/api/workbook/${path}`, payload: body })
  return { statusCode: res.statusCode, body: res.json() as OpenBody }
}

async function openAs(userId: string, fileId: string): Promise<{ statusCode: number; body: OpenBody }> {
  mockAuthState.userId = userId
  return call('open', { fileId })
}

async function openOk(userId: string, fileId: string): Promise<string> {
  const res = await openAs(userId, fileId)
  const handle = res.body.data?.handle
  expect(res.statusCode, JSON.stringify(res.body)).toBe(200)
  expect(handle).toMatch(/^[0-9a-f]{32}$/u)
  return handle as string
}

async function readAs(userId: string, handle: string): Promise<number> {
  mockAuthState.userId = userId
  const res = await call('read', { handle, sheet: SHEET, range: 'A1' })
  return res.statusCode
}

beforeAll(async () => {
  mockAuthState.userId = USER_A
  const bytes = await xlsxBytes()
  for (let i = 1; i <= 4; i++) upload(fileIdOf(`a${i}`), USER_A, `a${i}.xlsx`, bytes)
  for (let i = 1; i <= 4; i++) upload(fileIdOf(`b${i}`), USER_B, `b${i}.xlsx`, bytes)

  upload(BIG_ID, USER_A, 'big.xlsx', Buffer.alloc(0))
  // 稀疏文件:stat 尺寸越过 20MB 但不真的占盘(闸在读字节之前就拦下)
  truncateSync(join(fixtureRoot, 'uploads', BIG_ID), MAX_WORKBOOK_OPEN_BYTES + 1)

  // 内容本身是合法 xlsx,只是文件名扩展名不在白名单 ⇒ 必须由扩展名闸拒(而非解析失败)
  upload(TXT_ID, USER_A, 'notes.txt', bytes)

  mockAuthState.userId = null
  app = Fastify({ logger: false })
  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number }
    const status = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500
    reply.status(status).send({ code: status, message: e.message })
  })
  await app.register(workbookRoutes, { prefix: '/api/workbook' })
  await app.ready()
})

afterEach(() => {
  resetWorkbookSessions()
  mockAuthState.userId = USER_A
})

afterAll(async () => {
  await app.close()
})

describe('F-414 workbook /open 的大小闸、扩展名闸与会话配额', () => {
  it('① 超过 20MB 的档 ⇒ 413,且不建会话(不读字节、不建模)', async () => {
    const res = await openAs(USER_A, BIG_ID)
    expect(res.statusCode, JSON.stringify(res.body)).toBe(413)
    expect(res.body.errorCode).toBe('WORKBOOK_FILE_TOO_LARGE')
    expect(__test__.sessions.size).toBe(0)
  })

  it('② 扩展名不在白名单(.txt)⇒ 415,且不建会话', async () => {
    const res = await openAs(USER_A, TXT_ID)
    expect(res.statusCode).toBe(415)
    expect(res.body.errorCode).toBe('WORKBOOK_FORMAT_UNSUPPORTED')
    expect(__test__.sessions.size).toBe(0)
  })

  it('③ 单主体超限只逐出本主体最旧会话,他人会话照常可用', async () => {
    const aHandles: string[] = []
    for (const i of [1, 2, 3]) aHandles.push(await openOk(USER_A, fileIdOf(`a${i}`)))
    const bHandle = await openOk(USER_B, fileIdOf('b1'))

    const a4 = await openOk(USER_A, fileIdOf('a4'))
    expect(__test__.handlesBySubject.get(USER_A)?.size).toBe(MAX_SESSIONS_PER_SUBJECT)
    // A 自己的最旧会话被逐出 ⇒ 410(未判定)
    expect(await readAs(USER_A, aHandles[0] as string)).toBe(410)
    expect(await readAs(USER_A, a4)).toBe(200)
    // 全局 FIFO 修复前会把 B 的会话一起挤掉;现在 B 仍可用
    expect(await readAs(USER_B, bHandle)).toBe(200)

    // 反向再验一次:B 连开 4 个,只逐出 B 自己的最旧者,A 的 3 个不受影响
    for (const i of [2, 3, 4]) await openOk(USER_B, fileIdOf(`b${i}`))
    expect(__test__.handlesBySubject.get(USER_B)?.size).toBe(MAX_SESSIONS_PER_SUBJECT)
    expect(await readAs(USER_B, bHandle)).toBe(410)
    for (const h of aHandles.slice(1)) expect(await readAs(USER_A, h)).toBe(200)
    expect(await readAs(USER_A, a4)).toBe(200)
  })

  it('④ TTL 到期清理只清空闲超时会话', async () => {
    const stale = await openOk(USER_A, fileIdOf('a1'))
    const fresh = await openOk(USER_A, fileIdOf('a2'))

    const s = __test__.sessions.get(stale)
    expect(s).toBeTruthy()
    s!.lastUsedAt = Date.now() - __test__.SESSION_IDLE_TTL_MS - 1000

    expect(sweepExpiredWorkbookSessions()).toBe(1)
    expect(__test__.sessions.has(stale)).toBe(false)
    expect(__test__.sessions.has(fresh)).toBe(true)
    expect(__test__.handlesBySubject.get(USER_A)?.has(stale)).toBe(false)

    expect(await readAs(USER_A, stale)).toBe(410)
    expect(await readAs(USER_A, fresh)).toBe(200)
  })
})
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
