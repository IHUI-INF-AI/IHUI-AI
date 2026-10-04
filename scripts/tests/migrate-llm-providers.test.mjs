// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { spawnSync, execFileSync } from 'node:child_process'
import { writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 形态锁必须判**代码面**:本仓库不止一次记过"说明性文字也会带执行性字符" ——
// 源脚本的 JSDoc 里逐字引用了被禁的旧写法,拿原文跑反向锁就会把注释当成代码判红。
// 遮罩实现只有一份(scripts/lib/code-mask.mjs),测试不得自己再写一份。
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(__dirname, '..', '..')
const SCRIPT_PATH = join(__dirname, '..', 'migrate-llm-providers.mjs')

// §22c:判据**直接 import 源函数**,不在测试里抄第二份 flagValue / resolveIoPaths。
// (源脚本已按 §22d 加 isDirectRun 守卫 —— 没有它,这一行 import 就会真跑一次迁移并写文件。)
const { flagValue, resolveIoPaths, DEFAULT_INPUT, DEFAULT_OUTPUT } = await import(
  pathToFileURL(SCRIPT_PATH).href
).then((m) => m.__test__)

// ─── 辅助:strip ANSI 颜色码 ───────────────────────────────
const ANSI_RE = /\x1b\[[0-9;]*m/g
function stripAnsi(s) {
  return (s || '').replace(ANSI_RE, '')
}

// ─── 辅助:创建临时目录(fixture 隔离,不污染项目) ─────────
function createTempDir(prefix = 'ihui-migrate-') {
  return mkScratch(prefix)
}

// ─── 辅助:运行脚本(stdout/stderr 去 ANSI) ────────────────
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ─── 16–24 带值旗标吞掉紧邻旗标这一族(G-322 第二处:唯一会**写盘**的那一处)──────
// 立因是实测,不是读码推测。HEAD 版在临时目录里的真实行为(逐字留档):
//   `--input fixture.env --output --staged`      ⇒ RC=0,stdout `✅ 已写入纯 JSON → --staged`,
//                                                  目录里真长出一个名叫 `--staged` 的文件(59 B,含 api_key);
//   `--input fixture.env --output`(结尾无值)   ⇒ 先读 .env 成功,再 `writeFileSync(undefined)`
//                                                  抛 `node:fs` 的裸 TypeError + 栈,RC=1;
//   `--input --staged ...`                       ⇒ RC=1 但消息是「输入文件不存在: --staged」,
//                                                  把"旗标写错了"报成了"文件找不到"——误导排查方向。
// 现口径:值必须存在、非空且不以 `-` 开头;无效 ⇒ RC=2 + 点名实得 token,且**在读/写任何文件之前**
// 退出(不回落默认路径 —— 回落等于把"用户以为写到别处"换成"静默写到 .env.migrated")。
// 缺省档(不给这两个旗标)由 M21 拿 HEAD 副本做同瞬间 A/B 逐字节对账。

/** 取 HEAD 版脚本落到临时目录,和当前版在同一瞬间对照 —— 不碰仓库、不碰工作树 */
function writeHeadCopy(dir, name = 'migrate.head.mjs') {
  const src = execFileSync(
    'git',
    ['-c', 'safe.directory=*', 'show', 'HEAD:scripts/migrate-llm-providers.mjs'],
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const p = join(dir, name)
  writeFileSync(p, src, 'utf8')
  return p
}

function runFile(cwd, scriptPath, args) {
  return runScriptLike(cwd, scriptPath, args)
}

function runScriptLike(cwd, scriptPath, args) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  r.out = stripAnsi(r.stdout)
  r.err = stripAnsi(r.stderr)
  return r
}

const STACK_FRAME_RE = /^\s+at\s+\S/m

// ─── 16. 反例:`--output --staged` ⇒ RC=2 + 点名 token + 零写盘副作用 ───────────
test('反例 --output --staged ⇒ exit 2、点名实得 token、不产出 --staged 文件、也不回落默认路径', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, 'fixture.env', 'OPENAI_API_KEY=sk-leak-1234567890\n')
  try {
    const r = runScriptLike(dir, SCRIPT_PATH, ['--input', envPath, '--output', '--staged'])
    assert.equal(r.status, 2, `应 exit 2,实得 ${r.status}\nstdout:${r.out}\nstderr:${r.err}`)
    assert.match(r.err, /--output 没有收到有效的路径/)
    assert.match(r.err, /"--staged"/, `必须点名实得 token,实得:${r.err}`)
    assert.ok(!STACK_FRAME_RE.test(r.err), `不得打裸栈:\n${r.err}`)
    // 副作用面:既不许产出那个垃圾文件,也**不许回落到默认输出路径**(那同样是写盘)
    assert.ok(!existsSync(join(dir, '--staged')), '仍然写出了名叫 --staged 的文件')
    assert.ok(!existsSync(join(dir, '.env.migrated')), '不得回落到默认输出路径写盘')
    assert.doesNotMatch(r.out, /已写入/, `stdout 不得报"已写入":\n${r.out}`)
    assert.equal(readdirSync(dir).sort().join(','), 'fixture.env', '临时目录里不得多出任何文件')
  } finally {
    rmScratch(dir)
  }
})

