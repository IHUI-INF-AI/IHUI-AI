// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 裸档自愈(`git-guardian` 的 core.bare 归一)镜像测试。
 *
 * 立因(2026-09-28 18:29 实测):活仓库 gitdir 的 `core.bare` 被翻成 `true`,于是
 * 守护自评 `pointerOk/gitdirOk/gitUsable/dirty` 全部正常,而工作树里**每一条** git 命令
 * 都报 `fatal: this operation must be run in a work tree` —— 提交链、钩子、落地器、推送门
 * 同时不可用,账面却一片绿。`rev-parse HEAD` 在裸仓库下照样成功,所以"git 可用"推不出
 * "工作树还能用":这是两把尺子,而本仓只有前一把。
 *
 * 钉住四件事:
 *  ① 症状可复现:bare=true ⇒ `git -C <worktree> status` 必失败(不是"我们假设它会失败");
 *  ② 自愈有效:healWorktreeBare 把活仓库改回 false,且**恢复源也一起改** ——
 *     §5b 的恢复是 cpSync(备份 → gitdir),只修活仓库等于留一颗定时炸弹;
 *  ③ 不空转:两侧本来都不是 true 时不得写盘(幂等,且不会顺手改别人的 config);
 *  ④ 装车证明:`status()` 里真有 worktreeUsable 这一维、`remediate()` 的两条恢复分支与
 *     主链都真调 healWorktreeBare、`anomalyLine` 真点名裸档 —— 防"函数在而无人调"。
 * 全程只在临时仓库上跑,绝不碰活 gitdir / 活恢复源。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as G } from '../git-guardian.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'

function gitAt(args, cwd) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...(cwd ? ['-C', cwd] : []), ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

/** 造一个"工作树 + 外置 gitdir(指针文件)"的最小仓库,与 §5b 的活仓库形态同构。 */
function fixture() {
  const dir = mkScratch('guard-bare-')
  const work = join(dir, 'work')
  const gitdir = join(dir, 'gitdir')
  const backup = join(dir, 'backup')
  mkdirSync(work, { recursive: true })
  mkdirSync(backup, { recursive: true })
  gitAt(['init', '-q', '-b', 'main', '--separate-git-dir', gitdir, work])
  gitAt(['config', 'user.email', 't@t'], work)
  gitAt(['config', 'user.name', 't'], work)
  writeFileSync(join(work, 'a.txt'), 'a\n', 'utf8')
  gitAt(['add', '-A'], work)
  gitAt(['commit', '-qm', 'init'], work)
  // 恢复源:整份 gitdir 的副本 —— §5b 的恢复就是 cpSync(备份 → gitdir),
  // 所以夹具必须也是"完整副本",只拷 config/HEAD 会被 git 判成 not in a git directory(测不到真形态)
  cpSync(gitdir, backup, { recursive: true })
  return { dir, work, gitdir, backup }
}

test('① 症状可复现:core.bare=true 让工作树里每条 git 命令失败,而 rev-parse 照样成功', () => {
  const f = fixture()
  try {
    assert.equal(G.readBareFlag(f.gitdir), 'false', '夹具自证:新建仓库不是裸档')
    assert.equal(gitAt(['rev-parse', '--is-inside-work-tree'], f.work), 'true')
    gitAt(['--git-dir', f.gitdir, 'config', 'core.bare', 'true'])
    assert.equal(G.readBareFlag(f.gitdir), 'true')
    // 裸档下 rev-parse HEAD **仍然成功** —— 这正是"git 可用"不够用的证明
    assert.ok(gitAt(['rev-parse', 'HEAD'], f.work).length >= 7, 'rev-parse 在裸档下应照样成功')
    assert.throws(() => gitAt(['status', '--porcelain'], f.work), /must be run in a work tree/)
  } finally {
    rmScratch(f.dir)
  }
})

