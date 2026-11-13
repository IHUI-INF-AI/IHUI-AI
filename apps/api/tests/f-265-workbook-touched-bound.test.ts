// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-265 回归锁(2026-11-13)。
 *
 * 病灶(修复前):会话 `touched` 与 open 同寿命、只 push 不去重也无上限;
 * `affectedFormulaCells` 每个公式格都要扫**全部** touched ⇒ 复杂度
 * O(formulaCells × touched 总量),2 万公式格 + 20 万 touched ≈ 4e9 次比较,
 * 同一 handle 反复 POST /workbook/write 即可让单请求阻塞数秒到分钟。
 *
 * 本文件锁五条:
 *  ① 同一批格重复写 ⇒ touched 去重不膨胀,recalc 输出不变;
 *  ② 累计写入超上限 ⇒ touched 规模被硬限住(不再随会话无限增长);
 *  ③ 大量公式格 + 大量历史 touched 下,本批只新增少量格时比较次数仍受本批格数约束
 *     (给 formulaCells 下标读装计数器,确定性断言,不用计时);
 *  ④ 上限到达触发 FIFO 淘汰后,被淘汰格的公式命中不丢,最终 recalc 结果仍正确;
 *  ⑤ 正常单批写入与既有 workbook 行为一致(不回归)。
 *
 * 只跑服务层:storage-service 用内存 Map mock,不连 PG/Redis、不落仓库树。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'

const store = vi.hoisted(() => new Map<string, Buffer>())
const metas = vi.hoisted(() => new Map<string, Record<string, unknown>>())

vi.mock('../src/services/storage-service.js', () => ({
  generateFileId: () => 'f'.repeat(32),
  getFileInfo: (id: string) => {
    const metadata = metas.get(id)
    return metadata ? { id, metadata } : undefined
  },
  readFile: (id: string) => store.get(id) ?? null,
  saveFile: vi.fn(),
}))

import {
  __test__,
  openWorkbook,
  resetWorkbookSessions,
  writeCells,
  type WriteCellsData,
} from '../src/services/workbook-service.js'

const OWNER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const FILE_ID = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'
const SHEET = 'F265'

type Session = NonNullable<ReturnType<typeof __test__.sessions.get>>

function colName(n: number): string {
  let out = ''
  let v = n
  while (v > 0) {
    const rem = (v - 1) % 26
    out = String.fromCharCode(65 + rem) + out
    v = Math.floor((v - 1) / 26)
  }
  return out
}

/** 一行 count 个格(默认整批上限),row >= 300 时一定落在公式网格之外。 */
function rowCells(
  row: number,
  count = __test__.MAX_WRITE_CELLS,
): Array<{ address: string; value: number }> {
  return Array.from({ length: count }, (_, i) => ({ address: `${colName(i + 1)}${row}`, value: 1 }))
}

/** 造一份 xlsx 交给 mock 的 storage,再走真实 openWorkbook 建会话。 */
async function openWith(build: (wb: ExcelJS.Workbook) => void): Promise<string> {
  const wb = new ExcelJS.Workbook()
  build(wb)
  store.set(FILE_ID, Buffer.from(await wb.xlsx.writeBuffer()))
  metas.set(FILE_ID, { ownerId: OWNER, name: 'f265.xlsx' })
  const opened = await openWorkbook({ subjectId: OWNER, fileId: FILE_ID })
  if (!opened.ok) throw new Error(`open 失败: ${opened.errorCode} ${opened.message}`)
  return opened.data.handle
}

function sessionOf(handle: string): Session {
  const s = __test__.sessions.get(handle)
  if (!s) throw new Error('会话不存在')
  return s
}

function write(
  handle: string,
  cells: Array<{ address: string; value: number }>,
): WriteCellsData {
  const result = writeCells({ subjectId: OWNER, handle, sheet: SHEET, cells })
  if (!result.ok) throw new Error(`write 失败: ${result.errorCode} ${result.message}`)
  return result.data
}

afterEach(() => {
  resetWorkbookSessions()
  store.clear()
  metas.clear()
})

