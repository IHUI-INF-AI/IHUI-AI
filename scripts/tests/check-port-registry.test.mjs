// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'
// §22c:判据纯函数由源脚本 export,测试**直接 import**而不是抄一份镜像常量。
import { __test__ as portGate } from '../check-port-registry.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-port-registry.mjs')

// ============================================================
// 源脚本核心规则(scripts/check-port-registry.mjs)
// ============================================================
// - 守门规则:dev/宿主映射端口必须以 88 开头(88xx 段)
// - **REGISTERED_PORTS 自 2026-09-28 票 G-409 起不再手抄**:一律从
//   `scripts/dev-port-registry.json` 的 `registered_ports` 派生(8801-8809 / 8810-8819 /
//   8820-8829 / 8830-8839 / 8840-8849 / 8877 = 50 槽)。派生不出来 ⇒ **无法判定 exit 2**,
//   绝不回落成任何旧手抄表或空清单。
//   ⚠️ 8840 的归属已随派生改变:被删掉的那份手抄表**漏了 8840**,而 docs §2.5/§3.3 与 JSON
//   extension 段起点都是 8840 —— 三副本今天确实漂了这一格,漂的正是无人对账的那一份(见 T-DRIFT)。
// - EXEMPT_PORTS:5432/6379/443/80/22 等(基础设施/CI/第三方);9997 = Xinference 自托管出厂口
// - EXEMPT_PATH_PATTERNS:docs/ / .github/workflows/ / apps/api/tests/ 等
// - warn-only:违规时 exit 1(仅供 runner 计 warning,不阻塞 commit),通过 stdout 区分 ✅ / ⚠️
// - 两种模式:默认(staged) / --all(git ls-files 全量 tracked)
// - P1 对账(同一票新增):docs §2 表端口 ↔ 派生集**双向**比较,文档多报/注册表多认领都点名

// ─── 夹具:两份登记表输入(默认写进每个临时仓,保证 P0/P1 在场且自洽)───────────
// 为什么必须默认写:派生不出来 ⇒ 整门"无法判定"。若让 14 条既有夹具都撞进未判定分支,
// 本测试文件就会把"门没跑"读成"门通过"—— 那正是本票立项要防的那一型。
const FIXTURE_REGISTRY = JSON.stringify(
  {
    $schema_version: 1,
    services: { web: { port: 8801 }, api: { port: 8802 } },
    port_ranges: {
      app: [8801, 8809],
      infra: [8810, 8819],
      helper: [8820, 8829],
      saas: [8830, 8839],
      extension: [8840, 8849],
    },
    registered_ports: [
      { range: [8801, 8809], why: 'fixture 应用段' },
      { range: [8810, 8819], why: 'fixture 基础设施段' },
      { range: [8820, 8829], why: 'fixture 辅助段' },
      { range: [8830, 8839], why: 'fixture SaaS 段' },
      { range: [8840, 8849], why: 'fixture 蓝绿段(段位起点 8840)' },
      { port: 8877, why: 'fixture e2e 私有 dev' },
    ],
  },
  null,
  2,
)

const FIXTURE_DOC = [
  '# 端口管理规则(测试夹具)',
  '',
  '## 1. 设计原则',
  '',
  '1. 统一前缀 88:所有 dev/宿主映射端口以 88 开头(叙述里的 8800-8809 不是登记表)。',
  '',
  '## 2. 端口注册表',
  '',
  '### 2.1 应用服务(8801-8809)',
  '',
  '| 端口 | 服务 |',
  '|------|------|',
  '| 8801-8809 | 应用段 |',
  '',
  '### 2.2 基础设施(8810-8819)',
  '',
  '| 端口 | 服务 |',
  '|------|------|',
  '| 8810-8819 | 基础设施段 |',
  '',
  '### 2.3 辅助工具(8820-8829)',
  '',
  '| 端口 | 服务 |',
  '|------|------|',
  '| 8820-8829 | 辅助段 |',
  '',
  '### 2.4 SaaS 部署(8830-8839)',
  '',
  '| 端口 | 服务 |',
  '|------|------|',
  '| 8830-8839 | SaaS 段 |',
  '',
  '### 2.5 CLI Agent(8840-8849)',
  '',
  '| 端口 | 服务 |',
  '|------|------|',
  '| 8840-8849 | CLI/蓝绿段(8841 已认领,其余预留) |',
  '',
  '### 2.6 e2e 私有 dev 端口(8850-8899 段内认领)',
  '',
  '| 端口 | 服务 |',
  '|------|------|',
  '| 8877 | 桌面遮罩 e2e 的私有 dev server |',
  '',
  '## 3. 端口分配规则(强制)',
  '',
  '```',
  '8800-8809  → 应用服务(8 端)',
  '8840-8899  → 预留扩展(未来新服务)',
  '```',
  '',
].join('\n')

