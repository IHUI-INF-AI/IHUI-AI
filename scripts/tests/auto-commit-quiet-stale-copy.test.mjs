// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 收编器「滞后副本守卫」镜像测试(§22c:直接 import 生产判据,不复制一份)。
 *
 * 立因:2026-10-25 实测一枚 `chore(auto)` 把旁路落地(只推进 HEAD+索引、不写工作树)的两处已入库修复
 * 按滞后工作树副本整份回退 —— 绑定手机/邮箱端点 88 行 + 门 198 的 updatedAt 出口形态两处。
 * 本测试同时锁三件事:①判据本身的正反例;②取不到探针一律 fail-open(保持原收编行为);
 * ③守卫真的接进主流程(造好没装车 = 没有,§1 第 9 条)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ } from '../auto-commit-quiet.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const probesFor = (table) => ({
  worktree: (p) => table[p]?.worktree ?? null,
  head: (p) => table[p]?.head ?? null,
  ancestors: (p) => table[p]?.ancestors ?? [],
})

test('T1 工作树==HEAD ⇒ 不是滞后副本(理论不该进候选,守卫也不吞)', () => {
  const r = __test__.partitionStaleCopies(
    ['a.ts'],
    probesFor({ 'a.ts': { worktree: 'x', head: 'x', ancestors: ['w'] } }),
  )
  assert.deepEqual(r, { kept: ['a.ts'], skipped: [], why: new Map() })
})

test('T2 工作树是新改动(不等于任何祖先)⇒ 照常收编', () => {
  const r = __test__.partitionStaleCopies(
    ['a.ts'],
    probesFor({ 'a.ts': { worktree: 'new', head: 'head', ancestors: ['p1', 'p2'] } }),
  )
  assert.deepEqual(r, { kept: ['a.ts'], skipped: [], why: new Map() })
})

test('T3 工作树==某祖先版本且 != HEAD ⇒ 判滞后副本、跳过并点名', () => {
  const r = __test__.partitionStaleCopies(
    ['a.ts'],
    probesFor({ 'a.ts': { worktree: 'p1', head: 'head', ancestors: ['head', 'p1', 'p2'] } }),
  )
  assert.deepEqual(r, {
    kept: [],
    skipped: ['a.ts'],
    why: new Map([['a.ts', '整片等于该路径某个祖先版本(滞后副本)']]),
  })
})

test('T4 取不到探针一律 fail-open(保持原收编行为,不猜)', () => {
  const r = __test__.partitionStaleCopies(
    ['a.ts', 'b.ts'],
    probesFor({
      'a.ts': { worktree: null, head: 'head', ancestors: ['p1'] },
      'b.ts': { worktree: 'p1', head: null, ancestors: ['p1'] },
    }),
  )
  assert.deepEqual(r, { kept: ['a.ts', 'b.ts'], skipped: [], why: new Map() })
})

test('T5 混批:只摘滞后副本,其余顺序不变', () => {
  const r = __test__.partitionStaleCopies(
    ['fresh.ts', 'stale.ts'],
    probesFor({
      'fresh.ts': { worktree: 'n', head: 'h', ancestors: ['p'] },
      'stale.ts': { worktree: 'p', head: 'h', ancestors: ['p'] },
    }),
  )
  assert.deepEqual(r, {
    kept: ['fresh.ts'],
    skipped: ['stale.ts'],
    why: new Map([['stale.ts', '整片等于该路径某个祖先版本(滞后副本)']]),
  })
})

test('T6 装车锁:守卫必须真的接在主流程候选集之后(造好没装车 = 没有)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'auto-commit-quiet.mjs'), 'utf8')
  assert.match(src, /dropStaleCopies\(stale, changes\)/, '主流程必须调用滞后副本守卫')
  assert.match(src, /跳过滞后副本/, '跳过必须留痕点名')
  assert.match(src, /partitionStaleCopies,/, '__test__ 必须暴露生产判据供镜像测试复用')
})

