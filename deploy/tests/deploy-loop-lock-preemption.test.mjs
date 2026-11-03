#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// =============================================================================
// G-208 第②半的落地取证(2026-09-28 立):部署环拿到锁判据结论之后**做的事**
//
// 与本目录既有测试的分工(不要混着读):
//   deploy-lock-liveness.test.mjs  证的是**判据本身**(C1..C4 各自可判、四条全满足
//                                  不得抢、CAS 复核)—— 住在 deploy-lock-common.ps1。
//   本文件                          证的是**读者(ihui-deploy-loop.ps1)** 的三条行为:
//                                  ① 判陈旧 ⇒ 归档现场 + 抢占 + 写下自己的锁;
//                                  ② 判持有/判不出 ⇒ 让路,且锁内容逐字节不得被覆盖;
//                                  ③ "判不出"必须有出路(超绝对上限才抢),否则本票
//                                     要根治的那次冻结只是换了个形态。
//                                  外加 lib 层的"锁 mtime 早于本机真 LastBootUpTime"。
// 为什么这些必须在**本文件**里跑生产脚本(而不是把逻辑搬进夹具重写一遍):判据搬过去
// 测的就是副本 —— §22c 那条"镜像只复读实现就是复读机"的反面,同文件里那条
// "两个读者都点源同一个库"的锁是同一族防线。
//
// 跑法:node --test deploy/tests/deploy-loop-lock-preemption.test.mjs
// 全程只在 .ihui-agent/tmp/deploy-loop-lock-preemption/ 下写文件;绝不碰
// deploy/win/.deploy-loop.lock(脚本自己的 -SelfTestScratch 分支会拒收生产目录)。
// =============================================================================
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const LOOP = join(REPO, 'deploy', 'win', 'ihui-deploy-loop.ps1')
const HARNESS = join(HERE, 'deploy-lock-liveness-harness.ps1')
const PWSH = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
const SCRATCH_ROOT = join(REPO, '.ihui-agent', 'tmp', 'deploy-loop-lock-preemption')

function newDir(name) {
  const dir = resolve(join(SCRATCH_ROOT, name))
  const root = resolve(SCRATCH_ROOT) + sep
  if (!dir.startsWith(root)) throw new Error(`临时落点越界:${dir} 不在 ${root} 之下`)
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

/** 派生 PowerShell:一律 windowsHide(§5b/判据 6 —— 绝不弹可见窗口),不接管道。 */
function derivePwsh(args, label) {
  const r = spawnSync(PWSH, ['-NoProfile', '-ExecutionPolicy', 'Bypass', ...args], {
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
    maxBuffer: 8 << 20,
  })
  if (r.error) throw new Error(`${label} 派生失败:${r.error.message}`)
  const lines = (r.stdout || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith('{'))
  if (lines.length === 0) {
    throw new Error(
      `${label} 没有输出 JSON(exit=${r.status})\nstdout:${(r.stdout || '').slice(0, 1200)}\nstderr:${(r.stderr || '').slice(0, 1200)}`,
    )
  }
  return { json: JSON.parse(lines[lines.length - 1]), status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' }
}

const LOOP_DIR = newDir(join('loop-selftest', String(process.pid)))
const LOOP_RUN = derivePwsh(['-File', LOOP, '-SelfTestScratch', LOOP_DIR], 'ihui-deploy-loop -SelfTestScratch')
const HARN_DIR = newDir('harness-cross-boot')
const HARN = derivePwsh(['-File', HARNESS, '-Scratch', HARN_DIR], 'deploy-lock-liveness-harness')
const LOOP_SRC = readFileSync(LOOP, 'utf8')
// 反向锁要的"代码面":整行注释不参与判定(本票在注释里多次引用旧判据原文,
// 把它们算进来就是让判据被自己的说明文字绊倒 —— 守门 70/77/§22c 记过同型)。
const LOOP_CODE = LOOP_SRC.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n')

function walk(dir, base = dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p, base))
    else out.push(relative(base, p).split(sep).join('/'))
  }
  return out.sort()
}

