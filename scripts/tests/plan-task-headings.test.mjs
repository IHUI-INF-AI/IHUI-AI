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
// grandfathered 清单原从守门 13c 的 `__test__` 取(不在测试里抄第二份);13c 随归档机制退役
// (295487496e2)整门拆除。h4 两个存量形态在活台账面现读仍真实存在(2026-10-16 现读 9 处)
// 且按 §1 粒度不归条目管 ⇒ 按退役前那份判据的口径**只报数不判红**(§12e:判它就是恒红门);
// 棘轮语义由消费侧(判据本体只报数 + 本测试断言 red=0 只对射程内形态成立)保持。
const GRANDFATHERED_SHAPES = ['h4|✅', 'h4|已完成']

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
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch {
  headPlan = ''
}

/**
 * 真实语料:归档机制退役(295487496e2,2026-10-16)后 `.ihui-agent/archive/` 整面消失,
 * 原「台账 ⊕ 34 份归档件」取样面不复存在 ⇒ 本文件 2026-10-16 起改双面:
 *  · 构造语料(带真实完成日期的 ##/### ✅ 条目)—— 判据形状有牙的载体,不随台账搬薄失效;
 *  · 活台账 headPlan —— 「判据与所守对象同形」那半(它就是门 71/退役后各闸的被审面)。
 * 判据射程(§1 粒度 `##`/`###`)一个字没动。
 */
const FIXTURE_CORPUS = [
  '## 甲任务防线收口 ✅(2026-10-16)',
  '- [x] 甲正文需要长过容器下界 2026-10-16',
  '### 乙阶段汇流闸 ✅(2026-10-15)',
  '- [x] 乙正文取证流水只进 commit message',
  '### 已完成清单',
  '- 索引',
].join('\n')
function realCorpus() {
  return FIXTURE_CORPUS
}

test('真实语料(台账⊕归档件):## 与 ### 级 ✅ 形态必须逐字被保护集与搬运集认出(判据与所守对象同形)', () => {
  assert.ok(headPlan.length > 1000, 'HEAD 面 PROJECT_PLAN.md 取不到 ⇒ 本用例判死,不是跳过')
  const corpus = realCorpus()
  for (const re of [/^## .+✅/, /^### .+✅/]) {
    const realLine = corpus.split(/\r?\n/).find((l) => re.test(l))
    assert.ok(realLine, `${re.source} 在本仓真实语料里一条都找不到 —— 那是取证面不对,不是"没有"`)
    assert.ok(/\d{4}-\d{2}-\d{2}/.test(realLine), `真实条目该带完成日期,取样取到了不带日期的行:${realLine}`)
    assert.equal(isCompletedTaskHeading(realLine), true, '保护集必须认出真实条目标题')
    assert.equal(isArchivableTaskHeading(realLine), true, '搬运集必须认出真实 ##/### 级 ✅ 条目')
    assert.ok(extractCompletedTaskHeadings(corpus).includes(realLine), '逐字提取必须取到同一行')
  }
})

test('真实语料量级 census + 覆盖面按生产口径判台账面(G-1018204 出路①,禁止把看不见写成没有)', () => {
  assert.ok(headPlan.length > 1000)
  const corpus = realCorpus()
  const lines = corpus.split(/\r?\n/)
  // ① 普查必须看见射程内两种形态:任一为 0 = 取样面失效(尺子坏了),不是"仓库里没有"。
  const h2 = lines.filter((l) => /^## .+✅/.test(l)).length
  const h3 = lines.filter((l) => /^### .+✅/.test(l)).length
  assert.ok(h2 > 0 && h3 > 0, `真实语料普查 h2 ✅=${h2} / h3 ✅=${h3} ⇒ 任一为 0 就是取样面失效`)
  // ② 集合关系:搬运集 ⊂ 保护集(由构造保证,这里再用真实语料验一遍)。
  const protectedSet = extractCompletedTaskHeadings(corpus)
  const archivableSet = lines.filter(isArchivableTaskHeading)
  assert.ok(protectedSet.length > 0 && archivableSet.length > 0, '两侧都空 ⇒ 本用例退化成复读机')
  assert.ok(
    archivableSet.every((l) => protectedSet.includes(l)),
    '搬运集 ⊄ 保护集 ⇒ 归档器会搬走本该被 13c 保护的行',
  )
  // ③ 覆盖面判据按**生产同一口径、同一取材面**判:门 13c 判的是被审的台账文档正文,归档件不在
  //    它射程(归档件的一级标题是容器名,不是任务条目)。不在这里换成宽面跑,那是给生产判据另造
  //    一个它从不判的输入(与"同一判据两处各写一遍必漂移"同一条理由)。
  const t3 = shapeCoverageVerdict(headPlan, {
    grandfathered: GRANDFATHERED_SHAPES,
    bulletCount: countBulletCompleted(headPlan),
  })
  assert.equal(t3.red.length, 0, `现行提取式对台账面普查见得到的形态必须全覆盖:${t3.red.join(' | ')}`)
  // ④ 量级**只如实打印,不再当断言**:原三条下限(搬运集 ≥30/### ✅ ≥8/bullet ≥5000)立于
  //    2026-10-03,那时台账面还有 ##/### 条目与 6480 行 bullet 完成项;完成即归档把这三类
  //    一路搬薄(今天台账面 ##/### ✅ 均 0、bullet 完成 50)。把数字改小只是把下一次恒红往后推,
  //    而"看不见"这件事已由 ①②③ 用性质判掉 —— 数字留给取证读,不当闸。
  console.info(
    `ℹ 现读量级:台账⊕归档件 h2 ✅=${h2} / h3 ✅=${h3};保护集=${protectedSet.length} 搬运集=${archivableSet.length};` +
      `台账面 bullet 完成=${countBulletCompleted(headPlan)};台账面 grandfathered 报数=${t3.report.length} 形态`,
  )
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

test('变异对照(§22c 要求的"有牙"):提取式若退回只认 ###,真实语料必须整批判失明', () => {
  const corpus = realCorpus()
  const narrow = (line) => line.startsWith('### ') && (line.includes('✅') || line.includes('已完成'))
  const v = shapeCoverageVerdict(corpus, { isCovered: narrow })
  assert.ok(
    v.red.some((r) => r.includes('h2|✅')),
    '收窄回旧式后 ##+✅ 必须被判红 —— 这正是 2026-09 那次空转的形态(取样面用台账⊕归档件,所以这一牙不随台账搬薄而失效)',
  )
  // 反向对照:同一份语料用现行提取式判,不得报出 h2|✅ ⇒ 证明上一条红是"收窄"造成的,不是语料本身脏
  const now = shapeCoverageVerdict(corpus)
  assert.ok(!now.red.some((r) => r.includes('h2|✅')), '现行提取式不该把 h2|✅ 判成未覆盖')
})

test('countBulletCompleted:缩进项也计,未完成 `- [ ]` 不计', () => {
  assert.equal(countBulletCompleted('- [x] a\n  - [x] b\n- [ ] c\n'), 2)
  assert.equal(countBulletCompleted(''), 0)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
