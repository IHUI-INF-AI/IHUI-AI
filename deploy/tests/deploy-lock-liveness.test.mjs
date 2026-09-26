#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// 部署并发锁判据的取证(2026-09-26 立,根治那次 46 分钟生产冻结)
// =============================================================================
// 判据的四条(C1 进程存在 / C2 StartTime 不得晚于写锁时刻 / C3 机器启动标识一致 /
// C4 心跳未过期)必须**各自**能把陈旧态判下来 —— 只测合取等于没测:今早那把锁
// 在旧判据下是"进程存在=真",四条里有三条也都是真,只有 C2/C3/C4 各自独立成立
// 才拦得住这一型。
//
// 同一条测试文件必须钉住**反例**:四条全满足 ⇒ 判持有、不抢锁。缺了它,这把尺子
// 可以靠"一律判陈旧"拿到全绿,而线上表现是两个 next build 同时写 .next(那正是
// 这把锁存在的理由,见 ihui-deploy.ps1 的锁注释)。
//
// 跑法:node --test deploy/tests/deploy-lock-liveness.test.mjs
// 全程只在 .ihui-agent/tmp/deploy-lock-liveness/ 下写文件;绝不碰
// deploy/win/.deploy.lock 与 .deploy-loop.lock(生产机此刻正在部署轮询,那两把锁
// 可能被活着的持有者握着)。
//
// 为什么用 node --test 而不是 Pester:本仓 deploy/tests 的既有基建就是 node --test
// (prod-bundle-diagnose.test.mjs 用同样方式驱动 bash 资产),Pester 全仓零依赖零配置;
// 为一支脚本引入新的测试运行时不属于本票范围。判据本身仍是 PowerShell —— 这里
// 只做"派生真实现场 + 断言结论",不在 JS 里重写判据(§22c:镜像只复读实现就是复读机)。
// =============================================================================
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const HARNESS = join(HERE, 'deploy-lock-liveness-harness.ps1')
const PWSH = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
const SCRATCH_ROOT = join(REPO, '.ihui-agent', 'tmp', 'deploy-lock-liveness')

function runHarness(name) {
  const dir = resolve(join(SCRATCH_ROOT, name))
  const root = resolve(SCRATCH_ROOT) + sep
  if (!dir.startsWith(root)) throw new Error(`临时落点越界:${dir} 不在 ${root} 之下`)
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const r = spawnSync(
    PWSH,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HARNESS, '-Scratch', dir],
    {
      encoding: 'utf8',
      timeout: 180_000,
      windowsHide: true, // §5b:派生控制台程序必须带,否则用户桌面闪黑窗
    },
  )
  if (r.error) throw new Error(`pwsh 派生失败:${r.error.message}`)
  const lines = (r.stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('{'))
  if (lines.length === 0) {
    throw new Error(
      `夹具没有输出 JSON(exit=${r.status})\nstdout:${(r.stdout || '').slice(0, 800)}\nstderr:${(r.stderr || '').slice(0, 800)}`,
    )
  }
  let parsed
  try {
    parsed = JSON.parse(lines[lines.length - 1])
  } catch (e) {
    throw new Error(`夹具输出不是合法 JSON:${e.message}\n${lines[lines.length - 1].slice(0, 400)}`)
  }
  return { cases: parsed, dir }
}

// 一次派生跑完所有现场(每次 pwsh 启动约 1.5s;每条用例各起一次会把取证拖到分钟级)
const RUN = runHarness('all-cases')

test('_fixtures 夹具自证:量到的是真进程、真启动时刻', () => {
  const f = RUN.cases._fixtures
  assert.ok(f, '夹具没有打印 _fixtures')
  assert.equal(f.youngExists, true, '刚 spawn 的子进程应当真实存在')
  assert.equal(f.youngStartReadable, true, '子进程的 StartTime 必须量得到,否则 C2 的现场是假的')
  assert.equal(f.freeExists, false, `挑出来的"不存在 pid"(${f.freePid})竟然存在,C1 的现场是假的`)
  assert.equal(f.selfExists, true)
  assert.equal(f.selfStartReadable, true)
  assert.ok(f.bootId && f.bootId.length > 10, '当前机器启动标识量不到 ⇒ C3 的现场是假的')
  // 这条是**整个测试的立论基础**:那个真进程的启动时刻必须晚于夹具当作 writtenAt 的时间点,
  // 否则 C2 用例只是在断言一个与 pid 复用无关的东西。
  assert.equal(f.startLaterThanWrite, true, 'C2 现场没造出来:真进程没有"晚于写锁时刻"启动')
})

test('C1 进程不存在 ⇒ 判陈旧(其余三条全满足)', () => {
  const c = RUN.cases.c1_process_gone
  assert.equal(c.verdict, 'stale', `应判陈旧,实得 ${c.verdict}(${c.reason})`)
  assert.equal(c.failed, 'C1-process-gone')
})

