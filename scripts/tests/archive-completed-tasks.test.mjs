import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'archive-completed-tasks.mjs')

// 复刻源脚本 todayStr()(本地时区日期,YYYY-MM-DD),保证测试与脚本口径一致
function todayStr() {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz).toISOString().slice(0, 10)
}

// 生成 N 天前的日期字符串(YYYY-MM-DD),与源脚本 dateDiffDays 口径对齐
function dateAgo(days) {
  const d = new Date()
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d - tz - days * 86400000).toISOString().slice(0, 10)
}

// 创建临时目录(非 git 仓库,用于纯文件操作测试)
function createTempDir(prefix = 'ihui-archive-') {
  return mkdtempSync(join(tmpdir(), prefix))
}

// 创建临时 git 仓库(用于 --auto-commit 测试)
function createTempGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-archive-git-'))
  const opt = { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  spawnSync('git', ['init', '-q'], opt)
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], opt)
  spawnSync('git', ['config', 'user.name', 'Test'], opt)
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], opt)
  return dir
}

// 在 git 仓库中写入 PROJECT_PLAN.md + 初始 commit
function commitPlan(repoDir, content, msg = 'init plan') {
  writeFileSync(join(repoDir, 'PROJECT_PLAN.md'), content)
  const opt = { cwd: repoDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  spawnSync('git', ['add', 'PROJECT_PLAN.md'], opt)
  spawnSync('git', ['commit', '-q', '-m', msg], opt)
}

// 运行脚本并去除 ANSI 颜色码
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = r.stdout.replace(/\x1b\[[0-9;]*m/g, '')
  r.err = r.stderr.replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// 归档文件路径(基于 today)
function archiveFilePath(dir) {
  return join(dir, '.trae-cn', 'archive', `PROJECT_PLAN_${todayStr()}_auto-archive.md`)
}

// ─── 1. 文件不存在 ───────────────────────────────────────

test('PROJECT_PLAN.md 不存在 → exit 0 + 跳过消息', () => {
  const dir = createTempDir()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `文件不存在应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /跳过|不存在/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 无已完成任务 ─────────────────────────────────────

test('无已完成任务(只有未完成 [ ])→ exit 0 + 跳过消息', () => {
  const dir = createTempDir()
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), '# plan\n\n### [ ] 任务A\n- 待办\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `无已完成任务应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /无可归档|跳过/)
    assert.ok(!existsSync(archiveFilePath(dir)), '不应创建归档文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 日期阈值(默认 7 天)──────────────────────────────

test('已完成任务日期 < 7 天(默认阈值)→ 不归档 exit 0', () => {
  const dir = createTempDir()
  try {
    const recent = dateAgo(2) // 2 天前,< 7 天阈值
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### [x] ✅(${recent}) 任务A\n内容A\n`,
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `近期任务不应归档\nstdout: ${r.out}`)
    assert.match(r.out, /无可归档|跳过/)
    assert.ok(!existsSync(archiveFilePath(dir)), '归档文件不应存在')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('已完成任务日期 ≥ 7 天(默认阈值)→ 实际归档 exit 0', () => {
  const dir = createTempDir()
  try {
    const old = dateAgo(10) // 10 天前,≥ 7 天阈值
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### [x] ✅(${old}) 任务A\n内容A\n`,
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `归档应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /已归档/)
    assert.ok(existsSync(archiveFilePath(dir)), '归档文件应存在')
    // PROJECT_PLAN.md 应含占位注释;占位保留标题文本,但正文应已移走
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.match(plan, /已归档/)
    assert.ok(!plan.includes('内容A'), 'PROJECT_PLAN.md 不应再含原任务正文')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. --dry-run 模式 ──────────────────────────────────

test('--dry-run: 有可归档任务但不写文件 → exit 0 + dry-run 消息', () => {
  const dir = createTempDir()
  try {
    const old = dateAgo(10)
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### [x] ✅(${old}) 任务A\n内容A\n`,
    )
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0, `dry-run 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /dry-run|未实际归档/)
    assert.ok(!existsSync(archiveFilePath(dir)), 'dry-run 不应创建归档文件')
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.ok(plan.includes('任务A'), 'dry-run 不应修改 PROJECT_PLAN.md')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. --all 模式 ───────────────────────────────────────

test('--all: 归档所有已完成任务(含近期任务)→ exit 0 + 归档文件含任务', () => {
  const dir = createTempDir()
  try {
    const recent = dateAgo(2) // 近期任务,默认阈值不归档,但 --all 应归档
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### [x] ✅(${recent}) 任务A\n内容A\n`,
    )
    const r = runScript(dir, ['--all'])
    assert.equal(r.status, 0, `--all 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /已归档/)
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive.includes('任务A'), '归档文件应含任务A')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. --days N 自定义阈值 ──────────────────────────────

test('--days 3: 任务 2 天前不归档,5 天前归档', () => {
  const dir = createTempDir()
  try {
    const d2 = dateAgo(2) // < 3 天,不归档
    const d5 = dateAgo(5) // ≥ 3 天,归档
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### [x] ✅(${d2}) 近期任务\n近期详情\n\n### [x] ✅(${d5}) 较旧任务\n较旧详情\n`,
    )
    const r = runScript(dir, ['--days', '3'])
    assert.equal(r.status, 0, `--days 3 应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /已归档/)
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive.includes('较旧任务'), '归档文件应含较旧任务')
    assert.ok(!archive.includes('近期任务'), '归档文件不应含近期任务')
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.ok(plan.includes('近期任务'), 'PROJECT_PLAN.md 应保留近期任务')
    // 占位保留标题文本,但正文应已移走(用与标题不冲突的正文文本校验)
    assert.ok(!plan.includes('较旧详情'), 'PROJECT_PLAN.md 不应再含较旧任务正文')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 无日期的已完成任务 ───────────────────────────────

test('无日期的已完成任务: 默认模式不归档,--all 归档', () => {
  // 源脚本 shouldArchive: 无 date 返回 false(除非 --all)
  const dir = createTempDir()
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), '# plan\n\n### [x] ✅ 任务A\n内容A\n')
    // 默认模式:不归档
    const r1 = runScript(dir)
    assert.equal(r1.status, 0)
    assert.match(r1.out, /无可归档|跳过/)
    // --all 模式:归档
    const r2 = runScript(dir, ['--all'])
    assert.equal(r2.status, 0)
    assert.match(r2.out, /已归档/)
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive.includes('任务A'), '--all 应归档无日期任务')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. 标题识别 + 日期格式 ──────────────────────────────

test('标题识别: ### [x] 任务A ✅(DATE) 格式 → 正确提取日期并归档', () => {
  // 源脚本 regex: ^### \[x\][^\n]*✅(?:\((\d{4}-\d{2}-\d{2})\))?
  // 日期出现在 ✅ 之后的括号内
  const dir = createTempDir()
  try {
    const old = dateAgo(10)
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### [x] 任务A ✅(${old})\n内容A\n`,
    )
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /已归档/)
    assert.ok(existsSync(archiveFilePath(dir)), '应创建归档文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('标题识别: 无 [x] 前缀的"已完成"行 → 不被识别(不归档)', () => {
  // 源脚本 regex 必须以 ### [x] 开头
  // 普通 ### 任务A(已完成 ✅ ...) 不带 [x] 不应被识别
  const dir = createTempDir()
  try {
    const old = dateAgo(10)
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### 任务A(已完成 ✅ ${old})\n内容A\n`,
    )
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /无可归档|跳过/)
    assert.ok(!existsSync(archiveFilePath(dir)), '不应创建归档文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 归档产物验证(占位注释 + 归档文件内容)───────────

test('归档产物: 占位注释格式 + 归档文件含 header 与正文', () => {
  const dir = createTempDir()
  try {
    const old = dateAgo(10)
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### [x] ✅(${old}) 任务A标题\n内容A行1\n内容A行2\n`,
    )
    const r = runScript(dir)
    assert.equal(r.status, 0)
    // 占位注释格式:含"已归档" + 当日日期 + 归档文件路径
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.match(plan, /<!--\s*已归档/)
    assert.match(plan, new RegExp(todayStr().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')))
    assert.match(plan, /\.trae-cn\/archive\/PROJECT_PLAN_/)
    // 占位保留标题文本,但正文应已移走
    assert.ok(!plan.includes('内容A行1'), 'PROJECT_PLAN.md 不应再含原任务正文')
    // 归档文件:含 header + 任务正文 + 分隔线
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.match(archive, /PROJECT_PLAN 自动归档/)
    assert.ok(archive.includes('任务A标题'), '归档文件应含任务标题')
    assert.ok(archive.includes('内容A行1'), '归档文件应含任务正文')
    assert.match(archive, /\n---\n/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. 批量归档 ───────────────────────────────────────

test('批量: 多个已完成任务同时归档,全部替换为占位', () => {
  const dir = createTempDir()
  try {
    const old1 = dateAgo(10)
    const old2 = dateAgo(15)
    const old3 = dateAgo(20)
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### [x] ✅(${old1}) 任务A\n内容A\n\n### [x] ✅(${old2}) 任务B\n内容B\n\n### [x] ✅(${old3}) 任务C\n内容C\n`,
    )
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /已归档 3 个/)
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    // 占位保留标题文本,但正文应已移走(逐任务校验正文消失)
    assert.ok(!plan.includes('内容A'), '任务A 正文应被移走')
    assert.ok(!plan.includes('内容B'), '任务B 正文应被移走')
    assert.ok(!plan.includes('内容C'), '任务C 正文应被移走')
    const placeholders = plan.match(/<!--\s*已归档/g) || []
    assert.equal(placeholders.length, 3, '应有 3 个归档占位')
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(
      archive.includes('任务A') && archive.includes('任务B') && archive.includes('任务C'),
      '归档文件应含全部 3 个任务',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 追加模式(同日多次归档)──────────────────────────

test('追加模式: 同日多次运行归档,归档文件追加不覆盖,header 仅 1 个', () => {
  const dir = createTempDir()
  try {
    const old = dateAgo(10)
    // 第一次:归档任务A
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# plan\n\n### [x] ✅(${old}) 任务A\n内容A\n`)
    const r1 = runScript(dir)
    assert.equal(r1.status, 0)
    const archive1 = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive1.includes('任务A'))
    assert.equal(
      (archive1.match(/PROJECT_PLAN 自动归档/g) || []).length,
      1,
      '首次归档应含 1 个 header',
    )

    // 第二次:在 PROJECT_PLAN.md 末尾添加任务B(任务A已被占位替换)
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `${plan}\n### [x] ✅(${old}) 任务B\n内容B\n`)
    const r2 = runScript(dir)
    assert.equal(r2.status, 0)
    const archive2 = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive2.includes('任务A'), '追加模式不应覆盖任务A')
    assert.ok(archive2.includes('任务B'), '归档文件应含任务B')
    assert.equal(
      (archive2.match(/PROJECT_PLAN 自动归档/g) || []).length,
      1,
      '追加不应再写 header',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. --auto-commit 模式 ─────────────────────────────

test('--auto-commit: 归档后自动 git commit(验证 commit 创建 + 工作区干净)', () => {
  const dir = createTempGitRepo()
  try {
    const old = dateAgo(10)
    commitPlan(dir, `# plan\n\n### [x] ✅(${old}) 任务A\n内容A\n`)
    const beforeCount = parseInt(
      execSync('git rev-list --count HEAD', { cwd: dir, encoding: 'utf8' }).trim(),
      10,
    )
    const r = runScript(dir, ['--auto-commit'])
    assert.equal(r.status, 0, `--auto-commit 应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /归档 commit 已创建|自动 commit/)
    const afterCount = parseInt(
      execSync('git rev-list --count HEAD', { cwd: dir, encoding: 'utf8' }).trim(),
      10,
    )
    assert.equal(afterCount, beforeCount + 1, '应新增 1 个 commit')
    // 最新 commit message 应含归档语义(允许 auto/chore 关键字,规避 Windows 中文编码波动)
    const lastMsg = execSync('git log -1 --pretty=%s', { cwd: dir, encoding: 'utf8' }).trim()
    assert.match(lastMsg, /归档|auto|chore/i, `commit message 应含归档语义,实际: ${lastMsg}`)
    // 工作区应干净(归档文件 + PROJECT_PLAN.md 都已 commit)
    const status = execSync('git status --porcelain', { cwd: dir, encoding: 'utf8' }).trim()
    assert.equal(status, '', '工作区应干净')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. 边界: 条目由 --- 分隔线终止 ────────────────────

test('边界: 已完成条目由 --- 分隔线终止 → 正确提取,不越界到下一章节', () => {
  // 源脚本 parseCompletedTasks: /^---\s*$/ 作为条目边界
  const dir = createTempDir()
  try {
    const old = dateAgo(10)
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### [x] ✅(${old}) 任务A\n内容A\n\n---\n\n## 其他章节\n更多内容\n`,
    )
    const r = runScript(dir)
    assert.equal(r.status, 0)
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive.includes('任务A'), '应归档任务A')
    assert.ok(!archive.includes('其他章节'), '归档不应含边界外内容')
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.ok(plan.includes('其他章节'), 'PROJECT_PLAN.md 应保留其他章节')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
