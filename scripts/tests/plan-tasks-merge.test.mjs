// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks-merge 的镜像测试(§22c)—— 含**自愈层的独立仓端到端 A/B**。
 *
 * 为什么自愈必须有独立仓证明:它是"会自己提交"的代码。真仓上跑一次只能证明"这次没炸",
 * 证不了三件要紧事:① 有分叉时确实产出前向修复提交;② 没分叉时**绝不**再产出提交(幂等);
 * ③ 它只推进 HEAD/索引,**不改写并发会话的工作树副本**(改了就是越权)。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { DUP_POINTER_RE, POINTER_FAMILIES, auditPlan } from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { buildBlockDedupe, healStopReasons, verifyBlockDedupe, buildMerge, __test__ } from '../plan-tasks-merge.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const gitQ = (cwd, args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e', '-c', 'user.name=e2e', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
const PLAN_A = ['# 计划', '', '- [x] ✅(2026-09-20) **D9 同一件事**:做完了。', '- [ ] **D9 同一件事**:另一侧还挂着未勾。', '- [ ] **D8 真待办**:还没人做。', ''].join('\n')

/** 搭一个带分叉夹具的临时 git 仓,并把它的项目根返回给调用方收尾。 */
function fixtureRepo() {
  const dir = mkScratch('plan-merge-e2e')
  const sdst = path.join(dir, 'scripts')
  mkdirSync(sdst, { recursive: true })
  copyScriptWithClosure(path.join(ROOT, 'scripts'), 'plan-tasks-merge.mjs', sdst, ['lib/plan-task-index.mjs'])
  copyScriptWithClosure(path.join(ROOT, 'scripts'), 'check-plan-line-loss.mjs', sdst)
  gitQ(dir, ['init', '-q', '-b', 'main'])
  /**
   * 夹具仓必须配**本仓级**身份 —— 被测工具自己的 `commit-tree` 不带 `-c user.*`
   * (它不该硬编码作者:在真仓里那会篡改提交署名)。而本机实测**没有全局 git 身份**
   * (`git config --global user.email` 为空,新 init 的仓拿不到 author),于是 T1/T3 的
   * 落地步骤一直 `fatal: unable to auto-detect email address` ⇒ 这个门的端到端臂
   * 在这台机上从未真正跑通过,而账面只看得到"两个测试红了",看不出守门工具的落地路径
   * 一次都没被执行过(AGENTS:"判据失效的表现永远是安静")。
   */
  gitQ(dir, ['config', 'user.email', 't@e2e'])
  gitQ(dir, ['config', 'user.name', 'e2e'])
  writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), PLAN_A, 'utf8')
  gitQ(dir, ['add', 'PROJECT_PLAN.md'])
  gitQ(dir, ['commit', '-q', '-m', 'fixture: 一条已做完 + 一条未翻勾的副本'])
  return { dir, entry: path.join(sdst, 'plan-tasks-merge.mjs') }
}

/** 提交条数 —— 必须 trim 后再数:gitQ 不 trim,尾换行会被数成多一条(第一版就假失败在这)。 */
const countCommits = (dir) => gitQ(dir, ['log', '--oneline']).trim().split('\n').filter(Boolean).length

