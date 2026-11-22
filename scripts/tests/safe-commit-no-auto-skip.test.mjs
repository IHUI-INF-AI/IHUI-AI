// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-11-03 机主明令:「不许 --no-verify」。本文件钉住 safe-commit 的**默认永不跳钩**。
 *
 * 旧行为(已废止):钩子判红 → 归因层判 not-ours / env-blocked / unattributed → 自跑
 * `guardian-runner --staged` → 仍红就 `git commit --no-verify` 落地。它把"钩子里的门"与
 * "自跑的门"混为一谈(lint-staged 与批外专项门根本不在自跑集合里),且正文里只剩 attestation,
 * 审计上分不清"真过钩"与"跳钩"。
 *
 * 四条用例对应用户要求(NS4m 是给 NS4 配的变异对照,不另立需求):
 *   NS1 锁冲突耗尽 ⇒ exit≠0、不落地、不跳钩(旧形态很难覆盖:旧代码在锁分支已拒绝,但
 *       "钩子窗口里的锁污染被当成钩子判红"那条路径才是事故口 —— NS3 从归因侧钉住)。
 *   NS2 锁在重试窗口内释放 ⇒ 3 次指数退避内成功,提交正常落地。
 *   NS3 钩子判红且归因非 mine ⇒ 默认拒绝;显式 `--allow-skip-hooks=<原因>` 才跳,且正文有标记。
 *   NS4 正常过钩路径:整段 stdout 与 HEAD 版逐字等值(剥临时路径/unit/sha),Step 1 恒为路径作用域,
 *       而"这一步真的变了"对照钉在**历史前像**上(2026-11-05 收口:旧形态钉 HEAD 这枚移动靶,
 *       P0 落地进 HEAD 后"基线版仍是全局清空"永不可能再成立 ⇒ 锚点腐烂,行为一条没变)。
 *
 * 全程只在 mkScratch 的临时仓里跑,不动真仓、不动共享索引、不 push。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS = join(HERE, '..')
const REPO_ROOT = join(SCRIPTS, '..')

const plain = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '')
const outputOf = (r) => plain(`${r.stdout || ''}${r.stderr || ''}`)

