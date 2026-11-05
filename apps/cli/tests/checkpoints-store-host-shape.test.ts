// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// goal-b49 W3 落地锁:fs 适配层自 checkpoints/index.ts 抽到 snapshot-store-host.ts 之后 ——
// ① 拆分前后 index 的对外导出集逐字不变(值档 + 类型档两条腿);② 落盘/回滚/比对行为逐字等价;
// ③ 回收账面确有命令面消费方,且"判不出 ⇒ 不删"必须到得了人(AGENTS §0.3:未判定不得折成"通过")。
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Command } from 'commander'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../../../scripts/lib/scratch-dir.mjs' // arch-exempt: 测试夹具只能取 §26 唯一落点(禁 os.tmpdir/裸 mkdtemp),属测试面而非生产依赖边;正解=给"测试支持层"在策略表建档并降到 apps 之下 until 2026-12-28
import * as cpIndex from '../src/checkpoints/index.js'
import * as cpHost from '../src/checkpoints/snapshot-store-host.js'
import { CheckpointManager, type CheckpointMeta } from '../src/checkpoints/index.js'
import type { CheckpointDiffEntry, CheckpointManagerOptions } from '../src/checkpoints/index.js'
import { registerCheckpointCommand } from '../src/commands/checkpoint.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = (f: string) => fs.readFileSync(path.join(HERE, '..', 'src', f), 'utf-8')
const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '')
const sessionRoot = (sid: string) => path.join(os.homedir(), '.ihui', 'checkpoints', sid)
/** 本文件写进真实快照根的会话目录,收尾逐个摘净(不给他席留垃圾) */
const homeDirs: string[] = []
const trackedSession = (tag: string) => {
  const s = `w3-${tag}-${process.pid}`
  homeDirs.push(s)
  return s
}

// 基线 = 拆分前主面的导出读数(两面都现读过,不靠记忆):
//   `git show e423b7123f364a0d4545bc84936ee7f6dfa7a181:apps/cli/src/checkpoints/index.ts | grep -nE "^export"`
//     ⇒ 含 `export function isCheckpointMeta`
//   `git show 60d7094e0ad784aa24630adfd9c13e8a97884085:apps/cli/src/checkpoints/index.ts`(fix(knip) 降级无外部引用导出)
//     ⇒ 那一枚已降为模块内部函数 ⇒ 拆分不把它加回公开面,故基线取 knip 之后的公开面
const INDEX_VALUE_EXPORTS_AT_SPLIT = ['CheckpointManager', 'HunkTracker']
const INDEX_TYPE_EXPORTS_AT_SPLIT = [
  'CheckpointMeta',
  'CheckpointDiffEntry',
  'CheckpointManagerOptions',
]
/** 编译期腿:任一名字从 index 的导出集里消失,tsc 即报 TS2305/TS2694(运行期腿只管值档) */
const TYPE_LOCK: {
  meta?: CheckpointMeta
  diff?: CheckpointDiffEntry
  opts?: CheckpointManagerOptions
  hunk?: cpIndex.HunkTracker
} = {}
void TYPE_LOCK

describe('① 形状锁:拆分前后 index 的对外导出集逐字不变', () => {
  it('值档导出名与拆分前基线一字不差(不多一枚、不少一枚)', () => {
    expect(Object.keys(cpIndex).sort()).toEqual([...INDEX_VALUE_EXPORTS_AT_SPLIT].sort())
  })
  it('类型档导出名仍在 index 面上声明(文本腿:tests 不进 tsc include 也判得出)', () => {
    const index = SRC('checkpoints/index.ts')
    for (const name of INDEX_TYPE_EXPORTS_AT_SPLIT) expect(index).toContain(name)
    expect(index).toContain('export interface CheckpointManagerOptions')
    expect(index).toMatch(/export type \{ CheckpointDiffEntry, CheckpointMeta \} from '\.\/snapshot-store-host\.js'/)
    // 反向锁:knip 已降级的名字不得借这次拆分回到 index 的公开面
    expect(index).not.toMatch(/export \{[^}]*isCheckpointMeta/)
  })
  it('fs 适配层全在 host:index 不再碰 node:fs,host 确有编排层要用的那些动作', () => {
    const index = SRC('checkpoints/index.ts')
    expect(index).not.toMatch(/from 'node:fs'/)
    expect(index).not.toMatch(/\bfs\.[a-zA-Z]/)
    for (const name of [
      'copyFilesIntoSnapshot',
      'diffSnapshotFiles',
      'ensureHostDir',
      'listEntryNames',
      'listSubDirNames',
      'measureSnapshotBytes',
      'readSnapshotMeta',
      'removeSnapshotDir',
      'restoreSnapshotFiles',
      'snapshotRootExists',
      'snapshotRootDir',
      'writeSnapshotManifest',
    ]) {
      expect(Object.keys(cpHost)).toContain(name)
    }
    // isCheckpointMeta 只作宿主内部函数(HEAD 面已降级)⇒ 宿主也不把它当公开面
    expect(Object.keys(cpHost)).not.toContain('isCheckpointMeta')
  })
  it('AGENTS §3:两个文件都 <250 行(含水印行,与 wc -l 同口径现读)', () => {
    // wc -l 数的是换行终止的行;末尾换行不额外算一行(主席现读 index.ts = 397 行即此口径)
    const wcLines = (f: string) => {
      const c = SRC(f)
      return c.split(/\r?\n/).length - (c.endsWith('\n') ? 1 : 0)
    }
    for (const f of ['checkpoints/index.ts', 'checkpoints/snapshot-store-host.ts']) {
      const lines = wcLines(f)
      expect(lines, `${f} 现读 ${lines} 行`).toBeLessThan(250)
    }
  })
})

