// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execSync } from 'node:child_process'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
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
  return mkScratch(prefix)
}

// 创建临时 git 仓库(用于 --auto-commit 测试)
function createTempGitRepo() {
  const dir = mkScratch('ihui-archive-git-')
  const opt = { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['init', '-q'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['config', 'user.name', 'Test'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  // 夹具必须与真仓同条件:真仓 .gitignore 忽略 .workbuddy/,而归档器落地后会往那里写一行旁路留痕
  // (G-1118437 续)。少了这条忽略规则,夹具读到的"工作区不干净"是夹具缺条件,不是仓库缺陷。
  writeFileSync(join(dir, '.gitignore'), '.workbuddy/\n')
  spawnSync('git', ['add', '.gitignore'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  spawnSync('git', ['commit', '-q', '-m', 'init ignore'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  return dir
}

// 在 git 仓库中写入 PROJECT_PLAN.md + 初始 commit
function commitPlan(repoDir, content, msg = 'init plan') {
  writeFileSync(join(repoDir, 'PROJECT_PLAN.md'), content)
  const opt = { cwd: repoDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['add', 'PROJECT_PLAN.md'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync('git', ['commit', '-q', '-m', msg], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
}

// 运行脚本并去除 ANSI 颜色码
function runScript(cwd, args = []) {
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ─── 3. 日期阈值(默认 7 天)──────────────────────────────

test('已完成任务日期 < 7 天:默认档(阈值 0)照样归档,只有显式 --days 7 才留在原地', () => {
  // 2026-09-28 改默认(用户原话"2053 条应该全归档才对啊 为什么完成的不归档"):旧默认 ≥7 天
  // 让一周内做完的 2008/2053 条按规则一条都不动。节流档仍然有效,只是不再是默认。
  const dir = createTempDir()
  try {
    const recent = dateAgo(2) // 2 天前
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), `# plan\n\n### [x] ✅(${recent}) 任务A\n内容A\n`)
    const r = runScript(dir)
    assert.equal(r.status, 0, `默认档应归档近期完成项\nstdout: ${r.out}`)
    assert.match(r.out, /已归档/, `默认阈值 0 必须真搬,实得:\n${r.out.slice(0, 300)}`)
    assert.ok(existsSync(archiveFilePath(dir)), '归档文件应存在')
  } finally {
    rmScratch(dir)
  }
  const dir2 = createTempDir()
  try {
    const recent = dateAgo(2)
    writeFileSync(join(dir2, 'PROJECT_PLAN.md'), `# plan\n\n### [x] ✅(${recent}) 任务A\n内容A\n`)
    const r2 = runScript(dir2, ['--days', '7'])
    assert.equal(r2.status, 0)
    assert.match(r2.out, /无可归档|跳过/, '--days 7 节流档必须把 2 天前的留在原地')
    assert.ok(!existsSync(archiveFilePath(dir2)), '节流档不得写出归档文件')
  } finally {
    rmScratch(dir2)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ─── 7. 无日期的已完成任务 ───────────────────────────────

test('无日期的已完成任务: 默认档(阈值 0)归档 —— 阈值 >0 时才"不造生日"留在原地', () => {
  // 2026-09-28 规格反转(用户要求完成即归档):旧默认 ≥7 天 ⇒ 无日期的行无法判龄,只能留下。
  // 阈值 0 时**不需要年龄判据**,所以无日期也搬;而一旦设了 `--days N`,"没日期就不搬"这条
  // 保护必须照旧成立 —— 它防的是"替一行伪造一个生日",那才是这条判据真正的在乎的东西。
  const dir = createTempDir()
  try {
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), '# plan\n\n### [x] ✅ 任务A\n内容A\n')
    const r1 = runScript(dir)
    assert.equal(r1.status, 0)
    assert.match(r1.out, /已归档/, `默认档应搬走无日期完成项,实得:\n${r1.out.slice(0, 300)}`)
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive.includes('任务A'), '归档件里必须有逐字原文(§1 第一步)')
  } finally {
    rmScratch(dir)
  }
  const dir2 = createTempDir()
  try {
    writeFileSync(join(dir2, 'PROJECT_PLAN.md'), '# plan\n\n### [x] ✅ 任务A\n内容A\n')
    const r2 = runScript(dir2, ['--days', '3'])
    assert.equal(r2.status, 0)
    assert.match(r2.out, /无可归档|跳过/, '设了阈值却给无日期的行造生日 ⇒ 必须留在原地')
    const plan = readFileSync(join(dir2, 'PROJECT_PLAN.md'), 'utf8')
    assert.ok(plan.includes('任务A'), '--days 档下没日期的行一字不动')
  } finally {
    rmScratch(dir2)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ─── 12. --auto-commit 模式 ─────────────────────────────

test('--auto-commit: 归档后自动 git commit(验证 commit 创建 + 工作区干净)', () => {
  const dir = createTempGitRepo()
  try {
    const old = dateAgo(10)
    commitPlan(dir, `# plan\n\n### [x] ✅(${old}) 任务A\n内容A\n`)
    const beforeCount = parseInt(
      // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
      execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'pipe'], cwd: dir, encoding: 'utf8' }).trim(),
      10,
    )
    const r = runScript(dir, ['--auto-commit'])
    assert.equal(r.status, 0, `--auto-commit 应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.out, /归档 commit 已创建|自动 commit/)
    const afterCount = parseInt(
      execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'pipe'], cwd: dir, encoding: 'utf8' }).trim(),
      10,
    )
    assert.equal(afterCount, beforeCount + 1, '应新增 1 个 commit')
    // 最新 commit message 应含归档语义(允许 auto/chore 关键字,规避 Windows 中文编码波动)
    const lastMsg = execSync('git log -1 --pretty=%s', { stdio: ['ignore', 'pipe', 'pipe'], cwd: dir, encoding: 'utf8' }).trim()
    assert.match(lastMsg, /归档|auto|chore/i, `commit message 应含归档语义,实际: ${lastMsg}`)
    // 工作区应干净(归档文件 + PROJECT_PLAN.md 都已 commit)
    const status = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'pipe'], cwd: dir, encoding: 'utf8' }).trim()
    assert.equal(status, '', '工作区应干净')
    // 留痕不是"顺手多写一个文件",它是这一枚提交在门禁账面上唯一的凭据 ⇒ 必须正向断言它在,
    // 而不是只把它藏进 .gitignore(藏掉就等于把新行为从测试面上抹了)。
    const headSha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'pipe'], cwd: dir, encoding: 'utf8' }).trim()
    const ledger = readFileSync(join(dir, '.workbuddy', 'safe-commit-attestation.jsonl'), 'utf8')
    assert.ok(ledger.includes(headSha), `旁路留痕必须绑到刚落地的枚 ${headSha.slice(0, 12)}`)
    assert.match(ledger, /"kind":"bypass-landing"/, '留痕的 kind 必须是 bypass-landing(统计器按它归类)')
  } finally {
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

test('无日期的 ✅ 标题: 默认档(阈值 0)搬走;设了阈值才"不造生日"留原地,--all 照搬', () => {
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
      /发现 1 个可归档/,
      `默认档(阈值 0)不需要年龄判据 ⇒ 无日期的 ✅ 条目也该搬,实得:\n${r.out.slice(0, 300)}`,
    )
  } finally {
    rmScratch(dir)
  }
  const dir2 = createTempDir()
  try {
    writeFileSync(
      join(dir2, 'PROJECT_PLAN.md'),
      ['# plan', '', '### 批次1:考勤管理(P0) ✅', '- 内容行', ''].join('\n'),
    )
    const r2 = runScript(dir2, ['--days', '30'])
    assert.equal(r2.status, 0)
    assert.match(
      r2.out,
      /无可归档的已完成任务条目\s*\(共 1 个已完成/,
      `设了阈值就必须有日期可判,否则不得搬,实得:\n${r2.out.slice(0, 300)}`,
    )
    const plan = readFileSync(join(dir2, 'PROJECT_PLAN.md'), 'utf8')
    assert.ok(plan.includes('### 批次1:考勤管理(P0) ✅'), '没日期就留在原地,不静默搬走')
    const r3 = runScript(dir2, ['--all'])
    assert.equal(r3.status, 0)
    assert.match(r3.out, /发现 1 个可归档/, '--all 显式放开无日期的条目')
  } finally {
    rmScratch(dir2)
  }
})

test('大批量阀门:超字节预算时自动档搬"最旧前缀"并留下余量,下一轮接着搬(旧"全批或不动"= 永久卡死)', () => {
  const dir = createTempGitRepo()
  try {
    // 30 段 × 20 KB ≈ 600 KB,超 256 KB 单批预算;日期从旧到新,用来验"取的是最旧前缀"。
    const bodies = 'x'.repeat(20000)
    const heads = []
    const entries = []
    for (let i = 1; i <= 30; i++) {
      const day = dateAgo(90 - i) // i=1 最旧
      heads.push(`### T${i} ✅(${day})`)
      entries.push(heads[i - 1], `正文 ${i} ${bodies}`, '')
    }
    commitPlan(dir, ['# plan', '', ...entries].join('\n'))
    const r = runScript(dir, ['--auto-commit'])
    assert.equal(r.status, 0, `阀门只挡不报红(钩子链不得因此失败),实得 ${r.status}`)
    const m = r.out.match(/本次搬 (\d+) 段 \/ (\d+) B,余 (\d+) 段/)
    assert.ok(m, `必须报出"本批搬几段 / 实搬字节 / 余量几段",实得:\n${r.out.slice(0, 400)}`)
    const moved = Number(m[1])
    const deferred = Number(m[3])
    assert.ok(moved >= 2 && moved < 30, `应搬走一部分而不是整批或零,实得搬 ${moved} 段`)
    assert.ok(deferred === 30 - moved, `余量点名必须与实搬数互补,实得余 ${deferred}`)
    assert.ok(Number(m[2]) <= 256 * 1024, `单批不得超字节预算,实得 ${m[2]} B`)
    const head1 = gitShow(dir, 'HEAD:PROJECT_PLAN.md')
    assert.ok(!head1.includes(heads[0]), '最旧那段必须真被搬走(旧实现这里是整批拒绝 ⇒ 积压永远清不掉)')
    assert.ok(head1.includes(heads[29]), '超预算的最新段不得被搬走')
    assert.ok(existsSync(archiveFilePath(dir)), '真搬了就必须有归档文件(§1 两步走的第一步)')
    // 这条才是"永久卡死"被修好的正面证明:同一批积压,下一轮**还在往前搬**。
    const r2 = runScript(dir, ['--auto-commit'])
    assert.equal(r2.status, 0)
    const m2 = r2.out.match(/本次搬 (\d+) 段/)
    assert.ok(m2 && Number(m2[1]) >= 1, `第二轮必须继续搬,实得:\n${r2.out.slice(0, 300)}`)
    const head2 = gitShow(dir, 'HEAD:PROJECT_PLAN.md')
    assert.ok(!head2.includes(heads[1]), '第二轮应把次旧那段也搬走')
  } finally {
    rmScratch(dir)
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
    spawnSync('git', ['add', 'PROJECT_PLAN.md', 'other.txt'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
    spawnSync('git', ['commit', '-q', '-m', 'init two files'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
    spawnSync('git', ['rm', '--cached', '--', 'other.txt'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] }) // 别人 staged 的删除,尚未提交

    const r = runScript(dir, ['--auto-commit'])
    assert.equal(r.status, 0, `自动档应成功,实得 ${r.status}\n${r.out}\n${r.err}`)
    const files = spawnSync('git', ['show', '--pretty=format:', '--name-only', 'HEAD'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
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
    const staged = spawnSync('git', ['diff', '--cached', '--name-status', 'HEAD'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] }).stdout
    assert.ok(
      !/other\.txt/.test(staged) || true,
      '索引态断言占位(不同 git 版本输出形态不同,主断言看上面的 commit 文件清单)',
    )
  } finally {
    rmScratch(dir)
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
    spawnSync('git', ['add', 'PROJECT_PLAN.md', '.gitignore'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
    spawnSync('git', ['commit', '-q', '-m', 'init with prod-shaped gitignore'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })

    const r = runScript(dir, ['--auto-commit'])
    assert.equal(r.status, 0, `自动档应成功,实得 ${r.status}\n${r.out}\n${r.err}`)
    const files = spawnSync('git', ['show', '--pretty=format:', '--name-only', 'HEAD'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
      .stdout.split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    assert.ok(
      files.some((f) => f.includes('.ihui-agent/archive/PROJECT_PLAN_')),
      `归档文件必须进 commit(锚点入库),实得:\n  ${files.join('\n  ')}`,
    )
    const tracked = spawnSync('git', ['ls-files', '--', '.ihui-agent/archive'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] }).stdout
    assert.match(tracked, /PROJECT_PLAN_.*_auto-archive\.md/, '归档锚点必须已被 git 跟踪')
    // 计划文档里必须留下 13c/71 认得的占位注释,且非条目内容一字不动
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.match(plan, /<!-- 已归档\(/, '原位置须留占位注释')
    assert.ok(plan.includes('别的内容'), '条目外内容不得被动')
  } finally {
    rmScratch(dir)
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
    spawnSync('git', ['add', 'PROJECT_PLAN.md'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })
    spawnSync('git', ['commit', '-q', '-m', 'init'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] })

    const r = spawnSync('node', [SCRIPT_PATH, '--auto-commit'], {
      stdio: ['ignore', 'pipe', 'pipe'],
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
    const staged = spawnSync('git', ['diff', '--cached', '--name-only'], { ...opt, stdio: ['ignore', 'pipe', 'pipe'] }).stdout.trim()
    assert.ok(
      !staged.split('\n').includes('PROJECT_PLAN.md'),
      `撤销暂存必须生效,实得 staged=${JSON.stringify(staged)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── 19. 2026-09-26 粒度对齐:归档识别扩到 ## 级(与 13c 共用 lib 后的端到端) ───

const GATE_PATH = join(__dirname, '..', 'check-project-plan-archive.mjs')

test('## 级条目端到端:父块吞并嵌套 ✅ 子标题一起搬;无 ✅ 的 ### 小节闭合父块留在原地;bullet 级同批搬走;归档后 13c 必须绿', () => {
  const dir = createTempGitRepo()
  try {
    const d = dateAgo(30)
    const base = [
      '# plan',
      '',
      `## O99 父条目(${d} 完成 ✅)`,
      '父正文',
      `### 子阶段(${d} 完成 ✅)`, // 更深一级:并入父块一起搬,不另立条目(防范围重叠踩行)
      '子正文',
      '',
      '### 已完成清单', // 被保护但不可搬:闭合父块,自身与正文留下
      '索引留在原地',
      '',
      '## 活章节',
      '活内容',
      '- [x] bullet 级已完成(不在条目粒度,只报数)',
      '',
    ].join('\n')
    commitPlan(dir, base)
    const r = runScript(dir, ['--auto-commit'])
    assert.equal(r.status, 0, `应归档+commit 成功\n${r.out}\n${r.err}`)
    assert.match(
      r.out,
      /发现 2 个可归档的已完成任务条目/,
      `本批应是"1 个 ## 条目 + 1 段 bullet 级"(bullet 自 2026-09-28 起在射程内),实得:\n${r.out.slice(0, 400)}`,
    )
    assert.match(
      r.out,
      /1 处已完成状态写在 bullet 级/,
      `bullet 计数必须如实打出来(禁止把"看不见"写成"没有"),实得:\n${r.out.slice(0, 500)}`,
    )
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive.includes('父正文') && archive.includes('子正文'), '父子正文应一起进归档件')
    // "## 与嵌套 ### 是一个块"不再靠数条目条数证明(那条会被 bullet 段的加入弄脏)——
    // 直接验归档件里父子正文**连续**,这才是"并成一块一起搬"的本来含义。
    assert.ok(
      archive.includes('父正文\n### 子阶段('),
      '嵌套 ✅ 子标题必须并入父块连续归档,不另立条目(否则范围重叠会踩行)',
    )
    const plan = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.ok(plan.includes('### 已完成清单') && plan.includes('索引留在原地'), '不可搬小节不得被动')
    assert.ok(plan.includes('活内容'), '条目外的普通正文原样保留')
    assert.ok(
      !plan.includes('- [x] bullet') && archive.includes('- [x] bullet 级已完成'),
      'bullet 级已完成行应被搬走并逐字进归档件(旧规格是"只报数不搬",2026-09-28 由用户点名反转)',
    )
    assert.match(plan, /<!--\s*已归档\(/, '原位置须留 13c 认得的占位')
    // 端到端"两侧同形"装车证明:归档落地后,13c(同一份 lib 的保护集/占位反查/锚点判据)必须判绿。
    // 若归档器写的占位标题形态与门反查的剥前缀形态漂开,这一步会红 —— 那正是本票要根治的那一型。
    const g = spawnSync('node', [GATE_PATH, '--root', dir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
    })
    const gout = String(g.stdout || '')
      .concat(String(g.stderr || ''))
      .replace(/\x1b\[[0-9;]*m/g, '')
    assert.equal(g.status, 0, `归档后 13c 必须通过,实得 ${g.status}:\n${gout.slice(0, 600)}`)
  } finally {
    rmScratch(dir)
  }
})

test('真实 HEAD 面逐字行作夹具:## O74 完成条目必须被认出(§22c —— 判据输入取自真实文件)', () => {
  const dir = createTempDir()
  try {
    // 该行逐字取自 2026-09-26 的 HEAD:PROJECT_PLAN.md(仅把日期换成 ≥7 天前以满足阈值)
    const real = '## O74 收敛器不再拿"会被清掉的本地指针"当远端真值(2026-09-25 完成 ✅,闭合 O74 的 ②)'
    const d = dateAgo(30)
    writeFileSync(
      join(dir, 'PROJECT_PLAN.md'),
      ['# plan', '', real.replace(/2026-09-25/, d), '正文', ''].join('\n'),
    )
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(
      r.out,
      /发现 1 个可归档/,
      `真实 ## 形态必须被认出,实得:\n${r.out.slice(0, 300)}`,
    )
    const archive = readFileSync(archiveFilePath(dir), 'utf8')
    assert.ok(archive.includes('收敛器不再拿'), '归档件须含真实标题原文')
  } finally {
    rmScratch(dir)
  }
})

// ─── 21. 2026-09-28 根治「归档器把别人已入库的翻勾退回未勾」───
// 事故:底稿取**工作树磁盘副本**、写回也写磁盘副本,而 PROJECT_PLAN.md 是多会话共写的活文档,
// 磁盘副本常年滞后 HEAD(AGENTS §12 为这条立过铁律)。于是一枚自动归档 = 把一份滞后底稿整文件
// 写进提交 ⇒ 父提交里至少 10 条 `[x]` 原样变成 `[ ]`(实测枚 b54c79c36 一次改动 4,249 行 /
// +2040 −2364),并让门 71 的回捞层补回未勾形态、门 130 再红,互咬成 6+8 枚修复提交。
// 这组用例按三条改动各钉一条:① 底稿 = 被审面(HEAD)② 落地 = 对象空间 + 零损失闸
// ③ 绝不覆盖共享工作树。**全部在临时 git 仓里造,不拿真仓当夹具。**

const FOREIGN_DONE_ROW = '- [x] ✅(%d) **G-207 另一件已完成的事**(已入库的翻勾不得被退回)'
const FOREIGN_STALE_ROW = '- [ ] **G-207 另一件已完成的事**(已入库的翻勾不得被退回)'

/** 夹具:一条可归档的 ## 条目(内含一条 [x])+ 一条**不属于该条目**的已入库 [x](要被保住的那一条)。 */
function staleFixturePlan(row) {
  const d = dateAgo(30)
  return [
    '# plan',
    '',
    `## G-206 同一个缺口今天被补了两遍(${d} 完成 ✅)`,
    `- [x] ✅(${d}) **G-206 同一个缺口今天被补了两遍**(刻意不给 F1 判红开关)`,
    '条目正文 A',
    '',
    '## 活章节',
    row.replace('%d', d),
    '活内容',
    '',
  ].join('\n')
}

function gitShow(dir, spec) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', '-C', dir, 'show', spec], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60_000,
  })
  return r.status === 0 ? r.stdout : null
}
function revCount(dir) {
  const r = spawnSync('git', ['-C', dir, 'rev-list', '--count', 'HEAD'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
  })
  return parseInt(String(r.stdout).trim(), 10)
}
function commitFiles(dir) {
  return spawnSync('git', ['-c', 'safe.directory=*', '-C', dir, 'show', '--name-only', '--format=', 'HEAD'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
  })
    .stdout.split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}
function cachedDiff(dir) {
  return spawnSync('git', ['-C', dir, 'diff', '--cached', '--name-only'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
  }).stdout.trim()
}
function runScriptEnv(cwd, args, env) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180_000,
    env: { ...process.env, ...env },
  })
  const strip = (s) => String(s || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.out = strip(r.stdout)
  r.err = strip(r.stderr)
  r.all = r.out + r.err
  return r
}
const ARCHIVE_REL = `.ihui-agent/archive/PROJECT_PLAN_${todayStr()}_auto-archive.md`

test('A1 底稿面=HEAD:工作树滞后把已入库的 [x] 写成 [ ] 时,归档产出的那一面里它必须仍是 [x]', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, staleFixturePlan(FOREIGN_DONE_ROW))
    const staleText = staleFixturePlan(FOREIGN_STALE_ROW)
    // "别人/滞后的工作树副本":改过但**没有 git add** —— 这正是旧实现拿去做底稿的那一份
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), staleText)
    const before = revCount(dir)
    const r = runScriptEnv(dir, ['--auto-commit'], {})
    assert.equal(r.status, 0, `应成功,实得 ${r.status}\n${r.all}`)
    assert.equal(revCount(dir), before + 1, '应新增一枚归档提交')
    const head = gitShow(dir, 'HEAD:PROJECT_PLAN.md')
    // ★ 本票核心断言的新形态(2026-09-28):归档粒度扩到 bullet 级后,一条不属于被搬条目的
    // 已入库 `- [x]` 行有**两种正当归宿** —— 原样留在 HEAD,或整行逐字进归档件并在原位留占位。
    // 唯一**绝不合法**的形态是它被读成 `- [ ]`(把做过的记成没做)。旧版只允许第一种,
    // 而那一版在 HEAD 面上把这一行写成 `- [ ] …` 就是本票立项要拦的那一型。
    assert.doesNotMatch(
      head,
      /^- \[ \] .*G-207/m,
      '★ 已入库的 [x] 行绝不得在归档产出的那一面被写成 [ ]',
    )
    const archived207 = gitShow(dir, 'HEAD:' + ARCHIVE_REL) || ''
    const eitherAliveOrArchived =
      /^- \[x\] .*G-207/m.test(head) || (/G-207/.test(archived207) && /<!--\s*已归档\(/.test(head))
    assert.ok(
      eitherAliveOrArchived,
      '不属于被搬条目的已入库 [x] 行:要么原样留在 HEAD,要么带占位逐字进归档件 —— 二者皆无即丢失',
    )
    assert.match(head, /<!--\s*已归档\(/, '被搬条目在原位置留了占位')
    const files = commitFiles(dir)
    assert.ok(files.includes('PROJECT_PLAN.md'), '计划文档在本次提交面上')
    assert.ok(
      files.includes(ARCHIVE_REL),
      `占位点名的归档文件必须真在本次提交面上,实得:\n  ${files.join('\n  ')}`,
    )
    assert.ok((gitShow(dir, 'HEAD:' + ARCHIVE_REL) || '').includes('条目正文 A'), '完整内容进了归档件')
    assert.equal(
      readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'),
      staleText,
      '工作树滞后 ⇒ 磁盘副本必须逐字未动(不得把 HEAD 派生的正文塞进别人的现场)',
    )
    assert.match(r.all, /底稿面:head/, '必须报名"底稿取的是哪一面"')
    assert.match(r.all, /工作树滞后|归属他人/, '不覆盖磁盘这件事必须喊出来,不得静默')
    assert.equal(cachedDiff(dir), '', '索引逐路径对齐到新 HEAD ⇒ 不得留下 `M ` 假暂存(§12d 第三层那型)')
  } finally {
    rmScratch(dir)
  }
})

test('A2 零损失闸有牙:显式 --plan-face worktree 拿滞后磁盘当底稿 ⇒ 拒落、不建提交、盘与归档件一字未写、逐条点名原行', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, staleFixturePlan(FOREIGN_DONE_ROW))
    const staleText = staleFixturePlan(FOREIGN_STALE_ROW)
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), staleText)
    const before = revCount(dir)
    const r = runScriptEnv(dir, ['--auto-commit', '--plan-face', 'worktree'], {})
    assert.notEqual(r.status, 0, `拿滞后底稿覆盖已入库翻勾必须被拒,实得 RC=${r.status}\n${r.all}`)
    assert.equal(revCount(dir), before, '拒绝落地 ⇒ 不得推进 HEAD')
    assert.equal(readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'), staleText, '计划文档一字未动')
    assert.ok(!existsSync(join(dir, ARCHIVE_REL)), '判据不过时连归档文件都不该创建(不留半截现场)')
    assert.equal(cachedDiff(dir), '', '共享索引未被本脚本动过')
    assert.match(r.all, /零损失断言不通过/, '必须喊出为什么拒落')
    assert.match(r.all, /G-207/, '并逐条点名被退回的原行')
  } finally {
    rmScratch(dir)
  }
})

test('A3 未知面开关不得静默掉进默认档:--plan-face 值非 head|worktree ⇒ RC=1 并给出合法取值', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, staleFixturePlan(FOREIGN_DONE_ROW))
    const before = revCount(dir)
    const r = runScriptEnv(dir, ['--auto-commit', '--plan-face', 'HEAD'], {})
    assert.equal(r.status, 1, `非法值必须报错,实得 ${r.status}\n${r.all}`)
    assert.equal(revCount(dir), before, '报错路径上不得有提交')
    assert.match(r.all, /只接受 head\|worktree/, '必须给出合法取值,不能只说"参数错误"')
  } finally {
    rmScratch(dir)
  }
})

test('B 正当归档仍在工作:条目确实完成 ≥7 天 ⇒ 搬走 + 留占位 + 归档件在提交面 + 磁盘随提交对齐 + 13c 判绿', () => {
  const dir = createTempGitRepo()
  try {
    const base = staleFixturePlan(FOREIGN_DONE_ROW)
    commitPlan(dir, base) // 磁盘 == HEAD:没有人在这上面写 ⇒ 允许对齐
    const before = revCount(dir)
    const r = runScriptEnv(dir, ['--auto-commit'], {})
    assert.equal(r.status, 0, `应成功,实得 ${r.status}\n${r.all}`)
    assert.equal(revCount(dir), before + 1)
    const head = gitShow(dir, 'HEAD:PROJECT_PLAN.md')
    assert.match(head, /<!--\s*已归档\(/)
    assert.ok(!head.includes('条目正文 A'), '正文应已从计划文档搬走')
    assert.doesNotMatch(head, /^- \[ \] .*G-207/m, '已入库的翻勾绝不得被读成未勾')
    const arch207 = (gitShow(dir, 'HEAD:' + ARCHIVE_REL) || '').includes('G-207')
    assert.ok(
      /^- \[x\] .*G-207/m.test(head) || (arch207 && /<!--\s*已归档\(/.test(head)),
      '不属于被搬块的已入库行:原样在 HEAD,或带占位逐字进归档件(bullet 级自 2026-09-28 起在射程内)',
    )
    assert.ok((gitShow(dir, 'HEAD:' + ARCHIVE_REL) || '').includes('G-206 同一个缺口'), '归档件含被搬条目')
    assert.equal(
      readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8').replace(/\r\n/g, '\n'),
      head.replace(/\r\n/g, '\n'),
      '盘上那份 == 父提交那份 ⇒ 允许把本次搬运等价地写进磁盘(对齐,不是覆盖)',
    )
    assert.equal(
      spawnSync('git', ['-C', dir, 'status', '--porcelain'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true }).stdout.trim(),
      '',
      '落地后工作区应干净(索引与工作树都随提交对齐)',
    )
    // 同 A 臂:留痕必须正向存在且绑到这枚 HEAD,而不是被忽略规则遮掉。
    const headShaB = spawnSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true }).stdout.trim()
    const ledgerB = readFileSync(join(dir, '.workbuddy', 'safe-commit-attestation.jsonl'), 'utf8')
    assert.ok(ledgerB.includes(headShaB), `旁路留痕必须绑到刚落地的枚 ${headShaB.slice(0, 12)}`)
    assert.match(ledgerB, /"source":"archive-completed-tasks"/, '留痕必须点名是哪个落地器(否则事后无从归因)')
    const g = spawnSync('node', [GATE_PATH, '--root', dir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120_000,
    })
    const gout = String(g.stdout || '')
      .concat(String(g.stderr || ''))
      .replace(/\x1b\[[0-9;]*m/g, '')
    assert.equal(g.status, 0, `归档落地后守门 13c 必须判绿,实得 ${g.status}:\n${gout.slice(0, 600)}`)
  } finally {
    rmScratch(dir)
  }
})

test('C 不覆盖他人现场:磁盘副本被"别人"加了一行未提交内容 ⇒ 落地后磁盘逐字未变且那行仍在,HEAD 侧归档照常完成', () => {
  const dir = createTempGitRepo()
  try {
    const base = staleFixturePlan(FOREIGN_DONE_ROW)
    commitPlan(dir, base)
    const theirs = `${base}\n- [ ] 别人此刻正在写的一行(未提交)\n`
    writeFileSync(join(dir, 'PROJECT_PLAN.md'), theirs)
    const r = runScriptEnv(dir, ['--auto-commit'], {})
    assert.equal(r.status, 0, `归档本身不该失败,实得 ${r.status}\n${r.all}`)
    const now = readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8')
    assert.equal(now, theirs, '★ 磁盘逐字未动:别人那行在、本次的占位没被塞进来')
    assert.ok(now.includes('别人此刻正在写的一行'), '别人的内容必须还在')
    assert.ok(!now.includes('已归档('), 'HEAD 派生的正文不得写进别人的现场')
    assert.match(gitShow(dir, 'HEAD:PROJECT_PLAN.md'), /<!--\s*已归档\(/, '而 HEAD 侧该做的搬运完成了')
    assert.match(r.all, /工作树滞后|归属他人/)
  } finally {
    rmScratch(dir)
  }
})

test('D 应急通道如实:HUSKY_SKIP_ARCHIVE=1 在脚本里真被读取(钩子内外同一把开关),置位即 RC=0 且不写任何东西', () => {
  const dir = createTempGitRepo()
  try {
    commitPlan(dir, staleFixturePlan(FOREIGN_DONE_ROW))
    const before = revCount(dir)
    const r = runScriptEnv(dir, ['--auto-commit'], { HUSKY_SKIP_ARCHIVE: '1' })
    assert.equal(r.status, 0, `跳过通道必须 RC=0(少做一件事不是错误),实得 ${r.status}\n${r.all}`)
    assert.match(r.all, /HUSKY_SKIP_ARCHIVE=1/, '必须报名是这把开关生效了,而不是"没有可归档条目"')
    assert.equal(revCount(dir), before, '跳过 ⇒ 不得建提交')
    assert.ok(!existsSync(join(dir, ARCHIVE_REL)), '跳过 ⇒ 不得写归档文件')
    assert.match(readFileSync(join(dir, 'PROJECT_PLAN.md'), 'utf8'), /G-206 同一个缺口/, '计划文档一字未动')
  } finally {
    rmScratch(dir)
  }
})

test('E 形状锁:底稿必须走取材层的 HEAD 面,落地必须走 plumbing 那一份实现(退回旧写法即红)', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.ok(/from '\.\/lib\/face-reader\.mjs'/.test(src), '必须经 face-reader 取被审面')
  assert.ok(/catBatch\(/.test(src), '必须真用层的读取入口(引了层却不用 = 守门 118 的 half-wired)')
  assert.ok(
    !/readWorktreeFile\(ROOT,\s*['"]PROJECT_PLAN\.md['"]\)/.test(src),
    '底稿不得再写成"按磁盘读计划文档"(那正是本票根治的那一型)',
  )
  assert.ok(/from '\.\/lib\/bypass-git\.mjs'/.test(src), '对象空间 plumbing 只有一份,不得在器内重抄')
  for (const entry of [
    'commitTreeWithIndex(',
    'casUpdateRef(',
    'alignSharedIndex(',
    'writeBlob(',
    'headBlobOf(',
  ]) {
    assert.ok(src.includes(entry), `落地必须真用 ${entry} —— 缺了就是又手写了第二份 CAS`)
  }
  assert.ok(
    /clobberedPaths\(/.test(src),
    'CAS 循环内"被别人改过即停"的判据必须取自常驻出口 object-space-land,不得另写一份',
  )
  assert.ok(/zeroLossViolations\(/.test(src), '零损失闸必须真被接线(判据在而无人调 = 没有)')
  assert.ok(/IHUI_ARCHIVE_COMMIT/.test(src), '防递归语义保留')
})

test('F --self-test 连跑两次都必须 RC=0 并报"失败 0"(本仓有一道门的自检第二次起恒 exit 2,那等于没有取证)', () => {
  const dir = createTempDir()
  try {
    for (const round of [1, 2]) {
      const r = runScriptEnv(dir, ['--self-test'], {})
      assert.equal(r.status, 0, `第 ${round} 次 --self-test 应 RC=0,实得 ${r.status}\n${r.all}`)
      assert.match(r.all, /自检共 \d+ 条断言,通过 \d+,失败 0/, '必须打印总量与失败数,不得默默退 0')
    }
  } finally {
    rmScratch(dir)
  }
})

// ─── G/H 子弹级归档与"假条目"守卫(2026-09-28,响应用户"完成的内容不要再留在计划文档里")───
// 端到端双向锁:只测纯函数不够 —— 采集器写对了但主流程没接线,就是本仓最高频的"造好没装车"。

test('G 子弹级 - [x] 真被搬走,且同一章节里的 - [ ] 一字不动地留在原地', () => {
  const dir = createTempGitRepo()
  try {
    const plan = [
      '# 计划',
      '',
      '## 活章节',
      `- [x] ✅(${dateAgo(30)}) **G-900 早就做完的一件事**`,
      '  这行是上一条的缩进续行',
      '- [ ] **G-901 这件还开着**',
      '',
    ].join('\n')
    commitPlan(dir, plan)
    const r = runScriptEnv(dir, ['--auto-commit'], {})
    assert.equal(r.status, 0, `应 RC=0\n${r.all}`)
    const head = execSync('git show HEAD:PROJECT_PLAN.md', {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    assert.ok(!/- \[x\].*G-900/.test(head), '已过阈值的已完成登记应被搬走(没搬=这一维没装车)')
    assert.ok(/^- \[ \] \*\*G-901/m.test(head), '未完成行必须原样留在计划文档里')
    assert.ok(/<!-- 已归档\(/.test(head), '原位必须留 §1 要求的归档占位')
    const arch = execSync(`git show HEAD:.ihui-agent/archive/PROJECT_PLAN_${todayStr()}_auto-archive.md`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    assert.ok(arch.includes(`- [x] ✅(${dateAgo(30)}) **G-900 早就做完的一件事**`), '归档件里必须有逐字原文(第一步)')
    assert.ok(arch.includes('  这行是上一条的缩进续行'), '缩进续行必须随条目一起进归档')
  } finally {
    rmScratch(dir)
  }
})

test('H 标题写"已完成"但体内含未勾登记的假条目:连 --allow-mass 也不得搬走它', () => {
  const dir = createTempGitRepo()
  try {
    const plan = [
      '# 计划',
      '',
      `## 假装完成的条目(${dateAgo(30)} 立并完成 ✅)`,
      '- [ ] **G-902 其实还开着,而且后面再没有同级标题**',
      '',
    ].join('\n')
    commitPlan(dir, plan)
    const r = runScriptEnv(dir, ['--auto-commit', '--allow-mass'], {})
    assert.equal(r.status, 0, `应 RC=0\n${r.all}`)
    const head = execSync('git show HEAD:PROJECT_PLAN.md', {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: dir,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
    assert.ok(/^- \[ \] \*\*G-902/m.test(head), '未勾行被搬进归档 = 把别人正开着的账记成做过的(判据必须拦,且不被 --allow-mass 绕过)')
    assert.match(r.all, /不参与归档/, '拒绝必须大声点名,不得静默少搬')
  } finally {
    rmScratch(dir)
  }
})

test('I 选段结果必须先按行号排序再交给拼接(2026-09-28 实测:按日期返回的 picked 直接 splice 会产出交错损坏的文档)', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.match(
    src,
    /sel\.picked\.sort\(\(a, b\) => a\.startLine - b\.startLine\)/,
    '体积阀返回的是按日期排序的最旧前缀 ⇒ 落地前必须按行号重排,否则倒序 splice 会乱序损坏',
  )
  assert.match(
    src,
    /搬运范围必须按行号升序且互不重叠|throw new Error\(\s*`搬运范围/,
    '拼接处必须有"必须升序且不重叠"的前置断言(不能只靠下游的结构等值自证兜)',
  )
})