const gitR = (dir, ...args) =>
  spawnSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const git = (dir, ...args) => {
  const r = gitR(dir, ...args)
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:\n${r.stdout}\n${r.stderr}`)
  return (r.stdout || '').trim()
}

const countCommits = (dir) => Number(git(dir, 'rev-list', '--count', 'HEAD'))

/** Windows 上 detached heartbeat 还握着临时仓句柄 ⇒ 首删常 EPERM,重试几轮即可。 */
async function dropRepo(dir) {
  for (let i = 0; i < 10; i++) {
    try {
      rmScratch(dir)
      return
    } catch {
      await new Promise((r) => setTimeout(r, 700))
    }
  }
  rmScratch(dir, { bestEffort: true })
}

function makeRepo(t) {
  const dir = mkScratch('safe-commit-noskip-')
  t.after(() => dropRepo(dir))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  git(dir, 'init', '-q', '.')
  git(dir, 'config', 'user.name', 'fixture')
  git(dir, 'config', 'user.email', 'fixture@example.invalid')
  git(dir, 'config', 'commit.gpgsign', 'false')
  git(dir, 'config', 'core.hooksPath', join(dir, '.git', 'hooks'))
  // 被 import 的闭包由 copyScriptWithClosure 自动拷;被按路径 spawn 的必须点名补拷。
  copyScriptWithClosure(SCRIPTS, 'safe-commit.mjs', join(dir, 'scripts'), [
    'live-doc-edit.mjs',
    'lib/face-reader.mjs',
    'lib/stale-content-analysis.mjs',
    'lib/scratch-dir.mjs',
  ])
  copyScriptWithClosure(SCRIPTS, 'git-lock.mjs', join(dir, 'scripts'))
  copyScriptWithClosure(SCRIPTS, 'merge-live-doc.mjs', join(dir, 'scripts'))
  // 先落一枚基线提交:Step 1 的 `git reset HEAD` 需要 HEAD 存在。
  writeFileSync(join(dir, 'base.txt'), 'base\n')
  git(dir, 'add', '--', 'base.txt')
  git(dir, 'commit', '-q', '-m', 'chore: fixture base')
  return dir
}

function runSafe(dir, { files, extraArgs = [], message = 'docs: fixture', env = {} }) {
  return spawnSync(
    process.execPath,
    [join(dir, 'scripts', 'safe-commit.mjs'), ...extraArgs, '-m', message, '--', ...files],
    {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 240_000,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      // 与 safe-commit.test.mjs 同一份隔离清单:真仓会话里挂着的锁/范围变量不得漏进夹具。
      env: {
        ...process.env,
        IHUI_GIT_LOCK_UNIT: '',
        AGENT_SCOPE: '',
        AGENT_NAME: '',
        AGENT_SCOPE_OVERRIDE: '',
        LIVE_SHA_ALLOW: '',
        IHUI_SKIP_LIVE_DOC_CHECK: '',
        IHUI_SAFE_COMMIT_SHA_INTAKE_CAP: '',
        ...env,
      },
    },
  )
}

/** Step 1 的两把尺(NS4 用、NS4m 反用,一份字面量两处共用,禁止各写各的)。 */
const STEP1_SCOPED = /git reset HEAD -- <\d+ 条声明路径>/
const STEP1_GLOBAL = /清空暂存区/

/** 正常路径对照时剥掉每枚仓必不相同的临时路径 / 锁 unit / 提交 sha。 */
const scrub = (text, dir) =>
  plain(text)
    .replaceAll(dir, '<REPO>')
    .replaceAll(dir.replaceAll('\\', '/'), '<REPO>')
    .replace(/safe-commit-\d+-\d+/g, 'unit=<UNIT>')
    .replace(/\b[0-9a-f]{7,40}\b/g, '<SHA>')

/**
 * 「Step 1 无 pathspec 的全局 reset → 路径作用域 reset」那次改动的**两侧面**(历史冻结件),
 * 供 NS4 的对照锚点用。
 *
 * 旧 NS4 拿 **HEAD** 当"基线版"跑一遍,再断言基线版仍打「清空暂存区」以"证明钉的是真差异"。
 * 2026-11-04 那一枚 P0 落地进 HEAD 之后(现读 `git show HEAD:scripts/safe-commit.mjs` 的 Step 1
 * 已是路径作用域形态),这条对照从此**永远不可能再成立** —— 它钉的是会移动的靶,不是行为;
 * 与 commit-payload-attribution.test.mjs 的 B8 同型(锚点腐烂),不是别席在飞造成的假阳:
 * 该断言读的是 HEAD blob,与工作树脏净无关。
 *
 * 正解 = 把"真差异"这一维改钉在**不可变的历史两侧面**上:沿 `-S` 找那一枚把全局 reset 摘掉的提交
 * (方向逐枚现验:父面有、本枚 0),返回两侧整 blob。发现键刻意用**发令形态** `['reset', 'HEAD']`
 * 而不是日志字样 —— 现读 HEAD:16 的文档 prose 里「清空暂存区」仍然存活(那一枚落地时没同步头注),
 * 拿散文当锚点会把转换枚判成"没转换"(§0.3:判不出就报未判定,不许猜)。取不到 ⇒ 当场判「未判定」。
 */
const GLOBAL_RESET_ARGV = "['reset', 'HEAD']"

function findGlobalResetTransition(file) {
  const r = gitR(REPO_ROOT, 'log', '-S', GLOBAL_RESET_ARGV, '--format=%H', '--', file)
  assert.equal(r.status, 0, `未判定:\`git log -S ${GLOBAL_RESET_ARGV}\` 取失败:\n${r.stderr}`)
  const cands = String(r.stdout || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  assert.ok(
    cands.length > 0,
    `未判定:\`-S ${GLOBAL_RESET_ARGV}\` 在 ${file} 上枚举到 0 枚 —— 对照锚点已不存在,` +
      '不许读成"没有差异、也就不需要对照"',
  )
  for (const sha of cands) {
    const now = gitR(REPO_ROOT, 'show', `${sha}:${file}`)
    const before = gitR(REPO_ROOT, 'show', `${sha}^:${file}`)
    if (now.status !== 0 || before.status !== 0) continue
    if (!now.stdout.includes(GLOBAL_RESET_ARGV) && before.stdout.includes(GLOBAL_RESET_ARGV))
      return { removeSha: sha, beforeSrc: before.stdout, afterSrc: now.stdout }
  }
  assert.fail(
    `未判定:${cands.length} 枚候选里没有一枚满足"父面有 ${GLOBAL_RESET_ARGV}、本枚摘净"的转换方向` +
      ` —— 对照基线取不到,不猜(候选:${cands.slice(0, 3).join(', ')}…)`,
  )
}

