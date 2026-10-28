// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 会员批量导入的文件闸回归锁(2026-10-28 立)。
 *
 * 背景:`/members/batch-import` 与 `/members/import/excel` 原先拿到 buffer 直接
 * `XLSX.read(buffer)`,零大小上限、零类型校验、零行数上限。xlsx 是 ZIP 容器,
 * 100MB(全局 multipart 上限)可解压成数十 GB 直接把进程打死;任意二进制改名
 * `.xlsx` 也能进解析器。本文件守:
 *   1) 大小 / 扩展名 / Excel 容器头三道闸;
 *   2) CSV 不验魔数(纯文本没有),Excel 必须验(防改名即入库);
 *   3) 行数上限;
 *   4) 接线锁:两个端点都真的调了闸,别再退回裸 `XLSX.read(buffer)`。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

// member.ts 是路由文件,import 会拉起 DB/鉴权链;本文件只测纯函数闸,截断依赖。
vi.mock('../src/db/index.js', () => ({ db: {} }))
vi.mock('../src/plugins/auth.js', () => ({ checkAuth: vi.fn() }))
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))

import { guardMemberImportFile, guardMemberImportRows } from '../src/routes/member.js'

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])
const XLS_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
const NOT_EXCEL = Buffer.from('this is definitely not a spreadsheet', 'utf8')
const EXCEL_ONLY = new Set(['xlsx', 'xls'])

describe('大小闸', () => {
  it('超过 10MB ⇒ 拒,且文案带实际上限', () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1)
    const verdict = guardMemberImportFile('members.csv', big)
    expect(verdict).toContain('文件过大')
    expect(verdict).toContain('10MB')
  })

  it('恰好 10MB ⇒ 放行(边界不误伤)', () => {
    const exact = Buffer.alloc(10 * 1024 * 1024)
    expect(guardMemberImportFile('members.csv', exact)).toBeNull()
  })
})

describe('扩展名闸', () => {
  it.each(['.exe', '.html', '.svg', '.js', ''])('拒绝 %s', (ext) => {
    expect(guardMemberImportFile(`members${ext}`, NOT_EXCEL)).toContain('仅支持')
  })

  it('/members/import/excel 语义下 CSV 也拒(该端点只收 Excel)', () => {
    const verdict = guardMemberImportFile('members.csv', Buffer.from('a,b\n1,2'), EXCEL_ONLY)
    expect(verdict).toContain('仅支持')
  })
})

describe('魔数闸:Excel 必须验容器头', () => {
  it('xlsx 扩展名 + 非 ZIP 内容 ⇒ 拒(改名文件)', () => {
    const verdict = guardMemberImportFile('members.xlsx', NOT_EXCEL)
    expect(verdict).toContain('不一致')
  })

  it('xlsx + ZIP 头 ⇒ 放行', () => {
    expect(guardMemberImportFile('members.xlsx', XLSX_MAGIC)).toBeNull()
  })

  it('xls + OLE2 头 ⇒ 放行', () => {
    expect(guardMemberImportFile('members.xls', XLS_MAGIC)).toBeNull()
  })

  it('xls + ZIP 头 ⇒ 拒(容器类型不对)', () => {
    expect(guardMemberImportFile('members.xls', XLSX_MAGIC)).toContain('不一致')
  })

  it('CSV 不验魔数(纯文本无容器头,验了会误伤全部真实用户)', () => {
    expect(guardMemberImportFile('members.csv', NOT_EXCEL)).toBeNull()
  })
})

describe('行数闸', () => {
  it('恰好 5 万行放行', () => {
    expect(guardMemberImportRows(50_000)).toBeNull()
  })

  it('超过 5 万行拒,文案带实际行数', () => {
    const msg = guardMemberImportRows(50_001)
    expect(msg).toContain('50001')
    expect(msg).toContain('50000')
  })
})

describe('接线锁:两个端点都必须先过闸', () => {
  const src = readFileSync(new URL('../src/routes/member.ts', import.meta.url), 'utf8')
  const excelStart = src.indexOf("'/members/import/excel'")
  const batchStart = src.indexOf("'/members/batch-import'")

  it('两个端点都能在源码里定位到(端点被改名时本锁要失效而不是静默通过)', () => {
    expect(excelStart).toBeGreaterThan(0)
    expect(batchStart).toBeGreaterThan(excelStart)
  })

  it.each([
    ['/members/import/excel', () => src.slice(excelStart, batchStart)],
    ['/members/batch-import', () => src.slice(batchStart)],
  ])('%s 的端点体内同时有文件闸与行数闸', (_name, block) => {
    expect(block()).toContain('guardMemberImportFile(')
    expect(block()).toContain('guardMemberImportRows(')
  })
})
