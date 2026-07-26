import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-delivery-report-consistency.mjs')

// ─── 辅助:创建临时项目根(无 PROJECT_PLAN.md,非 staged 模式扫描 0 文件) ──
function createTempProject() {
  return mkdtempSync(join(tmpdir(), 'ihui-report-'))
}

// 辅助:创建临时 git 仓库(--staged 模式需要)
function createTempRepo() {
  const root = mkdtempSync(join(tmpdir(), 'ihui-report-repo-'))
  execSync('git init -b main', { cwd: root, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: root, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: root, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: root, stdio: 'pipe' })
  writeFileSync(join(root, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: root, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: root, stdio: 'pipe' })
  return root
}

// 辅助:写入 PROJECT_PLAN.md(非 staged 模式扫描目标)
function writeProjectPlan(root, content) {
  writeFileSync(join(root, 'PROJECT_PLAN.md'), content)
}

// 辅助:写入并 stage 一个 .md 文件(--staged 模式)
function stageMd(root, relPath, content) {
  const fullPath = join(root, relPath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
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

// 辅助:断言脚本通过(无矛盾)
function assertPass(r) {
  assert.equal(
    r.status,
    0,
    `应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(r.stdout, /交付报告一致性守门通过/, 'stdout 应含"通过"标记')
}

// 辅助:断言脚本检测到矛盾(违规输出走 console.log + console.error,exit 1)
function assertFail(r, pattern) {
  assert.equal(
    r.status,
    1,
    `应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  if (pattern) {
    assert.match(
      r.stdout,
      pattern,
      `stdout 应含 ${pattern}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
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

// ─── 2. 非 staged 模式无 PROJECT_PLAN.md → 0 文件扫描,exit 0 ──
test('CLI: 非 staged 模式无 PROJECT_PLAN.md → 0 文件,exit 0', () => {
  const root = createTempProject()
  try {
    const r = runScript(root)
    assertPass(r)
    assert.match(r.stdout, /扫描文件:\s+0/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 3. 空报告 → 通过 ─────────────────────────────────────
test('合法: 空报告(只有 H2 标题)→ 通过', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(root, '# Project Plan\n\n## 章节一\n\n内容。\n')
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4. 只含完整收尾类(避开子串 bug)→ 通过 ──────────────
// 注:源脚本 REMAINING_KEYWORDS 含 '后续建议',而 COMPLETE_PHRASES 含 '无后续建议',
// 前者是后者子串,所以含"无后续建议"的章节会被误判含"后续建议" → 误报矛盾。
// 这是源脚本已知 bug(任务约束不修改源脚本),本测试用"完整收尾"避开。
test('合法: 章节只含"完整收尾"(避开"无后续建议"子串 bug)→ 通过', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 A (2026-08-01)\n\n任务完整收尾,全部完成。\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 4b. 源脚本已知 bug:"无后续建议"被误判含"后续建议"子串 → 误报矛盾 ──
test('行为(源脚本 bug): 含"无后续建议"会被误判含"后续建议" → 误报矛盾', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 A-bug (2026-08-01)\n\n任务已完成,无后续建议。\n',
    )
    const r = runScript(root)
    // 源脚本用 text.includes('后续建议') 检查,而"无后续建议"含"后续建议"子串 → 误报
    assertFail(r, /无后续建议/)
    assert.match(r.stdout, /后续建议/, '应误报含"后续建议"')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 5. 只含"P1-P5 优化项"无矛盾 → 通过 ──────────────────
test('合法: 章节只含"P1-P5 优化项"无完整收尾类 → 通过', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 B (2026-08-01)\n\n仍有 P1-P5 优化项待跟进。\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 6. "无后续建议" + "P1-P5" → 检测到矛盾 ───────────────
test('违规: 同一章节含"无后续建议" + "P1-P5" → 检测到矛盾', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 C (2026-08-01)\n\n任务已完成,无后续建议。\n\n仍有 P1-P5 优化项待跟进。\n',
    )
    const r = runScript(root)
    assertFail(r, /无后续建议/)
    assert.match(r.stdout, /P1-P5/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 7. "完整收尾" + "TODO" → 检测到矛盾 ─────────────────
test('违规: 同一章节含"完整收尾" + "TODO" → 检测到矛盾', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 D (2026-08-01)\n\n本任务完整收尾。\n\nTODO: 优化 X。\n',
    )
    const r = runScript(root)
    assertFail(r, /完整收尾/)
    assert.match(r.stdout, /TODO/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 8. "可以关闭对话" + "后续建议" → 检测到矛盾 ──────────
test('违规: 同一章节含"可以关闭对话" + "后续建议" → 检测到矛盾', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 E (2026-08-01)\n\n可以关闭对话。\n\n后续建议:优化 Y。\n',
    )
    const r = runScript(root)
    assertFail(r, /可以关闭对话/)
    assert.match(r.stdout, /后续建议/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 9. 多个矛盾词对 → 多个违规 ───────────────────────────
test('违规: 同一章节含多个完整收尾类 + 多个后续工作类 → 报告多个违规词对', () => {
  const root = createTempProject()
  try {
    // 用"完整收尾"+"已闭环"(避开"无后续建议"子串 bug)
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 F (2026-08-01)\n\n' +
        '任务完整收尾,已闭环。\n\n' +
        'TODO: 优化 X。P1-P5 优化项待跟进。\n',
    )
    const r = runScript(root)
    assertFail(r, /完整收尾/)
    // 完整收尾类措辞行应含 完整收尾 / 已闭环(用 [\s\S]* 跨行匹配)
    assert.match(r.stdout, /完整收尾类措辞:[\s\S]*?完整收尾[\s\S]*?已闭环/)
    // 后续工作类条目行应含 TODO / P1-P5 / 优化项
    assert.match(r.stdout, /后续工作类条目:[\s\S]*?TODO[\s\S]*?P1-P5[\s\S]*?优化项/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 10. 只有"已完成"无后续 → 通过 ───────────────────────
test('合法: 章节只含"已完成"无后续工作类 → 通过', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 G (2026-08-01)\n\n任务 G 已完成。\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 11. 只有"P2 待办"无完整收尾类 → 通过 ─────────────────
test('合法: 章节只含"P2"无完整收尾类 → 通过', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 H (2026-08-01)\n\nP2:优化 Y。\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 12. 豁免: AGENTS.md 第 11 节相关章节 → 通过 ──────────
test('豁免: 章节含"AGENTS.md 第 11 节" → 不算违规(规则说明章节)', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 规则说明\n\n依据 AGENTS.md 第 11 节,无后续建议与 P1-P5 优化项互斥。\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 13. 豁免: 含"还有 N 项后续工作"措辞 → 通过 ────────────
test('豁免: 章节含"还有 3 项后续工作" → 通过(措辞模板豁免)', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 I (2026-08-01)\n\n本任务已完整收尾,还有 3 项后续工作,见下方列表。\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 14. 豁免: 章节日期 ≤ 2026-07-17 → 通过(规则未立或刚立) ──
test('豁免: 章节日期 2026-07-17(规则刚立)→ 通过(历史章节不回溯)', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 旧任务 (2026-07-17)\n\n无后续建议,仍有 P1-P5 优化项。\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 15. 豁免: 章节日期 < 2026-07-17 → 通过(规则未立) ────
test('豁免: 章节日期 2026-07-10(规则未立)→ 通过', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 更早任务 (2026-07-10)\n\n无后续建议,仍有 TODO 项。\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 16. 不同章节分别含两类措辞 → 通过(不在同一章节) ────
test('合法: 不同章节分别含完整收尾类 / 后续工作类 → 通过(不在同一章节不算矛盾)', () => {
  const root = createTempProject()
  try {
    // 用"完整收尾"避开"无后续建议"子串 bug
    writeProjectPlan(
      root,
      '# Project Plan\n\n' +
        '## 任务 J (2026-08-01)\n\n本任务完整收尾。\n\n' +
        '## 任务 K (2026-08-01)\n\n仍有 P1-P5 优化项。\n',
    )
    const r = runScript(root)
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 17. H3 子章节继承 H2 祖先日期 → 豁免 ─────────────────
test('豁免: H3 子章节继承 H2 祖先日期 ≤ 2026-07-17 → 通过', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n' +
        '## 阶段一 (2026-07-15)\n\n阶段说明。\n\n' +
        '### 子任务\n\n本子任务无后续建议,仍有 P1-P5 优化项。\n',
    )
    const r = runScript(root)
    // H3 子任务 继承 H2 阶段一 日期 2026-07-15 ≤ 2026-07-17 → 豁免
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 18. --staged 模式: 暂存 .md 含矛盾 → 检测到 ──────────
test('staged: 暂存 .md 文件含矛盾 → 检测到 exit 1', () => {
  const root = createTempRepo()
  try {
    stageMd(
      root,
      'docs/report.md',
      '# Report\n\n## 任务 X\n\n无后续建议,仍有 P1-P5 优化项。\n',
    )
    const r = runScript(root, ['--staged'])
    assertFail(r, /无后续建议/)
    assert.match(r.stdout, /P1-P5/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 19. --staged 模式: 暂存 .md 无矛盾 → 通过 ────────────
test('staged: 暂存 .md 文件无矛盾 → 通过', () => {
  const root = createTempRepo()
  try {
    // 用"完整收尾"避开"无后续建议"子串 bug
    stageMd(
      root,
      'docs/report.md',
      '# Report\n\n## 任务 Y\n\n任务完整收尾,全部完成。\n',
    )
    const r = runScript(root, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 20. --staged 模式: 空暂存区 → 跳过 exit 0 ────────────
test('staged: 空暂存区(无 .md staged)→ 跳过 exit 0', () => {
  const root = createTempRepo()
  try {
    const r = runScript(root, ['--staged'])
    assert.equal(r.status, 0, `空暂存区应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /暂存区无 \.md 变更|跳过/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 21. --staged 模式: 历史违规章节不阻塞(只检查含新增行的章节) ──
test('staged: 历史违规章节(无新增行)不检查,只检查 staged 新增行所在章节', () => {
  const root = createTempRepo()
  try {
    // baseline: 含违规的旧章节(已 commit)
    // 用"完整收尾"+"TODO"作为历史违规(避免"无后续建议"子串 bug 干扰)
    const baselineContent =
      '# Report\n\n## 旧任务 (2026-07-10)\n\n完整收尾,仍有 TODO 项。\n'
    mkdirSync(join(root, 'docs'), { recursive: true })
    writeFileSync(join(root, 'docs', 'report.md'), baselineContent)
    execSync('git add docs/report.md', { cwd: root, stdio: 'pipe' })
    execSync('git commit -m "init report"', { cwd: root, stdio: 'pipe' })
    // 修改:在新章节(不违规)加一行 → staged
    const updatedContent =
      baselineContent +
      '\n## 新任务 (2026-08-01)\n\n新任务已完成,无矛盾。\n'
    writeFileSync(join(root, 'docs', 'report.md'), updatedContent)
    execSync('git add docs/report.md', { cwd: root, stdio: 'pipe' })
    const r = runScript(root, ['--staged'])
    // 旧章节(违规)无新增行 → 不检查 → 通过
    assertPass(r)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 22. --staged 模式: 暂存非 .md 文件 → 跳过(只检查 .md) ──
test('staged: 暂存 .ts 文件(非 .md)→ 跳过 exit 0', () => {
  const root = createTempRepo()
  try {
    stageMd(root, 'apps/api/code.ts', 'export const x = 1\n')
    const r = runScript(root, ['--staged'])
    // .ts 不是 .md → 暂存区 .md 列表为空 → 跳过
    assert.equal(r.status, 0, `非 .md staged 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /暂存区无 \.md 变更|跳过/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 23. "可以关闭" 措辞(非"可以关闭对话")→ 检测到 ────────
test('违规: 同一章节含"可以关闭" + "TODO" → 检测到矛盾', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 L (2026-08-01)\n\n对话可以关闭。\n\nTODO: 优化 Z。\n',
    )
    const r = runScript(root)
    assertFail(r, /可以关闭/)
    assert.match(r.stdout, /TODO/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 24. "已闭环" + "待跟进" → 检测到矛盾 ─────────────────
test('违规: 同一章节含"已闭环" + "待跟进" → 检测到矛盾', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 M (2026-08-01)\n\n本任务已闭环。\n\n待跟进:优化 W。\n',
    )
    const r = runScript(root)
    assertFail(r, /已闭环/)
    assert.match(r.stdout, /待跟进/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 25. "100% 完成" + "未实现" → 检测到矛盾 ──────────────
test('违规: 同一章节含"100% 完成" + "未实现" → 检测到矛盾', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 N (2026-08-01)\n\n本任务 100% 完成。\n\n未实现:功能 X。\n',
    )
    const r = runScript(root)
    assertFail(r, /100% 完成/)
    assert.match(r.stdout, /未实现/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

// ─── 26. 全量模式扫描 PROJECT_PLAN.md(单文件) ────────────
test('全量模式: 扫描 PROJECT_PLAN.md 单文件(脚本仅 visit 该文件)', () => {
  const root = createTempProject()
  try {
    writeProjectPlan(
      root,
      '# Project Plan\n\n## 任务 O (2026-08-01)\n\n无后续建议,仍有 P1-P5 优化项。\n',
    )
    const r = runScript(root)
    assertFail(r)
    // 应报告扫描 1 个文件
    assert.match(r.stdout, /扫描文件:\s+1/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
