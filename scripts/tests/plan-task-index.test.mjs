// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1058639 镜像锁 —— 复合主键的「题面起头」第三档(`emphasisLedTitle`)。
 *
 * 病是什么(现读,2026-10-10,`HEAD:PROJECT_PLAN.md`):有一族登记行 **`keyOfRow` 回得出编号、
 * `compositeKeyOf` 却给出 null**,于是 F1/F4/折叠出口对它们**整族失明** —— 同一件事被反复派单、
 * 归并器永不翻勾。票上点名的两个书写子形态:
 *   ② 行首裸序号(`- [ ] 4. 观察期:…`)⇒ 编号被 `keyOfRow` 取到,但题面在第一个分界符 `:` 处
 *      截断只剩 `观察期`(3 字 <4)⇒ 不成键;真题面写在 `:` 之后紧跟的 `**` 强调段里。
 *   ① 题面以反引号标识符或 `**` 起头 —— 同一把尺子的另一面(`- [ ] **`BROWSER_ACTIONS` …**`
 *      那一族此刻连编号都没有,按 §1 归 F4b 的逐字孪生判据兜,不由本档负责,故本文件只钉"有编号"的那一半)。
 *
 * 三条不许漂的写法:
 *   ① **只扩大,不改动**:已经成键的行,其复合主键逐字不得变(T4 用 HEAD 现读行钉)。
 *   ② **同一份出口**:第三档的输入必须是 `stripLeadingNumeric` 的产物,不是裸正文
 *      (T2 —— 与 M15「判据在自己刚修的族上失明」同型:裸正文的第一个分界符是编号后的 `.` ⇒ 判据根本不成立)。
 *   ③ **M16 撞号防线一字不松**:编号后紧跟**议题自带括注**那一族必须**仍然无键**
 *      (T3/T3b —— 越过自带的括号去后面"捡"记号,等于让两个不同议题抢同一个号时各给得出题面,
 *      于是 F1 不再同键、归并器把别人的未完成任务翻成已完成,那是 2026-09-27 真实自伤的复刻)。
 *
 * 变异自证:把 `titleOf` 的第三档摘掉(退回窄版)⇒ T1/T2/T5 必读红;
 * 把第三档的输入换成裸正文 ⇒ T2 必读红;把"只看第一个分界符"放宽成"任意分界符后找记号" ⇒ T3 必读红。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

import {
  compositeKeyOf,
  keyOfRow,
  titleOf,
  bodyOfRow,
  stripLeadingNumeric,
  emphasisLedTitle,
  findForks,
} from '../lib/plan-task-index.mjs'

/** 逐字取自被审面(`HEAD:PROJECT_PLAN.md`)的登记行 —— 不是自造夹具(§22c:只按代码形状自造的用例是回声器)。 */
const REAL_ORDINAL = '- [ ] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped'
const REAL_M16 = '- [ ] **G-257(新登记)**:`scripts/check-agent-engine-parity.mjs` 的**可跑性依赖 cwd** —— 在 `apps/ai-service` 下跑 `node ../../scripts/check-agent-engine-parity.mjs` 抛异常退出(rc=1),从仓根跑则 rc=0。与"文档不得写跑不通的出路"同族:要么让它自身定位 repo root,要么在头注写明必须从仓根跑。归属:该门持有人。解阻判据:两个 cwd 下退出码一致。'
const REAL_TOPIC_BRACKET = '- [ ]（进行中） **D19(extension + cli 的 `terminal_delta` 宿主)产出完整但按住**:代码 `apps/extension/entrypoints/sidepanel/pages/ChatPage.tsx`(+61)、`apps/cli/src/commands/{agent,repl}.ts`、两份新测试(extension 8 例 / cli 6 例,实测全过)、台账 `scripts/data/sse-dispatch-coverage.json` 与门 90 镜像测试。**按住的理由是两条硬阻塞,不是"没做完"**:① `apps/cli/src/commands/agent.ts` 同一份 diff 里叠着并行会话 WP-8 的 132 行 `stream-tool-ledger` 改动,而那个模块至今 `??` 未入库 —— 只提 agent.ts 会让 HEAD 出现悬空 import(门 98/77 B6 那一族);② 台账基线按"代码同票"抬高到 extension 17 / cli 14,单提台账必造恒红。**副作用如实登记**:工作树里 `node scripts/check-sse-dispatch-parity.mjs` 全量模式现红 4 项(台账先行、代码未入库),提交链的 `--staged` 模式不受影响。**解阻判据**:等 WP-8 的 `stream-tool-ledger.ts` 入库后,把上述文件与台账同一枚提交,再跑门 90 全量须 exit 0。'
const REAL_YIELDED_POINTER = '- [ ]〔【归并】重复登记副本·残行摘号(2026-10-09):本行声明位残留的原号已让出(见同族持有行让号记录),本行摘掉令牌、正文逐字保留、不翻勾、不并抄;同题登记以「本批全量终审 186 项」那一条按标题前缀寻行(不写行号)。〕 **本批全量终审 186 项 = 173 通过 / 5 警告 / 8 失败的逐条归属:一处恒红门已当场修掉,两处证明"红在机器现场不在提交树",余下五条红在他人持有面(2026-09-28 立,现读一律以命令末行为准)** 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「G-580」,派单以那条为准,本行不再单独派单。〕'
/** 改前就已成键的三行(逐字取自 HEAD 面)—— 用于"只扩大、不改动"。 */
const ALREADY_KEYED = [
  ['O86b#托盘退出「设上限≠修好」', '- [ ]O86b 托盘退出「设上限≠修好」:120s 兜底被用户驳回,改租约模型(默认 5s 必退) —— `c149514135` + tag `desktop-v0.1.47` 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「O86b」,派单以那条为准,本行不再单独派单。〕'],
  ['59#消息级版本切换←1/3→', '- [ ] 59. 消息级版本切换 ← 1/3 →(regenerate 改为新增 sibling 而非物理删除;共用 `CanvasVersionMenu` 交互) 〔【归并】重复登记副本(2026-09-29):同主键的另一条登记 「59 · 消息级版本切换←1/3→」,派单以那条为准,本行不再单独派单。〕'],
  ['G-383#实测敞口', '- [ ] G-383 **实测敞口:守门 84 对"混合体回写台账"结构失明,而今天两轮归档的成果正处在这一格里**(2026-09-28 立,判据与取证都已落地) 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记 「G-383」,派单以那条为准,本行不再单独派单。〕'],
]

