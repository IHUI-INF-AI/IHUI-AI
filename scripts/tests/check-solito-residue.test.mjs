import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  copyFileSync,
} from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(__dirname, '..', 'check-solito-residue.mjs')

// ============================================================
// 源脚本核心规则(scripts/check-solito-residue.mjs)
// ============================================================
// solito 幽灵依赖回归守门(2026-07-28 立)。
// 本仓库已移除 solito(commit f8c9a6630c),防止重新引入。
// 检测范围:
//   1. package.json(根 + packages/app + apps/*)的 dependencies/devDependencies/
//      peerDependencies/optionalDependencies 中有 solito
//   2. 根 package.json 的 pnpm.patchedDependencies 中有 solito
//   3. pnpm-workspace.yaml 的 publicHoistPattern 中有 *solito*
//   4. patches/ 目录下有 solito@*.patch 文件
//   5. packages/app/src/**/*.tsx 中有 from 'solito/...' import 语句
// CLI:--staged(仅扫描 staged 目标文件)/ --help。
// 正则:/\bfrom\s+['"]solito(?:\/[^'"]*)?['"]/ (不匹配 solito-router 等)
// 注释行(以 // 或 * 或 /* 开头)被跳过。
// 退出码:0 无残留,1 发现残留(blocking)。
// ============================================================

// ─── 辅助:创建临时 git 仓库 + 复制脚本 ─────────────────────
// check-solito-residue.mjs 用 import.meta.dirname 推导 ROOT(path.resolve(dirname, '..')),
// 需将脚本复制到临时仓库的 scripts/ 子目录,使 ROOT 指向临时仓库根目录。
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-solito-'))
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-solito-residue.mjs'))
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m init', { cwd: dir, stdio: 'pipe' })
  return dir
}

function runScript(dir, args = []) {
  const r = spawnSync('node', [join(dir, 'scripts', 'check-solito-residue.mjs'), ...args], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.cleanStdout = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.cleanStderr = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

function stageFile(dir, relPath, content = '') {
  const full = join(dir, relPath)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  execSync(`git add "${relPath}"`, { cwd: dir, stdio: 'pipe' })
}

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help → exit 0 + 用法', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(dir, ['--help'])
    assert.equal(r.status, 0, `--help 应 exit 0\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /用法/)
    assert.match(r.cleanStdout, /solito/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('全量扫描: 无 solito 残留 → exit 0', () => {
  const dir = createTempRepo()
  try {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test' }))
    const r = runScript(dir)
    assert.equal(r.status, 0, `无 solito 应 exit 0\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /无 solito 残留/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--staged: 无目标文件 → exit 0 + "跳过"', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'README.md', '# test\n')
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `无目标文件应 exit 0`)
    assert.match(r.cleanStdout, /跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--staged: 有 package.json staged → 执行扫描(不跳过)', () => {
  const dir = createTempRepo()
  try {
    stageFile(dir, 'package.json', JSON.stringify({ name: 'test' }))
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `无 solito 应 exit 0`)
    assert.ok(!r.cleanStdout.includes('跳过'), `有目标文件不应跳过\ncleanStdout: ${r.cleanStdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 违规检测:package.json 依赖 ──────────────────────

test('违规: package.json dependencies.solito → exit 1', () => {
  const dir = createTempRepo()
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ dependencies: { solito: '^1.0.0' } }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 1, `检测到 solito 应 exit 1\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /solito/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: package.json devDependencies.solito → exit 1', () => {
  const dir = createTempRepo()
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ devDependencies: { solito: '^1.0.0' } }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 1)
    assert.match(r.cleanStdout, /solito/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: package.json peerDependencies.solito → exit 1', () => {
  const dir = createTempRepo()
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ peerDependencies: { solito: '^1.0.0' } }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 1)
    assert.match(r.cleanStdout, /solito/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: package.json optionalDependencies.solito → exit 1', () => {
  const dir = createTempRepo()
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ optionalDependencies: { solito: '^1.0.0' } }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 1)
    assert.match(r.cleanStdout, /solito/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 违规检测:其他来源 ───────────────────────────────

test('违规: 根 package.json pnpm.patchedDependencies.solito → exit 1', () => {
  const dir = createTempRepo()
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: { 'solito@1.0.0': 'patches/solito@1.0.0.patch' },
        },
      }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 1)
    assert.match(r.cleanStdout, /solito/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: pnpm-workspace.yaml publicHoistPattern 含 *solito* → exit 1', () => {
  const dir = createTempRepo()
  try {
    writeFileSync(
      join(dir, 'pnpm-workspace.yaml'),
      `publicHoistPattern:\n  - '*solito*'\n  - '@types/*'\n`,
    )
    const r = runScript(dir)
    assert.equal(
      r.status,
      1,
      `应检测到 pnpm-workspace.yaml 中的 solito\ncleanStdout: ${r.cleanStdout}`,
    )
    assert.match(r.cleanStdout, /solito/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: patches/solito@1.0.0.patch 文件 → exit 1', () => {
  const dir = createTempRepo()
  try {
    mkdirSync(join(dir, 'patches'), { recursive: true })
    writeFileSync(join(dir, 'patches/solito@1.0.0.patch'), 'diff --git a/foo b/foo\n')
    const r = runScript(dir)
    assert.equal(r.status, 1, `应检测到 patch 文件\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /solito/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: packages/app/src/foo.tsx 含 from "solito/link" → exit 1', () => {
  const dir = createTempRepo()
  try {
    mkdirSync(join(dir, 'packages', 'app', 'src'), { recursive: true })
    writeFileSync(
      join(dir, 'packages/app/src/foo.tsx'),
      `import { Link } from 'solito/link'\nexport const X = () => null\n`,
    )
    const r = runScript(dir)
    assert.equal(r.status, 1, `应检测到 solito import\ncleanStdout: ${r.cleanStdout}`)
    assert.match(r.cleanStdout, /solito/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 非违规(正则精度) ───────────────────────────────

test('非违规: packages/app/src/foo.tsx 含 from "solito-router"(非 solito)→ exit 0', () => {
  const dir = createTempRepo()
  try {
    mkdirSync(join(dir, 'packages', 'app', 'src'), { recursive: true })
    // 正则 /\bfrom\s+['"]solito(?:\/[^'"]*)?['"]/
    // 'solito-router' 不匹配:solito 后面是 -,不是 / 或引号结束
    writeFileSync(
      join(dir, 'packages/app/src/foo.tsx'),
      `import { Foo } from 'solito-router'\nexport const X = () => null\n`,
    )
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test' }))
    const r = runScript(dir)
    assert.equal(r.status, 0, `solito-router 不应匹配\ncleanStdout: ${r.cleanStdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('非违规: packages/app/src/foo.tsx 注释行 // from "solito/..." 被跳过 → exit 0', () => {
  const dir = createTempRepo()
  try {
    mkdirSync(join(dir, 'packages', 'app', 'src'), { recursive: true })
    // 注释行(trimmed starts with //)被跳过
    writeFileSync(
      join(dir, 'packages/app/src/foo.tsx'),
      `// import { Link } from 'solito/link'\nexport const X = () => null\n`,
    )
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'test' }))
    const r = runScript(dir)
    assert.equal(r.status, 0, `注释行不应被检测\ncleanStdout: ${r.cleanStdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('非违规: package.json 描述字段含 solito 字样(非依赖名)→ exit 0', () => {
  const dir = createTempRepo()
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: 'test',
        description: 'removed solito dependency in v2',
      }),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `非依赖名的 solito 不应被检测\ncleanStdout: ${r.cleanStdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
