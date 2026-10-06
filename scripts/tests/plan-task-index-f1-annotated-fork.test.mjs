// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F1 `findForks` 的 G-1058623 修正:「两态并存」的 open 侧必须先剔掉归并副本行。
 *
 * 修的是什么(立项当时的实测,非推理):F1 此前只做 `compositeKeyOf` 分组,进了 `open` 桶的行使
 * **无条件**参与混态判定 ⇒ 同一个 `【归并】重复登记副本` 注记在 F4 里是"已归并、别再派单",
 * 在 F1 里等于不存在。当时真语料 2 组里,未勾选行 13 条带该注记、只有 1 条不带。
 *
 * ⚠ 为什么这条不是纯洁癖 —— 它**会写坏台账**:`plan-tasks-merge.mjs` 的 F1 自愈写路径
 * 随后对每一条 F1 命中的 open 行**真把复选框翻成 `[x]`**。改前 `--heal --commit` 会把
 * `O19b#剩余4列故意不并` 的**持有行翻成已完成**,而它的未勾选是真状态
 * (同主键 done 行自述"列+GIN 下线立迁移票 G-1058625")。
 *
 * **2026-10-06 复核(现读,勿照抄上面的立项数字)**:那条持有行已随整组结清
 * (`O19b#剩余4列故意不并` 现读 **14 行全 done、0 open**,拍板②按 B 案执行枚 `5c3abb296f`),
 * `node scripts/plan-tasks.mjs --forks` 现读 **0 组**、基线 `F1` 也是 0。
 * ⇒ 拟议的档 B(「持有行只报数不问责」)**判据不可实施、已放弃**;T8–T11 是它的反例组与墓碑,
 * 逐条读数见 `scripts/lib/plan-task-index.mjs` 的 `findForks` 头注档 B 段。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { findForks, DUP_POINTER_RE } from '../lib/plan-task-index.mjs'

/** 归并器写的副本注记(逐字取自 `DUP_POINTER_RE` 认的那一句)。 */
const DUP = '〔【归并】重复登记副本(2026-09-27):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'
/** 一行够长的登记正文,保证主键前缀(24 字)稳定。 */
const TITLE = '**G-900001 某条待办的标题占位,长度足够让主键前缀稳定下来**'
const holder = (tail = '') => `- [ ] ${TITLE} —— 持有行,它是归并的目标行。${tail}`
const dupRow = (tail = '') => `- [ ] ${TITLE} —— 副本行。${DUP} ${tail}`
const doneRow = () => `- [x] ${TITLE} —— 同主键的已完成行。`

test('T1 副本行不再单独构成 F1 的 open 侧(改前它会让 13 条副本行全部进组)', () => {
  // 夹具:持有行 1 + 副本行 1 + 同主键 done 1。改前 F1 报这组且 open.length = 2。
  const r = findForks([holder(), dupRow(), doneRow()].join('\n'))
  // 剔副本后判定用的存活 open 只剩 1 条持有行 ⇒ 仍混态 ⇒ 报 1 组
  assert.equal(r.forks.length, 1, '剔副本后剩持有行仍混态,应报 1 组')
  // 而"报出来的那一组"里,副本行不再被算作 F1 的分叉行
  const liveOpen = r.forks[0].open.filter((x) => !DUP_POINTER_RE.test(x.raw))
  assert.equal(liveOpen.length, 1, '存活 open 侧必须只剩持有行 —— 副本行被剔掉了')
})

test('T1b 正向:持有行仍在 ⇒ F1 必须仍报出该组(不得"剔副本"剔成零组)', () => {
  // 这一条与 T1 咬合:只测"不该报的没报"的判据,在整体失灵(恒不报)时会**假绿**。
  const forks = findForks([holder(), dupRow(), doneRow()].join('\n')).forks
  assert.equal(forks.length, 1, '持有行的未勾选是真状态,必须仍被报出来')
  assert.equal(forks[0].open.length, 2, 'forks 组内仍带全部 open 行(只做判定,不删数据)')
})

test('T2 open 侧全带注记 ⇒ 剔完不剩 open ⇒ 退出 F1', () => {
  const forks = findForks([dupRow(), dupRow(' 之二'), doneRow()].join('\n')).forks
  assert.equal(forks.length, 0, 'open 全是副本 ⇒ 没有真持有行 ⇒ 不该报')
})

test('T3 反向防线:某主键唯一的 open 行带注记,且同主键无 done ⇒ 本就不该进 F1', () => {
  // 不得因"带注记"三个字把真问题静默放过:这里靠的是"没有 done"而不是"有注记"。
  const r = findForks([dupRow(), holder()].join('\n'))
  assert.equal(r.forks.length, 0, '没有 done 行 ⇒ 两态不并存 ⇒ 与注记无关')
})

