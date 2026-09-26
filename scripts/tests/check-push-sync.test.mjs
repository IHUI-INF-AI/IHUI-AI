// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-push-sync.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkScratch('ihui-pushsync-')
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' })
  return dir
}

// 辅助:创建临时 bare 仓库(作为 origin)
function createTempBareOrigin() {
  const dir = mkScratch('ihui-origin-')
  execSync('git init --bare -b main', { cwd: dir, stdio: 'pipe' })
  return dir
}

// 辅助:创建工作仓库 + bare origin,并 push 初始 commit(synced 状态)
function createSyncedRepoWithOrigin() {
  const work = createTempRepo()
  const origin = createTempBareOrigin()
  // Windows 路径转正斜杠(git remote add 兼容)
  const originUrl = origin.replace(/\\/g, '/')
  execSync(`git remote add origin "${originUrl}"`, { cwd: work, stdio: 'pipe' })
  execSync('git push -u origin main', { cwd: work, stdio: 'pipe' })
  return { work, origin }
}

// 辅助:运行 check-push-sync.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// 辅助:在工作仓库中创建一个新 commit(不 push)
function makeLocalCommit(dir, message) {
  writeFileSync(join(dir, `file-${Date.now()}.txt`), `content-${Date.now()}\n`)
  execSync('git add -A', { cwd: dir, stdio: 'pipe' })
  execSync(`git commit -m "${message}"`, { cwd: dir, stdio: 'pipe' })
}

// 辅助:去除 ANSI 颜色码(脚本输出含 \x1B[31m 等颜色码,需剥离后匹配)
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '')
}

