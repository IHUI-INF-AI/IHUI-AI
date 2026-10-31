// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作簿命令面路由测试(2026-11-02 立,goal-b45 F 席)。
 *
 * 钉住的五条(派单硬门):
 *  ① 写操作产出**新**文件,且原输入文件字节一字节没动(原档 sha256 前后逐字相等);
 *  ② 公式单元格**不被当作当前值返回**(正向对照:普通数值格照常回值);
 *  ③ 含公式的工作簿被改动后,结果带 `recalcUnsupported` 具名标记并点名到格;
 *  ④ 跨主体访问被拒,且**文件系统无新增**(落新档那条腿同样零副作用);
 *  ⑤ 非法句柄 / 已关闭会话 ⇒ 显式「未判定」,不猜。
 *
 * 另钉:目标格本身是公式 ⇒ 整批拒写(不静默把公式换成静态值);原档在打开后被别处改过 ⇒ 拒落新档。
 *
 * 测试隔离(AGENTS §5):不连 PG/Redis;鉴权层 mock;工作簿字节经 `STORAGE_DIR` 重定向到
 * 临时夹具目录,不碰仓库树与真实 storage。`exceljs` 真跑不 mock(同
 * `routes/__tests__/edu-canteen.test.ts:601` 那条既有形态)。
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify'
import { createHash } from 'node:crypto'
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import ExcelJS from 'exceljs'