test('T4 反向防线:唯一 open 行带注记 + 同主键有 done ⇒ 剔完不剩 open ⇒ 不报', () => {
  // 这条是"注记不得当万能豁免"的对证:若将来有人把判据写成"带注记一律不报",
  // 本用例仍绿,但 T5 会翻红。
  const forks = findForks([dupRow(), doneRow()].join('\n')).forks
  assert.equal(forks.length, 0)
})

test('T5 纯两态(无任何注记)必须仍被报出 —— 钉住"仍看得见"这一半', () => {
  // 任何把判据改成恒不报出的改法(例如 liveOpenOf 恒返[])都会让本条翻红。
  const forks = findForks([holder(), doneRow()].join('\n')).forks
  assert.equal(forks.length, 1, '无注记的纯两态必须照报')
  assert.equal(forks[0].open.length, 1)
})

test('T6 地雷防线:剔副本不得连带腰斩 dupOpen(F4 的报数档)', () => {
  // `forks`/`dupOpen`/`dupDone` 由**同一个 all** 派生。若有人把剔副本写进**分组阶段**
  // (`continue` 掉带注记行),dupOpen 会被连带腰斩 ⇒ 悄悄把 F4 报数档关了。
  const r = findForks([holder(), dupRow(), doneRow()].join('\n'))
  assert.equal(r.dupOpen.length, 1, 'dupOpen 组数必须只看"open≥2",不因注记而变')
  assert.ok(r.groups.length >= 1, 'groups 必须原样保留')
  assert.equal(
    r.groups.flatMap((g) => g.open).filter((x) => DUP_POINTER_RE.test(x.raw)).length,
    1,
    '副本行仍留在 groups/dupOpen 的原始数据里(本判据只改 forks 判定,不改数据)',
  )
})

test('T7 判不出 ≠ 零组:非字符串输入不得读成"干净"', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    const groups = new Map()
    // findForks 内部靠 parseTaskRows 遍历;对非字符串不能抛未捕获异常
    let out = null
    try {
      out = findForks(bad)
    } catch {
      continue // 抛错也是一种"不把它读成零组"的诚实表现
    }
    assert.ok(Array.isArray(out.forks), `输入 ${String(bad)} 必须给出数组形态的 forks`)
    assert.equal(groups.size, 0)
  }
})

/**
 * ── 档 B(「持有行只报数不问责」)2026-10-06:反例组 ──────────────────────────
 *
 * 下面这一组是**给档 B 下的墓碑**。档 B 想做的事:把"同主键下那条不带注记的未勾选行"
 * 当成指针、从 `forks` 的问责集合里剔掉,理由是"持有行只报数"。
 *
 * 真语料实测(`git show HEAD:PROJECT_PLAN.md`,2026-10-06):那条持有行已随整组结清
 * (`O19b#剩余4列故意不并` 现读 14 行全 done、0 open),`node scripts/plan-tasks.mjs --forks`
 * 现读 **0 组**、基线 `F1` 也是 0 ⇒ **红已不存在,档 B 无红可修**。
 * 且即便此刻重开,判据也不可实施 —— 真语料上三条文本候选判据的假阳性是
 * **18 行里 17 行 / 7 行里 7 行**(读数见 `findForks` 头注档 B 段)。
 *
 * ⚠ **这组用例的用途是"钉住不该豁免的那一半"**:T8–T10 三个夹具**都形似持有行**
 * (done 行自述"已另开票"、或 open 行正文里出现 `【归并】` 字样),
 * 但 open 行**都是真活票**。任何按文本措辞落地档 B 的改法,必在这几条里翻红。
 */

/** 形似持有行的真活票:同主键 done 行自述"已另开票 G-XXXX",而 open 行那半确实还没干完。 */
const HANDOVER_DONE = () =>
  `- [x] （✅@2026-10-05/g2-alltasks）${TITLE} —— 拍板②已裁决并执行(枚 5c3abb296f),列+GIN 下线另开迁移票 G-900011。`
const HOLDER_LIKE_OPEN = () =>
  `- [ ]（进行中@2026-10-05/OWNER）${TITLE} —— ② 仍开着:等 owner 对 metadata 与 extraMetadata 定权威,不猜。`