test('NS1 索引锁争用耗尽 ⇒ exit≠0、不落地、且绝不自动跳钩', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'a.txt'), 'a\n')
  const lock = join(dir, '.git', 'index.lock')
  writeFileSync(lock, 'fixture lock (not held)\n')
  // 预算按**满载机**定,不按空闲机:原 300ms/80ms 是空闲读数,三席并跑 + 多会话时
  // node 冷启与前置 git 调用本身就能吃掉 300ms ⇒ 会走成"预算先到"的另一条分支,
  // 断言的那句话就不出现了(2026-11-05 席报偶发红的真根因,不是行为变了)。
  // 耗尽结局由"锁一直在"决定,与预算无关 ⇒ 抬预算只去掉计时耦合,不放松任何断言。
  const r = runSafe(dir, {
    files: ['a.txt'],
    message: 'docs: ns1',
    env: {
      IHUI_SAFE_COMMIT_LOCK_RETRIES: '1',
      IHUI_SAFE_COMMIT_LOCK_BACKOFF_MS: '400',
      IHUI_SAFE_COMMIT_LOCK_BUDGET_MS: '30000',
    },
  })
  const out = outputOf(r)
  assert.notEqual(r.status, 0, out)
  assert.match(out, /请等待并发会话释放索引/)
  // 旧兜底的两条指纹都不许出现:自动跳钩的跑马灯、显式授权的正文说明。
  assert.doesNotMatch(out, /已按\*\*人工显式授权\*\*用 --no-verify 落地/)
  assert.doesNotMatch(out, /人工授权跳钩/)
  assert.equal(countCommits(dir), 1, '锁冲突时不得产生任何提交')

  // 正向对照(反向牙):把同一枚锁摘掉 ⇒ 同一个夹具必须**成功提交**。
  // 没有这一条,"拒绝落地"可能只是因为夹具本身坏了 —— 那是假绿的一种。
  unlinkSync(lock)
  const clean = runSafe(dir, { files: ['a.txt'], message: 'docs: ns1-control' })
  const cleanOut = outputOf(clean)
  assert.equal(clean.status, 0, `摘锁后对照必须落地,否则夹具不可信:${cleanOut}`)
  assert.equal(countCommits(dir), 2, '对照枚应产生第二枚提交')
})

test('NS2 锁在重试窗口内释放 ⇒ 指数退避重试成功并正常提交', async (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'b.txt'), 'b\n')
  const lock = join(dir, '.git', 'index.lock')
  writeFileSync(lock, 'fixture lock (not held)\n')

  // 事件驱动而不是定时删锁:定时删锁会与 Step 0/1 的启动耗时赛跑(实测 350ms 那次
  // safe-commit 还没走到 Step 1,锁已经没了 ⇒ 变成"没重试过"的假绿)。
  // 这里等**重试告警真的打出来**再放锁 —— 那一刻"第一次尝试已确凿撞锁"是既成事实。
  const r = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [join(dir, 'scripts', 'safe-commit.mjs'), '-m', 'docs: ns2', '--', 'b.txt'],
      {
        cwd: dir,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          IHUI_GIT_LOCK_UNIT: '',
          AGENT_SCOPE: '',
          AGENT_NAME: '',
          AGENT_SCOPE_OVERRIDE: '',
          IHUI_SAFE_COMMIT_LOCK_RETRIES: '3',
          IHUI_SAFE_COMMIT_LOCK_BACKOFF_MS: '400',
          // 同 NS1:预算要盖得住满载下的冷启与前置 git 调用,否则"锁还没等到就预算耗尽"
          // 会被读成行为失败。放锁由**看到重试告警那一刻**触发(事件驱动),与预算无关。
          IHUI_SAFE_COMMIT_LOCK_BUDGET_MS: '60000',
        },
      },
    )
    let out = ''
    let released = false
    const onChunk = (buf) => {
      out += String(buf)
      if (!released && out.includes('撞 git 索引锁')) {
        released = true
        try {
          unlinkSync(lock)
        } catch {}
      }
    }
    child.stdout.on('data', onChunk)
    child.stderr.on('data', onChunk)
    child.on('error', reject)
    child.on('close', (status) => resolve({ status, out }))
  })
  // 反向牙:先确认**重试路径真的走到了**。没走到就是夹具/负载问题(未判定),
  // 不许让"根本没撞锁"被读成"重试成功"的假绿,也不许把它当成被测行为的失败。
  assert.match(
    plain(r.out),
    /撞 git 索引锁/,
    `未判定:重试告警一次都没出现 ⇒ 锁没被撞到,本用例没量到任何东西。输出:${plain(r.out)}`,
  )
  assert.equal(r.status, 0, plain(r.out))
  assert.match(plain(r.out), /次重试/, plain(r.out))
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'docs: ns2')
  assert.match(git(dir, 'show', '--name-only', '--format='), /b\.txt/)
})

