import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-sanitizer-bypass.mjs')

// ─── 辅助:创建临时 git 仓库 ───────────────────────────────
function createTempRepo() {
  const root = mkdtempSync(join(tmpdir(), 'ihui-sanitizer-'))
  execSync('git init -b main', { cwd: root, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: root, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'pipe' })
  mkdirSync(join(root, 'apps', 'api', 'src', 'routes'), { recursive: true })
  writeFileSync(join(root, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: root, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: root, stdio: 'pipe' })
  return root
}

// 辅助:写入一个 routes 文件并 git add(进入 staged 区)
function writeRoute(root, fileName, content) {
  const fullPath = join(root, 'apps', 'api', 'src', 'routes', fileName)
  writeFileSync(fullPath, content)
  execSync(`git add apps/api/src/routes/${fileName}`, { cwd: root, stdio: 'pipe' })
}

// 辅助:在 routes 子目录下写入文件并 git add(验证 full 模式递归扫描子目录)
function writeRouteInSubdir(root, subdir, fileName, content) {
  const dir = join(root, 'apps', 'api', 'src', 'routes', subdir)
  mkdirSync(dir, { recursive: true })
  const fullPath = join(dir, fileName)
  writeFileSync(fullPath, content)
  execSync(`git add apps/api/src/routes/${subdir}/${fileName}`, {
    cwd: root,
    stdio: 'pipe',
  })
}

// 辅助:写入 __tests__ 目录下的文件并 git add
function writeTestFile(root, fileName, content) {
  const dir = join(root, 'apps', 'api', 'src', 'routes', '__tests__')
  mkdirSync(dir, { recursive: true })
  const fullPath = join(dir, fileName)
  writeFileSync(fullPath, content)
  execSync(`git add "apps/api/src/routes/__tests__/${fileName}"`, { cwd: root, stdio: 'pipe' })
}

// 辅助:运行脚本(stdout/stderr 去除 ANSI 颜色码,违规输出走 console.error → stderr)
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