/** 被审面 = HEAD blob(判据不看磁盘工作树,清单与内容同面同轮)。 */
function headLedger() {
  return execFileSync('git', ['cat-file', 'blob', 'HEAD:PROJECT_PLAN.md'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 256 * 1024 * 1024,
  })
}
const isRow = (l) => /^\s*[-*]\s*\[[ xX]\]/.test(l)

test('M14 行首裸序号 + 题面写在 `**` 之后 ⇒ 必须成键(改前整族对 F1/F4/折叠出口失明)', () => {
  assert.equal(keyOfRow(REAL_ORDINAL), '4', '编号取自行首裸序号(既有 leadingNumericId 出口)')
  assert.equal(titleOf(REAL_ORDINAL), '首个GREENrun达成', '题面来自 `:` 之后紧跟的 `**` 强调段')
  assert.equal(compositeKeyOf(REAL_ORDINAL), '4#首个GREENrun达成', '复合主键 = 编号 + 标题前缀逐字等值')
  // 阳性对照:同一族换个书写(编号后用 `、` 分界、题面同样写在 `**` 之后)也必须成键 —— 证明上面不是巧合。
  assert.equal(compositeKeyOf('- [ ] 4、观察期:**首个 GREEN run 达成(2026-09-14)后进入连续三次绿**'), '4#首个GREENrun达成')
  assert.equal(compositeKeyOf('- [ ]12.3 万条历史会话的清理仍未做(收窄③:分界符后紧跟数字 ⇒ 不是编号)'), null, '量值形态绝不成键(收窄三则③)')
})

test('M14b HEAD 现读:这一族此刻真的成键(读数由被审面量出,不是断言者手写的常量)', () => {
  const lines = headLedger().split('\n')
  let keyed = 0
  const famKey = compositeKeyOf(REAL_ORDINAL)
  assert.ok(famKey, '族键必须由被审面那行现读给得出(否则下面整族读数没意义)')
  let inFamily = 0
  for (const line of lines) {
    if (!isRow(line)) continue
    const key = keyOfRow(line)
    if (key === null || !/^\d{1,3}[A-Z]?$/.test(key)) continue
    const ck = compositeKeyOf(line)
    if (ck) keyed += 1
    if (ck === famKey) inFamily += 1
  }
  // 立项当时的实测:裸序号族 = 7 行(全部未勾选),改前 0 行成键。棘轮口径:只许涨不许跌。
  assert.ok(keyed >= 7, `裸序号族成键行数现读 ${keyed} 必须 ≥7(改前为 0 ⇒ 整族失明)`)
  assert.ok(inFamily >= 7, `同一件事的整族副本现读 ${inFamily} 行必须落进同一个键 ${famKey}(改前这一族根本进不了判定面)`)
})