test('② 自愈把活仓库与恢复源两侧一起归一(cpSync 恢复不得把裸档注回来)', () => {
  const f = fixture()
  try {
    gitAt(['--git-dir', f.gitdir, 'config', 'core.bare', 'true'])
    gitAt(['--git-dir', f.backup, 'config', 'core.bare', 'true'])
    const usable = () => {
      try {
        return gitAt(['rev-parse', '--is-inside-work-tree'], f.work) === 'true'
      } catch {
        return false
      }
    }
    assert.equal(usable(), false, '夹具自证:动手前工作树确实不可用')
    // captureAudit 传空档:本例只判"两侧是否一起归一",不该在镜像测试里真去派生
    // PowerShell 并往运行态目录写件(那由 ⑦/⑧ 两例专门取证)。
    assert.equal(
      G.healWorktreeBare({ gitdir: f.gitdir, backup: f.backup, probeUsable: usable, captureAudit: () => null }),
      true,
    )
    assert.equal(G.readBareFlag(f.gitdir), 'false', '活仓库未归一')
    assert.equal(G.readBareFlag(f.backup), 'false', '恢复源未归一 —— 下一次 cpSync 恢复会重新制造同一故障')
    assert.equal(usable(), true, '归一后工作树必须立刻可用')
    gitAt(['status', '--porcelain'], f.work)
  } finally {
    rmScratch(f.dir)
  }
})

test('③ 本来就不是裸档时不得写盘(幂等,也不顺手改别人的 config)', () => {
  const f = fixture()
  try {
    const before = readFileSync(join(f.gitdir, 'config'), 'utf8')
    const backupBefore = readFileSync(join(f.backup, 'config'), 'utf8')
    let probed = 0
    let audited = 0
    const ok = G.healWorktreeBare({
      gitdir: f.gitdir,
      backup: f.backup,
      probeUsable: () => {
        probed += 1
        return true
      },
      captureAudit: () => {
        audited += 1
      },
    })
    assert.equal(ok, true)
    assert.equal(probed, 1, '无裸档时只允许探一次(探多次说明走了修复支)')
    assert.equal(audited, 0, '没有翻车就不要取证(不派生 PowerShell、不写审计件)')
    assert.equal(readFileSync(join(f.gitdir, 'config'), 'utf8'), before, '不该动 config')
    assert.equal(readFileSync(join(f.backup, 'config'), 'utf8'), backupBefore, '不该动恢复源 config')
  } finally {
    rmScratch(f.dir)
  }
})

test('④ 装车证明:这一维真被 status/remediate/anomalyLine 消费,不是写了没人调', () => {
  const src = readFileSync(
    join(import.meta.dirname ? import.meta.dirname : process.cwd(), '..', 'git-guardian.mjs'),
    'utf8',
  )
  assert.match(src, /worktreeUsable:\s*worktreeUsable\(\)/, 'status() 里必须报 worktreeUsable')
  assert.match(src, /if\s*\(!worktreeUsable\(\)\)\s*healWorktreeBare\(\)/, '主链必须真调自愈')
  const restoreCalls = src.match(/if \(ok && !worktreeUsable\(\)\) return healWorktreeBare\(\)/g) || []
  assert.equal(restoreCalls.length, 2, `两条恢复分支各须归一一次,实到 ${restoreCalls.length}`)
  assert.match(src, /core\.bare=true\(工作树不可用\)/, 'anomalyLine 必须点名裸档这一型')
})

/**
 * ⑤ 是 ④ 的补集,也是这次真实复发的原因。
 *
 * ④ 断言的是「healWorktreeBare 在 remediate 体内被调用」—— 它绿了整整一轮,而自愈在提交链上
 * 生效次数为 0:main 与 daemon 都把 `coreOk` 算成 pointer+gitdir+gitUsable 三项,裸档下这三项
 * **全为真**(rev-parse 成功),于是每一趟都走健康分支、把 remediate 整个跳过。
 * 邻接锁证明的是"链的中段连着",证明不了"这条链会被走上去"。
 * 所以这一例把判据抽成纯函数,直接喂**故障现场那份读数**。
 */