const runHeal = (env) => {
  let code = 0
  let out = ''
  try {
    out = execFileSync(process.execPath, [env.entry, '--heal', '--commit'], {
      cwd: env.dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
  } catch (e) {
    code = e.status ?? 1
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  return { code, out }
}

test('T1 独立仓 A 臂:有分叉 ⇒ 产出恰好一枚只含计划文档的前向修复提交', () => {
  const env = fixtureRepo()
  try {
    const r = runHeal(env)
    if (r.code !== 0) throw new Error(`exit 应为 0,实得 ${r.code}:${r.out}`)
    if (!/自愈落地/.test(r.out)) throw new Error(`输出未点名落地:${r.out.trim()}`)
    const after = gitQ(env.dir, ['show', 'HEAD:PROJECT_PLAN.md'])
    if (!after.includes('**[归并]**')) throw new Error('HEAD 里副本行未翻勾')
    if (!after.includes('- [ ] **D8 真待办**:还没人做。')) throw new Error('真待办被误动')
    const nl = (s) => s.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length
    if (nl(after) !== nl(PLAN_A)) throw new Error(`行数发生变化(应一行不加不删):${nl(PLAN_A)} → ${nl(after)}`)
    const paths = gitQ(env.dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n').filter(Boolean)
    if (paths.length !== 1 || paths[0] !== 'PROJECT_PLAN.md') throw new Error(`修复提交含意外路径:${JSON.stringify(paths)}`)
    if (countCommits(env.dir) !== 2) throw new Error('提交总数应为 2(fixture + 修复)')
  } finally {
    rmScratch(env.dir)
  }
})

test('T2 独立臂:自愈**不得改写工作树副本**(它只推进 HEAD/索引,否则就是替并发会话改盘)', () => {
  const env = fixtureRepo()
  try {
    runHeal(env)
    if (readFileSync(path.join(env.dir, 'PROJECT_PLAN.md'), 'utf8') !== PLAN_A) {
      throw new Error('工作树副本被自愈改写了 —— 越权')
    }
  } finally {
    rmScratch(env.dir)
  }
})

test('T3 独立臂(幂等):已干净时不得再产出任何提交', () => {
  const env = fixtureRepo()
  try {
    const first = runHeal(env)
    if (first.code !== 0) throw new Error(`第一次就失败:${first.out.trim()}`)
    const second = runHeal(env)
    if (second.code !== 0 || !/无状态分叉/.test(second.out)) throw new Error(`第二次应判"无需自愈":${second.out.trim()}`)
    if (countCommits(env.dir) !== 2) throw new Error(`幂等失败:提交数 ${countCommits(env.dir)}(应为 2)`)
  } finally {
    rmScratch(env.dir)
  }
})

test('T4 停手判据是纯函数:四种坏形态各自必须停手,正当结果不得停手', () => {
  const r = buildMerge(PLAN_A, '2026-09-26')
  if (healStopReasons(PLAN_A, r.text, r.changed, 0).length !== 0) throw new Error('正当归并被误停手')
  if (!healStopReasons(PLAN_A, `${r.text}\n多塞一行`, r.changed, 0).join().includes('行数不等')) throw new Error('多塞一行未停手')
  if (!healStopReasons(PLAN_A, PLAN_A, r.changed, 0).join().includes('未归零')) throw new Error('什么都没改却不停手 ⇒ 会把"跑过一次"当成"修好了"')
  if (!healStopReasons(PLAN_A, r.text, r.changed, 2).join().includes('拒写')) throw new Error('有拒写项未停手')
})

test('T5 停手判据必须能认出"偷偷改了一行没登记的东西"', () => {
  const r = buildMerge(PLAN_A, '2026-09-26')
  const tampered = r.text.replace('- [ ] **D8 真待办**:还没人做。', '- [ ] **D8 真待办**:被偷改了。')
  const reasons = healStopReasons(PLAN_A, tampered, r.changed, 0)
  if (!reasons.some((x) => x.includes('未登记行'))) throw new Error(`未登记的改动未被识别:${JSON.stringify(reasons)}`)
})

/**
 * T6 翻勾必须同时摘牌(2026-09-26 立 —— 本工具自己产出的行自相矛盾)。
 *
 * 起因:rewriteFork 过去只把 `- [ ]` 换成 `- [x] ✅`,**正文里挂着的 `（进行中@…）` 原样留下**,
 * 于是产出的行同时是"已完成"又"进行中"。守门 109 的 CL3 正是判这一型 ⇒ 归并每跑一次就往 HEAD
 * 里种几颗红点;而 PROJECT_PLAN.md 是门 109 的 stagedTriggers 文件,谁下一次提交计划文档都被这台
 * 恒红门拦住,唯一出路是 --no-verify(连带废掉全部守门 —— AGENTS §12e 那条最高反面教训)。
 * 两道机制互咬时,修的是**生产者**,不是手抹产出行。
 */
test('T6 翻勾必须摘牌:产出行不得同时含 [x] 与（进行中）(守门 109 CL3 的互咬面)', () => {
  for (const marker of ['（进行中@2026-09-26/某票）', '（进行中）']) {
    const src = `- [ ] ${marker} D99 复合主键正例:某件已做完的事。`
    const out = __test__.rewriteFork(src, 'D99#复合主键正例', '2026-09-26')
    if (!/^- \[x\]/.test(out)) throw new Error(`未翻勾:${out}`)
    if (out.includes('进行中')) throw new Error(`标记未摘除 ⇒ 产出行自相矛盾:${out}`)
    // 摘牌不等于删账:正文本体必须逐字保住
    if (!out.includes('D99 复合主键正例:某件已做完的事。')) throw new Error(`正文被吞:${out}`)
  }
  // 反向对照:已经是 [x] 的行必须原样返回(本工具不得二次改写已完成登记)
  const done = '- [x] ✅(2026-09-25) D98 早就完成的事。'
  if (__test__.rewriteFork(done, 'D98#早就完成的事', '2026-09-26') !== done) {
    throw new Error('[x] 行被二次改写')
  }
  // 有牙证明:若"摘牌"那步被去掉,本条必须红 —— 用变异夹具自证判据不是恒真式
  const leaky = `- [x] ✅(2026-09-26) **[归并]** 注记。 ${'- [ ] （进行中@2026-09-26/x） D99 事'.replace(/^- \[ \]\s*/, '')}`
  if (!leaky.includes('进行中')) throw new Error('变异夹具本身不含标记 ⇒ T6 无牙,须重造')
})

/**
 * T7 F6 块级收口的**装车成套性**:函数在、自测过,但 main() 里没有那个开关 ⇒ 提交链与人工
 * 入口都到不了它 —— 本仓最高频的一型就是"造好没装车"(守门 70/76/81/102 同族)。
 * 所以这里既判行为,也判"开关真的被解析且真的落到落地函数"。
 */
test('T7 块级收口:开关必须真在 CLI 上,且真调落地函数', () => {
  const src = readFileSync(new URL('../plan-tasks-merge.mjs', import.meta.url), 'utf8')
  const must = (re, why) => {
    if (!re.test(src)) throw new Error(`${why}(缺了它就是"函数在而入口不在")`)
  }
  must(/has\('--dedupe-blocks'\)/, "CLI 必须解析 --dedupe-blocks")
  must(/return dedupeAndLand\(\)/, '开关必须真的调用 dedupeAndLand()')
  must(/export function dedupeAndLand/, '落地函数必须在位')
  // 与 --heal 的区别必须是**刻意的**:删行不进自动档
  const seg = src.slice(src.indexOf("has('--dedupe-blocks')"))
  if (!/if \(!has\('--commit'\)\)/.test(seg)) throw new Error('块级收口未加 --commit 时必须只出报告,不得自动删行')
})

test('T8 块级收口行为:逐字相同的第 2..N 份删得对,唯一份与漂移副本一份都不许动', () => {
  const LP = (s) => s + '　'.repeat(Math.max(0, 46 - [...s].length))
  const BLK = [
    LP('- 块行一:整块登记被追加两遍,F6 是块级量纲'),
    LP('- 块行二:第二行,过阈值'),
    LP('- 块行三:第三行'),
  ].join('\n')
  const dup = `## 甲\n${BLK}\n## 乙\n${BLK}\n\n尾行非 bullet`
  const r = buildBlockDedupe(dup)
  if (r.deletedCount !== 3) throw new Error(`两份相同应删第 2 份的 3 行,实测 ${r.deletedCount}`)
  const p = verifyBlockDedupe(dup, r.text, r.deletedCount)
  if (p.length) throw new Error(`正当收口不得报问题:${JSON.stringify(p)}`)
  // 幂等:再跑一次必须无事可做(否则归并动作永不收敛,每轮都喊)
  if (buildBlockDedupe(r.text).deletedCount !== 0) throw new Error('第二次必须判"已收口"')
  // 反向对照:把幸存份也删掉的输出必须被零损失断言炸掉
  if (verifyBlockDedupe(dup, '## 甲\n\n空', 3).length === 0) throw new Error('删掉唯一幸存份必须判失败')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

test('T9 F4b 归并出口:无主键的逐字孪生行只加指针、不动勾选、不删行,措辞不得谎称"同主键"', () => {
  const twin = '- [ ] **真机走查**:深色顶栏已修(commit 84583fdf6),剩观察期。'
  const keyed = '- [ ] **D99 复合主键正例**:说明。'
  const src = ['# 计划', twin, twin, keyed, keyed].join('\n')
  const m = buildMerge(src, '2026-09-27')
  const lines = m.text.split('\n')
  if (lines.length !== 5) throw new Error(`归并不得删行(§1 禁止无声删除),行数 ${lines.length}`)
  // 两条无主键孪生里必须恰好一条被标注,且保留未勾选状态
  const marked = lines.filter((l) => /【归并】重复登记副本/.test(l))
  if (marked.length !== 2) throw new Error(`两族孪生各标一条,实测 ${marked.length}`)
  for (const l of marked) {
    if (!/^- \[ \]/.test(l)) throw new Error(`副本行动了勾选状态:${l.slice(0, 40)}`)
    if (l.includes('同主键的另一条登记') && !l.includes('D99'))
      throw new Error(`无主键行被写成"同主键"= 一句无法核验的假话:${l.slice(0, 60)}`)
  }
  if (!marked.some((l) => /逐字相同的另一条登记/.test(l)))
    throw new Error('F4b 的措辞档没生效(说明无主键分档在调用点丢了)')
  // 2026-09-28 契约变更:F4/F4b 新指针**一律不写行号**(§1「证据指针禁止写行号」,而 HEAD 面 244 条
  // 行号指针全是本工具自己产的、F3 当时一条不认)。这一条锁住病根不复发。
  for (const l of marked)
    if (/〔【归并】重复登记副本[^〕]*L\d/.test(l))
      throw new Error(`新指针又写了行号,下一次 append 就成死指针:${l.slice(0, 80)}`)
  // 幂等:第二次跑不得再加第二句
  const again = buildMerge(m.text, '2026-09-28')
  if (again.changed.length > 0)
    throw new Error(`重复归并不得再加注记,实测改了 ${again.changed.length} 行`)
})

test('T10 落地调度锁:早退判据必须看见 F4b,结论数字必须回读落地的那枚提交', () => {
  const src = readFileSync(path.resolve(ROOT, 'scripts', 'plan-tasks-merge.mjs'), 'utf8')
  // 判据与出口都写好了、而落地档的早退只看 F4 ⇒ 报告"拟改写 15 行"却回一句"无状态分叉"什么都不做
  // (2026-09-27 实测)。"有牙而无人调度"这一型只有源码锁能防,行为测试只会跟着一起绿。
  const guard = /if \(!b0\.forks[^\n]*\)\s*\{/.exec(src)
  if (!guard) throw new Error('找不到 healAndLand 的早退判据那一行(形态变了,本锁需同步)')
  if (!/verbatimDupCopies/.test(guard[0]))
    throw new Error(`早退判据没把 F4b 算进去 ⇒ 无主键孪生行永远修不掉:${guard[0].slice(0, 90)}`)
  if (/F1\/F2\/F3\/F4 = 0\/0\/0\/0/.test(src))
    throw new Error('落地结论写着死的 0/0/0/0,而不是回读落地那枚提交的现读数字')
})

/**
 * T11 指针族的"判得到 ⇔ 修得了"必须成套,且出口一律不再产行号。
 * 立项凭据(2026-09-28 现读):HEAD 面 244 条 `另一条登记在 L<行号>` 是**本工具自己写的**,
 * 而 F3 当时只认 `存活于 L<行号>`(该族现读 0 条)⇒ 账面 F3=0、指针全在烂(§1 明文禁止行号指针)。
 * 四条锁各防一型:① 族表与修复出口不同集 ⇒ 新加一族判得到却修不了,红永久留给下一个人;
 * ② 出口再写行号 ⇒ 同一条病复发;③ 无主键分支谎称"同主键" ⇒ 一句无法核验的假话;
 * ④ 端到端不归零 ⇒ "跑过一次"被当成"修好了"。
 */
test('T11 指针族表与修复出口成套,且改写后不留任何行号指针', () => {
  const fams = POINTER_FAMILIES.map((f) => f.id).sort().join(',')
  const rules = Object.keys(__test__.POINTER_REPAIRS).sort().join(',')
  if (fams !== rules)
    throw new Error(`判据族 ${fams} 与修复出口 ${rules} 不同集 ⇒ 有一族判得到却修不了`)
  const key = 'D7#D7甲事'
  const dupLine =
    '- [ ] **D7 甲事**:还没人做。 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记在 L2,派单以那条为准。〕'
  const fixed = __test__.rewritePointer(dupLine, key)
  if (/L\d/.test(fixed)) throw new Error(`修复出口仍写着行号:${fixed}`)
  if (!/另一条登记/.test(fixed) || !fixed.includes('「'))
    throw new Error(`内容锚点没换上,实测:${fixed.slice(0, 140)}`)
  // 无主键分支不得谎称"同主键"(F4b 的孪生行本来就没有编号)
  const noKey =
    '- [ ] 重启宿主后 %TEMP% 才真指 D 盘 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L5841(本行无编号主键),派单以那条为准。〕'
  const fixedNoKey = __test__.rewritePointer(noKey, '')
  if (/L\d/.test(fixedNoKey)) throw new Error(`无主键分支仍写行号:${fixedNoKey}`)
  if (/同主键/.test(fixedNoKey)) throw new Error('对没有编号的行说"同主键"是一句无法核验的假话')
  if (!/逐字相同/.test(fixedNoKey)) throw new Error('无主键分支必须保留"逐字相同"这个可核验措辞')
  // 新产的指针(rewriteDup)同样禁止行号
  const fresh = __test__.rewriteDup('- [ ] **D9 同一件事**:短的那条。', key, '2026-09-28')
  if (/L\d/.test(fresh)) throw new Error(`rewriteDup 又产出行号指针 ⇒ 病根复发:${fresh}`)
  if (!DUP_POINTER_RE.test(fresh)) throw new Error('新指针必须被派单口径认得,否则等于没归并')
  // 端到端:含腐烂指针的文档跑一遍 buildMerge,出口必须把它清零
  const doc = [
    '# 计划',
    '',
    dupLine,
    '- [ ] **D8 乙事**:与指针无关的另一条。',
    '',
  ].join('\n')
  if (auditPlan(doc).counts.rotatedPointers === 0)
    throw new Error('夹具本身就没被判红 ⇒ 这条端到端断言无牙,换一个形态而不是删掉它')
  const merged = buildMerge(doc, '2026-09-28')
  if (auditPlan(merged.text).counts.rotatedPointers !== 0)
    throw new Error('buildMerge 之后 F3 必须归零(否则"跑过一次"会被读成"修好了")')
  if (/登记在\s*L\d/.test(merged.text)) throw new Error('输出里仍残留行号指针')
})
