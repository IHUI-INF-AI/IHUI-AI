import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-style-verification.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-style-verify-'))
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' })
  return dir
}

// 辅助:在 git 仓库中写入文件并 stage(支持新增/修改)
function stageFile(repoDir, relPath, content) {
  const fullPath = join(repoDir, relPath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
  execSync(`git add "${relPath.replace(/\\/g, '/')}"`, {
    cwd: repoDir,
    stdio: 'pipe',
  })
}

// 辅助:写入临时 commit message 文件,返回路径
function writeMsgFile(repoDir, message) {
  const msgPath = join(repoDir, 'COMMIT_EDITMSG')
  writeFileSync(msgPath, message)
  return msgPath
}

// 辅助:运行脚本
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// 辅助:去除 ANSI 颜色码(脚本输出含 \x1B[31m 等颜色码)
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '')
}

// ─── 1. HUSKY_SKIP_STYLE_VERIFY=1 → exit 0 ──────────────
test('豁免: HUSKY_SKIP_STYLE_VERIFY=1 → exit 0(跳过检查)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir, env: { HUSKY_SKIP_STYLE_VERIFY: '1' } })
    assert.equal(r.status, 0, `HUSKY_SKIP_STYLE_VERIFY=1 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /HUSKY_SKIP_STYLE_VERIFY|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 无 commit message 文件参数 → exit 1 ─────────────
test('参数: 缺少 commit message 文件参数 → exit 1', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 1, `缺参数应 exit 1,实际 ${r.status}`)
    assert.match(stripAnsi(r.stderr), /缺少 commit message 文件参数/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 非 git 仓库(git diff 失败) → exit 0 ────────────
test('非 git: 非 git 仓库目录(git diff 抛错被 catch) → exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nongit-style-'))
  const msgPath = writeMsgFile(dir, 'feat: test\n')
  try {
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 0, `非 git 仓库应 exit 0(catch 兜底),实际 ${r.status}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. git 仓库但无 staged 文件 → exit 0 ────────────────
test('空 staged: git 仓库但无 staged 文件 → exit 0', () => {
  const dir = createTempRepo()
  const msgPath = writeMsgFile(dir, 'feat: test\n')
  try {
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 0, `无 staged 文件应 exit 0,实际 ${r.status}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. staged apps/web/ 非 .css 文件 → exit 0 ──────────
test('非 css: staged apps/web/foo.tsx → exit 0(后缀不匹配)', () => {
  const dir = createTempRepo()
  const msgPath = writeMsgFile(dir, 'feat(web): test\n')
  try {
    stageFile(dir, 'apps/web/src/page.tsx', 'export const x = 1\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 0, `非 .css 文件应 exit 0,实际 ${r.status}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. staged apps/api/ 下的 .css → exit 0(路径不匹配) ─
test('非 web: staged apps/api/foo.css → exit 0(路径前缀不匹配)', () => {
  const dir = createTempRepo()
  const msgPath = writeMsgFile(dir, 'feat(api): test\n')
  try {
    stageFile(dir, 'apps/api/styles.css', 'body { margin: 0; }\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 0, `apps/api/ 下 .css 应 exit 0,实际 ${r.status}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. staged apps/web/foo.css + 无 Verified-DOM → exit 1
test('阻塞: staged apps/web/foo.css + commit message 无 trailer → exit 1', () => {
  const dir = createTempRepo()
  const msgPath = writeMsgFile(dir, 'feat(web): 改样式\n')
  try {
    stageFile(dir, 'apps/web/globals.css', 'body { margin: 0; }\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 1, `有 .css 改动但无 trailer 应 exit 1,实际 ${r.status}`)
    assert.match(stripAnsi(r.stderr), /样式改动强制验证守门/)
    assert.match(stripAnsi(r.stderr), /apps\/web\/globals\.css/)
    assert.match(stripAnsi(r.stderr), /Verified-DOM/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. staged apps/web/foo.css + 有 trailer → exit 0 ───
test('通过: staged apps/web/foo.css + commit message 含 trailer → exit 0', () => {
  const dir = createTempRepo()
  const msg = `feat(web): 改样式

Verified-DOM: http://localhost:8801/ (offsetHeight=58)
`
  const msgPath = writeMsgFile(dir, msg)
  try {
    stageFile(dir, 'apps/web/globals.css', 'body { margin: 0; }\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 0, `有 .css 改动且有 trailer 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /样式验证守门通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 多个 apps/web/*.css + 无 trailer → exit 1(stderr 列出所有)
test('多文件阻塞: staged 多个 apps/web/*.css + 无 trailer → exit 1(stderr 列出所有 css)', () => {
  const dir = createTempRepo()
  const msgPath = writeMsgFile(dir, 'feat(web): 批量改样式\n')
  try {
    stageFile(dir, 'apps/web/globals.css', 'body { margin: 0; }\n')
    stageFile(dir, 'apps/web/src/fix.css', '.a { color: red; }\n')
    stageFile(dir, 'apps/web/src/nested/deep.css', '.b { color: blue; }\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 1, `多个 .css + 无 trailer 应 exit 1,实际 ${r.status}`)
    const stderr = stripAnsi(r.stderr)
    assert.match(stderr, /apps\/web\/globals\.css/)
    assert.match(stderr, /apps\/web\/src\/fix\.css/)
    assert.match(stderr, /apps\/web\/src\/nested\/deep\.css/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. 多个 apps/web/*.css + 有 trailer → exit 0 ──────
test('多文件通过: staged 多个 apps/web/*.css + 有 trailer → exit 0', () => {
  const dir = createTempRepo()
  const msg = `feat(web): 批量改样式

Verified-DOM: http://localhost:8801/ai-world (offsetHeight=58 scrollHeight=58)
`
  const msgPath = writeMsgFile(dir, msg)
  try {
    stageFile(dir, 'apps/web/globals.css', 'body { margin: 0; }\n')
    stageFile(dir, 'apps/web/src/fix.css', '.a { color: red; }\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 0, `多个 .css + 有 trailer 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /样式验证守门通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. trailer 用脚本示例格式(完整 URL + DOM 数值摘要) ──
test('示例格式: trailer 含完整 URL + DOM 数值摘要(脚本 error 示例格式) → exit 0', () => {
  const dir = createTempRepo()
  // 使用脚本 stderr 示例中的精确格式
  const msg = `fix(web): 修复 textarea 自适应高度

Verified-DOM: http://localhost:8801/ai-world (textarea offsetHeight=58 scrollHeight=58 overflowY=hidden)
`
  const msgPath = writeMsgFile(dir, msg)
  try {
    stageFile(dir, 'apps/web/globals.css', 'textarea { resize: none; }\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 0, `示例格式 trailer 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /样式验证守门通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. trailer 缩进(行首空格)→ exit 1(正则要求行首) ─
test('缩进不匹配: trailer 行首有空格 → exit 1(正则 ^ 要求行首)', () => {
  const dir = createTempRepo()
  const msg = `feat(web): 改样式

  Verified-DOM: http://localhost:8801/ (offsetHeight=58)
`
  const msgPath = writeMsgFile(dir, msg)
  try {
    stageFile(dir, 'apps/web/globals.css', 'body { margin: 0; }\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(
      r.status,
      1,
      `缩进 trailer 不匹配 ^Verified-DOM: 应 exit 1,实际 ${r.status}`,
    )
    assert.match(stripAnsi(r.stderr), /样式改动强制验证守门/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. 小写 trailer → exit 1(大小写敏感) ─────────────
test('大小写敏感: 小写 verified-dom: → exit 1(正则大小写敏感)', () => {
  const dir = createTempRepo()
  const msg = `feat(web): 改样式

verified-dom: http://localhost:8801/ (offsetHeight=58)
`
  const msgPath = writeMsgFile(dir, msg)
  try {
    stageFile(dir, 'apps/web/globals.css', 'body { margin: 0; }\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 1, `小写 trailer 应 exit 1,实际 ${r.status}`)
    assert.match(stripAnsi(r.stderr), /样式改动强制验证守门/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. .css + .tsx 混合 + 无 trailer → exit 1 ─────────
test('混合文件: staged apps/web/ 下 .css + .tsx 混合 + 无 trailer → exit 1', () => {
  const dir = createTempRepo()
  const msgPath = writeMsgFile(dir, 'feat(web): 改样式 + 页面\n')
  try {
    stageFile(dir, 'apps/web/globals.css', 'body { margin: 0; }\n')
    stageFile(dir, 'apps/web/src/page.tsx', 'export const X = 1\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(r.status, 1, `混合文件含 .css 应 exit 1,实际 ${r.status}`)
    // stderr 应只列出 .css 文件
    const stderr = stripAnsi(r.stderr)
    assert.match(stderr, /apps\/web\/globals\.css/)
    // 不应把 .tsx 当作 css 列出
    assert.ok(!stderr.includes('apps/web/src/page.tsx'), '不应列出 .tsx 文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 15. trailer 后无内容(`Verified-DOM:` 单独一行)→ exit 1
test('trailer 无内容: Verified-DOM: 后无任何字符 → exit 1(.+ 要求至少 1 字符)', () => {
  const dir = createTempRepo()
  const msg = `feat(web): 改样式

Verified-DOM:
`
  const msgPath = writeMsgFile(dir, msg)
  try {
    stageFile(dir, 'apps/web/globals.css', 'body { margin: 0; }\n')
    const r = runScript([msgPath], { cwd: dir })
    assert.equal(
      r.status,
      1,
      `trailer 后无内容(.+ 不匹配)应 exit 1,实际 ${r.status}`,
    )
    assert.match(stripAnsi(r.stderr), /样式改动强制验证守门/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
