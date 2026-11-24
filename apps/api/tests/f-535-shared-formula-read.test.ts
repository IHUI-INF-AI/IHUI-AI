// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-535 回归锁(2026-11-14)。
 *
 * 病灶:读取公式时先取 model 的 `formula`,没有就回退 `sharedFormula` —— 而共享公式
 * 从格的 model 只有 `{ sharedFormula: '<主格地址>', result }`,`formula` 为 undefined。
 * 于是从格把「主格地址」当公式原文返回(read 回假公式),`indexFormulaCells` 又按这个
 * 坐标串解析依赖 ⇒ 改写真实引用源时从格漏报,`recalcUnsupported:false` 掩盖失效公式。
 *
 * 本文件锁:
 *  ① read_range:从格返回 ExcelJS 翻译后的公式(A2*2 / A3*2),不是主格地址 B1;
 *  ② open 建索引时从格按翻译式解析依赖 ⇒ 写 A2 点名 B2(修复前漏报);
 *  ③ 从格仍是公式格 ⇒ 直接写它整批拒写(WORKBOOK_FORMULA_OVERWRITE)。
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
  openWorkbook,
  readRange,
  resetWorkbookSessions,
  writeCells,
} from '../src/services/workbook-service.js'

const OWNER = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const FILE_ID = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'
const SHEET = 'F535'

/** 最小工作簿:主格 B1 = A1*2 共享到 B1:B3,从格只有 sharedFormula 与缓存值。 */
async function openSharedWorkbook(): Promise<string> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(SHEET)
  ws.getCell('A1').value = 1
  ws.getCell('A2').value = 2
  ws.getCell('A3').value = 3
  ws.getCell('B1').value = { formula: 'A1*2', shareType: 'shared', ref: 'B1:B3', result: 2 }
  ws.getCell('B2').value = { sharedFormula: 'B1', result: 4 }
  ws.getCell('B3').value = { sharedFormula: 'B1', result: 6 }
  store.set(FILE_ID, Buffer.from(await wb.xlsx.writeBuffer()))
  metas.set(FILE_ID, { ownerId: OWNER, name: 'f535.xlsx' })
  const opened = await openWorkbook({ subjectId: OWNER, fileId: FILE_ID })
  if (!opened.ok) throw new Error(`open 失败: ${opened.errorCode} ${opened.message}`)
  expect(opened.data.formulaCellCount).toBe(3)
  return opened.data.handle
}

afterEach(() => {
  resetWorkbookSessions()
  store.clear()
  metas.clear()
})

describe('F-535 共享公式从格读取与依赖判定', () => {
  it('① read_range:从格回翻译后的公式,不回主格地址', async () => {
    const handle = await openSharedWorkbook()
    const read = readRange({ subjectId: OWNER, handle, sheet: SHEET, range: 'B1:B3' })
    if (!read.ok) throw new Error(`read 失败: ${read.errorCode} ${read.message}`)

    const [master, from1, from2] = read.data.cells
    expect(master).toMatchObject({ address: 'B1', kind: 'formula', formula: 'A1*2' })
    expect(from1).toMatchObject({ address: 'B2', kind: 'formula', formula: 'A2*2' })
    expect(from2).toMatchObject({ address: 'B3', kind: 'formula', formula: 'A3*2' })
    // 修复前从格 formula === 'B1'(主格地址),这里必须不是
    expect(from1?.formula).not.toBe('B1')
    expect(from1?.value).toBeNull()
    expect(from1?.cachedValueWithheld).toBe(true)
  })

  it('② 改写真实引用源 A2:受影响公式包含从格 B2', async () => {
    const handle = await openSharedWorkbook()
    const wrote = writeCells({
      subjectId: OWNER,
      handle,
      sheet: SHEET,
      cells: [{ address: 'A2', value: 10 }],
    })
    if (!wrote.ok) throw new Error(`write 失败: ${wrote.errorCode} ${wrote.message}`)

    expect(wrote.data.recalcUnsupported).toBe(true)
    expect(wrote.data.staleFormulaCells).toEqual([
      { sheet: SHEET, address: 'B2', formula: 'A2*2', via: 'cell-ref' },
    ])
  })

  it('③ 从格仍是公式格:直接写整批拒写', async () => {
    const handle = await openSharedWorkbook()
    const wrote = writeCells({
      subjectId: OWNER,
      handle,
      sheet: SHEET,
      cells: [{ address: 'B2', value: 1 }],
    })
    expect(wrote.ok).toBe(false)
    if (!wrote.ok) expect(wrote.errorCode).toBe('WORKBOOK_FORMULA_OVERWRITE')
  })
})
