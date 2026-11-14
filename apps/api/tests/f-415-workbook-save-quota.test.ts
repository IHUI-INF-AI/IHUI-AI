// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-415 回归锁(2026-11-13)。
 *
 * 病灶(修复前):`POST /api/workbook/save` 每次都 `generateFileId` + `saveFile` 新写一份,
 * `savedFileIds` 只 push 不删、无配额、无 TTL ⇒ 同一 handle 反复保存即可无限复制大工作簿占满磁盘。
 *
 * 本文件锁五条:
 *  ① 多次保存只保留**最新**一份输出(旧槽位文件被删),且新档内容是最新改动;
 *  ② 会话内保存次数超 `MAX_SAVES_PER_SESSION` ⇒ `WORKBOOK_SAVE_LIMIT_EXCEEDED`,盘上零新增;
 *  ③ 会话累计写出字节超 `MAX_SAVED_BYTES_PER_SESSION` ⇒ `WORKBOOK_SAVE_BYTES_EXCEEDED`,零新增;
 *  ④ 落盘失败(桩在写半截后抛错)⇒ 半成品被清理,盘上零残留、槽位不被推进;
 *  ⑤ TTL 到期清理会话时一并回收其保存产物,未过期会话的产物不受牵连。
 *
 * 另钉路由错误码映射:次数超限 429、字节超限 413。
 *
 * 测试隔离:storage-service 用临时目录(os.tmpdir)上的桩实现,不连 PG/Redis、不落仓库树;
 * 鉴权层 mock;exceljs 真跑(生成的 xlsx 交给桩保存)。
 */
import { existsSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// 夹具目录必须在任何 import 之前定址(storage 桩在模块工厂里就要用到它)。
const fixtureRoot = await vi.hoisted(async () => {
  const fs = await import('node:fs')
  const os = await import('node:os')
  const path = await import('node:path')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-f415-'))
  fs.mkdirSync(path.join(root, 'uploads'), { recursive: true })
  return root
})

/** 桩的可控开关:下一次 saveFile 先写半截再抛错(模拟磁盘中途失败)。 */
const ctl = vi.hoisted(() => ({ failNextSave: false, seq: 0 }))
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

// storage-service:临时目录上的最小实现(readFileAsync 缺席 ⇒ 服务层走同步 readFile)。
vi.mock('../src/services/storage-service.js', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const uploads = path.join(fixtureRoot, 'uploads')
  const dataPath = (id: string) => path.join(uploads, id)
  const metaPath = (id: string) => `${dataPath(id)}.meta`
  return {
    generateFileId: () => `f415-${Date.now()}-${++ctl.seq}`,
    getFileInfo: (id: string) => {
      const p = dataPath(id)
      if (!fs.existsSync(p)) return null
      const stat = fs.statSync(p)
      let metadata: Record<string, unknown> | undefined
      if (fs.existsSync(metaPath(id))) {
        try {
          metadata = JSON.parse(fs.readFileSync(metaPath(id), 'utf-8')) as Record<string, unknown>
        } catch {
          metadata = undefined
        }
      }
      return {
        id,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString(),
        metadata,
      }
    },
    readFile: (id: string) => (fs.existsSync(dataPath(id)) ? fs.readFileSync(dataPath(id)) : null),
    saveFile: (content: Buffer, id: string, metadata?: Record<string, unknown>) => {
      if (ctl.failNextSave) {
        ctl.failNextSave = false
        // 半成品:真的落了一截再失败,验证调用方会把它清掉
        fs.writeFileSync(dataPath(id), content.subarray(0, 1))
        throw new Error('stub disk failure')
      }
      fs.writeFileSync(dataPath(id), content)
      if (metadata) fs.writeFileSync(metaPath(id), JSON.stringify(metadata))
      return { id, size: content.length, path: dataPath(id) }
    },
    deleteFile: (id: string) => {
      let deleted = false
      if (fs.existsSync(dataPath(id))) {
        fs.unlinkSync(dataPath(id))
        deleted = true
      }
      if (fs.existsSync(metaPath(id))) fs.unlinkSync(metaPath(id))
      return deleted
    },
  }
})

import { readFile, saveFile } from '../src/services/storage-service.js'
import {
  MAX_SAVED_BYTES_PER_SESSION,
  MAX_SAVES_PER_SESSION,
  __test__,
  openWorkbook,
  resetWorkbookSessions,
  saveWorkbook,
  sweepExpiredWorkbookSessions,
  writeCells,
} from '../src/services/workbook-service.js'
import { workbookRoutes } from '../src/routes/workbook.js'

