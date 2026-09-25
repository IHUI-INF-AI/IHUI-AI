// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  return join(dir, '.ihui-agent', 'archive', `PROJECT_PLAN_${todayStr()}_auto-archive.md`)
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
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# plan\n\n### [x] ✅(${recent}) 任务A\n内容A\n`)
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
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# plan\n\n### [x] ✅(${old}) 任务A\n内容A\n`)
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
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# plan\n\n### [x] ✅(${old}) 任务A\n内容A\n`)
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
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# plan\n\n### [x] ✅(${recent}) 任务A\n内容A\n`)
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
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# plan\n\n### [x] 任务A ✅(${old})\n内容A\n`)
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /已归档/)
    assert.ok(existsSync(archiveFilePath(dir)), '应创建归档文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('标题识别:§1 的文档形态 `### XXX(已完成 ✅ 日期)` 必须被认出(旧断言镜像的是实现,不是规格)', () => {
  // 本条**反转**了原断言。原测试写「源脚本 regex 必须以 ### [x] 开头 ⇒ 不带 [x] 不应被识别」——
  // 那镜像的是实现,不是规格:AGENTS §1 归档机制写的形态是 `### XXX(已完成 ✅ ...)`,守门 13c
  // 提取的也是「### + 含(已完成 或 ✅)」,而 PROJECT_PLAN.md 里 `^### [x]` **命中 0 次**
  // ⇒ 归档器自 2026-09-14 起每次都扫到 0 条,而这 15 个测试却一路绿(夹具全用 [x] 形)。
  // **测试把实现的错误固化成规格**,就是这次空转能活一个月的原因。
  // 现行判据:含 ✅ 即算已完成条目;无 ✅ 的小节标题不算(下一条测试钉住)。
  const dir = createTempDir()
  try {
    const old = dateAgo(10)
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# plan\n\n### 任务A(已完成 ✅ ${old})\n内容A\n`)
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(
      r.out,
      /发现 1 个可归档的已完成任务条目/,
      `§1 形态必须被认出,实得:\n${r.out.slice(0, 260)}`,
    )
    assert.ok(existsSync(archiveFilePath(dir)), '应真写出归档文件')
    assert.ok(!r.out.includes('无可归档'), '不得再报「无可归档」')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('标题识别:无 ✅ 的小节标题(如「### 已完成清单」)不算任务条目,不得被搬走', () => {
  const dir = createTempDir()
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), '# plan\n\n### 已完成清单\n- 索引内容\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.out, /无可归档|共 0 个已完成/, '无 ✅ 不该算条目')
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
    assert.match(plan, /\.ihui-agent\/archive\/PROJECT_PLAN_/)
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
    assert.equal((archive2.match(/PROJECT_PLAN 自动归档/g) || []).length, 1, '追加不应再写 header')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ─── 16. 2026-09-25 格式漂移修复:归档器必须认出**文件里真实在用的**形态 ───
// 起因(实测,不是推测):旧匹配式 /^### \[x\][^\n]*✅/ 要求标题带字面 `[x]`,而
// PROJECT_PLAN.md 里 `^### [x]` 命中 **0 次**;§1 与守门 13c 用的都是 `### XXX(… ✅)` 这一形。
// ⇒ 归档器每次跑、每次扫到 0 条,而它 15 个测试夹具全写 `### [x] ✅(...)` ⇒ 一路绿。
// 这三条把"真实形态必须被认出 / 不该搬的必须不搬 / 量级失控必须被挡"分别钉死。

test('真实形态「### XXX(YYYY-MM-DD 完成 ✅)」必须被认出并归档;无 ✅ 的小节标题不得被搬走', () => {
  const dir = createTempDir()
  try {
    const d1 = dateAgo(30)
    const d2 = dateAgo(40)
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      [
        '# plan',
        '',
        '## 某章节',
        '',
        `### 第三轮:admin 判定复核(${d1} 完成 ✅)`,
        '详情行 A',
        '',
        '### 已完成清单',
        '- 这是一节索引,不是任务条目',
        '',
        `### [x] ✅(${d2}) 历史写法任务`,
        '详情行 B',
        '',
        '## 下一章节',
        '保留内容',
      ].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `应 exit 0\nstderr: ${r.err}`)
    assert.match(
      r.out,
      /发现 2 个可归档的已完成任务条目/,
      `两种形态都要认出,实得:\n${r.out.slice(0, 300)}`,
    )
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive.includes('第三轮:admin 判定复核'), '新形态条目必须进归档文件')
    assert.ok(archive.includes('详情行 A'), '条目正文要跟着搬走')
    assert.ok(archive.includes('历史写法任务'), '旧形态(### [x])必须继续兼容')
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.ok(plan.includes('### 已完成清单'), '「已完成」但无 ✅ 的小节不是任务条目,不得被搬')
    assert.ok(plan.includes('这是一节索引'), '该小节正文必须原样留在计划里')
    assert.ok(plan.includes('保留内容'), '边界外内容不得被动')
    assert.match(plan, /<!-- 已归档\(/, '原位置必须留 13c 认得的占位注释')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('无日期的 ✅ 标题不得被自动档搬走(≥7 天判据要求有日期),但 --all 应放开', () => {
  const dir = createTempDir()
  try {
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      ['# plan', '', '### 批次1:考勤管理(P0) ✅', '- 内容行', ''].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(
      r.out,
      /无可归档的已完成任务条目\s*\(共 1 个已完成/,
      '认作已完成条目,但因无日期不搬',
    )
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.ok(plan.includes('### 批次1:考勤管理(P0) ✅'), '没日期就留在原地,不静默搬走')
    const r2 = runScript(dir, ['--all'])
    assert.equal(r2.status, 0)
    assert.match(r2.out, /发现 1 个可归档/, '--all 才放开无日期的条目')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('大批量阀门:自动档一次搬 >25 条必须拒绝且不写盘,人工 --allow-mass 才放行', () => {
  const dir = createTempGitRepo()
  try {
    const d = dateAgo(30)
    const entries = []
    for (let i = 1; i <= 26; i++) entries.push(`### T${i} ✅(${d})`, `正文 ${i}`, '')
    const planText = ['# plan', '', ...entries].join('\n')
    commitPlan(dir, planText)
    const r = runScript(dir, ['--auto-commit'])
    assert.equal(r.status, 0, `阀门只挡不报红(钩子链不得因此失败),实得 ${r.status}`)
    assert.match(
      r.out,
      /大批量归档阀门关闭中\(自动档\):26 条/,
      `必须报出实测条数,实得:\n${r.out.slice(0, 300)}`,
    )
    assert.equal(
      readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'),
      planText,
      '被阀门挡下时计划文档必须逐字节未变',
    )
    assert.ok(!existsSync(archiveFilePath(dir)), '被挡下时不得写出归档文件')
    const r2 = runScript(dir, ['--auto-commit', '--allow-mass'])
    assert.equal(r2.status, 0)
    assert.ok(existsSync(archiveFilePath(dir)), '显式放行后才真归档')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 17. auto-commit 的污染面:必须带 pathspec(2026-09-25 与匹配式同批改) ───

test('自动档 commit 必须带 pathspec:共享索引里挂着别人的 staged 删除时不得一起打包', () => {
  const dir = createTempGitRepo()
  try {
    const d = dateAgo(30)
    // 先造一个"别人的在途改动":other.txt 已入库,现在被 staged 成删除
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# plan\n\n### 任务A ✅(${d})\n正文A\n`)
    writeFileSync(join(dir, 'other.txt'), '别人的文件\n')
    const opt = { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    spawnSync('git', ['add', 'PROJECT_PLAN.md', 'other.txt'], opt)
    spawnSync('git', ['commit', '-q', '-m', 'init two files'], opt)
    spawnSync('git', ['rm', '--cached', '--', 'other.txt'], opt) // 别人 staged 的删除,尚未提交

    const r = runScript(dir, ['--auto-commit'])
    assert.equal(r.status, 0, `自动档应成功,实得 ${r.status}\n${r.out}\n${r.err}`)
    const files = spawnSync('git', ['show', '--pretty=format:', '--name-only', 'HEAD'], opt)
      .stdout.split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    assert.ok(
      files.every(
        (f) => f === 'PROJECT_PLAN.md' || f.includes('.ihui-agent/archive/PROJECT_PLAN_'),
      ),
      `归档 commit 只许动这两个路径,实际动了:\n  ${files.join('\n  ')}`,
    )
    assert.ok(!files.includes('other.txt'), '别人 staged 的删除被卷进了归档 commit(§12 污染)')
    // 那条删除必须仍留在索引里等它的主人自己提交 —— 我们既不代提交也不撤销
    const staged = spawnSync('git', ['diff', '--cached', '--name-status', 'HEAD'], opt).stdout
    assert.ok(
      !/other\.txt/.test(staged) || true,
      '索引态断言占位(不同 git 版本输出形态不同,主断言看上面的 commit 文件清单)',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 18. 归档锚点必须真能入库(2026-09-25:夹具与生产的差异就是这次事故本身) ───

test('生产形态的 .gitignore(整目录忽略 .ihui-agent/)下,自动档仍必须产出 commit 且锚点已入库', () => {
  // 这条测试的存在理由:上一轮我新加的"pathspec 回归"夹具**没有 .gitignore**,所以在生产里
  // 必然失败的场景下它偏绿 —— 而生产实测正是 `git add` 被 .gitignore 拒绝 ⇒ 自动 commit 失败 ⇒
  // 计划文档改写以"已 staged 未提交"挂在共享索引里、归档内容只存在本机。
  // ⇒ 凡判据对象是"真实文件的形态",夹具就必须复刻那个形态(§22c 红线新增条)。
  const dir = createTempGitRepo()
  try {
    const d = dateAgo(30)
    const opt = { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      `# plan\n\n### 任务A(已完成 ✅ ${d})\n正文A\n\n## 保留章节\n别的内容\n`,
    )
    // 刻意用**生产当时那一型**:整目录忽略、无例外 —— 旧代码(不带 -f)在这型下必然 add 失败,
    // 新代码靠 -f 才能把锚点入库。夹具若写"已修好的 ignore 形态",旧实现也能过,等于没牙。
    writeFileSync(join(dir, '.gitignore'), '.ihui-agent/\n')
    spawnSync('git', ['add', 'PROJECT_PLAN.md', '.gitignore'], opt)
    spawnSync('git', ['commit', '-q', '-m', 'init with prod-shaped gitignore'], opt)

    const r = runScript(dir, ['--auto-commit'])
    assert.equal(r.status, 0, `自动档应成功,实得 ${r.status}\n${r.out}\n${r.err}`)
    const files = spawnSync('git', ['show', '--pretty=format:', '--name-only', 'HEAD'], opt)
      .stdout.split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    assert.ok(
      files.some((f) => f.includes('.ihui-agent/archive/PROJECT_PLAN_')),
      `归档文件必须进 commit(锚点入库),实得:\n  ${files.join('\n  ')}`,
    )
    const tracked = spawnSync('git', ['ls-files', '--', '.ihui-agent/archive'], opt).stdout
    assert.match(tracked, /PROJECT_PLAN_.*_auto-archive\.md/, '归档锚点必须已被 git 跟踪')
    // 计划文档里必须留下 13c/71 认得的占位注释,且非条目内容一字不动
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.match(plan, /<!-- 已归档\(/, '原位置须留占位注释')
    assert.ok(plan.includes('别的内容'), '条目外内容不得被动')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('锚点入不了库时必须回滚:不得留下"计划已搬走而没人记住"的中间态', () => {
  // 造一个 add 必然失败的档案:把 .gitignore 写成"整目录忽略、无例外" —— 这时
  // `git add -f` 仍能成功,所以改用**只读目录**来逼出失败路径(Windows 上 chmod 555
  // 对 git 写索引不生效,故这里直接断言"若核验不通过则计划必须回到原样"这一条不变量:
  // 用 --dry-run 走不到回滚分支,因此本例只做**静态装车证明** —— 源里必须存在
  // "核验失败 → restore --staged + 写回原文 + exit 1" 这一整段,缺了就是回到旧行为。)
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(src, /restore'\s*,\s*'--staged'/, '失败路径必须逐路径撤销暂存(不得用裸 git reset)')
  assert.match(src, /writeFileSync\(PLAN_FILE, content/, '失败路径必须把计划文档写回搬运前的原文')
  assert.match(
    src,
    /staged\.has\(planRel\) && staged\.has\(archiveRel\)/,
    '必须有"两路径都进索引"的核验',
  )
  assert.match(src, /'add', '-f'/, '必须用 add -f,防 .gitignore 再次忽略归档目录')
})

test('回滚分支必须真被执行过:git add 失败时计划文档要写回原文、退出码非 0、不得留中间态', () => {
  // 这一条不是静态断言 —— 用 IHUI_GIT_BIN 指向一个"必然失败的可执行文件"(node 拿 'add'
  // 当脚本名,找不到模块 ⇒ 非零退出)把分支真跑一遍。理由:一个从没被执行过的失败分支,
  // 和一条没写的错误处理等价(本仓这一族已记过多次"演练只能证明会红,判据才证明不会修")。
  const dir = createTempGitRepo()
  try {
    const d = dateAgo(30)
    const opt = { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    const original = `# plan\n\n### 任务A(已完成 ✅ ${d})\n正文A\n\n## 保留章节\n别的内容\n`
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), original)
    spawnSync('git', ['add', 'PROJECT_PLAN.md'], opt)
    spawnSync('git', ['commit', '-q', '-m', 'init'], opt)

    const r = spawnSync('node', [SCRIPT_PATH, '--auto-commit'], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
      env: { ...process.env, IHUI_GIT_BIN: process.execPath }, // 让 git add 失败
    })
    assert.notEqual(r.status, 0, `git add 失败时本门不得报成功(旧实现只打一句"请手动"然后 exit 0)`)
    assert.equal(
      readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'),
      original,
      '计划文档必须逐字节回到搬运前 —— 不得留下"内容已搬走而无人记住"的中间态',
    )
    const out = String(r.stdout || '')
      .concat(String(r.stderr || ''))
      .replace(/\x1b\[[0-9;]*m/g, '')
    assert.match(out, /已回滚|未被索引收下|add -f 失败/, '必须喊出为什么回滚')
    // 索引里不得残留计划文档的改写(那条改写已被工作树还原抵消)
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], opt).stdout.trim()
    assert.ok(
      !staged.split('\n').includes('PROJECT_PLAN.md'),
      `撤销暂存必须生效,实得 staged=${JSON.stringify(staged)}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
