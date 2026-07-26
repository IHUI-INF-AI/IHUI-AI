import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-project-plan-archive.mjs')

// 创建临时 git repo(check-project-plan-archive.mjs 调用 git show/diff,需 git 环境)
function createTempGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-plan-archive-'))
  const opt = { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  spawnSync('git', ['init', '-q'], opt)
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], opt)
  spawnSync('git', ['config', 'user.name', 'Test'], opt)
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], opt)
  return dir
}

// 在 git repo 中写入 PROJECT_PLAN.md + commit(作为 baseline)
function commitPlan(repoDir, content, msg = 'init plan') {
  writeFileSync(join(repoDir, 'PROJECT_PLAN.md'), content)
  const opt = { cwd: repoDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  spawnSync('git', ['add', 'PROJECT_PLAN.md'], opt)
  spawnSync('git', ['commit', '-q', '-m', msg], opt)
}

// 修改 working tree(不 stage)
function writeWorkingTree(repoDir, content) {
  writeFileSync(join(repoDir, 'PROJECT_PLAN.md'), content)
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

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempGitRepo()
  try {
    const r = runScript(dir, ['--help'])
    assert.ok(
      r.status === 0 || r.status === 1,
      `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 文件不存在 / 未修改 → 通过 ───────────────────────

test('PROJECT_PLAN.md 不存在 → exit 0 + 跳过消息', () => {
  const dir = createTempGitRepo()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `文件不存在应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('PROJECT_PLAN.md 未修改(working tree == HEAD)→ exit 0 + 跳过', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n### 任务A\n内容\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `未修改应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /未修改|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 无已完成任务 → 通过 ──────────────────────────────

test('无已完成任务(只有未完成任务)→ exit 0 通过', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n### 任务A\n- [ ] 待办\n')
    // 修改:添加新未完成任务
    writeWorkingTree(dir, '# plan\n\n### 任务A\n- [ ] 待办\n\n### 任务B\n- [ ] 新待办\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `无已完成任务应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /归档守门通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 已完成任务被删除 → 阻塞 ─────────────────────────

test('已完成任务被删除且无归档占位 → exit 1 阻塞', () => {
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n旧内容\n'
    commitPlan(dir, baseline)
    // 删除任务A,无归档占位
    writeWorkingTree(dir, '# plan\n\n')
    const r = runScript(dir)
    assert.equal(r.status, 1, `已完成任务被删应 exit 1\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.err, /归档守门失败/)
    assert.match(r.err, /任务A/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('已完成任务(已完成 标记,无 ✅)被删除 → exit 1 阻塞', () => {
  // 源脚本:line.includes('已完成') || line.includes('✅')
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n### 任务B(已完成 2026-07-19)\n内容\n'
    commitPlan(dir, baseline)
    writeWorkingTree(dir, '# plan\n')
    const r = runScript(dir)
    assert.equal(r.status, 1, `含"已完成"标记应被识别\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.err, /任务B/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 已完成任务被删除但有归档占位 → 通过 ─────────────

test('已完成任务被删除 + 有归档占位注释 → exit 0 通过(合规移动)', () => {
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n旧内容\n'
    commitPlan(dir, baseline)
    // 删除任务A + 添加归档占位
    writeWorkingTree(
      dir,
      '# plan\n\n<!-- 已归档(2026-07-27):任务A 任务,完整内容在 .trae-cn/archive/PROJECT_PLAN_2026-07-27.md -->\n',
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `有归档占位应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /归档占位注释|合规移动/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. 添加新任务(无删除)→ 通过 ───────────────────────

test('添加新已完成任务(无删除)→ exit 0 通过', () => {
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n内容\n'
    commitPlan(dir, baseline)
    // 添加新任务B(不删除任务A)
    writeWorkingTree(
      dir,
      '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n内容\n\n### 任务B(已完成 ✅ 2026-07-26)\n新内容\n',
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `仅添加不删除应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /归档守门通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 标题识别 + 日期格式 ──────────────────────────────

test('标题识别: ### 前缀 + (已完成 ✅ 2026-07-19) 格式 → 正确提取', () => {
  // 通过端到端验证:删除该标题 → exit 1 + 报告标题
  const dir = createTempGitRepo()
  try {
    const baseline =
      '# plan\n\n### P0 任务A(已完成 ✅ 2026-07-19)\n内容\n'
    commitPlan(dir, baseline)
    writeWorkingTree(dir, '# plan\n')
    const r = runScript(dir)
    assert.equal(r.status, 1)
    assert.match(r.err, /P0 任务A/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('标题识别: 无 ### 前缀的"已完成"行 → 不被识别为任务条目', () => {
  // 源脚本:line.startsWith('### ') → 必须有 ### 前缀
  // 如果 baseline 含 "已完成" 但无 ###,删除它不应触发 block
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n这是正文,提到 已完成 但不是标题\n'
    commitPlan(dir, baseline)
    writeWorkingTree(dir, '# plan\n\n这是修改后的正文\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `非标题行不应被识别\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /归档守门通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. 批量场景 ────────────────────────────────────────

test('批量: 多个已完成任务被删除 → exit 1 + 列出所有被删标题', () => {
  const dir = createTempGitRepo()
  try {
    const baseline =
      '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n内容A\n\n### 任务B(已完成 ✅ 2026-07-20)\n内容B\n\n### 任务C(已完成 ✅ 2026-07-21)\n内容C\n'
    commitPlan(dir, baseline)
    // 删除 A 和 B,保留 C
    writeWorkingTree(dir, '# plan\n\n### 任务C(已完成 ✅ 2026-07-21)\n内容C\n')
    const r = runScript(dir)
    assert.equal(r.status, 1, `删除 2 个应 exit 1\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.err, /2 个/)
    assert.match(r.err, /任务A/)
    assert.match(r.err, /任务B/)
    // 任务C 未被删除,不应出现在错误列表
    const errSection = r.err.split('被删除的已完成任务条目')[1] || ''
    assert.ok(!/任务C/.test(errSection), '任务C 未被删除,不应出现在错误列表')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 归档占位注释识别 ─────────────────────────────────

test('归档占位: <!-- 已归档 --> 格式 → 识别为合规(允许删除)', () => {
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n内容\n'
    commitPlan(dir, baseline)
    // 占位注释格式:<!-- 已归档(...) -->
    writeWorkingTree(
      dir,
      '# plan\n\n<!-- 已归档(2026-07-27):任务A -->\n',
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `占位注释应被识别\nstdout: ${r.out}\nstderr: ${r.err}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('归档占位: 无"已归档"关键字的 HTML 注释 → 不识别(仍 exit 1)', () => {
  // 源脚本 hasArchivePlaceholder:/<!--\s*已归档/.test(diffText)
  // 普通 HTML 注释不算归档占位
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n内容\n'
    commitPlan(dir, baseline)
    // 普通 HTML 注释(不含"已归档")
    writeWorkingTree(dir, '# plan\n\n<!-- 这是普通注释,不是归档占位 -->\n')
    const r = runScript(dir)
    assert.equal(r.status, 1, `普通注释不应被识别为归档占位\nstdout: ${r.out}\nstderr: ${r.err}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
