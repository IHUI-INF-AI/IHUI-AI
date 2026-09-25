// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-project-plan-archive.mjs')

/**
 * 临时夹具落点 = `scripts/lib/scratch-dir.mjs`(§26 唯一落点),**不用 `os.tmpdir()`**
 * —— 活进程的 TEMP 在本机可能仍钉在 C 盘,而本仓的临时夹具已经在 C 盘堆过 45 个/天。
 *
 * ⚠️ 取材面纪律(本文件曾整批失效的地方):门脚本自 9bd6748ba 起 **ROOT 由脚本自身位置推导**,
 * 所以 `spawnSync(..., { cwd: 夹具 })` 不再把门指到夹具 —— 13 例里 11 例其实在**扫真仓**,
 * 而真仓的审面(HEAD/索引)根本没有夹具那些文件 ⇒ 结论与夹具无关(守门 70 同型教训:
 * "测试靠 cwd 定位夹具而脚本按定义忽略 cwd",14 例全绿也是假绿)。
 * 夹具一律经 **`--root <夹具>`** 显式通道进入;`--worktree` 是这些用例的真实语义
 * (它们构造的是"已提交基线 + 未提交工作树编辑"这一对,而缺省档判的是 HEAD^ → HEAD)。
 */
// 创建临时 git repo(check-project-plan-archive.mjs 调用 git show/diff,需 git 环境)
function createTempGitRepo() {
  const dir = mkScratch('ihui-plan-archive-')
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

// 把归档锚点文件**提交进仓库**(A2 的"点名对象必须在审面里"只认已入库的那一份)
function commitAnchor(repoDir, name, content = '# 归档正文\n') {
  mkdirSync(join(repoDir, '.ihui-agent', 'archive'), { recursive: true })
  writeFileSync(join(repoDir, '.ihui-agent', 'archive', name), content)
  const opt = { cwd: repoDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  spawnSync('git', ['add', '.'], opt)
  spawnSync('git', ['commit', '-q', '-m', `archive anchor ${name}`], opt)
}

// 修改 working tree(不 stage)
function writeWorkingTree(repoDir, content) {
  writeFileSync(join(repoDir, 'PROJECT_PLAN.md'), content)
}

// 运行脚本并去除 ANSI 颜色码
function runScript(cwd, extraArgs = []) {
  const args = ['--root', cwd, '--worktree', ...extraArgs]
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

test('PROJECT_PLAN.md 未修改(工作树 == HEAD)→ 无删除 ⇒ exit 0 通过', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n### 任务A\n内容\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `未修改应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /归档守门通过/)
  } finally {
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ─── 5. 已完成任务被删除但有归档占位 → 通过 ─────────────

test('已完成任务被删除 + 有归档占位注释 → exit 0 通过(合规移动)', () => {
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n旧内容\n'
    commitPlan(dir, baseline)
    // A2 之后,占位点名的归档文件**必须在审面里** —— 夹具要连锚点一起造,否则这道合规用例
    // 会红在"A2 落空"上,而不是红在它想证明的 A0 上。
    commitAnchor(dir, 'PROJECT_PLAN_2026-07-27.md', '### 任务A(已完成 ✅ 2026-07-19)\n旧内容\n')
    // 删除任务A + 添加归档占位
    writeWorkingTree(
      dir,
      '# plan\n\n<!-- 已归档(2026-07-27):任务A 任务,完整内容在 .ihui-agent/archive/PROJECT_PLAN_2026-07-27.md -->\n',
    )
    const r = runScript(dir)
    assert.equal(r.status, 0, `有归档占位且锚点在审面 ⇒ exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /归档守门通过/)
  } finally {
    rmScratch(dir)
  }
})

test('占位点名一个从未入库的归档文件 → exit 1(A2:§1 的承诺落空)', () => {
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n旧内容\n'
    commitPlan(dir, baseline)
    writeWorkingTree(
      dir,
      '# plan\n\n<!-- 已归档(2026-07-27):任务A 任务,完整内容在 .ihui-agent/archive/PROJECT_PLAN_2026-07-27.md -->\n',
    )
    const r = runScript(dir)
    assert.equal(r.status, 1, `占位点名不存在的锚点应 exit 1\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.err, /A2 占位点名的归档文件不在审面/)
  } finally {
    rmScratch(dir)
  }
})

test('盘上有归档件而未 git add → exit 1(A1:本机副本不构成锚点)', () => {
  const dir = createTempGitRepo()
  try {
    const baseline = '# plan\n\n### 任务A(已完成 ✅ 2026-07-19)\n旧内容\n'
    commitPlan(dir, baseline)
    mkdirSync(join(dir, '.ihui-agent', 'archive'), { recursive: true })
    writeFileSync(join(dir, '.ihui-agent', 'archive', 'PROJECT_PLAN_2026-07-27.md'), '### 任务A\n')
    writeWorkingTree(
      dir,
      '# plan\n\n<!-- 已归档(2026-07-27):任务A,完整内容在 .ihui-agent/archive/PROJECT_PLAN_2026-07-27.md -->\n',
    )
    const r = runScript(dir)
    assert.equal(r.status, 1, `未入库的本机副本应 exit 1\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.err, /A1 归档锚点只在本机、未进版本控制/)
  } finally {
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

test('A3 端到端:归档件内部的占位指向不存在的锚点 → exit 1 并点名 A3', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n### 任务A\n内容\n')
    // 元归档层:归档文件正文里再写"完整内容在 archive/<另一个文件>",而那个文件从来没有过。
    // A2 只扫计划文档 ⇒ 这一层过去无人看守(G-192 实测 218 条嵌在 2026-09-12 那份里)。
    // 必须 commit:worktree 档的审面是 HEAD,只 add 不 commit 会先撞上 A1。
    commitAnchor(
      dir,
      'PROJECT_PLAN_2026-07-22_meta.md',
      '# 元归档\n\n引用 .ihui-agent/archive/PROJECT_PLAN_2099-12-31_never.md 但那份从未写过\n',
    )
    const r = runScript(dir)
    assert.equal(r.status, 1, `归档件点名不存在的锚点应 exit 1\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.err, /A3 占位点名的归档文件不在审面:PROJECT_PLAN_2099-12-31_never\.md/)
  } finally {
    rmScratch(dir)
  }
})

test('A3 反向对照:同一份归档件点名**已在审面**的锚点 → exit 0(不是把整层一律判红)', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n### 任务A\n内容\n')
    commitAnchor(dir, 'PROJECT_PLAN_2026-07-22_target.md', '### 任务B(已完成 ✅)\nB\n')
    commitAnchor(dir, 'PROJECT_PLAN_2026-07-22_meta.md', '引用 .ihui-agent/archive/PROJECT_PLAN_2026-07-22_target.md\n')
    const r = runScript(dir)
    assert.equal(r.status, 0, `被点名对象已入库 ⇒ 不该红\nstdout: ${r.out}\nstderr: ${r.err}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 10. 夹具装载本身(防"13 例全绿其实在扫真仓") ──────────
//
// 9bd6748ba 把 ROOT 改成按脚本自身位置推导之后,本文件 13 例里有 11 例**静默变成在审真仓**:
// `cwd` 不再能定位夹具,而真仓的审面里没有夹具那些标题 ⇒ 断言的是别人的仓库状态。
// 这正是守门 70 记过的那一型(14 例镜像测试 13/14 恒红,原因不是判据错而是调用方式失效)。
// 所以这里用两条**源码级**反向锁钉住,而不是只加一条会一起漂绿的断言。

test('夹具必须经 --root 显式进入(不得再依赖 cwd 定位夹具)', async () => {
  const src = await readFile(new URL(import.meta.url), 'utf8')
  const m = src.match(/function runScript[\s\S]*?\n\}/)
  assert.ok(m, '找不到 runScript —— 夹具通道被改名/重构时必须让这条锁红,提醒同步')
  assert.match(m[0], /'--root'/, "runScript 不再传 --root ⇒ 全部用例回到'按 cwd 定位'的假绿形态")
  assert.ok(
    !/spawnSync\('node',\s*\[SCRIPT_PATH,\s*\.\.\.args\]/.test(src) || /'--root', cwd/.test(src),
    'spawn 调用点没有把 --root 传给门',
  )
})

test('临时夹具落点是 scratch-dir(§26),不得回到 os.tmpdir()', async () => {
  const src = await readFile(new URL(import.meta.url), 'utf8')
  assert.ok(!/from\s*'node:os'/.test(src), "又 import 了 node:os —— 活进程 TEMP 可能钉在 C 盘(§26)")
  assert.ok(!/mkdtempSync\(/.test(src), '又用裸 mkdtempSync 造夹具,绕过 scratch-dir 的落点约束')
  assert.match(src, /from\s*'\.\.\/lib\/scratch-dir\.mjs'/, '夹具未走 scripts/lib/scratch-dir.mjs')
})

test('阻塞判据不得回到 `!del.addedPlaceholders`(空数组是真值 ⇒ 拦了却不说话)', async () => {
  const src = await readFile(new URL('../check-project-plan-archive.mjs', import.meta.url), 'utf8')
  assert.ok(
    !/!\s*del\.addedPlaceholders\b/.test(src),
    'main() 又用数组真值判合规:删了已完成条目时门会 exit 1 **且零输出**,' +
      '调用方只看到"提交被阻止"看不到原因(9bd6748ba 落地后由本文件的端到端用例抓到)',
  )
  assert.match(src, /if \(!del\.compliant\) \{/, 'A0 阻塞分支必须走 deletionVerdict 的 compliant')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