test('⑤ 核心健康判据必须认裸档这一型:三项全真而工作树不可用 ⇒ 判不健康(故障现场读数)', () => {
  const bare = { pointerOk: true, gitdirOk: true, gitUsable: true, worktreeUsable: false }
  assert.equal(G.coreHealthy(bare), false, 'core.bare=true 时守护必须判不健康,否则会早退跳过 remediate')
  const healthy = { pointerOk: true, gitdirOk: true, gitUsable: true, worktreeUsable: true }
  assert.equal(G.coreHealthy(healthy), true, '四维齐备才算健康(反向对照:不得判成永假)')
  for (const missing of ['pointerOk', 'gitdirOk', 'gitUsable', 'worktreeUsable']) {
    const partial = { ...healthy, [missing]: false }
    assert.equal(G.coreHealthy(partial), false, `缺 ${missing} 不得被算成健康`)
  }
})

/**
 * ⑥ 反向锁:健康判据只许有一份实现。
 * 两处调用点(main 与 daemon)一旦各自手抄那三项,漂移就会重演 —— 本次事故的确切形状是
 * daemon 那侧照旧、main 那侧也照旧,而函数体已经修好了。
 */
test('⑥ 健康判据不得被两处调用点各自重抄:必须走 coreHealthy(),旧三项式不得回来', () => {
  const src = readFileSync(
    join(import.meta.dirname ? import.meta.dirname : process.cwd(), '..', 'git-guardian.mjs'),
    'utf8',
  )
  const sites = src.match(/const coreOk = coreHealthy\(\w+\)/g) || []
  assert.equal(sites.length, 2, `main 与 daemon 各须一处 coreHealthy(),实到 ${sites.length}`)
  const inlined = src.match(/const coreOk = \w+\.pointerOk && \w+\.gitdirOk && \w+\.gitUsable/g) || []
  assert.equal(inlined.length, 0, '旧三项式内联写法不得回来(它会漏掉 worktreeUsable)')
  assert.match(
    src,
    /after\.pointerOk && after\.gitdirOk && after\.gitUsable && after\.refsOk && after\.worktreeUsable/,
    '自愈后的成功判定也必须含工作树可用(否则"自愈成功"日志会对裸档撒谎)',
  )
})

// ————————————————————————————————————————————————————————————————
// 以下是 core.bare **翻车现场取证件**(2026-09-29 立)的取证。
//
// 立因:守护每 2 分钟纠一次裸档(`.workbuddy/git-guardian.log` 一晚 5 回),但**写入者是谁**
// 至今没人知道 —— 三条健康判据全绿、只有工作树命令失败,而翻车时谁开着进程从没被记下来。
// 本票只做一件事:**检出那一刻**抓一份进程清单落盘,再做它今天已经在做的修复。
//
// 判据一律走**纯函数 + 构造面**(守门 103 T12 那一课:证明取材面这类行为不能依赖仓库/机器
// 瞬时状态),真仓此刻有几种进程、跑不跑 PowerShell 都不构成断言。
// ————————————————————————————————————————————————————————————————

const SRC = readFileSync(join(import.meta.dirname, '..', 'git-guardian.mjs'), 'utf8')
const GUARDIAN_BODY = (name) => {
  const at = SRC.indexOf(`function ${name}(`)
  assert.ok(at >= 0, `门体里必须真有 ${name}()`)
  const next = SRC.indexOf('\nfunction ', at + 1)
  return SRC.slice(at, next < 0 ? SRC.length : next)
}

/** 构造面:两条规则各命中一条 —— 规则①看命令行,规则②看进程生日与 config mtime 的距离 */
function snapshotFixture(anchorMs) {
  return [
    // 命中规则①(cmdline 里有活 gitdir 名 + core.bare),同时刻意也让它落在时间窗**外**
    `git.exe|111|222|2020-01-01T00:00:00.000Z|--git-dir D:/IHUI-AI-git-repo config core.bare true`,
    // 只命中规则②(命令行不相干,生日正好等于 anchorMs)
    `ZCode.exe|333|444|${new Date(anchorMs).toISOString().replace(/\.\d{3}Z$/, 'Z')}|--extensionKind=whatever`,
    // 两条都不命中(不相干命令行 + 生日差 1 小时)
    `chrome.exe|555|666|${new Date(anchorMs + 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z')}|--type=renderer`,
  ].join('\n')
}

