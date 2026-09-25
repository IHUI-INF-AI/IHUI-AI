// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
// - EXEMPT_PORTS:5432/6379/443/80/22 等(基础设施/CI/第三方)
// - EXEMPT_PATH_PATTERNS:docs/ / .github/workflows/ / apps/api/tests/ 等
// - warn-only:违规时 exit 1(仅供 runner 计 warning,不阻塞 commit),通过 stdout 区分 ✅ / ⚠️
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

// ─── 辅助:断言违规提醒(warn-only 违规 exit 1 + stdout 含 ⚠️ 提醒) ───
// 2026-08-19 起脚本有意 exit 1 供 runner 计 warning(依据:scripts/check-port-registry.mjs:266-270 注释 + runner id 24b mode=warn)
function assertWarn(r) {
  assert.equal(r.status, 1, `warn-only 违规应 exit 1,实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
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
// 检查 2:核心规则 —— 豁免端口(基础设施/CI/第三方)→ ✅ 无违规
// ============================================================

// ─── 3. 合法: localhost:5432(PostgreSQL 容器内部)→ ✅ 无违规 ───
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

// ─── 14. 非 git 环境 --all 模式: git ls-files 失败 → 显式回退 staged 口径,不静默通过 ───
// 2026-09-23 契约更新:旧行为是打印"无法获取 git tracked 文件列表"后静默 exit 0 ——
// 一次挂死 80 分钟的守门(见 scripts/check-port-registry.mjs 注释)若再遇到 git 调用失败,
// 全量审计会"绿着漏过"。现在失败必须**出声**并退到 staged 口径,同时不得声称"扫描通过"。
test('非 git 环境 --all 模式: git ls-files 失败 → 显式告警并回退 staged,不静默判绿', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-port-nogit-'))
  try {
    // 不 init git,直接跑 --all
    const r = runScript(dir, ['--all'])
    assert.equal(r.status, 0, `非 git 环境应 exit 0(仅告警),实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(
      r.stdout,
      /git ls-files 超时\/失败[\s\S]{0,40}回退 staged/,
      `stdout 应含"超时/失败 → 回退 staged"的显式提示\nstdout: ${r.stdout}`,
    )
    assert.doesNotMatch(
      r.stdout,
      /端口注册表守门[:：].*无违规/,
      `git 取文件失败时不得声称"扫描通过"(静默判绿)\nstdout: ${r.stdout}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 N:收窄判据"有牙"—— 字符类不算端口,但真端口照旧要报
// ============================================================

test('正则字符类 localhost:880[23] 不得被报成端口 880(实测假阳),且必须报数', () => {
  const dir = createTempGitRepo()
  try {
    // 这就是本仓另一道门里的真实形态:判据模式串里写了 8802/8803 两种结尾
    stageFile(dir, 'scripts/other-gate.mjs', "const RE = /localhost:880[23]|127\\.0\\.0\\.1:880[23]/\n")
    const r = runScript(dir, ['--all'])
    assert.doesNotMatch(r.stdout, /非 88xx 端口 880/, `字符类被当成端口 ⇒ 假阳复发\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /正则字符类引用 1 处已跳过/, `跳过了却不报数 = 静默丢判据面\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('反向对照:真端口 localhost:8877 仍必须被报出来(证明上一条的绿不是判据失明)', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/e2e/x.spec.ts', `const base = 'http://localhost:8877/foo'\n`)
    const r = runScript(dir, ['--all'])
    assertWarn(r)
    assert.match(r.stdout, /8877/, `真端口被一起吞掉了\nstdout: ${r.stdout}`)
    assert.doesNotMatch(r.stdout, /已跳过/, `本夹具里没有字符类,不该出现跳过计数\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
