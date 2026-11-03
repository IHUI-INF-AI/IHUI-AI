// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):git-sync-converge 对 union-converge 结论的"转述层"。
//
// 立项实据(2026-09-29,本会话当日 4 次被误导):merge-tree 冲突分支打印
//   ❌ 合并冲突,且 union-converge 亦判需人工(见上)。
//   原始输出:  <只有 merge-tree 的 fatal 噪声与 CONFLICT 行>
// 而"见上"里根本没有 union 的判定 —— 子进程 stdout 那几行才是判据。同日至少 2 次人工复跑
// node scripts/union-converge.mjs --theirs <sha> --accept-state-growth … 是 exit 0(可落地)的,
// 也就是说上层把"没取到结论"写成了"人工判定",让每个后来人重跑一遍昂贵的手工判定。
//
// 判据的对象是"转述是否忠实",所以全部走构造面 + **逐字取自真仓日志的 union 输出样本**
// (REAL_SUMMARY / REAL_GATE_HEADER / REAL_ITEM_F1 / REAL_ITEM_F3 四行取自
// .ihui-agent/tmp/o81-resume/union-report.txt 第 41 行与第 84-86 行,由交付时的校验脚本逐行
// 反查过原文;那份 tmp 样本不受版本控制,故测试把文本内联,不依赖它在不在)。
// 兄弟锁(scripts/tests/git-sync-converge.test.mjs 的 T4/T5、converge-object-presence-g473 的
// 窗口锁、union-converge.test.mjs 的调用点计数锁)在本文件 R10 一并复验 —— 改造不得让它们翻红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  classifyUnionAttempt,
  unionOutcomeMessage,
  describeUnionRelay,
  extractUnionVerdict,
  capText,
  unionExitMark,
  stripUnionExitMark,
  readUnionExitCode,
} from '../git-sync-converge.mjs'

const SRC = readFileSync(new URL('../git-sync-converge.mjs', import.meta.url), 'utf8')

const REAL_SUMMARY =
  '[union-converge] CHECK ONLY base=f8e267b7818 ours=15a7fccc773 theirs=d5e5f4282f9 / 取对侧 114 路径 / 两侧同改三方归并 1 / 需人工 0 / 对侧删除不传播 1 / 活文档行 union'
const REAL_GATE_HEADER = '❌ 落地闸不过 9 处:'
const REAL_ITEM_F1 =
  '   PROJECT_PLAN.md 归并放大任务状态分叉:F1 同主键两态并存(组) 各侧最多 100,归并结果 147'
const REAL_ITEM_F3 =
  '   PROJECT_PLAN.md 归并放大任务状态分叉:F3 行号指针·此刻有出口可收(处) 各侧最多 0,归并结果 2'
// merge-tree 的噪声:它是真信号(点名冲突文件),但它不是 union 说过的话。
const NOISE = [
  "fatal: path 'apps/web/src/components/chat/x.ts' does not exist in 6397f278ce",
  'CONFLICT (content): Merge conflict in PROJECT_PLAN.md',
].join('\n')

const marked = (body, code) => `${body}${unionExitMark(code)}`
const VERDICT_TEXT = [NOISE, REAL_SUMMARY, REAL_GATE_HEADER, REAL_ITEM_F1, REAL_ITEM_F3].join('\n')

test('R1 逐字转述(判据 1 正例):结论行一字不改地带出,含其后所有缩进条目行', () => {
  const v = extractUnionVerdict(marked(VERDICT_TEXT, 1))
  for (const line of [REAL_SUMMARY, REAL_GATE_HEADER, REAL_ITEM_F1, REAL_ITEM_F3]) {
    assert.ok(v.lines.includes(line), `结论行没被逐字带出:${line}`)
  }
  assert.equal(v.gateCount, 9, '「落地闸不过 N 处」的 N 必须读出来,不得让下一个人重数')
  assert.equal(v.needHumanCount, 0, '摘要行的「需人工 0」也是结论的一部分')
  assert.equal(v.hits.none, false)
  assert.equal(
    v.lines.some((l) => l.startsWith('fatal:')),
    false,
    'merge-tree 的噪声不得混进"union 的结论"这一族(那正是旧措辞骗人的地方)',
  )
})

test('R2 条目行的边界(判据 1 反例):顶格行终止转述,空行不终止', () => {
  const withTopLevel = [REAL_SUMMARY, REAL_GATE_HEADER, REAL_ITEM_F1, '顶格的下一段', REAL_ITEM_F3]
  const v = extractUnionVerdict(marked(withTopLevel.join('\n'), 1))
  assert.equal(v.lines.includes('顶格的下一段'), false, '顶格行属别的段落,算进结论就是把噪声又搬回来')
  assert.equal(v.lines.includes(REAL_ITEM_F3), false, '终止之后不再收(判据是"其后连续条目行",不是"其后全部输出")')

  const withBlank = [REAL_SUMMARY, REAL_GATE_HEADER, REAL_ITEM_F1, '', REAL_ITEM_F3].join('\n')
  const v2 = extractUnionVerdict(marked(withBlank, 1))
  assert.ok(v2.lines.includes(REAL_ITEM_F3), '条目之间的空行不该把转述整段截断(union 的行由 console.log 拼)')
})