/**
 * ⑦ 装车证明:检出路径上**确实先写审计、再修复**。
 * 摘掉 healWorktreeBare 里的 captureAudit 调用 ⇒ 本例必读红(审计次数 0、且取到的 bare
 * 值不再是 'true'),因为写回 false 之后现场就没了 —— 这正是本票唯一有意义的时序。
 */
test('⑦ 装车证明:检出裸档后先落现场审计(config 仍是 true 时),再执行修复', () => {
  const f = fixture()
  try {
    gitAt(['--git-dir', f.gitdir, 'config', 'core.bare', 'true'])
    const seen = []
    const ok = G.healWorktreeBare({
      gitdir: f.gitdir,
      backup: f.backup,
      probeUsable: () => true,
      captureAudit: (ctx) => {
        // 取证发生的那一刻:两侧读数必须**还是翻车现场**(true),而不是修完之后的 false
        seen.push({ live: G.readBareFlag(f.gitdir), ctx })
      },
    })
    assert.equal(seen.length, 1, '检出一次只允许取一次证(0 次 = 审计被摘线)')
    assert.equal(seen[0].live, 'true', '审计必须发生在写回 false **之前**,否则 mtime/现场都被自己抹掉了')
    assert.equal(seen[0].ctx.liveWas, 'true', '审计上下文必须带上被检出的现值')
    assert.equal(ok, true, '取证不得改变修复结论')
    assert.equal(G.readBareFlag(f.gitdir), 'false', '修复本身照旧完成')
  } finally {
    rmScratch(f.dir)
  }
  // 同一条时序的源码级锁(函数体被整体改写时仍能看见)
  const body = GUARDIAN_BODY('healWorktreeBare')
  const capAt = body.indexOf('captureAudit({')
  const writeAt = body.indexOf('writeBareFalse(gitdir)')
  assert.ok(capAt >= 0 && writeAt > capAt, 'healWorktreeBare 体内必须先 captureAudit 再 writeBareFalse')
})

/** ⑧ 嫌疑人挑选:规则①与规则②各命中一条,且条目写清是被哪条规则命中的 */
test('⑧ 规则①/规则②各命中一条,并在条目里点名命中的是哪条', () => {
  const anchorMs = Date.parse('2026-09-29T00:00:00.000Z')
  const { processes, malformed } = G.parseProcessSnapshot(snapshotFixture(anchorMs))
  assert.equal(malformed.length, 0)
  assert.equal(processes.length, 3, '三行构造记录都必须被解析')
  const cands = G.selectBareFlipCandidates(processes, { anchorMs })
  assert.equal(cands.length, 2, `应有两条嫌疑人,实到 ${cands.length}`)
  const byCmd = cands.find((c) => c.Name === 'git.exe')
  assert.ok(byCmd, '规则①(命令行含活 gitdir 名 / core.bare)必须命中 git.exe')
  assert.ok(
    byCmd.matchedRules.some((r) => r === 'cmdline:live-gitdir-name'),
    '命中项必须是常量里那两条 id 之一(单份模式串): ' + byCmd.matchedRules.join(','),
  )
  const byTime = cands.find((c) => c.Name === 'ZCode.exe')
  assert.ok(byTime, '规则②(生日落在 config mtime ±10min)必须命中 ZCode.exe')
  assert.deepEqual(byTime.matchedRules, ['time-window:within-600000ms-of-config-mtime'])
  // 命令行自己的 `|` 不得把记录切碎(切碎了会把一次调用读成两条)
  const pipeLine = G.parseProcessSnapshot('x.exe|7|8|2026-01-01T00:00:00.000Z|cmd | tail -3 | grep a')
  assert.equal(pipeLine.processes[0].CommandLine, 'cmd | tail -3 | grep a')
})

