// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { hostname, userInfo } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// §22c 镜像测试纪律:判定口径直接用**生产实现**,测试里不复制第二份判据。
// (脚本有 §22d 的 isDirectRun 守卫,被 import 时不会触发主流程。)
import { __test__ as TagSync } from '../sync-lost-commit-tags.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'sync-lost-commit-tags.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkScratch('ihui-tag-sync-')
  execSync('git init -b main', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  execSync('git config user.email test@test.com', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  execSync('git config user.name test', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  execSync('git config commit.gpgsign false', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  execSync('git commit -m "init"', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  return dir
}

// 辅助:创建临时 bare 仓库(作为 origin)
function createTempBareOrigin() {
  const dir = mkScratch('ihui-tag-origin-')
  execSync('git init --bare -b main', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  return dir
}

// 辅助:创建工作仓库 + bare origin,并 push 初始 commit(synced 状态)
function createSyncedRepoWithOrigin() {
  const work = createTempRepo()
  const origin = createTempBareOrigin()
  // Windows 路径转正斜杠(git remote add 兼容)
  const originUrl = origin.replace(/\\/g, '/')
  execSync(`git remote add origin "${originUrl}"`, { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  execSync('git push -u origin main', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  return { work, origin }
}

// 辅助:运行 sync-lost-commit-tags.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    // 2026-11-05 增长产线默认停用:既有正向用例逐条显式打开;反向用例单独传 '' 覆盖。
    env: { IHUI_TAG_AUTOPUSH_ENABLED: '1', ...process.env, ...opts.env },
  })
}

// 辅助:查询远端是否有指定 tag(通过 ls-remote)
function remoteHasTag(workDir, tagName) {
  const out = execSync(`git ls-remote origin "refs/tags/${tagName}"`, {
    cwd: workDir,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  return out.length > 0
}

// 参数数组派生,不经 shell。危险 ref 名的夹具必须走这里,禁止拼进命令字符串。
function gitArgv(cwd, args) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function pinLocalOrigin(work, origin) {
  const r = gitArgv(work, ['remote', 'get-url', 'origin'])
  assert.equal(r.status, 0, r.stderr)
  const got = r.stdout.trim().replace(/\\/g, '/')
  const want = origin.replace(/\\/g, '/')
  assert.equal(got, want, `测试远端必须是本地 bare,不得打到真 origin: ${got}`)
  const hooked = gitArgv(work, ['config', 'core.hooksPath', '.git/hooks'])
  assert.equal(hooked.status, 0, hooked.stderr)
}

function remoteTagSha(workDir, tagName) {
  const r = gitArgv(workDir, ['ls-remote', 'origin', `refs/tags/${tagName}`])
  const prefix = `refs/tags/${tagName}`
  const line = r.stdout
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.split('\t')[1] === prefix)
  return line ? line.split('\t')[0] : ''
}

// 辅助:查询本地是否有指定 tag
function localHasTag(workDir, pattern) {
  const out = execSync(`git tag -l "${pattern}"`, {
    cwd: workDir,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
  return out.length > 0
}

// ─── CLI 行为测试 ────────────────────────────────────────

test('CLI: --help → exit 0 + 打印帮助文本', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--help'], { cwd: dir })
    assert.equal(r.status, 0, `--help 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /sync-lost-commit-tags/, 'stdout 应含脚本名')
    assert.match(r.stdout, /--check/, 'stdout 应含 --check 说明')
    assert.match(r.stdout, /--fetch/, 'stdout 应含 --fetch 说明')
    assert.match(r.stdout, /--auto-push/, 'stdout 应含 --auto-push 说明')
  } finally {
    rmScratch(dir)
  }
})

test('CLI: 无参数(默认 check)在干净无 tag 仓库 → exit 0', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 0, `干净仓库应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: --check 在干净仓库 → exit 0', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--check'], { cwd: dir })
    assert.equal(r.status, 0, `--check 干净仓库应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /一致性校验|tag/, 'stdout 应含校验相关文本')
  } finally {
    rmScratch(dir)
  }
})

test('CLI: --check --json 在干净仓库 → exit 0 + JSON status=ok', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--check', '--json'], { cwd: dir })
    assert.equal(r.status, 0, `--check --json 应 exit 0,实际 ${r.status}`)
    const result = JSON.parse(r.stdout.trim())
    assert.equal(result.status, 'ok')
    assert.ok(Array.isArray(result.local.lostCommit), 'local.lostCommit 应为数组')
    assert.ok(Array.isArray(result.local.backup), 'local.backup 应为数组')
    assert.equal(result.summary.total, 0, '干净仓库 summary.total 应为 0')
  } finally {
    rmScratch(dir)
  }
})

test('反例:无 origin 但本地**有** lost-commit tag ⇒ 不得走"跳过"分支(那正是备份线缺失的故障)', () => {
  const dir = createTempRepo() // 该夹具不配 origin
  try {
    execSync('git tag lost-commit/orphan HEAD', { cwd: dir, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(['--check'], { cwd: dir })
    assert.notEqual(
      r.status,
      0,
      '本地有 tag 却没 origin,绝不能被"无 origin ⇒ 跳过"洗成绿(必须仍 fail-loud)',
    )
    assert.doesNotMatch(r.stdout, /无可比对象/, '有可比对象时不得打印跳过结论')
  } finally {
    rmScratch(dir)
  }
})

test('CLI: --check --json 有仅本地 lost-commit tag → exit 1 + JSON status=fail', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/test-local HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(['--check', '--json'], { cwd: work })
    assert.equal(r.status, 1, `仅本地 tag 应 exit 1,实际 ${r.status}`)
    const result = JSON.parse(r.stdout.trim())
    assert.equal(result.status, 'fail')
    assert.ok(result.local.lostCommit.includes('lost-commit/test-local'), 'JSON 应含本地 tag')
    assert.ok(result.diff.lostCommit.onlyLocal.includes('lost-commit/test-local'), 'diff.onlyLocal 应含 tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── --auto-push 模式测试 ────────────────────────────────

test('CLI: --auto-push 无 tag → 跳过 push exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const r = runScript(['--auto-push'], { cwd: work })
    assert.equal(r.status, 0, `无 tag --auto-push 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /跳过 push|无.*tag/, '应显示跳过信息')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('CLI: --auto-push --dry-run 有 tag → dry-run,远端无 tag', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 创建两种 tag 避免 glob refspec 空匹配失败
    execSync('git tag lost-commit/dry-run-test HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git tag backup/dry-run-snap HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(['--auto-push', '--dry-run'], { cwd: work })
    assert.equal(r.status, 0, `dry-run 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /dry-run/, '应显示 dry-run')
    // 远端不应有 tag(dry-run 不实际 push)
    assert.ok(!remoteHasTag(work, 'lost-commit/dry-run-test'), '远端不应有 dry-run lost-commit tag')
    assert.ok(!remoteHasTag(work, 'backup/dry-run-snap'), '远端不应有 dry-run backup tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('CLI: HUSKY_SKIP_TAG_SYNC=1 + --auto-push → 跳过 exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/skip-test HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git tag backup/skip-snap HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(['--auto-push'], { cwd: work, env: { HUSKY_SKIP_TAG_SYNC: '1' } })
    assert.equal(r.status, 0, `SKIP + auto-push 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /已跳过|HUSKY_SKIP_TAG_SYNC/, '应显示跳过信息')
    // 远端不应有 tag(被跳过)
    assert.ok(!remoteHasTag(work, 'lost-commit/skip-test'), 'SKIP 后远端不应有 lost-commit tag')
    assert.ok(!remoteHasTag(work, 'backup/skip-snap'), 'SKIP 后远端不应有 backup tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('CLI: HUSKY_SKIP_TAG_SYNC=1 + --fetch → 不跳过(执行 fetch + 拉回 tag)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 在 origin 上创建 tag(通过 work 创建 + push,然后本地删除)
    execSync('git tag lost-commit/skip-fetch HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git push origin lost-commit/skip-fetch', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git tag -d lost-commit/skip-fetch', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    assert.ok(!localHasTag(work, 'lost-commit/skip-fetch'), '前置:本地无 tag')
    // SKIP=1 + --fetch → 应执行 fetch(不跳过)
    const r = runScript(['--fetch'], { cwd: work, env: { HUSKY_SKIP_TAG_SYNC: '1' } })
    assert.ok(r.status === 0 || r.status === 1, `SKIP + fetch 不应 crash,实际 exit ${r.status}`)
    assert.match(r.stdout, /不受 SKIP 影响|手动恢复必须执行/, '应打印不受 SKIP 影响的警告')
    // 验证 tag 已拉回本地
    assert.ok(localHasTag(work, 'lost-commit/skip-fetch'), 'fetch 后本地应有 tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── check 模式一致性检测 ────────────────────────────────

test('检测: 本地 lost-commit/* tag + 已 push 到 origin → check exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/synced HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git push origin lost-commit/synced', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(['--check'], { cwd: work })
    assert.equal(r.status, 0, `本地+远端一致应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /lost-commit\/synced/, 'stdout 应列出该 tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('检测: 本地 lost-commit/* tag 未 push → check exit 1(仅本地)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/only-local HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(['--check'], { cwd: work })
    assert.equal(r.status, 1, `仅本地 tag 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /仅本地|未 push/, '应报告仅本地/未 push')
    assert.match(r.stdout, /lost-commit\/only-local/, 'stdout 应列出该 tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('检测: origin 有 lost-commit/* tag 本地缺失 → check exit 1(仅远端)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/only-remote HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git push origin lost-commit/only-remote', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git tag -d lost-commit/only-remote', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(['--check'], { cwd: work })
    assert.equal(r.status, 1, `仅远端 tag 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /仅远端|本地缺失/, '应报告仅远端/本地缺失')
    assert.match(r.stdout, /lost-commit\/only-remote/, 'stdout 应列出该 tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('检测: 本地有 backup/* tag + 已 push → check exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag backup/snapshot-1 HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git push origin backup/snapshot-1', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    const r = runScript(['--check'], { cwd: work })
    assert.equal(r.status, 0, `backup tag 已 push 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /backup\/snapshot-1/, 'stdout 应列出该 tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── --auto-push 实际推送测试 ────────────────────────────

test('auto-push: 本地有 tag → push 到 origin + 验证远端有 tag', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 创建两种 tag(避免 glob refspec 空匹配导致 push 失败)
    execSync('git tag lost-commit/push-test HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git tag backup/push-snap HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    assert.ok(!remoteHasTag(work, 'lost-commit/push-test'), '前置:远端无 lost-commit tag')
    assert.ok(!remoteHasTag(work, 'backup/push-snap'), '前置:远端无 backup tag')
    const r = runScript(['--auto-push'], { cwd: work })
    assert.equal(r.status, 0, `auto-push 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(remoteHasTag(work, 'lost-commit/push-test'), 'auto-push 后远端应有 lost-commit tag')
    assert.ok(remoteHasTag(work, 'backup/push-snap'), 'auto-push 后远端应有 backup tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 失败原因的可观测性(2026-10-11 补)──────────────────
// 2026-09-24 那轮把"只打 e.message"修成"打 e.stderr",但 git push 的**逐引用结果**
// ("! [remote rejected] …"/"error: failed to push some refs")走的是 **stdout** ——
// 于是屏幕上留下的只有钩子那串"全量 typecheck 验证…"的无关通知:它不是"报了原因但没用",
// 是"报了一份会把人引向错误方向的原因"(AGENTS §12f:失效方向必须是"多要一次说明",
// 绝不能是"多给一次误导")。本条用真夹具让钩子**只往 stdout 打**一行拒绝,证明它现在会露出来。
test('auto-push 失败原因两流都报:只打在 stdout 的拒绝行不得被吞,stderr 那半也不得退化', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 夹具自己声明 hooksPath:全局/继承的 core.hooksPath 会把钩子指到别处,那这次"被拒"
    // 就根本没发生,断言会以"没报失败"的形态红 —— 先把它钉死在本仓自己的 .git/hooks。
    execSync('git config core.hooksPath .git/hooks', {
      cwd: work,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    writeFileSync(
      join(work, '.git', 'hooks', 'pre-push'),
      '#!/bin/sh\necho "STDOUT-ONLY-REJECT-lost-commit-obs"\necho "STDERR-ALSO-REJECT-lost-commit-obs" 1>&2\nexit 1\n',
      { mode: 0o755 },
    )
    execSync('git tag lost-commit/obs-test HEAD', {
      cwd: work,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const r = runScript(['--auto-push', '--force'], {
      cwd: work,
      env: { IHUI_TAG_PUSH_CONTINUE_ON_FAIL: '1' },
    })
    const all = `${r.stdout}\n${r.stderr}`
    assert.match(all, /块 push 失败/, '被钩子拒掉时必须报"块 push 失败",不得静默')
    assert.match(
      all,
      /stdout: .*STDOUT-ONLY-REJECT/,
      `git 经钩子打在 **stdout** 的拒绝行必须进原因(旧写法只取 e.stderr ⇒ 整段被吞)\n实得:\n${all.slice(-1200)}`,
    )
    assert.match(
      all,
      /stderr: .*STDERR-ALSO-REJECT/,
      `2026-09-24 修的"stderr 也要报"那一半不得因本次改动退化\n实得:\n${all.slice(-1200)}`,
    )
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// 辅助:在指定夹具里跑一条 git 命令(派生一律显式 stdio,AGENTS.md §12g)
function gitAt(cwd, cmd) {
  execSync(cmd, {
    cwd,
    /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: [
      'ignore',
      'pipe',
      'pipe',
    ],
  })
}

// ─── 2026-10-14 扩射程:两条旧盲区各必须有正反对照 ───────────────────
// 盲区 B「只比名字不比 SHA」⇒ 同名不同 SHA 必须判红;同 SHA 必须判绿(不得凭空造红)。
test('检测: 同名 tag 本地与 origin 指向不同提交 ⇒ exit 1(旧版只比名字,这类分歧完全看不见)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    gitAt(work, 'git tag desktop-v9.9.9 HEAD')
    gitAt(work, 'git push origin desktop-v9.9.9')
    gitAt(work, 'git commit --allow-empty -m "second"')
    // 本地把同名 tag 挪到新提交,origin 仍指旧提交 = 历史重写后的"新链 vs 旧链"形态
    gitAt(work, 'git tag -f desktop-v9.9.9 HEAD')
    const r = runScript(['--check', '--json'], { cwd: work })
    assert.equal(r.status, 1, `同名 SHA 分歧应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    const result = JSON.parse(r.stdout.trim())
    assert.equal(result.status, 'fail')
    const mism = result.allTags.shaMismatch.filter((m) => m.tag === 'desktop-v9.9.9')
    assert.equal(mism.length, 1, 'shaMismatch 应点名该 tag')
    assert.match(mism[0].local, /^[0-9a-f]{40}$/, '登记的 SHA 必须是全量 40 位(§1 证据指针纪律)')
    assert.match(mism[0].remote, /^[0-9a-f]{40}$/, '两侧的 SHA 都要给,否则无法判断该往哪校准')
    assert.notEqual(mism[0].local, mism[0].remote, '既然进了分歧桶,两个 SHA 必须真的不同')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('对照: 同名 tag 两侧同 SHA ⇒ exit 0(加了 SHA 维度不得凭空造红)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    gitAt(work, 'git tag desktop-v9.9.8 HEAD')
    gitAt(work, 'git push origin desktop-v9.9.8')
    const r = runScript(['--check', '--json'], { cwd: work })
    assert.equal(r.status, 0, `一致应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    const result = JSON.parse(r.stdout.trim())
    assert.equal(result.allTags.shaMismatch.length, 0, '同 SHA 不得被记成分歧')
    assert.equal(result.allTags.localCount, 1)
    assert.equal(result.allTags.remoteCount, 1)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// annotated tag 是这条判据最容易翻车的地方:远端 `refs/tags/x` 那一行是 **tag 对象**的 SHA,
// 只有 `refs/tags/x^{}` 才是 commit;本地取的是 `%(*objectname)`。两侧口径不齐 ⇒ 每枚
// annotated 发布 tag 都会假红(而且红得像是"链分歧",会把人引向错误的抢修方向)。
test('annotated tag: 两侧同口径 peel ⇒ 同枚 annotated tag 不得被误判 SHA 分歧', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    gitAt(work, 'git tag -a release-v1.0.0 -m "annotated release note" HEAD')
    gitAt(work, 'git push origin release-v1.0.0')
    // 前置自证:远端**全量** ls-remote(与生产取法一致——不带 pattern)确实同时给出
    // tag 对象行与 peel 行,且两者 SHA 不同(否则这条对照什么也没锁住)。
    // 注:`ls-remote --tags origin <pattern>` 实测**不返回** peel 行,所以前置必须照生产的取法来。
    const raw = execSync('git ls-remote --tags origin', {
      cwd: work,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const mine = raw
      .split('\n')
      .filter(Boolean)
      .filter((l) => l.split('\t')[1]?.startsWith('refs/tags/release-v1.0.0'))
    assert.equal(mine.length, 2, `前置:应同时看到 tag 对象行与 ^{} peel 行,实得:\n${mine.join('\n')}`)
    const shas = new Set(mine.map((l) => l.split('\t')[0]))
    assert.equal(shas.size, 2, '前置:tag 对象与 peel 后的 commit 必须是两个不同 SHA')
    const r = runScript(['--check', '--json'], { cwd: work })
    assert.equal(r.status, 0, `annotated tag 一致应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    const result = JSON.parse(r.stdout.trim())
    assert.equal(result.allTags.shaMismatch.length, 0, '取错行就会把 annotated tag 全判成分歧')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// 盲区 A「只看两个命名空间」⇒ 非备份命名空间的"仅本地"(= 压根没备份)也必须判红。
test('检测: 非备份命名空间 tag 仅本地 ⇒ exit 1(旧版只认 lost-commit/backup,这类失明)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    gitAt(work, 'git tag nightly-99999999999 HEAD')
    const r = runScript(['--check'], { cwd: work })
    assert.equal(r.status, 1, `非备份命名空间仅本地应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /仅本地|未 push/)
    assert.match(r.stdout, /nightly-99999999999/, '必须点名是哪一枚')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// 口径(用户 2026-10-14 拍板):非备份命名空间的"仅远端"只是本地落后 origin,
// 而自治理仓的 CI 每分钟都在造 nightly ⇒ 判红就是把守门做成恒红门(AGENTS §12e)。
test('口径: 非备份命名空间 tag 仅远端 ⇒ exit 0 且只告警(不得因 CI 持续造 tag 恒红)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    gitAt(work, 'git tag desktop-v1.0.0 HEAD')
    gitAt(work, 'git push origin desktop-v1.0.0')
    gitAt(work, 'git tag -d desktop-v1.0.0')
    const r = runScript(['--check', '--json'], { cwd: work })
    assert.equal(r.status, 0, `非备份仅远端只告警,实际 ${r.status}\nstdout: ${r.stdout}`)
    const result = JSON.parse(r.stdout.trim())
    assert.equal(result.status, 'ok')
    assert.ok(result.allTags.onlyRemoteOther.includes('desktop-v1.0.0'), '应进"仅远端-非备份"桶')
    assert.deepEqual(result.allTags.onlyRemoteBackup, [], '不该混进备份桶')
    assert.ok(result.warnings.length >= 1, '告警必须如实上报,不能悄悄吞掉')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('对照: 备份命名空间 tag 仅远端 ⇒ exit 1(与上一条构成分流对照,§22 备份缺口不得只告警)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    gitAt(work, 'git tag backup/only-remote-snap HEAD')
    gitAt(work, 'git push origin backup/only-remote-snap')
    gitAt(work, 'git tag -d backup/only-remote-snap')
    const r = runScript(['--check', '--json'], { cwd: work })
    assert.equal(r.status, 1, `备份命名空间仅远端应 exit 1,实际 ${r.status}`)
    const result = JSON.parse(r.stdout.trim())
    assert.deepEqual(result.allTags.onlyRemoteBackup, ['backup/only-remote-snap'])
    assert.deepEqual(result.allTags.onlyRemoteOther, [])
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// 逐条清单被截断 ⇒ 只是"少打印",绝不能"少判定"(AGENTS §0.5/§10:输出形态不得影响数字)。
test('有界打印不得缩水判定:IHUI_TAG_LIST_CAP=1 时清单被截,但全量数字与 JSON 判定不变', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    gitAt(work, 'git tag lost-commit/cap-a HEAD')
    gitAt(work, 'git tag lost-commit/cap-b HEAD')
    gitAt(work, 'git tag lost-commit/cap-c HEAD')
    gitAt(work, 'git push origin --tags')
    const capped = runScript(['--check'], { cwd: work, env: { IHUI_TAG_LIST_CAP: '1' } })
    assert.equal(capped.status, 0, `三枚已同步应 exit 0,实际 ${capped.status}\n${capped.stdout}`)
    assert.match(capped.stdout, /另有 2 枚/, '清单应被截断并明说截了多少')
    const full = runScript(['--check', '--json'], { cwd: work })
    assert.equal(full.status, 0)
    const result = JSON.parse(full.stdout.trim())
    assert.equal(result.allTags.localCount, 3, 'JSON 计数必须是全量,不随打印上限缩水')
    assert.equal(result.summary.total, 3, '可达性判定面也必须是全量')
    assert.equal(result.summary.reachable, 3)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// 同一屏里"SHA 分歧"一行本来就只给 20 个,而"仅本地/仅远端/不可达"三行不截 ⇒ 判定行本身
// 也会刷出单行几 KB。本条锁住"计数全量、名字有界"这一对(与上一条成对:上条锁逐条清单)。
test('判定行同样有界:名字被截时计数必须仍是全量,且 JSON 不受上限影响', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    for (let i = 1; i <= 25; i++) gitAt(work, `git tag lost-commit/many-${i} HEAD`)
    const r = runScript(['--check'], { cwd: work, env: { IHUI_TAG_LIST_CAP: '5' } })
    assert.equal(r.status, 1, `25 枚仅本地应判红,实际 ${r.status}`)
    assert.match(r.stdout, /25 个 tag 仅本地/, '判定行的计数必须是全量 25,不得随上限缩水')
    assert.ok(r.stdout.includes('…(+20)'), `应明说还差 20 个没列出来\n实得:\n${r.stdout.slice(-800)}`)
    const jr = runScript(['--check', '--json'], { cwd: work })
    assert.equal(jr.status, 1)
    const result = JSON.parse(jr.stdout.trim())
    assert.equal(result.allTags.onlyLocal.length, 25, 'JSON 的机器读者永远拿全量')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// 数值档拼错的后果必须是"多说一句",不能是"少列一切":旧写法 Number('abc') ⇒ NaN ⇒
// slice(0, NaN) = [] ⇒ 判定行一个名字都不列却照样按计数 exit,屏幕上看不出异常。
test('数值档拼错不得静默变形:IHUI_TAG_LIST_CAP=abc ⇒ 说明后回落默认档,且名字照列、--json 的 stdout 不被污染', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    for (let i = 1; i <= 3; i++) gitAt(work, `git tag lost-commit/badcap-${i} HEAD`)
    const r = runScript(['--check'], { cwd: work, env: { IHUI_TAG_LIST_CAP: 'abc' } })
    assert.equal(r.status, 1, `三枚仅本地应判红,实际 ${r.status}`)
    const all = `${r.stdout}\n${r.stderr}`
    assert.match(all, /不是正整数 ⇒ 按默认档 20 执行/, '回落必须当场说出口(§0.10)')
    assert.match(r.stdout, /lost-commit\/badcap-1/, '回落默认档后名字照列(NaN 会让它一个都不列)')
    const j = runScript(['--check', '--json'], { cwd: work, env: { IHUI_TAG_LIST_CAP: 'abc' } })
    assert.equal(j.status, 1)
    assert.doesNotThrow(() => JSON.parse(j.stdout.trim()), '提示走 stderr,stdout 必须仍是纯 JSON')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 单元层:直接吃生产判据(§22c 禁止在测试里复制一份判定) ───────
test('单元: diffTagMaps 锁三分流(仅本地 / 同名 SHA 分歧 / 仅远端按命名空间分流)', () => {
  const localMap = new Map([
    ['lost-commit/a', 'a'.repeat(40)],
    ['backup/snap', 'b'.repeat(40)],
    ['desktop-v1', 'c'.repeat(40)],
    ['only-local-flat', 'd'.repeat(40)],
  ])
  const remoteMap = new Map([
    ['lost-commit/a', 'a'.repeat(40)], // 一致
    ['backup/snap', 'e'.repeat(40)], // SHA 分歧(备份族)
    ['desktop-v1', 'f'.repeat(40)], // SHA 分歧(非备份族,同样判分歧)
    ['lost-commit/remote-only', 'g'.repeat(40)], // 仅远端-备份族
    ['nightly-1', 'h'.repeat(40)], // 仅远端-非备份族
  ])
  const d = TagSync.diffTagMaps(localMap, remoteMap)
  assert.deepEqual(d.onlyLocal, ['only-local-flat'])
  assert.deepEqual(
    d.shaMismatch.map((m) => m.tag),
    ['backup/snap', 'desktop-v1'],
  )
  assert.deepEqual(d.onlyRemote, ['lost-commit/remote-only', 'nightly-1'])
  assert.deepEqual(d.onlyRemoteBackup, ['lost-commit/remote-only'])
  assert.deepEqual(d.onlyRemoteOther, ['nightly-1'])
  // 分歧条目必须两侧 SHA 齐给(校准时要靠它判断该往哪边对)
  const snap = d.shaMismatch.find((m) => m.tag === 'backup/snap')
  assert.equal(snap.local, 'b'.repeat(40))
  assert.equal(snap.remote, 'e'.repeat(40))
})

test('单元: 备份命名空间判定按前缀加斜杠,不得被子串误命中', () => {
  assert.ok(TagSync.isBackupNamespace('lost-commit/x'))
  assert.ok(TagSync.isBackupNamespace('backup/x'))
  // 真仓在位的邻近命名空间:sync-tags.mjs 的镜像白名单里有 lost-commit-backup/,
  // 而 §22 管辖的是 lost-commit/ 与 backup/ 两族 —— 前缀边界判错会把"只告警"和"判红"用反。
  assert.ok(!TagSync.isBackupNamespace('lost-commit-backup/x'))
  assert.ok(!TagSync.isBackupNamespace('backup-merge-ours-e09d866'))
  assert.ok(!TagSync.isBackupNamespace('backupx/y'))
  assert.ok(!TagSync.isBackupNamespace('restore/prealign'))
  assert.ok(!TagSync.isBackupNamespace('desktop-v0.1.47'))
})

test('单元: reachabilityBatch 单进程判可达 —— 缺对象判红、解析不出判红、在位判绿', () => {
  const dir = createTempRepo()
  const prev = process.cwd()
  let rows
  let realSha
  try {
    // reachabilityBatch 内部起的是 `git cat-file --batch-check`,按**进程 cwd**定位仓库;
    // 不切进夹具就会拿真仓去判夹具的 SHA(那枚夹具提交在真仓里当然读不出 ⇒ 判红判成"对了",
    // 实际锁住的却是完全相反的口径)。真实仓库形态由上面的 CLI 端到端用例覆盖。
    process.chdir(dir)
    realSha = execSync('git rev-parse HEAD', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    rows = TagSync.reachabilityBatch(
      ['lost-commit/alive', 'lost-commit/ghost', 'lost-commit/unparsed'],
      new Map([
        ['lost-commit/alive', realSha],
        ['lost-commit/ghost', 'f'.repeat(40)], // 形状合法但对象不在仓里
        ['lost-commit/unparsed', ''], // ref 在位却解不出 SHA
      ]),
    )
  } finally {
    process.chdir(prev)
  }
  try {
    assert.match(realSha, /^[0-9a-f]{40}$/, '前置:夹具 HEAD 应是全量 SHA')
    const byTag = new Map(rows.map((r) => [r.tag, r]))
    assert.equal(byTag.get('lost-commit/alive').ok, true, '在位对象必须判绿')
    assert.equal(byTag.get('lost-commit/ghost').ok, false, '对象读不出来必须判红')
    assert.equal(byTag.get('lost-commit/ghost').reason, '对象不可达')
    assert.equal(byTag.get('lost-commit/unparsed').ok, false, '解不出 SHA 不得当成可达')
    assert.equal(byTag.get('lost-commit/unparsed').reason, 'tag 解析失败')
  } finally {
    rmScratch(dir)
  }
})

// ─── --fetch 拉回测试 ────────────────────────────────────
test('fetch: origin 有 tag 本地缺失 → fetch 后本地有 tag + exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/fetch-test HEAD', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git push origin lost-commit/fetch-test', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    execSync('git tag -d lost-commit/fetch-test', { cwd: work, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
    assert.ok(!localHasTag(work, 'lost-commit/fetch-test'), '前置:本地无 tag')
    const r = runScript(['--fetch'], { cwd: work })
    assert.equal(r.status, 0, `fetch 后应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(localHasTag(work, 'lost-commit/fetch-test'), 'fetch 后本地应有 tag')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('增长产线停用: --auto-push 未显式开启 ⇒ exit 0 且一枚 tag 都不推;显式开启 ⇒ 仍能推(反向对照)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    gitAt(work, 'git tag lost-commit/pending-push HEAD')
    const off = runScript(['--auto-push'], { cwd: work, env: { IHUI_TAG_AUTOPUSH_ENABLED: '' } })
    assert.equal(off.status, 0, `关闸必须 exit 0(不是失败),实际 ${off.status}\nstdout: ${off.stdout}`)
    assert.match(off.stdout, /增长产线停用/, '关闸要说人话点名开关,不许静默')
    assert.ok(!remoteHasTag(work, 'lost-commit/pending-push'), '关闸后一枚 tag 都不许推到远端')
    // 反向对照:显式开闸 ⇒ 同一条路径仍能推(证明开关不是把推送功能删了)
    const on = runScript(['--auto-push'], { cwd: work, env: { IHUI_TAG_AUTOPUSH_ENABLED: '1' } })
    assert.equal(on.status, 0, `开闸应 exit 0,实际 ${on.status}\nstdout: ${on.stdout}`)
    assert.ok(remoteHasTag(work, 'lost-commit/pending-push'), '开闸后该 tag 必须推上去')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('DBG-90 单元:非备份族危险 ref 拒绝进命令;备份族含 ;&| 仍是一个参数且不带 --force', () => {
  assert.equal(TagSync.isDangerousNonBackupRef('nightly;echo>x'), true)
  assert.equal(TagSync.isDangerousNonBackupRef('rel&calc'), true)
  assert.equal(TagSync.isDangerousNonBackupRef('rel|rm'), true)
  assert.equal(TagSync.isDangerousNonBackupRef('backup/ok;echo>x'), false)
  assert.equal(TagSync.isDangerousNonBackupRef('lost-commit/a|b'), false)
  assert.equal(TagSync.isDangerousNonBackupRef('desktop-v1.0.0'), false)
  const tag = 'backup/a;b&c|d>e'
  const argv = TagSync.buildTagPushArgv([tag, 'lost-commit/ok'])
  assert.equal(argv.includes('--force'), false)
  assert.equal(argv.includes('--force-with-lease'), false)
  assert.ok(argv.every((a) => !a.startsWith('+')))
  const originAt = argv.indexOf('origin')
  assert.ok(originAt > argv.indexOf('push'))
  assert.deepEqual(argv.slice(originAt + 1), [`refs/tags/${tag}`, 'refs/tags/lost-commit/ok'])
  assert.throws(() => TagSync.buildTagPushArgv(['nightly;calc']))
  assert.throws(() => TagSync.buildTagPushArgv([]))
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.doesNotMatch(src, /execSync\s*\(/)
  assert.doesNotMatch(src, /\$\{refspecs\}/)
  assert.doesNotMatch(src, /\$\{forceFlag\}/)
  assert.doesNotMatch(src, /git push --force/)
  assert.doesNotMatch(src, /shell:\s*true/)
})

test('DBG-90: 备份族 ref 含 ; 与 & 按参数数组推到本地 bare,不经 cmd 执行', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  // `|` `>` 在 Windows 上进不了 ref 文件名;这里用能落盘的 `;` `&`。命令输出(主机名/用户名)不在 ref 名里。
  const host = hostname().trim()
  const user = userInfo().username.trim()
  const semi = 'backup/ok;hostname'
  const amp = 'backup/amp&whoami'
  assert.ok(host.length > 1 && !semi.includes(host) && !amp.includes(host))
  assert.ok(user.length > 1 && !semi.includes(user) && !amp.includes(user))
  try {
    pinLocalOrigin(work, origin)
    assert.equal(gitArgv(work, ['tag', semi, 'HEAD']).status, 0)
    assert.equal(gitArgv(work, ['tag', amp, 'HEAD']).status, 0)
    const r = runScript(['--auto-push'], { cwd: work })
    const all = `${r.stdout}\n${r.stderr}`
    assert.equal(all.includes(host), false, `cmd 把 ; 后面的 hostname 执行了\n${all}`)
    assert.equal(all.includes(user), false, `cmd 把 & 后面的 whoami 执行了\n${all}`)
    assert.equal(r.status, 0, `备份族含元字符应仍能推送\n${all}`)
    assert.doesNotMatch(all, /git push --force/)
    assert.equal(remoteTagSha(work, semi).length, 40, `远端 ref 被 ; 拆开了\n${all}`)
    assert.equal(remoteTagSha(work, amp).length, 40, `远端 ref 被 & 拆开了\n${all}`)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('DBG-90: 非备份族危险 ref 不得进推送命令,也不得被 cmd 执行', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  const host = hostname().trim()
  const evil = 'nightly;hostname'
  assert.ok(host.length > 1 && !evil.includes(host))
  try {
    pinLocalOrigin(work, origin)
    assert.equal(gitArgv(work, ['tag', 'backup/plain', 'HEAD']).status, 0)
    const tagged = gitArgv(work, ['tag', evil, 'HEAD'])
    assert.equal(tagged.status, 0, `前置:该 ref 合法\n${tagged.stderr}`)
    const r = runScript(['--auto-push'], { cwd: work })
    const all = `${r.stdout}\n${r.stderr}`
    assert.notEqual(r.status, 0, `危险 ref 被拒绝时不得 exit 0\n${all}`)
    assert.match(all, /拒绝把非备份族危险 ref/)
    assert.ok(all.includes(evil), `必须点名该 ref\n${all}`)
    assert.equal(all.includes(host), false, `拒绝之后仍把 ;hostname 交给了 cmd\n${all}`)
    assert.equal(remoteTagSha(work, evil), '', '危险 ref 不得出现在远端')
    assert.equal(remoteTagSha(work, 'backup/plain').length, 40, '同批安全 tag 仍应推上去')
    assert.doesNotMatch(all, /git push --force/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('DBG-91 单元:备份族同名不同 SHA 被点名,非备份族分歧不进这张拒绝表', () => {
  const local = new Map([
    ['backup/keep', 'a'.repeat(40)],
    ['lost-commit/keep', 'b'.repeat(40)],
    ['backup/same', 'c'.repeat(40)],
    ['desktop-v9', 'd'.repeat(40)],
  ])
  const remote = new Map([
    ['backup/keep', 'e'.repeat(40)],
    ['lost-commit/keep', 'f'.repeat(40)],
    ['backup/same', 'c'.repeat(40)],
    ['desktop-v9', '1'.repeat(40)],
  ])
  const rows = TagSync.backupShaConflicts(local, remote)
  assert.deepEqual(
    rows.map((r) => r.tag),
    ['backup/keep', 'lost-commit/keep'],
  )
  assert.equal(rows[0].local, 'a'.repeat(40))
  assert.equal(rows[0].remote, 'e'.repeat(40))
})

test('DBG-91: --force 不得覆盖远端已有且 SHA 不同的 backup/* 与 lost-commit/*', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    pinLocalOrigin(work, origin)
    assert.equal(gitArgv(work, ['tag', 'backup/keep', 'HEAD']).status, 0)
    assert.equal(gitArgv(work, ['tag', 'lost-commit/keep', 'HEAD']).status, 0)
    const firstPush = gitArgv(work, [
      'push',
      'origin',
      'refs/tags/backup/keep',
      'refs/tags/lost-commit/keep',
    ])
    assert.equal(firstPush.status, 0, `前置推送失败\n${firstPush.stderr}\n${firstPush.stdout}`)
    const shaA = gitArgv(work, ['rev-parse', 'HEAD']).stdout.trim()
    assert.equal(remoteTagSha(work, 'backup/keep'), shaA)
    assert.equal(remoteTagSha(work, 'lost-commit/keep'), shaA)
    assert.equal(gitArgv(work, ['commit', '--allow-empty', '-m', 'second']).status, 0)
    assert.equal(gitArgv(work, ['tag', '-f', 'backup/keep', 'HEAD']).status, 0)
    assert.equal(gitArgv(work, ['tag', '-f', 'lost-commit/keep', 'HEAD']).status, 0)
    assert.equal(gitArgv(work, ['tag', 'backup/fresh', 'HEAD']).status, 0)
    const shaB = gitArgv(work, ['rev-parse', 'HEAD']).stdout.trim()
    assert.notEqual(shaA, shaB)
    const r = runScript(['--auto-push', '--force'], { cwd: work })
    const all = `${r.stdout}\n${r.stderr}`
    assert.notEqual(r.status, 0, `拒绝覆盖时不得 exit 0\n${all}`)
    assert.match(all, /拒绝覆盖远端备份 tag/)
    assert.ok(all.includes('backup/keep'), `必须点名 backup/keep\n${all}`)
    assert.ok(all.includes('lost-commit/keep'), `必须点名 lost-commit/keep\n${all}`)
    assert.doesNotMatch(all, /push --force/)
    assert.equal(remoteTagSha(work, 'backup/keep'), shaA, 'backup/keep 被覆盖成了本地重建提交')
    assert.equal(remoteTagSha(work, 'lost-commit/keep'), shaA, 'lost-commit/keep 被覆盖成了本地重建提交')
    assert.equal(remoteTagSha(work, 'backup/fresh'), shaB, '远端缺失的新备份 tag 仍应推上去')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── --prune-redundant(2026-11-12 立):备份 tag 只增不减的复位腿 ──────────
// 立因:悬空保活腿按天新增 lost-commit/*,而一旦所指向的提交后来落到 origin,这枚 tag 就只剩占名;
// 没有任何复位腿 ⇒ 本仓实测 8,754 枚里 8,087 枚属此型。删除必须严格限定为"提交已在远端分支"。
test('单元: redundantBackupTags 只认「lost-commit/ + 提交已在远端 + 远端无同名」', () => {
  const reachable = new Set(['a'.repeat(40), 'b'.repeat(40)])
  const local = new Map([
    ['lost-commit/redundant', 'a'.repeat(40)],
    ['lost-commit/keep-unreachable', 'c'.repeat(40)],
    ['lost-commit/keep-remote-backed', 'b'.repeat(40)],
    ['backup/snap', 'a'.repeat(40)],
  ])
  const rows = TagSync.redundantBackupTags(
    local,
    reachable,
    new Set(['lost-commit/keep-remote-backed']),
  )
  assert.deepEqual(rows, ['lost-commit/redundant'], '只删 lost-commit/ 且提交已可达的;远端有同名的不动')
})

test('CLI: --prune-redundant 默认 dry-run 不删;--apply 只删冗余,唯一备份保留', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    pinLocalOrigin(work, origin)
    // ① 冗余:提交已在 origin/main 里
    gitAt(work, 'git tag lost-commit/redundant HEAD')
    // ② 唯一备份:孤立分支上的提交;分支删掉后只剩这枚 tag 撑着
    gitAt(work, 'git checkout -b side')
    writeFileSync(join(work, 'side.txt'), 'side\n')
    gitAt(work, 'git add side.txt')
    gitAt(work, 'git commit -m "side"')
    gitAt(work, 'git tag lost-commit/keep-side HEAD')
    gitAt(work, 'git checkout main')
    gitAt(work, 'git branch -D side')

    const dry = runScript(['--prune-redundant'], { cwd: work })
    assert.equal(dry.status, 0, `dry-run 应 exit 0,实际 ${dry.status}\n${dry.stdout}`)
    assert.match(dry.stdout, /dry-run/, '必须明说没删(默认档不得静默动手)')
    assert.ok(localHasTag(work, 'lost-commit/redundant'), 'dry-run 不得删除任何 tag')
    assert.ok(localHasTag(work, 'lost-commit/keep-side'), 'dry-run 不得删除任何 tag')

    const applied = runScript(['--prune-redundant', '--apply'], { cwd: work })
    assert.equal(applied.status, 0, `--apply 应 exit 0,实际 ${applied.status}\n${applied.stdout}`)
    assert.ok(!localHasTag(work, 'lost-commit/redundant'), '提交已在远端的冗余 tag 应被删除')
    assert.ok(localHasTag(work, 'lost-commit/keep-side'), '唯一备份 tag 必须保留(删了会真丢提交)')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── --bundle-archive(2026-11-12 立):唯一备份面的离线冷归档 ──────────────
// 立因:唯一备份 596 提交 / 7.8GB 未压缩,推 origin 既违背"增长产线停用"的机主令也会撑爆远端;
// 正解 = 单文件 bundle + 写后双验 + --if-changed 日常零写入。
test('CLI: --bundle-archive 归档并双验;--if-changed 集合未变时跳过重写', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  const bundles = mkScratch('ihui-tag-bundle-')
  try {
    pinLocalOrigin(work, origin)
    gitAt(work, 'git tag lost-commit/redundant HEAD')
    gitAt(work, 'git checkout -b side')
    writeFileSync(join(work, 'side.txt'), 'side\n')
    gitAt(work, 'git add side.txt')
    gitAt(work, 'git commit -m "side"')
    gitAt(work, 'git tag lost-commit/keep-side HEAD')
    gitAt(work, 'git checkout main')
    gitAt(work, 'git branch -D side')

    const first = runScript([`--bundle-archive=${bundles}`], { cwd: work })
    assert.equal(first.status, 0, `首次归档应 exit 0,实际 ${first.status}\n${first.stdout}\n${first.stderr}`)
    const bundlesOnDisk = readdirSync(bundles).filter((f) => f.endsWith('.bundle'))
    assert.equal(bundlesOnDisk.length, 1, '应产出一份 bundle')
    const manifest = JSON.parse(readFileSync(join(bundles, 'lost-commits.manifest.json'), 'utf8'))
    assert.equal(manifest.verified, true, '台账必须记录已复验')
    assert.equal(manifest.tags, 2, '两枚 lost-commit tag 都应进归档')
    assert.equal(manifest.uniqueCommits, 1, '只有 side 那枚是远端不存在的唯一备份')

    const second = runScript([`--bundle-archive=${bundles}`, '--if-changed'], { cwd: work })
    assert.equal(second.status, 0, `--if-changed 应 exit 0,实际 ${second.status}\n${second.stdout}`)
    assert.match(second.stdout, /跳过/, '集合未变必须跳过重写')
    assert.equal(readdirSync(bundles).filter((f) => f.endsWith('.bundle')).length, 1)
  } finally {
    rmScratch(work)
    rmScratch(origin)
    rmScratch(bundles)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