// storage-service 在**模块加载时**就把 STORAGE_DIR 拍成常量 ⇒ 选址必须早于任何 import。
// vi.hoisted 的工厂会被提到**所有 import 之前**求值,所以工厂内不能用顶层 import 的绑定,
// 只能现取动态 import(夹具落 os.tmpdir(),与既有 api 用例同形:
// routes/__tests__/artifacts-download.test.ts:123)。
const fixtureRoot = await vi.hoisted(async () => {
  const { mkdtempSync, mkdirSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const root = mkdtempSync(join(tmpdir(), 'ihui-workbook-test-'))
  mkdirSync(join(root, 'uploads'), { recursive: true })
  process.env.STORAGE_DIR = root
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  return root
})

// 名字以 mock 开头是 vi.mock 工厂引用外部变量的唯一许可形态(vitest hoisting 规则)
const mockAuthState = vi.hoisted(() => ({ userId: null as string | null }))

vi.mock('../../plugins/auth.js', () => ({
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

import { getFileInfo, readFile, saveFile } from '../../services/storage-service.js'
import { resetWorkbookSessions } from '../../services/workbook-service.js'
import { workbookRoutes } from '../workbook.js'

const USER_A = '11111111-2222-4222-8222-111111111111'
const USER_B = '22222222-2222-4222-8222-222222222222'
const FILE_PLAIN = 'aaaaaaaa-2222-4222-8222-aaaaaaaaaaaa' // A 的普通档
const FILE_FORMULA = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb' // A 的含公式档
const FILE_NOT_XLSX = 'cccccccc-2222-4222-8222-cccccccccccc' // A 的坏档(非 xlsx)

/** 响应体只按已知键取(不开 any 窗)。 */
type Json = Record<string, unknown>

interface CellRead {
  address: string
  kind: string
  value: string | number | boolean | null
  formula?: string
  state?: string
  cachedValueWithheld?: boolean
  masterAddress?: string
}

interface HttpReply {
  statusCode: number
  json: Json
}

const dataOf = (r: HttpReply): Json => (r.json.data as Json | undefined) ?? {}
const detailOf = (r: HttpReply): Json => (r.json.detail as Json | undefined) ?? {}
const field = (o: Json, key: string): string => String(o[key] ?? '')
const cellsOf = (r: HttpReply): CellRead[] => (dataOf(r).cells as CellRead[] | undefined) ?? []

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

/** 造一份 xlsx:A1=名称 B1=数量 / A2=苹果 B2=3 / C2 公式 =B2*2(缓存值 6,故意留旧)。 */
async function makeWorkbookBytes(opts: { formula?: boolean } = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('报表')
  ws.getCell('A1').value = '名称'
  ws.getCell('B1').value = '数量'
  ws.getCell('A2').value = '苹果'
  ws.getCell('B2').value = 3
  if (opts.formula) {
    // 缓存值 6 是"上次存盘时的结果";改 B2 之后它就是陈旧错值
    ws.getCell('C2').value = { formula: 'B2*2', result: 6 }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function upload(fileId: string, bytes: Buffer, ownerId: string, name: string): void {
  saveFile(bytes, fileId, { kind: 'ihui-workbook', ownerId, name })
}

let app: FastifyInstance

async function call(
  path: 'open' | 'read' | 'write' | 'save' | 'close',
  body: Json,
): Promise<HttpReply> {
  const res = await app.inject({ method: 'POST', url: `/api/workbook/${path}`, payload: body })
  let json: Json = {}
  try {
    json = res.json() as Json
  } catch {
    json = { raw: res.body }
  }
  return { statusCode: res.statusCode, json }
}

async function openAs(fileId: string): Promise<string> {
  const res = await call('open', { fileId })
  expect(res.statusCode, JSON.stringify(res.json)).toBe(200)
  return field(dataOf(res), 'handle')
}

function storageFileIds(): string[] {
  try {
    return readdirSync(join(fixtureRoot, 'uploads')).filter((f) => !f.endsWith('.meta'))
  } catch {
    return []
  }
}

/** 相对某个快照的新增(测试之间会互相留档,不能拿"种子档之外"当基线)。 */
function addedSince(before: string[]): string[] {
  const seen = new Set(before)
  return storageFileIds().filter((id) => !seen.has(id))
}

beforeAll(async () => {
  mockAuthState.userId = USER_A
  upload(FILE_PLAIN, await makeWorkbookBytes(), USER_A, 'plain.xlsx')
  upload(FILE_FORMULA, await makeWorkbookBytes({ formula: true }), USER_A, 'formula.xlsx')
  upload(FILE_NOT_XLSX, Buffer.from('这不是 xlsx'), USER_A, 'broken.xlsx')
  mockAuthState.userId = null

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
  mockAuthState.userId = USER_A
})

describe('workbook 路由 · 鉴权与归属(AGENTS §5 认证不等于授权)', () => {
  it('无身份 ⇒ 401', async () => {
    mockAuthState.userId = null
    const res = await call('open', { fileId: FILE_PLAIN })
    expect(res.statusCode).toBe(401)
  })

  it('跨主体开别人的档 ⇒ 404(与"不存在"同形),且文件系统零新增(硬门 ④)', async () => {
    mockAuthState.userId = USER_B
    const before = storageFileIds()
    const res = await call('open', { fileId: FILE_FORMULA })
    expect(res.statusCode).toBe(404)
    expect(res.json.errorCode).toBe('WORKBOOK_FILE_NOT_FOUND')
    expect(addedSince(before), '越权路径不得产出新文件').toEqual([])
  })

  it('拿别人的会话句柄写/存 ⇒ 403 且零新文件(硬门 ④ 的第二条腿)', async () => {
    mockAuthState.userId = USER_A
    const handle = await openAs(FILE_PLAIN)

    mockAuthState.userId = USER_B
    const before = storageFileIds()
    const w = await call('write', { handle, sheet: '报表', cells: [{ address: 'B2', value: 99 }] })
    expect(w.statusCode).toBe(403)
    expect(w.json.errorCode).toBe('WORKBOOK_FORBIDDEN_OWNER')
    const s = await call('save', { handle })
    expect(s.statusCode).toBe(403)
    expect(addedSince(before)).toEqual([])
  })

  it('body 里自报 userId 无处生效(主体只认承载层)', async () => {
    mockAuthState.userId = USER_B
    const res = await call('open', { fileId: FILE_PLAIN, userId: USER_A })
    expect(res.statusCode).toBe(404)
  })
})

describe('workbook 路由 · 硬门 ①:保存只落新档,原档一字节不动', () => {
  it('write + save ⇒ 新 fileId,原档 sha256 前后逐字相等', async () => {
    mockAuthState.userId = USER_A
    const sourceShaBefore = sha256(readFile(FILE_PLAIN) as Buffer)
    const beforeIds = storageFileIds()

    const handle = await openAs(FILE_PLAIN)
    expect(handle).toMatch(/^[0-9a-f]{32}$/u)
    const opened = await call('open', { fileId: FILE_PLAIN })
    expect(dataOf(opened).sheets).toEqual([{ name: '报表', rowCount: 2, columnCount: 2 }])
    expect(dataOf(opened).sha256).toBe(sourceShaBefore)
    expect(dataOf(opened).protocolVersion).toBe(1)

    const w = await call('write', { handle, sheet: '报表', cells: [{ address: 'B2', value: 99 }] })
    expect(w.statusCode, JSON.stringify(w.json)).toBe(200)
    expect(dataOf(w).writtenCells).toBe(1)

    const s = await call('save', { handle, name: 'saved.xlsx' })
    expect(s.statusCode, JSON.stringify(s.json)).toBe(200)
    const savedFileId = field(dataOf(s), 'savedFileId')
    expect(savedFileId).not.toBe(FILE_PLAIN)
    expect(dataOf(s).sourceUntouched).toBe(true)
    expect(dataOf(s).sourceSha256Before).toBe(sourceShaBefore)
    expect(dataOf(s).sourceSha256After).toBe(sourceShaBefore)

    // 盘上实证:原档字节完全没变;新档确实新增且能读回改动
    expect(sha256(readFile(FILE_PLAIN) as Buffer)).toBe(sourceShaBefore)
    expect(addedSince(beforeIds)).toEqual([savedFileId])

    const reloaded = new ExcelJS.Workbook()
    await (reloaded.xlsx as unknown as { load: (d: Uint8Array) => Promise<ExcelJS.Workbook> }).load(
      new Uint8Array(readFile(savedFileId) as Buffer),
    )
    expect(reloaded.getWorksheet('报表')?.getCell('B2').value).toBe(99)

    // 新档归属 = 当前主体(不是从原档反推)
    const meta = getFileInfo(savedFileId)?.metadata as
      { ownerId?: string; sourceFileId?: string } | undefined
    expect(meta?.ownerId).toBe(USER_A)
    expect(meta?.sourceFileId).toBe(FILE_PLAIN)
  })

  it('原档在打开后被别处改动 ⇒ 拒绝落新档(WORKBOOK_SOURCE_CHANGED)', async () => {
    mockAuthState.userId = USER_A
    const handle = await openAs(FILE_PLAIN)
    const beforeIds = storageFileIds()
    const originalSha = sha256(readFile(FILE_PLAIN) as Buffer)

    // 别处覆盖原档(模拟用户自己在外部改)
    const tampered = await makeWorkbookBytes({ formula: true })
    writeFileSync(join(fixtureRoot, 'uploads', FILE_PLAIN), tampered)
    // 先自证「外部改动确实改变了字节」,否则本用例退化成空跑
    expect(sha256(tampered)).not.toBe(originalSha)

    await call('write', { handle, sheet: '报表', cells: [{ address: 'B2', value: 7 }] })
    const s = await call('save', { handle })
    expect(s.statusCode).toBe(409)
    expect(s.json.errorCode).toBe('WORKBOOK_SOURCE_CHANGED')
    expect(addedSince(beforeIds)).toEqual([])
  })
})

describe('workbook 路由 · 硬门 ②:公式格不得回缓存值', () => {
  it('公式格 ⇒ kind=formula + state=formula-uncomputed + 不回值;普通格正向对照照常回', async () => {
    mockAuthState.userId = USER_A
    const opened = await call('open', { fileId: FILE_FORMULA })
    expect(opened.statusCode).toBe(200)
    expect(dataOf(opened).formulaCellCount).toBe(1)
    expect(dataOf(opened).hasFormulas).toBe(true)
    const handle = field(dataOf(opened), 'handle')

    const r = await call('read', { handle, sheet: '报表', range: 'A1:C2' })
    expect(r.statusCode, JSON.stringify(r.json)).toBe(200)
    const byAddr: Record<string, CellRead> = Object.fromEntries(
      cellsOf(r).map((c) => [c.address, c]),
    )

    // 正向对照:普通数值格与文本格必须正常回值(不能为了红线把一切都扣住)
    expect(byAddr.B2?.kind).toBe('value')
    expect(byAddr.B2?.value).toBe(3)
    expect(byAddr.A1?.value).toBe('名称')

    // 红线:C2 =B2*2 的缓存值 6 是陈旧值 ⇒ 一个数字都不许给
    expect(byAddr.C2?.kind).toBe('formula')
    expect(byAddr.C2?.value).toBeNull()
    expect(byAddr.C2?.formula).toBe('B2*2')
    expect(byAddr.C2?.state).toBe('formula-uncomputed')
    expect(byAddr.C2?.cachedValueWithheld).toBe(true)
    expect(JSON.stringify(r.json)).not.toMatch(/"value":\s*6/u)
  })

  it('合并从格不回主格的值(只点名主格地址)', async () => {
    mockAuthState.userId = USER_A
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('合并')
    ws.getCell('A1').value = '主格'
    ws.mergeCells('A1:B1')
    const bytes = Buffer.from(await wb.xlsx.writeBuffer())
    const fileId = 'dddddddd-2222-4222-8222-dddddddddddd'
    upload(fileId, bytes, USER_A, 'merged.xlsx')

    const handle = await openAs(fileId)
    const r = await call('read', { handle, sheet: '合并', range: 'A1:B1' })
    const byAddr: Record<string, CellRead> = Object.fromEntries(
      cellsOf(r).map((c) => [c.address, c]),
    )
    expect(byAddr.A1?.value).toBe('主格')
    expect(byAddr.B1?.kind).toBe('merged')
    expect(byAddr.B1?.value).toBeNull()
    expect(byAddr.B1?.masterAddress).toBe('A1')
  })
})

describe('workbook 路由 · 硬门 ③:改动波及公式 ⇒ 具名标记', () => {
  it('改 B2(被 C2 的公式引用)⇒ recalcUnsupported=true 并点名 C2', async () => {
    mockAuthState.userId = USER_A
    const handle = await openAs(FILE_FORMULA)

    const w = await call('write', { handle, sheet: '报表', cells: [{ address: 'B2', value: 5 }] })
    expect(w.statusCode, JSON.stringify(w.json)).toBe(200)
    expect(dataOf(w).recalcUnsupported).toBe(true)
    expect(dataOf(w).hasFormulas).toBe(true)
    expect(dataOf(w).staleFormulaCells).toEqual([
      { sheet: '报表', address: 'C2', formula: 'B2*2', via: 'cell-ref' },
    ])

    const s = await call('save', { handle })
    expect(s.statusCode).toBe(200)
    expect(dataOf(s).recalcUnsupported).toBe(true)
    const stale = dataOf(s).staleFormulaCells as Array<Record<string, unknown>>
    expect(stale[0]?.address).toBe('C2')
  })

  it('改动与公式无引用关系 ⇒ 不带标记(标记不是摆设,不能一律扣绿)', async () => {
    mockAuthState.userId = USER_A
    const handle = await openAs(FILE_FORMULA)
    const w = await call('write', { handle, sheet: '报表', cells: [{ address: 'E9', value: 1 }] })
    expect(w.statusCode, JSON.stringify(w.json)).toBe(200)
    expect(dataOf(w).recalcUnsupported).toBe(false)
    expect(dataOf(w).staleFormulaCells).toEqual([])
    expect(dataOf(w).hasFormulas).toBe(true)
  })

  it('整列引用判 col-ref;区间引用判 range-ref;扫不动的形态判 unjudged(不判"肯定不影响")', async () => {
    const { __test__ } = await import('../../services/workbook-service.js')
    expect(__test__.parseFormulaRefs('SUM(B:B)').colRefs).toEqual([
      { sheet: null, fromCol: 2, toCol: 2 },
    ])
    const rng = __test__.parseFormulaRefs('SUM(A1:C9)')
    expect(rng.refs).toHaveLength(1)
    expect(rng.refs[0]).toMatchObject({ fromRow: 1, toRow: 9, fromCol: 1, toCol: 3 })
    // 字符串字面量里的 A1 不得被当成引用(只有一个真引用)
    expect(__test__.parseFormulaRefs('IF(A1>0,"A1","x")').refs).toHaveLength(1)
    // R1C1 / 跨簿 = 扫不动 ⇒ 标 unjudged
    expect(__test__.parseFormulaRefs('RC[-1]+1').unjudged).toBe(true)
    expect(__test__.parseFormulaRefs('[other.xlsx]Sheet1!A1').unjudged).toBe(true)
    // 表名限定
    expect(__test__.parseFormulaRefs('Sheet2!A1+B1').refs[0]).toMatchObject({ sheet: 'Sheet2' })
  })

  it('整列引用被改动波及 ⇒ via=col-ref(真跑一次,不只验解析)', async () => {
    mockAuthState.userId = USER_A
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('列')
    ws.getCell('B1').value = 1
    ws.getCell('C1').value = { formula: 'SUM(B:B)', result: 1 }
    const fileId = 'eeeeeeee-2222-4222-8222-eeeeeeeeeeee'
    upload(fileId, Buffer.from(await wb.xlsx.writeBuffer()), USER_A, 'colref.xlsx')

    const handle = await openAs(fileId)
    const w = await call('write', { handle, sheet: '列', cells: [{ address: 'B5', value: 4 }] })
    expect(dataOf(w).recalcUnsupported).toBe(true)
    expect(dataOf(w).staleFormulaCells).toEqual([
      { sheet: '列', address: 'C1', formula: 'SUM(B:B)', via: 'col-ref' },
    ])
  })
})

describe('workbook 路由 · 红线 3:不得把公式换成静态值', () => {
  it('目标格本身是公式 ⇒ 409 整批拒写,公式原文一字未动', async () => {
    mockAuthState.userId = USER_A
    const handle = await openAs(FILE_FORMULA)

    const w = await call('write', {
      handle,
      sheet: '报表',
      cells: [
        { address: 'B2', value: 100 }, // 合法格
        { address: 'C2', value: 6 }, // 公式格 ⇒ 整批拒
      ],
    })
    expect(w.statusCode).toBe(409)
    expect(w.json.errorCode).toBe('WORKBOOK_FORMULA_OVERWRITE')
    expect(detailOf(w).formulaTargets).toEqual(['C2'])

    // 无部分写:合法那格也没被写进去
    const r = await call('read', { handle, sheet: '报表', range: 'B2:C2' })
    const cells = cellsOf(r)
    expect(cells.find((c) => c.address === 'B2')?.value).toBe(3)
    expect(cells.find((c) => c.address === 'C2')?.kind).toBe('formula')
    expect(cells.find((c) => c.address === 'C2')?.formula).toBe('B2*2')
  })
})

describe('workbook 路由 · 硬门 ⑤:句柄取不到就明写未判定', () => {
  it('未知句柄 ⇒ 410 WORKBOOK_HANDLE_UNDETERMINED,措辞是"无法判定"不是"成功"', async () => {
    mockAuthState.userId = USER_A
    const ghost = 'f'.repeat(32)
    for (const path of ['read', 'write', 'save', 'close'] as const) {
      const body: Json =
        path === 'read'
          ? { handle: ghost, sheet: '报表', range: 'A1' }
          : path === 'write'
            ? { handle: ghost, sheet: '报表', cells: [{ address: 'A1', value: 1 }] }
            : { handle: ghost }
      const res = await call(path, body)
      expect(res.statusCode, `${path}: ${JSON.stringify(res.json)}`).toBe(410)
      expect(res.json.errorCode).toBe('WORKBOOK_HANDLE_UNDETERMINED')
      expect(String(res.json.message)).toMatch(/无法判定/u)
    }
  })

  it('close 之后同一句柄 ⇒ 未判定(不猜它当时改了啥)', async () => {
    mockAuthState.userId = USER_A
    const handle = await openAs(FILE_PLAIN)
    const c = await call('close', { handle })
    expect(c.statusCode).toBe(200)
    expect(dataOf(c).closed).toBe(true)
    const again = await call('read', { handle, sheet: '报表', range: 'A1' })
    expect(again.statusCode).toBe(410)
    expect(again.json.errorCode).toBe('WORKBOOK_HANDLE_UNDETERMINED')
  })
})

describe('workbook 路由 · 入参形状与格式', () => {
  it('非 xlsx 字节 ⇒ 415 WORKBOOK_FORMAT_UNSUPPORTED(不硬开)', async () => {
    mockAuthState.userId = USER_A
    const res = await call('open', { fileId: FILE_NOT_XLSX })
    expect(res.statusCode).toBe(415)
    expect(res.json.errorCode).toBe('WORKBOOK_FORMAT_UNSUPPORTED')
  })

  it('句柄/地址/range 形状非法 ⇒ 400', async () => {
    mockAuthState.userId = USER_A
    expect((await call('read', { handle: 'zz', sheet: '报表', range: 'A1' })).statusCode).toBe(400)
    const handle = await openAs(FILE_PLAIN)
    expect((await call('read', { handle, sheet: '报表', range: 'A1-B2' })).json.errorCode).toBe(
      'WORKBOOK_INVALID_INPUT',
    )
    expect(
      (await call('write', { handle, sheet: '报表', cells: [{ address: 'nope', value: 1 }] })).json
        .errorCode,
    ).toBe('WORKBOOK_INVALID_INPUT')
    expect((await call('write', { handle, sheet: '报表', cells: [] })).statusCode).toBe(400)
  })

  it('不存在的工作表 ⇒ 400 点名(不静默回空集)', async () => {
    mockAuthState.userId = USER_A
    const handle = await openAs(FILE_PLAIN)
    const r = await call('read', { handle, sheet: '没有这张表', range: 'A1' })
    expect(r.statusCode).toBe(400)
    expect(String(r.json.message)).toMatch(/工作表不存在/u)
  })

  it('区域超限 ⇒ 413(与对照件的响应尺寸闸同语义)', async () => {
    mockAuthState.userId = USER_A
    const handle = await openAs(FILE_PLAIN)
    const r = await call('read', { handle, sheet: '报表', range: 'A1:Z100000' })
    expect(r.statusCode).toBe(413)
    expect(r.json.errorCode).toBe('WORKBOOK_RANGE_TOO_LARGE')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