/** ⑨ 反向对照:同一份输入而命令行全不命中、生日差 1 小时 ⇒ 名单为空但自证必须是 ok */
test('⑨ 嫌疑人名单为空而清单本身量到了 ⇒ 自证必须记 ok(不得因为空就报 undetermined)', () => {
  const anchorMs = Date.parse('2026-09-29T00:00:00.000Z')
  const { processes } = G.parseProcessSnapshot(snapshotFixture(anchorMs))
  assert.equal(G.selectBareFlipCandidates(processes, { anchorMs }).length, 2, '构造面自证:正例两条该命中')
  // 同一份清单,但把命令行里的 gitdir 名/core.bare 换成不相干参数、生日全部挪出时间窗
  const clean = processes.map((p) => ({
    ...p,
    CommandLine: String(p.CommandLine).replace(/D:\/IHUI-AI-git-repo/, 'C:/somewhere/else').replace(/core\.bare/, 'color.scheme'),
    __createdMs: anchorMs + 3600_000,
  }))
  const cands = G.selectBareFlipCandidates(clean, { anchorMs })
  assert.equal(cands.length, 0, `两条规则都不该命中,实到 ${cands.length}: ` + JSON.stringify(cands))
  const sc = G.bareAuditSelfCheck({
    spawn: { state: 'ok', reason: null, stdout: '' },
    processes: clean,
    malformedCount: 0,
    cmdlineMissing: 0,
    anchorMs,
  })
  assert.equal(sc.verdict, 'ok', '空名单是证据(写入者不在清单里),不是尺子失效')
  assert.equal(sc.counts.processes, clean.length)
})

/** ⑩ 空扫不得冒充通过:进程清单为 0 条必须落 undetermined */
test('⑩ 进程清单为空(0 行)必须落 undetermined,绝不记成 ok', () => {
  const sc = G.bareAuditSelfCheck({
    spawn: { state: 'ok', reason: null, stdout: '' },
    processes: [],
    malformedCount: 0,
    cmdlineMissing: 0,
    anchorMs: Date.parse('2026-09-29T00:00:00.000Z'),
  })
  assert.equal(sc.verdict, 'undetermined')
  assert.ok(!sc.verdict.startsWith('ok'))
  assert.match(sc.reasons.join('\n'), /空扫|为空/)
  // 派生失败与"命令行取不到"各有各的文案,不得并成一桶
  const dead = G.bareAuditSelfCheck({ spawn: { state: 'timeout', reason: '20s 超时', stdout: '' }, processes: [], anchorMs: null })
  assert.equal(dead.verdict, 'undetermined')
  assert.match(dead.reasons.join('\n'), /timeout/)
  assert.doesNotMatch(dead.reasons.join('\n'), /空扫/, '派生失败不得被顺带写成"清单为空"(那是两种不同的故障)')
})

/** ⑪ 保留期反向锁:非 flip-*.json、目录、重解析点一律不得被删 */
test('⑪ 保留期只删 flip-*.json 普通文件,其余逐条点名跳过(§26 junction 穿透同型)', () => {
  const d = G.decideBareFlipRetention(
    [
      { name: 'flip-keep.txt', isFile: true, isLink: false },
      { name: 'flip-dir.json', isFile: false, isLink: false },
      { name: 'flip-link.json', isFile: false, isLink: true },
      { name: 'flip-2026-01-01T000000000Z.json', isFile: true, isLink: false },
    ],
    1,
  )
  assert.deepEqual(d.delete, [], '形状不合/不是普通文件的都不得进删除名单')
  assert.deepEqual(d.kept, ['flip-2026-01-01T000000000Z.json'])
  assert.equal(d.skipped.length, 3)
  assert.ok(d.skipped.some((s) => /重解析/.test(s.reason)), '重解析点必须被点名跳过')
})

