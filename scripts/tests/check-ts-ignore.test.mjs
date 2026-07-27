import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(__dirname, '..', 'check-ts-ignore.mjs')

// ─── 辅助:创建临时 git 仓库 + 复制脚本 ─────────────────────
// check-ts-ignore.mjs 用 import.meta.dirname 推导 ROOT(path.resolve(dirname, '..')),
// 需将脚本复制到临时仓库的 scripts/ 子目录,使 ROOT 指向临时仓库根目录,
// 从而 git diff --cached 与 readFileSync 都在临时仓库内闭环。
// 源脚本只读不改,仅运行副本。
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-ts-ignore-'))
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  // 复制脚本到 <dir>/scripts/check-ts-ignore.mjs(不改源脚本)
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-ts-ignore.mjs'))
  // 初始 commit(git diff --cached 需要 HEAD 作为参照)
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m init', { cwd: dir, stdio: 'pipe' })
  return dir
}

// 运行复制的脚本并去除 ANSI 颜色码,便于正则断言
function runScript(dir, args = []) {
  const scriptPath = join(dir, 'scripts', 'check-ts-ignore.mjs')
  const r = spawnSync('node', [scriptPath, ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = r.stdout.replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// 在临时仓库创建文件并 stage
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
    assert.equal(r.status, 0, `--help 应 exit 0\nstdout: ${r.out}\nstderr: ${r.stderr}`)
    assert.match(r.out, /用法/)
    assert.match(r.out, /--staged/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: 无参数(无 --staged)→ exit 0 + "无 staged 文件"', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `无参数应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无 staged 文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--staged: 无 staged 文件 → exit 0 + "无 staged 文件"', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `空 staged 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无 staged 文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 违规检测:@ts-ignore / @ts-nocheck(核心规则) ────

test('违规: .ts 含 // @ts-ignore → exit 1 + 报告文件路径', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/foo.ts', '// @ts-ignore\nconst x: number = "str"\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 1, `检测到 @ts-ignore 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /@ts-ignore/)
    assert.match(r.out, /apps\/web\/foo\.ts/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: .ts 含 // @ts-nocheck → exit 1', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/api/bar.ts', '// @ts-nocheck\nexport const y = 1\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 1, `检测到 @ts-nocheck 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /@ts-nocheck/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: .tsx 含 // @ts-ignore → exit 1(扩展名覆盖)', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/comp.tsx', '// @ts-ignore\nexport const C = () => null\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 1, `.tsx 应被检测\nstdout: ${r.out}`)
    assert.match(r.out, /@ts-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: .mjs 含 // @ts-ignore → exit 1(扩展名覆盖)', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'scripts/build.mjs', '// @ts-ignore\nconsole.log(1)\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 1, `.mjs 应被检测\nstdout: ${r.out}`)
    assert.match(r.out, /@ts-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: .ts 含 /* @ts-ignore */ 块注释形式 → exit 1', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/block.ts', '/* @ts-ignore */\nconst z = 1\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 1, `块注释形式应被检测\nstdout: ${r.out}`)
    assert.match(r.out, /@ts-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 非违规:文档化行为边界(正则精度 + 白名单 + 扩展名) ──

test('非违规: .ts 含 // @ts-expect-error → exit 0(不在检测范围)', () => {
  // 脚本正则仅匹配 @ts-(?:ignore|nocheck),不含 @ts-expect-error
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/expect.ts', '// @ts-expect-error\nconst a: number = "x"\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `@ts-expect-error 不在检测范围\nstdout: ${r.out}`)
    assert.match(r.out, /无新增 @ts-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('非违规: .ts 无 @ts-ignore → exit 0 + "无新增"', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/clean.ts', 'export const x = 1\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `无违规应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无新增 @ts-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('非违规: .py 文件(非目标扩展名)→ exit 0 + "无目标文件"', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/api/main.py', '# @ts-ignore\nprint(1)\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `.py 不在目标扩展名\nstdout: ${r.out}`)
    assert.match(r.out, /无目标文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('非违规: apps/e2e/ 下 .ts 含 @ts-ignore → exit 0(白名单跳过)', () => {
  // SKIP_PATTERNS 中 /[\\/]e2e[\\/]/ 匹配路径含 /e2e/ 的文件
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/e2e/test.ts', '// @ts-ignore\nconst x = 1\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `e2e/ 白名单应跳过\nstdout: ${r.out}`)
    assert.match(r.out, /无目标文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('非违规: 字符串内含 @ts-ignore(非注释行首)→ exit 0', () => {
  // 正则要求行首 // 或 /*,字符串内的 @ts-ignore 不匹配
  const dir = createTempRepo()
  try {
    stageFile(
      dir,
      'apps/web/str.ts',
      'const s = "// @ts-ignore"\nexport const x = 1\n',
    )
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `字符串内 @ts-ignore 不应被检测\nstdout: ${r.out}`)
    assert.match(r.out, /无新增 @ts-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('非违规: JSDoc 延续行 * @ts-ignore(非行首 // 或 /*)→ exit 0', () => {
  // JSDoc 延续行以 * 开头,不匹配 ^\s*(?:\/\/|\/\*)
  const dir = createTempRepo()
  try {
    stageFile(
      dir,
      'apps/web/jsdoc.ts',
      '/**\n * @ts-ignore 这里是描述性提及\n */\nexport const x = 1\n',
    )
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `JSDoc 内描述性提及不应被检测\nstdout: ${r.out}`)
    assert.match(r.out, /无新增 @ts-ignore/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 批量扫描 ─────────────────────────────────────────

test('批量: 2 文件(1 违规 + 1 干净)→ exit 1 + 仅报告违规文件', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'apps/web/bad.ts', '// @ts-ignore\nconst x = 1\n')
    stageFile(dir, 'apps/web/good.ts', 'export const y = 2\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 1, `有违规应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /bad\.ts/)
    assert.match(r.out, /1 处/)
    // 干净文件不应出现在违规列表中
    assert.ok(
      !r.out.includes('good.ts'),
      `干净文件不应出现在违规输出中\nstdout: ${r.out}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
