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
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { auditClaimStaleLockSource, createLockInstanceObserver } from '../lib/stale-lock-claim.mjs'
import { __test__ as gl, tryAcquireSingleInstance } from '../git-lock.mjs'

const DEAD_PID = 999000 // 实测不存在的 pid;下面第 0 条先把它自己验一遍,不靠假设
const LOCK_NAME = 'ihui-git-write.lock'
const GITLOCK_ABS = fileURLToPath(new URL('../git-lock.mjs', import.meta.url))

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
  // ── G-57(2026-10-23)形状锁升级:形状 ⇒ 形状 + 负龄行为 ──────────────────────
  // 原四条断言钉的是"抢占分支仍在 ∧ 只走原子改名"(防绕回直接删);G-57 收口剩余两格后,
  // 同一判据行的**上游**新接了 judgeLockAge 负龄点名。这里把"形状"升级为
  // "形状 + 负龄行为",原断言一条不删、一句不放宽,只是同一把锁多钉一格:
  //   · 原判据行逐字仍在(防"顺手统一"/顺手改严改松);
  //   · 负龄经单一真相源 judgeLockAge 点名(防回到"永不判死且零输出"的改前形态)。
  assert.ok(
    src.includes('else if (!holderAlive || age > hardStaleMs || age > staleMs) {'),
    'acquire 既有判据行必须逐字仍在(G-57 只在其上游新增点名,判据本身不动)',
  )
  const acquireBlock = src.slice(
    src.indexOf('async function acquire('),
    src.indexOf('else if (!holderAlive || age > hardStaleMs'),
  )
  assert.ok(acquireBlock.length > 0, 'acquire 函数体定位失败')
  assert.match(
    acquireBlock,
    /judgeLockAge\(age\)/,
    'acquire 的负龄点名接线被摘了(G-57 收口回潮 ⇒ 未来 ts 又变"永不判死且零输出")',
  )
  assert.match(
    acquireBlock,
    /锁龄不可判定:\$\{dir\}/,
    'acquire 负龄点名必须经 log 落"锁龄不可判定"措辞(写在注释里不算,写成"不判死/未超"就是把没判写成判过)',
  )
  // clean CLI 同型:原判据行的**条件部分一字不动**(只是前面多了点名块,if 变 else if),
  // 且负龄点名排在其前、进"未判定"汇总
  assert.ok(
    src.includes('} else if (!holderAlive || age > 1_800_000 || identityAuthorizesClaim(identity)) {'),
    'clean CLI 既有判据被改了(G-57 只允许在其上游新增点名)',
  )
  const cleanJudgeAt = src.indexOf('const ageV = judgeLockAge(age)')
  const cleanCondAt = src.indexOf('} else if (!holderAlive || age > 1_800_000')
  assert.ok(
    cleanJudgeAt > 0 && cleanCondAt > cleanJudgeAt,
    'clean CLI:负龄点名必须排在原判据之前(顺序反了 = 先判后问,点名永远走不到)',
  )
  assert.ok(src.includes('ageNotes.push('), 'clean CLI 负龄点名必须进"未判定"汇总(只 log 不汇总 ⇒ "✅ 无 stale 锁"误报回潮)')
  assert.ok(
    src.includes('clean 未判定:${dir}'),
    'clean CLI 负龄点名必须经 ageNotes 落"未判定"措辞(写在注释里不算)',
  )
  assert.ok(
    src.includes('indexNotes.length === 0 && ageNotes.length === 0'),
    'clean 汇总的"✅ 无 stale 锁"必须把负龄未判定计入(漏计 = 没判写成没有)',
  )
  assert.ok(
    src.includes('${indexNotes.length + ageNotes.length} 把锁因锁龄判不出来'),
    'clean 未判定汇总行必须把两族锁合起来报(只报 index.lock ⇒ ihui-git-write.lock 的未判定被吞)',
  )
  // 变异对照(防恒绿):把 acquire 接线块整体摘掉(模拟改前形态)⇒ 上面两条新断言必须翻红;
  // 同时证伪"判据行被顺手改了吗"——变异只摘接线,判据行原样。
  const beforeFix = src.replace(/if \(holderAlive && !ageUndeterminedNoted\) \{[\s\S]*?\n        \}\n/, '')
  assert.ok(
    beforeFix.includes('else if (!holderAlive || age > hardStaleMs || age > staleMs) {'),
    '变异对照必须只摘接线块、不动判据行,否则测的不是同一件事',
  )
  const beforeAcquireBlock = beforeFix.slice(
    beforeFix.indexOf('async function acquire('),
    beforeFix.indexOf('else if (!holderAlive || age > hardStaleMs'),
  )
  assert.doesNotMatch(
    beforeAcquireBlock,
    /judgeLockAge\(age\)/,
    '变异对照失灵:回到改前形态时新断言没红 = 这条形状锁在替缺陷背书',
  )
})