/** 默认夹具 = 两份输入互相一致(测试只在需要时改一侧) */
function withRegistryDefaults(files = {}) {
  return {
    'scripts/dev-port-registry.json': FIXTURE_REGISTRY,
    'docs/port-management.md': FIXTURE_DOC,
    ...files,
  }
}

// ─── 辅助:创建临时 git 仓库(含 baseline commit) ───
// 注:始终写入 baseline README.md,保证 git commit 有内容可提交
function createTempGitRepo(rawFiles = {}) {
  const files = withRegistryDefaults(rawFiles)
  const dir = mkScratch('ihui-port-')
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git init -b main', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git config user.email "test@test.com"', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git config user.name "test"', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git config commit.gpgsign false', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
  // baseline 文件(确保初始 commit 有内容)
  writeFileSync(join(dir, 'README.md'), '# test baseline\n')
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git add -A', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git commit -q -m init', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
  return dir
}

// ─── 辅助:在 git 仓库中写入文件并 stage ───
function stageFile(repoDir, relPath, content) {
  const fullPath = join(repoDir, relPath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['add', relPath], { cwd: repoDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// ─── 辅助:运行 check-port-registry.mjs ───
function runScript(cwd, args = []) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ─── 14. 非 git 环境 --all 模式: git ls-files 失败 → 显式回退 staged 口径,不静默通过 ───
// 2026-09-23 契约更新:旧行为是打印"无法获取 git tracked 文件列表"后静默 exit 0 ——
// 一次挂死 80 分钟的守门(见 scripts/check-port-registry.mjs 注释)若再遇到 git 调用失败,
// 全量审计会"绿着漏过"。现在失败必须**出声**并退到 staged 口径,同时不得声称"扫描通过"。
test('非 git 环境 --all 模式: git ls-files 失败 → 显式告警并回退 staged,不静默判绿', () => {
  const dir = mkScratch('ihui-port-nogit-')
  try {
    // 不 init git,直接跑 --all
    const r = runScript(dir, ['--all'])
    // 2026-09-28 票 G-409 后此场景的退出码从 0 改成 **2(无法判定)**:扫描的判据就是
    // registered_ports 派生集,非 git 目录下那份清单取不到 ⇒ 此时报 exit 0 等于对着
    // "一处都没判"出具"端口合规"合格证 —— 正是本测试第二/三条断言已经在防的那一型,
    // 只是旧实现把它留在退出码上没喊出来。回退告警与"不得声称扫描通过"两条一字未动。
    assert.equal(r.status, 2, `非 git 环境没有认领清单 ⇒ 应 exit 2 无法判定,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(
      r.stdout + r.stderr,
      /git ls-files 超时\/失败[\s\S]{0,40}回退 staged/,
      `stdout 应含"超时/失败 → 回退 staged"的显式提示\nstdout: ${r.stdout}`,
    )
    assert.doesNotMatch(
      r.stdout + r.stderr,
      /端口注册表守门[:：].*无违规/,
      `git 取文件失败时不得声称"扫描通过"(静默判绿)\nstdout: ${r.stdout}`,
    )
    assert.match(
      r.stderr,
      /无法判定/,
      `取不到认领清单必须喊"无法判定",不得只靠退出码暗示\nstderr: ${r.stderr}`
    )
  } finally {
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

test('反向对照:真端口 localhost:8850 仍必须被报出来(证明上一条的绿不是判据失明)', () => {
  const dir = createTempGitRepo()
  try {
    // 8850-8899 段内除 8877 外从未被 §2.6 认领(docs 原文:"其余槽位仍为预留"),用它
    // 本断言同时钉住"派生集没有把整个 8850-8899 吞进来"这件事。
    // 2026-09-28 换端口:旧夹具用 8840,而派生自 JSON extension 段之后 8840 已是合法槽
    // (见 T-DRIFT),继续用 8840 会让这条"有牙证明"静默退化成恒绿 —— 与门 131 那条
    // "认领 8877 后旧夹具 8877 变合法"是同一型自伤,靠现读换端口而不是删断言。
    stageFile(dir, 'apps/web/e2e/x.spec.ts', `const base = 'http://localhost:8850/foo'\n`)
    const r = runScript(dir, ['--all'])
    assertWarn(r)
    assert.match(r.stdout, /8850/, `真端口被一起吞掉了\nstdout: ${r.stdout}`)
    assert.doesNotMatch(r.stdout, /已跳过/, `本夹具里没有字符类,不该出现跳过计数\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 8840 的归属已随"派生"改变:三份副本里只有手抄那份漏它,现按 JSON 认 ───
test('T-DRIFT:8840 现为合法槽(派生自 registered_ports 的 8840-8849 段起点)', () => {
  const dir = createTempGitRepo()
  try {
    // 正面证据:docs §2.5 的表头写着 8840-8849、§3.3 的段位规则写"8840-8899 → 预留扩展",
    // 而 JSON 的 extension 段起点同为 8840 —— 被删掉的手抄表(8841-8849)是唯一的少数派。
    stageFile(dir, 'apps/web/blue-green.ts', `const URL = 'http://localhost:8840/deploy'\n`)
    const r = runScript(dir, ['--all'])
    assertPass(r)
    assert.doesNotMatch(r.stdout, /8840/, `8840 仍被判违规 ⇒ 派生没接上\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 检查 9:P1 双向对账(票 G-409 的"改一处忘另一处即红")
// ============================================================
// 三条成对 + 三态各一:① 只改注册表 ⇒ 点名"多认领";② 只改文档 ⇒ 点名"多报";
// ③ 两边同步 ⇒ 绿。三条缺一,判据就只是"数了一下"而不是"能双向判红"。

const registryWithExtraPort = (extraPort) =>
  JSON.stringify(
    {
      $schema_version: 1,
      registered_ports: [
        { range: [8801, 8809], why: 'fixture' },
        { range: [8810, 8819], why: 'fixture' },
        { range: [8820, 8829], why: 'fixture' },
        { range: [8830, 8839], why: 'fixture' },
        { range: [8840, 8849], why: 'fixture' },
        { port: 8877, why: 'fixture' },
        { port: extraPort, why: 'fixture 新增' },
      ],
    },
    null,
    2,
  )

test('P1 ①:注册表多认领一个端口而 docs §2 没写 → exit 1 并点名端口', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'scripts/dev-port-registry.json', registryWithExtraPort(8890))
    // 用 --staged:偏差在索引里(还没进 HEAD),而默认档判 HEAD 是**正确**的"这枚提交之外没红"。
    // 这条与"面:索引坏而磁盘好"是一对:同一份现场,两个面必须给出两个答案。
    const r = runScript(dir, ['--parity', '--staged'])
    assert.equal(r.status, 1, `多认领应判红(exit 1),实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /注册表多认领/, `结论行必须说明是哪一侧多\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /8890/, `必须点名具体端口,不得只报一个数\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('P1 ②:docs §2 多写一个端口而注册表没认领 → exit 1 并点名(反向对照)', () => {
  const dir = createTempGitRepo()
  try {
    // 文档里加一行 8891,注册表保持原样 —— 与 ① 恰好反向,两条都必须红,
    // 只留一条就成了"单向尺子"(文档永远不能被证明漏写)。
    stageFile(
      dir,
      'docs/port-management.md',
      `${FIXTURE_DOC.replace('## 3. 端口分配规则(强制)', '')}| 8891 | 文档单方面新增的服务 |\n\n## 3. 端口分配规则(强制)`,
    )
    const r = runScript(dir, ['--parity', '--staged'])
    assert.equal(r.status, 1, `文档多报应判红,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /文档多报/, `必须说明是文档侧多\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /8891/, `必须点名 8891\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('P1 ③:两侧同步 → exit 0,并现读报出两侧基数(不得只说"一致")', () => {
  const dir = createTempGitRepo()
  try {
    const r = runScript(dir, ['--parity'])
    assert.equal(r.status, 0, `同步应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /✅ P1 双向对账/, `结论行必须写"双向对账"\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /§2 50 槽 ≡ 派生集 50 槽/, `两侧基数必须都印出来(现读 50/50)\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 检查 10:P0 三态 —— 派生不出来 / 文档侧看不见 / 两面旗同给
// ============================================================

test('P0:注册表缺 registered_ports → 无法判定 exit 2,绝不回落手抄表或空清单', () => {
  const dir = createTempGitRepo({
    'scripts/dev-port-registry.json': JSON.stringify({ $schema_version: 1, port_ranges: { app: [8801, 8809] } }, null, 2),
  })
  try {
    const r = runScript(dir, ['--all'])
    assert.equal(r.status, 2, `派生不出来必须 exit 2(无法判定),实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stderr, /无法判定/, `必须喊"无法判定"\nstderr: ${r.stderr}`)
    assert.doesNotMatch(
      r.stdout + r.stderr,
      /无违规端口/,
      `没有认领清单时不得声称"扫描无违规"(把没判写成判过了)\nstdout: ${r.stdout}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('P0:registered_ports 为空数组 → 同样是无法判定(空扫不派生)', () => {
  const dir = createTempGitRepo({
    'scripts/dev-port-registry.json': JSON.stringify({ registered_ports: [] }, null, 2),
  })
  try {
    const r = runScript(dir, ['--all'])
    assert.equal(r.status, 2, `空清单必须判"无法判定"而不是"所有端口都违规/都合规",实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stderr, /空数组|0 个端口/, `要点名为什么判不出来\nstderr: ${r.stderr}`)
  } finally {
    rmScratch(dir)
  }
})

test('P1:文档 §2 一行都枚举不到 → 未判定,不得记成"已对账"', () => {
  const dir = createTempGitRepo({
    'docs/port-management.md': '# 端口管理规则\n\n(§2 还没写)\n',
  })
  try {
    const r = runScript(dir, ['--parity'])
    assert.equal(r.status, 2, `文档侧空枚举在问责档必须判"未判定"exit 2,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /未判定/, `结论行必须写"未判定"\nstdout: ${r.stdout}`)
    assert.doesNotMatch(r.stdout, /✅ P1/, `未判定不得同时打出 P1 通过\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('面旗矛盾:--staged 与 --worktree 同给 → exit 2,绝不任选一面判红', () => {
  const dir = createTempGitRepo()
  try {
    const r = runScript(dir, ['--parity', '--staged', '--worktree'])
    assert.equal(r.status, 2, `两面旗同给必须判死,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout + r.stderr, /不得同用/, `必须点名是面旗矛盾\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 检查 11:取材面 —— 索引 vs 磁盘必须分别回答(与守门 36/124/93/98 同一口径)
// ============================================================

test('面:索引坏而磁盘好 → --staged 必红(不得借工作树的旧内容凑数)', () => {
  const dir = createTempGitRepo()
  try {
    // 工作树与索引都被改成"多认领 8890";HEAD 仍是同步的那一份。
    // 默认档判 HEAD ⇒ 绿;--staged 判索引 ⇒ 红。两条同时成立才证明"取哪个面"是有意义的。
    stageFile(dir, 'scripts/dev-port-registry.json', registryWithExtraPort(8890))
    const staged = runScript(dir, ['--parity', '--staged'])
    assert.equal(staged.status, 1, `索引里有偏差,--staged 必须判红,实际 ${staged.status}\nstdout: ${staged.stdout}`)
    const head = runScript(dir, ['--parity'])
    assert.equal(head.status, 0, `同一棵树判 HEAD 必须绿(偏差还没入库)\nstdout: ${head.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('面:索引好而磁盘被别人半编辑 → --staged 必绿(审的是提交内容,不是在飞现场)', () => {
  const dir = createTempGitRepo()
  try {
    // 索引与 HEAD 保持同步(本次要提交的内容没碰登记表),只在**磁盘**上留一份别人的半编辑:
    // 用 writeFileSync 而不是 stageFile —— 一旦 stage 了,索引就成了坏的那份,这条判的就不是
    // "工作树滞后于索引"而是另一回事了(上一版就是踩在这里:先 stage 再 checkout-index,
    // 索引里留的仍是坏版本 ⇒ --staged 必然红,而断言写的是"必绿")。
    writeFileSync(join(dir, 'scripts', 'dev-port-registry.json'), registryWithExtraPort(8891))
    const r = runScript(dir, ['--parity', '--staged'])
    assert.equal(r.status, 0, `索引里是同步的那份 ⇒ 不得因他人在飞的工作树判红,实际 ${r.status}\nstdout: ${r.stdout}`)
    const w = runScript(dir, ['--parity', '--worktree'])
    assert.equal(w.status, 1, `--worktree 逃生舱必须能看见磁盘那份的偏差(证明上面的绿不是"根本没读盘")\nstdout: ${w.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 检查 12:形状锁 —— 手抄清单不得长回来,输入必须走统一取材层
// ============================================================
// 这类锁只有源码级判据能防:判据漂了不会响(守门 70/76/81 同一条教训)。

test('S-1 装车锁:代码侧不得再出现手抄端口清单,且必须真调派生 + 层读取', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf-8')
  assert.doesNotMatch(
    src,
    /8801,\s*8802/,
    `手抄端口清单回来了 ⇒ 三副本的第三份又无人对账\n${src.slice(0, 400)}`,
  )
  assert.doesNotMatch(src, /const REGISTERED_PORTS\s*=\s*new Set\(/, 'REGISTERED_PORTS 不得再由字面量集合定义')
  assert.match(src, /deriveRegisteredPorts\(/, '必须真调派生出口(不是只 import 着)')
  assert.match(src, /catBatch\(/, '两份登记表输入必须走统一取材层(守门 118:散写读内容判红)')
  assert.match(src, /parseDocPortTable\(/, 'P1 必须真调文档侧解析')
})

test('S-2 文档侧解析:真仓 §2 的三种书写形态必须都认(取自 docs/port-management.md 原文)', () => {
  assert.deepEqual(portGate.expandDocCell(' 8822-8829 '), [8822, 8823, 8824, 8825, 8826, 8827, 8828, 8829])
  const multi = portGate.expandDocCell(' 8840/8842-8849 ')
  assert.deepEqual(multi.slice(0, 2), [8840, 8842], '斜杠分隔的复合首格必须展开(8840 就靠这一行进文档侧)')
  assert.equal(multi.length, 9)
  // 8806 那一行带 Markdown 删除线,首格本身是纯数字 → 装饰符号不得影响取值
  assert.deepEqual(portGate.expandDocCell(' 8806 '), [8806])
  // 叙述/分隔形态一律不是端口
  assert.deepEqual(portGate.expandDocCell(' —— '), [], '破折号是"没有端口"的写法')
  assert.deepEqual(portGate.expandDocCell('------'), [], '表格分隔行不得被当成端口')
  assert.deepEqual(portGate.expandDocCell(' 端口 '), [], '表头不得被当成端口')
})

test('S-3 §3/§4 的叙述数字不得混进文档侧集合(否则 8800 会凭空变"登记")', () => {
  const doc = portGate.parseDocPortTable(FIXTURE_DOC)
  assert.equal(doc.ports.has(8800), false, '§1/§3.3 里的 8800-8809 是叙述,不是 §2 登记行')
  assert.ok(doc.rows >= 6, `文档侧至少枚举到 §2 的 6 个区段行(现读 ${doc.rows})`)
})

test('S-4 派生形态判不出 → problems 点名每一条并额外喊"派生出 0 个"(绝不部分派生后继续判)', () => {
  const bad = portGate.deriveRegisteredPorts({ registered_ports: [{ range: [8850, 8840] }, { port: '8877' }] })
  assert.equal(bad.problems.length, 3, `两条坏条目 + 一条"派生出 0 个"必须都点名,实得 ${JSON.stringify(bad.problems)}`)
  assert.match(bad.problems[0], /registered_ports\[0\]/, '必须按条目下标点名(不接受"整体失败"这种含糊话)')
  assert.match(bad.problems[1], /registered_ports\[1\]/, '第二条同样要点名')
  assert.match(bad.problems[2], /0 个端口/, '空派生要单列 —— 它是"判据失明"而不是"没有认领"')
  assert.equal(bad.ports.size, 0)
  const noKey = portGate.deriveRegisteredPorts({ port_ranges: {} })
  assert.equal(noKey.problems.length, 1, '缺键必须点名(不得当作"没有认领"继续扫)')
  // 部分可用**不算**失败:一条坏 + 一条好 ⇒ problems=1 且集合仍含好那条(上层按 problems 判死)
  const half = portGate.deriveRegisteredPorts({ registered_ports: [{ port: 'oops' }, { port: 8801 }] })
  assert.equal(half.problems.length, 1)
  assert.equal(half.ports.has(8801), true, '好条目不该被坏条目连坐(判死由上层看 problems 决定)')
})

test('S-5 真仓阳性对照:工作树两面必须双向 0(看不见存量不算通过)', () => {
  const realRoot = join(__dirname, '..', '..')
  const got = portGate.readRegistryInputs(realRoot, 'worktree')
  assert.equal(got.ok, true, `真仓两份登记表必须能取到:${got.reason}`)
  const judged = portGate.evaluateRegistryParity({ registryText: got.registryText, docText: got.docText })
  assert.equal(judged.status, 'judged', `真仓必须真判过,不得落未判定:${judged.lines.join('\n')}`)
  assert.equal(
    judged.parityRed,
    false,
    `真仓 §2 ↔ 派生集必须双向一致,现读 文档多报 ${judged.onlyDoc?.join(',') || '0'} / 多认领 ${judged.onlyDerived?.join(',') || '0'}`,
  )
  // 基数必须两侧都报出且相等 —— 只判"差集为空"会被"两边都空"糊过去
  assert.ok(judged.docCount === judged.derivedCount && judged.docCount > 40, `现读基数 ${judged.docCount}/${judged.derivedCount}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
