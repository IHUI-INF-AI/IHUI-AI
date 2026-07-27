import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-nativewind-status.mjs')

const IS_WIN = process.platform === 'win32'

// ─── 辅助:创建临时目录并放入 fake npm ─────────────────────
// 源脚本通过 execSync('npm view nativewind dist-tags --json') 联网查询 npm registry,
// 测试通过 PATH 注入 fake npm(返回固定 dist-tags JSON)实现隔离:
//   - 不依赖真实 npm registry(版本号会变,且网络可能不可用)
//   - 不污染项目(临时目录用完即删)
//   - 不修改源脚本(只读)
// fake npm 的行为由环境变量 NPM_FAKE_MODE / NPM_FAKE_RESPONSE 控制:
//   - mode='success'(默认):stdout 输出 NPM_FAKE_RESPONSE,exit 0
//   - mode='error':stderr 输出错误信息,exit 1(模拟网络不可用)
function createFakeNpmDir() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nativewind-'))
  // fake npm 核心逻辑(CommonJS,通过 env 变量控制输出)
  const fakeCjs = [
    "const mode = process.env.NPM_FAKE_MODE || 'success'",
    "const response = process.env.NPM_FAKE_RESPONSE || '{}'",
    "if (mode === 'error') {",
    "  process.stderr.write('npm error: network unreachable\\n')",
    '  process.exit(1)',
    '}',
    'process.stdout.write(response)',
  ].join('\n')
  writeFileSync(join(dir, 'npm-fake.cjs'), fakeCjs)
  if (IS_WIN) {
    // Windows: cmd.exe 通过 PATHEXT 解析 npm → 需 npm.cmd
    writeFileSync(join(dir, 'npm.cmd'), '@node "%~dp0npm-fake.cjs" %*\r\n')
  } else {
    // Unix: /bin/sh 解析 npm → 需 shebang + 可执行权限
    writeFileSync(
      join(dir, 'npm'),
      '#!/bin/sh\nnode "$(dirname "$0")/npm-fake.cjs" "$@"\n',
    )
    chmodSync(join(dir, 'npm'), 0o755)
  }
  return dir
}

// ─── 辅助:向 env 的 PATH 前置注入目录(Windows 大小写不敏感) ───
function prependToPath(env, dir) {
  const sep = IS_WIN ? ';' : ':'
  const key =
    Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH'
  env[key] = dir + sep + (env[key] || '')
}

