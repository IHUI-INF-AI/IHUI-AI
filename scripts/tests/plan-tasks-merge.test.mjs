// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import {
  DUP_POINTER_RE,
  POINTER_FAMILIES,
  POINTER_NO_AUTO_REPAIR,
  auditPlan,
} from '../lib/plan-task-index.mjs'
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
  // 每条族表要么有改写规则、要么显式登记"无自动出口 + 原因":皆无 = 判得到却修不了(红留给下一个人),
  // 皆有 = 声明自相矛盾。静默"某族没人管"是本仓最贵的那一型失明。
  const repairs = new Set(Object.keys(__test__.POINTER_REPAIRS))
  const noExit = new Set(Object.keys(POINTER_NO_AUTO_REPAIR))
  for (const f of POINTER_FAMILIES) {
    const has = repairs.has(f.id)
    const declared = noExit.has(f.id)
    if (has === declared)
      throw new Error(
        `族 ${f.id} 的出口声明不自洽(有改写规则=${has},登记无出口=${declared})⇒ 必须恰好其一`,
      )
    if (declared && !String(POINTER_NO_AUTO_REPAIR[f.id] || '').trim())
      throw new Error(`族 ${f.id} 登记了无自动出口却没写原因`)
  }
  if (!repairs.has('dup') || !noExit.has('ref'))
    throw new Error('dup 族必须有改写规则、ref 族必须登记无自动出口(HEAD 面实测两型各自如此)')

  const k = 'D7#D7甲事'
  // 指针必须指向**同复合主键的条目行**(L4)才落在"可自动收口"那一型;指向空行属"无出口"型,
  // 用它当端到端夹具会让断言恒真(第一版就是这样,auto 实测 0 而不是 1)。
  const dupLine =
    '- [ ] **D7 甲事**:还没人做。 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记在 L4,派单以那条为准。〕'
  const fixed = __test__.rewritePointer(dupLine, k)
  if (/L\d/.test(fixed)) throw new Error(`修复出口仍写着行号:${fixed}`)
  if (!fixed.includes('另一条登记') || !fixed.includes('「'))
    throw new Error(`内容锚点没换上,实测:${fixed.slice(0, 140)}`)

  // 无主键分支不得谎称"同主键"(F4b 的孪生行本来就没有编号)
  const noKey =
    '- [ ] 重启宿主后 %TEMP% 才真指 D 盘 〔【归并】重复登记副本(2026-09-27):逐字相同的另一条登记在 L5841(本行无编号主键),派单以那条为准。〕'
  const fixedNoKey = __test__.rewritePointer(noKey, '')
  if (/L\d/.test(fixedNoKey)) throw new Error(`无主键分支仍写行号:${fixedNoKey}`)
  if (/同主键/.test(fixedNoKey)) throw new Error('对没有编号的行说"同主键"是一句无法核验的假话')
  if (!/逐字相同/.test(fixedNoKey)) throw new Error('无主键分支必须保留"逐字相同"这个可核验措辞')

  // 无自动出口那一族必须**原样返回**:它的目标行已不可推断,猜一个锚点等于编造证据
  const refLine = '- [ ] **D8 乙事**:说明。 〔另见 L9 的那一条。〕'
  if (__test__.rewritePointer(refLine, k) !== refLine)
    throw new Error('ref 族登记了无自动出口,改写函数却动了它')

  // 新产的指针一律禁止行号
  const fresh = __test__.rewriteDup('- [ ] **D9 同一件事**:短的那条。', k, '2026-09-28')
  if (/L\d/.test(fresh)) throw new Error(`rewriteDup 又产出行号指针 ⇒ 病根复发:${fresh}`)
  if (!DUP_POINTER_RE.test(fresh)) throw new Error('新指针必须被派单口径认得,否则等于没归并')

  // 端到端:可收口族归零 + 无出口族一处都不能被改动
  const doc = [
    '# 计划',
    '',
    dupLine,
    '- [ ] **D7 甲事**:还没人做。',
    refLine,
  ].join('\n')
  const a0 = auditPlan(doc).counts
  if (a0.rotatedAuto !== 1)
    throw new Error(
      `夹具没含"可自动收口"那一型(auto=${a0.rotatedAuto})⇒ 这条端到端断言无牙,换形态而不是删断言`,
    )
  const merged = buildMerge(doc, '2026-09-28')
  const a1 = auditPlan(merged.text).counts
  if (a1.rotatedAuto !== 0) throw new Error('可自动收口那一族未归零 ⇒ 出口对它失效')
  if (a1.rotatedNoExit !== a0.rotatedNoExit)
    throw new Error('无出口那一族被自动改了 = 在编造证据(它必须原样留着交人工)')
  if (/登记在\s*L\d/.test(merged.text)) throw new Error('输出里仍残留 dup 族的行号指针')
})

