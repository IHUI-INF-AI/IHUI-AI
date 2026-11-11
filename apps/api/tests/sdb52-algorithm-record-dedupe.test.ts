// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// SDB-52:同一份清单 docx 里同一备案编号出现两行 ⇒ 单条 INSERT ... ON CONFLICT DO UPDATE
// 两次命中同一目标 ⇒ PostgreSQL 报 "cannot affect row a second time",整批失败、整份文件数据丢失;
// 且 updated 恒为 0 使统计失真。
//
// 本文件钉住:入库前按 recordNo 去重(后行覆盖前行、保持首次出现顺序)、重复行计数可观测、
// inserted/updated 与真实落库一致。DOCX 走 mammoth mock(只回一段 HTML,cheerio 用真的),
// DB 走假 upsert:同批重复键会按线上同形抛错,表内容真实累积,统计断言对着表内容核。
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Row = Record<string, unknown>

const state = vi.hoisted(() => ({
  table: new Map<string, Record<string, unknown>>(),
  html: '',
  lastBatch: [] as Array<Record<string, unknown>>,
}))

vi.mock('mammoth', () => ({
  default: {
    convertToHtml: async () => ({ value: state.html }),
  },
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: () => ({
      values: (vals: Array<Record<string, unknown>>) => {
        // 复刻 PostgreSQL 的同批约束:同一条语句里同一冲突键出现两次 => 整句失败。
        // 若实现退回"不去重",这里会以与线上同形的错误红掉,而不是悄悄通过。
        const seen = new Set<string>()
        for (const v of vals) {
          const no = String(v.recordNo)
          if (seen.has(no)) {
            throw new Error('ON CONFLICT DO UPDATE command cannot affect row a second time')
          }
          seen.add(no)
        }
        return {
          onConflictDoUpdate: () => ({
            returning: async () => {
              state.lastBatch = vals
              return vals.map((v) => {
                const no = String(v.recordNo)
                const existed = state.table.has(no)
                state.table.set(no, v)
                return { inserted: !existed }
              })
            },
          }),
        }
      },
    }),
  },
  dbRead: {},
  dbClient: {},
}))

import { importOneDocx, DEEP_SYNTHESIS_KIND } from '../src/services/algorithm-record-service.js'

const HEADER = [
  '序号',
  '算法名称',
  '角色',
  '主体名称',
  '应用产品',
  '主要用途',
  '备案编号',
  '备注',
] as const

/** 一行清单数据(8 列),只关心算法名称/主体/备案编号,其余填充占位。 */
function dataRow(seq: number, algName: string, provider: string, recordNo: string): string[] {
  return [String(seq), algName, '服务提供者', provider, '产品A', '用途A', recordNo, '']
}

function tableHtml(rows: string[][]): string {
  const tr = (cells: readonly string[], tag: 'th' | 'td') =>
    `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`
  return `<table>${tr(HEADER, 'th')}${rows.map((r) => tr(r, 'td')).join('')}</table>`
}

async function importRows(rows: string[][]) {
  state.html = tableHtml(rows)
  return importOneDocx({
    kind: DEEP_SYNTHESIS_KIND,
    batch: '2026-11',
    sourceUrl: 'https://example.invalid/list.docx',
    buffer: Buffer.from(''),
  })
}

describe('SDB-52:algorithm-record 同批重复 recordNo 去重', () => {
  beforeEach(() => {
    state.table = new Map<string, Row>()
    state.lastBatch = []
    state.html = ''
  })

  it('① 同批两条相同 recordNo 只落一条、不抛错,且后行覆盖前行', async () => {
    const stats = await importRows([
      dataRow(1, '算法甲(旧)', '甲公司', '网信算备110000000000001号'),
      dataRow(2, '算法甲(新)', '甲公司', '网信算备110000000000001号'),
    ])

    expect(state.table.size).toBe(1)
    expect(state.table.get('网信算备110000000000001号')?.algName).toBe('算法甲(新)')
    expect(state.lastBatch).toHaveLength(1)
    expect(stats.inserted).toBe(1)
    expect(stats.updated).toBe(0)
  })

  it('② 不同 recordNo 全部落库,顺序保持首次出现', async () => {
    const stats = await importRows([
      dataRow(1, '算法甲', '甲公司', '网信算备A号'),
      dataRow(2, '算法乙', '乙公司', '网信算备B号'),
    ])

    expect([...state.table.keys()]).toEqual(['网信算备A号', '网信算备B号'])
    expect(stats.inserted).toBe(2)
    expect(stats.updated).toBe(0)
    expect(stats.duplicateRows).toBe(0)
  })

  it('③ 重复行被计数(留痕),不是静默丢弃', async () => {
    const stats = await importRows([
      dataRow(1, '算法甲', '甲公司', '网信算备A号'),
      dataRow(2, '算法甲', '甲公司', '网信算备A号'),
      dataRow(3, '算法甲', '甲公司', '网信算备A号'),
      dataRow(4, '算法乙', '乙公司', '网信算备B号'),
    ])

    expect(stats.duplicateRows).toBe(2)
    expect(state.table.size).toBe(2)
  })

  it('④ 统计与真实落库一致:命中既有键计 updated,新键计 inserted', async () => {
    state.table.set('网信算备A号', { recordNo: '网信算备A号', algName: '算法甲(旧)' })

    const stats = await importRows([
      dataRow(1, '算法甲(新)', '甲公司', '网信算备A号'),
      dataRow(2, '算法乙', '乙公司', '网信算备B号'),
    ])

    expect(stats.inserted).toBe(1)
    expect(stats.updated).toBe(1)
    expect(stats.inserted + stats.updated).toBe(state.table.size)
    expect(state.table.get('网信算备A号')?.algName).toBe('算法甲(新)')
    expect(state.table.has('网信算备B号')).toBe(true)
  })

  it('无有效行时不发语句,重复计数照实返回', async () => {
    const stats = await importRows([['1', '', '服务提供者', '', '产品A', '用途A', '网信算备A号', '']])

    expect(state.lastBatch).toHaveLength(0)
    expect(stats.inserted).toBe(0)
    expect(stats.updated).toBe(0)
    expect(stats.skipped).toBe(1)
    expect(stats.duplicateRows).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