test('R3 截断必须点名(判据 1 的诚实性):超上限就说断了多少行/字节,没超就不许说"截断"', () => {
  const many = [REAL_SUMMARY, REAL_GATE_HEADER]
  for (let i = 0; i < 30; i++) many.push(`   PROJECT_PLAN.md 归并放大任务状态分叉:F9 第 ${i} 条`)
  const v = extractUnionVerdict(marked(many.join('\n'), 1), { maxLines: 5 })
  assert.ok(v.truncated && v.truncated.lines > 0, '超上限必须报截断')
  assert.equal(v.kept.lines, 5)
  assert.equal(v.total.lines, v.kept.lines + v.truncated.lines, '行数账必须闭合(少带的不许装作带过)')
  const relay = describeUnionRelay(marked(many.join('\n'), 1), { maxLines: 5 })
  assert.match(relay.block, /转述已截断/)
  assert.match(relay.block, /结论共 32 行/)

  // 反向对照:同一份文本给足上限,报告里就不许出现"截断"二字(谎报截断与谎报判定同样贵)
  const full = describeUnionRelay(marked(many.join('\n'), 1))
  assert.equal(full.block.includes('截断'), false, '没截断却写"截断" ⇒ 读的人以为看到的是片段')
})

test('R4 判据 2 的第①支:非零退出且有「落地闸不过」⇒ 措辞必须点名维度条数', () => {
  const relay = describeUnionRelay(marked(VERDICT_TEXT, 1))
  assert.equal(relay.kind, 'need-human')
  assert.equal(relay.hasVerdict, true)
  assert.match(relay.counts, /落地闸不过 9 处/)
  assert.match(relay.counts, /需人工 0 项/)
  assert.match(relay.counts, /exit=1/)
  assert.match(relay.headline, /落地闸不过 9 处/, 'headline 就是把条数点名给外层那句用的')
})

test('R5 判据 2 的第②支:stdout 为空 ⇒ 说"未判定:<原因>",禁止读成需人工', () => {
  const relay = describeUnionRelay(marked('', 1))
  assert.equal(relay.kind, 'crashed')
  assert.equal(relay.hasVerdict, false)
  assert.ok(relay.headline.startsWith('未判定:'), `空输出必须落未判定,实得:${relay.headline}`)
  assert.doesNotMatch(relay.headline, /亦判需人工|判需人工/, '一支都没判出来却说"需人工"就是本票立项的那句谎')
  assert.match(relay.block, /没有可转述的结论行/)
})

test('R6 判据 2 的第②支·真事故形状:只有 merge-tree 噪声 + 非零退出 ⇒ 仍是未判定', () => {
  const relay = describeUnionRelay(marked(NOISE, 1))
  assert.equal(relay.hasVerdict, false, '本票当日 4 次误导就发生在这个形状上')
  assert.ok(relay.headline.startsWith('未判定:'))
  assert.doesNotMatch(relay.headline, /亦判需人工|判需人工/)
  assert.match(relay.headline, /exit=1/)
})

test('R7 判据 3:子进程 exit 0 而外层仍失败 ⇒ 不得沿用"亦判需人工"(成对:同文本退 1 才走人工支)', () => {
  const body = [NOISE, REAL_SUMMARY].join('\n')
  const clean = describeUnionRelay(marked(body, 0))
  assert.equal(classifyUnionAttempt(marked(body, 0)), 'exited-clean')
  assert.equal(clean.hasVerdict, false)
  assert.ok(clean.headline.startsWith('未判定:'))
  assert.doesNotMatch(clean.headline, /亦判需人工|判需人工/)
  // 反向对照:同一份文本退 1 时它确实是人工裁决,不得被一并洗成未判定
  const human = describeUnionRelay(marked([NOISE, REAL_SUMMARY, REAL_GATE_HEADER, REAL_ITEM_F1].join('\n'), 1))
  assert.equal(human.kind, 'need-human')
  assert.equal(human.hasVerdict, true)
})

test('R8 退出码标签不得改变既有判定:落地仍是 landed、未判定仍是 undetermined', () => {
  assert.equal(classifyUnionAttempt(marked('✅ 合并落地 7a1f3c2 已推进', 0)), 'landed')
  assert.equal(classifyUnionAttempt(marked('[union-converge] UNDETERMINED 未判定:对象不在本机', 2)), 'undetermined')
  assert.equal(classifyUnionAttempt(marked('随便一段没有结论行的话', 1)), 'need-human')
  assert.equal(classifyUnionAttempt('随便一段没有结论行的话'), 'need-human', '无标签的旧调用面行为不变')
})