/** dropStaleCopies 的探针注入面:每路径返回三个取字节动作 */
const faceFor = (table) => (p) => ({
  worktree: () => table[p]?.worktree ?? null,
  head: () => table[p]?.head ?? null,
  ancestors: () => table[p]?.ancestors ?? [],
  everExisted: () => table[p]?.everExisted ?? false,
})

// 2026-10-31 实测(aboutPageSections 第四次回潮,提交 7a47524b07):正当删除三次的死件,第四次
// 被本器收编回 HEAD。通道 = partitionStaleCopies 的 `!head` 分支 fail-open:删除提交让
// `HEAD:<path>` 问不到 ⇒ 直接 kept。补「曾入库过」探针后,删除档死件必须 skip。
test('T10 删除档死件回潮:HEAD 无此文件但历史上曾入库 ⇒ 必须跳过(不再 fail-open 收编)', () => {
  const r = __test__.partitionStaleCopies(['dead.ts'], {
    worktree: () => 'dead-blob',
    head: () => null,
    ancestors: () => [],
    everExisted: () => true,
  })
  assert.deepEqual(r, {
    kept: [],
    skipped: ['dead.ts'],
    why: new Map([['dead.ts', '删除档死件回潮(HEAD 无此件,历史证得到曾入库)']]),
  })
})

test('T11 真新文件:HEAD 无此文件且无入库历史 ⇒ 照常收编(fail-open 语义不变)', () => {
  const r = __test__.partitionStaleCopies(['new.ts'], {
    worktree: () => 'new-blob',
    head: () => null,
    ancestors: () => [],
    everExisted: () => false,
  })
  assert.deepEqual(r, { kept: ['new.ts'], skipped: [], why: new Map() })
})

test('T12 探针取不到 everExisted ⇒ 按真新文件放行(不猜,保持原收编行为)', () => {
  const r = __test__.partitionStaleCopies(['m.ts'], {
    worktree: () => 'b',
    head: () => null,
    ancestors: () => [],
  })
  assert.deepEqual(r, { kept: ['m.ts'], skipped: [], why: new Map() })
})

// 事故回放(2026-10-29 现读):b44ab834609 把 a3facca58f3 早 4 分钟入库的 relay 守卫②整份写回旧版,
// 入口正是旧的那条豁免 —— "别人暂存过就算明确意图"。可本器落地走 safe-commit 的 `git add -A`,
// 提交出去的是**工作树字节**,与谁暂存过无关,所以这一格从来不是意图证明。
test('T7 事故回放:被别席暂存过的滞后副本也必须拦', () => {
  const r = __test__.dropStaleCopies(
    ['x.ts'],
    [{ path: 'x.ts', xy: 'M ' }],
    faceFor({ 'x.ts': { worktree: 'p', head: 'h', ancestors: ['h', 'p'] } }),
  )
  assert.deepEqual(r, {
    kept: [],
    skipped: ['x.ts'],
    why: new Map([['x.ts', '整片等于该路径某个祖先版本(滞后副本)']]),
  })
})

test('T8 反证:暂存过而内容确属新的 ⇒ 照收(取消豁免不等于一律不收)', () => {
  const r = __test__.dropStaleCopies(
    ['y.ts'],
    [{ path: 'y.ts', xy: 'M ' }],
    faceFor({ 'y.ts': { worktree: 'n', head: 'h', ancestors: ['h', 'p'] } }),
  )
  assert.deepEqual(r, { kept: ['y.ts'], skipped: [], why: new Map() })
})

test('T9 形状锁:dropStaleCopies 内不得再按"是否已暂存"划射程', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'auto-commit-quiet.mjs'), 'utf8')
  const fn = src.match(/\nfunction dropStaleCopies\([\s\S]*?\n\}\n/)?.[0] ?? ''
  assert.ok(fn.length > 40, '必须取到 dropStaleCopies 函数体本身(防空串假绿)')
  assert.doesNotMatch(fn, /unstaged/, '旧豁免一回来,b44ab834609 那一型就重新敞着')
})

