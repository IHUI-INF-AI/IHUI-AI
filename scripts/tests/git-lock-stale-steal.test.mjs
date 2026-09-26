// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/git-lock.mjs 的**抢占原子性**(§22c:直接 import 源脚本 __test__,不在测试里复制判据)
//
// 钉的是运行期竞态那一型,不是"删没删掉":
//   旧实现在判"持有者已死"之后直接 `rmSync(dir)`,而"我判它死"与"我删它"之间,
//   别的进程可以已经删掉旧锁并 mkdir 拿到**新锁** ⇒ 那一下删掉的是别人的活锁
//   ⇒ git 侧两个写者同时进临界区(`.git/index.lock` 双写者)。
//   `existsSync` 回读只判"删没删掉",**不判"删的是不是我刚看过的那把"**。
//
// 真机零副作用(本票最高红线):所有用例的锁目录都取自 mkScratch(),
// 绝不碰真实 `.git/ihui-git-write.lock`;归档落点也指进夹具(否则测试往 gitArchiveDir() 堆现场)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gl } from '../git-lock.mjs'

const DEAD_PID = 999000 // 实测不存在的 pid;下面第 0 条先把它自己验一遍,不靠假设
const LOCK_NAME = 'ihui-git-write.lock'

function mkFixture(t) {
  const scratch = mkScratch('git-lock-stale-steal')
  t.after(() => rmScratch(scratch))
  const dir = join(scratch, LOCK_NAME)
  const archive = join(scratch, 'arch')
  return { scratch, dir, archive }
}

function putLock(dir, { unitId, pid, ts = Date.now(), extraFile = null }) {
  mkdirSync(dir, { recursive: false })
  writeFileSync(join(dir, 'meta.json'), JSON.stringify({ unitId, pid, ts }), 'utf8')
  if (extraFile) writeFileSync(join(dir, extraFile.name), extraFile.content, 'utf8')
}

// ── 0. 前提自证:判死用的那个 pid 在这台机上真的是死的 ─────────────────────────
test('前提:DEAD_PID 判死成立(否则下面所有抢占用例都在测一个不存在的场景)', () => {
  assert.equal(gl.isPidAlive(DEAD_PID), false, `pid ${DEAD_PID} 居然活着,换一个小一点的 pid`)
  assert.equal(gl.isPidAlive(process.pid), true)
})

// ── 1. 阳性对照:丙在乙"判死 → 动手"之间新建锁 ⇒ 丙的锁必须还在 ───────────────
test('①竞态窗口:改名瞬间锁已被丙替换 ⇒ 抢占放弃、丙的活锁幸存、未删任何目录', (t) => {
  const { dir, archive } = mkFixture(t)
  // 甲:一把死锁(判死基准)
  putLock(dir, { unitId: 'unit-甲', pid: DEAD_PID, ts: 1_700_000_000_000 })
  const judged = gl.readMeta(dir)
  assert.ok(judged && judged.unitId === 'unit-甲')

  // 丙:乙还没动手,丙已经删掉旧锁并拿到新锁(活 pid + 可辨识附属文件)
  rmLockDir(dir)
  putLock(dir, { unitId: 'unit-丙', pid: process.pid, ts: judged.ts + 1, extraFile: { name: 'holder.txt', content: 'C-ALIVE' } })

  const r = gl.claimStaleLock(dir, judged, '竞态窗口测试', { archiveRoot: archive })
  assert.equal(r.ok, false, '旧实现(rmSync(dir))在这里会把丙的活锁删掉 ⇒ 必红')
  assert.equal(r.phase, 'mismatch')
  // 丙的锁必须原样在位,内容一字未动
  assert.ok(existsSync(dir), '丙的锁目录被删了 —— 正是本票要根治的双写者缺陷')
  assert.equal(gl.readMeta(dir).unitId, 'unit-丙')
  assert.equal(readFileSync(join(dir, 'holder.txt'), 'utf8'), 'C-ALIVE')
  assert.ok(/已被替换/.test(r.log), `日志必须说清为什么放弃:${r.log}`)
  // 不在锁目录旁边留下 .stale-* 垃圾(§28 根目录整洁 / §5b 不得把工作区当归档场)
  assert.equal(leftoverStale(dir), 0, `改名失败后不得留 .stale-* 残留:${leftoverStale(dir)}`)
})

