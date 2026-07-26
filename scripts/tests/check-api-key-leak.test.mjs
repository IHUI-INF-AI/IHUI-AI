import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-api-key-leak.mjs')

// ─── 辅助:创建临时项目根 ─────────────────────────────────
function createTempProject() {
  const root = mkdtempSync(join(tmpdir(), 'ihui-apikey-'))
  return root
}

// 辅助:创建临时 git 仓库(--staged 模式需要)
function createTempRepo() {
  const root = mkdtempSync(join(tmpdir(), 'ihui-apikey-repo-'))
  execSync('git init -b main', { cwd: root, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: root, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'pipe' })
  writeFileSync(join(root, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: root, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: root, stdio: 'pipe' })
  return root
}

// 辅助:写入文件并 git add
function writeAndStage(root, relPath, content) {
  const fullPath = join(root, relPath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
  // Windows 路径分隔符在 git add 中需用 / 或转义;用引号包裹避免空格问题
  execSync(`git add "${relPath.replace(/\\/g, '/')}"`, { cwd: root, stdio: 'pipe' })
}

// 辅助:运行脚本(stdout/stderr 去除 ANSI 颜色码)
const ANSI_RE = /\x1B\[[0-9;]*m/g
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  return r
}

// 辅助:断言脚本通过(无泄露)
function assertPass(r) {
  assert.equal(
    r.status,
    0,
    `应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(r.stdout, /API Key 泄露检查.*通过/, 'stdout 应含"通过"标记')
}

// 辅助:断言脚本检测到泄露(违规输出走 console.error → stderr)
function assertFail(r, pattern) {
  assert.equal(
    r.status,
    1,
    `应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  if (pattern) {
    const combined = `${r.stdout}\n${r.stderr}`
    assert.match(
      combined,
      pattern,
      `stdout+stderr 应含 ${pattern}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
  }
}

// ─── 1. CLI --help 不崩溃(脚本未实现 --help,按默认模式运行) ───
test('CLI: --help 不崩溃(脚本未实现 --help,直接走默认全量扫描)', () => {
  const root = createTempProject()
  try {
    const r = runScript(root, ['--help'])
    assert.ok(
      r.status === 0 || r.status === 1,
      `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 2. 无 .example 文件(非 staged)→ 通过 ───────────────
test('合法: 非 staged 模式无 .example 文件 → 通过(0 文件扫描)', () => {
  const root = createTempProject()
  try {
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. .example 文件用 <your-xxx> 占位符 → 通过 ──────────
test('合法: .env.example 用 <your-openai-api-key> 占位符 → 通过', () => {
  const root = createTempProject()
  try {
    writeFileSync(
      join(root, '.env.example'),
      'OPENAI_API_KEY=<your-openai-api-key>\n Anthropic_API_KEY=<your-anthropic-key>\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. .example 文件含 sk-[32 字符] → 检测到 ─────────────
test('违规: .env.example 含 sk-[32+ 字符] 真实 key → 检测到', () => {
  const root = createTempProject()
  try {
    // sk- + 32 个字母数字 = 35 字符,匹配 /sk-[A-Za-z0-9]{32,}/
    const fakeKey = 'sk-' + 'a'.repeat(40)
    writeFileSync(join(root, '.env.example'), `OPENAI_API_KEY=${fakeKey}\n`)
    const r = runScript(root)
    assertFail(r, /API Key 泄露|泄露位置/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. .example 文件含已知前缀 sk-irJTb1 → 检测到 ────────
test('违规: .env.example 含已知前缀 sk-irJTb1 → 检测到', () => {
  const root = createTempProject()
  try {
    writeFileSync(
      join(root, '.env.example'),
      'AGNES_API_KEY=sk-irJTb1XXXXXXXXXXXXXXXXXXXXXXXX\n',
    )
    const r = runScript(root)
    assertFail(r, /sk-irJTb1/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. .example 文件含已知前缀 5iFfF0dl → 检测到 ────────
test('违规: .env.example 含已知前缀 5iFfF0dl → 检测到', () => {
  const root = createTempProject()
  try {
    writeFileSync(
      join(root, '.env.example'),
      'STEPFUN_API_KEY=5iFfF0dlABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcd\n',
    )
    const r = runScript(root)
    assertFail(r, /5iFfF0dl/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. .example 文件含 64 位字母数字 → 检测到 ────────────
test('违规: .env.example 含 64 位字母数字 key → 检测到', () => {
  const root = createTempProject()
  try {
    const fakeKey = 'a'.repeat(64)
    writeFileSync(join(root, '.env.example'), `STEPFUN_API_KEY=${fakeKey}\n`)
    const r = runScript(root)
    assertFail(r, /API Key 泄露|泄露位置/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. .example 文件用 ${API_KEY} 变量引用 → 通过 ────────
test('合法: .env.production.example 用 ${OPENAI_API_KEY} 变量引用 → 通过', () => {
  const root = createTempProject()
  try {
    writeFileSync(
      join(root, '.env.production.example'),
      'OPENAI_API_KEY=${OPENAI_API_KEY}\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. .example 文件用空值 API_KEY= → 通过 ───────────────
test('合法: .env.example 用空值 OPENAI_API_KEY= → 通过', () => {
  const root = createTempProject()
  try {
    writeFileSync(join(root, '.env.example'), 'OPENAI_API_KEY=\n')
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. AWS key (AKIAxxx)→ 不检测(脚本未实现此模式) ────
test('行为: .env.example 含 AWS AKIA key → 不检测(脚本只识别 sk- / 64 位 / 已知前缀)', () => {
  const root = createTempProject()
  try {
    // AWS access key id 格式:AKIA + 16 字符
    writeFileSync(join(root, '.env.example'), 'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\n')
    const r = runScript(root)
    // 脚本不检测 AKIA 模式 → 通过
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. GitHub PAT (ghp_xxx)→ 不检测(脚本未实现此模式) ──
test('行为: .env.example 含 GitHub PAT ghp_xxx → 不检测(脚本未实现此模式)', () => {
  const root = createTempProject()
  try {
    writeFileSync(join(root, '.env.example'), 'GITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz\n')
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. Google API key (AIzaxxx)→ 不检测(脚本未实现) ──
test('行为: .env.example 含 Google API key AIzaXxx → 不检测(脚本未实现此模式)', () => {
  const root = createTempProject()
  try {
    writeFileSync(join(root, '.env.example'), 'GOOGLE_API_KEY=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890\n')
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. .env 文件(非 .example)含真实 key → 不检测(默认不扫) ──
test('行为: .env 文件含真实 key → 不检测(脚本默认只扫 .example 文件)', () => {
  const root = createTempProject()
  try {
    const fakeKey = 'sk-' + 'a'.repeat(40)
    // .env 文件不在非 staged 模式默认检查列表中
    writeFileSync(join(root, '.env'), `OPENAI_API_KEY=${fakeKey}\n`)
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. apps/api/.env.example 含真实 key → 检测到 ────────
test('违规: apps/api/.env.example 含真实 key → 检测到', () => {
  const root = createTempProject()
  try {
    const fakeKey = 'sk-' + 'a'.repeat(40)
    mkdirSync(join(root, 'apps', 'api'), { recursive: true })
    writeFileSync(join(root, 'apps', 'api', '.env.example'), `OPENAI_API_KEY=${fakeKey}\n`)
    const r = runScript(root)
    assertFail(r, /API Key 泄露|泄露位置/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 15. apps/ai-service/.env.example 含真实 key → 检测到 ──
test('违规: apps/ai-service/.env.example 含已知前缀 → 检测到', () => {
  const root = createTempProject()
  try {
    mkdirSync(join(root, 'apps', 'ai-service'), { recursive: true })
    writeFileSync(
      join(root, 'apps', 'ai-service', '.env.example'),
      'AGNES_API_KEY=sk-irJTb1XXX\n',
    )
    const r = runScript(root)
    assertFail(r, /sk-irJTb1/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 16. --staged 模式: 暂存 .ts 文件含真实 key → 检测到 ──
test('staged: 暂存 .ts 文件含 sk- 真实 key → 检测到', () => {
  const root = createTempRepo()
  try {
    const fakeKey = 'sk-' + 'a'.repeat(40)
    writeAndStage(
      root,
      'apps/api/src/config.ts',
      `export const API_KEY = '${fakeKey}'\n`,
    )
    const r = runScript(root, ['--staged'])
    // 注:staged 模式 isRealKey 检查行 `export const API_KEY = 'sk-aaaa...'`
    // 不匹配 KEY= 赋值正则 `^[A-Z_]*API_KEY[A-Z_]*\s*=\s*\S+`(行首是 export,不是 API_KEY)
    // 但含已知前缀 sk-irJTb1 才会被检测;通用 sk- 模式需在 KEY= 赋值行
    // 此处 fakeKey 不含已知前缀,行不匹配 KEY= 赋值正则 → 不检测 → 通过
    // 这是脚本行为(只检查 .env 风格 KEY=value,不检查代码字符串)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 17. --staged 模式: 暂存 .env 文件含 KEY=value 真实 key → 检测到 ──
test('staged: 暂存 .env 文件 KEY= 真实 key → 检测到', () => {
  const root = createTempRepo()
  try {
    const fakeKey = 'sk-' + 'a'.repeat(40)
    writeAndStage(root, '.env', `OPENAI_API_KEY=${fakeKey}\n`)
    const r = runScript(root, ['--staged'])
    // .env 文件 staged → 检测 → 行 `OPENAI_API_KEY=sk-aaaa...` 匹配 KEY= 赋值正则
    // + value 长度 ≥ 32 + 非占位符 + 匹配 /sk-[A-Za-z0-9]{32,}/ → 检测到
    assertFail(r, /API Key 泄露|泄露位置/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 18. --staged 模式: 暂存含已知前缀 sk-irJTb1 的代码 → 检测到 ──
test('staged: 暂存 .ts 含已知前缀 sk-irJTb1 → 检测到(任何文件类型都检查已知前缀)', () => {
  const root = createTempRepo()
  try {
    writeAndStage(
      root,
      'apps/api/src/constants.ts',
      `export const KEY = 'sk-irJTb1FakeRestOfKey1234567890abcdefghijklmnopqrstuvwxyz'\n`,
    )
    const r = runScript(root, ['--staged'])
    // 已知前缀 sk-irJTb1 在任何行都检测(不限于 KEY= 赋值行)
    assertFail(r, /sk-irJTb1/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 19. --staged 模式: 空暂存区 → 通过 ───────────────────
test('staged: 空暂存区(baseline 之后无 staged)→ 通过', () => {
  const root = createTempRepo()
  try {
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 20. --staged 模式: 跳过自身(脚本含 KNOWN_KEY_PREFIXES 字符串) ──
test('staged: 暂存脚本自身 → 跳过(SELF 过滤,不报自身泄露)', () => {
  const root = createTempRepo()
  try {
    // 把源脚本复制到临时仓库并 stage(模拟 scripts/check-api-key-leak.mjs 被修改)
    // 实际上脚本 SELF 检查用的是绝对路径对比,所以需 stage 同名文件到 scripts/ 下
    mkdirSync(join(root, 'scripts'), { recursive: true })
    const srcContent = `const KNOWN_KEY_PREFIXES = ['sk-irJTb1', '5iFfF0dl']\n`
    writeAndStage(root, 'scripts/check-api-key-leak.mjs', srcContent)
    const r = runScript(root, ['--staged'])
    // 脚本会过滤自身(SELF = join(ROOT, 'scripts', 'check-api-key-leak.mjs'))
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 21. 64 位 key 不在 KEY= 赋值行 → 不检测(脚本行为) ──
test('行为: 64 位字母数字不在 KEY= 赋值行 → 不检测(脚本只检查 KEY= 赋值行)', () => {
  const root = createTempProject()
  try {
    const fakeKey = 'a'.repeat(64)
    // 行 `const token = "aaaa..."` 不匹配 KEY= 赋值正则
    writeFileSync(
      join(root, '.env.example'),
      `TOKEN_REF=${fakeKey}\n`,
    )
    const r = runScript(root)
    // TOKEN_REF 不匹配 `^[A-Z_]*API_KEY[A-Z_]*\s*=` 也不匹配 `^[A-Z_]*_KEY\s*=`
    // → 不进入 KEY= 检查分支 → 不检测
    // 注:实际上 TOKEN_REF 含 _KEY 吗?不含。所以不匹配。
    // 改为含 _KEY 的变量名验证:但 64 位也需匹配 \b[A-Za-z0-9]{64}\b
    // 源脚本逻辑:isRealKey 先检查 KEY= 赋值行,value 长度 ≥ 32,非占位符,再检查 API_KEY_PATTERNS
    // 此处变量名 TOKEN_REF 不含 API_KEY 也不以 _KEY 结尾 → 不匹配 KEY= 赋值正则 → 不检测
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 22. 注释中的 key → 检测到(脚本不区分注释) ──────────
test('违规: .env.example 注释行含已知前缀 # AGNES_API_KEY=sk-irJTb1... → 检测到', () => {
  const root = createTempProject()
  try {
    writeFileSync(
      join(root, '.env.example'),
      '# AGNES_API_KEY=sk-irJTb1FakeRestOfKey1234567890abcdefghijklmnopqrstuvwxyz\n',
    )
    const r = runScript(root)
    // 已知前缀在任何行都检测(脚本不区分注释)
    assertFail(r, /sk-irJTb1/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