// ── 2026-11-01 补:部分回退臂 + 包装器探针完整性 ─────────────────────────────
// 事故回放(枚 f0572d64c4,现读 15 个语言包 / 2915 行删除):盘上副本是"滞后编辑器缓冲 +
// 少量自身改动"的混血 —— **既不等于任何祖先 blob,到最近祖先的行距还等于到 HEAD 的行距**,
// 所以"整片等于旧版"那一臂结构上看不见它。
//
// 下面每一枚数字都是从真提交上量出来的(尺子 = .ihui-agent/tmp/goal-bugfix/measure-deletion-ratio.mjs
// 那次现读),不是为了让测试绿而构造的:
//   事故 f0572d64c4      删/增/全文行 = 565/19/7698、15/1/575、2/0/29853
//   合法死键清理 7cb6c064 = 28/0/7724、5/0/7158   ← 这一族"只删不增",拿"几乎不增"当判据会误杀
//   合法正常收编 49c3ecd3 = 45/43/29830
const ACCIDENT = [
  { removed: 565, added: 19, headLines: 7698, note: 'miniapp-taro 五语' },
  { removed: 15, added: 1, headLines: 575, note: 'cli 五语' },
]
const LEGIT = [
  { removed: 28, added: 0, headLines: 7724, note: '死键清理 miniapp-taro' },
  { removed: 5, added: 0, headLines: 7158, note: '死键清理 mobile-rn' },
  { removed: 45, added: 43, headLines: 29830, note: '正常收编 web' },
  { removed: 2, added: 0, headLines: 29853, note: '事故枚里的 web 两行(损失非批量,放行可接受)' },
  { removed: 120, added: 40, headLines: 900, note: '大删也大改的重构' },
  { removed: 14, added: 0, headLines: 100, note: '删到 14% 但绝对行数不到 15' },
]

test('T12b 阈值对照表:真事故枚的每一行都得拦,合法的每一行都得放(单源 isPartialRevert)', () => {
  for (const a of ACCIDENT)
    assert.ok(__test__.isPartialRevert(a), `事故形态漏拦 ${a.note}: ${JSON.stringify(a)}`)
  for (const l of LEGIT)
    assert.ok(!__test__.isPartialRevert(l), `合法形态误杀 ${l.note}: ${JSON.stringify(l)}`)
  // 取不到输入 ⇒ 不猜
  assert.equal(__test__.isPartialRevert(null), false)
  assert.equal(__test__.isPartialRevert({ removed: 500, added: 0 }), false, '缺 headLines ⇒ 不判')
  assert.equal(__test__.isPartialRevert({ removed: 500, added: 0, headLines: 0 }), false)
})

test('T13 部分回退臂正例:事故枚的删占比形态 ⇒ 拦(整片等值臂看不见这一型)', () => {
  const r = __test__.partitionStaleCopies(['miniapp-taro/en.json'], {
    worktree: () => 'mixed-blob',
    head: () => 'head-blob',
    ancestors: () => ['head-blob', 'older-1', 'older-2'],
    everExisted: () => true,
    lineDelta: () => ({ removed: 565, added: 19, headLines: 7698 }),
  })
  assert.deepEqual(r.skipped, ['miniapp-taro/en.json'], 'f0572d64c4 那一型必须被拦下')
  assert.match(r.why.get('miniapp-taro/en.json'), /部分回退嫌疑/)
  assert.match(
    r.why.get('miniapp-taro/en.json'),
    /7\.3% 全文/,
    '点名要带占比,否则人看不出为什么被拦',
  )
})

test('T14 反例:合法的死键清理与正常收编都照收(这一臂不是批量删除的消音器)', () => {
  const one = (delta) =>
    __test__.partitionStaleCopies(['f.ts'], {
      worktree: () => 'w',
      head: () => 'h',
      ancestors: () => ['h'],
      everExisted: () => false,
      lineDelta: () => delta,
    })
  for (const l of LEGIT) {
    assert.deepEqual(one(l).kept, ['f.ts'], `合法形态被误拦 ${l.note}: ${JSON.stringify(l)}`)
  }
})

test('T15 部分回退臂:探针取不到 lineDelta ⇒ 不猜(fail-open 同前臂)', () => {
  const noProbe = __test__.partitionStaleCopies(['g.ts'], {
    worktree: () => 'w',
    head: () => 'h',
    ancestors: () => ['h'],
  })
  assert.deepEqual(noProbe.kept, ['g.ts'], '没量到不等于判成回退')
})

