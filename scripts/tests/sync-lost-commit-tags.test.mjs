// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
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
    env: { ...process.env, ...opts.env },
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
