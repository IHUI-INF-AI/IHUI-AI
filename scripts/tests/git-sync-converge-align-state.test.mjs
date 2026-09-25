// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 收敛器「收尾对齐状态台账」镜像测试(§22c:import 源模块的 __test__,零复制实现)。
//
// 立因(票 O74):alignWorktreeAfterHeadMove 的失败长期只记日志 —— 锁一直被占时,
// 工作区会无声地一直落后 HEAD。本票让"失败"变成可被守护读到的状态,再由守护喊人。
// 本测试钉住**写入侧**的契约:
//   ① 原子写(临时文件 + rename),目录缺失自动补建,不留 .tmp 残骸;
//   ② 读侧宽容:文件缺失 / 坏 JSON / 形状不对 ⇒ null("无法判定"),绝不抛;
//   ③ 计数语义:失败 +1、成功归零并写 lastOkAt(恢复后守护必须不再喊);
//   ④ 状态文件绝不把收敛器搞崩:落点不可写时 recordAlignOutcome 只吞异常返回;
//   ⑤ 装车证明:alignWorktreeAfterHeadMove 的成功分支与失败分支都真调了 recordAlignOutcome
//      (判据存在而无人调用 = 没有,守门 70/81 同型)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as S } from '../git-sync-converge.mjs'

/** 稳定夹具路径 */
function statePath(dir) {
  return join(dir, 'sub', 'converge-align-state.json')
}

test('①write+read 往返:字段齐备且可读回', () => {
  const dir = mkScratch('converge-align-')
  try {
    const p = statePath(dir) // 父目录不存在 → 必须自动补建
    const s = {
      consecutiveFailures: 2,
      lastFailAt: 111,
      lastOkAt: null,
      lastNote: 'rc=128 locked',
      lastRoundMerges: null,
    }
    assert.equal(S.writeAlignState(p, s), true)
    const back = S.readAlignState(p)
    assert.deepEqual(back, s)
  } finally {
    rmScratch(dir)
  }
})

test('②读侧宽容:缺失 / 坏 JSON / 形状不对一律 null,不抛', () => {
  const dir = mkScratch('converge-align-')
  try {
    const missing = join(dir, 'nope.json')
    assert.equal(S.readAlignState(missing), null)
    const broken = join(dir, 'broken.json')
    writeFileSync(broken, '{ not json', 'utf8')
    assert.equal(S.readAlignState(broken), null)
    const shape = join(dir, 'shape.json')
    writeFileSync(shape, JSON.stringify({ lastNote: '没有计数字段' }), 'utf8')
    assert.equal(S.readAlignState(shape), null)
    const nan = join(dir, 'nan.json')
    writeFileSync(nan, JSON.stringify({ consecutiveFailures: 'x' }), 'utf8')
    assert.equal(S.readAlignState(nan), null)
  } finally {
    rmScratch(dir)
  }
})

test('③失败 +1:从 null 起算,坏 prev 视同 0,lastOkAt 保留', () => {
  const now = 1_700_000_000_000
  const a = S.nextAlignState(null, { ok: false, note: 'rc=1 first', nowMs: now })
  assert.equal(a.consecutiveFailures, 1)
  assert.equal(a.lastFailAt, now)
  assert.equal(a.lastOkAt, null)
  const b = S.nextAlignState(
    { consecutiveFailures: 2, lastOkAt: 5 },
    { ok: false, note: 'rc=1 again', nowMs: now + 1 },
  )
  assert.equal(b.consecutiveFailures, 3)
  assert.equal(b.lastOkAt, 5, '失败不清 lastOkAt(它是"上次恢复"的事实)')
  const c = S.nextAlignState({ consecutiveFailures: '坏值' }, { ok: false, note: 'x', nowMs: now })
  assert.equal(c.consecutiveFailures, 1, 'prev 不可信 ⇒ 视作无法判定,从 1 重计而不是 NaN')
})

test('③b成功归零并写 lastOkAt(守护据此必须不再喊)', () => {
  const now = 1_700_000_000_000
  const s = S.nextAlignState(
    { consecutiveFailures: 7, lastFailAt: now - 900_000, lastOkAt: now - 9_000_000 },
    { ok: true, note: 'aligned=3', nowMs: now, roundMerges: 3 },
  )
  assert.equal(s.consecutiveFailures, 0)
  assert.equal(s.lastOkAt, now)
  assert.equal(s.lastFailAt, now - 900_000, '归零不抹失败历史时间戳')
  assert.equal(s.lastRoundMerges, 3)
})