test('夹具自证:脚本跑完了、量到的是真开机时刻与真活进程', () => {
  assert.equal(LOOP_RUN.status, 0, `-SelfTestScratch 分支应当正常收尾,实得 exit=${LOOP_RUN.status}`)
  const f = LOOP_RUN.json._fixtures
  assert.ok(f, '取证通道没打印 _fixtures')
  assert.equal(f.youngExists, true, '夹具真起的子进程必须存在,否则 S1/S2 的"复用者"是假的')
  assert.equal(f.youngStartReadable, true, '子进程启动时刻量不到 ⇒ C2 的现场是假的')
  assert.equal(f.selfStartReadable, true, '本进程自己的 StartTime 都量不到 ⇒ S3 的活持有者是假的')
  assert.ok(f.bootId && f.bootId.length > 10, '本机启动标识量不到 ⇒ S2"早于 LastBootUpTime"无从核对')
  // 这条是整个 S2 的立论基础:证的是"写锁时刻确实早于本次开机",不是"减了 30 分钟"
  assert.ok(new Date(f.bootId).getTime() <= Date.now(), `开机时刻在未来:${f.bootId}`)
})

test('① 正例:身份被复用 ⇒ 让位、先归档现场、再写下自己的锁(2026-09-26 08:37 重放)', () => {
  const s1 = LOOP_RUN.json.s1
  assert.equal(s1.acquired, true, `那把锁必须被抢下来,否则 46 分钟冻结原样复现。日志:${s1.log}`)
  assert.match(s1.log, /pid 已被复用/)
  assert.equal(s1.lockAfterPid, LOOP_RUN.json._fixtures.selfPid, '抢占之后锁里必须是自己的 pid')
  // 增量口径(不是绝对值):同一 scratch 可能被并发跑的另一支 node --test 也写过归档件,
  // 拿绝对数当"本轮只留了一份"的证据,实测会撞出 5≠1 —— 那是量具的问题,不是判据的问题。
  assert.equal(s1.archiveAdded, 1, `抢占前必须留下恰好一份现场归档,实得 ${s1.archiveAdded}`)
  assert.equal(s1.archivedRaw, String(LOOP_RUN.json._fixtures.youngPid), '归档件必须是删前那份**原样字节**(裸 pid)')
  assert.ok(s1.archivePath && s1.archivePath.toLowerCase().startsWith(resolve(LOOP_DIR).toLowerCase()),
    `归档件落点不在 scratch 内:${s1.archivePath}`)
  const snap = JSON.parse(readFileSync(s1.archivePath, 'utf8'))
  for (const k of ['pid', 'writtenAt', 'heartbeatAt', 'bootId', 'fileMtimeUtc']) {
    assert.ok(k in snap.readings, `归档件的三项读数缺 ${k} —— 事后无法回答"凭什么抢"`)
  }
  assert.equal(snap.verdict, 'stale')
  assert.equal(snap.failed, 'C2-pid-reused')
})

test('② 正例:跨越重启的陈旧锁自动让位(拿盘上 mtime 与真 LastBootUpTime 比,不靠模拟)', () => {
  const s2 = LOOP_RUN.json.s2
  assert.equal(s2.legacy.earlierThanBoot, true, '现场没造出来:锁 mtime 并没有早于本次开机')
  assert.equal(s2.legacy.verdict, 'stale', `跨重启的锁必须判陈旧,实得 ${s2.legacy.verdict}(${s2.legacy.failed})`)
  assert.equal(s2.legacy.acquired, true, '判陈旧却没让调用点抢下来 ⇒ 冻结会原样复现')
  assert.match(s2.legacy.log, /陈旧锁现场已归档/)
  assert.ok(
    new Date(s2.legacy.mtimeUtc).getTime() < new Date(s2.lastBootUpTimeUtc).getTime(),
    `报出来的两个时刻自身不满足"mtime 早于开机":${s2.legacy.mtimeUtc} vs ${s2.lastBootUpTimeUtc}`,
  )
  // 结构化那把(带着上一轮开机的 bootId)也必须被拦下。断言只判"拦下 + 抢下来",
  // 不写死是哪一条(判序会演进,写死就是把实现钉在测试里)。
  assert.equal(s2.structured.verdict, 'stale')
  assert.equal(s2.structured.acquired, true)

  // lib 层的同一型(旧裸 pid 没有 bootId,C3 只能跳过 ⇒ 只能由 C1/C2 拦)
  const cb = HARN.json._cross_boot
  assert.ok(cb, '夹具没打印 _cross_boot')
  assert.equal(cb.pidGone.earlierThanBoot, true, '夹具现场没造出"mtime 早于开机"')
  assert.equal(cb.pidGone.verdict, 'stale', `pid 随重启消失是最常见形态,必须当场让位(不等任何上限),实得 ${cb.pidGone.verdict}`)
  assert.equal(cb.pidGone.shouldHold, false)
  assert.equal(cb.pidReused.earlierThanBoot, true)
  assert.equal(cb.pidReused.verdict, 'stale', '旧格式 + pid 被复用这一格必须有判据拦住(它正是 08:37 的形状)')
  assert.equal(cb.pidReused.bootIdOnLock, '', '旧裸 pid 格式本就没有 bootId —— 这一格是靠 C1/C2 拦的,不是靠 C3')
  // (c) 已知**未覆盖**的一格,按现读登记而不是写成已收:旧格式 + 复用 + StartTime 读不到
  // 时,"这文件比本次开机还老"这句话四条判据里没人看得见,只能由 C5 的绝对上限兜住
  // (要等满 180 分钟)。断言下界刻意是"绝不被认证成持有",不是"当场判陈旧" ——
  // 将来 mtime-vs-LastBootUpTime 成了一条判据后这一格自动变好,测试不会反过来挡它。
  const gap = cb.gapStartUnreadable
  assert.ok(gap, '夹具没打印 gapStartUnreadable(未覆盖那一格就没人登记)')
  assert.notEqual(gap.verdict, 'held', `判据失明时不得把锁认证成"仍被持有":${gap.verdict}/${gap.failed}`)
  assert.equal(gap.neverCertifiedAsHeld, true)
  assert.ok(['undetermined', 'stale'].includes(gap.verdict), `这一格只能是"让路"或"陈旧",实得 ${gap.verdict}`)
})

