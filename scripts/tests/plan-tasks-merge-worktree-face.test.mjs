// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815950 的验收件:归并器 `--heal` 的**底稿取面**与**工作树写盘面**。
 *
 * 票面根因:报告档曾把"旧底稿 ⊕ 归并注记 ⊕ 归档正文回填"的混合体直接写进共享工作树的
 * `PROJECT_PLAN.md`,而守门 84 只判"暂存 blob 字节级等于某祖先版本",对这种混合体结构失明。
 * 现判据把它钉成两条可跑的行为断言(而不是"看起来没写"):
 *  ① 报告档(不带 --commit)**逐字节不改工作树、不产提交**;
 *  ② 底稿取自 HEAD blob 而非磁盘副本 —— 用"磁盘副本故意滞后"的现场证明:报告里点名的
 *     baseBlob 必须等于 HEAD 面那枚 sha,而不是工作树副本的 hash-object;
 *  ③ 归档占位不得被 inline 回正文;
 *  ④ 变异对照:把"底稿取磁盘"这一禁形喂同一把源码锁,必须命中(证明 ② 不是恒真)。
 *
 * 夹具落点走 `mkScratch`(§26),脚本连它的 import 闭包一起拷(copyScriptWithClosure),
 * 少一跳就是 ERR_MODULE_NOT_FOUND 被折成"用例失败"的那一型。
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GIT = 'git'

const HEAD_MARKER = '- [ ] G-900301 **必须留在工作树的新登记甲** 正文一号'
const HEAD_MARKER_2 = '- [ ] G-900302 **必须留在工作树的新登记乙** 正文二号'
const HEAD_MARKER_3 = '- [ ] G-900303 **必须留在工作树的新登记丙** 正文三号'
const ARCHIVE_PLACEHOLDER =
  '<!-- 已归档(2026-09-28):G-900777 任务,完整内容在 .ihui-agent/archive/PROJECT_PLAN_2026-09-28.md -->'

/** F1 夹具:同主键(编号 + 标题前缀逐字等值)一份已勾、一份未勾 ⇒ 归并器必有活干,报告档才不是空跑。 */
function planText() {
  return [
    '# 计划文档夹具',
    '',
    HEAD_MARKER,
    HEAD_MARKER_2,
    HEAD_MARKER_3,
    ARCHIVE_PLACEHOLDER,
    '- [x] ✅(2026-09-01) G-900201 **同一件事的当前状态** 闭环正文',
    '- [ ] G-900201 **同一件事的当前状态** 闭环正文',
    '',
  ].join('\n')
}

function gitIn(cwd, args) {
  return execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 60000,
    windowsHide: true,
  }).trim()
}

/**
 * 建一枚临时 git 仓 + 把工具连闭包拷进去。
 * @param {{dirtyWorktree?: boolean}} opts dirtyWorktree=true 时把磁盘副本改成"滞后混合体"
 *   (删两行 + 造一行陈旧内容),用来证"底稿取 HEAD"而不是"取磁盘"。
 */
function mkFixture(opts = {}) {
  const root = mkScratch('plan-merge-worktree-face')
  const scripts = join(root, 'scripts')
  mkdirSync(scripts, { recursive: true })
  const plan = planText()
  writeFileSync(join(root, 'PROJECT_PLAN.md'), plan, 'utf8')
  gitIn(root, ['init', '-q'])
  gitIn(root, ['config', 'user.email', 'fixture@example.invalid'])
  gitIn(root, ['config', 'user.name', 'fixture'])
  gitIn(root, ['add', 'PROJECT_PLAN.md'])
  gitIn(root, ['commit', '-q', '-m', 'fixture base'])
  copyScriptWithClosure(join(REPO, 'scripts'), 'plan-tasks-merge.mjs', scripts, [
    'lib/face-reader.mjs',
    'lib/bypass-git.mjs',
  ])
  const headBlob = gitIn(root, ['rev-parse', 'HEAD:PROJECT_PLAN.md'])
  let wtBefore = plan
  if (opts.dirtyWorktree) {
    // 模拟票面那一型:磁盘副本比 HEAD 少行、多行(陈旧混合体),且不等于任何祖先版本
    const stale = plan
      .split('\n')
      .filter((l) => !l.includes('G-900302') && !l.includes('G-900303'))
      .concat(['- [ ] G-900399 **别人早已入库的登记被这份副本抹掉** 陈旧正文'])
      .join('\n')
    writeFileSync(join(root, 'PROJECT_PLAN.md'), stale, 'utf8')
    wtBefore = stale
  }
  return { root, scripts, headBlob, wtBefore }
}

function runHeal(scripts, args = []) {
  return spawnSync(process.execPath, [join(scripts, 'plan-tasks-merge.mjs'), ...args], {
    encoding: 'utf8',
    timeout: 180000,
    windowsHide: true,
  })
}

/**
 * 源码锁:归并器不得再用"磁盘工作树副本"当判定底稿。
 * 只认两种确属取底稿的形态(readFileSync(join(<root>, PLAN)) 与 readFileSync(<plan 变量>)),
 * 不认 scratch 中间件(tmp/msgFile)那一类,否则本锁会因为一次正常重构而漂成恒红。
 */