// ─── 辅助:运行脚本 ───────────────────────────────────────
// npmDir:fake npm 所在目录(前置到 PATH)
// mode:NPM_FAKE_MODE('success' | 'error')
// response:NPM_FAKE_RESPONSE(成功时输出的 dist-tags JSON 字符串)
const ANSI_RE = /\x1b\[[0-9;]*m/g
function runScript({ npmDir, mode, response } = {}) {
  const env = { ...process.env }
  if (npmDir) prependToPath(env, npmDir)
  if (mode !== undefined) env.NPM_FAKE_MODE = mode
  if (response !== undefined) env.NPM_FAKE_RESPONSE = response
  const r = spawnSync('node', [SCRIPT_PATH], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  r.all = `${r.stdout || ''}\n${r.stderr || ''}`
  return r
}

// ─── 1. latest = "4.1.0"(仍是 4.x)→ exit 0 + 提示"仍是 4.x" ───
test('latest = "4.1.0" → exit 0 + 提示"仍是 4.x"', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '4.1.0', preview: '5.0.0-preview.1' }),
    })
    assert.equal(r.status, 0, `4.x 应 exit 0\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /仍是 4\.x/)
    assert.match(r.stdout, /尚未发布/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 2. latest = "4.0.0" 且无 preview tag → exit 0,不输出 preview 行 ─
test('latest = "4.0.0" 无 preview tag → exit 0,不输出 preview 行', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '4.0.0' }),
    })
    assert.equal(r.status, 0, `4.x 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /仍是 4\.x/)
    assert.doesNotMatch(r.stdout, /preview tag/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 3. latest = "5.0.0"(纯 5.x.y,stable)→ exit 1 + "5.0 stable 已发布" ─
test('latest = "5.0.0" → exit 1 + "5.0 stable 已发布"', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '5.0.0' }),
    })
    assert.equal(r.status, 1, `5.0 stable 应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /5\.0 stable 已发布/)
    assert.match(r.stdout, /移除 apps\/mobile-rn\/metro\.config\.js/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 4. latest = "5.1.2"(任意 5.x.y 纯数字)→ exit 1 ─────────
test('latest = "5.1.2" → exit 1(任意 5.x.y 纯数字均视为 stable)', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '5.1.2' }),
    })
    assert.equal(r.status, 1, `5.1.2 应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /5\.0 stable 已发布/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 5. latest = "5.0.0-preview.1"(5.x preview)→ exit 0 ─────
test('latest = "5.0.0-preview.1" → exit 0 + "仍为 5.x preview,非 stable"', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '5.0.0-preview.1' }),
    })
    assert.equal(r.status, 0, `5.x preview 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /仍为 5\.x preview,非 stable/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 6. latest = "5.1.0-preview.0" → exit 0(5.x preview 任意版本)──
test('latest = "5.1.0-preview.0" → exit 0(5.x preview 任意版本)', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '5.1.0-preview.0' }),
    })
    assert.equal(r.status, 0, `5.x preview 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /仍为 5\.x preview,非 stable/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 7. latest = "5.0.0" 且有 preview tag → exit 1,preview 行也输出 ─
test('latest = "5.0.0" 且有 preview tag → exit 1,preview tag 行也输出', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '5.0.0', preview: '5.1.0-preview.0' }),
    })
    assert.equal(r.status, 1, `5.0 stable 应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /5\.0 stable 已发布/)
    assert.match(r.stdout, /preview tag: 5\.1\.0-preview\.0/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 8. dist-tags 缺少 latest 字段 → exit 2 + 警告 ────────────
test('dist-tags 缺少 latest 字段 → exit 2 + 警告"缺少 latest 字段"', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ preview: '5.0.0-preview.1' }),
    })
    assert.equal(r.status, 2, `缺 latest 应 exit 2\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /缺少 latest 字段/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 9. npm 命令失败(网络错误)→ exit 2 + "查询失败" ──────────
test('npm 命令失败(模拟网络错误)→ exit 2 + "查询失败"', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({ npmDir, mode: 'error' })
    assert.equal(r.status, 2, `网络错误应 exit 2\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /查询失败/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 10. npm 返回非法 JSON → exit 2(JSON.parse 抛错被捕获)────
test('npm 返回非法 JSON → exit 2(JSON.parse 抛错被 try/catch 捕获)', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({ npmDir, response: 'not a json {{{' })
    assert.equal(r.status, 2, `非法 JSON 应 exit 2\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /查询失败/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 11. latest = "6.0.0"(非 4.x / 非 5.x stable / 非 preview)→ exit 0 ─
test('latest = "6.0.0" → exit 0 + "非 5.0 stable"(兜底分支)', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '6.0.0' }),
    })
    assert.equal(r.status, 0, `6.x 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /非 5\.0 stable/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 12. latest = "5.0.0-beta"(5.x 但非 preview 后缀)→ exit 0 ─
test('latest = "5.0.0-beta" → exit 0 + "非 5.0 stable"(非 preview 后缀走兜底)', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '5.0.0-beta' }),
    })
    assert.equal(r.status, 0, `5.0.0-beta 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /非 5\.0 stable/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 13. latest = "3.5.0"(更老版本)→ exit 0 + "非 5.0 stable" ──
test('latest = "3.5.0" → exit 0 + "非 5.0 stable"(更老版本走兜底)', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '3.5.0' }),
    })
    assert.equal(r.status, 0, `3.x 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /非 5\.0 stable/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 14. stable 5 输出含完整升级步骤(4 步) → exit 1 ──────────
test('stable 5 输出含完整升级步骤(升级/移除 monkey-patch/删除依赖/冒烟测试)', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '5.0.0' }),
    })
    assert.equal(r.status, 1, `stable 5 应 exit 1\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /升级 nativewind 到 5\.x stable/)
    assert.match(r.stdout, /移除 metro\.config\.js 中的 Module\._resolveFilename monkey-patch/)
    assert.match(r.stdout, /删除 apps\/mobile-rn 本地 tailwindcss@3 依赖/)
    assert.match(r.stdout, /className 全链路冒烟测试/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})

// ─── 15. 4.x 输出含 latest tag 行(无 5.0 stable 标记)→ exit 0 ─
test('4.x 输出含 latest tag 行且无 "5.0 stable" 标记', () => {
  const npmDir = createFakeNpmDir()
  try {
    const r = runScript({
      npmDir,
      response: JSON.stringify({ latest: '4.2.1' }),
    })
    assert.equal(r.status, 0, `4.x 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /latest  tag: 4\.2\.1/)
    // 不应出现 5.0 stable 标记
    assert.doesNotMatch(r.stdout, /← 5\.0 stable!/)
  } finally {
    rmSync(npmDir, { recursive: true, force: true })
  }
})