describe('② 行为等价:抽层后快照/回滚/比对与拆分前同形', () => {
  let scratch = ''
  let ws = ''
  beforeAll(() => {
    scratch = mkScratch('w3-store-host-shape-')
    ws = path.join(scratch, 'ws')
    fs.mkdirSync(ws, { recursive: true })
  })
  afterAll(() => rmScratch(scratch))

  it('snapshot → 改文件 → diff → restore:清单与内容都回到快照那一刻', async () => {
    const file = path.join(ws, 'a.txt')
    fs.writeFileSync(file, 'one', 'utf-8')
    const mgr = new CheckpointManager({ sessionId: trackedSession('shape-a'), workspacePath: ws })
    const meta = mgr.snapshotSync([file], 'r0')
    expect(meta.files['a.txt']).toBe('snap')
    fs.writeFileSync(file, 'two', 'utf-8')
    expect(mgr.diff(meta.id)).toEqual([{ path: 'a.txt', status: 'modified' }])
    expect(await mgr.restore(meta.id)).toEqual({ restored: ['a.txt'], removed: [] })
    expect(fs.readFileSync(file, 'utf-8')).toBe('one')
    expect(mgr.diff(meta.id)).toEqual([])
  })
  it('工作区外路径仍按原文案抛错;added 档 restore 时删除新建文件', async () => {
    const mgr = new CheckpointManager({ sessionId: trackedSession('shape-b'), workspacePath: ws })
    expect(() => mgr.snapshotSync([path.resolve(scratch, '..', 'outside.txt')], 'r')).toThrow(
      /不在工作区 .* 内$/,
    )
    const fresh = path.join(ws, 'fresh.txt')
    const m2 = mgr.snapshotSync([fresh], 'added-case')
    expect(m2.files['fresh.txt']).toBe('added')
    fs.writeFileSync(fresh, 'x', 'utf-8')
    expect(await mgr.restore(m2.id)).toEqual({ restored: [], removed: ['fresh.txt'] })
    expect(fs.existsSync(fresh)).toBe(false)
  })
})

