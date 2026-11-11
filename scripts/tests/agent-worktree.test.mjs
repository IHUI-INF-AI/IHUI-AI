// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `agent-worktree.mjs` 镜像测试。钉:① 名字规范化(落点/分支/标签同源);② 落点必须是根直属
 * `.worktrees/wt-<名>`(AGENTS §12h,不许自造第二套);③ porcelain 解析;④ 保活标签截 7 位。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { __test__ as aw } from '../agent-worktree.mjs'

test('① 名字规范化:非法字符转连字符、去首尾、空名抛', () => {
  assert.equal(aw.normalizeName('Land 20261025'), 'land-20261025')
  assert.equal(aw.normalizeName('  Wt-01 '), 'wt-01')
  assert.equal(aw.normalizeName('a/b\\c'), 'a-b-c')
  assert.throws(() => aw.normalizeName('!!!'), /不能为空/)
  assert.throws(() => aw.normalizeName('x'.repeat(41)), /过长/)
})

test('② 落点与分支同源于 §12h 约定', () => {
  assert.equal(aw.worktreePathOf('abc', '/repo').replace(/\\/g, '/'), '/repo/.worktrees/wt-abc')
  assert.equal(aw.branchOf('abc'), 'wt/abc')
  assert.equal(aw.worktreePathOf('Land X', '/repo'), join('/repo', '.worktrees', 'wt-land-x'))
})

test('③ porcelain 解析:路径/HEAD/分支三列', () => {
  const out = [
    'worktree D:/IHUI-AI-git-repo',
    'HEAD c05ca0d5000e',
    'branch refs/heads/main',
    '',
    'worktree D:/IHUI-AI/.worktrees/wt-x',
    'HEAD abc123',
    'branch refs/heads/wt/x',
    '',
  ].join('\n')
  const rows = aw.parseWorktreeList(out)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].branch, 'main')
  assert.equal(rows[1].branch, 'wt/x')
  assert.equal(rows[1].sha, 'abc123')
})

test('④ 未合并回收的保活标签名', () => {
  assert.equal(aw.lostTagOf('abc', '0123456789abcdef'), 'lost-commit/worktree-abc-0123456')
})

test('⑤ porcelain 的 locked/prunable/detached 标记', () => {
  const rows = aw.parseWorktreeList(
    [
      'worktree G:/IHUI-AI/.worktrees/wt-y',
      'HEAD def456',
      'branch refs/heads/wt/y',
      'locked needs review',
      '',
      'worktree G:/gone/wt-z',
      'HEAD 789abc',
      'detached',
      'prunable gitdir file points to non-existent location',
      '',
    ].join('\n'),
  )
  assert.equal(rows[0].locked, 'needs review')
  assert.equal(rows[0].prunable, false)
  assert.equal(rows[1].detached, true)
  assert.equal(rows[1].prunable, true)
})

test('⑥ 批量回收判定:批准落点内、干净、已并入且超龄即收(2026-11-04 起不按分支名收口)', () => {
  const now = 1 + 30 * 86_400_000
  const base = {
    path: '/repo/.worktrees/wt-a',
    branch: 'wt/a',
    merged: true,
    lastActivityMs: 1,
    now,
    worktreesRoot: '/repo/.worktrees',
  }
  assert.equal(aw.evaluateReapCandidate(base).action, 'remove')
  assert.equal(aw.evaluateReapCandidate({ ...base, locked: true }).action, 'skip')
  assert.equal(aw.evaluateReapCandidate({ ...base, dirty: true }).action, 'skip')
  assert.equal(aw.evaluateReapCandidate({ ...base, merged: false }).action, 'skip')
  // 旧命名闸已摘:任意分支名不再被拦;形态判不出(无分支且非 detached)才保守保留。
  assert.equal(aw.evaluateReapCandidate({ ...base, branch: 'feature/x' }).action, 'remove')
  assert.equal(aw.evaluateReapCandidate({ ...base, branch: '' }).action, 'skip')
  assert.equal(aw.evaluateReapCandidate({ ...base, branch: '', detached: true }).action, 'remove')
  assert.equal(aw.evaluateReapCandidate({ ...base, branch: '', detached: true, merged: false }).action, 'skip')
  assert.equal(aw.evaluateReapCandidate({ ...base, path: '/elsewhere/wt-a' }).action, 'skip')
  assert.equal(aw.evaluateReapCandidate({ ...base, minIdleDays: 31 }).action, 'skip')
  assert.equal(aw.evaluateReapCandidate({ ...base, lastActivityMs: 0 }).action, 'skip')
  assert.equal(aw.isUnderWorktreesRoot('/repo/.worktrees/wt-a', '/repo'), true)
  assert.equal(aw.isUnderWorktreesRoot('/repo/.worktrees-x/wt-a', '/repo'), false)
})