test('M15 第三档必须走 stripLeadingNumeric 的同一份出口(喂裸正文 ⇒ 判据根本不成立)', () => {
  const rawBody = bodyOfRow(REAL_ORDINAL)
  assert.equal(stripLeadingNumeric(rawBody).startsWith('观察期'), true, '编号那一截由唯一出口剥掉')
  // 裸正文里**第一个分界符是编号后的 `.`**,其后不是起头记号 ⇒ 直接喂裸正文必然给不出题面。
  assert.equal(emphasisLedTitle(rawBody, '4'), null, '裸正文(未剥行首编号)必须判不出第三档题面 —— 这正是"两处各抄一份"会失明的位置')
  assert.equal(emphasisLedTitle(stripLeadingNumeric(rawBody), '4'), '首个GREENrun达成', '同一份正文经唯一出口剥完 ⇒ 才给得出题面')
  assert.equal(titleOf(REAL_ORDINAL), emphasisLedTitle(stripLeadingNumeric(bodyOfRow(REAL_ORDINAL)), keyOfRow(REAL_ORDINAL)), 'titleOf 的第三档与 emphasisLedTitle 必须逐字同结论(不得在 titleOf 里再抄一份)')
})

test('M16 反向锁:编号后紧跟议题自带括注那一族仍必须无键(捡后面记号 = 拆撞号防线)', () => {
  assert.equal(compositeKeyOf(REAL_M16), null, '`G-257(新登记)` 一族:第一个分界符是 `(`,其后不是起头记号')
  assert.equal(compositeKeyOf(REAL_TOPIC_BRACKET), null, '`D19(extension + cli …)` 同族:括注属议题,不吃')
  assert.equal(compositeKeyOf(REAL_YIELDED_POINTER), null, '残行摘号指针行:题面被 `〔` 顶住,仍按无主键交 F4b/人工')
  // 构造面阳性对照:同一行**后面**就有"分界符 + `**` 记号"可以捡,但第一个分界符不是它 ⇒ 依旧必须 null。
  const COLLIDE = '- [ ] **G-777(新登记)**:另一议题 —— 后面还有 **加粗的一段** 与 `标识符.mjs` 记号'
  assert.equal(compositeKeyOf(COLLIDE), null, '第三档绝不越过第一个分界符去后面捡记号(否则 M16 那一族凭空各有题面)')
  // 同一行只把"编号后的议题括注"换成 `.` 分界符 ⇒ 必须成键(证明上一条的 null 是判据有牙,不是实现根本没跑)。
  const NORMAL = '- [ ] **G-777. 另一议题:后面还有 **加粗的一段** 与 `标识符.mjs` 记号**'
  assert.equal(compositeKeyOf(NORMAL), 'G-777#另一议题', `阳性对照必须成键,实测 ${JSON.stringify(compositeKeyOf(NORMAL))}`)
})

test('只扩大、不改动:HEAD 现读已成键的行,其复合主键逐字不变', () => {
  for (const [pinned, line] of ALREADY_KEYED) {
    assert.equal(compositeKeyOf(line), pinned, `存量键不得因这次扩判据而漂移:${pinned}`)
  }
  const lines = headLedger().split('\n')
  let keyed = 0
  for (const line of lines) { if (isRow(line) && compositeKeyOf(line)) keyed += 1 }
  // 改前实测 1461 行成键(判定面 HEAD blob)。棘轮只许涨不许跌 —— 跌了就是"为修一族削掉另一族的覆盖面"。
  assert.ok(keyed >= 1461, `成键总行数现读 ${keyed} 必须 ≥ 改前的 1461`)
})

test('判红口径未松:新认出的这一族进 F1 后,同主键两态并存照旧判红、纯多份未勾照旧不算分叉', () => {
  const copy = (tail) => `${REAL_ORDINAL}${tail}`
  // ① 7 份未勾选(HEAD 面这一族的真实形态)⇒ F1 不得报分叉(否则就是把"没翻勾"当"两态并存")
  const sevenOpen = findForks(Array.from({ length: 7 }, (_, i) => copy(i === 0 ? '' : ' ')).join('\n'))
  assert.equal(sevenOpen.forks.length, 0, '同主键全未勾选不是分叉')
  // ② 同一主键里冒出一行已勾选 ⇒ 必须判红(这一条是 F1 存在的全部理由,新族不得例外)
  const mixed = findForks([copy(''), '- [x] 4. 观察期:**首个 GREEN run 达成(2026-09-14,ac4acf3f:577 passed / 0 failed / 4 flaky / 66 skipped'].join('\n'))
  assert.equal(mixed.forks.length, 1, `同主键两态并存必须判红,实测 ${mixed.forks.length} 组`)
  assert.equal(mixed.forks[0].key, '4#首个GREENrun达成', '报出来的组必须是刚被认出的这一族')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