test('NS3 钩子判红且归因非 mine ⇒ 默认拒绝;显式 --allow-skip-hooks 才跳且正文有标记', (t) => {
  const dir = makeRepo(t)
  const hook = join(dir, '.git', 'hooks', 'pre-commit')
  writeFileSync(hook, '#!/bin/sh\nexit 1\n')
  chmodSync(hook, 0o755)
  writeFileSync(join(dir, 'c.txt'), 'c\n')

  const refused = runSafe(dir, { files: ['c.txt'], message: 'docs: ns3' })
  const out1 = outputOf(refused)
  assert.notEqual(refused.status, 0, out1)
  assert.match(out1, /默认永不跳钩/)
  assert.match(out1, /请等待并发会话释放索引/)
  assert.equal(countCommits(dir), 1, '默认拒绝时不得落地')

  const allowed = runSafe(dir, {
    files: ['c.txt'],
    extraArgs: ['--allow-skip-hooks=fixture: 验证显式授权'],
    message: 'docs: ns3',
  })
  const out2 = outputOf(allowed)
  assert.equal(allowed.status, 0, out2)
  const body = git(dir, 'log', '-1', '--format=%B')
  assert.match(body, /人工授权跳钩/)
  assert.match(body, /验证显式授权/)
  assert.equal(git(dir, 'log', '-1', '--format=%s'), 'docs: ns3')
})