/**
 * ⑦–⑩ 孤儿目录壳判据镜像(2026-11-11):`git worktree prune` 只注销元数据、从不删目录,
 * 而回收器只遍历 `git worktree list` ⇒ 已注销的目录壳结构性进不了射程。本组钉住补上的那格:
 * 判据一律 import 源脚本 `__test__`,不复制第二份(§22c)。
 */
const ORPHAN_BASE = {
  root: '/repo/IHUI-AI',
  worktreesRoot: '/repo/IHUI-AI/.worktrees',
  gitDirPath: '/repo/IHUI-AI-git-repo',
  now: 1 + 30 * 86_400_000,
  minIdleDays: 1,
  graceDays: 1,
  registeredPaths: [],
  hasGitPointer: false,
  hasCheckoutMarkers: true,
  dirMtimeMs: 1,
}

test('⑦ 孤儿目录壳:首次发现只改名墓碑,绝不直接删', () => {
  const base = { ...ORPHAN_BASE, path: '/repo/IHUI-AI-merge-wt' }
  assert.equal(aw.evaluateOrphanDir(base).action, 'tombstone')
  assert.equal(
    aw.evaluateOrphanDir({ ...base, registeredPaths: [base.path] }).action,
    'skip',
    '仍在登记面 ⇒ 归正常回收腿',
  )
  assert.equal(aw.evaluateOrphanDir({ ...base, path: '/repo/IHUI-AI-git-repo' }).action, 'skip')
  assert.equal(aw.evaluateOrphanDir({ ...base, path: '/repo/IHUI-AI' }).action, 'skip')
  assert.equal(aw.evaluateOrphanDir({ ...base, path: '/elsewhere/x' }).action, 'skip')
  assert.equal(aw.evaluateOrphanDir({ ...base, hasGitPointer: true }).action, 'skip')
  assert.equal(aw.evaluateOrphanDir({ ...base, isSymlink: true }).action, 'skip')
  assert.equal(aw.evaluateOrphanDir({ ...base, isDirectory: false }).action, 'skip')
  assert.equal(aw.evaluateOrphanDir({ ...base, dirMtimeMs: 0 }).action, 'skip')
  assert.equal(aw.evaluateOrphanDir({ ...base, dirMtimeMs: ORPHAN_BASE.now - 3_600_000 }).action, 'skip')
})

test('⑧ 兄弟检出三件套闸:备份/密钥/凭据目录一律不进射程', () => {
  const base = { ...ORPHAN_BASE, path: '/repo/IHUI-AI-backups' }
  assert.equal(aw.evaluateOrphanDir({ ...base, hasCheckoutMarkers: false }).action, 'skip')
  // 仓内 .worktrees/ 按落点定义不受该闸限制(空壳也要能收)
  assert.equal(
    aw.evaluateOrphanDir({
      ...base,
      path: '/repo/IHUI-AI/.worktrees/wt-empty',
      hasCheckoutMarkers: false,
    }).action,
    'tombstone',
  )
})

test('⑨ 常驻专用槽位(每小时发版用)不得被孤儿腿回收', () => {
  assert.equal(
    aw.evaluateOrphanDir({
      ...ORPHAN_BASE,
      path: '/repo/IHUI-AI/.worktrees/mobile-auto',
      hasCheckoutMarkers: false,
    }).action,
    'skip',
  )
  assert.ok(aw.PROTECTED_ORPHAN_SLOTS.has('mobile-auto'))
  assert.deepEqual(aw.CHECKOUT_MARKERS, ['package.json', 'pnpm-workspace.yaml', 'README.md'])
})