/**
 * 跑 CLI 一次,并把**工作目录未跟踪清单的前后差集**一起返回。
 * 为什么必须量这一维:旗标吞噬那一型的全部症状都在这格里 —— `--write-to --staged` 会在
 * cwd 写出一个名叫 `--staged` 的文件(§28 禁止形态),而期望路径没被写、程序还打印"已写到"。
 * 只看退出码和 stdout 什么都看不见(归并器自认为写完了),差集才是唯一的物证。
 */
function runCli(env, args) {
  const untracked = () =>
    gitQ(env.dir, ['status', '--porcelain', '-uall'])
      .split('\n')
      .filter((l) => l.startsWith('?? '))
      .map((l) => l.slice(3))
      .sort()
  const before = untracked()
  let code = 0
  let out = ''
  try {
    out = execFileSync(process.execPath, [env.entry, ...args], {
      cwd: env.dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
  } catch (e) {
    code = e.status ?? 1
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  return { code, out, added: untracked().filter((p) => !before.includes(p)) }
}

/**
 * T12 (a) 臂:`--write-to --staged` ⇒ 大声拒绝 + 点名收到的 token + **一个文件都不产**。
 * 立项凭据:改动前该形态把候选文本写成 cwd 下一个名叫 `--staged` 的文件并打印"已写到 --staged",
 * 期望路径没写、台账没更新,而退出码是 0 —— "判据失效的表现永远是安静"那一型。
 */
test('T12 --write-to 被别的旗标顶上:非零退出 + 点名 token + 工作目录零新增文件', () => {
  const env = fixtureRepo()
  try {
    const r = runCli(env, ['--write-to', '--staged'])
    if (r.code === 0) throw new Error(`无效值必须非零退出,实得 0(等于自认为写完了):${r.out.trim().slice(0, 200)}`)
    if (!r.out.includes('--staged')) throw new Error(`拒绝必须点名**真实收到的** token:${r.out.trim().slice(0, 200)}`)
    if (/候选文本已写到/.test(r.out)) throw new Error('拒绝档不得同时宣称已写到')
    if (r.added.length !== 0) throw new Error(`工作目录多出 ${JSON.stringify(r.added)} —— §28 禁止形态,而它只有 git status 看得见`)
    if (existsSync(path.join(env.dir, '--staged'))) throw new Error('写出了名叫 --staged 的文件(修复未生效)')
    // 拒绝也不是回落:文档本体与 HEAD 都必须一字未动
    if (readFileSync(path.join(env.dir, 'PROJECT_PLAN.md'), 'utf8') !== PLAN_A) throw new Error('拒绝档却改写了文档本体')
    if (countCommits(env.dir) !== 1) throw new Error('报告档不得产出任何提交')
  } finally {
    rmScratch(env.dir)
  }
})

/**
 * T13 (b) 臂:合法路径必须**真的写出且内容正确**。
 * 只留 T12 会让判据退化成"永远拒" —— 那与放行同样糟(归并器从此交不出候选文本)。
 */
test('T13 --write-to 合法路径:真写出、内容就是归并后的候选文本、文档本体没被碰', () => {
  const env = fixtureRepo()
  try {
    const target = path.join(env.dir, 'out', 'candidate.md')
    mkdirSync(path.dirname(target), { recursive: true })
    const r = runCli(env, ['--write-to', target])
    if (r.code !== 0) throw new Error(`合法路径应 exit 0,实得 ${r.code}:${r.out.trim().slice(0, 200)}`)
    if (!/候选文本已写到/.test(r.out)) throw new Error(`未宣称写到目标:${r.out.trim().slice(0, 200)}`)
    if (!existsSync(target)) throw new Error('宣称已写到而文件不在(打印与磁盘分叉)')
    const written = readFileSync(target, 'utf8')
    if (!written.includes('**[归并]**')) throw new Error('写出的不是归并后的候选文本(副本行未翻勾)')
    if (!written.includes('- [ ] **D8 真待办**:还没人做。')) throw new Error('真待办被吞')
    if (written === PLAN_A) throw new Error('内容与输入逐字相同 ⇒ 什么都没归并')
    if (readFileSync(path.join(env.dir, 'PROJECT_PLAN.md'), 'utf8') !== PLAN_A) throw new Error('写候选文本却碰了文档本体')
  } finally {
    rmScratch(env.dir)
  }
})

/**
 * T14 (c) 臂:`--write-to` 后面什么都不给 ⇒ 与改动前同形(非零 + 拒写),
 * **绝不得**回落到某个默认路径去写别处(落错地方比不落更糟)。
 */
test('T14 --write-to 缺值:保持改动前的拒绝语义,不回落到默认路径', () => {
  const env = fixtureRepo()
  try {
    const r = runCli(env, ['--write-to'])
    if (r.code !== 1) throw new Error(`缺值应 exit 1(与改动前一致),实得 ${r.code}:${r.out.trim().slice(0, 200)}`)
    if (!/❌/.test(r.out)) throw new Error(`必须大声拒绝:${r.out.trim().slice(0, 200)}`)
    if (r.added.length !== 0) throw new Error(`缺值却写出了文件 ${JSON.stringify(r.added)} —— 回落写错地方`)
    if (existsSync(path.join(env.dir, 'PROJECT_PLAN.md.bak')) || existsSync(path.join(env.dir, 'candidate.md')))
      throw new Error('存在默认路径回落(本工具不允许)')
  } finally {
    rmScratch(env.dir)
  }
})

/**
 * T15 (d) 臂:源码级反向锁 + 判据本身的行为锁。
 * 为什么两条都要:§22c 记过"镜像测试只复读实现就是复读机" —— 只锁源码文本会跟着漂绿,
 * 只测行为又防不住有人把裸 `argv[indexOf()+1]` 抄回来却在别处调一个别的谓词。
 * 判据一律用**从源文件 import 的那一份**(`__test__.flagValue`),不在测试里重写。
 */
test('T15 反向锁:裸 argv[indexOf()] 取值不得回来,且取值判据就是源里那一份', () => {
  const src = readFileSync(new URL('../plan-tasks-merge.mjs', import.meta.url), 'utf8')
  if (/argv\[argv\.indexOf\('--write-to'\)/.test(src))
    throw new Error('又回到"把紧邻的下一个 token 当值"的裸取值 —— 本票要修的正是这一格')
  if (!/flagValue\(argv,\s*'--write-to'\)/.test(src))
    throw new Error('main() 没有走取值判据(判据在而无人调用 = 没有,守门 70/76/81 同族)')
  if (!/export function flagValue/.test(src)) throw new Error('判据未 export ⇒ 测试只能自己抄一份(§22c 禁止)')
  // 无效值那一支必须既点名又非零退出,不得静默忽略旗标
  const branch = /if \(wt\.present && !wt\.valid\)\s*\{[\s\S]{0,600}?\n  \}/.exec(src)
  if (!branch) throw new Error('找不到"无效值"那一格拒绝分支(形态变了,本锁需同步)')
  if (!/return 1/.test(branch[0])) throw new Error('拒绝分支没有非零退出码 ⇒ 调用方读成"跑成功了"')
  if (!/wt\.token/.test(branch[0])) throw new Error('拒绝分支没点名真实收到的 token')
  // 判据行为四态(成对:合法值必须放行,否则本校验只是"永远拒")
  const f = __test__.flagValue
  if (typeof f !== 'function') throw new Error('__test__.flagValue 未导出 ⇒ 上面那条 export 锁是空的')
  if (f(['--write-to', '--staged'], '--write-to').valid) throw new Error('- 开头的 token 被判成了合法值')
  if (f(['--write-to'], '--write-to').valid) throw new Error('缺值被判成了合法值')
  if (f(['--write-to', ''], '--write-to').valid) throw new Error('空串被判成了合法值')
  if (f(['--write-to', 'a/b.md'], '--write-to').value !== 'a/b.md') throw new Error('合法路径被拒 ⇒ 归并器交不出候选文本')
  if (f(['--all'], '--write-to').present) throw new Error('旗标缺席却报"值为空"')
})

/**
 * T16 既有的第二格拒绝(PROJECT_PLAN.md 本体)语义一字未动 —— 新校验加在**拒绝链前面**,
 * 不是替换它。改动前该臂 exit 1 + 那句原文,改动后必须仍是。
 */
test('T16 --write-to PROJECT_PLAN.md:原有那格拒绝与原文案未被替换', () => {
  const env = fixtureRepo()
  try {
    const r = runCli(env, ['--write-to', 'PROJECT_PLAN.md'])
    if (r.code !== 1) throw new Error(`应 exit 1,实得 ${r.code}`)
    if (!/不允许直接写文档本体/.test(r.out)) throw new Error(`原拒绝文案漂了:${r.out.trim().slice(0, 200)}`)
    if (r.added.length !== 0) throw new Error(`多出文件 ${JSON.stringify(r.added)}`)
    if (readFileSync(path.join(env.dir, 'PROJECT_PLAN.md'), 'utf8') !== PLAN_A) throw new Error('文档本体被写')
  } finally {
    rmScratch(env.dir)
  }
})

// —— 未识别参数不得降级成"无参"(2026-09-28 立,由一条写进台账的幻影出口逼出)——
// 旧形态只判 includes(已知旗标),不认识的一律静默忽略 ⇒ `--dedupe-done-twins`(从未实现的出口)
// 会落进默认报告档并打出「✅ 零损失对账通过…派单口径 403 → 403」,读的人没有理由怀疑那个操作
// 根本没发生。本会话就据此把一条假出口写进了台账 —— 与 i18n-apply 把 --help 当"无参"进写盘模式
// 同族,只是失效方向从"误写盘"变成"误发合格证"。
test('A1 inspectArgs:未识别旗标必须点名;合法旗标与两类合法位置参数不得误判', async () => {
  const mod = await import('../plan-tasks-merge.mjs')
  const assert = (await import('node:assert/strict')).default
  const inspectArgs = mod.inspectArgs ?? mod.__test__?.inspectArgs
  const KNOWN_FLAGS = mod.KNOWN_FLAGS ?? mod.__test__?.KNOWN_FLAGS
  assert.ok(typeof inspectArgs === 'function' && Array.isArray(KNOWN_FLAGS), '出口必须从模块直接可取(不得靠 __test__ 凑第二份)')
  assert.deepEqual(inspectArgs(['--dedupe-done-twins']).unknown, ['--dedupe-done-twins'])
  assert.deepEqual(inspectArgs(['--heal', '--commit']).unknown, [])
  assert.deepEqual(inspectArgs(['--write-to', 'cand.json', '2026-09-28']).unknown, [])
  assert.deepEqual(inspectArgs(['--staged', 'oops.json']).unknown, ['oops.json'])
  assert.ok(KNOWN_FLAGS.includes('--dedupe-blocks'), '已实现的出口必须在白名单里')
})

test('A2 端到端:从未实现的出口 ⇒ rc=2、原样点名,且绝不打出"通过"档口的结论', async () => {
  const assert = (await import('node:assert/strict')).default
  let status = 0
  let out = ''
  try {
    out = execFileSync(
      process.execPath,
      [path.join(ROOT, 'scripts', 'plan-tasks-merge.mjs'), '--dedupe-done-twins'],
      { encoding: 'utf8', cwd: ROOT, timeout: 120000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    )
  } catch (e) {
    status = e.status
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  assert.equal(status, 2, `未识别参数必须 exit 2(无法判定),实得 ${status}:${out.slice(0, 200)}`)
  assert.match(out, /未识别的参数:"--dedupe-done-twins"/, '必须原样点名收到的那个 token')
  assert.doesNotMatch(out, /✅ 零损失对账通过|派单口径/, '拒绝那一趟不得同时打出成功档口的结论')
})
