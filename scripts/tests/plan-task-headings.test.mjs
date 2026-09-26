// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * scripts/lib/plan-task-headings.mjs 的单元测试(2026-09-26)。
 * 重点钉三件本票立论的不变量:
 *  1) 搬运集 ⊂ 保护集**由构造保证**(不是注释约定);
 *  2) 判据与真实文件同形 —— 至少一条用例的输入逐字取自 HEAD 面 PROJECT_PLAN.md(§22c 红线:
 *     镜像测试若只复读实现,它就只是复读机;本仓两次归档器空转都是夹具全用自造形态导致);
 *  3) 级别感知的条目边界:## 级条目吞并其内部更深的 ✅ 子标题,不产生重叠范围。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import {
  isCompletedTaskHeading,
  isArchivableTaskHeading,
  extractCompletedTaskHeadings,
  headingTitle,
  countBulletCompleted,
  surveyCompletionShapes,
  shapeCoverageVerdict,
  parseCompletedTaskBlocks,
} from '../lib/plan-task-headings.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// 逐字取自 HEAD 面的真实行(2026-09-26 现读;取不到即测试判死,不做"大概率存在"的断言)
let headPlan = ''
try {
  headPlan = execFileSync('git', ['-c', 'safe.directory=*', 'show', 'HEAD:PROJECT_PLAN.md'], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout: 60_000,
  })
} catch {
  headPlan = ''
}

test('真实 HEAD 面:##+✅ 形态必须逐字被保护集与搬运集认出(判据与所守对象同形)', () => {
  assert.ok(headPlan.length > 1000, 'HEAD 面 PROJECT_PLAN.md 取不到 ⇒ 本用例判死,不是跳过')
  const realLine = headPlan
    .split(/\r?\n/)
    .find((l) => /^## .+✅/.test(l) && /^## .*(2026-\d\d-\d\d)/.test(l))
  assert.ok(realLine, 'HEAD 面实测存在 ##+✅+日期 行,取不到说明现读失败')
  assert.equal(isCompletedTaskHeading(realLine), true, '保护集必须认出真实 ## 级条目')
  assert.equal(isArchivableTaskHeading(realLine), true, '搬运集必须认出真实 ## 级 ✅ 条目')
  assert.ok(extractCompletedTaskHeadings(headPlan).includes(realLine))
})

test('真实 HEAD 面:量级对账 —— ##✅≥71、###✅=0、bullet≥1100,禁止把看不见写成没有', () => {
  assert.ok(headPlan.length > 1000)
  const archivable = headPlan
    .split(/\r?\n/)
    .filter(isArchivableTaskHeading).length
  assert.ok(archivable >= 71, `HEAD 面搬运集应 ≥71(实测 71 个 ## ✅),实得 ${archivable}`)
  assert.ok(countBulletCompleted(headPlan) >= 1100, 'bullet 级必须报出真实量级(≥1100)')
})

test('子集不变量(构造面):含"已完成"无"✅"被保护但永不可搬', () => {
  const list = '### 已完成清单'
  assert.equal(isCompletedTaskHeading(list), true)
  assert.equal(isArchivableTaskHeading(list), false)
  assert.equal(isArchivableTaskHeading('## O26 根治 ✅(2026-09-26)'), true)
})

test('子集不变量(运行时断言面):一切被 parse 认出的块,其标题必在保护集内', () => {
  const doc = [
    '## 父任务(2026-01-01 完成 ✅)',
    '父正文',
    '### 子阶段(2026-01-02 完成 ✅)', // 更深一级的 ✅:并入父正文,不另立条目
    '子正文',
    '### 已完成清单', // 被保护但不可搬:闭合父条目,自身留下
    '- 索引',
    '### 旧写法任务 [x] ✅(2026-01-03)',
    '旧正文',
  ].join('\n')
  const blocks = parseCompletedTaskBlocks(doc)
  assert.equal(blocks.length, 2, '## 父块 与 后续 ### 旧写法块;嵌套 ✅ 子标题不构成第三块')
  assert.equal(blocks[0].titleText, '父任务(2026-01-01 完成 ✅)')
  assert.ok(
    blocks[0].bodyLines.some((l) => l.startsWith('### 子阶段')),
    '子阶段必须整体在父块正文里一起搬',
  )
  assert.ok(!blocks[1].bodyLines.some((l) => l.includes('索引')), '已完成清单之后的内容归它自己')
  assert.ok(
    blocks.every((b) => isCompletedTaskHeading(b.title)),
    '搬运集 ⊄ 保护集 ⇒ parse 必须早已 throw(此断言是第二道锁)',
  )
})

test('范围不重叠:相邻两块 endLine < 下一块 startLine(占位 splice 的前提)', () => {
  const doc = ['## A ✅(2026-01-01)', 'x', '## B ✅(2026-01-02)', 'y'].join('\n')
  const b = parseCompletedTaskBlocks(doc)
  assert.equal(b.length, 2)
  assert.ok(b[0].endLine < b[1].startLine)
})

test('标题文本两侧同形:headingTitle 对 ##/###/旧式 [x] 前缀一律剥净(13c 反查占位用)', () => {
  assert.equal(headingTitle('## X(已完成 ✅)'), 'X(已完成 ✅)')
  assert.equal(headingTitle('### [x] ✅(2026-01-01) 任务'), '[x] ✅(2026-01-01) 任务')
})

test('surveyCompletionShapes:按"级别|标记"普查,同时带两标记的行各计一形态', () => {
  const doc = ['## A ✅', '### B 已完成', '#### C(已完成 ✅)', '- [x] 不算'].join('\n')
  const shapes = surveyCompletionShapes(doc)
  assert.equal(shapes.get('h2|✅').count, 1)
  assert.equal(shapes.get('h3|已完成').count, 1)
  assert.equal(shapes.get('h4|✅').count, 1)
  assert.equal(shapes.get('h4|已完成').count, 1)
  assert.equal(shapes.has('h1|✅'), false, 'bullet 与非标题不进普查')
  assert.equal(shapes.get('h4|✅').lines[0], 3)
})

test('shapeCoverageVerdict:现行提取式对 h2/h3 全覆盖;h5 新形态必红;grandfathered 只报数', () => {
  const ok = shapeCoverageVerdict('## A ✅\n### B 已完成\n')
  assert.equal(ok.red.length, 0)
  const v = shapeCoverageVerdict('##### 深层 ✅\n', { grandfathered: [] })
  assert.equal(v.red.length, 1)
  assert.match(v.red[0], /h5\|✅/)
  const gf = shapeCoverageVerdict('#### X ✅\n', { grandfathered: ['h4|✅'] })
  assert.equal(gf.red.length, 0)
  assert.equal(gf.report.length, 1)
})

test('变异对照(§22c 要求的"有牙"):提取式若退回只认 ###,真实 HEAD 面必须整批判失明', () => {
  assert.ok(headPlan.length > 1000)
  const narrow = (line) => line.startsWith('### ') && (line.includes('✅') || line.includes('已完成'))
  const v = shapeCoverageVerdict(headPlan, { isCovered: narrow })
  assert.ok(
    v.red.some((r) => r.includes('h2|✅')),
    '收窄回旧式后 ##+✅(HEAD 面 71 处)必须被判红 —— 这正是 2026-09 那次空转的形态',
  )
})

test('countBulletCompleted:缩进项也计,未完成 `- [ ]` 不计', () => {
  assert.equal(countBulletCompleted('- [x] a\n  - [x] b\n- [ ] c\n'), 2)
  assert.equal(countBulletCompleted(''), 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