test('⑩ 两段式墓碑:观察期未满保留,期满才真删', () => {
  const now = ORPHAN_BASE.now
  const fresh = aw.tombstonePathOf('/repo/IHUI-AI-merge-wt', now - 3_600_000)
  const expired = aw.tombstonePathOf('/repo/IHUI-AI-merge-wt', now - 2 * 86_400_000)
  assert.match(fresh, /\.stale-\d{10,}$/)
  assert.equal(aw.evaluateOrphanDir({ ...ORPHAN_BASE, path: fresh }).action, 'skip')
  assert.equal(aw.evaluateOrphanDir({ ...ORPHAN_BASE, path: expired }).action, 'remove')
})

/** ⑪–⑯:孤儿目录壳清扫腿的动作层与新增安全闸(2026-11-11 续),判据仍一律 import 源脚本 __test__。 */
test('⑪ 动作层 reapOrphanDirs 端到端:首轮只打墓碑、观察期满才真删,无三件套兄弟目录全程不碰', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'ihui-orphan-reap-'))
  try {
    const root = join(sandbox, 'IHUI-AI')
    const worktreesRoot = join(root, '.worktrees')
    mkdirSync(worktreesRoot, { recursive: true })

    const now = Date.now()
    const old = new Date(now - 3 * 86_400_000)

    // ① 仓内空壳:无三件套也不受兄弟三件套闸限制(按落点定义,空壳也要能收)
    const shell = join(worktreesRoot, 'wt-empty')
    mkdirSync(shell)
    utimesSync(shell, old, old)

    // ② 带 CHECKOUT_MARKERS 三件套、mtime 3 天前的同盘兄弟检出
    const checkout = join(sandbox, 'IHUI-AI-wt-orphan')
    mkdirSync(checkout)
    for (const f of aw.CHECKOUT_MARKERS) writeFileSync(join(checkout, f), '')
    utimesSync(checkout, old, old)

    // ③ 无三件套的兄弟目录(模拟常驻 backups):扫进候选也必须两道闸都挡住
    const backups = join(sandbox, 'IHUI-AI-backups')
    mkdirSync(backups)
    utimesSync(backups, old, old)

    const first = aw.reapOrphanDirs({
      root,
      worktreesRoot,
      now,
      minIdleDays: 1,
      graceDays: 1,
      apply: true,
    })
    assert.ok(first.tombstoned >= 2, `首轮应给 ①② 各打一枚墓碑,实得 ${first.tombstoned}`)
    assert.equal(first.purged, 0, '首轮绝不真删')
    assert.equal(first.failed, 0, '首轮零失败')
    assert.equal(existsSync(shell), false, '① 原名应已随改名消失')
    assert.equal(existsSync(checkout), false, '② 原名应已随改名消失')
    // 墓碑命名只认源脚本那一份(§22c),不复制第二套正则/时间戳格式
    const shellTomb = aw.tombstonePathOf(shell, now)
    const checkoutTomb = aw.tombstonePathOf(checkout, now)
    assert.match(shellTomb, aw.ORPHAN_TOMBSTONE_RE, '① 应变成 .stale-* 墓碑')
    assert.match(checkoutTomb, aw.ORPHAN_TOMBSTONE_RE, '② 应变成 .stale-* 墓碑')
    assert.equal(existsSync(shellTomb), true, '① 墓碑落盘')
    assert.equal(existsSync(checkoutTomb), true, '② 墓碑落盘')
    assert.equal(existsSync(backups), true, '③ 无三件套兄弟目录(模拟 backups)原名仍在')

    // now 推后 2 天:墓碑死亡戳老化 ≥ graceDays ⇒ 真删;③ 依然不进射程
    const second = aw.reapOrphanDirs({
      root,
      worktreesRoot,
      now: now + 2 * 86_400_000,
      minIdleDays: 1,
      graceDays: 1,
      apply: true,
    })
    assert.ok(second.purged >= 2, `观察期满应真删 ≥2 枚墓碑,实得 ${second.purged}`)
    assert.equal(existsSync(shellTomb), false, '① 墓碑应已消失')
    assert.equal(existsSync(checkoutTomb), false, '② 墓碑应已消失')
    assert.equal(existsSync(backups), true, '③ 两轮后仍在')
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
})