test('T8 反例:形似持有行(同主键 done 自述"已另开票")的真活票必须仍被 F1 报出', () => {
  // 这一条正是档 B 想豁免的形态。而它**不该被豁免**:done 行只说"列+GIN 下线另开迁移票",
  // 说的是**另一件事的下线**,没有说本行这件事的 ② 已完成 ⇒ open 行的未勾选是真状态。
  // 拿"同主键 done 行提到过'票'"当豁免条件,会把这一格静默放过。
  const forks = findForks([HOLDER_LIKE_OPEN(), HANDOVER_DONE()].join('\n')).forks
  assert.equal(forks.length, 1, '形似持有行的真活票必须仍被报出——档 B 若落地,本条翻红')
  assert.equal(forks[0].open.length, 1)
  assert.equal(forks[0].open[0].raw, HOLDER_LIKE_OPEN())
})

test('T9 反例:含「(另开|已开|新开|立|拆)…票」交接措辞的真活票必须仍被报出', () => {
  // C1 候选判据(交接措辞 ⇒ 它只是指针)在真语料上 18 行命中里17 行是真活票。
  // 夹具取那条最像的形态:正文里有"拆成四票",而本行自己就是那张要拆的票。
  const open = `- [ ]${TITLE} —— 本行是**四件事捆成一行**,按 §9 拆成可独立验收的四票:①容器隔离执行面 ②任务派发 ③镜像缓存 ④看板。**验收**:并发跑两个互不可见的会话。`
  const done = `- [x]${TITLE} —— 上一轮只做了 ①,其余三项仍开着。`
  const forks = findForks([open, done].join('\n')).forks
  assert.equal(forks.length, 1, '含交接措辞的真活票必须仍被报出')
  assert.equal(forks[0].open[0].raw, open)
})

test('T10 反例:正文把【归并】当**议题对象**(而非自我标注)的真活票必须仍被报出', () => {
  // C2 候选判据(正文出现【归并】/存活于 L\d ⇒ 它是指针)在真语料上 7 行命中 **7 行全是真活票**。
  // 根因:`【归并】` 在这些行里是**这一票在讨论的对象**(逐字取自真语料 L8266 `G-814417`),
  // 不是"本行是副本"的自我标注。按 C2 豁免 = 把守门缺陷票本身从问责面上抹掉。
  // ⚠ 夹具的 done 行**必须与 open 行同主键**:`compositeKeyOf` 只取正文**前 24 字**做标题前缀,
  // 所以两行的题面段必须**逐字相同且长于24 字**,`【归并】` 要放在 24 字**之后**的正文里
  // (否则它被吃进题面 ⇒ 两行算两个主键 ⇒ forks 读 0,而"0"看着像"判据已放过",
  // 实为夹具散了 —— 本条第一版就踩了这个,读数 0 !== 1)。
  const HEAD = '**G-900013 归并器产出的指针被 titleOf 当标题 ⇒ 凭空撞号**'
  const open = `- [ ]${HEAD} —— 现读实证:归并器自己产出的〔【归并】…〕行尾注记被 titleOf 当成题面,同一组3 个"不同标题"实为同一任务的副本。`
  const done = `- [x]${HEAD} —— 上一轮只登记了现象,根因与落点未定。`
  const forks = findForks([open, done].join('\n')).forks
  assert.equal(forks.length, 1, '把【归并】当议题的真活票必须仍被报出——C2 式豁免必翻红')
  assert.ok(
    !DUP_POINTER_RE.test(forks[0].open[0].raw),
    '本夹具刻意不含 DUP_POINTER_RE:档 A 豁免不掉它,正是档 B 唯一的作用面',
  )
})

test('T11 档 A 的豁免面不得扩大到"任何带【归并】字样的行"', () => {
  // 把 T10 的结论钉成一条独立断言:档 A 只认 `DUP_POINTER_RE` 这一句自我标注,
  // 不认"正文里出现过【归并】"。两者在真语料上分别是 1303 行与 1310 行 ——
  // 差出来的 7 行**全是真活票**,扩过去就是净损失。
  const HEAD = '**G-900014 归并器产出的行尾指针被当标题 ⇒ F9 凭空撞号（可立即修）**'
  const topicOnly = `- [ ]${HEAD} —— 现读实证:〔【归并】…〕那条行尾注记是本行的**议题对象**。`
  const done = `- [x]${HEAD} —— 已登记现象。`
  const forks = findForks([topicOnly, done].join('\n')).forks
  assert.equal(forks.length, 1)
  // 档 A 的口径:只有 `DUP_POINTER_RE`(逐字 `【归并】重复登记副本`)才被剔
  assert.ok(
    !DUP_POINTER_RE.test(topicOnly),
    '`【归并】重复登记副本` 与 `〔【归并】…〕指针` 是两句不同的话,判据必须逐字区分',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
