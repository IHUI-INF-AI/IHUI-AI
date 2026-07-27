/**
 * @file migrate-llm-providers.mjs 回归测试基线
 * @description 覆盖 scripts/migrate-llm-providers.mjs 的核心规则:
 *   1. CLI 退出码:--help/-h → 0;输入不存在 → 1;--strip-flat 无 --apply → 2
 *   2. parseEnv:跳过注释/空行、剥离单/双引号包裹
 *   3. migrate 别名规则:OPENAI_API_KEY→openai、GEMINI_API_KEY→google、
 *      CLOUDFLARE_TOKEN/GITHUB_TOKEN→cloudflare/github(_TOKEN 而非 _API_KEY)
 *   4. 仅有 api_base(kilo/pollinations)→ 仍迁移,api_key 为空字符串
 *   5. 无任何 provider 匹配 → 警告但 exit 0
 *   6. --dry-run 不写文件;--dry-run --redact 脱敏(空→"(empty)" / ≤8→"***" / >8→前4***后4)
 *   7. --apply 写完整 .env(含 LLM_PROVIDERS=... 一行,单行 JSON)
 *   8. --backup 在写入前备份 input(<input>.bak.<YYYYMMDD_HHMMSS>)
 *   9. --strip-flat --apply 删除扁平字段,保留注释/空行/非 LLM 字段
 *
 * 测试策略:spawnSync 子进程运行原脚本,cwd=临时目录,fixture 完全隔离不污染项目。
 * 路径推导用 import.meta.url(AGENTS.md §15)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'migrate-llm-providers.mjs')

// ─── 辅助:strip ANSI 颜色码 ───────────────────────────────
const ANSI_RE = /\x1b\[[0-9;]*m/g
function stripAnsi(s) {
  return (s || '').replace(ANSI_RE, '')
}

// ─── 辅助:创建临时目录(fixture 隔离,不污染项目) ─────────
function createTempDir(prefix = 'ihui-migrate-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

// ─── 辅助:运行脚本(stdout/stderr 去 ANSI) ────────────────
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = stripAnsi(r.stdout)
  r.err = stripAnsi(r.stderr)
  return r
}

// ─── 辅助:写 fixture .env ─────────────────────────────────
function writeEnv(dir, name, content) {
  const p = join(dir, name)
  writeFileSync(p, content, 'utf8')
  return p
}

// ─── 1. CLI: --help → exit 0 + 帮助文本 ───────────────────
test('CLI --help → exit 0 + 显示用法', () => {
  const dir = createTempDir()
  try {
    const r = runScript(dir, ['--help'])
    assert.equal(r.status, 0, `--help 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /用法:/, 'stdout 应含"用法:"')
    assert.match(r.out, /--input <file>/, '应含 --input 说明')
    assert.match(r.out, /--strip-flat/, '应含 --strip-flat 说明')
    assert.match(r.out, /--redact/, '应含 --redact 说明')
    assert.match(r.out, /--backup/, '应含 --backup 说明')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. CLI: -h 是 --help 的别名 ──────────────────────────
test('CLI -h 是 --help 别名 → exit 0', () => {
  const dir = createTempDir()
  try {
    const r = runScript(dir, ['-h'])
    assert.equal(r.status, 0, `-h 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /用法:/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. CLI: 输入文件不存在 → exit 1 ──────────────────────
test('CLI 输入文件不存在 → exit 1', () => {
  const dir = createTempDir()
  try {
    const r = runScript(dir, ['--input', join(dir, 'nonexistent.env')])
    assert.equal(r.status, 1, `应 exit 1,实际 ${r.status}\nstderr: ${r.err}`)
    assert.match(r.err, /输入文件不存在/, 'stderr 应含错误说明')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. CLI: --strip-flat 无 --apply → exit 2 ─────────────
test('CLI --strip-flat 无 --apply → exit 2', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, '.env', 'OPENAI_API_KEY=sk-test\n')
  try {
    const r = runScript(dir, ['--input', envPath, '--strip-flat'])
    assert.equal(r.status, 2, `应 exit 2,实际 ${r.status}\nstderr: ${r.err}`)
    assert.match(r.err, /--strip-flat 必须配合 --apply/, 'stderr 应含提示')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 基础迁移:openai + anthropic → 纯 JSON 输出 ────────
test('基础迁移:openai + anthropic 写纯 JSON', () => {
  const dir = createTempDir()
  const envPath = writeEnv(
    dir,
    '.env',
    'OPENAI_API_KEY=sk-openai-1234567890\nANTHROPIC_API_KEY=sk-ant-abcdef123456\nANTHROPIC_API_BASE=https://api.anthropic.com\n',
  )
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath])
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /已解析 3 个 env 变量/)
    assert.match(r.out, /匹配到 2 个 LLM provider/)
    assert.ok(existsSync(outPath), '应写入输出文件')
    const json = JSON.parse(readFileSync(outPath, 'utf8'))
    assert.equal(json.openai.api_key, 'sk-openai-1234567890')
    assert.equal(json.openai.api_base, null)
    assert.equal(json.anthropic.api_key, 'sk-ant-abcdef123456')
    assert.equal(json.anthropic.api_base, 'https://api.anthropic.com')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. 别名规则:GEMINI_API_KEY → google ─────────────────
test('别名规则:GEMINI_API_KEY 迁移到 google', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, '.env', 'GEMINI_API_KEY=AIza-sy-test-key\n')
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath])
    assert.equal(r.status, 0, `应 exit 0\nstderr: ${r.err}`)
    const json = JSON.parse(readFileSync(outPath, 'utf8'))
    assert.ok(json.google, '应存在 google provider')
    assert.equal(json.google.api_key, 'AIza-sy-test-key')
    assert.ok(!json.gemini, '不应有 gemini key(canonical 名是 google)')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 别名规则:cloudflare/github 用 _TOKEN 而非 _API_KEY ─
test('别名规则:cloudflare/github 用 _TOKEN 字段', () => {
  const dir = createTempDir()
  const envPath = writeEnv(
    dir,
    '.env',
    'CLOUDFLARE_TOKEN=cf-token-abc123\nGITHUB_TOKEN=ghp_token_xyz789\n',
  )
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath])
    assert.equal(r.status, 0, `应 exit 0\nstderr: ${r.err}`)
    assert.match(r.out, /匹配到 2 个 LLM provider/)
    const json = JSON.parse(readFileSync(outPath, 'utf8'))
    assert.equal(json.cloudflare.api_key, 'cf-token-abc123')
    assert.equal(json.github.api_key, 'ghp_token_xyz789')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. 仅有 api_base → 仍迁移,api_key 为空字符串 ────────
test('仅 api_base(kilo)→ 仍迁移,api_key 为空', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, '.env', 'KILO_API_BASE=https://api.kilo.ai/v1\n')
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath])
    assert.equal(r.status, 0, `应 exit 0\nstderr: ${r.err}`)
    assert.match(r.out, /匹配到 1 个 LLM provider/)
    const json = JSON.parse(readFileSync(outPath, 'utf8'))
    assert.ok(json.kilo, '应有 kilo provider')
    assert.equal(json.kilo.api_key, '', 'api_key 应为空字符串')
    assert.equal(json.kilo.api_base, 'https://api.kilo.ai/v1')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 无任何 provider 匹配 → 警告但 exit 0 ──────────────
test('无 provider 匹配 → 警告但 exit 0', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, '.env', 'DATABASE_URL=postgres://localhost\nREDIS_URL=redis://localhost\n')
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath])
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /匹配到 0 个 LLM provider/)
    assert.match(r.out, /未发现任何 LLM provider 配置/)
    assert.ok(existsSync(outPath), '仍应写入(空)JSON 文件')
    const json = JSON.parse(readFileSync(outPath, 'utf8'))
    assert.equal(Object.keys(json).length, 0, '应为空对象')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. --dry-run 不写任何文件 ────────────────────────────
test('--dry-run 不写输出文件', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, '.env', 'OPENAI_API_KEY=sk-test-1234567890\n')
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath, '--dry-run'])
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /dry-run 模式,不写任何文件/)
    assert.ok(!existsSync(outPath), '不应创建输出文件')
    assert.match(r.out, /"openai"/, '应在 stdout 预览 providers')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. --dry-run --redact 脱敏 api_key ──────────────────
test('--dry-run --redact 脱敏 api_key(三种长度规则)', () => {
  const dir = createTempDir()
  // openai=长 key(>8):前4***后4;github=短 token(≤8):***;kilo=仅 base(api_key 空→"(empty)")
  const envPath = writeEnv(
    dir,
    '.env',
    'OPENAI_API_KEY=sk-abcd1234efgh\nGITHUB_TOKEN=short\nKILO_API_BASE=https://kilo.ai\n',
  )
  try {
    const r = runScript(dir, ['--input', envPath, '--dry-run', '--redact'])
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.out}`)
    // >8:前4***后4
    assert.match(r.out, /"api_key":\s*"sk-a\*\*\*efgh"/, '长 key 应脱敏为前4***后4')
    // ≤8:***
    assert.match(r.out, /"api_key":\s*"\*\*\*"/, '短 key 应脱敏为 ***')
    // 空:"(empty)"
    assert.match(r.out, /"api_key":\s*"\(empty\)"/, '空 api_key 应脱敏为 (empty)')
    // api_base 不脱敏
    assert.match(r.out, /"api_base":\s*"https:\/\/kilo\.ai"/, 'api_base 应保持原样')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. --apply 写完整 .env(含 LLM_PROVIDERS= 单行 JSON) ─
test('--apply 写完整 .env 含 LLM_PROVIDERS=', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, '.env', 'OPENAI_API_KEY=sk-test-1234567890\nDATABASE_URL=postgres://x\n')
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath, '--apply'])
    assert.equal(r.status, 0, `应 exit 0\nstderr: ${r.err}`)
    assert.match(r.out, /已写入完整 \.env/)
    const content = readFileSync(outPath, 'utf8')
    assert.match(content, /LLM_PROVIDERS='/, '应含 LLM_PROVIDERS= 行')
    assert.match(content, /阶段 2 迁移产物/, '应含迁移注释')
    assert.match(content, /DATABASE_URL=postgres:\/\/x/, '应保留原 .env 字段')
    // JSON 应为单行(避免多行被 dotenv 按行 split)
    const jsonMatch = content.match(/LLM_PROVIDERS='(\{[^']*\})'/)
    assert.ok(jsonMatch, '应匹配 LLM_PROVIDERS 单行 JSON')
    assert.ok(!jsonMatch[1].includes('\n'), 'JSON 必须为单行')
    const parsed = JSON.parse(jsonMatch[1])
    assert.equal(parsed.openai.api_key, 'sk-test-1234567890')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. --backup 创建备份文件 ─────────────────────────────
test('--backup 创建 <input>.bak.<timestamp> 备份文件', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, '.env', 'OPENAI_API_KEY=sk-test-1234567890\n')
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath, '--backup'])
    assert.equal(r.status, 0, `应 exit 0\nstderr: ${r.err}`)
    assert.match(r.out, /已备份原 \.env →/, '应打印备份消息')
    // 检查目录下有 .bak.<timestamp> 文件
    const dirFiles = readdirSync(dir)
    const bakFiles = dirFiles.filter((f) => /^\.env\.bak\.\d{8}_\d{6}$/.test(f))
    assert.ok(bakFiles.length === 1, `应有 1 个备份文件,实际 ${bakFiles.length}: ${bakFiles.join(', ')}`)
    // 备份内容应与原文件一致
    const bakContent = readFileSync(join(dir, bakFiles[0]), 'utf8')
    assert.equal(bakContent, 'OPENAI_API_KEY=sk-test-1234567890\n', '备份内容应等于原文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. --strip-flat --apply 删除扁平字段,保留注释/空行/非 LLM 字段 ─
test('--strip-flat --apply 删除扁平字段,保留注释与非 LLM 字段', () => {
  const dir = createTempDir()
  const envPath = writeEnv(
    dir,
    '.env',
    [
      '# 这是注释',
      '',
      'DATABASE_URL=postgres://localhost',
      'OPENAI_API_KEY=sk-test-1234567890',
      'OPENAI_API_BASE=https://api.openai.com/v1',
      'GITHUB_TOKEN=ghp_token_xyz',
      'REDIS_URL=redis://localhost',
      '',
    ].join('\n'),
  )
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath, '--apply', '--strip-flat'])
    assert.equal(r.status, 0, `应 exit 0\nstderr: ${r.err}`)
    assert.match(r.out, /已删除 3 行扁平字段/, '应删除 3 行(OPENAI_API_KEY/BASE + GITHUB_TOKEN)')
    const content = readFileSync(outPath, 'utf8')
    // 删除的字段不应存在
    assert.ok(!content.includes('OPENAI_API_KEY='), 'OPENAI_API_KEY 应被删除')
    assert.ok(!content.includes('OPENAI_API_BASE='), 'OPENAI_API_BASE 应被删除')
    assert.ok(!content.includes('GITHUB_TOKEN='), 'GITHUB_TOKEN 应被删除')
    // 保留的字段
    assert.match(content, /DATABASE_URL=postgres:\/\/localhost/, 'DATABASE_URL 应保留')
    assert.match(content, /REDIS_URL=redis:\/\/localhost/, 'REDIS_URL 应保留')
    assert.match(content, /# 这是注释/, '注释行应保留')
    // LLM_PROVIDERS 应被追加
    assert.match(content, /LLM_PROVIDERS='/, '应含 LLM_PROVIDERS= 行')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 15. parseEnv: 剥离单/双引号包裹 ──────────────────────
test('parseEnv 剥离单/双引号包裹的值', () => {
  const dir = createTempDir()
  const envPath = writeEnv(
    dir,
    '.env',
    'OPENAI_API_KEY="sk-double-quoted-12345678"\nANTHROPIC_API_KEY=\'sk-single-quoted-abcdef\'\n',
  )
  const outPath = join(dir, '.env.migrated')
  try {
    const r = runScript(dir, ['--input', envPath, '--output', outPath])
    assert.equal(r.status, 0, `应 exit 0\nstderr: ${r.err}`)
    const json = JSON.parse(readFileSync(outPath, 'utf8'))
    assert.equal(json.openai.api_key, 'sk-double-quoted-12345678', '应剥离双引号')
    assert.equal(json.anthropic.api_key, 'sk-single-quoted-abcdef', '应剥离单引号')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