test('①b抢占成功那一支:改到的是判死时那把 ⇒ 只处置改名后的那份,锁路径腾空后可被丙正常取得', (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { unitId: 'unit-甲', pid: DEAD_PID, ts: 1_700_000_000_001 })
  const judged = gl.readMeta(dir)

  const r = gl.claimStaleLock(dir, judged, '持有者已退出', { archiveRoot: archive })
  assert.equal(r.ok, true, r.log)
  assert.equal(r.phase, 'claimed')
  assert.equal(existsSync(dir), false, '抢占成功后原路径应当腾空')
  assert.equal(leftoverStale(dir), 0, '成功路径也不得在锁目录旁留 .stale-*')

  // 丙随后正常拿锁 ⇒ 必须完全不受上一次抢占影响
  putLock(dir, { unitId: 'unit-丙', pid: process.pid, extraFile: { name: 'holder.txt', content: 'C-ALIVE' } })
  assert.equal(readFileSync(join(dir, 'holder.txt'), 'utf8'), 'C-ALIVE')
})

// ── 2. 改名失败(ENOENT)⇒ 不删任何目录、不抛未捕获错 ────────────────────────
test('②锁目录在动手前就消失(ENOENT)⇒ 判"没抢到",零删除、零抛出', (t) => {
  const { dir, archive } = mkFixture(t)
  const r = gl.claimStaleLock(dir, null, '目录本就不存在', { archiveRoot: archive })
  assert.equal(r.ok, false)
  assert.equal(r.phase, 'rename')
  assert.equal(r.code, 'ENOENT')
  assert.equal(existsSync(dir), false)
  assert.equal(existsSync(archive), false, '不该为了一个不存在的锁去建归档目录')
  assert.equal(leftoverStale(dir), 0)
})

test('②b无 meta.json 的残留锁目录:同样走改名抢占,不发生对原路径的直接删除', (t) => {
  const { dir, archive } = mkFixture(t)
  mkdirSync(dir)
  const r = gl.claimStaleLock(dir, null, 'clean:无 meta.json', { archiveRoot: archive })
  assert.equal(r.ok, true, r.log)
  assert.equal(existsSync(dir), false)
  assert.ok(r.archived && r.archived.startsWith(archive))
})

// ── 3. release 只删自己那把 ─────────────────────────────────────────────────
test('③release:unitId 不匹配 ⇒ 别人的锁必须幸存', (t) => {
  const { dir } = mkFixture(t)
  putLock(dir, { unitId: 'unit-他人', pid: DEAD_PID, extraFile: { name: 'holder.txt', content: 'THEIRS' } })

  const r = gl.release({ unitId: 'unit-我的', dir })
  assert.equal(r.released, false)
  assert.ok(existsSync(dir), 'release 删掉了别人的锁')
  assert.equal(readFileSync(join(dir, 'holder.txt'), 'utf8'), 'THEIRS')

  // 空 unitId(旧版无条件删那一型)同样不得删
  const r2 = gl.release({ unitId: '', dir })
  assert.equal(r2.released, false, '不带 --unit 的 release 结构上无法证明归属,必须拒绝')
  assert.ok(existsSync(dir))

  // 匹配 unitId ⇒ 删得掉
  const r3 = gl.release({ unitId: 'unit-他人', dir })
  assert.equal(r3.released, true)
  assert.equal(existsSync(dir), false)
})

test('③brelease:锁目录里没有可读 meta ⇒ 拒绝(不得把"读不到"当成"可以删")', (t) => {
  const { dir } = mkFixture(t)
  mkdirSync(dir)
  const r = gl.release({ unitId: 'x', dir })
  assert.equal(r.released, false)
  assert.ok(existsSync(dir), '无 meta 时旧实现会无条件删')
})