// ── 6. 防复发锁:抢占实现只允许有一份(scripts/lib/stale-lock-claim.mjs)────────
// 本票(合并 e0a222de0b1 交付时登记的"两份 claimStaleLock"债)的判据:
// 两个调用方的代码面里,`function claimStaleLock` 只能是以委托形式存在的 wrapper;
// 出现改名核心(renameSync)或不委托 lib 的同名函数 = 第二份实现又长回来了。
test('⑥防复发:git-lock/deploy-lock 都不得再出现第二份 claimStaleLock 实现', () => {
  for (const rel of ['../git-lock.mjs', '../deploy-lock.mjs']) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8')
    // 只判代码行(整行注释在描述"为什么不能用/曾经怎样",不是代码)
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
  // 变异对照(负向证明"往任一脚本再塞一份必红"):一份不委托、含改名核心的副本,
  // 连同"换名字躲判据"的形态(renameSync(dir,… 指纹),必须各被点名。
  const dup = [
    'function claimStaleLockOld(dir, judged, why, opts) {',
    '  renameSync(dir, target)',
    '  return { ok: true }',
    '}',
  ].join('\n')
  const flagged = auditClaimStaleLockSource(dup, 'mutation-fixture')
  assert.equal(
    flagged.length,
    1,
    `换名的第二份实现必须判红,实得 ${JSON.stringify(flagged)}`,
  )
  assert.ok(flagged[0].includes('renameSync(dir'), '点名的是"对原锁路径的改名回到了调用方"')
  // 变异对照 2:把 wrapper 就地换回旧实现(同名)⇒ 未委托/体内改名/对原路径改名三条全红。
  const replaced = [
    'function claimStaleLock(dir, judged, why, opts) {',
    '  renameSync(dir, target)',
    '  return { ok: true }',
    '}',
  ].join('\n')
  const flagged2 = auditClaimStaleLockSource(replaced, 'mutation-fixture-2')
  assert.equal(flagged2.length, 3, `同名回退必须三条判据各自点名,实得 ${JSON.stringify(flagged2)}`)
})

// ── 7. G-998104:锁实例抖动维度(按实例计数而非按路径计数,观察级)────────────
// 票面机制:`ObserveLockInstance = (lockPath, lockStat, observedAt) => number` —— 观察者
// 按 (路径, stat) 区分「同一锁文件被反复重建」的多次实例,使"锁抖动"与"一次长持有"
// 在观测上是两个形状(不再在等待 P95 上同形)。只报数不判红:纯函数单源在
// scripts/lib/stale-lock-claim.mjs,接线在 acquire 等待环(每轮 readMeta/statSync 结果
// 计一个 instance),真实出口是 wait 账本行的 `instances=<k>`;判据面一字未动。
test('⑦纯函数:同指纹在位 ⇒ 1;两次重建 ⇒ 3;路径消失再现在位 ⇒ 新实例;inode 缺失走 mtimeMs 兜底', () => {
  const observe = createLockInstanceObserver()
  const P = 'C:\\fixture\\ihui-git-write.lock'
  const gen1 = { ino: 11, mtimeMs: 1000, pid: 4100, ts: 1_700_000_000_000 }
  // 同一实例连续在位(单持有者不动):序数不涨,恒 1 —— 这是"一次长持有"的观测形状
  assert.equal(observe(P, gen1, 100), 1)
  assert.equal(observe(P, gen1, 400), 1)
  // 第 1 次 meta 重写(重建):pid 不变 ts 变 ⇒ 新实例
  assert.equal(observe(P, { ...gen1, ts: 1_700_000_000_350 }, 700), 2)
  // 第 2 次 meta 重写 ⇒ 3(首 + 两次重建)—— 这是"锁抖动"的观测形状
  assert.equal(observe(P, { ...gen1, ts: 1_700_000_000_700 }, 1000), 3)
  // 路径此刻观察不到 ⇒ 0;再现在位 ⇒ 新实例(哪怕指纹与之前全等 —— 目录可能被整只重建)
  assert.equal(observe(P, null, 1100), 0)
  assert.equal(observe(P, gen1, 1400), 4)
  // 不同路径各记各的账((路径, stat) 才是身份,不是 stat 一己)
  assert.equal(observe('C:\\fixture\\other.lock', gen1, 1500), 1)
  // Windows 下目录 inode 常不可靠(0)⇒ 指纹退化到 mtimeMs 仍可分辨("inode 或 mtimeMs")
  const noIno = createLockInstanceObserver()
  assert.equal(noIno(P, { ino: 0, mtimeMs: 5000, pid: 4100, ts: 1 }, 10), 1)
  assert.equal(noIno(P, { ino: 0, mtimeMs: 5000, pid: 4100, ts: 1 }, 310), 1)
  assert.equal(noIno(P, { ino: 0, mtimeMs: 5000, pid: 4200, ts: 2 }, 610), 2)
})

