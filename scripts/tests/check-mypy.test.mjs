import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(__dirname, '..', 'check-mypy.mjs')

// ─── 辅助:创建临时 git 仓库 + 复制脚本 + stub mypy ──────────
// check-mypy.mjs 用 process.cwd() 推导 ROOT,需在临时仓库 cwd 运行脚本。
// 源脚本只读不改,仅运行副本。
// stub mypy(.stub-bin/mypy.cmd + mypy-stub.js)通过 PATH 注入,
// 读取 STUB_MYPY_EXIT / STUB_MYPY_OUT 环境变量实现可控退出码与输出,
// 使测试不依赖真实 mypy 安装,结果确定性。
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-mypy-'))
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  // 复制源脚本到 <dir>/scripts/check-mypy.mjs(不改源脚本)
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-mypy.mjs'))
  // 创建 apps/ai-service/app/(mypy 命令的 cwd 与参数路径)
  mkdirSync(join(dir, 'apps', 'ai-service', 'app'), { recursive: true })
  // 创建 stub mypy(.cmd 包装 + .js 实现可控退出)
  const binDir = join(dir, '.stub-bin')
  mkdirSync(binDir, { recursive: true })
  writeFileSync(
    join(binDir, 'mypy.cmd'),
    '@echo off\r\nnode "%~dp0mypy-stub.js" %*\r\nexit /b %errorlevel%\r\n',
  )
  writeFileSync(
    join(binDir, 'mypy-stub.js'),
    'const out = process.env.STUB_MYPY_OUT || ""\n' +
      'if (out) console.log(out)\n' +
      'process.exit(parseInt(process.env.STUB_MYPY_EXIT || "0", 10))\n',
  )
  // .gitignore 掉 stub(防止污染 staged 检测)
  writeFileSync(join(dir, '.gitignore'), '.stub-bin/\n')
  // 初始 commit(git diff --cached 需要 HEAD 作为参照)
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md .gitignore', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m init', { cwd: dir, stdio: 'pipe' })
  return dir
}