test('R9 退出码三态不得并桶:读到 / 形状不认识 / 没有标签,是三件事', () => {
  assert.equal(readUnionExitCode(marked('x', 1)), 1)
  assert.equal(readUnionExitCode(marked('x', 0)), 0)
  assert.equal(readUnionExitCode(unionExitMark(-1)), null, '信号终止等读不懂的码落 unknown ⇒ null,不得当成 0')
  assert.equal(readUnionExitCode('没有标签的文本'), null)
  assert.equal(stripUnionExitMark(marked('abc', 1)).includes(unionExitMark(1)), false)
  assert.equal(stripUnionExitMark(marked('abc', 1)).trim(), 'abc', '剥标签不得动 union 自己的文本')
})

test('R10 兄弟锁在改造后仍成立(§22c:改造不得把别人的镜像测试改成红的)', () => {
  const all = (SRC.match(/attemptUnionConverge\(freshRemote, repoRoot\)/g) ?? []).length
  const defs = (SRC.match(/function attemptUnionConverge\(freshRemote, repoRoot\)/g) ?? []).length
  assert.equal(all - defs, 2, '调用点必须恰好两处(兄弟镜像测试按这个数字判)')
  // 归并出口仍自己接住非零退出并优先回吐 stdout(两条兄弟锁共用同一条正则)
  const start = SRC.indexOf('function attemptUnionConverge(')
  const body = SRC.slice(start).slice(0, SRC.slice(start).indexOf('\n}\n') + 3)
  assert.match(body, /catch \(ue\) \{\s*return String\(ue\.stdout \|\| ue\.message/)
  assert.ok(body.includes('stderrTail(ue)'))
  assert.match(body, /timeout:\s*Number\(process\.env\.IHUI_UNION_CONVERGE_TIMEOUT_MS \|\| 1500000\)/)
  // g473 与 T4 的窗口锁:分流必须在"亦判需人工"之前,且两者都要落在窗口内
  const site = SRC.indexOf('const uni = attemptUnionConverge(')
  assert.ok(site > 0)
  const win = SRC.slice(site, site + 1600)
  const iDivert = win.indexOf('classifyUnionAttempt(uni)')
  const iHuman = win.indexOf('亦判需人工')
  assert.ok(iDivert > 0, '分流缺失 ⇒ 崩溃/噪声会被报成人工裁决')
  assert.ok(iHuman > iDivert, `分流必须排在人工那句之前(窗口 1600 内找不到它 ⇒ 兄弟锁恒红,iHuman=${iHuman})`)
  assert.match(SRC, /union-converge 亦判需人工/)
})

test('R11 装车锁:两个分支都真用转述层,旧的"原始输出"顶包必须整体消失', () => {
  assert.equal(SRC.includes('原始输出'), false, '那句"原始输出"是谎的载体:它打印的是 merge-tree 的噪声,却挂在 union 的结论位上')
  assert.ok(SRC.includes('describeUnionRelay(uni)'), '冲突分支没接转述层 ⇒ 判据在而无人调度(守门 70/76 同型)')
  assert.ok(SRC.includes('describeUnionRelay(uniOut)'), '状态放大分支没接转述层')
  assert.ok(SRC.includes('relay.hasVerdict'), '人工支与未判定支必须按转述层的分流走,不得再无条件打印人工那句')
  assert.equal(
    (SRC.match(/export function describeUnionRelay/g) ?? []).length,
    1,
    '措辞只能有一份实现:两个调用点各拼一遍就是"上面说实话、下面说谎"',
  )
})

test('R12 措辞表:除人工裁决一支外,四支都不许说"需人工",且每支都给可执行的下一步', () => {
  for (const k of ['landed', 'undetermined', 'crashed', 'exited-clean']) {
    const msg = unionOutcomeMessage(k)
    assert.ok(!msg.includes('需人工'), `${k} 那一支说了"需人工" ⇒ 崩溃/没取回会被读成内容裁决`)
    assert.ok(/再重跑|转下一轮|重跑本器|再跑/.test(msg), `${k} 那一支没有可执行的下一步:${msg}`)
  }
  assert.ok(unionOutcomeMessage('need-human').includes('需人工'))
  assert.match(unionOutcomeMessage('exited-clean'), /union-converge\.mjs --theirs/)
})

test('R13 capText 与转述层同一条规矩:证据可以短,但必须说短了多少', () => {
  const big = Array.from({ length: 40 }, (_, i) => `CONFLICT (content): 第 ${i} 行`).join('\n')
  const capped = capText(big, { maxLines: 4 })
  assert.equal(capped.kept.lines, 4)
  assert.equal(capped.truncated.lines, 36, '截断行数必须点名')
  assert.equal(capped.truncated.bytes > 0, true)
  const small = capText('两行\n就好', { maxLines: 4 })
  assert.equal(small.truncated, null, '没截断就必须报 null,不得造出一个"截断 0 行"的假账')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