// ⑦b 票面断言(抖动夹具):acquire --unit t --timeout 3000 的夹具形态,注入「两次 meta 重写」
// ⇒ wait 账本行须含 instances=3(首 + 两次重建)。持有者全程活着(ts 逐次刷新)⇒ 判据面
// 既不判死也不抢占 —— 顺带反证"观察不判红":instances 不授权任何判死,归档出口零现场。
test('⑦b抖动夹具:两次 meta 重写 ⇒ 账本行 instances=3;全程零抢占(观察不判红)', async (t) => {
  const { scratch, dir, archive } = mkFixture(t)
  const metricsFile = join(scratch, 'git-lock-metrics.jsonl')
  mkdirSync(dir, { recursive: true })
  const writeHolderMeta = () =>
    writeFileSync(
      join(dir, 'meta.json'),
      JSON.stringify({ unitId: 'unit-甲', pid: process.pid, ts: Date.now() }),
      'utf8',
    )
  writeHolderMeta()
  // 注入两次 meta 重写:350ms / 700ms 各一次(都在 300ms 轮询间隙里,每个世代至少被
  // 一轮观察看到);1500ms 释放锁,等待者随即拿到。观察器只认指纹,不参与任何判读。
  const rewrite1 = setTimeout(() => {
    if (existsSync(dir)) writeHolderMeta()
  }, 350)
  const rewrite2 = setTimeout(() => {
    if (existsSync(dir)) writeHolderMeta()
  }, 700)
  const releaseTimer = setTimeout(() => rmLockDir(dir), 1500)
  t.after(() => {
    for (const x of [rewrite1, rewrite2, releaseTimer]) clearTimeout(x)
  })
  const got = await gl.acquire({
    unitId: 't',
    timeoutMs: 3000,
    dir,
    cleanIndexLocks: false,
    claimArchiveRoot: archive,
    metricsFile,
    log: () => {},
  })
  assert.equal(got, true, '等待环必须在持有者释放后拿到锁')
  const acquired = gl
    .readMetricsLines(metricsFile)
    .filter((r) => r.kind === 'wait' && r.outcome === 'acquired')
  assert.equal(acquired.length, 1, `acquired 的 wait 行恰一条,实得 ${acquired.length}`)
  assert.equal(
    acquired[0].instances,
    3,
    `首 + 两次重建 ⇒ instances=3,实得 ${JSON.stringify(acquired[0])}`,
  )
  assert.ok(acquired[0].polls >= 4, 'instances 须真的来自等待环逐轮观察(polls≥4)')
  assert.ok(
    readFileSync(metricsFile, 'utf8').includes('"instances":3'),
    '账本行须含 instances=3 的字面字段(票面:输出行须含 instances=3)',
  )
  assert.equal(leftoverStale(dir), 0, '观察不得附带任何抢占痕迹(.stale-* 不得留在锁旁)')
  assert.equal(existsSync(archive), false, '全程零抢占:归档出口不得被建出(观察不判红)')
})

// ⑦c 票面断言(单持有者夹具):meta 全程不动 ⇒ 账本行 instances=1 —— 与 ⑦b 的 3 在
// 账本上是两个形状,这正是本票要补的观测(同一 P95 下,"抖动"与"长持有"从此可分辨)。
test('⑦c单持有者夹具:meta 全程不动 ⇒ 账本行 instances=1', async (t) => {
  const { scratch, dir, archive } = mkFixture(t)
  const metricsFile = join(scratch, 'git-lock-metrics.jsonl')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ unitId: 'unit-乙', pid: process.pid, ts: Date.now() }),
    'utf8',
  )
  const releaseTimer = setTimeout(() => rmLockDir(dir), 1000)
  t.after(() => clearTimeout(releaseTimer))
  const got = await gl.acquire({
    unitId: 't',
    timeoutMs: 3000,
    dir,
    cleanIndexLocks: false,
    claimArchiveRoot: archive,
    metricsFile,
    log: () => {},
  })
  assert.equal(got, true, '等待环必须在持有者释放后拿到锁')
  const acquired = gl
    .readMetricsLines(metricsFile)
    .filter((r) => r.kind === 'wait' && r.outcome === 'acquired')
  assert.equal(acquired.length, 1, `acquired 的 wait 行恰一条,实得 ${acquired.length}`)
  assert.equal(
    acquired[0].instances,
    1,
    `单持有者不动 ⇒ instances=1,实得 ${JSON.stringify(acquired[0])}`,
  )
  assert.equal(existsSync(archive), false, '全程零抢占(观察不判红)')
})

