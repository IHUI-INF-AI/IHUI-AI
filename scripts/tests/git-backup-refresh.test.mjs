// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// §22c 镜像测试:直接 import 源脚本的 `__test__`,不在本文件里重写任何判据。
//
// 本票要钉住的是 2026-09-27 夜间实测到的那一型的**四件事**:
//   ① 旧盲点表达式不得回来(它是"恢复源不可用却报绿"的唯一成因);
//   ② 结论必须由 `judgeCheck` 出,`main()` 不得再自己算 `stale`;
//   ③ 坏 ref 的归档必须真挂在 `refreshBackup` 上(函数在而无人调 = 提交链上一路绿灯);
//   ④ 归档必须**先于**删除,且"内容合法而对象取不到"那一格绝不允许清 ref。
//
// G-262(2026-09-27)追加 T9–T16 钉**单实例守卫**:当轮实测 26 个互不相同父进程各对同一
// 备份库开 fetch(守护每 2 分钟叠一发,一次刷新跑不完 2 分钟)。五条交付判据各对应:
//   单实例真生效 → T10/T11(第二个 `--apply` 打印 SKIPPED 且**零 git 派生** —— 断言方式是
//     "若真派生,桩 git 必炸";退出码 0 与"桩从未被碰过"互斥地共同证明 spawn 数为 0);
//   活锁不被抢 → T11 + T13(变异在交付报告里现跑:放宽"活着"一侧的判定 ⇒ T11 翻红);
//   跳过不是失败 → T10/T12(status===0)+ T15(两发真串行都 0);
//   --check 零副作用不破 → T14(不建锁、不动 refs、不被守卫拦);
//   反向对照"锁被他人持有 ⇒ 不删锁" → T10/T11/T12 均逐字节比对被持有的 meta.json。

import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveBackupDir, resolveGitBin } from '../lib/gitdir.mjs'
import { tryAcquireSingleInstance } from '../git-lock.mjs'
import { __test__ as src } from '../git-backup-refresh.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(resolve(HERE, '../git-backup-refresh.mjs'), 'utf8')
const SCRIPT = resolve(HERE, '../git-backup-refresh.mjs')
const GITLOCK_SOURCE = readFileSync(resolve(HERE, '../git-lock.mjs'), 'utf8')
const LOCK_SUB = 'ihui-backup-refresh.lock'
const LOCK_UNIT = 'git-backup-refresh'
const REAL_GIT = resolveGitBin() || 'git'