test('③ 反例(不可省):活着的持锁者绝不被抢,锁内容逐字节不得被动', () => {
  const s3 = LOOP_RUN.json.s3
  assert.equal(s3.structuredAcquired, false, '四条全满足的活锁被抢了 ⇒ 两个构建并发写 .next')
  assert.equal(s3.unchanged, true, '让路那一路连文件内容都不该碰(更不该覆盖成自己的锁)')
  // 旧裸 pid 的活锁:升级窗口里仍在跑的老守护写的,认不出就抢 = 把正在构建的人踢下去
  assert.equal(s3.legacyAcquired, false, `旧格式活锁不得被抢:${s3.log}`)
  assert.equal(s3.legacyUnchanged, true)
  assert.equal(s3.archiveAddedByS3, 0, '让路的两轮都不该留下归档件 —— 归档只属于真抢占那一路')
})

test('④ 对照:unverifiable 维持改动前的行为(让路、不删、不覆盖),但也不能永久挡住', () => {
  const s4 = LOOP_RUN.json.s4
  assert.equal(s4.holds, true, '内容读不出时抢锁 = 拿"没判"当"没人持锁"(本仓最贵的一型)')
  assert.equal(s4.unchanged, true, '让路那一路不得改写锁内容')
  assert.equal(s4.stillThere, true, '判不出就把文件删了 = 静默清场')
  assert.equal(s4.overCapAcquired, true, '"少抢一把"若没有出路,就退化成"谁都抢不动"= 又一次无限期冻结')
  assert.match(s4.log, /让路/)
})

test('取证通道的落点纪律:所有写入都留在 scratch 内,归档路径不得指向生产目录', () => {
  const files = walk(LOOP_DIR)
  assert.ok(files.length > 0, 'scratch 里什么都没有 ⇒ 这一路什么都没跑')
  const logs = [
    LOOP_RUN.json.s1.log,
    LOOP_RUN.json.s2.legacy.log,
    LOOP_RUN.json.s4.log,
  ].join('\n')
  const mentioned = logs.match(/[A-Za-z]:[^\s|]*stale-lock-[^\s|]*\.json/g) || []
  assert.ok(mentioned.length >= 3, `三处抢占都应报出归档路径,实得 ${mentioned.length} 条`)
  for (const p of [...mentioned, LOOP_RUN.json.s1.archivePath]) {
    assert.ok(
      resolve(p).toLowerCase().startsWith(resolve(LOOP_DIR).toLowerCase()),
      `归档件写到了 scratch 之外:${p}`,
    )
  }
  // 源码级护栏:-SelfTestScratch 指向生产目录时必须拒跑(否则"跑一次测试"= 改一次生产锁)
  assert.match(LOOP_CODE, /SelfTestScratch 指向生产目录|拒绝\(取证只在临时目录里写\)/)
  assert.ok(LOOP_SRC.includes('exit 2'), '取证入口的护栏必须能给出非零退出码')
})