test('⑫ derived-heal 常驻槽位:guardian 每 30 分钟复用的临时槽位不得被孤儿腿回收', () => {
  assert.deepEqual(
    aw.PROTECTED_ORPHAN_SLOTS,
    new Set(['mobile-auto', 'derived-heal']),
    '集合必须同时保护 mobile-auto 与 derived-heal',
  )
  assert.equal(aw.PROTECTED_ORPHAN_SLOTS.has('derived-heal'), true)
  assert.equal(
    aw.evaluateOrphanDir({
      ...ORPHAN_BASE,
      path: '/repo/IHUI-AI/.worktrees/derived-heal',
      hasCheckoutMarkers: false,
    }).action,
    'skip',
    'derived-heal 是 guardian 复用的临时槽位,即便空壳也必须保留',
  )
})

test('⑬ PROTECTED_ORPHAN_SIBLINGS:常驻兄弟目录即便带三件套也一律 skip', () => {
  assert.deepEqual(
    aw.PROTECTED_ORPHAN_SIBLINGS,
    new Set(['IHUI-AI-backups', 'IHUI-AI-keys', 'IHUI-AI-git-repo']),
  )
  // 关键:带三件套时三件套闸本会放行,只能靠名字集合挡住 ⇒ 常数住兄弟目录不进射程
  assert.equal(
    aw.evaluateOrphanDir({
      ...ORPHAN_BASE,
      path: '/repo/IHUI-AI-backups',
      hasCheckoutMarkers: true,
    }).action,
    'skip',
    '带三件套的 IHUI-AI-backups 仍不得被判成孤儿(否则三件套闸一放行就误删备份)',
  )
})

test('⑭ 墓碑正则已提前:丢了特征文件、仍带 .git 指针也按死亡戳判龄,不永久滞留', () => {
  const expired = aw.tombstonePathOf('/repo/IHUI-AI-merge-wt', ORPHAN_BASE.now - 2 * 86_400_000)
  assert.match(expired, aw.ORPHAN_TOMBSTONE_RE)
  assert.equal(
    aw.evaluateOrphanDir({
      ...ORPHAN_BASE,
      path: expired,
      hasCheckoutMarkers: false,
      hasGitPointer: true,
    }).action,
    'remove',
    '墓碑分支必须早于 .git 指针 / 三件套两道启发式闸,否则墓碑会永远留在盘上',
  )
})

test('⑮ Windows 盘符大小写混写:gitdir / 登记面仍认作同一路径,不得判成可收', () => {
  // 混写方向:root 大写 D:、path 小写 d:。其余安全闸一律放行,只留"路径比较是否统一小写化"一个变量。
  const mixed = {
    ...ORPHAN_BASE,
    root: 'D:/repo/IHUI-AI',
    worktreesRoot: 'D:/repo/IHUI-AI/.worktrees',
    hasCheckoutMarkers: true,
  }
  // ① 登记面:大写 D: 登记 vs 小写 d: path,仍须认作同一条登记
  assert.equal(
    aw.evaluateOrphanDir({
      ...mixed,
      path: 'd:/repo/IHUI-AI-merge-wt',
      registeredPaths: ['D:/repo/IHUI-AI-merge-wt'],
    }).action,
    'skip',
    '登记面大小写混写不得把已登记检出判成可收',
  )
  // ② 隔离批准落点变量:root 与 path 同用小写 d:,只登记面大写 ⇒ 精确钉住登记面比较的小写化
  assert.equal(
    aw.evaluateOrphanDir({
      ...ORPHAN_BASE,
      root: 'd:/repo/IHUI-AI',
      worktreesRoot: 'd:/repo/IHUI-AI/.worktrees',
      path: 'd:/repo/IHUI-AI-merge-wt',
      registeredPaths: ['D:/repo/IHUI-AI-merge-wt'],
      hasCheckoutMarkers: true,
    }).action,
    'skip',
    '登记面比较必须统一小写化(否则会退化成 tombstone)',
  )
  // ③ gitdir:大写 D: gitDirPath vs 小写 d: path,删它会毁仓
  assert.equal(
    aw.evaluateOrphanDir({
      ...mixed,
      path: 'd:/repo/IHUI-AI-git-repo',
      gitDirPath: 'D:/repo/IHUI-AI-git-repo',
    }).action,
    'skip',
    'gitdir 大小写混写不得被判成可收',
  )
})