// ─── 17. 反例:`--apply --output --staged`(最危险的那一档)────────────────────
test('反例 --apply --output --staged ⇒ 写盘档同样在读/写之前判死', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, 'fixture.env', 'OPENAI_API_KEY=sk-leak-1234567890\n')
  try {
    const r = runScriptLike(dir, SCRIPT_PATH, ['--input', envPath, '--output', '--staged', '--apply'])
    assert.equal(r.status, 2, `--apply 档必须同样 exit 2,实得 ${r.status}\nstderr:${r.err}`)
    assert.match(r.err, /"--staged"/)
    assert.ok(!existsSync(join(dir, '--staged')), '--apply 下仍然写出了名叫 --staged 的文件')
    assert.ok(!existsSync(join(dir, '.env.migrated')), '不得回落到默认输出路径')
    assert.equal(readdirSync(dir).sort().join(','), 'fixture.env')
  } finally {
    rmScratch(dir)
  }
})

// ─── 18. 反例:`--input --staged` ⇒ 说清是"旗标没给值",不是"文件不存在" ────────
test('反例 --input --staged ⇒ exit 2 且点名旗标本身(旧版报的是误导性的"输入文件不存在")', () => {
  const dir = createTempDir()
  writeEnv(dir, 'fixture.env', 'OPENAI_API_KEY=sk-leak-1234567890\n')
  try {
    const r = runScriptLike(dir, SCRIPT_PATH, ['--input', '--staged', '--output', 'out.json'])
    assert.equal(r.status, 2, `实得 ${r.status}\nstderr:${r.err}`)
    assert.match(r.err, /--input 没有收到有效的路径/)
    assert.match(r.err, /"--staged"/)
    assert.doesNotMatch(r.err, /输入文件不存在/, '不得把"旗标写错"报成"文件找不到"')
    assert.ok(!existsSync(join(dir, 'out.json')))
  } finally {
    rmScratch(dir)
  }
})

// ─── 19. 反例:`--output` 结尾无值 ⇒ RC=2 点名"没给值"(旧版是裸 TypeError + 栈)──
test('反例 --output 结尾无值 ⇒ exit 2 + 点名"其后没有任何参数",不打裸栈', () => {
  const dir = createTempDir()
  writeEnv(dir, '.env', 'OPENAI_API_KEY=sk-abc123456789\n')
  try {
    const r = runScriptLike(dir, SCRIPT_PATH, ['--output'])
    assert.equal(r.status, 2, `实得 ${r.status}\nstderr:${r.err}`)
    assert.match(r.err, /\(其后没有任何参数\)/)
    assert.ok(!STACK_FRAME_RE.test(r.err), `旧版这里是 node:fs 的裸 TypeError + 栈:\n${r.err}`)
    assert.equal(readdirSync(dir).sort().join(','), '.env', '不得有任何写盘副作用')
  } finally {
    rmScratch(dir)
  }
})

// ─── 20. 正例:合法值照旧生效(--apply 真写盘、真读输入)───────────────────────
test('正例 --input/--output 给合法路径 ⇒ --apply 仍正常读写(校验没把功能改坏)', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, 'fixture.env', 'OPENAI_API_KEY=sk-real-1234567890\nDATABASE_URL=postgres://x\n')
  const outPath = join(dir, 'out.env')
  try {
    const r = runScriptLike(dir, SCRIPT_PATH, ['--input', envPath, '--output', outPath, '--apply'])
    assert.equal(r.status, 0, `实得 ${r.status}\nstderr:${r.err}`)
    assert.match(r.out, /已写入完整 \.env/)
    const content = readFileSync(outPath, 'utf8')
    assert.match(content, /LLM_PROVIDERS='/)
    assert.match(content, /DATABASE_URL=postgres:\/\/x/, '原有字段应保留')
    assert.ok(!existsSync(join(dir, '.env.migrated')), '给了 --output 就不该同时写默认路径')
  } finally {
    rmScratch(dir)
  }
})