// ── 8. G-57:锁龄为负(未来时间戳)⇒ 必须点名「不可判定」,不许静默按"新鲜"处理 ──
// 病型:`age = Date.now() - mtime`,mtime 在未来 ⇒ age 为负 ⇒ `age > staleMs` 恒假
// ⇒ 该判死的永远判不死,且零输出(改前实测:龄 -3600s 被读成"未超 60s ⇒ 不判死")。
// 处置方向(§0.3/§0.10):判不出来 ⇒ 点名原因,既不判死也不当新鲜;**不许夹逼成 0**。
const FUTURE_SHIFT_MS = 3_600_000 // 未来 1 小时(时钟回拨/NTP 跳变的量级)

/** 把一个路径的 mtime 盖到未来(夹具动作,与判据无关) */
function stampFuture(p, shiftMs = FUTURE_SHIFT_MS) {
  const d = new Date(Date.now() + shiftMs)
  utimesSync(p, d, d)
  return Date.now() - statSync(p).mtimeMs
}
/** 把一个路径的 mtime 盖到过去 agoMs 毫秒前 */
function stampPast(p, agoMs) {
  const d = new Date(Date.now() - agoMs)
  utimesSync(p, d, d)
  return Date.now() - statSync(p).mtimeMs
}

test('⑧判据分档:负龄超容差 ⇒ undetermined 且点名原因;容差内小负龄/过去 ⇒ judgeable', () => {
  const T = gl.LOCK_AGE_SKEW_TOLERANCE_MS
  // ① 未来 1 小时 ⇒ 不可判定,且 why 里带着**负号那个数**(不许被 Math.max(0,…) 夹掉)
  const bad = gl.judgeLockAge(-FUTURE_SHIFT_MS)
  assert.equal(bad.verdict, 'undetermined')
  assert.match(bad.why, /锁龄为负 -3600000ms/, `why 必须点名负龄原值:${bad.why}`)
  assert.match(bad.why, /时钟偏移容差/, 'why 必须点名"时钟偏移"这个成因')
  assert.match(bad.why, /不可判定/, 'why 必须落"不可判定"这个词(不许写成"新鲜")')
  // ② 容差边界:恰好 -T 仍可判(容差是"≤"这一侧),-T-1 不可判
  assert.equal(gl.judgeLockAge(-T).verdict, 'judgeable', '容差之内的抖动不该点名')
  assert.equal(gl.judgeLockAge(-T - 1).verdict, 'undetermined')
  assert.equal(gl.judgeLockAge(-1).verdict, 'judgeable', '文件系统时间戳粒度造成的小负龄照旧')
  // ③ 过去 / 0 / 取不到 ⇒ 可判(既有语义不因本票改形)
  assert.equal(gl.judgeLockAge(0).verdict, 'judgeable')
  assert.equal(gl.judgeLockAge(120_000).verdict, 'judgeable')
  // ④ 非有限数(时间戳取不到被算成 NaN)⇒ 未判定,不猜
  assert.equal(gl.judgeLockAge(NaN).verdict, 'undetermined')
  assert.equal(gl.judgeLockAge(undefined).verdict, 'undetermined')
})

test('⑨index.lock 未来 mtime + 有 git 进程 ⇒ 不删且点名未判定(改前是零输出静默)', (t) => {
  const { scratch } = mkFixture(t)
  const g = join(scratch, 'gitdir')
  mkdirSync(g)
  const lock = join(g, 'index.lock')
  writeFileSync(lock, '')
  const age = stampFuture(lock)
  assert.ok(age < -FUTURE_SHIFT_MS + 1000, `夹具没造出负龄,实得 ${age}`)

  const notes = []
  const cleaned = gl.cleanStaleIndexLocks({
    gitRoot: g,
    hasGitProcessProbe: () => true,
    log: (m) => notes.push(m),
  })
  // 失效方向 = 不删(宁可留着),但**必须点名**:静默不删就是本票的病
  assert.equal(cleaned.length, 0, `未判定不该进"已清理"清单:${cleaned}`)
  assert.ok(existsSync(lock), '未判定的锁不得被删')
  assert.equal(notes.length, 1, `点名行恰一条,实得 ${notes.length}`)
  assert.match(notes[0], /未判定/, `点名行必须写"未判定":${notes[0]}`)
  assert.match(notes[0], /锁龄为负/, '点名行必须带负龄原值(不许夹逼)')
  assert.match(notes[0], /index\.lock/, '点名行必须给出锁路径(否则没人知道去哪儿处置)')
  assert.equal(leftoverStale(g), 0)
})

