// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码)───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-agents.mjs')

// ─── 静态分析:读取脚本内容一次,供所有静态测试复用 ───────────
const SOURCE = readFileSync(SCRIPT_PATH, 'utf8')

// ─── 辅助:运行脚本(可指定 env + cwd,去除 ANSI 颜色码) ─────
const ANSI_RE = /\x1b\[[0-9;]*m/g
function runScript(env = {}, cwd) {
  const r = spawnSync('node', [SCRIPT_PATH], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
    timeout: 30000,
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  return r
}

// ═══════════════════════════════════════════════════════════
// 1. 脚本存在性
// ═══════════════════════════════════════════════════════════

test('脚本文件存在: scripts/check-agents.mjs', () => {
  assert.ok(existsSync(SCRIPT_PATH), `脚本应存在: ${SCRIPT_PATH}`)
})

// ═══════════════════════════════════════════════════════════
// 2. 导入与依赖
// ═══════════════════════════════════════════════════════════

// 2026-09-24 更正:原来这两例把**跑不通的写法**钉成了契约。
// 根 `scripts/` 不在 `apps/api` 的依赖解析链上(pnpm 隔离),裸 `import 'dotenv/config'`
// 与 `import postgres from 'postgres'` 在本仓启动即 ERR_MODULE_NOT_FOUND(实测两包在根
// node_modules 均不可解析),而此测试 13 例全是源码正则,持续假绿把"脚本一跑就崩"盖住。
// 现按新契约断言:① 裸 import 不得复现;② 必须经 apps/api 依赖根 createRequire 解析;
// ③ 加一条**真跑**导入的用例(连不上库只允许报连接错,不得报模块找不到)。
test('导入: 不得再出现根目录解析不到的裸 import', () => {
  assert.doesNotMatch(SOURCE, /import\s+['"]dotenv\/config['"]/, "dotenv 在根 scripts/ 不可解析,禁止裸 import")
  assert.doesNotMatch(
    SOURCE,
    /import\s+postgres\s+from\s+['"]postgres['"]/,
    'postgres 在根 scripts/ 不可解析,禁止裸 import(应走 apps/api 依赖根)',
  )
})

test('导入: postgres 必须由 apps/api 依赖根 createRequire 解析', () => {
  assert.match(SOURCE, /createRequire\(/, '应用 createRequire 按 apps/api 的依赖根解析')
  assert.match(SOURCE, /apps\/api\/package\.json/, '解析锚点必须是 apps/api/package.json')
  assert.match(SOURCE, /requireFromApi\(['"]postgres['"]\)/, '必须真的 require 了 postgres')
  assert.match(SOURCE, /process\.exit\(1\)/, '解析不到时必须显式失败并给出修复动作,不得静默')
})

test('真跑导入: 指向不可达库时只允许连接错误,不得 ERR_MODULE_NOT_FOUND', () => {
  // 显式给一个指向本机丢弃端口的 URL,确保既不读 apps/api/.env 也绝不碰生产库(§5 测试隔离)。
  const r = spawnSync(
    process.execPath,
    [SCRIPT_PATH],
    {
      encoding: 'utf8',
      timeout: 60000,
      windowsHide: true,
      env: { ...process.env, DATABASE_URL: 'postgresql://nobody:***@127.0.0.1:1/nope' },
    },
  )
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  assert.ok(!/ERR_MODULE_NOT_FOUND|Cannot find (?:package|module)/.test(out), `导入面仍断链:\n${out.slice(0, 400)}`)
  assert.match(out, /ECONNREFUSED|connect|getaddrinfo|Connection (?:refused|terminated)/i, `应止步于连接阶段,实际:\n${out.slice(0, 400)}`)
})

// ═══════════════════════════════════════════════════════════
// 3. DATABASE_URL 配置
// ═══════════════════════════════════════════════════════════

test('配置: 读取 process.env.DATABASE_URL 环境变量', () => {
  assert.match(SOURCE, /process\.env\.DATABASE_URL/, '应读取 DATABASE_URL 环境变量')
})

test('配置: 默认 DB URL (postgresql://postgres:postgres@localhost:5432/ihui)', () => {
  assert.match(
    SOURCE,
    /postgresql:\/\/postgres:postgres@localhost:5432\/ihui/,
    '应有默认 DB URL',
  )
})

// ═══════════════════════════════════════════════════════════
// 4. 查询规则
// ═══════════════════════════════════════════════════════════

test('查询 1: agents 表 3 个新列 (collect_count, publish_status, suggested_questions)', () => {
  assert.match(SOURCE, /collect_count/, '应查询 collect_count 列')
  assert.match(SOURCE, /publish_status/, '应查询 publish_status 列')
  assert.match(SOURCE, /suggested_questions/, '应查询 suggested_questions 列')
  assert.match(SOURCE, /table_name\s*=\s*['"]agents['"]/, '应查询 agents 表')
})

test('查询 2: 3 个交互表 (zhs_agent_thumbs, zhs_agent_collect, zhs_agent_useDetail)', () => {
  assert.match(SOURCE, /zhs_agent_thumbs/, '应查询 zhs_agent_thumbs 表')
  assert.match(SOURCE, /zhs_agent_collect/, '应查询 zhs_agent_collect 表')
  assert.match(SOURCE, /zhs_agent_useDetail/, '应查询 zhs_agent_useDetail 表')
})

// ═══════════════════════════════════════════════════════════
// 5. 连接池与生命周期
// ═══════════════════════════════════════════════════════════

test('连接池: postgres(url, { max: 1 }) 单连接', () => {
  assert.match(SOURCE, /max:\s*1/, '应配置 max: 1 (单连接池)')
})

test('生命周期: finally 块中调用 sql.end({ timeout: 5 })', () => {
  assert.match(SOURCE, /finally\s*\{/, '应有 finally 块')
  assert.match(
    SOURCE,
    /sql\.end\s*\(\s*\{\s*timeout:\s*5\s*\}\s*\)/,
    '应在 finally 中调用 sql.end({ timeout: 5 })',
  )
})

test('错误处理: try/catch 捕获异常', () => {
  assert.match(SOURCE, /try\s*\{/, '应有 try 块')
  assert.match(SOURCE, /catch\s*\(\s*e\s*\)\s*\{/, '应有 catch (e) 块')
})

// ═══════════════════════════════════════════════════════════
// 6. 输出格式
// ═══════════════════════════════════════════════════════════

test('输出: console.log "agents table new columns:" 前缀', () => {
  assert.match(
    SOURCE,
    /console\.log\s*\(\s*['"]agents table new columns:['"]/,
    '应输出 "agents table new columns:"',
  )
})

test('输出: console.log "agent interaction tables:" 前缀', () => {
  assert.match(
    SOURCE,
    /console\.log\s*\(\s*['"]agent interaction tables:['"]/,
    '应输出 "agent interaction tables:"',
  )
})

test('错误日志: console.error("error:", e.message) 格式', () => {
  assert.match(
    SOURCE,
    /console\.error\s*\(\s*['"]error:['"]\s*,\s*e\.message\s*\)/,
    '应 console.error("error:", e.message)',
  )
})

// ═══════════════════════════════════════════════════════════
// 7. 运行时: 无效 DATABASE_URL 错误处理(边界)
// ═══════════════════════════════════════════════════════════

test('运行时: 无效 DATABASE_URL → 捕获错误, stderr 含 "error:", exit 0', () => {
  // 端口 1 (无监听) → ECONNREFUSED,连接立即失败
  // 在临时目录运行,避免加载项目 .env 干扰
  const tmpCwd = mkdtempSync(join(tmpdir(), 'ihui-check-agents-'))
  try {
    const r = runScript(
      { DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/ihui' },
      tmpCwd,
    )
    // 错误被 catch 捕获,脚本正常退出 exit 0
    assert.equal(
      r.status,
      0,
      `错误被捕获应 exit 0\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    // stderr 应含 "error:" 前缀(来自 console.error('error:', e.message))
    assert.match(r.stderr, /error:/, 'stderr 应含 "error:" 前缀')
    // 不应有未捕获异常
    assert.ok(
      !r.stderr.includes('Uncaught') && !r.stderr.includes('Unhandled'),
      `不应有未捕获异常\nstderr: ${r.stderr}`,
    )
  } finally {
    rmSync(tmpCwd, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
