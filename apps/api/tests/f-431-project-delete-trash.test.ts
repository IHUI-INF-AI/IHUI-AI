// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-431 回归锁:删除项目必须连回收站(软删)文件的磁盘 blob 一起清理。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-431):
 *   项目内文件先软删(deletedAt 非空),listFilesByProject 过滤 deletedAt,软删文件不在
 *   清理列表;删项目后 DB 行级联消失,磁盘路径再无人可清 ⇒ blob 永久成孤儿,磁盘只增不减。
 *
 * 修复:新增 listFilesByProjectIncludeTrashed(不加 isNull(deletedAt)),删项目改用它,
 *   使软删文件也进入 unlink 循环;列表展示仍走排除回收站的 listFilesByProject。
 *
 * 本锁为源码接线锁(与仓库 f-162 同型)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const wqSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/db/workspace-queries.ts'), 'utf8')
const wsSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/routes/workspace.ts'), 'utf8')

describe('F-431:删除项目必须连回收站软删文件一起清磁盘', () => {
  it('查询锁:存在「按项目列出含软删文件」的查询,且 where 不过滤 deletedAt', () => {
    const start = wqSrc.indexOf('export async function listFilesByProjectIncludeTrashed')
    expect(start).toBeGreaterThan(-1)
    const body = wqSrc.slice(start, wqSrc.indexOf('\n}', start))
    expect(body).toMatch(/\.where\(eq\(files\.projectId, projectId\)\)/)
    expect(body).not.toMatch(/isNull\(files\.deletedAt\)/)
    expect(body).toMatch(/\.from\(files\)/)
  })

  it('接线锁:删除项目改用含回收站的查询,unlink 循环仍遍历 f.path', () => {
    const start = wsSrc.indexOf('删除项目关联的文件')
    expect(start).toBeGreaterThan(-1)
    const seg = wsSrc.slice(start, start + 600)
    expect(seg).toMatch(/await listFilesByProjectIncludeTrashed\(id\)/)
    expect(seg).toMatch(/unlinkSync\(f\.path\)/)
    // 不得回退成只遍历未删文件
    expect(seg).not.toMatch(/await listFilesByProject\(id\)/)
  })

  it('对照锁:列表展示仍用 listFilesByProject(排除回收站),未被误改', () => {
    expect(wsSrc).toMatch(/const fileList = await listFilesByProject\(id\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