/** ⑫ 端到端:审计件真落盘,超保留期只删最旧的 flip-*.json,别人的文件逐字不动 */
test('⑫ 端到端取证:件落盘 + 保留期删最旧 20 份之外的 flip-*.json,非该形状一律不碰', () => {
  const dir = mkScratch('guard-bare-audit-')
  try {
    mkdirSync(dir, { recursive: true })
    const names = []
    for (let i = 0; i < 21; i += 1) {
      const n = `flip-2020-01-0${String(i % 9 + 1)}T0000${String(i).padStart(2, '0')}000Z.json`
      names.push(n)
      writeFileSync(join(dir, n), '{}', 'utf8')
    }
    writeFileSync(join(dir, 'notes-from-another-session.txt'), 'do not touch\n', 'utf8')
    mkdirSync(join(dir, 'flip-looking-like-a-dir.json'))
    // 现场侧:活 gitdir 带 config(bare 现值 + mtime 锚点都要能量到);恢复源刻意没有
    mkdirSync(join(dir, 'live'), { recursive: true })
    writeFileSync(join(dir, 'live', 'config'), '[core]\n\tbare = true\n', 'utf8')
    const file = G.captureBareFlipAudit({
      gitdir: join(dir, 'live'),
      backup: join(dir, 'no-such-backup'),
      liveWas: 'true',
      backupWas: null,
      dir,
      now: Date.parse('2026-09-29T06:00:00.000Z'),
      // 构造清单:一条命中规则①、一条命令行取不到(4 段,没有第 5 段)⇒ 自证落 partial
      runSnapshot: () => ({
        state: 'ok',
        reason: null,
        stdout:
          'git.exe|111|222|2020-01-01T00:00:00.000Z|--git-dir D:/IHUI-AI-git-repo config core.bare true\n' +
          'System|333||2000-01-01T00:00:00.000Z',
      }),
      readBare: () => 'true',
    })
    assert.ok(file && /^flip-.*\.json$/.test(file), '必须返回落盘件名')
    const left = readdirSync(dir)
    assert.ok(left.includes('notes-from-another-session.txt'), '非 flip-*.json 形状的文件必须逐字留在原地')
    assert.ok(left.includes('flip-looking-like-a-dir.json'), '同名目录不得被当文件删掉')
    const flips = left.filter((n) => G.BARE_AUDIT_FILE_RE.test(n) && n.includes('2020'))
    assert.ok(left.includes(file), '刚写的件必须在(它比构造的 2020 件都新)')
    assert.equal(flips.length, G.BARE_AUDIT_KEEP - 1, `最旧的应被清到只剩 ${G.BARE_AUDIT_KEEP - 1} 份旧件 + 本次这 1 份`)
    const payload = JSON.parse(readFileSync(join(dir, file), 'utf8'))
    assert.equal(payload.sides.liveGitdir.bare, 'true')
    assert.ok(payload.sides.liveGitdir.configMtime, 'config mtime 必须落进件里(规则②的锚点)')
    assert.equal(payload.sides.backup.bare, null, '恢复源没有 config ⇒ bare 未判定')
    assert.ok(payload.sides.backup.undeterminedReasons.length > 0, '未判定必须写明原因,不得静默缺字段')
    assert.ok(Array.isArray(payload.cmdRules) && payload.cmdRules.length === 4, '规则①的模式串必须来自那一份常量')
    assert.equal(payload.selfCheck.verdict, 'partial', '量到了清单但有缺口 ⇒ partial,既不冒 ok 也不冒 undetermined')
    assert.ok(payload.selfCheck.reasons.length > 0, 'partial 必须写明缺在哪')
    assert.match(payload.selfCheck.reasons.join('\n'), /命令行取不到/, '"命令行取不到(权限)"必须是单独一维')
    assert.equal(payload.candidates.length, 1)
    assert.deepEqual(payload.candidates[0].matchedRules, ['cmdline:live-gitdir-name', 'cmdline:git-repo-token', 'cmdline:core-bare-arg'])
  } finally {
    rmScratch(dir)
  }
})

/**
 * ⑬ 真机实际输出的时刻形态是 **CIM 串**(`yyyyMMddHHmmss.ffffff±zzz`),不是 ISO。
 * 第一版在 PowerShell 侧用 `[System.Management.ManagementDateTimeConverter]` 转换,本机实测
 * 336 个进程里只有 1 个转成功(PowerShell 7 不加载该类型)⇒ 规则②整维空转而账面看不出来。
 * 这一例把两种失败方向各自钉住:解得出的必须能命中;解不出的必须落"未判定"而**不得**被读成
 * "不在时间窗内"(那会把尺子失效写成仓库没有问题)。
 */