// ─── 1. CLI --help ──────────────────────────────────────
test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempRepo()
  try {
    // 无 origin → exit 0 (跳过)
    const r = runScript(['--help'], { cwd: dir })
    assert.ok(r.status === 0, `--help 不应 crash,实际 exit ${r.status}`)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 2. CLI 无参数运行(无 origin → 跳过) ────────────────
test('CLI: 无参数运行(无 origin remote → exit 0 跳过)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 0, `无 origin 应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /未配置 origin|跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 3. HUSKY_SKIP_PUSH_SYNC=1 跳过 ─────────────────────
test('豁免: HUSKY_SKIP_PUSH_SYNC=1 → exit 0(跳过检查)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 即使本地 ahead,也跳过
    makeLocalCommit(work, 'unpushed commit')
    const r = runScript([], { cwd: work, env: { HUSKY_SKIP_PUSH_SYNC: '1' } })
    assert.equal(r.status, 0, `HUSKY_SKIP_PUSH_SYNC=1 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /HUSKY_SKIP_PUSH_SYNC|跳过/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 4. IHUI_ARCHIVE_COMMIT=1 归档 commit 豁免 ───────────
test('豁免: IHUI_ARCHIVE_COMMIT=1 → exit 0(归档 commit 跳过)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'archive commit')
    const r = runScript([], { cwd: work, env: { IHUI_ARCHIVE_COMMIT: '1' } })
    assert.equal(r.status, 0, `IHUI_ARCHIVE_COMMIT=1 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /IHUI_ARCHIVE_COMMIT|归档|跳过/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 5. 本地与 origin 同步 → exit 0 ─────────────────────
test('同步: 本地 HEAD == origin/main → exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `同步状态应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /已同步|HEAD/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 6. 本地 ahead 1 个 commit → exit 1 阻塞 ────────────
test('ahead: 本地 ahead 1 个 commit → exit 1(阻塞)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed commit 1')
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `ahead 1 应 exit 1,实际 ${r.status}`)
    // 错误消息走 console.error(stderr),含 ANSI 颜色码,需剥离后匹配
    assert.match(stripAnsi(r.stderr), /1 个未 push|Push 同步/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 7. 本地 ahead 3 个 commit → exit 1 阻塞 ────────────
test('ahead: 本地 ahead 3 个 commit → exit 1(显示 3)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed commit 1')
    makeLocalCommit(work, 'unpushed commit 2')
    makeLocalCommit(work, 'unpushed commit 3')
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `ahead 3 应 exit 1,实际 ${r.status}`)
    // 错误消息走 console.error(stderr),含 ANSI 颜色码,需剥离后匹配
    assert.match(stripAnsi(r.stderr), /3 个未 push/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 7b. push-state 四态:哪些"本地 ahead"该放行、哪些必须继续拦 ──────
// 2026-09-26 实测:当天两次提交(12:53 / 12:57)都是被这一格判红,红之后 safe-commit
// 走 --no-verify ⇒ 那 163 道门对那两枚提交根本没跑。所以"哪一态该红"必须能被机器问出来。
function writePushState(dir, state) {
  mkdirSync(join(dir, '.workbuddy'), { recursive: true })
  writeFileSync(join(dir, '.workbuddy', 'push-state.json'), JSON.stringify(state))
}

test('push-state: running 且新鲜且持有者存活 → exit 0(在途推送不算忘记 push)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed while worker running')
    writePushState(work, { status: 'running', headSha: 'deadbeef', ts: Date.now(), pid: process.pid })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `running 在途应放行,实际 ${r.status}:${stripAnsi(r.stdout)}`)
    assert.match(stripAnsi(r.stdout), /后台推送在途/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('push-state: done 且新鲜且 headSha 是 HEAD 祖先 → exit 0(上一轮已推成功,新提交会有新 worker)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed after a done push')
    const parent = execSync('git rev-parse HEAD~1', { cwd: work, encoding: 'utf8' }).trim()
    writePushState(work, { status: 'done', headSha: parent, ts: Date.now(), pid: process.pid })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `done+祖先应放行,实际 ${r.status}:${stripAnsi(r.stdout)}`)
    assert.match(stripAnsi(r.stdout), /上一轮推送已成功/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('push-state: done 但 headSha 不在 HEAD 祖先线上 → 仍 exit 1(不得把"别的分支的成功"当本分支的合格证)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed with unrelated done')
    writePushState(work, {
      status: 'done',
      headSha: '0000000000000000000000000000000000000000',
      ts: Date.now(),
      pid: process.pid,
    })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `祖先不成立必须仍红,实际 ${r.status}`)
    assert.match(stripAnsi(r.stdout), /不在本次 HEAD 的祖先线上/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('push-state: failed → 即使新鲜也必须 exit 1(真推不出去才是本门存在的理由)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed while push failed')
    writePushState(work, { status: 'failed', headSha: 'deadbeef', ts: Date.now(), pid: process.pid })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `failed 必须拦,实际 ${r.status}`)
    assert.match(stripAnsi(r.stderr), /未 push 的 commit/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('push-state: running 但持有者 pid 已死 → exit 1(2026-09-19 记录的"猝死残留"型)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed with dead worker')
    writePushState(work, {
      status: 'running',
      headSha: 'deadbeef',
      ts: Date.now(),
      pid: 2_000_000_000, // 不可能存活的 pid
    })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `残留 running 不算在途,实际 ${r.status}`)
    assert.match(stripAnsi(r.stdout), /猝死残留/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('push-state: diverged 新鲜 → exit 0 并点名收敛器(guard 自己不能收敛,一律拦=每次提交都跳门)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed while diverged')
    writePushState(work, {
      status: 'diverged',
      headSha: 'deadbeef',
      ts: Date.now(),
      pid: process.pid,
      nextCommand: 'node scripts/git-sync-converge.mjs',
    })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `新鲜 diverged 应放行,实际 ${r.status}:${stripAnsi(r.stdout)}${stripAnsi(r.stderr)}`)
    assert.match(stripAnsi(r.stdout), /git-sync-converge/, '放行也必须把唯一出路说出口,不能静默')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('push-state: diverged 已过期 → exit 1(没人管的分叉才是本门该拦的)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed while long-diverged')
    writePushState(work, {
      status: 'diverged',
      headSha: 'deadbeef',
      ts: Date.now() - 11 * 60 * 1000,
      pid: process.pid,
    })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `过期 diverged 必须拦,实际 ${r.status}:${stripAnsi(r.stdout)}`)
    assert.match(stripAnsi(r.stderr), /未 push 的 commit/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 8. 本地 behind origin → exit 0(跳过,不阻塞) ──────
test('behind: 本地 behind origin → exit 0(无 ahead commit,跳过)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 在 work 创建并 push 一个 commit(origin 前进)
    makeLocalCommit(work, 'second commit')
    execSync('git push origin main', { cwd: work, stdio: 'pipe' })
    // reset --hard HEAD~1 使本地落后 origin
    execSync('git reset --hard HEAD~1', { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    // HEAD 不同但无 ahead commit(behind)→ 跳过,exit 0
    assert.equal(r.status, 0, `behind 应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /behind|无 ahead|跳过/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 9. 无 origin remote → exit 0(跳过) ────────────────
test('无 origin: 仓库无 origin remote → exit 0(跳过)', () => {
  const dir = createTempRepo()
  try {
    // 有 git 仓库但无 origin remote
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 0, `无 origin 应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /未配置 origin|跳过/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 10. detached HEAD → exit 0(跳过) ─────────────────
test('detached HEAD: git checkout <hash> → exit 0(跳过)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 切到 detached HEAD
    const headHash = execSync('git rev-parse HEAD', { cwd: work, encoding: 'utf8' }).trim()
    execSync(`git checkout ${headHash}`, { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `detached HEAD 应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /detached HEAD|跳过/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 11. 本地无 tracking ref 时的两条通道 ──────────────────
// 本组用例钉的是 2026-09-12 那次有意改动:远端 tip **以 ls-remote(网络真值)为准**,
// 本地 `refs/remotes/origin/*` 被宿主清理层删掉时不再误判成"未 push"(§5b 同族病理)。
// 旧断言"无 origin/main ref ⇒ 跳过"恰好被这个改进作废 —— 本地没 ref 也能问出真值。
test('本地无 tracking ref 但 origin 可达 → 按 ls-remote 真值判定(不谎报跳过)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git remote remove origin', { cwd: work, stdio: 'pipe' })
    execSync(`git remote add origin "${origin.replace(/\\/g, '/')}"`, { cwd: work, stdio: 'pipe' })
    // 前提自证:本地确实没有 tracking ref(否则本用例什么都没测)
    assert.equal(execSync('git for-each-ref refs/remotes', { cwd: work, encoding: 'utf8' }).trim(), '')
    assert.throws(() =>
      execSync('git rev-parse origin/main', { cwd: work, stdio: 'pipe' }),
    )
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `同步态应 exit 0,实际 ${r.status}\n${r.stdout}`)
    assert.match(r.stdout, /已同步|ls-remote/, `应经 ls-remote 取到真值,实际:${r.stdout}`)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('两条通道都取不到(origin 不可达 + 无本地 ref)→ exit 0 并如实说"无法确定"', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git remote remove origin', { cwd: work, stdio: 'pipe' })
    // 指向一个不存在的目录 ⇒ ls-remote 失败;同时没有 tracking ref ⇒ 回退也失败
    const dead = join(origin, '..', 'definitely-not-a-remote-' + process.pid)
    execSync(`git remote add origin "${dead.replace(/\\/g, '/')}"`, { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `取不到远端 HEAD 应跳过而非阻塞,实际 ${r.status}\n${r.stdout}`)
    assert.match(r.stdout, /无法确定|未 fetch|跳过/, `应说明跳过原因,实际:${r.stdout}`)
    assert.doesNotMatch(
      r.stdout,
      /已同步/,
      '绝不允许在什么都没比对到时打印"已同步"(那是假保证)',
    )
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 12. 非 git 环境 → exit 0(跳过) ─────────────────────
test('非 git: 非 git 仓库目录 → exit 0(跳过)', () => {
  // 创建一个临时目录,不 init git
  const dir = mkScratch('ihui-nongit-')
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 0, `非 git 仓库应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /非 git|跳过/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