test('T16 包装器必须逐臂把探针递进去(漏递 = 那一臂在生产路径上永远不成立)', () => {
  // 这一条钉的正是本席刚修的那颗哑臂:旧包装器只递 worktree/head/ancestors,
  // 「删除档死件回潮」那一臂(2026-10-31 补)在生产路径上 `probes.everExisted?.()` 恒 undefined
  // ⇒ 永远 kept,而镜像测试直连 partitionStaleCopies 递了探针,于是"测试全绿、生产臂空转"。
  const seen = { everExisted: 0, lineDelta: 0 }
  // 两臂在 partitionStaleCopies 里是短路次序(死件臂命中即 continue),所以一条路径
  // 只能喂到一臂 ⇒ 每个形状各给一枚路径,两臂都得从生产包装器真被问到。
  const factory = (p) => ({
    worktree: () => (p === 'dead.ts' ? 'dead-blob' : 'w'),
    head: () => (p === 'dead.ts' ? null : 'h'),
    ancestors: () => (p === 'dead.ts' ? [] : ['h', 'p']),
    everExisted: () => {
      seen.everExisted += 1
      return true
    },
    lineDelta: () => {
      seen.lineDelta += 1
      return p === 'revert.json' ? { removed: 565, added: 19, headLines: 7698 } : ACCIDENT[1]
    },
  })
  const r = __test__.dropStaleCopies(
    ['dead.ts', 'revert.json'],
    [{ path: 'dead.ts', xy: 'D ' }],
    factory,
  )
  assert.deepEqual(r.skipped, ['dead.ts', 'revert.json'])
  assert.ok(seen.everExisted >= 1, '包装器没递 everExisted ⇒ 该臂在生产路径上仍是哑的')
  assert.ok(seen.lineDelta >= 1, '包装器没递 lineDelta ⇒ 部分回退臂只是测试里活着')
  assert.match(r.why.get('dead.ts'), /删除档死件回潮/)
  // f0572d64c4 形态(整片不等于任何祖先,但批量删、几乎不增)经生产包装器也必须被拦
  assert.match(r.why.get('revert.json'), /部分回退嫌疑/)
})

test('T17 行差按多重集算:同一行重复出现按份数计(否则复制两遍的样板被删会读成 0)', () => {
  const a = ['x', 'x', 'x', 'y'].join('\n')
  const b = ['x'].join('\n')
  assert.equal(__test__.minusCount(a, b), 3, 'a 有 3 份 x + 1 份 y,b 只有 1 份 x ⇒ 差应为 3')
  assert.equal(__test__.minusCount(b, a), 0, '反向:b 的每一行 a 里都有 ⇒ 0')
})

test('T18 形状锁:两臂都必须从生产包装器可达(不靠读测试自己的假证)', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'auto-commit-quiet.mjs'), 'utf8')
  const fn = src.match(/\nfunction dropStaleCopies\([\s\S]*?\n\}\n/)?.[0] ?? ''
  assert.ok(fn.length > 40, '必须取到 dropStaleCopies 函数体本身')
  assert.match(
    fn,
    /everExisted:/,
    '包装器不再递 everExisted ⇒ 死件臂重新变哑(7a47524b07 那一型回来)',
  )
  assert.match(fn, /lineDelta:/, '包装器不再递 lineDelta ⇒ 部分回退臂只在测试里活着')

  // 阈值只许住在 isPartialRevert 一处(§0.6):调用点若把数字抄回判据,下一轮改阈值就会两面漂移
  const part = src.match(/\nexport function partitionStaleCopies\([\s\S]*?\n\}\n/)?.[0] ?? ''
  assert.ok(part.length > 40, '必须取到 partitionStaleCopies 函数体本身')
  assert.match(part, /isPartialRevert\(/, '部分回退臂没走单源判据')
  assert.doesNotMatch(part, /removed\s*>=\s*\d+/, '阈值数字不得复写在调用点')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
