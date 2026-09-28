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
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
    assert.equal(G.healWorktreeBare({ gitdir: f.gitdir, backup: f.backup, probeUsable: usable }), true)
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
    const ok = G.healWorktreeBare({
      gitdir: f.gitdir,
      backup: f.backup,
      probeUsable: () => {
        probed += 1
        return true
      },
    })
    assert.equal(ok, true)
    assert.equal(probed, 1, '无裸档时只允许探一次(探多次说明走了修复支)')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