test('①b原子替换:二次写整幅覆盖,目录里不留 .tmp 残骸', () => {
  const dir = mkScratch('converge-align-')
  try {
    const p = join(dir, 'state.json')
    assert.equal(
      S.writeAlignState(p, {
        consecutiveFailures: 1,
        lastFailAt: 1,
        lastOkAt: null,
        lastNote: 'a',
        lastRoundMerges: null,
      }),
      true,
    )
    assert.equal(
      S.writeAlignState(p, {
        consecutiveFailures: 0,
        lastFailAt: 1,
        lastOkAt: 2,
        lastNote: 'ok',
        lastRoundMerges: 0,
      }),
      true,
    )
    assert.equal(S.readAlignState(p).consecutiveFailures, 0)
    assert.deepEqual(
      readdirSync(dir).filter((f) => f.endsWith('.tmp')),
      [],
      'rename 后临时文件不得存在',
    )
  } finally {
    rmScratch(dir)
  }
})

test('④recordAlignOutcome:正常落点写通;落点是文件(不可建目录)时吞异常不崩', () => {
  const dir = mkScratch('converge-align-')
  try {
    S.recordAlignOutcome(dir, false, 'rc=128 index.lock', null)
    const p = join(dir, '.workbuddy', 'converge-align-state.json')
    assert.ok(existsSync(p), '相对 repo 根的固定落点')
    assert.equal(S.readAlignState(p).consecutiveFailures, 1)
    S.recordAlignOutcome(dir, true, 'aligned=0', 0)
    assert.equal(S.readAlignState(p).consecutiveFailures, 0)
    // repoRoot 指向一个普通文件 ⇒ mkdirSync(ENOTDIR) ⇒ 必须被吞,绝不外抛
    const asFile = join(dir, 'not-a-dir')
    writeFileSync(asFile, 'x', 'utf8')
    assert.doesNotThrow(() => S.recordAlignOutcome(join(asFile, 'sub'), false, 'rc=1', null))
  } finally {
    rmScratch(dir)
  }
})

// —— ⑤装车证明:接线必须钉源码,别只测纯函数 ——

/** HEAD 里还没有本票改动(未提交)时退回工作树取证,并如实喊话;提交后自动以 HEAD blob 为准 */
function loadedSource(relPath, anchor) {
  let head = ''
  try {
    head = execFileSync('git', ['show', `HEAD:${relPath}`], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 32 << 20,
    })
  } catch {
    /* git 问不到 ⇒ 走工作树 */
  }
  if (head.includes(anchor)) return { src: head, face: 'HEAD' }
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const wt = readFileSync(join(repoRoot, relPath), 'utf8')
  assert.ok(wt.includes(anchor), `${relPath} 连工作树都不含 ${anchor} ⇒ 写入侧根本没接上`)
  console.warn('⚠️ 装车证明暂以工作树取证(HEAD 尚未包含本票改动,提交后此判据自动升为 HEAD 面)')
  return { src: wt, face: 'worktree' }
}

test('⑤装车:alignWorktreeAfterHeadMove 的成功与失败分支都真调了 recordAlignOutcome', () => {
  const { src } = loadedSource('scripts/git-sync-converge.mjs', 'recordAlignOutcome')
  const body = src.slice(src.indexOf('function alignWorktreeAfterHeadMove'))
  const fnBody = body.slice(0, body.indexOf('\n  }', body.indexOf('catch')) + 4)
  assert.match(
    fnBody,
    /catch[\s\S]*?recordAlignOutcome\(repoRoot, false, alignFailureNote\(e\)/,
    '失败分支必须写状态',
  )
  assert.match(
    fnBody,
    /recordAlignOutcome\(repoRoot, true/,
    '成功分支也必须写(否则恢复后计数永不归零)',
  )
  // __test__ 必须暴露这三个判据(§22c:测试直接 import,不复制实现)
  const blk = src.slice(src.indexOf('export const __test__'))
  for (const k of ['readAlignState', 'writeAlignState', 'nextAlignState', 'recordAlignOutcome']) {
    assert.ok(blk.slice(0, 400).includes(`${k},`), `__test__ 缺导出 ${k}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