describe('F-265 workbook touched 上限与增量判定', () => {
  it('① 重复写同一批单元格:touched 去重不膨胀,recalc 输出稳定', async () => {
    const handle = await openWith((wb) => {
      const ws = wb.addWorksheet(SHEET)
      ws.getCell('A1').value = 0
      ws.getCell('C1').value = { formula: 'A1+1', result: 1 }
    })
    const s = sessionOf(handle)
    const batch = [
      { address: 'A1', value: 1 },
      { address: 'B1', value: 2 },
    ]

    const first = write(handle, batch)
    expect(first.staleFormulaCells).toEqual([
      { sheet: SHEET, address: 'C1', formula: 'A1+1', via: 'cell-ref' },
    ])
    expect(s.touched.size).toBe(2)

    for (let round = 0; round < 5; round++) {
      const again = write(handle, batch)
      expect(again.staleFormulaCells).toEqual(first.staleFormulaCells)
      expect(again.recalcUnsupported).toBe(true)
      // 修复前:每次 push 都追加 ⇒ size 线性膨胀(2 → 12);修复后恒为 2
      expect(s.touched.size).toBe(2)
    }
  })

  it('② 累计写入超过上限:touched 规模被硬限住', async () => {
    const handle = await openWith((wb) => {
      const ws = wb.addWorksheet(SHEET)
      // 公式放在 ZZ1(列 702),避开 rowCells 覆盖的 A..SF(1..500)
      ws.getCell('ZZ1').value = { formula: 'A1+1', result: 1 }
    })
    const s = sessionOf(handle)
    const max = __test__.MAX_TOUCHED_CELLS
    const batches = Math.ceil((max + __test__.MAX_WRITE_CELLS) / __test__.MAX_WRITE_CELLS)

    for (let b = 0; b < batches; b++) write(handle, rowCells(b + 1))
    expect(s.touched.size).toBe(max)

    // 再写一整批新格:上限不破,也不随会话继续增长
    write(handle, rowCells(batches + 1))
    expect(s.touched.size).toBe(max)
  })

  it('③ 2 万公式格 + 大量历史 touched:本批只新增 1 格时只做单层比较', async () => {
    const FORMULA_ROWS = 200
    const FORMULA_COLS = 100
    const FORMULA_COUNT = FORMULA_ROWS * FORMULA_COLS // 20_000
    const handle = await openWith((wb) => {
      const ws = wb.addWorksheet(SHEET)
      for (let r = 1; r <= FORMULA_ROWS; r++) {
        for (let c = 1; c <= FORMULA_COLS; c++) {
          // 统一引用 ZZ1(列 702,在公式网格之外),本用例的写入都不命中它
          ws.getCell(r, c).value = { formula: 'ZZ1+1', result: 2 }
        }
      }
    })
    const s = sessionOf(handle)
    expect(s.formulaCells.length).toBe(FORMULA_COUNT)

    // 先攒 2000 格历史 touched(4 批 × 500)
    for (let b = 0; b < 4; b++) write(handle, rowCells(300 + b))

    // 给每个公式格的 `refs` 装取值计数器:一次 refs 读 = 一次「公式格 × 改动格」的内层比较。
    // 修复前:外层公式格 × 内层全部 touched = 20_000 × 2_001 ≈ 4e7;
    // 修复后:外层公式格 × 本批新增 1 格 = 20_000。
    let refReads = 0
    for (const f of s.formulaCells) {
      const refs = f.refs
      Object.defineProperty(f, 'refs', {
        configurable: true,
        get() {
          refReads++
          return refs
        },
      })
    }

    refReads = 0
    const out = write(handle, [{ address: 'ZZ9', value: 7 }])
    expect(out.writtenCells).toBe(1)

    expect(refReads).toBeGreaterThanOrEqual(FORMULA_COUNT)
    expect(refReads).toBeLessThanOrEqual(FORMULA_COUNT * 2)
  })

  it('④ 淘汰最旧记录后:被淘汰格的公式命中仍在,最终 recalc 结果正确', async () => {
    const handle = await openWith((wb) => {
      const ws = wb.addWorksheet(SHEET)
      ws.getCell('A1').value = 0
      ws.getCell('C1').value = { formula: 'A1+1', result: 1 }
    })
    const s = sessionOf(handle)
    const first = write(handle, [{ address: 'A1', value: 1 }])
    expect(first.staleFormulaCells).toEqual([
      { sheet: SHEET, address: 'C1', formula: 'A1+1', via: 'cell-ref' },
    ])

    // 用不同格把 A1 挤出上限(行从 2 起,避开 A1/C1)
    const batches = Math.ceil(__test__.MAX_TOUCHED_CELLS / __test__.MAX_WRITE_CELLS) + 1
    for (let b = 0; b < batches; b++) write(handle, rowCells(b + 2))
    expect(s.touched.size).toBe(__test__.MAX_TOUCHED_CELLS)

    // A1 的记录已被 FIFO 淘汰,但它的命中在写入当次就归档 ⇒ 后续写别的格时结果仍含 C1
    const after = write(handle, [{ address: 'B1', value: 9 }])
    expect(after.recalcUnsupported).toBe(true)
    expect(after.staleFormulaCells).toEqual([
      { sheet: SHEET, address: 'C1', formula: 'A1+1', via: 'cell-ref' },
    ])
  })

  it('⑤ 正常单批写入行为与既有 workbook 语义一致(不回归)', async () => {
    const handle = await openWith((wb) => {
      const ws = wb.addWorksheet(SHEET)
      ws.getCell('A1').value = '名称'
      ws.getCell('B2').value = 3
      ws.getCell('C2').value = { formula: 'B2*2', result: 6 }
    })

    // 与公式无引用关系 ⇒ 不带标记(标记不是摆设)
    const clean = write(handle, [{ address: 'E9', value: 1 }])
    expect(clean.writtenCells).toBe(1)
    expect(clean.hasFormulas).toBe(true)
    expect(clean.recalcUnsupported).toBe(false)
    expect(clean.staleFormulaCells).toEqual([])

    // 改 B2(被 C2 引用)⇒ 点名 C2 / cell-ref
    const hit = write(handle, [{ address: 'B2', value: 5 }])
    expect(hit.recalcUnsupported).toBe(true)
    expect(hit.staleFormulaCells).toEqual([
      { sheet: SHEET, address: 'C2', formula: 'B2*2', via: 'cell-ref' },
    ])
  })
})
