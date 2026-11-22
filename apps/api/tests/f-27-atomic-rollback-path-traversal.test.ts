// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-27 回归锁(2026-11-11)。
 *
 * 病灶:原子回滚把 checkpointId 与 meta.files[].path 直接 join 到快照根/工作区,
 *       `path.join` 会折叠 `..` ⇒ 越出工作区任意读写(路由层此前也只限长度不限字符集)。
 * 判据:checkpointId 仅 [A-Za-z0-9_-];meta 内的 `../`、反斜杠穿越、绝对路径(含盘符)
 *       一律在 resolve 后被判越界并拒绝;正常相对路径(如 src/a.ts)行为不变。
 * 全部夹具落在 os.tmpdir 的 mkdtemp 下,不写仓库内任何文件。
 */
import { describe, it, expect, afterAll } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createAtomicCheckpoint,
  executeAtomicRollback,
  isSafeCheckpointId,
  planAtomicRollback,
} from '../src/services/atomic-rollback.js'

interface RawMeta {
  files: { path: string; existed: boolean; hash: string; size: number }[]
  skipped: { path: string; reason: string }[]
}

const tmpRoots: string[] = []

function makeRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-f27-'))
  tmpRoots.push(dir)
  return dir
}

function readMeta(dir: string): RawMeta {
  return JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf-8')) as RawMeta
}

afterAll(() => {
  for (const dir of tmpRoots) {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // 临时目录清理失败不影响用例判定
    }
  }
})

describe('F-27 checkpointId 越界', () => {
  it('`../x`、反斜杠穿越、绝对路径一律拒绝:不读外部 meta、不写工作区外文件', async () => {
    const root = makeRoot()
    // 工作区下沉两级:meta 里的 `../../evil.txt` 归一后正好落在 root/evil.txt(可断言)
    const ws = join(root, 'a', 'b')
    mkdirSync(join(ws, 'x', 'files'), { recursive: true })
    writeFileSync(join(ws, 'a.txt'), 'keep', 'utf-8')
    writeFileSync(join(root, 'evil.txt'), 'SAFE', 'utf-8')
    writeFileSync(join(ws, 'x', 'evil.txt'), 'PWNED', 'utf-8')
    // 票据复现夹具:checkpointId="../../x" 时 join 会归一到这里
    writeFileSync(
      join(ws, 'x', 'meta.json'),
      JSON.stringify({
        id: 'x',
        createdAt: new Date().toISOString(),
        description: '',
        tool: 'test',
        files: [{ path: '../../evil.txt', existed: true, hash: '0000', size: 5 }],
        skipped: [],
      }),
      'utf-8',
    )

    const candidates = ['../x', '..\\x', join(ws, 'x'), 'ac-1/x']
    for (const id of candidates) {
      expect(isSafeCheckpointId(id)).toBe(false)
      expect(await planAtomicRollback(ws, id)).toBeNull()
      expect(await executeAtomicRollback(ws, id, { confirm: true })).toBeNull()
    }
    expect(readFileSync(join(root, 'evil.txt'), 'utf-8')).toBe('SAFE')
    expect(readFileSync(join(ws, 'a.txt'), 'utf-8')).toBe('keep')
  })
})

describe('F-27 快照 meta 内文件路径越界', () => {
  it('`../../`、反斜杠穿越、绝对路径条目被拒绝:不 restore,也不写出工作区', async () => {
    const root = makeRoot()
    const ws = join(root, 'a', 'b')
    mkdirSync(join(ws, 'src'), { recursive: true })
    writeFileSync(join(ws, 'src', 'a.ts'), 'v1', 'utf-8')
    writeFileSync(join(root, 'evil.txt'), 'SAFE', 'utf-8')
    const absVictim = join(root, 'abs-evil.txt')
    writeFileSync(absVictim, 'SAFE', 'utf-8')

    const snap = await createAtomicCheckpoint(ws, { description: 'f27' })
    // 旧实现的越界读源:join(filesDir, "../../evil.txt") 归一到这里,内容为攻击载荷
    writeFileSync(join(ws, '.ihui', 'atomic-checkpoints', 'evil.txt'), 'PWNED', 'utf-8')

    const meta = readMeta(snap.dir)
    meta.files.push(
      { path: '../../evil.txt', existed: true, hash: '0000', size: 5 },
      { path: '..\\..\\evil.txt', existed: true, hash: '0000', size: 5 },
      { path: absVictim, existed: true, hash: '0000', size: 5 },
    )
    writeFileSync(join(snap.dir, 'meta.json'), JSON.stringify(meta), 'utf-8')

    const plan = await planAtomicRollback(ws, snap.meta.id)
    expect(plan).not.toBeNull()
    const restorePaths = plan!.restore.map((r) => r.path)
    expect(restorePaths.some((p) => p.includes('..'))).toBe(false)
    expect(restorePaths).not.toContain(absVictim)
    // 不是静默丢弃:越界条目必须进 uncovered 审计面
    expect(plan!.uncovered.some((u) => u.path === '../../evil.txt')).toBe(true)

    expect(await executeAtomicRollback(ws, snap.meta.id, { confirm: true })).not.toBeNull()
    expect(readFileSync(join(root, 'evil.txt'), 'utf-8')).toBe('SAFE')
    expect(readFileSync(absVictim, 'utf-8')).toBe('SAFE')
    expect(readFileSync(join(ws, 'src', 'a.ts'), 'utf-8')).toBe('v1')
  })
})

describe('F-27 正常相对路径行为不变', () => {
  it('src/a.ts 仍能进 restore 并写回快照内容', async () => {
    const ws = join(makeRoot(), 'ws')
    mkdirSync(join(ws, 'src'), { recursive: true })
    writeFileSync(join(ws, 'src', 'a.ts'), 'v1', 'utf-8')
    const snap = await createAtomicCheckpoint(ws, { description: 'ok' })

    writeFileSync(join(ws, 'src', 'a.ts'), 'v2-changed', 'utf-8')
    const plan = await planAtomicRollback(ws, snap.meta.id)
    expect(plan!.restore.map((r) => r.path)).toContain('src/a.ts')

    const result = await executeAtomicRollback(ws, snap.meta.id, { confirm: true })
    expect(result!.ok).toBe(true)
    expect(readFileSync(join(ws, 'src', 'a.ts'), 'utf-8')).toBe('v1')
    expect(plan!.uncovered).toEqual([])
    expect(existsSync(join(ws, '.ihui', 'atomic-checkpoints', snap.meta.id))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