function forbiddenBaseReads(src) {
  const hits = []
  const re =
    /readFileSync\(\s*(?:join\(\s*(?:ROOT|root)\s*,\s*PLAN(?:_REL|Path|File)|PLAN(?:_REL|Path|File)|planPath|planFile)/g
  let m
  while ((m = re.exec(src)) !== null) hits.push(m[0])
  return hits
}

test('T1 报告档逐字节不改工作树、不产提交,且确实有活干', () => {
  const { root, scripts, wtBefore } = mkFixture()
  const commitsBefore = gitIn(root, ['rev-list', '--count', 'HEAD'])
  const r = runHeal(scripts, ['--heal'])
  assert.equal(r.status, 0, `报告档应 exit 0,实际 ${r.status}:${r.stderr?.slice(0, 400)}`)
  assert.match(r.stdout, /只出报告/)
  // 有活干:必须真的点名拟改写行(否则 T1 只是证明"没东西可写",不证明"不写")
  assert.match(r.stdout, /拟改写 \d+ 行/)
  assert.equal(readFileSync(join(root, 'PROJECT_PLAN.md'), 'utf8'), wtBefore, '报告档动了工作树')
  assert.equal(gitIn(root, ['rev-list', '--count', 'HEAD']), commitsBefore, '报告档产出了提交')
  rmScratch(root)
})

test('T2 底稿取 HEAD blob,不取滞后的磁盘副本(票面①②)', () => {
  const { root, scripts, headBlob, wtBefore } = mkFixture({ dirtyWorktree: true })
  const wtHash = gitIn(root, ['hash-object', 'PROJECT_PLAN.md'])
  assert.notEqual(wtHash, headBlob, '夹具没造出"磁盘≠HEAD"的现场,T2 会退化成恒真')
  const r = runHeal(scripts, ['--heal'])
  assert.equal(r.status, 0, r.stderr?.slice(0, 400))
  const reported = /baseBlob=([0-9a-f]{40})/.exec(r.stdout)
  assert.ok(reported, `报告未打印 baseBlob:${r.stdout.slice(0, 300)}`)
  assert.equal(reported[1], headBlob, 'baseBlob 不是 HEAD 面那枚 ⇒ 底稿仍在取磁盘副本')
  // 三条新登记仍留在**被审面(HEAD)**上 —— 这一档刻意不看工作树:脏夹具里那两条正是"磁盘副本
  // 比 HEAD 少行"的现场,拿工作树断言"仍在"会把夹具自造的缺失算成工具的错(测试 bug 不是工具 bug)。
  const face = gitIn(root, ['show', 'HEAD:PROJECT_PLAN.md'])
  for (const marker of [HEAD_MARKER, HEAD_MARKER_2, HEAD_MARKER_3]) {
    assert.ok(face.includes(marker.split('**')[0]), '底稿面丢了新登记')
  }
  assert.equal(readFileSync(join(root, 'PROJECT_PLAN.md'), 'utf8'), wtBefore)
  // 归档占位不得被 inline 回正文(工作树与面两处都查)
  for (const text of [face, readFileSync(join(root, 'PROJECT_PLAN.md'), 'utf8')]) {
    assert.ok(text.includes(ARCHIVE_PLACEHOLDER), '占位被搬走/inline')
  }
  rmScratch(root)
})

test('T3 落地档只走对象空间:工作树不动、HEAD 前进、新面仍含三条登记', () => {
  const { root, scripts, wtBefore } = mkFixture()
  const commitsBefore = Number(gitIn(root, ['rev-list', '--count', 'HEAD']))
  const r = runHeal(scripts, ['--heal', '--commit'])
  const landed = r.status === 0 && /自愈落地/.test(r.stdout)
  assert.equal(readFileSync(join(root, 'PROJECT_PLAN.md'), 'utf8'), wtBefore, '落地档动了工作树')
  if (!landed) {
    // 落地被阀门/判据拒绝时也必须"零写盘":只允许它停下并把原因带出来,不允许半落地现场
    assert.match(`${r.stdout}${r.stderr}`, /拒绝|未落地|需与|--staged|无法判定|停手/)
    assert.equal(Number(gitIn(root, ['rev-list', '--count', 'HEAD'])), commitsBefore)
    rmScratch(root)
    return
  }
  assert.equal(Number(gitIn(root, ['rev-list', '--count', 'HEAD'])), commitsBefore + 1)
  const face = gitIn(root, ['show', 'HEAD:PROJECT_PLAN.md'])
  for (const marker of [HEAD_MARKER, HEAD_MARKER_2, HEAD_MARKER_3]) {
    assert.ok(face.includes(marker.split('**')[0]), '落地面丢了新登记')
  }
  assert.ok(face.includes(ARCHIVE_PLACEHOLDER), '落地面把占位 inline 回正文')
  assert.match(gitIn(root, ['show', '-s', '--format=%s', 'HEAD']), /自愈|归并/)
  rmScratch(root)
})

test('T4 源码锁有牙:禁形命中、现工具文本零命中(票面③变异对照)', () => {
  const src = readFileSync(join(REPO, 'scripts', 'plan-tasks-merge.mjs'), 'utf8')
  assert.deepEqual(forbiddenBaseReads(src), [], '归并器里出现了"磁盘副本当底稿"的写法')
  // 阳性对照:构造一份"旧写法"样本,证明这把锁真能命中(否则 T4 的 deepEqual 是恒真)
  const mutant = [
    "import { readFileSync } from 'node:fs'",
    'const base = readFileSync(join(ROOT, PLAN_REL), "utf8")',
    'const again = readFileSync(PLAN_REL)',
  ].join('\n')
  assert.ok(forbiddenBaseReads(mutant).length >= 2, '源码锁无牙:禁形样本没被命中')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