test('⑨b既有语义一字不变:过去 mtime 的三格(超龄删 / 未超龄留 / 无 git 进程删)全部照旧且零点名', (t) => {
  const { scratch } = mkFixture(t)
  // ① 过去 120s(> INDEX_LOCK_STALE_MS=60s)+ 有 git 进程 ⇒ 照旧删除,且不得点名
  const g1 = join(scratch, 'g1')
  mkdirSync(g1)
  const old = join(g1, 'index.lock')
  writeFileSync(old, '')
  stampPast(old, 120_000)
  const notes1 = []
  const cleaned1 = gl.cleanStaleIndexLocks({
    gitRoot: g1,
    hasGitProcessProbe: () => true,
    log: (m) => notes1.push(m),
  })
  assert.equal(cleaned1.length, 1, `超龄的 index.lock 照旧要被清理:${cleaned1}`)
  assert.equal(existsSync(old), false)
  assert.equal(notes1.length, 0, `过去 mtime 不该产生任何未判定点名:${notes1}`)

  // ② 过去 10s(未超龄)+ 有 git 进程 ⇒ 照旧留着,同样不得点名(它本来就是"新鲜")
  const g2 = join(scratch, 'g2')
  mkdirSync(g2)
  const fresh = join(g2, 'index.lock')
  writeFileSync(fresh, '')
  stampPast(fresh, 10_000)
  const notes2 = []
  const cleaned2 = gl.cleanStaleIndexLocks({
    gitRoot: g2,
    hasGitProcessProbe: () => true,
    log: (m) => notes2.push(m),
  })
  assert.equal(cleaned2.length, 0)
  assert.ok(existsSync(fresh), '未超龄的 index.lock 照旧保留')
  assert.equal(notes2.length, 0, `未超龄是"判过了是新鲜",不是"判不出来":${notes2}`)

  // ③ 无 git 进程 ⇒ 锁龄不进判据(判据是"必是残留")⇒ 连未来 mtime 也照旧删除
  const g3 = join(scratch, 'g3')
  mkdirSync(g3)
  const orphan = join(g3, 'index.lock')
  writeFileSync(orphan, '')
  stampFuture(orphan)
  const notes3 = []
  const cleaned3 = gl.cleanStaleIndexLocks({
    gitRoot: g3,
    hasGitProcessProbe: () => false,
    log: (m) => notes3.push(m),
  })
  assert.equal(cleaned3.length, 1, '无 git 进程那一支不依赖锁龄,既有语义不得被本票改形')
  assert.equal(existsSync(orphan), false)
  assert.equal(notes3.length, 0, '不依赖锁龄的那一支不该为负龄点名')
})

test('⑩单实例守卫:无 meta 的锁目录 + 未来 mtime ⇒ kind=undetermined 且点名,不得夹逼成"新鲜"', (t) => {
  const { dir, archive } = mkFixture(t)
  mkdirSync(dir) // 有目录、无 meta.json ⇒ 走"按目录 mtime 估龄"那一支
  const age = stampFuture(dir)
  assert.ok(age < 0, `夹具没造出负龄:${age}`)

  const logs = []
  const r = tryAcquireSingleInstance({
    dir,
    unitId: 'g57',
    staleMs: 1000, // 真实时间线上早已超龄 ⇒ 改前本该回收
    claimArchiveRoot: archive,
    log: (m) => logs.push(m),
  })
  assert.equal(r.acquired, false, '判不出来 ⇒ 不取得锁(失效方向 = 跳过,不是双实例)')
  assert.equal(r.kind, 'undetermined', `kind 必须把"判不出来"与"判过是新鲜"分开,实得 ${r.kind}`)
  assert.equal(r.release, null, '没拿到锁就不给释放句柄')
  assert.match(r.why, /未判定/, `why 必须落"未判定":${r.why}`)
  assert.match(r.why, /锁龄为负 -/, 'why 必须带负龄原值 —— 夹逼成 0 就再也看不出有过负龄')
  assert.match(r.why, /时钟偏移容差/)
  assert.doesNotMatch(
    r.why,
    /⇒ 不判死/,
    `"未超 Xs ⇒ 不判死"是"判过了是新鲜"的措辞,未判定不得借用它:${r.why}`,
  )
  // 点名必须真被人看到(log 出口),不能只躺在返回值里
  assert.equal(logs.length, 1, `点名必须经 log 出口喊出来:${JSON.stringify(logs)}`)
  assert.match(logs[0], /单实例守卫:未判定/)
  // 不动锁、不留现场
  assert.ok(existsSync(dir), '未判定 ⇒ 锁保持原样')
  assert.equal(leftoverStale(dir), 0)
  assert.equal(existsSync(archive), false, '未判定 ⇒ 不得产生任何抢占现场')
})