test('NS4 正常过钩路径:整段 stdout 与 HEAD 版逐字等值 + Step 1 恒路径作用域 + 对照钉历史前像', (t) => {
  const head = gitR(REPO_ROOT, 'show', 'HEAD:scripts/safe-commit.mjs')
  assert.equal(head.status, 0, `取 HEAD 版 safe-commit 失败:\n${head.stderr}`)
  // ③ 对照基线 = 摘掉全局 reset 那一枚的**父面与本面**(历史冻结件,不随 HEAD 移动)。
  const tx = findGlobalResetTransition('scripts/safe-commit.mjs')

  const newDir = makeRepo(t)
  const headDir = makeRepo(t)
  writeFileSync(join(headDir, 'scripts', 'safe-commit.mjs'), head.stdout)
  writeFileSync(join(newDir, 'd.txt'), 'd\n')
  writeFileSync(join(headDir, 'd.txt'), 'd\n')

  const fresh = runSafe(newDir, { files: ['d.txt'], message: 'docs: ns4' })
  const landed = runSafe(headDir, { files: ['d.txt'], message: 'docs: ns4' })
  assert.equal(fresh.status, 0, outputOf(fresh))
  assert.equal(landed.status, 0, outputOf(landed))

  const freshOut = scrub(outputOf(fresh), newDir)
  const landedOut = scrub(outputOf(landed), headDir)
  const step1Of = (t) => t.split('\n').filter((l) => /Step 1\/5:/.test(l))
  assert.equal(step1Of(freshOut).length, 1, '正常路径必须只有一行 Step 1 日志')
  assert.match(
    step1Of(freshOut)[0],
    STEP1_SCOPED,
    'Step 1 必须是路径作用域形态(无 pathspec 的全局清空不得回来)',
  )
  assert.doesNotMatch(
    step1Of(freshOut)[0],
    STEP1_GLOBAL,
    'Step 1 不得再报「清空暂存区」—— 全局清空形态已废止',
  )

  // ① 漂移尺:旧口径是"除 Step 1 那一行外逐字等值",那行豁免是给**在飞的那枚 P0** 的;
  //    P0 已落地进 HEAD ⇒ 豁免随之关闭,现在整段 stdout 都必须与 HEAD 版逐字等值
  //    (在飞改动若动了正常路径的可观察输出 ⇒ 本条红,要放宽只能由改动者显式复核后落账)。
  assert.equal(
    freshOut,
    landedOut,
    '工作树版与 HEAD 版在正常路径上不得有任何可观察差异(含 Step 1 —— 该行差异已随 P0 落地)',
  )

  // ③ "钉的是真差异"这一维从此由历史两侧面负责:前像发无 pathspec 的全局 reset,本枚起发声明集作用域。
  assert.match(
    tx.beforeSrc,
    /Step 1\/5: git reset HEAD — 清空暂存区/,
    `前像(${tx.removeSha}^)的 Step 1 必须仍是全局清空 —— 否则这条对照就没钉住行为差异`,
  )
  assert.ok(
    tx.beforeSrc.includes(GLOBAL_RESET_ARGV) && !tx.afterSrc.includes(GLOBAL_RESET_ARGV),
    `转换枚 ${tx.removeSha} 的两侧必须分别是"发全局 reset"/"全局 reset 摘净" —— 现验两向,不靠 -S 的单向计数`,
  )
  assert.match(
    tx.afterSrc,
    /resetScoped\(expectedFiles/,
    `转换枚 ${tx.removeSha} 起 Step 1 必须走带声明集的唯一出口 resetScoped()`,
  )
  const freshSrc = readFileSync(join(SCRIPTS, 'safe-commit.mjs'), 'utf8')
  assert.doesNotMatch(
    freshSrc,
    /\[\s*'reset',\s*'HEAD'\s*\]/,
    '无 pathspec 的全局 reset 不得回到工作树版(它会吞他人工作面)',
  )
  assert.match(
    freshSrc,
    /resetScoped\(expectedFiles/,
    'Step 1 必须走带声明集的唯一出口 resetScoped()',
  )

  assert.equal(git(newDir, 'log', '-1', '--format=%B'), git(headDir, 'log', '-1', '--format=%B'))
  assert.equal(git(newDir, 'log', '-1', '--format=%s'), 'docs: ns4')
})

/**
 * NS4 那两把尺的**变异对照**:把转换枚的父面(真发过无 pathspec 全局 reset 的那一版)灌进同一个
 * 夹具仓跑一遍,再拿 NS4 用的同一对正则去判它 —— 必须**两把都判不合格**。
 * 立因:旧 NS4 的"基线版仍是全局清空"随 P0 落地进了历史,从此无人再拿真·旧形态过一遍尺;
 * 只把对照改成读历史 blob 的文本,仍然证明不了"这两把尺咬得住回潮"。这一枚把它补成**可执行**的。
 * 前像在今天跑不动 ⇒ 当场判「未判定」并点名转换枚,不许静默放行(§0.3)。
 */
test('NS4m 变异对照:全局清空那一版必须被 NS4 的两把尺双双判死(尺子不是装饰)', (t) => {
  const tx = findGlobalResetTransition('scripts/safe-commit.mjs')
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'scripts', 'safe-commit.mjs'), tx.beforeSrc)
  writeFileSync(join(dir, 'd.txt'), 'd\n')
  const r = runSafe(dir, { files: ['d.txt'], message: 'docs: ns4m' })
  const out = scrub(outputOf(r), dir)
  assert.equal(
    r.status,
    0,
    `未判定:前像(转换枚 ${tx.removeSha} 的父面)在今天的闭包里跑不动了 —— 对照尺需重新钉:\n${out}`,
  )
  const step1 = out.split('\n').filter((l) => /Step 1\/5:/.test(l))
  assert.equal(
    step1.length,
    1,
    `前像的正常路径也应只有一行 Step 1 日志(现读 ${step1.length} 行):\n${out}`,
  )
  assert.ok(
    !STEP1_SCOPED.test(step1[0]),
    `尺一失效:路径作用域断言竟把全局清空那版也判合格 ⇒ NS4 的第一把尺是装饰:${step1[0]}`,
  )
  assert.ok(
    STEP1_GLOBAL.test(step1[0]),
    `尺二失效:「不得再报清空暂存区」对旧形态不成立 ⇒ NS4 的第二把尺是装饰:${step1[0]}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