test('⑯ explicitPurge:true 显式点名直删(reason 带「显式点名」),默认仍先打墓碑', () => {
  const base = { ...ORPHAN_BASE, path: '/repo/IHUI-AI-merge-wt' }
  const purge = aw.evaluateOrphanDir({ ...base, explicitPurge: true })
  assert.equal(purge.action, 'remove')
  assert.match(purge.reason, /显式点名/, '显式点名的结论必须可自证')
  assert.equal(aw.evaluateOrphanDir(base).action, 'tombstone', '默认首次发现只打可逆墓碑')
  assert.equal(
    aw.evaluateOrphanDir({ ...base, explicitPurge: true, registeredPaths: [base.path] }).action,
    'skip',
    '显式点名也不越过安全闸',
  )
})

test('⑰ M2:dry-run 计划数独立,绝不把"将删"计成"已删",且零写入', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'ihui-orphan-dry-'))
  try {
    const root = join(sandbox, 'IHUI-AI')
    const worktreesRoot = join(root, '.worktrees')
    mkdirSync(worktreesRoot, { recursive: true })
    const shell = join(worktreesRoot, 'wt-empty')
    mkdirSync(shell)
    const old = new Date(Date.now() - 3 * 86_400_000)
    utimesSync(shell, old, old)

    const r = aw.reapOrphanDirs({
      root,
      worktreesRoot,
      now: Date.now(),
      minIdleDays: 1,
      graceDays: 1,
      apply: false,
    })
    assert.equal(r.plannedTombstone, 1, '应预告 1 枚墓碑')
    assert.equal(r.plannedPurge, 0, '首次发现不得预告真删')
    assert.equal(r.tombstoned, 0, 'dry-run 不得计入已打墓碑')
    assert.equal(r.purged, 0, 'dry-run 不得计入已回收(否则调度层会把"将删"读成"已删")')
    assert.equal(r.failed, 0)
    assert.equal(existsSync(shell), true, 'dry-run 零写入')
    assert.match(r.lines.join('\n'), /dry-run/)
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
})

test('⑱ I4:另一进程持锁时本轮孤儿腿跳过,不误报失败且零动作', () => {
  const sandbox = mkdtempSync(join(tmpdir(), 'ihui-orphan-lock-'))
  try {
    const root = join(sandbox, 'IHUI-AI')
    const worktreesRoot = join(root, '.worktrees')
    mkdirSync(worktreesRoot, { recursive: true })
    const shell = join(worktreesRoot, 'wt-empty')
    mkdirSync(shell)
    const old = new Date(Date.now() - 3 * 86_400_000)
    utimesSync(shell, old, old)

    // 锁路径只认源脚本那一份(§22c);预置新鲜锁模拟另一路守护/人工 reap 正在跑。
    const lock = aw.orphanLockPathOf(root)
    writeFileSync(lock, String(process.pid))
    try {
      const r = aw.reapOrphanDirs({
        root,
        worktreesRoot,
        now: Date.now(),
        minIdleDays: 1,
        graceDays: 1,
        apply: true,
      })
      assert.equal(r.failed, 0, '并发跳过不是失败,不得虚报')
      assert.equal(r.tombstoned, 0)
      assert.equal(r.purged, 0)
      assert.equal(existsSync(shell), true, '持锁期间不得改名或删除')
      assert.match(r.lines.join('\n'), /本轮跳过/)
    } finally {
      rmSync(lock, { force: true })
    }
  } finally {
    rmSync(sandbox, { recursive: true, force: true })
  }
})