test('⑩b单实例守卫:死 pid + 未来 ts ⇒ 同样落 undetermined 点名(不得静默不回收)', (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { unitId: 'unit-甲', pid: DEAD_PID, ts: Date.now() + FUTURE_SHIFT_MS })
  const before = readFileSync(join(dir, 'meta.json'), 'utf8')
  const logs = []
  const r = tryAcquireSingleInstance({
    dir,
    unitId: 'g57',
    staleMs: 1000,
    claimArchiveRoot: archive,
    log: (m) => logs.push(m),
  })
  assert.equal(r.acquired, false)
  assert.equal(r.kind, 'undetermined', `实得 kind=${r.kind} why=${r.why}`)
  assert.match(r.why, /锁龄为负/)
  assert.doesNotMatch(r.why, /暂不回收/, '既有的"刚退出,暂不回收"是判过了的措辞,不得套用')
  assert.equal(logs.length, 1)
  assert.equal(readFileSync(join(dir, 'meta.json'), 'utf8'), before, '未判定 ⇒ 锁内容一字不动')
  assert.equal(existsSync(archive), false, '零抢占现场')
})

test('⑩c反向对照:过去 mtime/ts 的既有回收语义一字不变(超龄 ⇒ 照旧回收)', (t) => {
  // ① 无 meta + 过去超龄 mtime ⇒ 照旧按残留回收
  const f1 = mkFixture(t)
  mkdirSync(f1.dir)
  stampPast(f1.dir, 120_000)
  const logs1 = []
  const r1 = tryAcquireSingleInstance({
    dir: f1.dir,
    unitId: 'g57',
    staleMs: 1000,
    claimArchiveRoot: f1.archive,
    log: (m) => logs1.push(m),
  })
  assert.equal(r1.acquired, true, '既有语义:无 meta 且超龄 ⇒ 照旧回收')
  assert.equal(r1.kind, 'acquired')
  assert.ok(
    logs1.some((l) => /视为残留回收/.test(l)),
    `回收理由仍须逐字沿用既有措辞:${JSON.stringify(logs1)}`,
  )
  assert.ok(!logs1.some((l) => /未判定/.test(l)), '过去 mtime 不得被点名成未判定')
  if (r1.release) r1.release()

  // ② 死 pid + 过去超龄 ts ⇒ 照旧回收
  const f2 = mkFixture(t)
  putLock(f2.dir, { unitId: 'unit-甲', pid: DEAD_PID, ts: Date.now() - 120_000 })
  const logs2 = []
  const r2 = tryAcquireSingleInstance({
    dir: f2.dir,
    unitId: 'g57',
    staleMs: 1000,
    claimArchiveRoot: f2.archive,
    log: (m) => logs2.push(m),
  })
  assert.equal(r2.acquired, true, '既有语义:pid 已死且超龄 ⇒ 照旧回收')
  assert.ok(
    logs2.some((l) => /回收残留/.test(l)),
    `回收理由仍须逐字沿用既有措辞:${JSON.stringify(logs2)}`,
  )
  if (r2.release) r2.release()
})

