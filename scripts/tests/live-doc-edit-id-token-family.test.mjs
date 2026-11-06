// 接线锁:取号令牌"族名不合法"这一型必须被 live-doc-edit 的残留令牌闸认住。
// 立案现场(2026-11-06 实测):台账 HEAD 面有一行 2026-10-25 登记的
//   `- [ ] {{NEXT_ID:docs-207}} **守门 207 存量清偿第二刀…`
// 原样带着**未展开的令牌字面量**进仓 12 天。成因不是漏跑钩子:消费用的 ID_TOKEN_RE 族位是
// `[A-Za-z]+`,而当时的残留档 RESIDUAL_ID_TOKEN_RE 只覆盖"裸写不带族"与"全角形态"两档 ——
// 族名带连字符/数字/空族这一族**两边都不认**,于是既不消费也不报,该行连编号都取不出,
// 门 203 的同题查重与"一号一行"对这种行天然失明。
// 判据单源:一律经 __test__ 复用生产实现,本文件不写第二份匹配式(§22c)。
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as LDE } from '../live-doc-edit.mjs'

const { judgeResidualIdTokens, RESIDUAL_ID_TOKEN_RE } = LDE

const judge = (line) => judgeResidualIdTokens([{ after: line }])

// —— 正向:三型不合法族名 + 两型既有档,必须各自命中,且命中的是那枚字面量本身 ——
const MALFORMED = [
  ['族名带连字符(立案形态)', '{{NEXT_ID:docs-207}}'],
  ['族名带数字', '{{NEXT_ID:A1}}'],
  ['空族名', '{{NEXT_ID:}}'],
  ['裸写不带族(旧档不回退)', '{{NEXT_ID}}'],
  ['全角带坏族', '｛｛NEXT_ID:docs-207｝｝'],
]
for (const [name, literal] of MALFORMED) {
  test(`${name} ⇒ violation,且点名该字面量`, () => {
    const v = judge(`- [ ] ${literal} 某件真活`)
    assert.equal(v.status, 'violation', `实得 ${v.status}:${JSON.stringify(v).slice(0, 300)}`)
    assert.ok(
      v.violations.some((x) => x.literal === literal),
      `未点名 ${literal},实得 ${JSON.stringify(v.violations.map((x) => x.literal))}`,
    )
  })
}

// —— 反证(成对):合法形状与正当引述必须放过 ——
// 把这两类一起拒 = 造一台与任何提交都无关的恒红工具(§12e),失效方向还会变成"多放一次跳门"。
const LEGAL = [
  ['合法单字母族', '- [ ] {{NEXT_ID:G}} 正常登记'],
  ['合法多字母族', '- [ ] {{NEXT_ID:RP}} 正常登记'],
  ['反引号引述不合法形状(讲令牌本身的说明句)', '说明句里 `{{NEXT_ID:docs-207}}` 只是举例'],
  ['全角带字母族(旧档射程内的引述)', '规定的形状是 `｛｛NEXT_ID:G｝｝`'],
]
for (const [name, line] of LEGAL) {
  test(`${name} ⇒ 必须放过`, () => {
    const v = judge(line)
    assert.equal(v.status, 'ok', `误拦正当形态:${JSON.stringify(v.violations).slice(0, 300)}`)
  })
}

// —— 变异自证:摘掉"族名不合法"这两档,新形态立刻漏网(证明是本档在起作用,不是别的档顺手接住)。
// 做法 = 用修复前的那两档逐字造一份对照尺,对同一句原文问一次:旧尺必须漏判、新尺必须命中。
// 假对手防线:若旧尺本来就能命中,那新增档就是多余的,这条要当场失败而不是默默通过。
test('变异自证:退回修复前的两档 ⇒ 立案形态立刻漏判(新档确实在起作用)', () => {
  const PRE_FIX_TWO_ARMS = /(?:\{\{NEXT_ID\}\}|｛｛NEXT_ID(?::[A-Za-z]+|：[A-Za-z]+)?｝｝)/
  const probe = '- [ ] {{NEXT_ID:docs-207}} 守门 207 存量清偿第二刀'
  assert.equal(
    PRE_FIX_TWO_ARMS.test(probe),
    false,
    '假对手不成立:修复前的两档本就该命中立案形态 ⇒ 新增档是多余的,请重立案',
  )
  assert.ok(
    RESIDUAL_ID_TOKEN_RE.test(probe),
    '现行判据对立案形态漏判 ⇒ 修复没落地',
  )
  // 反向对照:旧档射程里的两种形态,新档必须仍然认住(只做加法,不许顺手把旧射程弄丢)
  assert.ok(RESIDUAL_ID_TOKEN_RE.test('{{NEXT_ID}}'), '裸写档回退')
  assert.ok(RESIDUAL_ID_TOKEN_RE.test('｛｛NEXT_ID:G｝｝'), '全角带字母族档回退')
})

// —— 形状锁:三态接口不能被改坏(未判定与判红必须是不同 status,§0.3)——
test('形状锁:取不到判定输入 ⇒ undetermined,不记绿也不冒红', () => {
  assert.equal(judgeResidualIdTokens([]).status, 'undetermined')
  assert.equal(judgeResidualIdTokens('not-an-array').status, 'undetermined')
  assert.equal(judgeResidualIdTokens([{ after: 123 }]).status, 'undetermined')
})

test('形状锁:删除档(drop+after=null)不引入新内容 ⇒ 无事可判,不得拒成用法错', () => {
  const v = judgeResidualIdTokens([{ before: '- [ ] {{NEXT_ID:docs-207}} 旧行', after: null, drop: true }])
  assert.equal(v.status, 'ok', JSON.stringify(v).slice(0, 300))
})
