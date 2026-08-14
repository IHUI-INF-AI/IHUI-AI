import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-messages-dev-restart.mjs')
const WEB_PORT = 8801

// ─── 端口 8801 可用性检测(决定 dev server 分支测试是否可跑) ───
// 脚本通过 netstat/lsof 检测 8801 端口是否有 LISTENING 进程;
// 若测试机 8801 端口已被占用(如真实 dev server 在跑),依赖"未在跑"分支的测试需跳过。
function checkPortFree(port) {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port)
  })
}

function bindPort(port) {
  return new Promise((resolve) => {
    const srv = createServer()
    srv.once('error', () => resolve(null))
    srv.once('listening', () => resolve(srv))
    srv.listen(port)
  })
}

function closeServer(srv) {
  return new Promise((resolve) => srv.close(() => resolve()))
}

let port8801Free = false
before(async () => {
  port8801Free = await checkPortFree(WEB_PORT)
})

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-msg-restart-'))
  const opt = { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  spawnSync('git', ['init', '-b', 'main'], opt)
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], opt)
  spawnSync('git', ['config', 'user.name', 'Test'], opt)
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], opt)
  writeFileSync(join(dir, 'README.md'), '# init\n')
  spawnSync('git', ['add', 'README.md'], opt)
  spawnSync('git', ['commit', '-q', '-m', 'init'], opt)
  return dir
}

// ─── 辅助:创建文件并 stage(不 commit) ────────────────────
function stageFiles(dir, files) {
  for (const f of files) {
    const fullPath = join(dir, f)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, `content for ${f}\n`)
    execSync(`git add "${f}"`, { cwd: dir, stdio: 'pipe' })
  }
}

// ─── 辅助:创建 apps/web/messages 目录(使 existsSync 通过) ─
function ensureMessagesDir(dir) {
  mkdirSync(join(dir, 'apps/web/messages'), { recursive: true })
}

// ─── 辅助:运行 check-messages-dev-restart.mjs ─────────────
// 脚本用 console.log → 输出走 stdout;stderr 应为空
function runScript(opts = {}) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ═══════════════════════════════════════════════════════════
// messages 目录不存在分支(existsSync 检查)
// ═══════════════════════════════════════════════════════════

// ─── 1. 非 git: 非 git 仓库 + messages 目录不存在 → exit 0(目录不存在,跳过) ──
test('非 git: 非 git 仓库 + messages 目录不存在 → exit 0(目录不存在,跳过)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nongit-'))
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /目录不存在/)
    assert.match(r.stdout, /跳过/)
    assert.ok(!r.stdout.includes('检测到'), '目录不存在时不应检测 staged')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 非 git: 非 git 仓库 + messages 目录存在 → exit 0(无 messages 改动,跳过) ──
