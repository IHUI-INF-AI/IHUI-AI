// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 形状锁的"不得再出现"那一半一律判剥注释后的代码面(遮罩唯一实现,不得在测试里另抄一份)。
import { maskComments } from '../lib/code-mask.mjs'

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
  const opt = { cwd: dir, encoding: 'utf8' }
  spawnSync('git', ['init', '-q'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.name', 'Test'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  return dir
}

// 在 git repo 中写入 PROJECT_PLAN.md + commit(作为 baseline)
function commitPlan(repoDir, content, msg = 'init plan') {
  writeFileSync(join(repoDir, 'PROJECT_PLAN.md'), content)
  const opt = { cwd: repoDir, encoding: 'utf8' }
  spawnSync('git', ['add', 'PROJECT_PLAN.md'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['commit', '-q', '-m', msg], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
}

// 把归档锚点文件**提交进仓库**(A2 的"点名对象必须在审面里"只认已入库的那一份)
function commitAnchor(repoDir, name, content = '# 归档正文\n') {
  mkdirSync(join(repoDir, '.ihui-agent', 'archive'), { recursive: true })
  writeFileSync(join(repoDir, '.ihui-agent', 'archive', name), content)
  const opt = { cwd: repoDir, encoding: 'utf8' }
  spawnSync('git', ['add', '.'], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['commit', '-q', '-m', `archive anchor ${name}`], { ...opt, /* 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY */ stdio: ['ignore', 'pipe', 'pipe'] })
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
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
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

// ==================== A4「已完成条目被并发 union 复活」====================
// 2026-09-26:归档落地后别的会话拿滞后工作树副本提交,行并集把条目正文按回计划文档
// (占位在、条目也回来)。A0 只看反方向,这一族当天演了三次。
const { resurrectionVerdict } = await import('../check-project-plan-archive.mjs')

test('A4 判据必须真的接在 runCheck 的返回值上(判据在、没挂上 = 没有)', async () => {
  const src = await readFile(new URL('../check-project-plan-archive.mjs', import.meta.url), 'utf8')
  assert.match(src, /return del\.compliant && res\.compliant/, 'A4 的 compliant 没进退出码 = 提交链上一路绿灯')
  assert.match(src, /const res = resurrectionVerdict\(/, 'A4 必须在 runCheck 里被调用(不是只导出)')
})

test('A4 真实标题形态:占位与同一条目并存 ⇒ 判本次引入的复活', () => {
  // 输入逐字取自 HEAD 版计划文档里的真实占位与真实标题(§22c:判据的对象是文件形态时,
  // 至少一条用例的输入必须来自真实文件,否则夹具只是在复读实现)。
  const head = execFileSync(
    'git',
    ['-c', 'safe.directory=*', 'show', 'HEAD:PROJECT_PLAN.md'],
    // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
    { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, windowsHide: true },
  )
  const ph = head.split('\n').find((l) => /^<!-- 已归档/.test(l))
  assert.ok(ph, 'HEAD 版计划文档里应能找到至少一条归档占位(找不到说明本用例的尺子失效)')
  // 标题提取必须按**归档器实际生成的形态**(archiver:397 = `<!-- 已归档(日期:标题,完整内容在 …`),
  // 不是 AGENTS 散文里那个"(日期):标题"旧形 —— 旧提取式 `indexOf('):')` 在现形占位上得 -1,
  // slice(1,…) 取出一串不含 ✅ 的垃圾"标题",判据 0 命中而本用例恒红(2026-09-28 实测,A4 当场翻红)。
  // 日期固定 YYYY-MM-DD 形态,所以"日期后那个冒号"是安全锚点;标题内部自带的冒号不受影响。
  const phTitle = /<!-- 已归档\(\d{4}-\d{2}-\d{2}:([\s\S]*),完整内容在 /.exec(ph)
  assert.ok(phTitle, '占位行不符合归档器现行生成形态(日期:标题,完整内容在)⇒ 本用例与生成器有一边漂了,先对齐再跑')
  const title = phTitle[1].trim()
  const face = `### ${title}\n正文一行\n${ph}\n`

  const r = resurrectionVerdict('', face)
  assert.equal(r.introduced.length, 1, '真实形态的复活必须被点名')
  assert.equal(r.compliant, false)

  // 反向对照两条,缺一就是一场恒红门:
  //  ① 存量(上一版就这样)不得追账到本次提交者头上;
  //  ② 正常归档完成态(只有占位、没有条目)必须为 0。
  assert.equal(resurrectionVerdict(face, face).introduced.length, 0, '上一版即存在的复活不得判红')
  assert.equal(resurrectionVerdict(face, `${ph}\n`).introduced.length, 0, '归档完成态被判红 = 门反着咬自己')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ─── 2026-09-26 粒度对齐 + T3 元判据(归档粒度扩到 ##/###;提取实现收进 lib;T3 守"判据看见现实") ───
import { __test__ as archiveGate } from '../check-project-plan-archive.mjs'
// A1 的三条分流要按**构造台账**喂:生产台账已随存量清偿清空,那两臂在真仓上不再触发,
// 只有构造面能证明它们还在 ⇒ 直接取判据函数,不在测试里重抄一份判定。
import { anchorVerdict } from '../check-project-plan-archive.mjs'
import { shapeCoverageVerdict as libShapeCoverageVerdict } from '../lib/plan-task-headings.mjs'

test('真实 HEAD 面逐字样本:现行提取式无失明;提取式收窄回"只认 ###"必红(§22c 有牙证明)', () => {
  const head = execFileSync('git', ['-c', 'safe.directory=*', 'show', 'HEAD:PROJECT_PLAN.md'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout: 60_000,
  })
  const sample = head.split(/\r?\n/).find((l) => /^## .+✅/.test(l))
  assert.ok(sample, 'HEAD 面必有 ##+✅ 行(2026-09-26 实测 71 处);取不到 = 现读失败,本例判死')
  assert.ok(archiveGate.extractCompletedTaskHeadings(head).includes(sample))
  assert.equal(
    libShapeCoverageVerdict(head, { grandfathered: archiveGate.T3_GRANDFATHERED_SHAPES }).red.length,
    0,
    '现行提取式 + 存量台账对 HEAD 不得判红(h4 两形态在台账只报数)',
  )
  const narrow = (line) => line.startsWith('### ') && (line.includes('✅') || line.includes('已完成'))
  const v = libShapeCoverageVerdict(head, { isCovered: narrow })
  assert.ok(
    v.red.some((r) => r.includes('h2|✅')),
    '收窄回 2026-09-26 之前的形态必须被 T3 点名 —— 那次空转(## 级 71 条看不见)从此有哨兵',
  )
})

test('提取实现只有一份:本门与归档器源码都不得再本地声明标题提取式', () => {
  const gateSrc = readFileSync(SCRIPT_PATH, 'utf8')
  assert.ok(!/function extractCompletedTaskHeadings/.test(gateSrc), '13c 不得回来一份自己的提取式')
  assert.ok(!/function parseCompletedTasks\b/.test(gateSrc), '13c 不得复制归档器的块解析')
  const archSrc = readFileSync(
    join(__dirname, '..', 'archive-completed-tasks.mjs'),
    'utf8',
  )
  // 只禁「执行形态」的重复判据(正则字面量紧跟 .test(),即真正会跑的标题识别)——
  // 注释里以历史教训口吻引用的旧式 `/^### \[x\]/` 是文档,不构成第二份真相,不该被锁误伤。
  assert.ok(
    !/\/\^### [^/]*\/\.test\(/.test(archSrc),
    '归档器不得再自带可执行的标题识别式 —— 两边各写一遍正是"写法一漂、静默失明"的成因',
  )
  assert.ok(!/function parseCompletedTasks\b/.test(archSrc), '归档器不得再本地保留块解析函数(须走 lib)')
  assert.ok(/from '\.\/lib\/plan-task-headings\.mjs'/.test(gateSrc))
  assert.ok(/from '\.\/lib\/plan-task-headings\.mjs'/.test(archSrc))
})

test('## 级条目被直接删除(无占位)⇒ exit 1;换成占位 ⇒ exit 0(粒度对齐的端到端)', () => {
  const dir = createTempGitRepo()
  try {
    const base = [
      '# plan',
      '',
      '## O99 根治某某静默失效(2026-01-01 立并完成 ✅)',
      '条目正文 A',
      '',
      '### 已完成清单',
      '不是条目',
      '',
      '## 活的章节',
      '内容',
    ].join('\n')
    commitPlan(dir, base)
    // 删掉 ## 条目整块、不留占位 ⇒ 扩到 ## 的保护集必须拦得住
    writeWorkingTree(dir, '# plan\n\n### 已完成清单\n不是条目\n\n## 活的章节\n内容\n')
    const r = runScript(dir)
    assert.equal(r.status, 1, `## 级条目被无声删除必须 exit 1,实得 ${r.status}\n${r.out}`)
    assert.ok(r.err.includes('O99'), '被删标题(剥前缀后)须被点名')
    // 同一次删除换上占位 ⇒ 合规
    writeWorkingTree(
      dir,
      '# plan\n\n<!-- 已归档(2026-01-02):O99 根治某某静默失效(2026-01-01 立并完成 ✅),完整内容在 .ihui-agent/archive/PROJECT_PLAN_*.md -->\n\n### 已完成清单\n不是条目\n\n## 活的章节\n内容\n',
    )
    const r2 = runScript(dir)
    assert.equal(r2.status, 0, `带占位应合规,实得 ${r2.status}\n${r2.err.slice(0, 300)}`)
  } finally {
    rmScratch(dir)
  }
})

test('T3 端到端:工作树出现未登记的已完成形态(h5+✅)⇒ exit 1 并点名形态与行号', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n- [ ] 活任务\n')
    writeWorkingTree(
      dir,
      '# plan\n\n- [ ] 活任务\n\n##### 某新阶段(2026-02-02 完成 ✅)\n正文\n',
    )
    const r = runScript(dir)
    assert.equal(r.status, 1, `新形态不被提取式覆盖必须判红,实得 ${r.status}\n${r.out}${r.err}`)
    assert.ok(r.err.includes('T3 判据失明'), '必须喊"判据失明"而不是静默跳过')
    assert.ok(r.err.includes('h5|✅'), '必须点名形态(级别|标记)')
    // 同一形态进了存量台账 ⇒ 只报数不判红(防恒红:与任何提交都无关的红只会逼人 --no-verify)
    const r2 = runScript(dir, ['--grandfather', 'h5|✅'])
    assert.equal(r2.status, 0, `登记为存量后不得判红,实得 ${r2.status}\n${r2.err.slice(0, 300)}`)
    assert.ok(r2.out.includes('T3 存量形态'), '但必须打印报数行')
  } finally {
    rmScratch(dir)
  }
})

// ─── 本票追加(守门 13c A1 换射程的取证)───
// A1 换射程后要用到的三件:存量台账(证它只报数且已随清偿清空)、盘上枚举(证射程是
// 目录意图而不是名字形状,含子目录/护栏报名)、审面出口(证"是否入库"只由 git 面回答)。
const { listArchiveDiskFiles, archiveFaceEntries, UNTRACKED_ARCHIVE_LEDGER } = archiveGate

/** 在夹具里造一份"盘上有、面上没有"的归档件(不 commit ⇒ 保持未跟踪)。 */
function writeArchiveFileUntracked(repoDir, rel, content = '# 本机副本\n') {
  const abs = join(repoDir, '.ihui-agent', 'archive', ...rel.split('/'))
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content)
}

test('A1 端到端·反向:AGENTS 前缀的归档件在盘上而未入库 ⇒ exit 1 并逐字点名该文件', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n### 任务A\n内容\n')
    writeArchiveFileUntracked(dir, 'AGENTS_dead-entries-2099-01-01.md')
    const r = runScript(dir)
    assert.equal(
      r.status,
      1,
      `非 PROJECT_PLAN 命名的未入库归档件必须被看见,实得 ${r.status}\n${r.out}${r.err}`,
    )
    assert.ok(
      r.err.includes(
        'A1 归档锚点只在本机、未进版本控制:.ihui-agent/archive/AGENTS_dead-entries-2099-01-01.md',
      ),
      `必须点名 AGENTS 那一族(旧判据在这一族上整族隐身),实得:\n${r.err.slice(0, 500)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('A1 端到端·正向对照:同一份文件提交进仓库 ⇒ exit 0(不是"凡 AGENTS 开头即红")', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n### 任务A\n内容\n')
    commitAnchor(dir, 'AGENTS_dead-entries-2099-01-01.md')
    const r = runScript(dir)
    assert.equal(
      r.status,
      0,
      `按规矩入库就不该红 —— 把合法形态判红的唯一结局是逼人 --no-verify(§12e),实得 ${r.status}\n${r.err.slice(0, 500)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('A1 端到端:射程含子目录,且顶层同名那份不得替子目录里未入库的那份背书', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n### 任务A\n内容\n')
    commitAnchor(dir, 'leaked.md') // 顶层同名那份**已入库**
    writeArchiveFileUntracked(dir, 'audit-probe-2099/leaked.md') // 子目录里同名的没有
    const r = runScript(dir)
    assert.equal(r.status, 1, `子目录那份必须被单独判,实得 ${r.status}\n${r.out}${r.err}`)
    assert.ok(
      r.err.includes('.ihui-agent/archive/audit-probe-2099/leaked.md'),
      `必须点名**整条相对路径**(只比 basename 就成了一假绿),实得:\n${r.err.slice(0, 500)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('A1 端到端(台账已清空这一现实):那条未入库的归档件如今必须直接拦 —— 台账不是永久出口', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, '# plan\n\n### 任务A\n内容\n')
    // 逐字取当初进过台账的那一条真实文件名(§22c:判据输入取自真实文件,不要自造形状)。
    // 2026-10-02:该件已由并发提交真入库 ⇒ 台账行按规矩删除,所以这里再造出"盘上有而面上没有"
    // 的同名形态时,**没有任何东西可以再替它兜底** —— 必须 exit 1 并点名 A1。
    writeArchiveFileUntracked(dir, 'AGENTS_dead-entries-2026-09-30.md')
    const r = runScript(dir)
    assert.equal(
      r.status,
      1,
      `台账清空后未入库的归档件必须拦,实得 ${r.status}\n${r.out}${r.err.slice(0, 500)}`,
    )
    assert.ok(
      /A1 归档\S*只在本机/.test(r.out + r.err),
      `必须点名 A1(只报数那一档只在台账里成立):\n${(r.out + r.err).slice(0, 600)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('A1 三条分流仍是三条(纯函数注入台账):已登记⇒只报数 / 未登记⇒红 / 修好仍挂⇒腐烂红', () => {
  const rel = 'AGENTS_dead-entries-2026-09-30.md'
  // 臂 1:登记过 ⇒ 只报数不判红(这条臂在生产台账清空后**不再由真仓触发**,
  // 所以只能由构造面证明"它还在",否则下一次真长出积压时无人知道出口在不在)。
  const a = anchorVerdict({
    diskAnchors: [rel],
    faceFiles: [],
    faceRelPaths: [],
    planText: '',
    ledger: [],
    archiveLedger: [rel],
  })
  assert.equal(a.red.length, 0, `已登记的存量不得拦,实得 ${JSON.stringify(a.red)}`)
  assert.equal(a.baseline.length, 1, `但必须报出来,不得静默: ${JSON.stringify(a.baseline)}`)
  // 臂 2:同一件、台账不登记 ⇒ 红
  const b = anchorVerdict({
    diskAnchors: [rel],
    faceFiles: [],
    faceRelPaths: [],
    planText: '',
    ledger: [],
    archiveLedger: [],
  })
  assert.equal(b.red.length, 1, `未登记必须红,实得 ${JSON.stringify(b.red)}`)
  // 臂 3:该件已回到审面而台账仍挂着同一行 ⇒ 清单腐烂红(出路是删行,不是继续挂着)
  const c = anchorVerdict({
    diskAnchors: [rel],
    faceFiles: [rel],
    faceRelPaths: [rel],
    planText: '',
    ledger: [],
    archiveLedger: [rel],
  })
  assert.equal(c.red.length, 1, `修好仍挂台账必须红,实得 ${JSON.stringify(c.red)}`)
  assert.ok(c.red[0].startsWith('A1 台账腐烂'), `腐烂要单独点名(与"缺失"出路不同): ${c.red[0]}`)
})

test('形状锁:A1 的候选不得再按 ANCHOR_RE 筛,而 ANCHOR_RE 全门只能剩一个使用点(A3 取材集)', async () => {
  const src = await readFile(new URL('../check-project-plan-archive.mjs', import.meta.url), 'utf8')
  /**
   * "不得再出现 X"这一类**反向**锁一律判剥注释后的代码面。本门的头注与判据注释里逐字写着
   * `readFileSync`、`ANCHOR_RE.test(` 这些**被修掉的旧形态**(它们是在解释 bug),按原文面判
   * 就是把门对自己的说明判成违规 —— 守门 131 的门第一次自跑正是被这样一句注释咬到的(§22c 同族)。
   * "必须出现 X"那一类仍判原文面:注释里的字符串锚点(`',完整内容在'`)是判据本体,剥掉会失明。
   */
  const code = maskComments(src)
  const uses = [...code.matchAll(/ANCHOR_RE\.test\(/g)].length
  assert.equal(
    uses,
    1,
    `ANCHOR_RE.test( 在代码面必须只剩 A3 取材那一个使用点,实得 ${uses} —— 每多一个就是"按名字筛候选"回潮一格`,
  )
  const av = code.match(/export function anchorVerdict\([\s\S]*?\n\}/)
  assert.ok(av, '找不到 anchorVerdict —— 判据被改名或拆走时这条锁必须红,提醒同步')
  assert.ok(!/ANCHOR_RE/.test(av[0]), 'anchorVerdict 体内不得再出现名字形状筛(那正是本票要关的洞)')
  // A3 的取材集**刻意没跟着扩**:把 AGENTS/README/子目录的正文也灌进 archiveText,会让 A2/A3 的
  // 计数口径在这次扩面里被悄悄搅混(约束④)。它若要扩,必须是单独一票并同批重锚台账。
  assert.match(
    code,
    /facePaths\.filter\(\s*\(p\) => ANCHOR_RE\.test/,
    'A3 取材集必须仍是 ANCHOR_RE 那一族',
  )
  assert.match(code, /ls-tree/, '"在不在版本控制里"必须由 git 面回答')
  assert.match(code, /ls-files/, '--staged 档必须走索引面')
  assert.ok(
    !/readFileSync/.test(code),
    '本门不得用磁盘读法判"是否入库"(取材面纪律:内容只走 face-reader)',
  )
})

test('形状锁:占位点名的两处提取式一字不得改(A2/A3 的计数口径不能被扩面搅混)', async () => {
  const src = await readFile(new URL('../check-project-plan-archive.mjs', import.meta.url), 'utf8')
  // 标题切分锚点:归档器写占位用 "(日期:标题,完整内容在 …",而标题里本来就带中文逗号,
  // 所以必须按"最后一个 `,完整内容在`"切;换成正则会在第一个逗号处断掉(2026-09-28 实测翻红过)。
  assert.match(
    src,
    /lastIndexOf\(',完整内容在'\)/,
    'placeholderTitles 的"最后一个逗号段"切分必须原样在位',
  )
  // 指针 harvest 只能有一处:出现第二处 matchAll 就等于给 A2/A3 另开了一把不同的尺子。
  const harvests = (src.match(/matchAll\(/g) || []).length
  assert.equal(harvests, 1, `A2/A3 的指针 harvest 只能有一份实现,实得 ${harvests} 处`)
  // A2/A3 的归属仍按 basename 全集判(不是按 PROJECT_PLAN_ 形状筛)—— G-192 那条假红教训。
  assert.match(src, /onFace\.has\(f\)/, 'A2/A3 必须继续用 faceFiles(basename 全集)判归属')
})

test('形状锁:git 面取不到 ⇒ 未判定分支必须真接在 main() 上(判据在而没挂上 = 没有)', async () => {
  const src = await readFile(new URL('../check-project-plan-archive.mjs', import.meta.url), 'utf8')
  assert.match(
    src,
    /if \(inputs\.faceReadFailed && inputs\.diskAnchors\.length > 0\) \{/,
    '扩面后"面读空"会把整目录误判成未入库,这条护栏必须挂在 main() 上,不能只在 archiveFaceEntries 里记账',
  )
})

test('listArchiveDiskFiles:递归进子目录并返回相对路径;目录缺失时报「未判定」而不是"空扫 = 没有"', () => {
  const dir = mkScratch('ihui-archive-scan-')
  try {
    const missing = listArchiveDiskFiles(dir)
    assert.equal(missing.relPaths.length, 0, '目录不存在时不得凭空造候选')
    assert.ok(
      missing.undetermined.length > 0,
      '「取不到」与「确实没有」必须不同形 —— 静默空扫就是本仓记过最多次的假绿型',
    )
    writeArchiveFileUntracked(dir, 'top-plain.md')
    writeArchiveFileUntracked(dir, 'nested/deep.md')
    writeArchiveFileUntracked(dir, 'nested/deeper/deepest.md')
    assert.deepEqual(listArchiveDiskFiles(dir).relPaths.sort(), [
      'nested/deep.md',
      'nested/deeper/deepest.md',
      'top-plain.md',
    ])
  } finally {
    rmScratch(dir)
  }
})

test('archiveFaceEntries:非 git 目录下必须报 faceReadFailed(旧写法折成"面是空的",扩面后会集体误判红)', () => {
  const dir = mkScratch('ihui-archive-face-')
  try {
    const r = archiveFaceEntries(dir, 'head')
    assert.ok(r.faceReadFailed, 'git 面取不到必须点名,不得静默给空面')
    assert.deepEqual(
      r.faceRelPaths,
      [],
      '面读不到 ⇒ 面集为空是对的,但调用方必须能看到"这是因为读不到"',
    )
  } finally {
    rmScratch(dir)
  }
})

test('A1 台账必须已随债务清偿清空,且清偿是"真入库"而不是"删行装干净"', () => {
  assert.deepEqual(
    UNTRACKED_ARCHIVE_LEDGER,
    [],
    '2026-10-02 现读:AGENTS_dead-entries-2026-09-30.md 已入库 ⇒ 台账行必须删。' +
      '若这里又长出一条,说明有人用"加台账行"而不是"补入库"去消红 —— 台账是待偿清单不是豁免清单。',
  )
  // 光断言"空"是恒真的(删一行就满足),所以必须另取一把**独立**的尺子证明债真还了:
  // 该归档件在 HEAD 面与索引面都真的存在。摘掉那次入库提交 ⇒ 这里翻红。
  const root = join(__dirname, '..', '..')
  const p = '.ihui-agent/archive/AGENTS_dead-entries-2026-09-30.md'
  const inHead = execFileSync('git', ['-c', 'safe.directory=*', 'cat-file', '-e', `HEAD:${p}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: root,
    windowsHide: true,
  })
  void inHead
  const inIndex = execFileSync('git', ['-c', 'safe.directory=*', 'ls-files', '--error-unmatch', p], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  }).trim()
  assert.equal(inIndex, p, `索引面上应能问到你(${p}),实得「${inIndex}」`)
})