// ── 4. 归档落点 + 日志点名被抢 owner ────────────────────────────────────────
test('④.stale-* 现场落在归档出口,且日志与现场都点名被抢的 owner', (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { unitId: 'unit-甲', pid: DEAD_PID, ts: 1_700_000_000_002 })
  const judged = gl.readMeta(dir)
  const r = gl.claimStaleLock(dir, judged, '持有者 pid 已退出', { archiveRoot: archive })
  assert.equal(r.ok, true, r.log)
  assert.ok(r.archived.startsWith(archive), `现场必须落在归档出口,实得 ${r.archived}`)
  // 归档目录名带 .stale- 标记,可事后辨认
  assert.match(r.archived, /\.stale-\d+-/)
  const note = readFileSync(join(r.archived, 'stale-claim-note.txt'), 'utf8')
  assert.ok(note.includes(`pid=${DEAD_PID}`), `现场说明须点名被抢持有者:\n${note}`)
  assert.ok(note.includes('unit=unit-甲'), '现场说明须点名被抢 unitId')
  assert.ok(note.includes('持有者 pid 已退出'), '现场说明须写判死理由')
  assert.ok(r.log.includes(`pid=${DEAD_PID}`) && r.log.includes('unit-甲'), `日志须点名被抢者:${r.log}`)
  assert.ok(r.log.includes(archive), '日志须给出场路径(否则无人能找到现场)')
})

test('④b归档出口不可得 ⇒ 仍不删原路径,现场证据以 stderr 留痕后删除暂存', (t) => {
  const { dir } = mkFixture(t)
  putLock(dir, { unitId: 'unit-甲', pid: DEAD_PID })
  const judged = gl.readMeta(dir)
  const r = gl.claimStaleLock(dir, judged, '归档不可得', { archiveRoot: null })
  assert.equal(r.ok, true, r.log)
  assert.equal(existsSync(dir), false)
  assert.equal(leftoverStale(dir), 0, '删不干净也不许把 .stale-* 留在锁目录旁边')
})

// ── 5. 反向锁:抢占分支不得再出现"直接删原路径"的形态 ───────────────────────
test('⑤源码反向锁:acquire/clean 的抢占分支只能走 claimStaleLock,不得再 removeLock(dir)', () => {
  const src = readFileSync(new URL('../git-lock.mjs', import.meta.url), 'utf8')
  // 只数**代码行**里的出现(整行注释是"说明为什么不能用它",不是调用点)
  const codeOnly = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
  const removeLockCalls = [...codeOnly.matchAll(/removeLock\(/g)].length
  assert.ok(
    removeLockCalls <= 2,
    `removeLock 只应剩"定义 + 持有者自释"两处出现,实得 ${removeLockCalls} —— 抢占路径又绕回直接删原路径了`,
  )
  const preemptBranch = /if \(!holderAlive \|\| age > hardStaleMs \|\| age > staleMs\) \{[\s\S]*?\n        \}/
  assert.match(codeOnly, preemptBranch, '抢占分支结构变了,反向锁得跟着改判据(别把锁拆散了)')
  const branch = codeOnly.match(preemptBranch)[0]
  assert.ok(branch.includes('claimStaleLock('), '抢占分支必须走原子改名')
  assert.ok(!branch.includes('removeLock('), '抢占分支不得出现 removeLock —— 那正是本票根治的那一步')
  assert.ok(
    codeOnly.includes('claimStaleLock(dir, null,'),
    'clean 的"无 meta.json 残留锁"一支也必须走改名抢占(旧写法是直接删)',
  )
})

// ── 工具 ───────────────────────────────────────────────────────────────────
/** 模拟"丙自己删掉旧锁"(与判据无关的夹具动作),不要用 claim */
function rmLockDir(dir) {
  rmSync(dir, { recursive: true, force: true })
}
/** 锁目录同级不得留下 .stale-* 残留(§28 整洁 / §5b 归档不得落工作区) */
function leftoverStale(dir) {
  const parent = dirname(dir)
  try {
    return readdirSync(parent).filter((n) => n.includes('.stale-')).length
  } catch {
    return -1
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