// getStagedMessagesFiles 在非 git 目录执行 git diff 抛错 → catch 返回 []
test('非 git: 非 git 仓库 + messages 目录存在 → exit 0(无 messages 改动,跳过)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nongit-'))
  try {
    ensureMessagesDir(dir)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. git: git 仓库无 messages 目录 → exit 0(目录不存在,跳过) ──────────────
test('git: git 仓库无 messages 目录 → exit 0(目录不存在,跳过)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /目录不存在/)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 无 messages JSON 改动分支(staged.length === 0)
// ═══════════════════════════════════════════════════════════

// ─── 4. git: git 仓库有 messages 目录,无 staged 文件 → exit 0(无改动,跳过) ──
test('git: git 仓库有 messages 目录,无 staged 文件 → exit 0(无改动,跳过)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.match(r.stdout, /跳过/)
    assert.ok(!r.stdout.includes('检测到'), '无 staged 不应触发检测')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. git: staged 非 messages 文件 → exit 0(无 messages 改动,跳过) ──────────
test('git: staged 非 messages 文件(apps/web/src/foo.ts)→ exit 0(无 messages 改动,跳过)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/src/foo.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.ok(!r.stdout.includes('检测到'), '非 messages 文件不应触发检测')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 边界:路径过滤规则(startsWith('apps/web/messages/') + endsWith('.json'))
// ═══════════════════════════════════════════════════════════

// ─── 6. 边界: staged .json 但不在 messages 目录 → exit 0(无 messages 改动) ────
test('边界: staged apps/web/other.json(不在 messages 目录)→ exit 0(无 messages 改动)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/other.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.ok(!r.stdout.includes('检测到'), '非 messages 目录的 .json 不应触发')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 边界: staged 在 messages 目录但非 .json → exit 0(无 messages 改动) ─────
test('边界: staged apps/web/messages/zh-CN.ts(非 .json)→ exit 0(无 messages 改动)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/zh-CN.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.ok(!r.stdout.includes('检测到'), '非 .json 文件不应触发')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. 边界: staged apps/web/messages-other/foo.json(前缀不匹配)→ exit 0 ──
// startsWith('apps/web/messages/') 不匹配 'apps/web/messages-other/'(无尾斜杠)
test('边界: staged apps/web/messages-other/foo.json(前缀不匹配)→ exit 0(无 messages 改动)', () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages-other/foo.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /无 messages JSON 改动/)
    assert.ok(!r.stdout.includes('检测到'), 'messages-other 不应匹配 messages/')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 边界: staged apps/web/messages/sub/foo.json(子目录,startsWith 匹配)→ 触发检测 ──
// startsWith('apps/web/messages/') 匹配子目录路径(脚本实际行为)
test('边界: staged apps/web/messages/sub/foo.json(子目录,startsWith 匹配)→ 触发检测', {
  skip: !port8801Free ? 'port 8801 被占用,跳过(dev server 可能正在跑)' : false,
}, () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/sub/foo.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /检测到 1 个 messages JSON 改动/)
    assert.match(r.stdout, /apps\/web\/messages\/sub\/foo\.json/)
    // 子目录文件也被检测到(startsWith 行为)
    assert.match(r.stdout, /dev server 未在跑|需要重启加载新翻译/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 有 messages JSON 改动 + dev server 未在跑(pass 路径)
// ═══════════════════════════════════════════════════════════

// ─── 10. git: staged 1 个 messages JSON(dev server 未跑)→ exit 0 + 检测到 1 个 + 无需重启 ──
test('git: staged 1 个 messages JSON(dev server 未跑)→ exit 0 + 检测到 1 个 + 无需重启', {
  skip: !port8801Free ? 'port 8801 被占用,跳过(dev server 可能正在跑)' : false,
}, () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/zh-CN.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /检测到 1 个 messages JSON 改动/)
    assert.match(r.stdout, /apps\/web\/messages\/zh-CN\.json/)
    assert.match(r.stdout, /dev server 未在跑/)
    assert.match(r.stdout, /无需重启/)
    assert.ok(!r.stdout.includes('需要重启加载新翻译'), 'dev server 未跑不应输出重启警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. git: staged 3 个 messages JSON(dev server 未跑)→ exit 0 + 检测到 3 个 + 列出文件 ──
test('git: staged 3 个 messages JSON(dev server 未跑)→ exit 0 + 检测到 3 个 + 列出文件', {
  skip: !port8801Free ? 'port 8801 被占用,跳过(dev server 可能正在跑)' : false,
}, () => {
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, [
      'apps/web/messages/zh-CN.json',
      'apps/web/messages/en.json',
      'apps/web/messages/ja.json',
    ])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /检测到 3 个 messages JSON 改动/)
    assert.match(r.stdout, /apps\/web\/messages\/zh-CN\.json/)
    assert.match(r.stdout, /apps\/web\/messages\/en\.json/)
    assert.match(r.stdout, /apps\/web\/messages\/ja\.json/)
    assert.match(r.stdout, /dev server 未在跑/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// dev server 在跑分支(warn-only,不阻塞 commit)
// ═══════════════════════════════════════════════════════════

// ─── 12. dev server 在跑: 绑定 8801 + staged messages JSON → exit 0 + 重启警告 ──
test('dev server 在跑: 绑定 8801 + staged messages JSON → exit 0 + 重启警告', async () => {
  const srv = await bindPort(WEB_PORT)
  if (!srv) {
    // port 8801 已被占用且无法绑定,跳过(不依赖外部占用者的状态)
    return
  }
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/zh-CN.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, 'warn-only 始终 exit 0')
    assert.match(r.stdout, /检测到 1 个 messages JSON 改动/)
    assert.match(r.stdout, /需要重启加载新翻译/)
    assert.ok(!r.stdout.includes('dev server 未在跑'), 'dev server 在跑时不应输出"未在跑"')
  } finally {
    rmSync(dir, { recursive: true, force: true })
    await closeServer(srv)
  }
})

// ─── 13. dev server 警告内容: 绑定 8801 + staged messages JSON → 验证警告关键词 ──
test('dev server 警告内容: 绑定 8801 + staged messages JSON → 验证警告关键词', async () => {
  const srv = await bindPort(WEB_PORT)
  if (!srv) {
    return
  }
  const dir = createTempRepo()
  try {
    ensureMessagesDir(dir)
    stageFiles(dir, ['apps/web/messages/en.json'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = r.stdout
    // 验证警告关键内容
    assert.match(out, /warn-only/, '应标明 warn-only')
    assert.match(out, /pnpm --filter @ihui\/web dev/, '应给出重启命令')
    assert.match(out, /历史教训/, '应提及历史教训')
    assert.match(out, /Ctrl\+C/, '应提示 Ctrl+C 杀进程')
    assert.match(out, /HMR 不会重新编译/, '应解释根因')
    assert.match(out, /不阻塞 commit/, '应声明不阻塞 commit')
  } finally {
    rmSync(dir, { recursive: true, force: true })
    await closeServer(srv)
  }
})
