// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/plan-pointer-purge.test.mjs —— §22c 镜像:存量清偿器「no-op 拒落」那一格。
//
// 立因(2026-10-25 实测):73 枚自增提交,每枚对 PROJECT_PLAN.md 的真实改动是
// `1 insertion(+), 0 deletions(-)` 且插入的是**空行**。机理两段,本文件逐段钉:
//  ① `serialize` 旧写法 `join(eol) + eol` 每轮往文末多灌一行 —— P3 钉它是逆运算;
//  ② 落地闸当时拿"blob ≠ 父 blob"当"本轮有产出"判据,把灌空行读成了产出 —— P2/P4 钉
//     `landingDiffVerdict` 必须在提交之前否决,而且"只有空行差异"必须是独立的一臂。
// 全部判据 import 源脚本的 `__test__`,本文件不得复制第二份(§22c)。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { maskComments } from '../lib/code-mask.mjs'
import { findMatchingBracket } from '../lib/api-route-registration-expand.mjs'
import { __test__ as T } from '../plan-pointer-purge.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = (rel) => readFileSync(join(HERE, '..', rel), 'utf8')
const CODE = (rel) => maskComments(SRC(rel))

/**
 * 现场签名夹具(逐字节取自实测的那一型台账面):
 * HTML 注释折叠行 + 散文标题 + 已勾选结清行里都含「重复登记副本」字样,
 * 另有一组**同主键两行**(同号组维因此 >0,而两行互不承载 ⇒ 器物一条也动不了)。
 * 现读 stats.L4=1 / realWorkRows=[] / 同号组=1 —— 与 73 枚提交时每轮的账面完全同形。
 */
export const LOOP_FACE = [
  '# 标题',
  '<!-- 已折叠:本行写明自己是「重复登记副本」,却仍占一次登记 ⇒ 收成注释。 -->',
  '### G-1 —— 散文里提到 重复登记副本 这个字样',
  '- [x] ✅(2026-10-25/主会话结算) 重复登记副本:已结清的一行。',
  '- [ ] O02 跨端 UI 单一源:甲席登记的持有行正文。',
  '- [ ] （进行中@2026-10-25/乙席） O02 跨端 UI 单一源:乙席补充的第 1 票已落。',
].join('\n')

const NOTE_FACE =
  '- [ ] G-9 事甲:持有行正文交代。\n' +
  '- [ ] G-10 事乙 〔【归并】重复登记副本(2026-09-26):与 G-9 同题,派单以那条为准,本行不再单独派单。〕\n'

/* ── 处置尺本身 ── */

test('P1 夹具自证:LOOP_FACE 必须复现"账面有处置计数而真实行为 0"那一型,否则 P2 是空跑', () => {
  const lines = LOOP_FACE.split('\n')
  const plan = T.buildPlan(lines, { absorb: true })
  assert.equal(
    T.realWorkRows(lines, plan).length,
    0,
    `夹具的处置尺读数必须是 0(现场即此型),实测 ${JSON.stringify(plan.stats)}`,
  )
  assert.equal(T.workResidueCount(LOOP_FACE, { absorb: true }), 0, '派单侧入口必须同样读 0')
  // 反向对照:真有注记可剥的面必须读 >0,否则上面那条 0 是"尺子坏了"而不是"无事可做"(§12e 同型)
  assert.ok(
    T.workResidueCount(NOTE_FACE, { absorb: true }) > 0,
    '有注记的真副本面必须读得出工作量 —— 量不到就是处置尺自己失效了',
  )
})

test('P2 no-op 拒落四臂:处置 0 / 只有空行差异 都必须否决;真实删行才允许落地', () => {
  const parent = '# t\n- [ ] A 行\n'
  const blankOnly = '# t\n- [ ] A 行\n\n'
  const realDelete = '# t\n'
  const V = T.landingDiffVerdict

  // ① 处置 0 且整面逐字相同 ⇒ 无事可做,拒
  assert.equal(V({ parentText: parent, nextText: parent, work: [] }).ok, false, '①')
  // ② 现场型:处置 0 而整面只差一枚空行 ⇒ 必须点名 blankOnly,拒
  const v2 = V({ parentText: parent, nextText: blankOnly, work: [] })
  assert.equal(v2.ok, false, '② 灌空行必须拒')
  assert.equal(v2.blankOnly, true, '② 必须把"差异只在空白行"单独点名,不能混成"无事可做"')
  // ③ 正向对照:真有行级删除 ⇒ 允许落地(反向锁,防止闸变成恒拒 ⇒ 器物永不工作)
  assert.equal(V({ parentText: parent, nextText: realDelete, work: [1] }).ok, true, '③')
  // ④ 伪装产出:计数报 1 行而非空行序列逐字相同 ⇒ 仍是空转,拒
  assert.equal(V({ parentText: parent, nextText: blankOnly, work: [1] }).ok, false, '④')
})

