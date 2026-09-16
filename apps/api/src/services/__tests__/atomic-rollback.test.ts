// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * atomic-rollback 单测(2026-09-17 立,#42)。
 * 真实临时工作区 fixture:快照 → 改/删/增 → plan diff → execute 恢复。
 * 覆盖安全门:confirm=false 不落刀;产物目录跳过;迁移文件仅报告不降级。
 */
import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createAtomicCheckpoint,
  listAtomicCheckpoints,
  planAtomicRollback,
  executeAtomicRollback,
} from '../atomic-rollback'

const tmpRoots: string[] = []
function makeWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-atomic-'))
  tmpRoots.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of tmpRoots) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
})

describe('createAtomicCheckpoint', () => {
  it('备份源文件(含 .env/依赖锁/迁移 SQL),跳过 node_modules 与超限语义目录', async () => {
    const ws = makeWorkspace()
    mkdirSync(join(ws, 'src'), { recursive: true })
    writeFileSync(join(ws, 'src', 'index.ts'), 'export const a = 1', 'utf-8')
    writeFileSync(join(ws, '.env'), 'DATABASE_URL=postgres://x', 'utf-8')
    writeFileSync(join(ws, 'pnpm-lock.yaml'), 'lockfileVersion: 9', 'utf-8')
    mkdirSync(join(ws, 'drizzle'), { recursive: true })
    writeFileSync(join(ws, 'drizzle', '0001_init.sql'), 'CREATE TABLE t(id int);', 'utf-8')
    mkdirSync(join(ws, 'node_modules', 'foo'), { recursive: true })
    writeFileSync(join(ws, 'node_modules', 'foo', 'x.js'), 'junk', 'utf-8')

    const snap = await createAtomicCheckpoint(ws, { description: '测试快照' })
    const paths = snap.meta.files.map((f) => f.path)
    expect(paths).toContain('src/index.ts')
    expect(paths).toContain('.env')
    expect(paths).toContain('pnpm-lock.yaml')
    expect(paths).toContain('drizzle/0001_init.sql')
    expect(paths.some((p) => p.startsWith('node_modules'))).toBe(false)
    expect(existsSync(join(snap.dir, 'files', 'src', 'index.ts'))).toBe(true)
  })
})

describe('planAtomicRollback', () => {
  it('diff 三分类:改动→restore、快照后新增→remove、未变→unchanged', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'a.txt'), 'v1', 'utf-8')
    writeFileSync(join(ws, 'b.txt'), 'same', 'utf-8')
    const snap = await createAtomicCheckpoint(ws, { description: 'd' })

    writeFileSync(join(ws, 'a.txt'), 'v2-changed', 'utf-8') // 改
    writeFileSync(join(ws, 'c-new.txt'), 'new', 'utf-8') // 增
    rmSync(join(ws, 'b.txt')) // 删(恢复类:本地缺失)

    const plan = await planAtomicRollback(ws, snap.meta.id)
    expect(plan).not.toBeNull()
    expect(plan!.restore.map((r) => r.path).sort()).toEqual(['a.txt', 'b.txt'])
    expect(plan!.remove.map((r) => r.path)).toEqual(['c-new.txt'])
    expect(plan!.unchanged).toBe(0)
  })

  it('不存在的快照 → null', async () => {
    expect(await planAtomicRollback(makeWorkspace(), 'ac-nope')).toBeNull()
  })
})

describe('executeAtomicRollback', () => {
  it('confirm=false:不落刀,返回安全提示 step', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'a.txt'), 'v1', 'utf-8')
    const snap = await createAtomicCheckpoint(ws, { description: 'd' })
    writeFileSync(join(ws, 'a.txt'), 'v2', 'utf-8')
    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: false })
    expect(result!.ok).toBe(false)
    expect(readFileSync(join(ws, 'a.txt'), 'utf-8')).toBe('v2') // 未被改动
  })

  it('confirm=true:整栈恢复(改写还原/删除新增/缺失补回),逐 step 审计', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'a.txt'), 'v1', 'utf-8')
    mkdirSync(join(ws, 'deep'), { recursive: true })
    writeFileSync(join(ws, 'deep', 'b.txt'), 'keep', 'utf-8')
    const snap = await createAtomicCheckpoint(ws, { description: 'd' })

    writeFileSync(join(ws, 'a.txt'), 'v2', 'utf-8') // 改
    rmSync(join(ws, 'deep', 'b.txt')) // 删
    writeFileSync(join(ws, 'new.txt'), 'new', 'utf-8') // 增

    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: true })
    expect(result!.ok).toBe(true)
    expect(readFileSync(join(ws, 'a.txt'), 'utf-8')).toBe('v1')
    expect(readFileSync(join(ws, 'deep', 'b.txt'), 'utf-8')).toBe('keep')
    expect(existsSync(join(ws, 'new.txt'))).toBe(false)
    expect(result!.steps.filter((s) => s.status === 'ok').length).toBeGreaterThanOrEqual(3)
  })

  it('依赖锁回滚 → suggestedFollowUps 提示 pnpm install(不自动执行)', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'pnpm-lock.yaml'), 'v1', 'utf-8')
    const snap = await createAtomicCheckpoint(ws, { description: 'd' })
    writeFileSync(join(ws, 'pnpm-lock.yaml'), 'v2', 'utf-8')
    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: true })
    expect(readFileSync(join(ws, 'pnpm-lock.yaml'), 'utf-8')).toBe('v1')
    expect(result!.suggestedFollowUps.join('\n')).toContain('pnpm install')
  })

  it('迁移文件差异 → 仅报告,不产生任何降级执行 step', async () => {
    const ws = makeWorkspace()
    const snap = await createAtomicCheckpoint(ws, { description: 'd' })
    mkdirSync(join(ws, 'drizzle'), { recursive: true })
    writeFileSync(join(ws, 'drizzle', '0002_add.sql'), 'DROP TABLE t;', 'utf-8')
    const plan = await planAtomicRollback(ws, snap.meta.id)
    expect(plan!.newMigrationFiles).toContain('drizzle/0002_add.sql')
    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: true })
    expect(result!.suggestedFollowUps.join('\n')).toContain('数据库降级')
    expect(result!.steps.every((s) => s.step !== '执行降级 SQL')).toBe(true)
    expect(existsSync(join(ws, 'drizzle', '0002_add.sql'))).toBe(false) // 作为新增文件被删除
  })
})

describe('listAtomicCheckpoints', () => {
  it('按新到旧返回快照元信息', async () => {
    const ws = makeWorkspace()
    writeFileSync(join(ws, 'a.txt'), '1', 'utf-8')
    const s1 = await createAtomicCheckpoint(ws, { description: 'first' })
    const s2 = await createAtomicCheckpoint(ws, { description: 'second' })
    const list = await listAtomicCheckpoints(ws)
    const ids = list.map((m) => m.id)
    expect(ids.indexOf(s2.meta.id)).toBeLessThan(ids.indexOf(s1.meta.id))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
