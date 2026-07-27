import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-port-registry.mjs')

// ============================================================
// 源脚本核心规则(scripts/check-port-registry.mjs)
// ============================================================
// - 守门规则:dev/宿主映射端口必须以 88 开头(88xx 段)
// - REGISTERED_PORTS:8801-8809 / 8810-8819 / 8820-8829 / 8830-8839 / 8841-8849
//   ⚠️ 8840 不在注册表中(88xx 但未注册 → 违规)
// - EXEMPT_PORTS:8080/8081/3000/8000/5432/6379/443/80/22 等(容器内部/CI/第三方)
// - EXEMPT_PATH_PATTERNS:docs/ / .github/workflows/ / apps/api/tests/ 等
// - warn-only:始终 exit 0,不阻塞 commit(通过 stdout 区分 ✅ / ⚠️)
// - 两种模式:默认(staged) / --all(git ls-files 全量 tracked)
// ============================================================

// ─── 辅助:创建临时 git 仓库(含 baseline commit) ───
// 注:始终写入 baseline README.md,保证 git commit 有内容可提交
function createTempGitRepo(files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-port-'))
  execSync('git init -b main', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  execSync('git config user.email "test@test.com"', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  execSync('git config user.name "test"', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  // baseline 文件(确保初始 commit 有内容)
  writeFileSync(join(dir, 'README.md'), '# test baseline\n')
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  execSync('git add -A', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  execSync('git commit -q -m init', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  return dir
}

// ─── 辅助:在 git 仓库中写入文件并 stage ───
function stageFile(repoDir, relPath, content) {
  const fullPath = join(repoDir, relPath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
  spawnSync('git', ['add', relPath], { cwd: repoDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
}

// ─── 辅助:运行 check-port-registry.mjs ───
function runScript(cwd, args = []) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── 辅助:断言通过(exit 0 + stdout 含 ✅ 无违规端口) ───
function assertPass(r) {
  assert.equal(r.status, 0, `应 exit 0,实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /✅.*无违规端口/, `stdout 应含 ✅ 无违规端口\nstdout: ${r.stdout}`)
}

// ─── 辅助:断言违规提醒(exit 0 warn-only + stdout 含 ⚠️ 提醒) ───
function assertWarn(r) {
  assert.equal(r.status, 0, `warn-only 应 exit 0,实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /⚠️.*端口注册表守门提醒/, `stdout 应含 ⚠️ 提醒\nstdout: ${r.stdout}`)
}

// ============================================================
// 检查 1:核心规则 —— 已注册 88xx 端口 → ✅ 无违规
// ============================================================

// ─── 1. 合法: localhost:8801(应用服务首位)→ ✅ 无违规 ───
test('合法: localhost:8801(已注册 88xx)→ ✅ 无违规', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/config.ts', `const API = 'http://localhost:8801/api'\n`)
    const r = runScript(dir, ['--all'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 合法: localhost:8849(蓝绿部署末位,注册表最后一项)→ ✅ ───
test('合法: localhost:8849(注册表末位)→ ✅ 无违规', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/blue-green.ts', `export const BLUE_GREEN_PORT = 8849\nconst url = 'http://localhost:8849'\n`)
    const r = runScript(dir, ['--all'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 2:核心规则 —— 豁免端口(容器内部/CI/第三方)→ ✅ 无违规
// ============================================================

// ─── 3. 合法: localhost:8080(Docker 容器内部端口)→ ✅ 无违规 ───
test('合法: localhost:8080(Docker 容器内部豁免)→ ✅ 无违规', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/api/docker-internal.ts', `const INTERNAL = 'http://localhost:8080/health'\n`)
    const r = runScript(dir, ['--all'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 合法: localhost:5432(PostgreSQL 容器内部)→ ✅ 无违规 ───
test('合法: localhost:5432(PostgreSQL 豁免)→ ✅ 无违规', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/api/db.ts', `export const DATABASE_URL = 'postgres://localhost:5432/ihui'\n`)
    const r = runScript(dir, ['--all'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 3:核心规则 —— 非 88xx 非豁免端口 → ⚠️ 违规
// ============================================================

// ─── 5. 违规: localhost:7777(非 88xx 非豁免)→ ⚠️ "非 88xx 端口" ───
test('违规: localhost:7777(非 88xx 非豁免)→ ⚠️ 非 88xx 端口', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/bad-port.ts', `const API = 'http://localhost:7777/api'\n`)
    const r = runScript(dir, ['--all'])
    assertWarn(r)
    assert.match(r.stdout, /7777/, `stdout 应含端口 7777\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /非 88xx 端口/, `stdout 应含"非 88xx 端口"原因\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 4:核心规则 —— 88xx 未注册端口 → ⚠️ 违规(区分两种原因)
// ============================================================

// ─── 6. 违规: localhost:8800(88xx 范围但未注册)→ ⚠️ "88xx 未在注册表中注册" ───
test('违规: localhost:8800(88xx 未注册)→ ⚠️ 88xx 未在注册表中注册', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/unregistered-88xx.ts', `const API = 'http://localhost:8800/api'\n`)
    const r = runScript(dir, ['--all'])
    assertWarn(r)
    assert.match(r.stdout, /8800/, `stdout 应含端口 8800\nstdout: ${r.stdout}`)
    // 88xx 未注册的 reason 文案与"非 88xx"不同,必须区分
    assert.match(r.stdout, /88xx.*未在注册表中注册/, `stdout 应含"88xx 未在注册表中注册"\nstdout: ${r.stdout}`)
    // 不应误报为"非 88xx 端口"
    assert.doesNotMatch(r.stdout, /非 88xx 端口 8800/, `不应误报为"非 88xx 端口"\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 违规: localhost:8899(88xx 范围末位但未注册)→ ⚠️ 违规 ───
test('违规: localhost:8899(88xx 末位未注册)→ ⚠️ 违规', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/edge-88xx.ts', `const API = 'http://localhost:8899/api'\n`)
    const r = runScript(dir, ['--all'])
    assertWarn(r)
    assert.match(r.stdout, /8899/, `stdout 应含端口 8899\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /88xx.*未在注册表中注册/, `stdout 应含"88xx 未在注册表中注册"\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 5:格式解析 —— 127.0.0.1:PORT 也应匹配
// ============================================================

// ─── 8. 鲁棒: 127.0.0.1:8801(IP 格式)→ 匹配,✅ 无违规 ───
test('鲁棒: 127.0.0.1:8801(IP 格式)→ 匹配,✅ 无违规', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/ip-format.ts', `const API = 'http://127.0.0.1:8801/api'\n`)
    const r = runScript(dir, ['--all'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 6:批量扫描 —— 单文件多端口引用全部报告
// ============================================================

// ─── 9. 批量: 单文件含 2 处违规端口(7777 + 8800)→ 全部报告 ───
test('批量: 单文件含 2 处违规端口(7777 + 8800)→ 全部报告', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(
      dir,
      'apps/web/multi-ports.ts',
      `const A = 'http://localhost:7777/a'\nconst B = 'http://localhost:8800/b'\n`,
    )
    const r = runScript(dir, ['--all'])
    assertWarn(r)
    assert.match(r.stdout, /7777/, `stdout 应含 7777\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /8800/, `stdout 应含 8800\nstdout: ${r.stdout}`)
    // 扫描统计应体现 2 处
    assert.match(r.stdout, /2\s+处端口引用/, `stdout 应含"2 处端口引用"\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 7:豁免路径 —— EXEMPT_PATH_PATTERNS 不扫描
// ============================================================

// ─── 10. 豁免: docs/ 路径含违规端口 → 不扫描(无 ⚠️ 提醒) ───
test('豁免: docs/ 路径含违规端口 7777 → 不扫描', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'docs/port-example.md', `# 示例\nconst API = 'http://localhost:7777/api'\n`)
    const r = runScript(dir, ['--all'])
    // docs/ 被豁免,7777 不被扫描 → 应输出 ✅ 无违规(扫描到的合规文件)
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.stdout}`)
    assert.doesNotMatch(r.stdout, /7777/, `docs/ 豁免不应扫描 7777\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 豁免: .github/workflows/ 路径含违规端口 → 不扫描 ───
test('豁免: .github/workflows/ 路径含违规端口 7777 → 不扫描', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, '.github/workflows/ci.yml', `jobs:\n  test:\n    env:\n      API_URL: http://localhost:7777\n`)
    const r = runScript(dir, ['--all'])
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.stdout}`)
    assert.doesNotMatch(r.stdout, /7777/, `.github/workflows/ 豁免不应扫描 7777\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. 豁免: apps/api/tests/ 路径含违规端口 → 不扫描 ───
test('豁免: apps/api/tests/ 路径含违规端口 7777 → 不扫描', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/api/tests/api.test.ts', `it('test', async () => {\n  const res = await fetch('http://localhost:7777/test')\n})\n`)
    const r = runScript(dir, ['--all'])
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.stdout}`)
    assert.doesNotMatch(r.stdout, /7777/, `apps/api/tests/ 豁免不应扫描 7777\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 8:模式 —— 默认 staged 模式 vs --all 模式
// ============================================================

// ─── 13. staged 模式: staged 文件含违规端口 → ⚠️ 报告 ───
test('staged 模式: staged 文件含违规端口 7777 → ⚠️ 报告', () => {
  const dir = createTempGitRepo()
  try {
    // baseline 后 stage 一个含违规端口的新文件
    stageFile(dir, 'apps/web/staged-bad.ts', `const API = 'http://localhost:7777/api'\n`)
    // 默认模式(无 --all):扫描 staged 文件
    const r = runScript(dir, [])
    assertWarn(r)
    assert.match(r.stdout, /7777/, `stdout 应含 7777\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /staged-bad\.ts/, `stdout 应含违规文件名\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. 非 git 环境 --all 模式: git ls-files 失败 → "无法获取" exit 0 ───
test('非 git 环境 --all 模式: git ls-files 失败 → "无法获取" exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-port-nogit-'))
  try {
    // 不 init git,直接跑 --all
    const r = runScript(dir, ['--all'])
    assert.equal(r.status, 0, `非 git 环境应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /⚠️.*无法获取 git tracked 文件列表/, `stdout 应含"无法获取"提示\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