// 辅助:断言脚本通过(无违规)
function assertPass(r) {
  assert.equal(
    r.status,
    0,
    `应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(r.stdout, /skipResponseSanitization 一致性检查通过/, 'stdout 应含"通过"标记')
}

// 辅助:断言脚本检测到违规(违规输出走 console.error → stderr)
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

// 注:源脚本全量模式用 `git ls-files apps/api/src/routes/`(列目录 + JS 过滤 .ts),
// 不再用 `git ls-files "apps/api/src/routes/**/*.ts"` —— 该 glob 在 Windows +
// Git for Windows 默认 pathspec 下不工作(返回空)。修复后 full 模式可在 Windows
// 正常扫描子目录,见下方 full 模式测试用例。

// ─── 1. CLI --help 不崩溃(脚本未实现 --help,按默认模式运行) ───
test('CLI: --help 不崩溃(脚本未实现 --help,直接走默认全量扫描)', () => {
  const root = createTempRepo()
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

// ─── 2. 合法 routes 文件(无敏感字段)→ 通过 ────────────────
test('合法: routes 文件无敏感字段 → 通过', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'health.ts',
      `export default async function health(fastify) {\n` +
        `  fastify.get('/health', async (request, reply) => {\n` +
        `    reply.send({ status: 'ok' })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. 含 accessToken + reply.send 但无 bypass → 违规 ────
test('违规: accessToken 在 reply.send 上下文 + 无 skipResponseSanitization → 检测到', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'token-endpoint.ts',
      `export default async function token(fastify) {\n` +
        `  fastify.post('/token', async (request, reply) => {\n` +
        `    const accessToken = generateToken()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertFail(r, /token-endpoint\.ts/)
    assert.match(r.stderr, /accessToken/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. 含 refreshToken + success() 但无 bypass → 违规 ────
test('违规: refreshToken 在 success() 上下文 + 无 bypass → 检测到', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'refresh.ts',
      `import { success } from '../utils'\n` +
        `export default async function refresh(fastify) {\n` +
        `  fastify.post('/refresh', async (request, reply) => {\n` +
        `    const refreshToken = issueRefresh()\n` +
        `    return success({ refreshToken })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertFail(r, /refresh\.ts/)
    assert.match(r.stderr, /refreshToken/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. 含敏感字段 + skipResponseSanitization = true → 通过 ──
test('合法: 含 accessToken + skipResponseSanitization=true → 通过', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'token-bypass.ts',
      `export default async function token(fastify) {\n` +
        `  fastify.post('/token', async (request, reply) => {\n` +
        `    request.skipResponseSanitization = true\n` +
        `    const accessToken = generateToken()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. 白名单文件(auth.ts)含敏感字段 → 通过 ─────────────
test('白名单: auth.ts 含 accessToken + reply.send → 通过(白名单豁免)', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'auth.ts',
      `export default async function auth(fastify) {\n` +
        `  fastify.post('/login', async (request, reply) => {\n` +
        `    const accessToken = generateToken()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. 白名单文件 users.ts / admin.ts → 通过 ────────────
test('白名单: users.ts / admin.ts 含敏感字段 → 通过', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'users.ts',
      `export default async function users(fastify) {\n` +
        `  fastify.get('/me', async (request, reply) => {\n` +
        `    reply.send({ accessToken: 'x' })\n` +
        `  })\n` +
        `}\n`,
    )
    writeRoute(
      root,
      'admin.ts',
      `export default async function admin(fastify) {\n` +
        `  fastify.get('/admin', async (request, reply) => {\n` +
        `    reply.send({ clientSecret: 'x' })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. 敏感字段不在 reply.send 上下文(超出 5 行)→ 通过 ──
test('合法: 敏感字段离 reply.send 上下文 > 5 行 → 不算违规', () => {
  const root = createTempRepo()
  try {
    const lines = [
      "import { something } from '../utils'",
      'const accessToken = "placeholder"',
      '',
      '// separator line 1',
      '// separator line 2',
      '// separator line 3',
      '// separator line 4',
      '// separator line 5',
      '// separator line 6',
      '// separator line 7',
      "export default async function (fastify) {",
      '  fastify.get("/x", async (request, reply) => {',
      "    reply.send({ status: 'ok' })",
      '  })',
      '}',
      '',
    ]
    writeRoute(root, 'far.ts', lines.join('\n'))
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. __tests__/ 目录文件 → 跳过(--staged 模式过滤 __tests__/) ──
test('跳过: __tests__/ 目录文件不扫描(脚本过滤 __tests__/)', () => {
  const root = createTempRepo()
  try {
    writeTestFile(
      root,
      'mock-token.test.ts',
      `test('mock', () => {\n` +
        `  const accessToken = 'mock-token'\n` +
        `  expect(accessToken).toBe('mock-token')\n` +
        `})\n`,
    )
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. schema 定义行(clientSecret: { type: 'string' })→ 跳过 ──
test('跳过: schema 定义行(clientSecret: { type: "string" })', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'schema-def.ts',
      `export default async function (fastify) {\n` +
        `  const schema = {\n` +
        `    body: {\n` +
        `      type: 'object',\n` +
        `      properties: {\n` +
        `        clientSecret: { type: 'string' },\n` +
        `      },\n` +
        `    },\n` +
        `  }\n` +
        `  fastify.post('/x', { schema }, async (request, reply) => {\n` +
        `    reply.send({ ok: true })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. const { accessToken } = ... 解构声明 → 跳过 ──────
test('跳过: const { accessToken } = ... 解构声明行', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'destruct.ts',
      `export default async function (fastify) {\n` +
        `  fastify.get('/x', async (request, reply) => {\n` +
        `    const { accessToken } = await someCall()\n` +
        `    reply.send({ ok: true })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. access_token / refresh_token(snake_case)→ 检测到 ──
test('违规: access_token(snake_case)在 reply.send 上下文 → 检测到', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'snake.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/token', async (request, reply) => {\n` +
        `    const access_token = gen()\n` +
        `    reply.send({ access_token })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertFail(r, /snake\.ts/)
    assert.match(r.stderr, /access_token/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. clientSecret / apiSecret → 检测到 ────────────────
test('违规: clientSecret 在 reply.send 上下文 → 检测到', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'client-secret.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/oauth', async (request, reply) => {\n` +
        `    const clientSecret = oauthGen()\n` +
        `    reply.send({ clientSecret })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertFail(r, /client-secret\.ts/)
    assert.match(r.stderr, /clientSecret/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. reply.status(...) 上下文 → 检测到 ────────────────
test('违规: reply.status(200).send(...) 含 accessToken → 检测到', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'status-call.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/x', async (request, reply) => {\n` +
        `    const accessToken = gen()\n` +
        `    reply.status(200).send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertFail(r, /status-call\.ts/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 15. --staged 模式: 暂存违规文件 → 检测到 ─────────────
test('staged: 暂存违规文件 → 检测到 exit 1', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'staged-bad.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/x', async (request, reply) => {\n` +
        `    const accessToken = gen()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertFail(r, /staged-bad\.ts/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 16. --staged 模式: 空暂存区 → 通过 ───────────────────
test('staged: 空暂存区(baseline 之后无 routes staged)→ exit 0', () => {
  const root = createTempRepo()
  try {
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 17. 多违规文件批量报告 ───────────────────────────────
test('批量: 2 个违规文件 + 1 个白名单 → 报告 2 个违规', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'bad1.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/a', async (req, reply) => {\n` +
        `    const accessToken = gen()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    writeRoute(
      root,
      'auth.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/b', async (req, reply) => {\n` +
        `    const accessToken = gen()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    writeRoute(
      root,
      'bad2.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/c', async (req, reply) => {\n` +
        `    const refreshToken = gen()\n` +
        `    reply.send({ refreshToken })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root, ['--staged'])
    assertFail(r)
    assert.match(r.stderr, /bad1\.ts/)
    assert.match(r.stderr, /bad2\.ts/)
    // auth.ts 是白名单,不应出现在违规列表中
    assert.ok(
      !/auth\.ts/.test(r.stderr),
      'auth.ts 白名单不应报告为违规',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 18. 全量模式(无 --staged)不 crash(烟雾测试) ──
// 修复后源脚本用 `git ls-files apps/api/src/routes/`(列目录 + JS 过滤),
// 在 Windows 下也能正常工作。这里仅做烟雾测试(不 crash),
// 完整的 full 模式违规检测见下方测试 19 / 20。
test('全量模式(烟雾): 无 --staged → 不 crash(Windows 下 git ls-files 列目录生效)', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'full-bad.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/x', async (req, reply) => {\n` +
        `    const accessToken = gen()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    // 全量模式下,文件已 git add 进 staged 区但未 commit → git ls-files 仍能列出来
    // 修复后列目录 + JS 过滤 .ts 可正常匹配 → 检测到违规 → exit 1
    const r = runScript(root)
    assert.ok(
      r.status === 0 || r.status === 1,
      `全量模式不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `不应产生未捕获 Error`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 19. full 模式:子目录 .ts 文件扫描(admin/foo.ts 扫到,__tests__/foo.ts 跳过) ──
// 修复前 `git ls-files "apps/api/src/routes/**/*.ts"` 在 Windows 下对子目录匹配
// 不稳定,经常漏检 admin/ 等子目录下的违规文件。修复后改用列目录 + JS 过滤,
// 可正确扫描所有子目录(仅排除 __tests__/)。
test('full 模式: admin/ 子目录违规被扫描,__tests__/ 跳过', () => {
  const root = createTempRepo()
  try {
    // admin/ 子目录下违规文件 → 应被检测(验证递归扫描)
    writeRouteInSubdir(
      root,
      'admin',
      'subdir-bad.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/admin/x', async (req, reply) => {\n` +
        `    const accessToken = gen()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    // __tests__/ 目录下同样违规的文件 → 应被跳过(脚本过滤 __tests__/)
    writeTestFile(
      root,
      'test-bad.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/test', async (req, reply) => {\n` +
        `    const accessToken = gen()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root) // 无 --staged → full 模式
    // admin/subdir-bad.ts 应被检测到
    assertFail(r, /subdir-bad\.ts/)
    assert.match(r.stderr, /accessToken/)
    // __tests__/test-bad.ts 不应被报告(脚本过滤 __tests__/)
    assert.ok(
      !/test-bad\.ts/.test(r.stderr),
      '__tests__/test-bad.ts 不应被报告为违规(脚本过滤 __tests__/)',
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 20. full 模式: apps/api/src/routes/test-file.ts 违规 → 检测到 exit 1 ──
test('full 模式: test-file.ts 含 skipResponseSanitization 违规 → 检测到 exit 1', () => {
  const root = createTempRepo()
  try {
    writeRoute(
      root,
      'test-file.ts',
      `export default async function (fastify) {\n` +
        `  fastify.post('/token', async (request, reply) => {\n` +
        `    const accessToken = generateToken()\n` +
        `    reply.send({ accessToken })\n` +
        `  })\n` +
        `}\n`,
    )
    const r = runScript(root) // 无 --staged → full 模式
    assertFail(r, /test-file\.ts/)
    assert.match(r.stderr, /accessToken/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