test('⑬ CIM 时刻串必须被解析成 UTC;解不出的时刻落未判定,不得被当成"不在窗口内"', () => {
  const anchor = Date.UTC(2026, 8, 29, 11, 6, 55, 260)
  const stdout = [
    'git.exe|111|222|20260929190655.123456+480|--git-dir D:/IHUI-AI-git-repo config --get core.bare',
    'x.exe|333|444|20260929190655.123456|没有偏移的一条',
  ].join('\n')
  const { processes } = G.parseProcessSnapshot(stdout)
  assert.equal(processes.length, 2)
  assert.equal(processes[0].CreationDate, '2026-09-29T11:06:55.123Z', '+480 分钟偏移必须按 +08:00 折算')
  assert.ok(processes[1].CreationDate === '20260929190655.123456', '解析不出时原文留着,不得静默变 null')
  const cands = G.selectBareFlipCandidates(processes, { anchorMs: anchor })
  assert.deepEqual(
    cands.map((c) => c.matchedRules).flat().filter((r) => r.startsWith('time-window')),
    ['time-window:within-600000ms-of-config-mtime'],
    '第一条必须因时间窗命中,第二条不得(它的时间根本没判定,不是"差得远")',
  )
  const sc = G.bareAuditSelfCheck({
    spawn: { state: 'ok', reason: null, stdout },
    processes,
    malformedCount: 0,
    cmdlineMissing: 0,
    timeMissing: processes.filter((p) => !Number.isFinite(p.__createdMs)).length,
    anchorMs: anchor,
  })
  assert.equal(sc.verdict, 'partial')
  assert.match(sc.reasons.join('\n'), /CreationDate 量不到/)
  assert.equal(sc.counts.timeMissing, 1)
})

/**
 * ⑭ 形状锁:派生 PowerShell 的三条本仓硬约束(绝对路径 / windowsHide / 数值 timeout)。
 * 摘掉 `windowsHide: true` ⇒ 本例必读红(已由真机变异自证)。
 */