test('P3 serialize 是 split 的逆运算:一个字符都不许多灌(空行的生产源头)', () => {
  for (const t of ['# a\n- [ ] b\n', '# a\n- [ ] b', 'x\n\n\n', '']) {
    const eol = t.includes('\r\n') ? '\r\n' : '\n'
    assert.equal(
      T.serialize(t.split(/\r?\n/), eol),
      t,
      `serialize 必须逐字节还原父面(旧写法 join(eol)+eol 每轮多灌一行空行),实测 ${JSON.stringify(t)}`,
    )
  }
})

test('P4 落地臂形状锁:--apply 必须在 commitTreeWithIndex 之前过行级铁证,且不得再补行末分隔符', () => {
  const code = CODE('plan-pointer-purge.mjs')
  // 取"调用点"而不是函数定义本身:定义也长得像 `landingDiffVerdict({`,拿它当 callAt
  // 会让下面"闸排在提交之前"变成恒真(定义在文件头,永远早于落地)。
  const callAt = code.search(/=\s*landingDiffVerdict\(\{/)
  const landAt = code.indexOf('commitTreeWithIndex(')
  assert.ok(callAt > 0, '落地臂必须调用 landingDiffVerdict —— 不调用就是在空转产提交')
  assert.ok(landAt > 0, '落地必须走 commitTreeWithIndex(对象空间,不写工作树)')
  assert.ok(callAt < landAt, '行级铁证必须排在提交之前;排在之后等于事后诸葛')
  assert.doesNotMatch(
    code,
    /join\(\s*f?eol\s*\)\s*\+\s*f?eol/,
    '序列化不得再补行末分隔符(= 73 枚空行的字面源头)',
  )
  // 调用还不够:**每一个调用点**都必须真的拦得住,而且 return 必须在闸自己的花括号里。
  // 只写"闸之后 500 字内出现 return"会被顶包(变异验证 M2 实测:摘掉 CAS 轮的 return 后,
  // 紧随其后的 verifyPurge 块里的 `return 1` 照样把这条喂饱)⇒ 必须按括号配对取整个块。
  // 配对器复用现成的字符串/注释感知实现,本文件不自造第二份(§22c)。
  const callRe = /=\s*landingDiffVerdict\(\{/g
  const sites = []
  let m
  while ((m = callRe.exec(code))) sites.push(m.index)
  assert.ok(sites.length >= 2, `首轮与 CAS 重算轮都要问同一把尺,实测调用点 ${sites.length} 处`)
  for (const at of sites) {
    const ifAt = code.indexOf('if (', at)
    assert.ok(ifAt > 0 && ifAt - at < 600, `L${code.slice(0, at).split('\n').length} 处拿到结论后根本没有 if —— 问了不拦`)
    const braceAt = code.indexOf('{', ifAt)
    const closeAt = findMatchingBracket(code, braceAt, '{', '}')
    assert.ok(closeAt > braceAt, `${ifAt} 处的闸括号不配平,判不了`)
    const block = code.slice(braceAt, closeAt + 1)
    assert.match(
      block,
      /\breturn\b|\bprocess\.exit\(/,
      `L${code.slice(0, at).split('\n').length} 处的行级铁证只问不拦(闸体内没有 return)= 闸是摆设(变异 M2 的靶)`,
    )
  }
})

test('P5 措辞单源:work=0 的结论句必须自己说"不落地不推送"', () => {
  const line = T.workVerdictLine([], { L4: 1 })
  assert.match(line, /state=无需清偿/, '结论态必须可被机器读')
  assert.match(line, /不落地不推送/, '必须写明不落地 —— 否则派单方会把它读成"清完了"')
  assert.match(line, /分层处置计数合计 1 行/, '账面计数与真实 0 行的分歧必须印在行里')
  assert.match(T.workVerdictLine([0, 1], {}), /state=将清偿 2 行/, '正向对照:有活要报数')
})

test('P6 退出码接线:main() 的结论必须落到 process.exitCode(rc=3 = 无需清偿,不是失败)', () => {
  const code = CODE('plan-pointer-purge.mjs')
  assert.match(code, /process\.exitCode\s*=\s*main\(\)/, 'main() 只 return 不接 ⇒ 旁路未落地仍按 0 退出,派方读成"复清完成"')
})

test('P7 装车证明:真取本仓 HEAD 面 ⇒ 处置尺必须量出数字(不是 null)', () => {
  // 不断言具体条数 —— 台账每几分钟被别人推进,断言条数就是造一条会自己烂的绿。
  const wt = readFileSync(resolve(HERE, '..', '..', 'PROJECT_PLAN.md'), 'utf8')
  const n = T.workResidueCount(wt)
  assert.equal(typeof n, 'number', '尺子在这台机上装不上 ⇒ 触发集永远读不到处置集,实测 ' + String(n))
  const head = execFileSync('git', ['show', 'HEAD:PROJECT_PLAN.md'], {
      cwd: resolve(HERE, '..', '..'),
      encoding: 'utf8',
      maxBuffer: 256 * 1048576,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const h = T.workResidueCount(head, { absorb: true })
  assert.equal(typeof h, 'number', 'HEAD 面必须量得到,实测 ' + String(h))
  assert.equal(T.workResidueCount('', { absorb: true }), null, '取不到面 ⇒ 未判定,绝不冒充 0(§0.3)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
