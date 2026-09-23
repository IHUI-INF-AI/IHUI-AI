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

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'git-push-guard.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkScratch('ihui-push-')
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
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GUARD_ASYNC: '0', ...opts.env },
  })
}

// 辅助:在工作仓库中创建并 push 一个新 commit(使本地 ahead)
function makeCommit(dir, relPath, content, message) {
  if (relPath) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
    execSync(`git add "${relPath.replace(/\\/g, '/')}"`, { cwd: dir, stdio: 'pipe' })
  } else {
    execSync('git add -A', { cwd: dir, stdio: 'pipe' })
  }
  execSync(`git commit -m "${message}"`, { cwd: dir, stdio: 'pipe' })
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
    assert.ok(r.status === 2 || r.status === 0 || r.status === 1, `--help 不应 crash,实际 exit ${r.status}`)
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
    execSync('git push origin main', { cwd: work, stdio: 'pipe' })
    // reset --hard HEAD~1 使本地落后 origin
    execSync('git reset --hard HEAD~1', { cwd: work, stdio: 'pipe' })
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
    const headHash = execSync('git rev-parse HEAD', { cwd: work, encoding: 'utf8' }).trim()
    execSync(`git checkout ${headHash}`, { cwd: work, stdio: 'pipe' })
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
    assert.equal(r.status, 0, `AGENT_SCOPE_OVERRIDE=1 + push 成功应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
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
    execSync('git add data.json', { cwd: work, stdio: 'pipe' })
    execSync('git commit -m "add large json"', { cwd: work, stdio: 'pipe' })
    execSync('git push origin main', { cwd: work, stdio: 'pipe' })
    // Commit 2:截断 json(50 行)→ ahead
    writeFileSync(join(work, 'data.json'), generateJsonLines(50))
    execSync('git add data.json', { cwd: work, stdio: 'pipe' })
    execSync('git commit -m "truncate json"', { cwd: work, stdio: 'pipe' })
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
    execSync('git add data.json', { cwd: work, stdio: 'pipe' })
    execSync('git commit -m "add large json"', { cwd: work, stdio: 'pipe' })
    execSync('git push origin main', { cwd: work, stdio: 'pipe' })
    // Commit 2:截断
    writeFileSync(join(work, 'data.json'), generateJsonLines(50))
    execSync('git add data.json', { cwd: work, stdio: 'pipe' })
    execSync('git commit -m "truncate json"', { cwd: work, stdio: 'pipe' })
    const r = runScript([], {
      cwd: work,
      env: { AUTO_PUSH_CONFIRM: '1' },
    })
    assert.equal(r.status, 0, `AUTO_PUSH_CONFIRM=1 + push 成功应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
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
    const localHead = execSync('git rev-parse HEAD', { cwd: work, encoding: 'utf8' }).trim()
    const remoteHead = execSync('git rev-parse origin/main', { cwd: work, encoding: 'utf8' }).trim()
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
    execSync('git config --local remote.origin.promisor true', { cwd: work, stdio: 'pipe' })
    execSync('git config --local remote.origin.partialclonefilter blob:none', { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `partial-clone 应被预检拦下 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /partial-clone/)
    assert.match(r.stdout, /fetch --refetch/)
    assert.match(r.stdout, /GUARD_SKIP_PARTIAL_CLONE_CHECK/)
    // 关键反证:预检拦下后本地 commit 绝不能被推上远端
    const localHead = execSync('git rev-parse HEAD', { cwd: work, encoding: 'utf8' }).trim()
    const remoteHead = execSync('git rev-parse origin/main', { cwd: work, encoding: 'utf8' }).trim()
    assert.notEqual(localHead, remoteHead, '预检生效后远端不应已包含本地 ahead commit')
  } finally {
    forceRemove(work)
    forceRemove(origin)
  }
})

test('partial-clone 逃生舱: GUARD_SKIP_PARTIAL_CLONE_CHECK=1 → 预检让位,推送照旧成功', () => {
  const { work, origin } = createAheadRepoWithPartialClone()
  try {
    execSync('git config --local remote.origin.promisor true', { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work, env: { GUARD_SKIP_PARTIAL_CLONE_CHECK: '1' } })
    assert.doesNotMatch(r.stdout, /partial-clone/, '逃生舱生效后不应再出现预检文案')
    assert.equal(r.status, 0, `逃生舱应让主流程继续并推送成功,实际 ${r.status}\nstdout: ${r.stdout}`)
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
    const localHead = execSync('git rev-parse HEAD', { cwd: work, encoding: 'utf8' }).trim()
    const remoteHead = execSync('git rev-parse origin/main', { cwd: work, encoding: 'utf8' }).trim()
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
      assert.notEqual(st.status, 'running', `skipPush 下绝不能留下 running(那意味着后台真在推):${JSON.stringify(st)}`)
    }
    // 且远端确实没被推动
    const localHead = execSync('git rev-parse HEAD', { cwd: work, encoding: 'utf8' }).trim()
    const remoteHead = execSync('git rev-parse origin/main', { cwd: work, encoding: 'utf8' }).trim()
    assert.notEqual(localHead, remoteHead, 'skipPush 生效时远端不应含本地 commit')
  } finally {
    forceRemove(work)
    forceRemove(origin)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