describe('③ 消费方:GC 账面必须上到命令面,未判定不折成通过', () => {
  let scratch = ''
  let infos: string[] = []
  let warns: string[] = []
  let origInfo: typeof console.info
  let origWarn: typeof console.warn

  async function runCliSnapshot(session: string, workspace: string, file: string) {
    const program = new Command()
    program.exitOverride().configureOutput({ writeOut: () => {}, writeErr: () => {} })
    program.option('-w, --workspace <dir>', '工作区')
    registerCheckpointCommand(program)
    await program.parseAsync(
      ['checkpoint', 'snapshot', file, '--session', session, '--workspace', workspace],
      { from: 'user' },
    )
  }

  beforeAll(() => {
    scratch = mkScratch('w3-gc-cli-')
    origInfo = console.info
    origWarn = console.warn
    console.info = (...a: unknown[]) => {
      infos.push(stripAnsi(String(a[0] ?? '')))
    }
    console.warn = (...a: unknown[]) => {
      warns.push(stripAnsi(String(a[0] ?? '')))
    }
  })
  afterAll(() => {
    console.info = origInfo
    console.warn = origWarn
    for (const s of homeDirs) fs.rmSync(sessionRoot(s), { recursive: true, force: true })
    rmScratch(scratch)
  })

  it('判过且无需删除 ⇒ 状态与四段计数逐条说出口(stdout)', async () => {
    const session = trackedSession('gc-clean')
    const ws = path.join(scratch, 'ws-clean')
    fs.mkdirSync(ws, { recursive: true })
    const file = path.join(ws, 'a.txt')
    fs.writeFileSync(file, 'v', 'utf-8')
    infos = []
    warns = []
    await runCliSnapshot(session, ws, file)
    const line = infos.find((l) => l.includes('快照回收账'))
    expect(line).toBeDefined()
    expect(line).toContain('状态 clean')
    expect(line).toMatch(/已删 版本序列 0 枚 \/ 历史 cp_ 0 枚/)
    expect(line).toMatch(/候选 1 枚/)
    expect(infos.some((l) => l.includes('全部落在保留档内,无需删除'))).toBe(true)
    expect(warns.filter((l) => l.includes('快照回收账'))).toEqual([])
  })

  it('判不出 ⇒ stderr 点名 + 明写「未判定 ≠ 通过」,那一枚旧版确实没被删', async () => {
    const session = trackedSession('gc-und')
    const ws = path.join(scratch, 'ws-und')
    fs.mkdirSync(ws, { recursive: true })
    const file = path.join(ws, 'a.txt')
    const mgr = new CheckpointManager({ sessionId: session, workspacePath: ws })
    const ids: string[] = []
    for (let i = 0; i < 22; i++) {
      fs.writeFileSync(file, `s${i}`, 'utf-8')
      ids.push(mgr.snapshotSync([file], `r${i}`).id)
    }
    const uuid = ids[0]!.split('@')[0]!
    const doomedV1 = path.join(sessionRoot(session), `${uuid}@v1`)
    fs.writeFileSync(path.join(doomedV1, 'manifest.json'), '{ 不是合法 JSON', 'utf-8')
    infos = []
    warns = []
    fs.writeFileSync(file, 'last', 'utf-8')
    await runCliSnapshot(session, ws, file)
    const head = warns.find((l) => l.includes('快照回收账'))
    expect(head).toBeDefined()
    expect(head).toContain('未判定 ≠ 通过')
    expect(head).toMatch(/已删 版本序列 0 枚/)
    expect(warns.some((l) => /未判定 \S+@v1: manifest-corrupt/.test(l))).toBe(true)
    expect(warns.some((l) => l.includes('deletions 置空,不记绿也不冒红'))).toBe(true)
    expect(infos.filter((l) => l.includes('快照回收账'))).toEqual([])
    expect(fs.existsSync(path.join(sessionRoot(session), `${uuid}@v23`))).toBe(true)
    expect(fs.existsSync(doomedV1)).toBe(true)
  })

  it('历史 cp_ 清账枚数与版本序列分列(notes 里没有这一档,账面必须有)', async () => {
    const session = trackedSession('gc-legacy')
    const ws = path.join(scratch, 'ws-legacy')
    const root = sessionRoot(session)
    fs.mkdirSync(ws, { recursive: true })
    fs.mkdirSync(root, { recursive: true })
    const base = Date.UTC(2020, 0, 1)
    const legacyId = (i: number) => `cp_${base + i * 1000}_s${i}`
    for (let i = 0; i < 21; i++) {
      fs.mkdirSync(path.join(root, legacyId(i)), { recursive: true })
      const meta: CheckpointMeta = {
        id: legacyId(i),
        sessionId: session,
        createdAt: new Date(base + i * 1000).toISOString(),
        reason: 'seed',
        files: {},
      }
      fs.writeFileSync(path.join(root, legacyId(i), 'manifest.json'), JSON.stringify(meta), 'utf-8')
    }
    const file = path.join(ws, 'a.txt')
    fs.writeFileSync(file, 'v', 'utf-8')
    infos = []
    warns = []
    await runCliSnapshot(session, ws, file)
    const line = infos.find((l) => l.includes('快照回收账'))
    expect(line).toBeDefined()
    expect(line).toMatch(/已删 版本序列 0 枚 \/ 历史 cp_ 1 枚/)
    expect(fs.existsSync(path.join(root, legacyId(0)))).toBe(false)
    expect(fs.existsSync(path.join(root, legacyId(20)))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
