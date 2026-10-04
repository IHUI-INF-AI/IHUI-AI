// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  triagePushAttempt,
  PUSH_TRIAGE_KINDS,
  CONVERGE_COMMAND,
} from '../lib/push-attempt-triage.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'git-push-guard.mjs')
const GUARD_SRC = readFileSync(SCRIPT_PATH, 'utf8')
const READER_PATHS = {
  'check-push-sync.mjs': join(__dirname, '..', 'check-push-sync.mjs'),
  'git-push-converge.mjs': join(__dirname, '..', 'git-push-converge.mjs'),
  'git-sync-converge.mjs': join(__dirname, '..', 'git-sync-converge.mjs'),
}

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkScratch('ihui-push-')
  execSync('git init -b main', {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  execSync('git config user.email test@test.com', {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  execSync('git config user.name test', {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  execSync('git config commit.gpgsign false', {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  execSync('git commit -m "init"', {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return dir
}

// 辅助:创建临时 bare 仓库(作为 origin)
function createTempBareOrigin() {
  const dir = mkScratch('ihui-origin-')
  execSync('git init --bare -b main', {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return dir
}

// 辅助:创建工作仓库 + bare origin,并 push 初始 commit(synced 状态)
function createSyncedRepoWithOrigin() {
  const work = createTempRepo()
  const origin = createTempBareOrigin()
  // Windows 路径转正斜杠(git remote add 兼容)
  const originUrl = origin.replace(/\\/g, '/')
  execSync(`git remote add origin "${originUrl}"`, {
    cwd: work,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  execSync('git push -u origin main', {
    cwd: work,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return { work, origin }
}

// 辅助:运行 git-push-guard.mjs
// GUARD_ASYNC=0 默认注入(2026-09-23):guard 自 2026-09-18 起默认 spawn detached
// 后台推送 worker,它会在用例结束后仍把临时仓目录当 cwd 持有(还要跑完 pre-push
// 门才退)→ finally 里的 rmSync 必撞 EPERM,7 条既有用例因此恒红(断言其实全过)。
// 同步模式让"返回即推送终态",local == remote 这类断言也才真正成立。
// 放在 ...opts.env 之前,单条用例仍可显式覆盖以专测异步路径。
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    // 派生一律带 windowsHide(§5b「🪟 后台进程禁弹窗」/守门 52);guard 会真派生 git。
    windowsHide: true,
    // guard 现在把 push 回显整段转写进自己的 stdout(分诊需要文本)⇒ 给足 maxBuffer,
    // 否则命中 node 默认 1MB 会把**已缓冲输出**丢掉(守门 123 记的同一型)。
    maxBuffer: 64 * 1024 * 1024,
    timeout: 180_000,
    env: { ...process.env, GUARD_ASYNC: '0', ...opts.env },
  })
}

// 辅助:在工作仓库中创建并 push 一个新 commit(使本地 ahead)
function makeCommit(dir, relPath, content, message) {
  if (relPath) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
    execSync(`git add "${relPath.replace(/\\/g, '/')}"`, {
      cwd: dir,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } else {
    execSync('git add -A', {
      cwd: dir,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  execSync(`git commit -m "${message}"`, {
    cwd: dir,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

// 辅助:生成 N 行 JSON 内容(用于截断测试)
function generateJsonLines(n) {
  const lines = ['{']
  for (let i = 0; i < n - 2; i++) {
    lines.push(`  "k${i}": "v${i}",`)
  }
  lines.push(`  "k${n - 2}": "v${n - 2}"`)
  lines.push('}')
  return lines.join('\n')
}

// ─── CLI 行为测试 ────────────────────────────────────────

test('CLI: 无参数运行(默认 branch=main,无 origin) → exit 2', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 2, `无 origin 应 exit 2,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /未配置 origin|origin remote/)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: --branch=dev 参数解析(stdout 含 dev)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--branch=dev'], { cwd: dir })
    // 无 origin → exit 2,但 stdout 应提及目标分支 dev
    assert.equal(r.status, 2)
    assert.match(r.stdout, /dev/, 'stdout 应含 --branch 参数值 dev')
  } finally {
    rmScratch(dir)
  }
})

test('CLI: --help 不崩溃(脚本未实现 --help,按默认运行)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--help'], { cwd: dir })
    // 无 origin → exit 2,但不应 crash
    assert.ok(
      r.status === 2 || r.status === 0 || r.status === 1,
      `--help 不应 crash,实际 exit ${r.status}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: HUSKY_SKIP_PUSH=1 → stdout 显示 "仅检测" 模式', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const r = runScript([], { cwd: work, env: { HUSKY_SKIP_PUSH: '1' } })
    // synced 状态 → exit 0,但 stdout 应显示 "仅检测" 模式
    assert.match(r.stdout, /仅检测/, '应显示仅检测模式')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 同步 / ahead / behind 状态测试 ──────────────────────

test('同步: 本地 HEAD == origin/main → exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `同步状态应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /已同步|无需 push/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('ahead: 本地 ahead + HUSKY_SKIP_PUSH=1 → exit 1(仅检测不推送)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeCommit(work, 'new-file.txt', 'content\n', 'add new file')
    const r = runScript([], { cwd: work, env: { HUSKY_SKIP_PUSH: '1' } })
    assert.equal(r.status, 1, `ahead + skipPush 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /ahead|未推送|仅检测/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('behind: 本地 behind origin → exit 1 + 提示 pull --rebase', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 在工作仓库再 push 一个 commit(origin 前进)
    makeCommit(work, 'second.txt', 'second\n', 'second commit')
    execSync('git push origin main', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // reset --hard HEAD~1 使本地落后 origin
    execSync('git reset --hard HEAD~1', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `behind 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /pull --rebase|落后/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 无 origin / detached HEAD ───────────────────────────

test('无 origin: 仓库无 origin remote → exit 2', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 2, `无 origin 应 exit 2,实际 ${r.status}`)
    assert.match(r.stdout, /未配置 origin|origin remote/)
  } finally {
    rmScratch(dir)
  }
})

test('detached HEAD: git checkout <hash> → exit 2', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 切到 detached HEAD
    const headHash = execSync('git rev-parse HEAD', {
      cwd: work,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    execSync(`git checkout ${headHash}`, {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 2, `detached HEAD 应 exit 2,实际 ${r.status}`)
    assert.match(r.stdout, /detached/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── AGENT_SCOPE 校验 ────────────────────────────────────

test('AGENT_SCOPE: commit 含越界文件 + AGENT_SCOPE=apps/api → exit 1', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 创建 apps/web/ 下的文件(不在 AGENT_SCOPE=apps/api 范围内)
    makeCommit(work, 'apps/web/page.tsx', 'export const X = 1\n', 'feat: add web page')
    const r = runScript([], {
      cwd: work,
      env: { AGENT_SCOPE: 'apps/api' },
    })
    assert.equal(r.status, 1, `AGENT_SCOPE 越界应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /非本 agent 范围|AGENT_SCOPE|越界|范围文件/)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('AGENT_SCOPE_OVERRIDE=1: 越界但强制推送 → push 成功 exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeCommit(work, 'apps/web/page.tsx', 'export const X = 1\n', 'feat: add web page')
    const r = runScript([], {
      cwd: work,
      env: { AGENT_SCOPE: 'apps/api', AGENT_SCOPE_OVERRIDE: '1' },
    })
    // 强制推送 → push 成功 → 验证 local == remote → exit 0
    assert.equal(
      r.status,
      0,
      `AGENT_SCOPE_OVERRIDE=1 + push 成功应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
    assert.match(r.stdout, /强制推送|FORCE|override/i)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── JSON 截断预检 ───────────────────────────────────────

test('JSON 截断: HEAD json 行数 < HEAD~1 × 50% 且减少 > 100 → exit 1', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // Commit 1:大 json(300 行),push 到 origin
    writeFileSync(join(work, 'data.json'), generateJsonLines(300))
    execSync('git add data.json', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    execSync('git commit -m "add large json"', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    execSync('git push origin main', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // Commit 2:截断 json(50 行)→ ahead
    writeFileSync(join(work, 'data.json'), generateJsonLines(50))
    execSync('git add data.json', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    execSync('git commit -m "truncate json"', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `JSON 截断应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /截断|完整性预检失败|truncat/i)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

test('AUTO_PUSH_CONFIRM=1: 跳过 JSON 截断预检 → push 成功 exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // Commit 1:大 json
    writeFileSync(join(work, 'data.json'), generateJsonLines(300))
    execSync('git add data.json', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    execSync('git commit -m "add large json"', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    execSync('git push origin main', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    // Commit 2:截断
    writeFileSync(join(work, 'data.json'), generateJsonLines(50))
    execSync('git add data.json', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    execSync('git commit -m "truncate json"', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const r = runScript([], {
      cwd: work,
      env: { AUTO_PUSH_CONFIRM: '1' },
    })
    assert.equal(
      r.status,
      0,
      `AUTO_PUSH_CONFIRM=1 + push 成功应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
    assert.match(r.stdout, /AUTO_PUSH_CONFIRM|跳过完整性预检|强制推送/i)
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── push 成功后验证 local == remote ─────────────────────

test('push 成功: ahead + 自动 push → exit 0 + local == remote', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeCommit(work, 'new-feature.txt', 'feature\n', 'feat: new feature')
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `ahead + push 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /push 成功|验证通过|local HEAD.*origin/)
    // 验证 local HEAD == origin/main
    const localHead = execSync('git rev-parse HEAD', {
      cwd: work,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    const remoteHead = execSync('git rev-parse origin/main', {
      cwd: work,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    assert.equal(localHead, remoteHead, 'push 后 local HEAD 应 == origin/main')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── partial-clone 预检(2026-09-23 立)─────────────────────
// 三条夹具:① 注入 partial 配置必拦;② 逃生舱必放行;③ 正常库必不误伤。
// 判据只看 stdout 是否含 partial-clone 文案 —— 单看 exit code 无法区分
// "预检拦下" 与 "ahead 仅检测失败",会产出自测夹具恒真的假绿。

// 三条夹具的同步推送由 runScript 默认注入 GUARD_ASYNC=0 保证(见文件上方注释),
// 故此处可直接断言"拦下 ⇒ 远端未含本地 commit"。
function forceRemove(dir) {
  rmScratch(dir)
}

function createAheadRepoWithPartialClone() {
  const { work, origin } = createSyncedRepoWithOrigin()
  makeCommit(work, 'partial.txt', 'x\n', 'feat: ahead commit')
  return { work, origin }
}

test('partial-clone: promisor=true + ahead → exit 1 且点名修复配方(不放行推送)', () => {
  const { work, origin } = createAheadRepoWithPartialClone()
  try {
    execSync('git config --local remote.origin.promisor true', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    execSync('git config --local remote.origin.partialclonefilter blob:none', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const r = runScript([], { cwd: work })
    assert.equal(
      r.status,
      1,
      `partial-clone 应被预检拦下 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
    assert.match(r.stdout, /partial-clone/)
    assert.match(r.stdout, /fetch --refetch/)
    assert.match(r.stdout, /GUARD_SKIP_PARTIAL_CLONE_CHECK/)
    // 关键反证:预检拦下后本地 commit 绝不能被推上远端
    const localHead = execSync('git rev-parse HEAD', {
      cwd: work,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    const remoteHead = execSync('git rev-parse origin/main', {
      cwd: work,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    assert.notEqual(localHead, remoteHead, '预检生效后远端不应已包含本地 ahead commit')
  } finally {
    forceRemove(work)
    forceRemove(origin)
  }
})

test('partial-clone 逃生舱: GUARD_SKIP_PARTIAL_CLONE_CHECK=1 → 预检让位,推送照旧成功', () => {
  const { work, origin } = createAheadRepoWithPartialClone()
  try {
    execSync('git config --local remote.origin.promisor true', {
      cwd: work,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const r = runScript([], { cwd: work, env: { GUARD_SKIP_PARTIAL_CLONE_CHECK: '1' } })
    assert.doesNotMatch(r.stdout, /partial-clone/, '逃生舱生效后不应再出现预检文案')
    assert.equal(
      r.status,
      0,
      `逃生舱应让主流程继续并推送成功,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
  } finally {
    forceRemove(work)
    forceRemove(origin)
  }
})

test('partial-clone 不误伤: 正常库(无 promisor/filter)+ ahead → 无预检文案且推送成功', () => {
  const { work, origin } = createAheadRepoWithPartialClone()
  try {
    const r = runScript([], { cwd: work })
    assert.doesNotMatch(r.stdout, /partial-clone/, '正常库不得命中 partial-clone 预检')
    assert.equal(r.status, 0, `正常 ahead 推送应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    const localHead = execSync('git rev-parse HEAD', {
      cwd: work,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    const remoteHead = execSync('git rev-parse origin/main', {
      cwd: work,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    assert.equal(localHead, remoteHead, '同步推送后 local HEAD 应 == origin/main')
  } finally {
    forceRemove(work)
    forceRemove(origin)
  }
})

// ─── HUSKY_SKIP_PUSH 不得被异步分叉绕过(2026-09-23 立)──────
// AGENTS.md §20 把 HUSKY_SKIP_PUSH=1 定义为"仅检测不推送"逃生舱,但 guard 的
// 异步分叉原先排在 skipPush 判断之前 → 逃生舱照样 spawn worker 真推送。
// 本条必须显式 GUARD_ASYNC='1' 覆盖 runScript 的同步默认值,否则同步模式本身
// 就不会写 running 状态,断言会恒真(测不到修复)。
test('skipPush 语义: HUSKY_SKIP_PUSH=1 优先于异步分叉 → 不写 running 状态(未派推送)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeCommit(work, 'skip.txt', 'x\n', 'feat: ahead commit for skipPush')
    const r = runScript([], { cwd: work, env: { GUARD_ASYNC: '1', HUSKY_SKIP_PUSH: '1' } })
    assert.equal(r.status, 1, `skipPush + ahead 应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /跳过 push|仅检测/)
    const stateFile = join(work, '.workbuddy', 'push-state.json')
    if (existsSync(stateFile)) {
      const st = JSON.parse(readFileSync(stateFile, 'utf8'))
      assert.notEqual(
        st.status,
        'running',
        `skipPush 下绝不能留下 running(那意味着后台真在推):${JSON.stringify(st)}`,
      )
    }
    // 且远端确实没被推动
    const localHead = execSync('git rev-parse HEAD', {
      cwd: work,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    const remoteHead = execSync('git rev-parse origin/main', {
      cwd: work,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    assert.notEqual(localHead, remoteHead, 'skipPush 生效时远端不应含本地 commit')
  } finally {
    forceRemove(work)
    forceRemove(origin)
  }
})
// ══════════════════════════════════════════════════════════════════════
// 2026-09-26:push 失败分诊(修的是「任何 exit 1 都当 pre-push hook 阻塞
// → --no-verify 再推一趟」这一条会把推送质量门整条绕开的误判)。
// 判据本体在 scripts/lib/push-attempt-triage.mjs —— 该文件顶层就是 CLI 且没有
// §22d 的 isDirectRun 守卫(import 就会真跑一趟推送),所以判据被抽到 lib,
// 与 merge-live-doc → lib/live-doc-similarity 是同一条路子。
// ══════════════════════════════════════════════════════════════════════

// 特征串一律**逐字取自真实产出者**(§22c:镜像测试只复读实现就是复读机):
//   · NFF_STDERR ← deploy-loop.log / git-push-guard-async.log 里的实测形态
//   · HOOK_SUMMARY_STDERR ← scripts/guardian-runner.mjs(:3873/:3877)+ .husky/pre-push(:101)
//   · SECRET_SCAN_STDERR ← GitHub push protection 的远端回显
const NFF_STDERR = [
  'To https://github.com/example/repo.git',
  ' ! [rejected]        main -> main (non-fast-forward)',
  "error: failed to push some refs to 'https://github.com/example/repo.git'",
  'hint: Updates were rejected because the tip of your current branch is behind',
  'hint: its remote counterpart. If you want to integrate the remote changes,',
].join('\n')

const HOOK_SUMMARY_STDERR = [
  '🛡️ 守门脚本批量检查汇总',
  '  总检查数: 152(已执行 152)',
  '🚫 1 道 blocking 门失败 —— 本轮已跑完全部 152 项,未提前中止:',
  '   · [16] staged-typecheck',
  '     单独复现:node scripts/check-staged-typecheck.mjs --staged',
  '❌ push 门校验失败,推送已阻止(完整日志: .workbuddy/hook-logs/pre-push-gate.log)',
  "error: failed to push some refs to 'https://github.com/example/repo.git'",
].join('\n')

const SECRET_SCAN_STDERR = [
  'To https://github.com/example/repo.git',
  ' ! [remote rejected] main -> main (push declined due to repository rule violations)',
  'error: failed to push some refs',
].join('\n')

/** 凭据不可得的真实回显(逐字取自 .workbuddy/git-push-guard-async.log 2026-09-27 的失败块)。 */
const AUTH_UNAVAILABLE_STDERR = [
  'bash: line 1: /dev/tty: No such device or address',
  'error: failed to execute prompt script (exit code 1)',
  "fatal: could not read Username for 'https://github.com': No such file or directory",
].join('\n')

/** 每个导出的 kind 都必须有一条**真命中它**的输入 —— 名单不得是死表(守门 120 那一型)。 */
/**
 * 分支保护拒收的**真实回显**(2026-09-27 17:2x 逐字取自 .workbuddy/git-push-guard-async.log:8533 起)。
 * 留着它是因为这一型的全部难点都在"同一段文本里同时出现 `[remote rejected]`"——
 * 旧分诊按那个特征判成并发分叉,于是每个会话去跑 `git-sync-converge.mjs`(3 轮 × 全量门)
 * 而收敛器修不了一个仓库设置。**夹具必须用被审面的真实原文**,自造文本只会让这条锁跟着判据一起漂(§22c)。
 */
const PROTECTED_BRANCH_STDERR = [
  'remote: error: GH006: Protected branch update failed for refs/heads/main.        ',
  'remote: ',
  'remote: - Required status check "CI / lint-typecheck-test (pull_request)" is expected.        ',
  "To https://github.com/IHUI-INF-AI/IHUI-AI.git",
  ' ! [remote rejected]       main -> main (protected branch hook declined)',
  "error: failed to push some refs to 'https://github.com/IHUI-INF-AI/IHUI-AI.git'",
  '',
].join('\n')

/**
 * 远端 ref 竞态的**真实回显**(2026-09-28 05:23Z / 06:2xZ 两次实测,逐字取自 git 与远端输出)。
 * 难点全在"同一段里同时出现旁路通知与 `Required status check`":管理员有权直推时,GitHub 打的
 * `Bypassed rule violations` 两行是**旁路成功**的通知,而这一趟真正的死因是下面那句 CAS 锁失败
 * (别的会话同秒推了)。旧判序让 `Required status check` 先命中 ⇒ 出路写成"去改仓库设置/走 PR",
 * 方向完全反了。夹具用真原文,不用自造文本(§22c)。
 */
const REMOTE_REF_RACE_STDERR = [
  'remote: Bypassed rule violations for refs/heads/main:        ',
  'remote: ',
  'remote: - Required status check "CI / lint-typecheck-test (push)" is expected.        ',
  'To https://github.com/IHUI-INF-AI/IHUI-AI.git',
  " ! [remote rejected]       main -> main (cannot lock ref 'refs/heads/main': is at 6b8cd0f6aa11 but expected c12612dc9f02)",
  "error: failed to push some refs to 'https://github.com/IHUI-INF-AI/IHUI-AI.git'",
].join('\n')

const FIXTURES_BY_KIND = {
  'pushed-ok': { status: 0, stdout: '   1111111..2222222  main -> main\n' },
  'up-to-date': { status: 0, stdout: 'Everything up-to-date\n', remoteEqualsLocal: true },
  'remote-ref-race': { status: 1, stderr: REMOTE_REF_RACE_STDERR },
  'protected-branch': { status: 1, stderr: PROTECTED_BRANCH_STDERR },
  'non-fast-forward': { status: 1, stderr: NFF_STDERR },
  'secret-scan-blocked': { status: 1, stderr: SECRET_SCAN_STDERR },
  'credentials-unavailable': { status: 128, stderr: AUTH_UNAVAILABLE_STDERR },
  'hook-failed': { status: 1, stderr: HOOK_SUMMARY_STDERR },
  other: {
    status: 1,
    stderr: 'fatal: unable to access https://example.com: Could not resolve host',
  },
}

test('分诊:每个 PUSH_TRIAGE_KINDS 成员都有命中它的输入(死表即红)', () => {
  for (const kind of PUSH_TRIAGE_KINDS) {
    const fx = FIXTURES_BY_KIND[kind]
    assert.ok(fx, `夹具表漏了 kind=${kind}(名单加了成员却没有正向证明)`)
    assert.equal(triagePushAttempt(fx).kind, kind, `kind=${kind} 的夹具必须被判成该 kind`)
  }
  const extra = Object.keys(FIXTURES_BY_KIND).filter((k) => !PUSH_TRIAGE_KINDS.includes(k))
  assert.deepEqual(extra, [], `夹具表里出现了封闭集之外的 kind:${extra.join(',')}`)
})

test('分诊·成对:non-fast-forward 必判分叉,且**绝不**产生 --no-verify 计划', () => {
  const v = triagePushAttempt(FIXTURES_BY_KIND['non-fast-forward'])
  assert.equal(v.kind, 'non-fast-forward')
  assert.equal(v.allowNoVerifyRetry, false, '分叉绝不跳门 —— 这是本票立项目的')
  assert.equal(v.allowHookRetry, false, '分叉也不该再跑一趟 270s 的门')
  assert.equal(v.terminalStatus, 'diverged')
  assert.equal(v.nextCommand, CONVERGE_COMMAND, '出路必须是 §5b 规定的唯一收敛入口')
  // 反向对照:同一份文本里若真含钩子痕迹,也不许被"分叉"吃掉顺序(先 secret-scan、再分叉)
  const mixed = triagePushAttempt({ status: 1, stderr: `${HOOK_SUMMARY_STDERR}\n${NFF_STDERR}` })
  assert.equal(mixed.kind, 'non-fast-forward', '两型同现时按远端裁定优先,不得被洗成"可跳门"')
})

test('分诊·成对:分支保护不得被误标成并发分叉,且出路不得指向收敛器(本次修复的全部理由)', () => {
  const v = triagePushAttempt(FIXTURES_BY_KIND['protected-branch'])
  assert.equal(v.kind, 'protected-branch', `真实 GH006 回显必须落在这一档。实得:${v.kind}`)
  assert.notEqual(v.kind, 'non-fast-forward', '同一段文本里的 [remote rejected] 不得把它判成分叉')
  assert.equal(v.terminalStatus, 'failed', '本地没错,落 failed 让下一次 guard 自动重试,不伪装成"推出去了"')
  assert.notEqual(v.nextCommand, CONVERGE_COMMAND, '出路指向收敛器就是引人到死路上反复跑(它修不了仓库设置)')
  assert.equal(v.allowNoVerifyRetry, false, '--no-verify 只跳本地钩子,改变不了服务器侧策略')
  assert.equal(v.allowHookRetry, false, '再跑一趟 270s 的门也仍然被策略拒收')
  // 反向对照:真并发分叉仍必须走 converger —— 本档不得把两类合并
  const nff = triagePushAttempt(FIXTURES_BY_KIND['non-fast-forward'])
  assert.equal(nff.kind, 'non-fast-forward')
  assert.equal(nff.nextCommand, CONVERGE_COMMAND, '收紧分支保护之后,真分叉那一支的出路必须一字未动')
  // 顺序锁:两型同现时按服务器侧策略优先(策略在,推多少次都是 GH006)
  const mixed = triagePushAttempt({ status: 1, stderr: `${NFF_STDERR}\n${PROTECTED_BRANCH_STDERR}` })
  assert.equal(mixed.kind, 'protected-branch', '策略拒收优先于分叉,否则修复了策略之后仍然一路报"去收敛"')
})

/**
 * 2026-09-28:竞态 / 策略 / 分叉 三档必须**互不顶结论**(本票的核心红线 = "不得合并两档")。
 * 竞态与策略的出路是相反的:一个"先取真值再重推、别动仓库设置",一个"动仓库设置或改走 PR"。
 * 判据本体与成对反证的完整一套住在 scripts/tests/push-attempt-triage.test.mjs;
 * 这里只锁"三档同现时的优先序",因为它决定 guard 实际会打印哪一条出路。
 */
test('分诊·成对:ref 锁竞态不得被误标成分支保护,也不得被并进分叉', () => {
  const v = triagePushAttempt(FIXTURES_BY_KIND['remote-ref-race'])
  assert.equal(v.kind, 'remote-ref-race', `真回显必须落在竞态档。实得:${v.kind}`)
  assert.notEqual(v.kind, 'protected-branch', '旁路通知里的 Required status check 不是拒收证据')
  assert.notEqual(
    v.kind,
    'non-fast-forward',
    'CAS 没抢到 ≠ 两边各走各的,把人赶去收敛器同样是错方向',
  )
  assert.notEqual(v.nextCommand, CONVERGE_COMMAND, '竞态的第一步是取网络真值,不是收敛')
  assert.equal(v.allowNoVerifyRetry, false, '与质量门无关:竞态绝不产生 --no-verify 计划')
  assert.equal(v.allowHookRetry, false, '再跑一趟 270s 的门也仍然抢不到那个 ref')
  assert.equal(
    v.terminalStatus,
    'failed',
    '通道没坏 ⇒ 落 failed 让下一次 guard 重试,不冒充 diverged',
  )
  // 反向对照 1:纯策略拒收仍必须留在策略档(竞态档不得把它吃掉)
  assert.equal(triagePushAttempt(FIXTURES_BY_KIND['protected-branch']).kind, 'protected-branch')
  // 反向对照 2:真分叉仍必须走 converger(既有语义一字未动)
  const nff = triagePushAttempt(FIXTURES_BY_KIND['non-fast-forward'])
  assert.equal(nff.kind, 'non-fast-forward')
  assert.equal(nff.nextCommand, CONVERGE_COMMAND)
  // 反向对照 3:三型同现时按"最具体者胜"——git 自己的 CAS 原话排在最前
  const allThree = triagePushAttempt({
    status: 1,
    stderr: `${NFF_STDERR}\n${PROTECTED_BRANCH_STDERR}\n${REMOTE_REF_RACE_STDERR}`,
  })
  assert.equal(allThree.kind, 'remote-ref-race', '判序:竞态必须先于策略与分叉命中')
})

test('分诊·成对:真守门批汇总必判 hook-failed 且保留原重试链', () => {
  const v = triagePushAttempt(FIXTURES_BY_KIND['hook-failed'])
  assert.equal(v.kind, 'hook-failed')
  assert.equal(v.allowHookRetry, true, 'exit 75 中断链(§5b ⑤)不许被本次修复堵死')
  assert.equal(v.allowNoVerifyRetry, true, '真钩子失败仍按用户规则 --no-verify 兜底')
  assert.equal(v.terminalStatus, null, '钩子档不替验证段落终态')
})

test('分诊·成对:Everything up-to-date 只在验证确实相等时才配 done', () => {
  const ok = triagePushAttempt({
    status: 0,
    stdout: 'Everything up-to-date',
    remoteEqualsLocal: true,
  })
  assert.equal(ok.kind, 'up-to-date')
  assert.equal(ok.pushedNothing, true)
  assert.equal(ok.terminalStatus, 'done')
  const bad = triagePushAttempt({
    status: 0,
    stdout: 'Everything up-to-date',
    remoteEqualsLocal: false,
  })
  assert.equal(bad.terminalStatus, 'failed', '什么都没推 + 验证不等 ⇒ 不得记成功')
  const unknown = triagePushAttempt({ status: 0, stdout: 'Everything up-to-date' })
  assert.equal(unknown.terminalStatus, 'failed', '验证未判定 ⇒ 不得记成功(未判定 ≠ 通过)')
})

test('分诊·成对:secret-scan 不得被并进 hook-failed;other 保持改动前行为', () => {
  const s = triagePushAttempt(FIXTURES_BY_KIND['secret-scan-blocked'])
  assert.equal(s.kind, 'secret-scan-blocked')
  assert.equal(s.allowNoVerifyRetry, false, '--no-verify 关不掉服务器侧规则,重试必然白跑')
  const o = triagePushAttempt(FIXTURES_BY_KIND.other)
  assert.equal(o.kind, 'other')
  assert.equal(o.allowHookRetry, true, '认不出的一律落 other = 行为与改动前逐字相同')
  assert.equal(o.allowNoVerifyRetry, true)
  const empty = triagePushAttempt({ status: 1, stdout: '', stderr: '' })
  assert.equal(empty.kind, 'other', '空输出不得被猜成分叉或钩子(宁窄不误)')
})

test('分诊·成对:凭据不可得的 git 原话必判 credentials-unavailable;别的 128 仍落 other', () => {
  // 正向:逐字取自 git-push-guard-async.log 的回显(此前被报成"分诊=other — 无可辨认特征")
  const v = triagePushAttempt({ status: 128, stderr: AUTH_UNAVAILABLE_STDERR })
  assert.equal(v.kind, 'credentials-unavailable')
  assert.match(
    v.why,
    /could not read Username/,
    'why 必须点出据以分类的 git 原话特征,便于复核分诊对不对',
  )
  assert.match(v.nextCommand ?? '', /check-credential-health/, '出路必须点名凭据巡检入口,不得空着')
  // 另一形态(GIT_TERMINAL_PROMPT=0 时的尾串不同,前段特征相同)
  assert.equal(
    triagePushAttempt({
      status: 128,
      stderr: "fatal: could not read Username for 'https://github.com': terminal prompts disabled",
    }).kind,
    'credentials-unavailable',
  )
  // 重试策略与退出码**不得**被这一档改变(与 other 同旗 —— 本票只改分类与出路)
  assert.equal(v.allowHookRetry, true, 'allowHookRetry 必须与 other 相同,push-gate 链不动')
  assert.equal(v.allowNoVerifyRetry, true, 'allowNoVerifyRetry 必须与 other 相同')
  assert.equal(v.terminalStatus, null, '终态仍由验证段落,分诊不越权')
  // 反向成对:同为 exit 128 但无凭据特征的失败(网络断)必须仍落 other
  const net = triagePushAttempt({
    status: 128,
    stderr: 'fatal: unable to access https://github.com/: Failed to connect to 127.0.0.1 port 7897',
  })
  assert.equal(net.kind, 'other', '认不出的一律 other —— 新档不得宽到把网络错也吃掉')
  // 反向成对 2:真分叉里混进凭据字样也不得被凭据档抢走顺序(secret→nff 在前)
  const mixed = triagePushAttempt({
    status: 1,
    stderr: `${NFF_STDERR}\n${AUTH_UNAVAILABLE_STDERR}`,
  })
  assert.equal(mixed.kind, 'non-fast-forward', '分类优先级(远端裁定在前)不得被新档打乱')
  // guard 侧:失败分支必须真的为本档产出出路文案(判据在、没人打印 = 没有,守门 70/76 同型)
  assert.match(
    GUARD_SRC,
    /credentials-unavailable/,
    'guard 未对 credentials-unavailable 打印处置文案 ⇒ 分类加了没人喊出路',
  )
})

test('装车反向锁:guard 必须真的调用分诊,且 --no-verify 只活在受分诊放行的分支里', () => {
  // 本仓最高频失效型:函数在、判据过、主流程没用它(守门 102 的 GA5/GA6 同一教训)。
  assert.match(
    GUARD_SRC,
    /from '\.\/lib\/push-attempt-triage\.mjs'/,
    'guard 未引用分诊模块 ⇒ 判据失明',
  )
  assert.ok(
    GUARD_SRC.includes('triagePushAttempt('),
    'guard 里没有 triagePushAttempt( 调用 ⇒ 分诊被摘线,门又会一路绿灯',
  )
  // 跳门那一趟必须被 allowNoVerifyRetry 罩住(旧形态是无条件的)。
  // 用"闸门语句原句 + pushOnce(true) 只出现一次"这种结构锁,不用跨度正则 ——
  // 跨度正则的容差会随相邻日志文案变长而假红(本枚第一次跑就是这样)。
  assert.ok(
    GUARD_SRC.includes('if (pushResult.status !== 0 && attempt.allowNoVerifyRetry) {'),
    '--no-verify 那一趟不再被分诊放行条件罩住 ⇒ 本次修复被回退',
  )
  assert.equal(
    (GUARD_SRC.match(/pushOnce\(true\)/g) || []).length,
    1,
    'pushOnce(true)(= 唯一一趟跳门推送)必须恰好出现一次;出现两次就是有第二道绕过分诊的出口',
  )
  assert.doesNotMatch(
    GUARD_SRC,
    /spawnSync\('git',\s*\['push',\s*'--no-verify'/,
    '不得再出现"裸写一趟 --no-verify push"(绕过 pushOnce 就等于绕过 maxBuffer/回显/分诊)',
  )
  assert.match(GUARD_SRC, /writePushState\('diverged'/, '分叉必须落具名终态,不能只打一行日志')
})

test('装车反向锁:push-state 新增的 diverged 必须被三处读取方各自认下', () => {
  const hits = {}
  for (const [name, p] of Object.entries(READER_PATHS)) hits[name] = readFileSync(p, 'utf8')
  assert.match(
    hits['check-push-sync.mjs'],
    /st\.status === 'diverged'/,
    'check-push-sync 不认识 diverged ⇒ 会落到"已过期"的错文案',
  )
  assert.match(
    hits['git-push-converge.mjs'],
    /status === 'diverged'/,
    'converge 不认识 diverged ⇒ 只读核验会把分叉报成普通 DIVERGED',
  )
  assert.match(
    hits['git-sync-converge.mjs'],
    /s\.status === 'diverged'/,
    'sync-converge 的终态集合漏了 diverged ⇒ 每轮白等 8 分钟才判 timeout',
  )
  // 向后兼容:三处都不得把"不认识的值"读成已推成功(fallthrough 一律是拦/未判定)
  assert.match(
    hits['check-push-sync.mjs'],
    /return \{ pass: false, why: `push-state status=/,
    '未知态必须回到阻塞,不得默认放行',
  )
})

test('装车锁:死 worker 的终态自愈必须带来源落盘(2026-09-26 守门 29 假红的真凶)', () => {
  // 拦的是这一型:那记 failed 写的是**死 worker 的 headSha**,与本次提交没有因果关系
  // (实测累计 353 次),却不带任何来源标记 ⇒ 下游只能把它读成"这次推送失败了"⇒ 每次提交被逼跳门。
  assert.match(
    GUARD_SRC,
    /writePushState\('failed',\s*existingState\.headSha,\s*\{[\s\S]{0,200}?kind:\s*'dead-worker-self-heal'/,
    '死 worker 自愈写 failed 时必须落 kind,否则 check-push-sync 分不清"真失败"与"别人没写完终态"',
  )
})

// ─── 端到端①:真 non-fast-forward ⇒ 绝不跳门、远端 tip 必须一动没动 ─────────
/** 本票新增夹具的 git 派生统一出口:windowsHide(§5b「🪟 后台进程禁弹窗」)+ timeout。 */
function sh(cmd, cwd) {
  return execSync(cmd, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
  })
}

function setGitIdentity(dir) {
  for (const [k, v] of [
    ['user.email', 't@e.co'],
    ['user.name', 't'],
    ['commit.gpgsign', 'false'],
    ['protocol.file.allow', 'always'],
  ])
    sh(`git config --local ${k} "${v}"`, dir)
}

test('e2e:真分叉(远端被并发会话推进)→ exit 1 + 点名 converge + 远端 tip 未变', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  const peer = mkScratch('ihui-peer-')
  try {
    // 本地攒一枚自己的 commit
    makeCommit(work, 'mine.txt', 'mine\n', 'feat: my commit')
    const localSha = sh('git rev-parse HEAD', work).trim()
    // 「另一个会话」clone 同一个 origin、提交并先推上去 ⇒ 远端领先且与本侧分叉
    const originUrl = origin.replace(/\\/g, '/')
    sh(`git clone "${originUrl}" "${peer.replace(/\\/g, '/')}"`, process.cwd())
    setGitIdentity(peer)
    makeCommit(peer, 'peer.txt', 'peer\n', 'feat: another session')
    sh('git push origin main', peer)
    const remoteSha = sh('git rev-parse refs/heads/main', peer).trim()
    assert.notEqual(remoteSha, localSha, '夹具没造成分叉,后面的断言会恒真')
    // ⚠️ 夹具必须 fetch:本机是**多会话共享同一个 .git**,远端新提交的对象在本地本就存在,
    // 于是 guard 的 `rev-list remote...HEAD` 量得出 ahead/behind 都 >0,才会真走到 push 那一趟
    // (deploy-loop.log 里的实测形态)。一个从没 fetch 过的孤立仓库会在半路撞上
    // "本地无 ahead commit"那条早退(它把未取回的远端对象读成异常态)—— 那是本票**没覆盖**
    // 的一型,已在交付报告里如实登记,不在这里假装测过。
    sh('git fetch -q origin main', work)

    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `分叉应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /non-fast-forward/, '应点名远端拒收的形态')
    assert.match(r.stdout, /git-sync-converge\.mjs/, '必须给出 §5b 规定的唯一出路')
    // 关键反证(本票存在的理由):绝不允许出现跳门那一趟与"成功"字样
    assert.doesNotMatch(r.stdout, /--no-verify 重试成功/, '分叉型绝不能走 --no-verify')
    assert.doesNotMatch(r.stdout, /push 成功 \+ 验证通过/, '什么都没推成功却报成功 = 合格证造假')
    assert.doesNotMatch(
      r.stdout,
      /按用户规则"hook 失败因其他 agent 代码/,
      '错归因文案不得再出现在这一型',
    )
    // 且远端确实一动没动(只有 converge 能改它)
    const remoteAfter = sh('git ls-remote origin refs/heads/main', work).split('\t')[0].trim()
    assert.equal(remoteAfter, remoteSha, 'guard 在分叉下不得改动远端 tip(未推任何东西)')
    assert.equal(
      sh('git rev-parse HEAD', work).trim(),
      localSha,
      'guard 也不得在本链路里替人 fetch/merge(那会与别的会话竞态)',
    )
    const st = JSON.parse(readFileSync(join(work, '.workbuddy', 'push-state.json'), 'utf8'))
    assert.equal(st.status, 'diverged', `应落具名终态 diverged:${JSON.stringify(st)}`)
    assert.equal(st.headSha, localSha)
    assert.ok(
      String(st.nextCommand).includes('git-sync-converge.mjs'),
      '状态里要带出路,converge 才接得住',
    )
  } finally {
    rmScratch(peer)
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 端到端②:反向对照 —— 真钩子失败仍须走原有 --no-verify 兜底 ───────────
test('e2e:真 pre-push 钩子失败 → 原有"带 hook 重试 → --no-verify 兜底"链没被堵死', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const hooksDir = join(work, '.githooks')
    mkdirSync(hooksDir, { recursive: true })
    // 逐字复现真实产出者的回显(sh + exit 1;本机实测 sh 形态钩子会被执行)
    writeFileSync(
      join(hooksDir, 'pre-push'),
      [
        '#!/bin/sh',
        `printf '%s\\n' '🚫 1 道 blocking 门失败 —— 本轮已跑完全部 152 项,未提前中止:' 1>&2`,
        "printf '%s\\n' '     单独复现:node scripts/check-staged-typecheck.mjs --staged' 1>&2",
        "printf '%s\\n' '❌ push 门校验失败,推送已阻止' 1>&2",
        'exit 1',
        '',
      ].join('\n'),
      { mode: 0o755 },
    )
    sh(`git config --local core.hooksPath "${hooksDir.replace(/\\/g, '/')}"`, work)
    makeCommit(work, 'hooked.txt', 'x\n', 'feat: commit behind a failing hook')

    const r = runScript([], { cwd: work })
    assert.match(r.stdout, /分诊=hook-failed/, `应被分诊成 hook-failed:${r.stdout}`)
    assert.match(
      r.stdout,
      /--no-verify 重试成功/,
      '真钩子失败必须仍按用户规则兜底(修复不得堵死这条路)',
    )
    assert.equal(r.status, 0, `兜底成功应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    const localSha = sh('git rev-parse HEAD', work).trim()
    const remoteSha = sh('git ls-remote origin refs/heads/main', work).split('\t')[0].trim()
    assert.equal(remoteSha, localSha, '兜底那一趟要真把 commit 推上去')
    const st = JSON.parse(readFileSync(join(work, '.workbuddy', 'push-state.json'), 'utf8'))
    assert.equal(st.status, 'done')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})

// ─── 端到端③:重试那一趟回显 Everything up-to-date ⇒ 不得报"push 成功"(事故第二段) ───
// 事故里那一段是:首趟被钩子挡住 → --no-verify 重试 → 远端其实已被并发落地(回显
// Everything up-to-date)→ guard 仍打 `✅ push 成功 + 验证通过`。
// 夹具做法:pre-push 钩子**自己先把同一枚 commit 推上去**(带 --no-verify,不递归),
// 然后按真实版式报"门失败"并 exit 1 ⇒ 首趟失败、重试那一趟必然是"什么都没推"。
test('e2e:--no-verify 重试回显 Everything up-to-date → 措辞喊"未推送任何东西",不冒充推送成功', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const hooksDir = join(work, '.githooks')
    mkdirSync(hooksDir, { recursive: true })
    writeFileSync(
      join(hooksDir, 'pre-push'),
      [
        '#!/bin/sh',
        '# 先替"并发会话"把这枚 commit 落地(内部 --no-verify ⇒ 不再触发本钩子)',
        'git push --no-verify origin HEAD:refs/heads/main 1>&2',
        `printf '%s\\n' '🚫 1 道 blocking 门失败 —— 本轮已跑完全部 152 项,未提前中止:' 1>&2`,
        "printf '%s\\n' '❌ push 门校验失败,推送已阻止' 1>&2",
        'exit 1',
        '',
      ].join('\n'),
      { mode: 0o755 },
    )
    sh(`git config --local core.hooksPath "${hooksDir.replace(/\\/g, '/')}"`, work)
    makeCommit(work, 'raced.txt', 'x\n', 'feat: commit raced by another session')
    const localSha = sh('git rev-parse HEAD', work).trim()

    const r = runScript([], { cwd: work })
    assert.match(r.stdout, /Everything up-to-date/, `夹具应造出"什么都没推":${r.stdout}`)
    assert.doesNotMatch(
      r.stdout,
      /push 成功 \+ 验证通过/,
      '什么都没推却报"push 成功"= 本票要修的第二处错(合格证造假)',
    )
    assert.match(r.stdout, /未推送任何东西/, '应如实说"本次未推送任何东西"')
    // 这一格 local 确实 == remote(远端已含),所以 done 是有据的 —— 措辞对、终态也对
    assert.equal(r.status, 0, `验证相等应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    const remoteSha = sh('git ls-remote origin refs/heads/main', work).split('\t')[0].trim()
    assert.equal(remoteSha, localSha, '远端 tip 应确实包含本地 commit(才配得上 done)')
    const st = JSON.parse(readFileSync(join(work, '.workbuddy', 'push-state.json'), 'utf8'))
    assert.equal(st.status, 'done')
    assert.equal(st.pushedNothing, true, '状态里要留"什么都没推"的痕迹,否则下一轮又读成推送成功')
  } finally {
    rmScratch(work)
    rmScratch(origin)
  }
})