// ─── 辅助:运行脚本(stdout/stderr 去除 ANSI 颜色码) ─────
// 注入 stub mypy 路径到 PATH 最前(Windows env key 大小写不确定,需探测)
function runScript(dir, args = [], opts = {}) {
  const scriptPath = join(dir, 'scripts', 'check-mypy.mjs')
  const env = { ...process.env, ...(opts.env || {}) }
  const binDir = join(dir, '.stub-bin')
  const pathKey =
    Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'Path'
  env[pathKey] = `${binDir};${env[pathKey] || ''}`
  const r = spawnSync('node', [scriptPath, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.err = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ─── 辅助:在临时仓库创建文件并 stage ─────────────────────
function stageFile(dir, relPath, content = '') {
  const full = join(dir, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  execSync(`git add "${relPath}"`, { cwd: dir, stdio: 'pipe' })
}

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help → exit 0 + 打印用法', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['--help'])
    assert.equal(r.status, 0, `--help 应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /用法/)
    assert.match(r.out, /--staged/)
    assert.match(r.out, /mypy/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: -h 别名 → exit 0 + 打印用法', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['-h'])
    assert.equal(r.status, 0, `-h 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /用法/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 跳过机制:HUSKY_SKIP_MYPY(紧急场景) ────────────

test('Skip: HUSKY_SKIP_MYPY=1 → exit 0 + 跳过提示', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, [], { env: { HUSKY_SKIP_MYPY: '1' } })
    assert.equal(r.status, 0, `HUSKY_SKIP_MYPY=1 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /已跳过/)
    assert.match(r.out, /HUSKY_SKIP_MYPY=1/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('Skip 优先级: --help + HUSKY_SKIP_MYPY=1 → exit 0 + 用法(help 优先,无跳过提示)', () => {
  // 脚本先判 showHelp 再判 HUSKY_SKIP_MYPY,help 胜出
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['--help'], { env: { HUSKY_SKIP_MYPY: '1' } })
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /用法/, '应打印 help 用法')
    assert.ok(!r.out.includes('已跳过'), 'help 优先,不应打印跳过提示')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. --staged 模式:无 apps/ai-service/**/*.py 改动 → 跳过 ──

test('--staged: 无 staged 文件 → exit 0 + 跳过', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `无 staged 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--staged: staged .ts(非 Python)→ exit 0 + 跳过', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/foo.ts', 'export const x = 1\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `非 Python staged 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--staged: staged .py 不在 apps/ai-service/(apps/api/)→ exit 0 + 跳过', () => {
  // 脚本过滤条件:f.startsWith('apps/ai-service/') && f.endsWith('.py')
  // apps/api/main.py 前缀不匹配,应跳过
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/api/main.py', 'print(1)\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `apps/api/ 下 .py 不匹配前缀\nstdout: ${r.out}`)
    assert.match(r.out, /跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. --staged 模式:有 apps/ai-service/**/*.py 改动 → 触发 mypy ──

test('--staged: staged .py 在 apps/ai-service/ + mypy success → exit 0 + ✅', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/ai-service/app/main.py', 'x: int = 1\n')
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 1 source file',
      },
    })
    assert.equal(r.status, 0, `mypy success 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /检测到 1 个 Python 文件改动/)
    assert.match(r.out, /✅.*mypy 守门通过/)
    assert.match(r.out, /apps\/ai-service\/app\/main\.py/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--staged: staged .py 在 apps/ai-service/ 子目录 → 触发 mypy(子目录匹配)', () => {
  // 前缀 startsWith('apps/ai-service/') 覆盖任意深度子目录
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/ai-service/app/services/deep.py', 'y: str = "hi"\n')
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 1 source file',
      },
    })
    assert.equal(r.status, 0, `子目录 .py 应触发 mypy\nstdout: ${r.out}`)
    assert.match(r.out, /检测到 1 个 Python 文件改动/)
    assert.match(r.out, /apps\/ai-service\/app\/services\/deep\.py/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--staged: staged .py + mypy fail → exit 1 + ❌ + 错误输出 + 修复方法', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/ai-service/app/bad.py', 'x: int = "str"\n')
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '1',
        STUB_MYPY_OUT: 'app/bad.py:1: error: Incompatible types',
      },
    })
    assert.equal(r.status, 1, `mypy fail 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /❌.*mypy 守门失败/)
    assert.match(r.out, /Incompatible types/)
    assert.match(r.out, /修复方法/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--staged: 混合(1 .py + 1 .ts)→ 检测计数 1 + 不列 .ts', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/util.ts', 'export const z = 1\n')
    stageFile(dir, 'apps/ai-service/app/util.py', 'z: int = 1\n')
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 1 source file',
      },
    })
    assert.equal(r.status, 0, `mypy success 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /检测到 1 个 Python 文件改动/)
    // .ts 文件不应出现在 Python 检测列表中
    assert.ok(!r.out.includes('util.ts'), `不应列出 .ts 文件\nstdout: ${r.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--staged: 12 个 .py → 截断提示 "... 及其他 2 个文件"', () => {
  // 脚本 slice(0, 10) 列前 10 个,超出则打印 "... 及其他 N 个文件"
  const dir = createTempRepo()
  try {
    for (let i = 0; i < 12; i++) {
      stageFile(dir, `apps/ai-service/app/mod${i}.py`, `v${i}: int = ${i}\n`)
    }
    const r = runScript(dir, ['--staged'], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 12 source files',
      },
    })
    assert.equal(r.status, 0, `mypy success 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /检测到 12 个 Python 文件改动/)
    assert.match(r.out, /\.\.\. 及其他 2 个文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 默认模式(无 --staged)→ 直接跑 mypy ─────────────

test('默认: 无 --staged → mypy success → exit 0 + ✅ + 全量检查提示', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, [], {
      env: {
        STUB_MYPY_EXIT: '0',
        STUB_MYPY_OUT: 'Success: no issues found in 1 source file',
      },
    })
    assert.equal(r.status, 0, `mypy success 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /全量检查/)
    assert.match(r.out, /✅.*mypy 守门通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('默认: 无 --staged → mypy fail → exit 1 + ❌ + 错误输出', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, [], {
      env: {
        STUB_MYPY_EXIT: '1',
        STUB_MYPY_OUT: 'app/main.py:3: error: Some type error',
      },
    })
    assert.equal(r.status, 1, `mypy fail 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /❌.*mypy 守门失败/)
    assert.match(r.out, /Some type error/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. 跳过优先级:HUSKY_SKIP_MYPY > --staged 检测 ─────

test('Skip 优先级: --staged + HUSKY_SKIP_MYPY=1 + staged .py → exit 0 + 跳过(不触发 mypy)', () => {
  // HUSKY_SKIP_MYPY 判断在 --staged 检测之前,skip 胜出
  // 即使有 .py staged + stub 设为 fail,也不会触发 mypy
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/ai-service/app/skip.py', 's: int = 1\n')
    const r = runScript(dir, ['--staged'], {
      env: { HUSKY_SKIP_MYPY: '1', STUB_MYPY_EXIT: '1' },
    })
    assert.equal(r.status, 0, `HUSKY_SKIP_MYPY 应优先跳过\nstdout: ${r.out}`)
    assert.match(r.out, /已跳过/)
    // 不应出现检测计数(说明在 staged 检测之前就跳过了)
    assert.ok(!r.out.includes('检测到'), `skip 应在 staged 检测前\nstdout: ${r.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