// ─── 21. 缺省档逐字节 A/B:同一瞬间拿 HEAD 副本与新副本对照 ─────────────────────
test('缺省档逐字不变:同瞬间拿 HEAD 副本与新副本跑,stdout/stderr/RC/产物字节全等', (t) => {
  const cases = [
    { name: '显式合法路径', args: ['--input', 'fixture.env', '--output', 'out.json'] },
    { name: '一个旗标都不给(纯默认档)', args: [] },
    { name: '默认档 + --apply', args: ['--apply'] },
    { name: '默认档 + --dry-run', args: ['--dry-run'] },
  ]
  for (const c of cases) {
    const dirA = createTempDir()
    const dirB = createTempDir()
    try {
      const fixture = 'OPENAI_API_KEY=sk-ab-1234567890\nGITHUB_TOKEN=ghtok-abcdefgh\n'
      for (const d of [dirA, dirB]) {
        writeEnv(d, 'fixture.env', fixture)
        writeEnv(d, '.env', fixture)
      }
      const head = writeHeadCopy(dirA)
      // 相对路径跑,产物名一致 ⇒ 字节可比(绝对路径会把两个临时目录名本身打进输出)
      const a = runFile(dirA, head, c.args)
      const b = runFile(dirB, SCRIPT_PATH, c.args)
      assert.equal(b.status, a.status, `${c.name}:RC 不同 a=${a.status} b=${b.status}\n${a.err}\n${b.err}`)
      assert.equal(b.out, a.out, `${c.name}:stdout 不同形\n--- HEAD ---\n${a.out}\n--- 现在 ---\n${b.out}`)
      assert.equal(b.err, a.err, `${c.name}:stderr 不同形\n${a.err}\n${b.err}`)
      const filesA = readdirSync(dirA).filter((f) => !f.endsWith('.mjs')).sort()
      const filesB = readdirSync(dirB).sort()
      assert.deepEqual(filesB, filesA, `${c.name}:产物文件集合不同`)
      for (const f of filesB) {
        if (f === 'fixture.env' || f === '.env') continue
        // Buffer 用 assert.equal 比是**按引用**比(两个不同 Buffer 永不 ===),
        // 这里要的是字节全等 ⇒ 走 Buffer.equals,并把长度报出来,免得"看着不等"无从判读。
        const bufB = readFileSync(join(dirB, f))
        const bufA = readFileSync(join(dirA, f))
        assert.ok(
          bufB.equals(bufA),
          `${c.name}:${f} 字节不等(a=${bufA.length}B b=${bufB.length}B)\n--- HEAD ---\n${bufA}\n--- 现在 ---\n${bufB}`,
        )
      }
      t.diagnostic(`${c.name}: A/B RC=${a.status} 产物 [${filesA.join(',')}] 逐字节等值`)
    } finally {
      rmScratch(dirA)
      rmScratch(dirB)
    }
  }
})

// ─── 22. 纯函数面(§22c:import 源判据,不抄第二份)──────────────────────────
test('纯函数 resolveIoPaths:默认档 / 合法值 / 三种无效值', () => {
  assert.equal(DEFAULT_INPUT, '.env', '默认输入路径不得被改动')
  assert.equal(DEFAULT_OUTPUT, '.env.migrated', '默认输出路径不得被改动')
  const none = resolveIoPaths([])
  assert.deepEqual(
    { input: none.input, output: none.output, invalid: none.invalid, errorLines: none.errorLines },
    { input: '.env', output: '.env.migrated', invalid: [], errorLines: [] },
    '不给旗标时必须与改前逐字同形',
  )
  const ok = resolveIoPaths(['--input', 'a.env', '--output', 'b.env'])
  assert.deepEqual({ i: ok.input, o: ok.output, n: ok.invalid.length }, { i: 'a.env', o: 'b.env', n: 0 })
  for (const bad of [['--output', '--staged'], ['--output'], ['--input', ''], ['--input', '--apply']]) {
    const flag = bad[0]
    const r = resolveIoPaths(bad)
    assert.equal(r.invalid.length, 1, `${flag} 的无效值应被点到名:${JSON.stringify(r.invalid)}`)
    assert.equal(r.invalid[0].flag, flag)
    assert.ok(r.errorLines.length > 0, '必须给出可复制的出路文案')
  }
  // flagValue 自身的最小四态(改前该函数不存在,由本族修法引入)
  assert.equal(flagValue([], '--input').present, false)
  assert.equal(flagValue(['--input', 'x'], '--input').valid, true)
  assert.equal(flagValue(['--input', '--output'], '--input').valid, false)
  assert.equal(flagValue(['--input'], '--input').token, null)
})