test('⑭ PowerShell 派生必须带 windowsHide + 数值 timeout + -NoProfile,且用绝对路径、不开 shell', () => {
  const body = GUARDIAN_BODY('snapshotProcesses')
  const resolver = GUARDIAN_BODY('resolvePowerShellBin')
  assert.match(body, /windowsHide:\s*true/, '缺 windowsHide = 用户桌面弹窗事故(守门 52 判这一型)')
  assert.match(body, /timeout:\s*\d[\d_]*,/, '无界外部调用是守门 80 判的那一型,必须带数值 timeout')
  assert.match(body, /'-NoProfile'/, '取数一律带 -NoProfile(profile 会改输出面)')
  assert.doesNotMatch(body, /shell:\s*true/, '禁止 shell:true(§26:派生链会弹窗且命令串要过码页)')
  assert.doesNotMatch(body, /execFileSync\(\s*['"]powershell\.exe['"]/, '不得把裸名 powershell.exe 当可执行文件(本机裸名不在 PATH)')
  assert.match(resolver, /System32/, '绝对路径候选必须落在 Windows 目录')
  // 命令串不得内嵌非 ASCII(§26 码页)
  const ps = SRC.match(/const PS_PROCESS_SNAPSHOT = \[[\s\S]*?\]\.join\('\\n'\)/)
  assert.ok(ps, 'PS 脚本常量必须在位')
  assert.doesNotMatch(ps[0], /[^\x00-\x7F]/, 'PowerShell 命令串里不得有中文(ANSI 代码页会把它切成伪引号)')
  // 模式串单份:命中判定与文案都从 BARE_AUDIT_CMD_RULES 推导,不得有第二份
  assert.equal((SRC.match(/re: \/IHUI-AI-git-repo\/i/g) || []).length, 1, '规则①的模式串必须是唯一一份')
})

/** ⑮ 问责入口与 --status 字段真被接上(否则"报告有"只是函数存在) */
test('⑮ --bare-audit-report 与 status().bareAudit 必须真在链上,零记录文案不得伪装成零事故', () => {
  assert.match(SRC, /process\.argv\.includes\('--bare-audit-report'\)/, 'CLI 必须认这个旗标')
  assert.match(GUARDIAN_BODY('main'), /bareAuditReportMain\(/, 'main() 必须真调报告出口')
  assert.match(GUARDIAN_BODY('status'), /bareAudit:\s*latestBareFlipAuditFile\(\)\.file/, '--status 必须带 bareAudit 字段')
  const text = G.formatBareFlipAuditReport([], { dir: 'X:/' })
  assert.match(text, /尚无记录\(不等于没翻过/, '零记录必须自带"这不等于零事故"那句')
  assert.match(text, new RegExp(G.BARE_AUDIT_SINCE), '且要点名这一维是从哪天起才在位的')
  const withOne = G.formatBareFlipAuditReport(
    [{ detectedAt: 'D', sides: { liveGitdir: { bare: 'true' }, backup: { bare: null } }, selfCheck: { verdict: 'ok', reasons: [] }, processSnapshot: { count: 3 }, candidates: [{ Name: 'git.exe', ProcessId: 1, ParentProcessId: 2, CreationDate: 'C', CommandLine: 'x', matchedRules: ['cmdline:core-bare-arg'] }] }],
    { dir: 'X:/' },
  )
  assert.doesNotMatch(withOne, /尚无记录/)
  assert.match(withOne, /git\.exe.*cmdline:core-bare-arg/)
  // 打印面脱敏:凭据值不得进报告(报告会被贴进日志/台账),而判据字样必须逐字留着
  const leaky = G.formatBareFlipAuditReport(
    [{ detectedAt: 'D', sides: { liveGitdir: { bare: 'true' } }, selfCheck: { verdict: 'ok', reasons: [] }, processSnapshot: { count: 1 }, candidates: [{ Name: 'git.exe', ProcessId: 1, ParentProcessId: 2, CreationDate: 'C', CommandLine: 'git.exe -c safe.directory=* config core.bare true --password=hunter2 --token=abc.def', matchedRules: ['cmdline:core-bare-arg'] }] }],
    { dir: 'X:/' },
  )
  assert.doesNotMatch(leaky, /hunter2|abc\.def/, '命令行里的凭据值不得原样进报告(§5d:凭据不入日志)')
  assert.match(leaky, /core\.bare true/, '脱敏不得顺手把判据字样也抹掉(那会让报告答不出问题)')
  assert.match(leaky, /--password=\*\*\*|--token=\*\*\*/, '值必须被替换而键名保留(读的人才知道哪一类被遮了)')
  // 打印上限:时间窗命中可以很多,但截断必须报名,且**规则①的精确嫌疑不得被挤掉**
  const many = Array.from({ length: 20 }, (_, i) => ({
    Name: `noise${i}.exe`,
    ProcessId: i,
    ParentProcessId: 1,
    CreationDate: 'C',
    CommandLine: `nothing-interesting ${i}`,
    matchedRules: ['time-window:within-600000ms-of-config-mtime'],
  })).concat([
    {
      Name: 'git.exe',
      ProcessId: 999,
      ParentProcessId: 1,
      CreationDate: 'C',
      CommandLine: 'git.exe --git-dir D:/IHUI-AI-git-repo config core.bare true',
      matchedRules: ['cmdline:live-gitdir-name'],
    },
  ])
  const capped = G.formatBareFlipAuditReport(
    [{ detectedAt: 'D2', sides: { liveGitdir: { bare: 'true' } }, selfCheck: { verdict: 'ok', reasons: [] }, processSnapshot: { count: 351 }, candidates: many }],
    { dir: 'X:/' },
  )
  const printedTimeOnly = (capped.match(/↳ noise\d+\.exe/g) || []).length
  assert.ok(printedTimeOnly > 0 && printedTimeOnly <= G.BARE_AUDIT_REPORT_TIME_ONLY_CAP, `时间窗条目打印数应 ≤ ${G.BARE_AUDIT_REPORT_TIME_ONLY_CAP},实到 ${printedTimeOnly}`)
  assert.match(capped, /另有 \d+ 条只被时间窗/, '截断必须报名,不得静默少打(静默截断与"没有嫌疑人"同形)')
  assert.match(capped, /↳ git\.exe/, '规则①的精确嫌疑必须无条件打印')
  assert.match(capped, /D:\/IHUI-AI-git-repo config core\.bare true/)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