test('C2 pid 被复用(真在跑的进程,其 StartTime 晚于 writtenAt)⇒ 判陈旧', () => {
  const c = RUN.cases.c2_pid_reused
  assert.equal(c.verdict, 'stale', `今早那把锁必须被这一条判下来,实得 ${c.verdict}(${c.reason})`)
  assert.equal(c.failed, 'C2-pid-reused')
  assert.match(c.reason, /pid 已被复用/)
})

test('C3 机器启动标识不符 ⇒ 判陈旧(进程仍活着)', () => {
  const c = RUN.cases.c3_boot_changed
  assert.equal(c.verdict, 'stale', `应判陈旧,实得 ${c.verdict}(${c.reason})`)
  assert.equal(c.failed, 'C3-boot-changed')
})

test('C4 心跳超上限 ⇒ 判陈旧(进程仍在、bootId 仍匹配)', () => {
  const c = RUN.cases.c4_heartbeat_stale
  assert.equal(c.verdict, 'stale', `应判陈旧,实得 ${c.verdict}(${c.reason})`)
  assert.equal(c.failed, 'C4-heartbeat-stale')
})

test('反例(不可省):四条全满足 ⇒ 判持有、不得抢锁', () => {
  const c = RUN.cases.all_ok_held
  assert.equal(c.verdict, 'held', `合法持有者必须被判 held,实得 ${c.verdict}(${c.reason})`)
  assert.equal(c.failed, '')
  // C2 的边界:进程启动**早于**写锁时刻是合法形态(持有者本来就先于锁存在)
  const b = RUN.cases.c2_holder_before_lock_ok
  assert.equal(
    b.verdict,
    'held',
    `StartTime 早于 writtenAt 不得判陈旧,实得 ${b.verdict}(${b.reason})`,
  )
})

test('判据失明时不得伪装成陈旧:内容不可用 / 量不到 ⇒ 让路(undetermined)', () => {
  for (const name of ['c0_unusable_undetermined', 'c2_start_unreadable_undetermined']) {
    const c = RUN.cases[name]
    assert.equal(
      c.verdict,
      'undetermined',
      `${name} 应判"未判定"而非抢锁,实得 ${c.verdict}(${c.reason})`,
    )
  }
  // C3 单侧缺值只算"跳过",既不判陈旧也不冒充已核验
  const s = RUN.cases.c3_missing_skips_not_stale
  assert.equal(s.verdict, 'held', `bootId 缺失只该跳过 C3,不该抢锁,实得 ${s.verdict}(${s.reason})`)
  assert.match(s.checks, /C3=skipped/)
})

test('但"判不出"必须有出路:超绝对上限才抢占(不得永久占着)', () => {
  const a = RUN.cases.c0_unusable_over_cap
  assert.equal(a.verdict, 'stale', `内容不可用且超上限应可清理,实得 ${a.verdict}`)
  assert.equal(a.failed, 'C0-unusable-over-cap')
  const b = RUN.cases.c2_start_unreadable_over_cap
  assert.equal(b.verdict, 'stale', `判不出且超绝对上限应可清理,实得 ${b.verdict}`)
  assert.equal(b.failed, 'C5-over-hard-cap')
})

test('端到端:真文件 + 真 mtime 的现场(可重放今早那次冻结)', () => {
  const absent = RUN.cases.file_absent
  assert.equal(absent.lockExists, false)
  assert.equal(absent.shouldHold, false, '没有锁却判"该让路" = 部署环原地死掉')

  const held = RUN.cases.file_held_self
  assert.equal(held.wrote, true, '写锁失败')
  const meta = JSON.parse(held.raw)
  assert.ok(
    meta.pid > 0 && meta.ownerKind === 'loop' && meta.writtenAt && meta.bootId && meta.heartbeatAt,
    `锁必须写下结构化元数据(不再是裸 pid):${held.raw}`,
  )
  assert.equal(held.verdict, 'held', `自己刚写下的锁必须认得是自己的:${held.reason}`)

  const legacy = RUN.cases.file_legacy_pid_reused
  assert.equal(
    legacy.verdict,
    'stale',
    '旧格式裸 pid + mtime 早于该 pid 的启动时刻(= 今早现场)必须判陈旧,实得 ' +
      legacy.verdict +
      '(' +
      legacy.reason +
      ')',
  )
  assert.equal(legacy.shouldHold, false, '判陈旧却没让调用点抢锁,冻结会原样复现')
  assert.equal(
    legacy.failed,
    'C2-pid-reused',
    `该由 C2 拦下,实得 ${legacy.failed}:${legacy.reason}`,
  )

  const liveOld = RUN.cases.file_legacy_live_holder
  assert.equal(liveOld.verdict, 'held', `升级窗口内的活锁(旧格式)不得被抢:${liveOld.reason}`)

  const g = RUN.cases.file_garbage_undetermined
  assert.equal(g.verdict, 'undetermined', `坏内容不得被读成"没人持锁",实得 ${g.verdict}`)
  assert.equal(g.shouldHold, true)
  const gc = RUN.cases.file_garbage_over_cap
  assert.equal(gc.verdict, 'stale', '坏内容超绝对上限必须有出路')
})