const USER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const SOURCE_ID = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'
const SHEET = 'F415'

type SessionRow = NonNullable<ReturnType<typeof __test__.sessions.get>>

function sessionOf(handle: string): SessionRow {
  const s = __test__.sessions.get(handle)
  if (!s) throw new Error(`会话不存在: ${handle}`)
  return s
}

async function makeXlsx(value: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet(SHEET).getCell('A1').value = value
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** 上传目录里的真实文件(不含 .meta)。 */
function filesInUploads(): string[] {
  return readdirSync(join(fixtureRoot, 'uploads'))
    .filter((name) => !name.endsWith('.meta'))
    .sort()
}

/** 保存产物 = 上传目录里除原档之外的文件。 */
function savedOutputs(): string[] {
  return filesInUploads().filter((id) => id !== SOURCE_ID)
}

async function openSession(): Promise<string> {
  const res = await openWorkbook({ subjectId: USER, fileId: SOURCE_ID })
  if (!res.ok) throw new Error(`open 失败: ${res.errorCode} ${res.message}`)
  return res.data.handle
}

async function saveOnce(handle: string, value?: number): Promise<string> {
  if (value !== undefined) {
    const w = writeCells({
      subjectId: USER,
      handle,
      sheet: SHEET,
      cells: [{ address: 'A1', value }],
    })
    if (!w.ok) throw new Error(`write 失败: ${w.errorCode} ${w.message}`)
  }
  const r = await saveWorkbook({ subjectId: USER, handle })
  if (!r.ok) throw new Error(`save 失败: ${r.errorCode} ${r.message}`)
  return r.data.savedFileId
}

async function loadSaved(fileId: string): Promise<ExcelJS.Workbook> {
  const bytes = readFile(fileId)
  if (!bytes) throw new Error(`输出文件读不到: ${fileId}`)
  const wb = new ExcelJS.Workbook()
  await (wb.xlsx as unknown as { load: (d: Uint8Array) => Promise<ExcelJS.Workbook> }).load(
    new Uint8Array(bytes),
  )
  return wb
}

let app: FastifyInstance

beforeAll(async () => {
  saveFile(await makeXlsx(1), SOURCE_ID, {
    kind: 'ihui-workbook',
    ownerId: USER,
    name: 'source.xlsx',
  })

  app = Fastify({ logger: false })
  app.setErrorHandler((err, _req, reply) => {
    const e = err as Error & { statusCode?: number; errorCode?: string }
    const status = e.statusCode && e.statusCode >= 400 ? e.statusCode : 500
    reply.status(status).send({ code: status, message: e.message, errorCode: e.errorCode })
  })
  await app.register(workbookRoutes, { prefix: '/api/workbook' })
  await app.ready()
})

afterEach(() => {
  resetWorkbookSessions()
  ctl.failNextSave = false
  mockAuthState.userId = null
  // 清掉本用例留下的输出(含 .meta),下一条用例从"只有原档"开始
  const sourceFiles = new Set([SOURCE_ID, `${SOURCE_ID}.meta`])
  for (const name of readdirSync(join(fixtureRoot, 'uploads'))) {
    if (sourceFiles.has(name)) continue
    unlinkSync(join(fixtureRoot, 'uploads', name))
  }
})

afterAll(async () => {
  await app.close()
})

describe('F-415 workbook /save 的配额与生命周期', () => {
  it('① 多次保存只保留最新版:旧输出被删,内容为最后一次改动', async () => {
    const handle = await openSession()

    const first = await saveOnce(handle, 11)
    expect(savedOutputs()).toEqual([first])

    const second = await saveOnce(handle, 22)
    expect(second).not.toBe(first)
    // 旧槽位文件已删,盘上只有源档 + 最新输出
    expect(existsSync(join(fixtureRoot, 'uploads', first))).toBe(false)
    expect(savedOutputs()).toEqual([second])

    const third = await saveOnce(handle, 33)
    expect(existsSync(join(fixtureRoot, 'uploads', second))).toBe(false)
    expect(savedOutputs()).toEqual([third])
    expect(filesInUploads()).toHaveLength(2)

    const reloaded = await loadSaved(third)
    expect(reloaded.getWorksheet(SHEET)?.getCell('A1').value).toBe(33)

    const s = sessionOf(handle)
    expect(s.savedFileIds).toEqual([third])
    expect(s.saveCount).toBe(3)
  })

  it('② 保存次数超限 ⇒ WORKBOOK_SAVE_LIMIT_EXCEEDED,盘上零新增', async () => {
    const handle = await openSession()
    let last = ''
    for (let i = 0; i < MAX_SAVES_PER_SESSION; i++) last = await saveOnce(handle)

    const before = filesInUploads()
    const over = await saveWorkbook({ subjectId: USER, handle })
    expect(over.ok).toBe(false)
    if (over.ok) return
    expect(over.errorCode).toBe('WORKBOOK_SAVE_LIMIT_EXCEEDED')
    expect(filesInUploads()).toEqual(before)
    expect(savedOutputs()).toEqual([last])
    expect(sessionOf(handle).saveCount).toBe(MAX_SAVES_PER_SESSION)
  })

  it('③ 累计字节超限 ⇒ WORKBOOK_SAVE_BYTES_EXCEEDED,落盘前拒', async () => {
    const before = filesInUploads()

    // 已达上限:入口就拒
    const h1 = await openSession()
    sessionOf(h1).savedBytes = MAX_SAVED_BYTES_PER_SESSION
    const r1 = await saveWorkbook({ subjectId: USER, handle: h1 })
    expect(r1.ok).toBe(false)
    if (r1.ok) return
    expect(r1.errorCode).toBe('WORKBOOK_SAVE_BYTES_EXCEEDED')

    // 剩余额度不足以容纳本次写出:序列化后、落盘前拒
    const h2 = await openSession()
    sessionOf(h2).savedBytes = MAX_SAVED_BYTES_PER_SESSION - 1
    const r2 = await saveWorkbook({ subjectId: USER, handle: h2 })
    expect(r2.ok).toBe(false)
    if (r2.ok) return
    expect(r2.errorCode).toBe('WORKBOOK_SAVE_BYTES_EXCEEDED')

    expect(filesInUploads()).toEqual(before)
    expect(sessionOf(h1).saveCount).toBe(0)
    expect(sessionOf(h2).saveCount).toBe(0)
  })

  it('④ 落盘失败 ⇒ 半成品被清理,盘上零残留、槽位不推进', async () => {
    const handle = await openSession()
    const kept = await saveOnce(handle)
    const before = filesInUploads()

    ctl.failNextSave = true
    const failed = await saveWorkbook({ subjectId: USER, handle })
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.errorCode).toBe('WORKBOOK_UNJUDGED')

    // 半成品已删;上一版输出仍在(失败不先毁旧版)
    expect(filesInUploads()).toEqual(before)
    expect(savedOutputs()).toEqual([kept])
    const s = sessionOf(handle)
    expect(s.savedSlotFileId).toBe(kept)
    expect(s.saveCount).toBe(1)
  })

  it('⑤ TTL 到期清理会话时一并回收保存产物', async () => {
    const staleHandle = await openSession()
    const staleOut = await saveOnce(staleHandle, 5)

    const freshHandle = await openSession()
    const freshOut = await saveOnce(freshHandle, 6)

    sessionOf(staleHandle).lastUsedAt = Date.now() - __test__.SESSION_IDLE_TTL_MS - 1000
    expect(sweepExpiredWorkbookSessions()).toBe(1)

    expect(existsSync(join(fixtureRoot, 'uploads', staleOut))).toBe(false)
    expect(existsSync(join(fixtureRoot, 'uploads', freshOut))).toBe(true)
    expect(__test__.sessions.has(staleHandle)).toBe(false)
    expect(__test__.sessions.has(freshHandle)).toBe(true)
  })
})

describe('F-415 workbook 路由 · /save 超限的状态码', () => {
  it('次数超限 ⇒ 429 WORKBOOK_SAVE_LIMIT_EXCEEDED', async () => {
    const handle = await openSession()
    sessionOf(handle).saveCount = MAX_SAVES_PER_SESSION
    mockAuthState.userId = USER

    const res = await app.inject({ method: 'POST', url: '/api/workbook/save', payload: { handle } })
    expect(res.statusCode).toBe(429)
    expect((res.json() as { errorCode?: string }).errorCode).toBe('WORKBOOK_SAVE_LIMIT_EXCEEDED')
  })

  it('累计字节超限 ⇒ 413 WORKBOOK_SAVE_BYTES_EXCEEDED', async () => {
    const handle = await openSession()
    sessionOf(handle).savedBytes = MAX_SAVED_BYTES_PER_SESSION
    mockAuthState.userId = USER

    const res = await app.inject({ method: 'POST', url: '/api/workbook/save', payload: { handle } })
    expect(res.statusCode).toBe(413)
    expect((res.json() as { errorCode?: string }).errorCode).toBe('WORKBOOK_SAVE_BYTES_EXCEEDED')
  })
})