test('读者只有一条锁路径:归档在删除之前、Clear 的返回值必须被看见', () => {
  const iEnter = LOOP_CODE.indexOf('function Enter-IhuiLoopLock')
  const iPoll = LOOP_CODE.indexOf('function Invoke-PollOnce')
  assert.ok(iEnter >= 0 && iPoll > iEnter, 'Enter-IhuiLoopLock 必须定义在 Invoke-PollOnce 之前')
  const enter = LOOP_CODE.slice(iEnter, iPoll)
  const iArchive = enter.indexOf('Save-IhuiStaleLockSnapshot')
  const iClear = enter.indexOf('Clear-IhuiDeployLockStale')
  const iWrite = enter.indexOf('Write-IhuiDeployLock -Path $Path')
  assert.ok(iArchive >= 0 && iArchive < iClear, '抢占前必须先归档现场(顺序反了就无现场可归档)')
  // 这一条是本票真正补上的那一格:旧写法不看 Clear 的返回值,紧接着无条件写下自己的锁,
  // 于是"判定之后并发持有者刚写下新锁"会被整份盖掉 —— 两个构建并发写 .next。
  assert.match(enter, /\$cleared\s*=\s*Clear-IhuiDeployLockStale/, 'Clear 的返回值必须被接住')
  assert.match(enter, /if \(\-not \$cleared\)/, '未删成(锁被换过)必须让路,不得继续写下自己的锁')
  assert.ok(iClear < iWrite, '只有删成之后才允许写自己的锁')
  // 反向锁:读者手里不得再留一份"只看 pid 在不在"的判断(与既有测试同一条,扩到新代码)
  assert.deepEqual(LOOP_CODE.match(/Get-Process\s+-Id/g) || [], [], 'loop 里又长出第二处自写的存活判断')
  // 判据只有一份:读者必须点源共享库并走共享入口
  assert.match(LOOP_SRC, /deploy-lock-common\.ps1/)
  assert.match(LOOP_CODE, /Resolve-IhuiDeployLockState/)
})

test('取证分支不得拉起部署:它在守护分支之前 exit,且只走锁处置', () => {
  const iCall = LOOP_SRC.indexOf('Invoke-IhuiLoopLockSelfTest -Scratch')
  const iDaemon = LOOP_SRC.indexOf('if ($Daemon) {')
  assert.ok(iCall > 0, '找不到取证分支的调用点')
  assert.ok(iDaemon > iCall, '取证分支必须排在守护/单次部署之前,否则跑测试=跑部署')
  const block = LOOP_SRC.slice(iCall, iDaemon)
  assert.match(block, /exit 0/, '取证分支必须自带 exit(不 exit 就会往下跑部署)')
  assert.ok(!/Invoke-PollOnce/.test(block), '取证分支里绝不允许出现部署轮询调用')
})

test('派生卫生(判据 6):测试与取证都不得弹可见窗口、不得按映像名杀进程', () => {
  const selfSrc = readFileSync(join(HERE, 'deploy-loop-lock-preemption.test.mjs'), 'utf8')
  // 这条判据差点咬到自己:上一版把 `/taskkill\s+\/IM/` 直接写成字面量,而**本文件的源码**
  // 也在被扫的三面里 ⇒ 门把解释自己的散文判成了违规(与守门 131 的注释自咬同型)。
  // 模式必须拼出来,源码里不得出现连写的形态。
  const TASKKILL_RE = new RegExp('task' + 'kill\\s+/IM', 'i')
  // 只量**代码面**(剥掉整行注释),与本目录既有测试对 `Get-Process -Id` 的处理同一条口径:
  // 这三份文件都要在散文里点名"禁止什么",把说明文字算进违规就等于让判据被自己的解释
  // 绊倒(守门 131/70 各记过一次同型)。真正的形态不会只出现在注释里。
  const codeOnly = (s) => s.split(/\r?\n/).filter((l) => !/^\s*(#|\/\/)/.test(l)).join('\n')
  for (const [name, src] of [
    ['本测试', codeOnly(selfSrc)],
    ['loop', codeOnly(LOOP_SRC)],
    ['harness', codeOnly(readFileSync(HARNESS, 'utf8'))],
  ]) {
    assert.ok(!TASKKILL_RE.test(src), `${name} 里出现按映像名杀进程(会连带杀掉别人的同名进程)`)
    assert.ok(!/-WindowStyle\s+(Normal|Maximized|Minimized)/i.test(src), `${name} 里显式要求了可见窗口`)
  }
  assert.ok(/windowsHide:\s*true/.test(selfSrc), '本测试自己派生 PowerShell 必须带 windowsHide')
  assert.match(LOOP_SRC, /-WindowStyle Hidden/, '取证通道起子进程必须隐藏窗口')
  assert.match(LOOP_SRC, /Stop-Process -Id \$child\.Id/, '收尾只允许按自己起的 pid 精确停')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
