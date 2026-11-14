// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-142 回归锁:团队知识修订乐观锁是「先读后判」，UPDATE 不带 revision 条件 ⇒ 后写覆盖先写。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-142):
 *   reviseItem / setItemStatus 均在内存比较 expectedRevision，UPDATE 只有 WHERE id=?，
 *   两名成员同时修改 → 后写静默覆盖先写、内容丢失；审计与正文非事务，审计失败则正文已改无审计。
 *
 * 修复：UPDATE 带 AND revision = 基线 + rowCount 判冲突（0 行→抛 RevisionConflictError）；
 *   update + writeRevision 放同一事务（要么全成要么全回滚）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const svcPath = resolve(REPO_ROOT, 'apps/api/src/services/knowledge-team-service.ts')
const src = readFileSync(svcPath, 'utf8')

describe('F-142:修订乐观锁必须在 UPDATE WHERE 带 revision 条件 + 事务', () => {
  it('reviseItem: UPDATE 带 AND revision = 基线', () => {
    const fnStart = src.indexOf('export async function reviseItem')
    const fnEnd = fnStart + src.slice(fnStart).indexOf('\n}')
    const body = src.slice(fnStart, fnEnd)
    expect(body).toMatch(/and\(\s*eq\(teamKnowledgeItems\.id,\s*item\.id\),\s*eq\(teamKnowledgeItems\.revision,\s*baseRevision\)/)
  })

  it('reviseItem: update + writeRevision 放同一 db.transaction', () => {
    const fnStart = src.indexOf('export async function reviseItem')
    const fnEnd = fnStart + src.slice(fnStart).indexOf('\n}')
    const body = src.slice(fnStart, fnEnd)
    expect(body).toMatch(/db\.transaction\(/)
    expect(body).toMatch(/writeRevision\(/)
    // writeRevision 传 tx 参数（第二个位置参数）
    expect(body).toMatch(/writeRevision\(\s*\{[^}]+\},\s*tx,/)
  })

  it('reviseItem: 冲突时抛 RevisionConflictError（非 AppError 500）', () => {
    const fnStart = src.indexOf('export async function reviseItem')
    const fnEnd = fnStart + src.slice(fnStart).indexOf('\n}')
    const body = src.slice(fnStart, fnEnd)
    expect(body).toMatch(/throw new RevisionConflictError\(/)
    // 不再有裸的 AppError 500 ITEM_UPDATE_FAILED 兜底（旧行为把冲突当内部错误）
    expect(body).not.toMatch(/ITEM_UPDATE_FAILED/)
  })

  it('setItemStatus: UPDATE 带 AND revision = baseRevision + 事务', () => {
    const fnStart = src.indexOf('export async function setItemStatus')
    const fnEnd = fnStart + src.slice(fnStart).indexOf('\n}')
    const body = src.slice(fnStart, fnEnd)
    expect(body).toMatch(/eq\(teamKnowledgeItems\.revision,\s*baseRevision\)/)
    expect(body).toMatch(/db\.transaction\(/)
    expect(body).toMatch(/writeRevision\(\s*\{[^}]+\},\s*tx,/)
  })

  it('writeRevision: 签名接受可选 tx 参数', () => {
    // 函数定义应包含 tx?: 类型
    expect(src).toMatch(/tx\?:\s*Parameters/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