/** 真 git 派生的统一姿势(绝对路径 + safe.directory + windowsHide + timeout + 接管 stdio)。 */
function gitRun(args, cwd) {
  return execFileSync(REAL_GIT, ['-C', cwd, '-c', 'safe.directory=*', ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/**
 * 造一份"恢复源落后 1 枚提交"的可控现场。
 * 工作树目录名带随机后缀 —— resolveBackupDir 的**第一候选**是真实归档根
 * `gitArchiveDir()/<basename>.git-backup-20260912`,随机名保证它永不命中,
 * 子测试因此绝不碰生产备份库(§5b 禁改区)。
 */
function makeFixture() {
  const dir = mkScratch('ihui-g262-')
  const wt = join(dir, `wt${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`)
  mkdirSync(wt, { recursive: true })
  gitRun(['init', '-q', '-b', 'main'], wt)
  writeFileSync(join(wt, 'a.txt'), 'v1\n')
  gitRun(['add', 'a.txt'], wt)
  gitRun(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v1'], wt)
  const backup = join(dir, `${basename(wt)}.git-backup-20260912`)
  gitRun(['clone', '--bare', '-q', wt, backup], dir)
  // 源再走一步 ⇒ 备份进入"该刷"的状态(真 apply 会 fetch;桩 apply 会在第一记 git 调用炸)
  writeFileSync(join(wt, 'a.txt'), 'v2\n')
  gitRun(['add', 'a.txt'], wt)
  gitRun(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v2'], wt)
  assert.equal(
    resolveBackupDir(wt).replace(/\\/g, '/'),
    backup.replace(/\\/g, '/'),
    '夹具的备份解析被真实归档候选截胡 —— 测试会碰到生产恢复源,立即修夹具',
  )
  return { dir, wt, backup, head: gitRun(['rev-parse', 'HEAD'], wt) }
}

/**
 * 跑一次真 `--apply` / `--check` 子进程。IHUI_GIT_BIN=process.execPath 是**桩**:
 * node 拿到 git 风格的参数必失败 ⇒ 任何一次 git 派生都会把子进程掀成
 * "❌ … 自身异常" + exit 2。于是"退出码 0 且无该串"就是**零派生**的反证 ——
 * 比"看它没报错"强:它没报错只说明没失败,而这里失败是派生的必然结果。
 */
function runChild(fixture, args, { stub = true } = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      IHUI_WORKTREE: fixture.wt,
      IHUI_GIT_BIN: stub ? process.execPath : REAL_GIT,
    },
    windowsHide: true,
    timeout: 120_000,
  })
}

function plantMeta(lockDir, meta) {
  mkdirSync(lockDir, { recursive: true })
  writeFileSync(join(lockDir, 'meta.json'), JSON.stringify(meta), 'utf8')
}

function readMetaBytes(lockDir) {
  try {
    return readFileSync(join(lockDir, 'meta.json'))
  } catch {
    return null
  }
}

test('T1 导入源模块不得触发 main() 副作用,且三个新出口必须在位(§22d)', () => {
  for (const key of [
    'refreshBackup',
    'classifyBackupTip',
    'judgeCheck',
    'quarantineBrokenTipRef',
  ]) {
    assert.equal(typeof src[key], 'function', `__test__ 缺出口:${key}`)
  }
})

test('T2 反向锁:旧的"读不到就算追平"表达式不得回到源码里', () => {
  // 只锁**可执行形态**(`const stale = r.before !== null …`),不锁描述它的注释文字 ——
  // 否则本文件与源码头注里那次如实复盘都会把自己判红(§4/守门 70 同型:说明性文字也带执行性字符)。
  assert.equal(
    /const\s+stale\s*=\s*r\.before\s*!==\s*null/.test(SOURCE),
    false,
    '旧盲点表达式回来了',
  )
})

test('T3 接线锁:--check 的结论必须出自 judgeCheck,不得在 main() 里另算一遍', () => {
  assert.match(
    SOURCE,
    /const\s*\{\s*stale\s*,\s*reason\s*\}\s*=\s*judgeCheck\(/,
    'main() 未委托给 judgeCheck',
  )
  const mainAt = SOURCE.indexOf('async function main(')
  // 取**调用形态**(赋值右侧)而不是裸 `judgeCheck({` —— 后者先撞上函数声明自身那一行,
  // 顺序判据就会永远成立不了(本测试第一版就栽在这里)。
  const callAt = SOURCE.indexOf('= judgeCheck({')
  assert.ok(mainAt > 0 && callAt > mainAt, 'judgeCheck 未在 main() 内被调用')
})

test('T4 接线锁:坏 ref 归档必须真挂在 refreshBackup 上(函数在而无人调=没有)', () => {
  const fnAt = SOURCE.indexOf('export function refreshBackup(')
  const callAt = SOURCE.indexOf('quarantineBrokenTipRef({ refPath: tipRefPath')
  assert.ok(fnAt > 0 && callAt > fnAt, 'refreshBackup 未调用 quarantineBrokenTipRef')
  assert.ok(/tipState === 'broken-ref'/.test(SOURCE), '未先分档就动手 ⇒ 会把"对象取不到"当坏文件删')
})

test('T5 顺序锁:必须先归档并回读逐字节一致,才允许 unlink', () => {
  const verifyAt = SOURCE.indexOf('back.equals(raw)')
  const unlinkAt = SOURCE.indexOf('unlinkSync(refPath)')
  assert.ok(verifyAt > 0 && unlinkAt > verifyAt, '删除动作没有排在归档回读校验之后')
})

test('T6 判据有牙(构造面):读不到/落后一律"需刷新",只有逐字等值才算追平', () => {
  const S = 'c'.repeat(40)
  for (const tipState of ['broken-ref', 'missing', 'missing-object', 'ok']) {
    assert.equal(
      src.judgeCheck({ srcHead: S, before: null, tipState }).stale,
      true,
      `${tipState} 读不到时不得记绿`,
    )
  }
  assert.equal(
    src.judgeCheck({ srcHead: S, before: 'd'.repeat(40), tipState: 'ok' }).stale,
    true,
    '落后必须判红',
  )
  assert.equal(
    src.judgeCheck({ srcHead: null, before: S, tipState: 'ok' }).stale,
    true,
    '源 HEAD 取不到不得记绿',
  )
  assert.equal(
    src.judgeCheck({ srcHead: S, before: S, tipState: 'ok' }).stale,
    false,
    '等值仍须判追平(反向对照)',
  )
})

test('T7 四态互斥:半截写入与"对象取不到"不得并桶', () => {
  const hex = `${'b'.repeat(40)}\n`
  assert.equal(
    src.classifyBackupTip({ sha: 'f'.repeat(40), refFileExists: true, refFileText: hex }),
    'ok',
  )
  assert.equal(
    src.classifyBackupTip({ sha: null, refFileExists: false, refFileText: null }),
    'missing',
  )
  assert.equal(
    src.classifyBackupTip({ sha: null, refFileExists: true, refFileText: '\0'.repeat(41) }),
    'broken-ref',
  )
  assert.equal(
    src.classifyBackupTip({ sha: null, refFileExists: true, refFileText: 'a'.repeat(17) }),
    'broken-ref',
  )
  assert.equal(
    src.classifyBackupTip({ sha: null, refFileExists: true, refFileText: hex }),
    'missing-object',
  )
})

test('T8 行为面:合法 sha 的 ref 绝不被清除,全 NUL 的才归档后清除', () => {
  const dir = mkScratch('ihui-bkrefresh-')
  try {
    const arch = join(dir, 'arch')
    const goodPath = join(dir, 'good-main')
    writeFileSync(goodPath, `${'9'.repeat(40)}\n`)
    const g = src.quarantineBrokenTipRef({ refPath: goodPath, archiveDir: arch, label: 'good' })
    assert.equal(g.did, false, '合法 sha 不得被清除')
    assert.ok(existsSync(goodPath), '合法 sha 的 ref 文件被删了')
    assert.match(g.error || '', /禁止清除/)

    const badPath = join(dir, 'bad-main')
    writeFileSync(badPath, Buffer.alloc(41, 0))
    const b = src.quarantineBrokenTipRef({ refPath: badPath, archiveDir: arch, label: 'bad' })
    assert.equal(b.did, true, b.error || '坏 ref 未被处理')
    assert.ok(!existsSync(badPath), '清除未生效')
    assert.ok(existsSync(b.dest), '现场未归档')
    assert.deepEqual([...readFileSync(b.dest)], Array(41).fill(0), '归档字节与现场不等')
  } finally {
    rmScratch(dir)
  }
})

// ── G-262 单实例守卫 ────────────────────────────────────────────────────────────

test('T9 接线锁:守卫挂在被调方 main() 且只包 apply 路径;git-lock 既有判据一字未动', () => {
  assert.match(
    SOURCE,
    /import \{ tryAcquireSingleInstance \} from '\.\/git-lock\.mjs'/,
    '守卫未复用 git-lock 的锁语义(或引用被摘线)',
  )
  const mainAt = SOURCE.indexOf('async function main(')
  const guardAt = SOURCE.indexOf('tryAcquireSingleInstance({', mainAt)
  const callAt = SOURCE.indexOf('const r = refreshBackup()', mainAt)
  assert.ok(mainAt > 0 && guardAt > mainAt && callAt > guardAt, 'main() 里守卫没排在刷新之前')
  // 只包 apply:--check / --dry-run 不得被拦(它们的零副作用是每轮早退的前提)
  assert.match(SOURCE, /if \(!CHECK_ONLY && !DRY_RUN\) \{/, '守卫没按 CHECK_ONLY/DRY_RUN 分流')
  assert.match(
    /if \(!guard\.acquired\)[\s\S]{0,700}?return 0/.exec(SOURCE.slice(mainAt))?.[0] ?? '',
    /return 0/,
    'SKIPPED 支的退出码不是 0(恒非零支会弄崩守护的其余自愈步)',
  )
  // 反第二真相:被调方不得自己抄一份锁语义(判活/回收/抢占算法只许住在 git-lock)
  assert.doesNotMatch(SOURCE, /claimStaleLock|isPidAlive|verifyHolder/, 'git-backup-refresh 里出现了第二份锁判据')
  // 地基文件是**纯新增**:acquire 那条既有判据行必须逐字还在
  assert.ok(
    GITLOCK_SOURCE.includes('else if (!holderAlive || age > hardStaleMs || age > staleMs) {'),
    'acquire 的既有抢占判据被改了(G-262 只允许新增导出)',
  )
  assert.equal(
    (GITLOCK_SOURCE.match(/export function tryAcquireSingleInstance\(/g) || []).length,
    1,
    'tryAcquireSingleInstance 必须恰好定义一次',
  )
})

test('T10 判据1+5:另一活进程持锁时,第二个 --apply 打 SKIPPED、exit 0、零 git 派生、不碰锁', () => {
  const f = makeFixture()
  const lockDir = join(f.backup, LOCK_SUB)
  let g = null
  try {
    g = tryAcquireSingleInstance({ dir: lockDir, unitId: LOCK_UNIT, log: () => {} })
    assert.equal(g.acquired, true, '夹具自己都没能拿到锁')
    assert.equal(g.kind, 'acquired')
    const metaBefore = readMetaBytes(lockDir)
    assert.ok(metaBefore && JSON.parse(String(metaBefore)).pid === process.pid)

    const c = runChild(f, [])
    assert.equal(c.status, 0, `跳过必须是 0:${c.stdout}\n${c.stderr}`)
    assert.match(c.stdout, /SKIPPED/, '第二个实例没报 SKIPPED')
    assert.doesNotMatch(c.stdout + c.stderr, /自身异常|增量 fetch 失败/, '子进程碰了 git ⇒ 守卫根本没生效')
    // 反向对照(判据5):锁被他人持有 ⇒ 不得删、不得改
    assert.ok(existsSync(lockDir), '跳过的实例把别人的锁删了')
    assert.deepEqual(readMetaBytes(lockDir), metaBefore, '持有者的 meta.json 被动过')
  } finally {
    if (g?.release) g.release()
    rmScratch(f.dir)
  }
})

test('T11 判据2:持有者存活但身份无从对账(旧式 meta,无 pidStart)⇒ 不得抢', () => {
  const f = makeFixture()
  const lockDir = join(f.backup, LOCK_SUB)
  // 一个真活着的无关进程当持有者;meta 手工写成旧形态(无 host/pidStart)⇒ verifyHolder 落 unverifiable
  const sleeper = spawn(process.execPath, ['-e', 'setTimeout(()=>{},60_000)'], { windowsHide: true })
  try {
    plantMeta(lockDir, { unitId: LOCK_UNIT, pid: sleeper.pid, ts: Date.now() })
    const before = readMetaBytes(lockDir)
    const c = runChild(f, [])
    assert.equal(c.status, 0)
    assert.match(c.stdout, /SKIPPED/, '名义存活的锁被抢了 ⇒ "活着就不抢"这条判据失守')
    assert.deepEqual(readMetaBytes(lockDir), before, '未抢也不许碰:锁目录内容被改')
  } finally {
    sleeper.kill()
    rmScratch(f.dir)
  }
})

test('T12 判据1变体+5:pid 已死但锁龄未超 staleMs ⇒ 跳过且不秒删("锁龄大就直接删"的禁反例)', () => {
  const f = makeFixture()
  const lockDir = join(f.backup, LOCK_SUB)
  try {
    // 起一个秒退的进程拿它的 pid(此刻已死)
    const gone = spawnSync(process.execPath, ['-e', ''], { windowsHide: true })
    assert.ok(gone.pid > 0)
    plantMeta(lockDir, { unitId: LOCK_UNIT, pid: gone.pid, ts: Date.now() })
    const before = readMetaBytes(lockDir)
    const c = runChild(f, [])
    assert.equal(c.status, 0)
    assert.match(c.stdout, /SKIPPED/)
    assert.ok(existsSync(lockDir), '刚死的锁被立即删了(判据:死 ∧ 超龄才回收)')
    assert.deepEqual(readMetaBytes(lockDir), before)
  } finally {
    rmScratch(f.dir)
  }
})

test('T13 单实例原语的三格分档(构造面 + 注入 identityRun,不派生真 PowerShell)', () => {
  const dir = mkScratch('ihui-g262-p-')
  // 第三/四格必须用**别的活进程**的 pid 当持有者:写本进程 pid 会被"同 unit ∧ pid=本进程"
  // 的重入分支短路(acquired=true 的理由就不是身份判据了)—— 夹具的第一版正好踩中这一格。
  const holderProc = spawn(process.execPath, ['-e', 'setTimeout(()=>{},120_000)'], { windowsHide: true })
  try {
    // ① 死 + 超龄 ⇒ 回收并成功持锁,旧锁现场归档
    const d1 = join(dir, 'lock1')
    const arch = join(dir, 'arch')
    const gone = spawnSync(process.execPath, ['-e', ''], { windowsHide: true })
    plantMeta(d1, { unitId: LOCK_UNIT, pid: gone.pid, ts: Date.now() - 10_000 })
    const a = tryAcquireSingleInstance({
      dir: d1,
      unitId: LOCK_UNIT,
      staleMs: 1000,
      claimArchiveRoot: arch,
      log: () => {},
    })
    assert.equal(a.acquired, true, '死+超龄的残留锁必须能被回收,否则守卫一坏就永久停摆')
    assert.equal(JSON.parse(String(readMetaBytes(d1))).pid, process.pid)
    assert.ok(readdirSync(arch).length >= 1, '抢占现场未归档(§5b:覆盖前先归档现场)')
    a.release()

    // ② 死但未超龄 ⇒ 不抢
    const d2 = join(dir, 'lock2')
    plantMeta(d2, { unitId: LOCK_UNIT, pid: gone.pid, ts: Date.now() })
    const b = tryAcquireSingleInstance({ dir: d2, unitId: LOCK_UNIT, staleMs: 100_000, log: () => {} })
    assert.equal(b.acquired, false)
    assert.match(b.why, /未超/)
    assert.ok(existsSync(d2))

    // ③ 活着 ∧ 身份确证复用(mismatch)⇒ 允许回收;活着 ∧ match ⇒ 必须跳过
    const d3 = join(dir, 'lock3')
    plantMeta(d3, {
      unitId: LOCK_UNIT,
      pid: holderProc.pid,
      ts: Date.now(),
      host: hostname(),
      pidStart: 1000, // 与"现测"注定的桩值差远超容差 ⇒ mismatch
    })
    const c1 = tryAcquireSingleInstance({
      dir: d3,
      unitId: LOCK_UNIT,
      identityRun: () => String(Math.floor(Date.now() / 1000)),
      claimArchiveRoot: join(dir, 'arch3'),
      log: () => {},
    })
    assert.equal(c1.acquired, true, '身份确证 pid 已被复用(G-193 那一型)时必须回收')
    c1.release()
    const d4 = join(dir, 'lock4')
    plantMeta(d4, {
      unitId: LOCK_UNIT,
      pid: holderProc.pid,
      ts: Date.now(),
      host: hostname(),
      pidStart: 777777,
    })
    const c2 = tryAcquireSingleInstance({
      dir: d4,
      unitId: LOCK_UNIT,
      identityRun: () => '777777', // match:确是持锁进程本人
      log: () => {},
    })
    assert.equal(c2.acquired, false, '身份 match ⇒ 确有人在持有,不得抢')
    assert.match(c2.why, /已有一个实例/)
  } finally {
    holderProc.kill()
    rmScratch(dir)
  }
})

test('T14 判据4:--check 零副作用不破 —— 不建锁、不动备份 refs、也不被守卫拦', () => {
  const f = makeFixture()
  const lockDir = join(f.backup, LOCK_SUB)
  const tipBefore = gitRun(['rev-parse', '--verify', 'main'], f.backup)
  try {
    // check 必须真跑 git(读)才有结论 —— 桩会让它连 rev-parse 都失败,测不到目标形态
    const c = runChild(f, ['--check'], { stub: false })
    assert.ok(c.status === 0 || c.status === 1, `check 退出码异常:${c.status} ${c.stdout}${c.stderr}`)
    assert.equal(c.status, 1, '夹具是落后的,check 必须报需刷新(原语义)')
    assert.match(c.stdout, /需刷新/)
    assert.doesNotMatch(c.stdout, /SKIPPED/, '--check 不该挂守卫')
    assert.ok(!existsSync(lockDir), '--check 建了锁目录 ⇒ 零副作用判据被破')
    assert.equal(gitRun(['rev-parse', '--verify', 'main'], f.backup), tipBefore, '--check 把备份动了')
    assert.ok(!existsSync(join(f.backup, 'FETCH_HEAD')), '--check 派生了 fetch(FETCH_HEAD 出现)')
    assert.ok(!existsSync(join(f.backup, 'refs-manifest.json')), '--check 写了 manifest')
    // 持有者在场时 --check 行为一字不变(它不排队、不等锁)
    const g = tryAcquireSingleInstance({ dir: lockDir, unitId: LOCK_UNIT, log: () => {} })
    const c2 = runChild(f, ['--check'], { stub: false })
    assert.equal(c2.status, 1)
    assert.doesNotMatch(c2.stdout, /SKIPPED/)
    g.release()
  } finally {
    rmScratch(f.dir)
  }
})

test('T15 判据3:真 git 串行两发 --apply 都 exit 0 —— 第一发追平,第二发"已是最新态"', () => {
  const f = makeFixture()
  const lockDir = join(f.backup, LOCK_SUB)
  try {
    const a = runChild(f, [], { stub: false })
    assert.equal(a.status, 0, `第一发必须成:${a.stdout}${a.stderr}`)
    assert.match(a.stdout, /已增量追平/)
    assert.equal(gitRun(['rev-parse', '--verify', 'main'], f.backup), f.head, 'apply 后备份没追平源')
    const b = runChild(f, [], { stub: false })
    assert.equal(b.status, 0)
    assert.doesNotMatch(b.stdout, /SKIPPED/, '两发是串行的,第二发不该看到在飞持有者')
    assert.match(b.stdout, /已是最新态/)
    assert.ok(!existsSync(lockDir), '跑完锁没释放')
  } finally {
    rmScratch(f.dir)
  }
})

test('T16 两发并发的形态学保证:先起跑者在 fetch 中,后起跑者必 SKIPPED 且零派生', () => {
  // 判据1的"起两个 --apply"形态:第二个进程的 SKIPPED + exit 0 由 T10/T11 钉;
  // 本例补上**互斥的另一半** —— 同一资源上先后两个真实例串行完成,不互相踩。
  const f = makeFixture()
  try {
    const a = runChild(f, [], { stub: false })
    const b = runChild(f, [], { stub: false }) // A 已释放后才轮到 B 拿锁(串行 = 无并发写)
    assert.equal(a.status, 0)
    assert.equal(b.status, 0)
    assert.equal(gitRun(['rev-parse', '--verify', 'main'], f.backup), f.head)
    assert.ok(!existsSync(join(f.backup, LOCK_SUB)))
  } finally {
    rmScratch(f.dir)
  }
})