// ─── 23. 形态锁:旧写法不得回来,且校验必须排在任何 read/write 之前 ─────────────
test('装车锁:resolveIoPaths 必须真被 main 调用,且排在第一次读文件之前', () => {
  const raw = readFileSync(SCRIPT_PATH, 'utf8')
  // 正向锁走**代码面**(遮注释与字符串):本仓库不止一次记过"说明性文字也会带执行性字符",
  // 而本脚本的 JSDoc 里逐字引用了被禁的旧写法 —— 不遮就是门给自己发合格证的反面(误红)。
  const code = maskCommentsAndStrings(raw)
  assert.ok(/const io = resolveIoPaths\(args\)/.test(code), 'main() 没调用 resolveIoPaths ⇒ 新校验是死代码')
  const callAt = code.indexOf('const io = resolveIoPaths(args)')
  const invalidAt = code.indexOf('io.invalid.length')
  const firstRead = code.indexOf('readFileSync(input')
  assert.ok(callAt >= 0 && invalidAt > callAt, 'invalid 判定必须紧跟取值')
  assert.ok(firstRead > invalidAt, '路径校验必须排在**任何** readFileSync 之前 —— 否则"先读后判"仍能落盘')
  assert.ok(code.indexOf('writeFileSync(output') > invalidAt, '同上,写盘之前必须先判过')
  // "值不得以 - 开头"这条判据必须在**代码面**存在。刻意不带引号里的 `-`:遮罩会把字符串内容
  // 抹成空格,写成 `startsWith('-')` 的断言在遮罩面上永远匹配不到(那又是一条恒假/恒真的空断言)。
  assert.match(code, /!\s*token\.startsWith\(/, '"值不得以 - 开头"这一条判据本身不得被删')
  // 反向锁走**原始面**,但只认"旧写法的标识符":遮罩会把字符串抹掉,拿含引号的模式去负向匹配
  // 会得到一条**永远为真**的断言(与本仓"永远绿的断言与永远红的断言同样没用"是同一条禁令)。
  // `inputIdx` / `outputIdx` 只存在于旧的 `args[args.indexOf(…) + 1]` 取值形态里,注释不会提到。
  assert.ok(!/\binputIdx\b/.test(raw), '旧的 inputIdx 吞值写法又回来了')
  assert.ok(!/\boutputIdx\b/.test(raw), '旧的 outputIdx 吞值写法又回来了')
  // §22d:被 import 时不得触发 CLI(本文件顶部那次 import 就是它的正向证明)
  assert.match(
    code,
    /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/,
  )
  assert.match(code, /if \(isDirectRun\) \{/)
})

// ─── 24. 反向对照:本族修法不得只是"把 --staged 当特例" ────────────────────────
test('判据是"值不能以 - 开头"这一条通用规则,不是给 --staged 开的特例', () => {
  const dir = createTempDir()
  const envPath = writeEnv(dir, 'fixture.env', 'OPENAI_API_KEY=sk-x-1234567890\n')
  // 刻意不列 '-h' / '--help':帮助分支排在取值校验**之前**(改前就如此,本次一字未动),
  // 所以 `--output -h` 走的是"打印帮助并 exit 0"这条既有路径,不是吞值 —— 拿它当反例会把
  // 一条既有行为误判成本票要修的形态。
  try {
    for (const swallowed of ['--staged', '--apply', '--dry-run', '--backup', '--redact']) {
      const r = runScriptLike(dir, SCRIPT_PATH, ['--input', envPath, '--output', swallowed])
      assert.equal(r.status, 2, `--output ${swallowed} 应 exit 2,实得 ${r.status}\nstderr:${r.err}`)
      assert.ok(!existsSync(join(dir, swallowed)), `仍然产出了名叫 ${swallowed} 的文件`)
    }
    assert.equal(readdirSync(dir).sort().join(','), 'fixture.env', '不得有写盘副作用')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