test('心跳与放锁的归属纪律:只续自己那把、只删自己那把', () => {
  const hb = RUN.cases._heartbeat
  assert.equal(hb.throttled, false, '15s 内的重复续期应被节流(否则每 700ms 写一次盘)')
  assert.equal(hb.unchangedWhenThrottled, true, '节流时不得改文件内容')
  assert.equal(hb.wrongOwner, false, 'ownerKind 不匹配时不得替别人的锁续心跳')
  assert.equal(hb.renewed, true, '到点必须真的写回')
  assert.equal(hb.writtenAtKept, true, '续心跳只改 heartbeatAt,writtenAt 必须留着(C2 要靠它)')
  assert.equal(hb.beatAdvanced, true, 'heartbeatAt 必须真的往前走')

  const rel = RUN.cases._release
  assert.equal(rel.removedForeign, false, 'pid 不是自己的锁不得删')
  assert.equal(rel.foreignStillThere, true, '替别人放锁 = 两个构建并发写 .next')
  assert.equal(rel.removedOwn, true, '自己那把必须能放掉')
  assert.equal(rel.ownGone, true)
})

test('抢占必须过同一性复核:判定后被换过的锁不得删,判定与内容一致时必须真删', () => {
  // 反例:判据把并发构建的锁抢掉 = 两个 next build 同时写 .next(这把锁存在的全部理由)
  const cas = RUN.cases._cas
  assert.equal(cas.judgedVerdict, 'stale', 'CAS 现场应当先被判陈旧,否则这一路没被走到')
  assert.equal(cas.cleared, false, '判定与删除之间锁已被换 ⇒ 必须取消删除')
  assert.equal(cas.survivorStillThere, true, '新持有者的锁不得被删掉')
  assert.equal(cas.survivorVerdict, 'held', '新锁应被认作合法持有')
  // 正向:必须删得掉,否则今早那种"没人能抢"的冻结原样复现
  const cas2 = RUN.cases._cas2
  assert.equal(cas2.judgedVerdict, 'stale')
  assert.equal(cas2.cleared, true, '判定与内容一致时陈旧锁必须被清掉')
  assert.equal(cas2.gone, true)
})

test('判据只有一份实现:两个读者都点源同一个库,没有第二处 Get-Process', () => {
  const loop = readFileSync(join(REPO, 'deploy', 'win', 'ihui-deploy-loop.ps1'), 'utf8')
  const deploy = readFileSync(join(REPO, 'deploy', 'win', 'ihui-deploy.ps1'), 'utf8')
  for (const [name, src] of [
    ['ihui-deploy-loop.ps1', loop],
    ['ihui-deploy.ps1', deploy],
  ]) {
    assert.match(src, /deploy-lock-common\.ps1/, `${name} 没有点源共享判据库`)
    assert.match(src, /Resolve-IhuiDeployLockState/, `${name} 没有走共享判据入口`)
    // 反向锁:读者手里不得再留一份"只看 pid 在不在"的判断。
    // 只量**代码面**(剥掉整行注释)——本票在注释里三次引用旧判据原文,把它们算进来
    // 就等于让判据被自己的说明文字绊倒(守门 77/§22c 记过同型:"注释里写出来不代表在跑")。
    const codeOnly = src.split(/\r?\n/).filter((l) => !/^\s*#/.test(l))
    const ownGetProcess = codeOnly.filter((l) => /Get-Process\s+-Id/.test(l))
    assert.deepEqual(
      ownGetProcess,
      [],
      `${name} 里还留着自写的 Get-Process -Id 存活判断:\n  ${ownGetProcess.join('\n  ')}`,
    )
  }
  // 阳性对照:这把反向锁不是空尺子 —— 判据实现里必须**有**这一句(量进程的那一处),
  // 否则"读者里没有第二份 Get-Process"可能只是因为它根本没读进程(判据失明)。
  const lib = readFileSync(join(REPO, 'deploy', 'win', 'deploy-lock-common.ps1'), 'utf8')
  const libCode = lib.split(/\r?\n/).filter((l) => !/^\s*#/.test(l))
  assert.ok(
    libCode.some((l) => /Get-Process\s+-Id/.test(l)),
    '判据实现里找不到 Get-Process -Id —— 上面两条"没有第二份"的断言全部失去意义',
  )
  assert.ok(
    libCode.some((l) => /Get-CimInstance/.test(l)),
    '判据实现里找不到 CIM 第二源(StartTime 读不到时无从兜底)',
  )
  // 心跳必须真的挂在长任务里,否则 C4 只是纸面判据
  assert.match(loop, /Update-IhuiDeployLockHeartbeat/, 'loop 未续心跳(构建期会被 C4 误判陈旧)')
  assert.match(deploy, /Update-DeployLockHeartbeat/, 'deploy.ps1 未续心跳')
})
