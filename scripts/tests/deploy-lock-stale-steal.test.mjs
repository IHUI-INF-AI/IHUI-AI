// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/deploy-lock.mjs 的**抢占原子性**(§22c:import 源脚本 __test__,不复制判据)
//
// 与 git-lock-stale-steal.test.mjs 同一型缺陷的部署侧:
//   旧 `acquire` 抢占分支与 `release` 代为收口分支都是 `removeLock(dir)`(直接 rmSync 原路径)。
//   在"我判它已死"与"我删它"之间,别人可以已经删掉旧锁并 mkdir 拿到**新锁** ⇒ 删掉的是别人的活锁
//   ⇒ 两次构建同时写 apps/web/.next(8-09 的 8801 短暂 502 + 监控报警正是这一型)。
//   旧 `removeLock` 的注释写着"调用方必须回读 existsSync 复核"—— 那只判"删没删掉",
//   **不判"删的是不是我刚看过的那把"**。
//
// 真机零副作用:锁目录与归档落点全在 mkScratch() 内(归档经 IHUI_DEPLOY_LOCK_ARCHIVE_DIR 指进夹具),
// 绝不碰真实项目根的 `.deploy.lock`(那是并发会话正在用的锁)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { auditClaimStaleLockSource } from '../lib/stale-lock-claim.mjs'
import { __test__ as dl } from '../deploy-lock.mjs'

const DEAD_PID = 999000
const LOCK_NAME = '.deploy.lock'

function mkFixture(t) {
  const scratch = mkScratch('deploy-lock-stale-steal')
  t.after(() => rmScratch(scratch))
  const dir = join(scratch, LOCK_NAME)
  const archive = join(scratch, 'scene')
  // sceneArchiveRoot() 在调用时读 env ⇒ 每个用例都指进自己的夹具,不往仓库 .ihui-agent/tmp 堆现场
  process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR = archive
  t.after(() => delete process.env.IHUI_DEPLOY_LOCK_ARCHIVE_DIR)
  return { scratch, dir, archive }
}

function putLock(dir, { mode = 'build', pid = DEAD_PID, ownerPid = 0, ts = Date.now(), holderFile = 'C-ALIVE' }) {
  mkdirSync(dir, { recursive: false })
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ mode, pid, ownerPid, ts }), 'utf8')
  writeFileSync(join(dir, 'holder.txt'), holderFile, 'utf8')
}

test('前提:DEAD_PID 在这台机确实判死', () => {
  assert.equal(dl.isProcessAlive(DEAD_PID), false, `pid ${DEAD_PID} 居然活着`)
  assert.equal(dl.isProcessAlive(process.pid), true)
})

// ── 1. 阳性对照:丙在"判死 → 动手"之间新建锁 ⇒ 丙的锁必须幸存 ────────────────
test('①竞态窗口:改名瞬间锁已被丙替换 ⇒ 抢占放弃、丙的活锁一字未动', (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { pid: DEAD_PID, ts: 1_700_000_000_000 })
  const judged = dl.readMeta(dir)
  assert.equal(judged.kind, 'ok')
  assert.equal(judged.meta.pid, DEAD_PID)

  // 丙抢先一步:删掉旧锁、建好自己的活锁(活 pid + 可辨识附属文件)
  rmSync(dir, { recursive: true, force: true })
  putLock(dir, { pid: process.pid, ownerPid: process.pid, ts: judged.meta.ts + 1, holderFile: 'C-WAS-HERE' })

  const r = dl.claimStaleLock(dir, judged, '竞态窗口', { archiveRoot: archive })
  assert.equal(r.ok, false, '旧实现(rmSync(dir))在这一格会把丙的活锁删掉 ⇒ 本用例必红')
  assert.equal(r.phase, 'identity-drift')
  assert.ok(existsSync(dir), '丙的锁目录被删 = 双构建者同时写 .next 的起点')
  assert.equal(dl.readMeta(dir).meta.pid, process.pid)
  assert.equal(readFileSync(join(dir, 'holder.txt'), 'utf8'), 'C-WAS-HERE')
  assert.equal(leftoverStale(dir), 0, `放弃时不得留 .stale-* 残留(实得 ${leftoverStale(dir)})`)
  assert.match(r.log, /已被替换/, `必须说清为什么放弃:${r.log}`)
})