// ── 9. G-57 收口剩余两格:acquire 与 clean CLI 的负龄点名 ────────────────────
// 别席 6d9be2907d 已收口 cleanStaleIndexLocks / tryAcquireSingleInstance(⑧-⑩);
// 本票收口 acquire(判读块)与 clean CLI(main())最后两格。病型同族:未来 ts ⇒ age 为负
// ⇒ 原判据的两个 age 比较恒假 ⇒ "pid 名义存活 + 未来 ts"永不判死。改前实测:
// acquire 静默轮询到超时(age=-3600s,零负龄输出);clean CLI 静默落"保留"支,
// 还跟着报"✅ 无 stale 锁需清理" —— 把"没判"写成"判过了,没有"。
/** 造一把持有者为 sleeper(真活进程)的锁,返回 {wt, lockDir, sleeper} */
function makeCleanFixture(t, { pid, ts }) {
  const { scratch } = mkFixture(t)
  const wt = join(scratch, 'wt')
  mkdirSync(wt, { recursive: true })
  execFileSync('git', ['init', '-q', '-b', 'main'], {
    cwd: wt,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const lockDir = join(wt, '.git', LOCK_NAME)
  mkdirSync(lockDir, { recursive: true })
  writeFileSync(
    join(lockDir, 'meta.json'),
    JSON.stringify({ unitId: 'g57-clean', pid, ts }),
    'utf8',
  )
  return { wt, lockDir }
}
/** 在夹具 git 仓里跑一次真 `git-lock.mjs clean` 子进程 */
function runClean(wt) {
  return spawnSync(process.execPath, [GITLOCK_ABS, 'clean'], {
    cwd: wt,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

test('⑪acquire:未来 ts + pid 名义存活 ⇒ 点名"锁龄不可判定"、零抢占、一次只喊一遍(改前是静默等超时)', async (t) => {
  const { dir, archive } = mkFixture(t)
  mkdirSync(dir, { recursive: true })
  const futureTs = Date.now() + FUTURE_SHIFT_MS
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ unitId: 'unit-甲', pid: process.pid, ts: futureTs }),
    'utf8',
  )
  assert.ok(Date.now() - futureTs < 0, '夹具没造出负龄')
  const logs = []
  let threw = null
  try {
    await gl.acquire({
      unitId: 'g57-waiter',
      timeoutMs: 1500,
      staleMs: 50, // 真实时间线上"未来 1h"早该双双超龄 ⇒ 负龄让两个 age 比较恒假
      hardStaleMs: 100,
      dir,
      cleanIndexLocks: false,
      claimArchiveRoot: archive,
      log: (m) => logs.push(m),
    })
  } catch (e) {
    threw = e
  }
  assert.ok(threw, '负龄 ⇒ 不可判定 ⇒ 不抢占 ⇒ 只能等超时抛错(失效方向不是双写)')
  // 点名:负龄原值 + "不可判定"措辞,且一次 acquire 只喊一遍(300ms 轮询不刷屏)
  const ageNotes = logs.filter((l) => /锁龄不可判定/.test(l))
  assert.equal(ageNotes.length, 1, `负龄点名必须恰一条(只喊一遍),实得 ${JSON.stringify(logs)}`)
  assert.match(ageNotes[0], /锁龄为负 -/, '点名必须带负龄原值(夹逼成 0 就再也看不出有过负龄)')
  assert.match(ageNotes[0], /时钟偏移容差/, '点名必须点名"时钟偏移"这个成因')
  assert.doesNotMatch(
    ageNotes[0],
    /⇒ 不判死|未超 .*s/,
    `未判定不得借用"判过了是新鲜"的措辞:${ageNotes[0]}`,
  )
  // 零抢占:锁一字未动、零归档现场
  assert.equal(gl.readMeta(dir)?.unitId, 'unit-甲', '未判定 ⇒ 不得抢占')
  assert.equal(existsSync(archive), false, '未判定 ⇒ 零归档现场')
  assert.equal(leftoverStale(dir), 0)
})

test('⑪b回归锁:acquire 过去 ts 的两格(死 pid ⇒ 立即抢占;活 pid 未超龄 ⇒ 不抢且零负龄点名)逐字不变', async (t) => {
  // ① 死 pid + 过去 2s(默认 staleMs=300s 都没到)⇒ 照旧**立即**抢占(2026-09-19 语义)
  const f1 = mkFixture(t)
  putLock(f1.dir, { unitId: 'unit-甲', pid: DEAD_PID, ts: Date.now() - 2_000 })
  const logs1 = []
  const got1 = await gl.acquire({
    unitId: 'g57-waiter',
    timeoutMs: 2000,
    dir: f1.dir,
    cleanIndexLocks: false,
    claimArchiveRoot: f1.archive,
    log: (m) => logs1.push(m),
  })
  assert.equal(got1, true, '死 pid ⇒ 立即抢占的既有语义不得被本票改形')
  assert.equal(gl.readMeta(f1.dir)?.unitId, 'g57-waiter', '抢占后锁应易主到等待者')
  assert.ok(!logs1.some((l) => /不可判定/.test(l)), '过去 ts 不得被点名成未判定')

  // ② 活 pid + 过去 10s + 默认 staleMs=300s(未超龄)⇒ 照旧不抢、等超时;零负龄点名
  const f2 = mkFixture(t)
  putLock(f2.dir, { unitId: 'unit-乙', pid: process.pid, ts: Date.now() - 10_000 })
  const logs2 = []
  let threw2 = null
  try {
    await gl.acquire({
      unitId: 'g57-waiter',
      timeoutMs: 1200,
      dir: f2.dir,
      cleanIndexLocks: false,
      claimArchiveRoot: f2.archive,
      log: (m) => logs2.push(m),
    })
  } catch (e) {
    threw2 = e
  }
  assert.ok(threw2, '活 pid 未超龄 ⇒ 照旧等超时(本票不改这一格)')
  assert.ok(
    !logs2.some((l) => /锁龄不可判定/.test(l)),
    `正常过去 ts 不得触发负龄点名:${JSON.stringify(logs2)}`,
  )
  assert.equal(gl.readMeta(f2.dir)?.unitId, 'unit-乙', '未超龄 ⇒ 锁不被抢')
  assert.equal(existsSync(f2.archive), false, '未超龄 ⇒ 零归档现场')
})

test('⑪b2负龄不碰"不依赖锁龄"的支:死 pid + 未来 ts ⇒ acquire 照旧立即抢占(!holderAlive 短路)', async (t) => {
  const { dir, archive } = mkFixture(t)
  putLock(dir, { unitId: 'unit-甲', pid: DEAD_PID, ts: Date.now() + FUTURE_SHIFT_MS })
  const logs = []
  const got = await gl.acquire({
    unitId: 'g57-waiter',
    timeoutMs: 2000,
    dir,
    cleanIndexLocks: false,
    claimArchiveRoot: archive,
    log: (m) => logs.push(m),
  })
  assert.equal(got, true, '死 pid 这一支不依赖锁龄 ⇒ 负龄也不许拦它(与已修三格同口径)')
  assert.equal(gl.readMeta(dir)?.unitId, 'g57-waiter')
  assert.ok(
    !logs.some((l) => /锁龄不可判定/.test(l)),
    `不依赖锁龄的支不该为负龄点名:${JSON.stringify(logs)}`,
  )
})

test('⑪cclean CLI:未来 ts + pid 名义存活 ⇒ 子进程报"未判定",不再打"保留"与"✅ 无 stale 锁"', (t) => {
  const sleeper = spawn(process.execPath, ['-e', 'setTimeout(()=>{},60_000)'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  t.after(() => {
    try {
      sleeper.kill()
    } catch {
      /* 已退出 */
    }
  })
  const { wt, lockDir } = makeCleanFixture(t, {
    pid: sleeper.pid,
    ts: Date.now() + FUTURE_SHIFT_MS,
  })
  const r = runClean(wt)
  assert.equal(r.status, 0, `clean 子进程异常:${r.stderr}`)
  assert.match(r.stdout, /clean 未判定/, `必须点名未判定:${r.stdout}`)
  assert.match(r.stdout, /锁龄为负 -/, '点名必须带负龄原值(改前打印 age=-3600s 却无人点名)')
  assert.match(r.stdout, /⚠️ 未判定:1 把锁/, '未判定必须进汇总行(改前报的是"✅ 无 stale 锁需清理")')
  assert.doesNotMatch(r.stdout, /保留 ihui-git-write\.lock/, '未判定不得套用"保留"措辞(那是"判过了是新鲜")')
  assert.doesNotMatch(r.stdout, /✅ 无 stale 锁需清理/, '"没判出来"绝不许报成"没有 stale 锁"(§0.3)')
  assert.ok(existsSync(lockDir), '未判定 ⇒ 锁保持原样')
})

test('⑪d回归锁:clean CLI 活 pid + 过去 ts 未超硬上限 ⇒ 照旧"保留"且汇总照旧(逐字不变)', (t) => {
  const sleeper = spawn(process.execPath, ['-e', 'setTimeout(()=>{},60_000)'], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  t.after(() => {
    try {
      sleeper.kill()
    } catch {
      /* 已退出 */
    }
  })
  const { wt, lockDir } = makeCleanFixture(t, {
    pid: sleeper.pid,
    ts: Date.now() - 10_000, // 过去 10s,远小于 1800s 硬上限
  })
  const r = runClean(wt)
  assert.equal(r.status, 0, r.stderr)
  assert.match(
    r.stdout,
    /保留 ihui-git-write\.lock\(持有者 pid=\d+ 仍存活,age=10s/,
    `活 pid 未超硬上限照旧保留:${r.stdout}`,
  )
  assert.match(r.stdout, /✅ 无 stale 锁需清理/, '保留态汇总照旧(本票不改这一格)')
  assert.doesNotMatch(r.stdout, /未判定/, '过去 ts 不得点名未判定')
  assert.ok(existsSync(lockDir), '保留 ⇒ 不动锁')
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
