// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-540 回归锁(2026-11-14,按 db21c929c66 落地的 saveBarrier 实现)。
 *
 * 病灶:saveWorkbook 在 `await s.workbook.xlsx.writeBuffer()` 期间让出事件循环,
 * 同一 handle 的并发 write / save 可改写同一份 ExcelJS 实例并 push touched;
 * 随后 recalcView 基于「写后」状态生成 staleFormulaCells ⇒ save 响应与新档字节不一致。
 *
 * 修复(saveBarrier 会话级互斥):
 *  ① WorkbookSession 带 saveBarrier: Promise<void> | null;
 *  ② acquireSaveBarrier 排队等待前一位释放,前一位失败不传染;
 *  ③ save 的整段"读模型 → writeBuffer → 落盘 → 推进槽位"持锁,finally 释放;
 *  ④ writeCells 见到 saveBarrier 直接拒写(WORKBOOK_SAVING),且发生在任何写入之前;
 *  ⑤ close 见到 saveBarrier 拒绝销毁会话。
 *
 * 本锁为源码接线锁,不连库/不落盘。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const src = readFileSync(resolve(REPO_ROOT, 'apps/api/src/services/workbook-service.ts'), 'utf8')

describe('F-540:workbook save 与 write 的会话级互斥', () => {
  it('接线锁:会话结构带 saveBarrier,并有具名错误码 WORKBOOK_SAVING', () => {
    expect(src).toMatch(/saveBarrier: Promise<void> \| null/)
    expect(src).toMatch(/saveBarrier: null,/)
    expect(src).toMatch(/\| 'WORKBOOK_SAVING'/)
  })

  it('互斥原语:acquireSaveBarrier 串行等待且释放时清空 saveBarrier', () => {
    const idx = src.indexOf('async function acquireSaveBarrier')
    expect(idx).toBeGreaterThan(-1)
    const seg = src.slice(idx, src.indexOf('/**\n * open:', idx))
    expect(seg).toMatch(/while \(s\.saveBarrier\)/)
    expect(seg).toMatch(/await s\.saveBarrier/)
    expect(seg).toMatch(/s\.saveBarrier = new Promise<void>/)
    expect(seg).toMatch(/s\.saveBarrier = null/)
  })

  it('缺陷锁:save 在整段临界区持锁,writeBuffer 与 recalcView 都在其中', () => {
    const idx = src.indexOf('const releaseBarrier = await acquireSaveBarrier(s)')
    expect(idx).toBeGreaterThan(-1)
    const seg = src.slice(idx, idx + 400)
    expect(seg).toMatch(/return await saveWorkbookInner\(s, params\)/)
    expect(seg).toMatch(/finally \{\s*releaseBarrier\(\)/)
    const innerIdx = src.indexOf('async function saveWorkbookInner')
    expect(innerIdx).toBeGreaterThan(-1)
    const inner = src.slice(innerIdx, src.indexOf('/** close:', innerIdx))
    expect(inner).toMatch(/await s\.workbook\.xlsx\.writeBuffer\(\)/)
    expect(inner).toMatch(/recalcView\(s\)/)
  })

  it('缺陷锁:writeCells 在保存中先拒写,且发生在任何写入之前', () => {
    const fnIdx = src.indexOf('export function writeCells')
    expect(fnIdx).toBeGreaterThan(-1)
    const seg = src.slice(fnIdx, src.indexOf('export interface SaveWorkbookData', fnIdx))
    const guardIdx = seg.indexOf('if (s.saveBarrier)')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(seg.slice(guardIdx, guardIdx + 260)).toMatch(/WORKBOOK_SAVING/)
    // 保护必须先于取工作表/写模型(否则已改内存模型再报失败 = 半写)
    expect(guardIdx).toBeLessThan(seg.indexOf('s.workbook.getWorksheet(params.sheet)'))
  })

  it('缺陷锁:保存中 close 不得销毁会话', () => {
    const idx = src.indexOf('export function closeWorkbook')
    expect(idx).toBeGreaterThan(-1)
    const seg = src.slice(idx, idx + 1200)
    expect(seg).toMatch(/if \(s\.saveBarrier\)/)
    expect(seg).toMatch(/WORKBOOK_SAVING/)
  })
})