test('①b抢占成功那一支:改到的就是判死时那把 ⇒ 现场搬进归档出口,锁路径腾空后丙可正常持锁', (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { pid: DEAD_PID, ts: 1_700_000_000_001 })
  const judged = dl.readMeta(dir)
  const r = dl.claimStaleLock(dir, judged, '持有者已退出', { archiveRoot: archive })
  assert.equal(r.ok, true, r.log)
  assert.equal(existsSync(dir), false)
  assert.ok(r.archived && r.archived.startsWith(archive), `现场须落在归档出口:${r.archived}`)
  assert.equal(leftoverStale(dir), 0, '不得把 .stale-* 留在项目根/锁目录旁')

  putLock(dir, { pid: process.pid, ownerPid: process.pid, holderFile: 'C-NEW' })
  assert.equal(readFileSync(join(dir, 'holder.txt'), 'utf8'), 'C-NEW')
})

// ── 2. 改名失败(ENOENT)⇒ 零删除、零抛出、不建归档目录 ────────────────────
test('②锁目录在动手前就消失 ⇒ 判"没抢到",不删任何目录、不抛未捕获错', (t) => {
  const { dir, archive } = mkFixture(t)
  const r = dl.claimStaleLock(dir, dl.readMeta(dir), '目录本就不存在', { archiveRoot: archive })
  assert.equal(r.ok, false)
  assert.equal(r.phase, 'rename')
  assert.equal(r.code, 'ENOENT')
  assert.equal(existsSync(dir), false)
  assert.equal(existsSync(archive), false, '为一个不存在的锁建归档目录 = 静默造垃圾')
  assert.equal(leftoverStale(dir), 0)
})

// ── 3. release 只删自己那把(别人的锁必须幸存)──────────────────────────────
test('③release:mode 不匹配 ⇒ 别人的锁幸存', (t) => {
  const { dir } = mkFixture(t)
  putLock(dir, { mode: 'build', pid: process.pid, ownerPid: process.pid })
  const r = dl.release({ mode: 'dev', dir })
  assert.equal(r.released, false)
  assert.ok(existsSync(dir), 'release 删掉了另一种 mode 的锁')
})

test('③brelease:他人持锁且存活 ⇒ 拒绝', (t) => {
  const { dir } = mkFixture(t)
  putLock(dir, { pid: process.pid + 1, ownerPid: process.pid + 1, ts: Date.now() })
  const r = dl.release({ mode: 'build', dir })
  assert.equal(r.released, false, `持有者仍是活进程,不该被代删:${r.why}`)
  assert.ok(existsSync(dir))
})

test('③crelease:持有者已死的悬挂锁可代为收口,且必须走原子改名(现场落归档)', (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { pid: DEAD_PID, ownerPid: DEAD_PID })
  const r = dl.release({ mode: 'build', dir })
  assert.equal(r.released, true, `代为收口应当成功:${r.why}`)
  assert.equal(existsSync(dir), false)
  const scenes = existsSync(archive) ? readdirSync(archive) : []
  assert.ok(scenes.some((n) => n.includes('.stale-')), `代为收口须留下 .stale-* 现场,实得 ${scenes}`)
})

test('③drelease:元数据不可判定 ⇒ 仍拒绝(不得因为"读不懂"就当"可以删")', (t) => {
  const { dir } = mkFixture(t)
  mkdirSync(dir)
  writeFileSync(join(dir, 'meta.json'), 'not json at all', 'utf8')
  const r = dl.release({ mode: 'build', dir })
  assert.equal(r.released, false)
  assert.ok(existsSync(dir))
})

// ── 4. 归档落点 + 日志点名被抢 owner ────────────────────────────────────────
test('④现场目录名带 .stale-,现场说明点名被抢的 mode/pid/ts 与判死理由', (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { mode: 'build', pid: DEAD_PID, ts: 1_700_000_000_002 })
  const judged = dl.readMeta(dir)
  const r = dl.claimStaleLock(dir, judged, '持锁进程已退出(判死)', { archiveRoot: archive })
  assert.equal(r.ok, true, r.log)
  assert.match(r.archived, /\.deploy\.lock\.stale-\d+-/)
  const note = JSON.parse(readFileSync(join(r.archived, 'stale-claim-note.json'), 'utf8'))
  assert.equal(note.judged.mode, 'build')
  assert.equal(note.judged.pid, DEAD_PID)
  assert.equal(note.reason, '持锁进程已退出(判死)')
  assert.ok(typeof note.rawMeta === 'string' && note.rawMeta.includes(String(DEAD_PID)), '现场须留原始 meta 字节')
  assert.ok(r.log.includes(`cliPid=${DEAD_PID}`), `日志须点名被抢 owner:${r.log}`)
  assert.ok(r.log.includes(archive), '日志须给出场路径')
})

test('④b现场目录里除 meta 之外的附属文件必须随锁一起进归档(不得只留一半)', (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { pid: DEAD_PID, holderFile: 'ATTACHED-EVIDENCE' })
  const r = dl.claimStaleLock(dir, dl.readMeta(dir), '附属文件随锁归档', { archiveRoot: archive })
  assert.equal(r.ok, true, r.log)
  assert.equal(readFileSync(join(r.archived, 'holder.txt'), 'utf8'), 'ATTACHED-EVIDENCE')
})

// ── 5. 反向锁:两处抢占/代偿分支都不得再直接删原路径 ────────────────────────
test('⑤源码反向锁:removeLock 只剩"定义 + 持有者自释",抢占与代为收口只能走 claimStaleLock', () => {
  const src = readFileSync(new URL('../deploy-lock.mjs', import.meta.url), 'utf8')
  // 只数代码行(整行注释是在解释"为什么不能用它",不是调用点)
  const codeOnly = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
  const calls = [...codeOnly.matchAll(/\bremoveLock\(/g)].length
  assert.ok(calls <= 2, `removeLock 出现 ${calls} 次(应仅剩定义 + 持有者自释)⇒ 抢占路径又绕回直接删原路径了`)
  assert.ok(
    codeOnly.includes('claimStaleLock(dir, again.state, again.why)'),
    'acquire 的抢占分支必须走 claimStaleLock',
  )
  assert.ok(codeOnly.includes('const claim = claimStaleLock('), '代为收口/抢占两支都须接 claimStaleLock')
  assert.equal(
    (codeOnly.match(/claimStaleLock\(/g) || []).length,
    3,
    '定义 1 处 + acquire 抢占 1 处 + release 代为收口 1 处,少一处就是有一支又回到直接删',
  )
})

// ── 端到端:真跑一次 acquire 的抢占(不是只测零件)────────────────────────────
test('⑥acquire 端到端:死锁在场 ⇒ 改名抢占成功并拿到锁,而丙在窗口内新建的锁不会被误删', async (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { pid: DEAD_PID, ts: Date.now() - 10_000 })
  const ok = await dl.acquire({ mode: 'build', timeoutMs: 3_000, staleMs: 1, hardCapMs: 1, ownerPid: process.pid, dir })
  assert.equal(ok, true)
  assert.equal(dl.readMeta(dir).kind, 'ok')
  assert.equal(dl.readMeta(dir).meta.ownerPid, process.pid)
  const scenes = readdirSync(archive).filter((n) => n.includes('.stale-'))
  assert.equal(scenes.length, 1, `归档里应恰好留下一份被抢现场,实得 ${scenes}`)
})

function leftoverStale(dir) {
  const parent = dirname(dir)
  try {
    return readdirSync(parent).filter((n) => n.includes('.stale-')).length
  } catch {
    return -1
  }
}

// ── 7. 防复发锁:抢占实现只允许有一份(scripts/lib/stale-lock-claim.mjs)────────
// 与 git-lock-stale-steal.test.mjs 的 ⑥ 同一把尺子(判据从 lib import,不在测试里各抄)。
test('⑦防复发:git-lock/deploy-lock 都不得再出现第二份 claimStaleLock 实现', () => {
  for (const rel of ['../git-lock.mjs', '../deploy-lock.mjs']) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
    const codeOnly = src
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
    assert.deepEqual(
      auditClaimStaleLockSource(codeOnly, rel),
      [],
      `${rel} 的抢占必须是委托 scripts/lib/stale-lock-claim.mjs 的 wrapper`,
    )
    assert.ok(
      /from ['"]\.\/lib\/stale-lock-claim\.mjs['"]/.test(codeOnly),
      `${rel} 必须 import 合并后的唯一实现`,
    )
  }
  // 变异对照(负向证明"往任一脚本再塞一份必红"):换名的副本 1 红;同名回退 3 红。
  const dup = [
    'function claimStaleLockOld(dir, judged, why, opts) {',
    '  renameSync(dir, target)',
    '  return { ok: true }',
    '}',
  ].join('\n')
  const flagged = auditClaimStaleLockSource(dup, 'mutation-fixture')
  assert.equal(flagged.length, 1, `换名的第二份实现必须判红,实得 ${JSON.stringify(flagged)}`)
  assert.ok(flagged[0].includes('renameSync(dir'), '点名的是"对原锁路径的改名回到了调用方"')
  const replaced = [
    'function claimStaleLock(dir, judged, why, opts) {',
    '  renameSync(dir, target)',
    '  return { ok: true }',
    '}',
  ].join('\n')
  const flagged2 = auditClaimStaleLockSource(replaced, 'mutation-fixture-2')
  assert.equal(flagged2.length, 3, `同名回退必须三条判据各自点名,实得 ${JSON.stringify(flagged2)}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
