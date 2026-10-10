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
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import {
  DUP_POINTER_RE,
  POINTER_FAMILIES,
  POINTER_NO_AUTO_REPAIR,
  auditPlan,
  compositeKeyOf,
  keyOfRow,
  matchBalancedGroupAt,
  titleOf,
} from '../lib/plan-task-index.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  buildBlockDedupe,
  healStopReasons,
  verifyBlockDedupe,
  buildMerge,
  foldTwins,
  applyTwinFolds,
  verifyTwinFold,
  buildTwinFold,
  stripTwinFold,
  isTwinFolded,
  twinFoldNote,
  twinFoldRejectReason,
  KNOWN_FLAGS,
  auditPointerTerminals,
  stripMergeNotes,
  restoreMergeNote,
  buildRestoreTerminals,
  verifyRestoreTerminals,
  pointerVisibilityRegression,
  // G-761:单行等值副本两档的出口函数与零损失核 —— 本文件只钉"跨态链",判据一律引实现那一份
  buildRowDedupe,
  verifyRowDedupe,
  buildOpenRowDedupe,
  verifyOpenRowDedupe,
  findRowTwins,
  // G-341:读数出口与判定面点名一起进镜像测试 —— 测试不得自己再算一遍(§22c)
  verifyMerge,
  setRunFace,
  runFaceLabel,
  __test__,
} from '../plan-tasks-merge.mjs'
import { forkPreserved } from '../lib/plan-merge-annotation.mjs'
// 反向锁与"两维互咬"的判据一律引守门 71 自己那一份实现(§22c:镜像测试不抄第二份判据)
import { headIdOf, headIdSet, lostMarkers, markerOf } from '../check-plan-line-loss.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
/**
 * stdio 三元必须**显式接管**:本宿主上派生 `cmd.exe` 100% EBUSY ⇒ 凡是走默认 stdio 继承的
 * 派生都稳定 `spawnSync git EBUSY`(同一时刻 bash 里 git 正常,加上
 * `stdio:['ignore','pipe','pipe']` 也正常;git 自己没有被锁,绝对路径同样复现)。
 * 这与 face-reader.mjs 记的老陷阱同源另一副面孔:那边是 `stdio[0]='ignore'` 吞掉 `--batch`
 * 清单,这边是继承式管道派生直接失败 —— 两种失效都表现为"安静地少数据 / 直接报错",
 * 账面只看得见测试红,看不出是宿主派生面。`maxBuffer` 一并写死(与 stdio 同源)。
 */
const gitQ = (cwd, args) =>
  execFileSync('git', ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e', '-c', 'user.name=e2e', ...args], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
const PLAN_A = ['# 计划', '', '- [x] ✅(2026-09-20) **D9 同一件事**:做完了。', '- [ ] **D9 同一件事**:另一侧还挂着未勾。', '- [ ] **D8 真待办**:还没人做。', ''].join('\n')

/**
 * 搭一个带夹具的临时 git 仓,并把它的项目根返回给调用方收尾。
 * 默认夹具 = PLAN_A(一条已做完 + 一条未翻勾的副本);折叠档需要自己的夹具,故两参可覆盖 ——
 * 默认值不变,既有 T1/T3/… 的语义一字未动(向后兼容是这一票的硬要求)。
 */
function fixtureRepo(planText = PLAN_A, commitMsg = 'fixture: 一条已做完 + 一条未翻勾的副本') {
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
  writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), planText, 'utf8')
  gitQ(dir, ['add', 'PROJECT_PLAN.md'])
  gitQ(dir, ['commit', '-q', '-m', commitMsg])
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
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 24,
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
    if (!after.includes('[归并]')) throw new Error('HEAD 里副本行未翻勾(注记缺失)')
    // G-307(a):落地后的那一行必须仍是"正文逐字保留"的翻勾 —— 用与生产侧同一份剥取实现核对,
    // 不在测试里抄第二份判据(§22c);它红 = 归并层产出了守门 71 会回捞的形态 = 循环复活。
    const turned = after
      .split('\n')
      .find((l) => l.includes('D9 同一件事') && /^\s*- \[x\]/.test(l) && /\[归并\]/.test(l))
    if (!turned) throw new Error(`找不到被翻勾的那一行:${after}`)
    if (!forkPreserved('- [ ] **D9 同一件事**:另一侧还挂着未勾。', turned))
      throw new Error(`翻勾行正文不再逐字相等 ⇒ 守门 71 将回捞未勾原行(循环输入):\n${turned}`)
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

/**
 * T7b 未勾单行副本收口(`--dedupe-open-rows`)的装车锁。
 *
 * 为什么单独一条:T7 把源码读的是**磁盘**,而磁盘那份在共享工作区里常年是别人的滞后副本
 * (2026-09-29 05:5x 实测 `scripts/plan-tasks-merge.mjs` 工作树 2656 行 vs HEAD 3546 行,且
 * 暂存 index blob `c355678296` 按 `git log --all --find-object` **匹配不到任何祖先** ⇒ 自愈层
 * 与守门 84 对这一型全部静默)。按磁盘判的后果有两头:副本被回写时它**跟着一起绿**,而它绿恰恰
 * 是"这一格已被看过"的假承诺。所以本条只判**被审面(HEAD blob)**,并用构造面证明判据有牙。
 * 四项缺一即"函数在而入口不在"(守门 70/76/81/115 同族);第四项最隐蔽:落地函数与 CLI 都在,
 * 唯独没进 `KNOWN_FLAGS` ⇒ `inspectArgs` 把它当未知参数直接拒掉,这个出口对用户就是不存在。
 */
test('T7b 未勾单行副本收口:开关/落地函数/旗标白名单必须在 HEAD 面成套', () => {
  const flagsBodyOf = (src) => {
    const at = src.indexOf('export const KNOWN_FLAGS')
    if (at < 0) return ''
    const open = src.indexOf('[', at)
    if (open < 0) return ''
    const end = matchBalancedGroupAt(src, open, { '[': ']' })
    return end < 0 ? '' : src.slice(open, end)
  }
  const gaps = (src) => {
    const miss = []
    if (!/has\('--dedupe-open-rows'\)/.test(src)) miss.push("CLI 未解析 --dedupe-open-rows")
    if (!/return openRowsDedupeAndLand\(/.test(src)) miss.push('开关未真的调用 openRowsDedupeAndLand()')
    if (!/export function openRowsDedupeAndLand/.test(src)) miss.push('落地函数未导出(在位但无人可调)')
    if (!flagsBodyOf(src).includes("'--dedupe-open-rows'")) miss.push('旗标不在 KNOWN_FLAGS ⇒ inspectArgs 会拒掉它')
    return miss
  }
  // 被审面取 HEAD:git 问不到会直接抛 ⇒ 本条判"红",不静默通过
  const head = gitQ(ROOT, ['show', 'HEAD:scripts/plan-tasks-merge.mjs'])
  if (!head || head.length < 1000) throw new Error(`HEAD 面取到的源码异常短(${head.length}),判据无法成立`)
  const real = gaps(head)
  if (real.length) throw new Error(`HEAD 面缺装车成套性:${real.join(' | ')}`)
  // 有牙证明(构造面,不依赖仓库瞬时状态):四道各拆一次,必须各红在对应判据上
  // 第四道的变异必须**在 KNOWN_FLAGS 数组体内**删这一项:文件里 `'--dedupe-open-rows',` 这个
  // 字面量还出现在自检的 inspectArgs 夹具里,整串 replace 会先命中那里而白名单原样在位 —— 那样
  // 这条变异测的是"replace 打没打到",不是"白名单缺失喊不喊"。
  const fb = flagsBodyOf(head)
  const flagsGap = head.replace(fb, fb.replace("'--dedupe-open-rows',", ''))
  if (flagsGap === head) throw new Error('第四道变异没有改动文本 ⇒ KNOWN_FLAGS 体内找不到该字面量,先修夹具再谈判据')
  const mustHit = [
    ["CLI 未解析 --dedupe-open-rows", head.replace(/has\('--dedupe-open-rows'\)/, "has('--no-such-flag')")],
    ['开关未真的调用 openRowsDedupeAndLand()', head.replace(/return openRowsDedupeAndLand\(/, 'return notTheLandingFn(')],
    ['落地函数未导出', head.replace(/export function openRowsDedupeAndLand/, 'function openRowsDedupeAndLand')],
    ['旗标不在 KNOWN_FLAGS', flagsGap],
  ]
  for (const [phrase, text] of mustHit) {
    if (!gaps(text).some((m) => m.includes(phrase))) throw new Error(`变异未点名「${phrase}」⇒ 该项判据无牙`)
  }
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
  // 正则必须**容忍折行**:早退判据是一串 `&&` 链,prettier 会按 printWidth 把它折成多行
  // (本机实测即如此),单行式 `/if \(!b0\.forks[^\n]*\)\s*\{/` 会在格式化后凭空失明 ——
  //  判据失效的表现永远是安静,且它自己绿着。`[\s\S]{0,400}?` 配惰性量词跨行取值,
  //  再回查该片段里有没有 F4b,与源码是否折行无关。
  const guard = /if \(\s*!b0\.forks[\s\S]{0,400}?\)\s*\{/.exec(src)
  if (!guard) throw new Error('找不到 healAndLand 的早退判据那一行(形态变了,本锁需同步)')
  if (!/verbatimDupCopies/.test(guard[0]))
    throw new Error(`早退判据没把 F4b 算进去 ⇒ 无主键孪生行永远修不掉:${guard[0].slice(0, 120)}`)
  if (/F1\/F2\/F3\/F4 = 0\/0\/0\/0/.test(src))
    throw new Error('落地结论写着死的 0/0/0/0,而不是回读落地那枚提交的现读数字')
})

/**
 * G-307(a) 成对判据的镜像臂:两代注记形态都必须剥回同一份正文;而"整行替换/截断"的
 * 产物必须被抓住。正向与反向各两条 —— 只有正向的判据等于没有判据(§22c)。
 */
test('T11 正文逐字保留:两代形态各一对正反例,判据与被测实现共用 lib 的同一份剥取', () => {
  const BEFORE = '- [ ] G-9 一条待办:这段正文在翻勾与追加注记后必须逐字活着,不许截断。'
  const NEW = __test__.rewriteFork(BEFORE, 'G-9#一条待办', '2026-09-28')
  const LEGACY =
    '- [x] ✅(2026-09-27) **[归并]** 本行与已完成登记同题(主键 「G-9 · 一条待办」),是被并发并集留下的未翻勾副本 ⇒ 只落状态、不删行、不重复计账。 G-9 一条待办:这段正文在翻勾与追加注记后必须逐字活着,不许截断。'
  if (!forkPreserved(BEFORE, NEW)) throw new Error(`现行后置式被判截断:\n${NEW}`)
  if (!forkPreserved(BEFORE, LEGACY)) throw new Error('legacy 前置式(HEAD 存量)必须同样判"正文保住"')
  if (forkPreserved(BEFORE, NEW.slice(0, 30))) throw new Error('截断产物必须被抓住 ⇒ 判据无牙')
  if (forkPreserved(BEFORE, LEGACY.slice(0, LEGACY.indexOf(' G-9 一条'))))
    throw new Error('legacy 形态砍掉正文后必须判截断(只留注记空壳不算保住)')
  // 生产形态锁:新翻勾行必须"正文在行首、注记在行尾",不得回到"注记整行替换正文"的旧形
  if (!/^- \[x\] ✅\(2026-09-28\) G-9 一条待办/.test(NEW))
    throw new Error(`翻勾行正文未留在行首:${NEW.slice(0, 50)}`)
  if (!/（\[归并\] 本行.*）$/.test(NEW)) throw new Error('注记必须整体括在行尾全角括号里(短正文的标题切分依赖它)')
  // 两闸都要装:healStopReasons(落地)与 verifyMerge(报告)必须都引 forkPreserved
  const src = readFileSync(path.resolve(ROOT, 'scripts', 'plan-tasks-merge.mjs'), 'utf8')
  for (const fn of ['healStopReasons', 'verifyMerge']) {
    const seg = src.slice(src.indexOf(`export function ${fn}`), src.indexOf(`export function ${fn}`) + 2600)
    if (!seg.includes('forkPreserved')) throw new Error(`${fn} 未接正文逐字判据 —— 只装一道闸,另一道将来会漂`)
  }
  // 反向锁:旧"整行替换"的产出形状不得回来(VERDICT_TAG 前置模板已删)
  if (src.includes('**[${VERDICT_TAG}]**') || src.includes('。 ${body}'))
    throw new Error('legacy 前置模板仍在某处生产新行 —— 守门 71 的循环会复活')
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
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 24,
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
    // 「翻勾注记长什么样」两侧各写了一份,按「同一想法只留一份」保留较新的一侧:
    //   · 对侧这一行判的是**前置式** `**[归并]** …`(注记在正文之前);
    //   · 本侧 G-307 已把注记迁到**行尾全角括号式** `（[归并] …）`、正文留在行首,并由上面那条
    //     T11 加了反向锁禁止前置模板再生产新行(前置式正是守门 71 回捞循环那 24 枚恢复型提交的成因)。
    // 判据的**意图**一字未松,反而更严:现在要求「已翻勾 + 当日日期 + 正文回到行首 + 归并注记成套」,
    // 缺任一项即红。真待办未被吞、内容与输入不同、文档本体未被碰这三条断言逐字未动。
    if (!/^- \[x\] ✅\(\d{4}-\d{2}-\d{2}\) \*\*D9 同一件事\*\*.*（\[归并\] 本行与已完成登记同题/m.test(written))
      throw new Error('写出的不是归并后的候选文本(副本行未翻勾)')
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

// ══ F10 折叠档:同一件事被并发取号登记成**不同编号**(2026-09-28 立)════════════
// 立项凭据(2026-09-28 现读 HEAD 面,同一把尺子 parseTaskRows × titleOf × keyOfRow):
// 同题而编号互异的族 **17 族 / 可折 23 行**,而 compositeKeyOf 对每一族都给不出相等的主键
// ⇒ F1/F2/F4/F4b 四条判据结构上全盲 ⇒ 这些行永久留在 `--open` 里,把守门 130 钉成
// "干净 HEAD 也红"(§12f:恒红门的唯一结局是各会话跳钩子、连带链上全部检查作废)。
// 这一档的风险全在"折完之后两把尺子各怎么读它",所以**成对**断言不可省:
// 正向证"折得对",反向证"判据有牙",再加一条端到端证"会自己提交的东西只推进 HEAD"。

/** 逐字取自 HEAD 面 PROJECT_PLAN.md 的一族(并发取号把同一件事登成 G-300 / G-317 两行,L11783/L12147)。 */
const TWIN_REAL = [
  '- [ ]G-300 `USDT_TRC20_ADDRESS` 仍空（**等机主给值**——它是平台自己的 USDT-TRC20 收款地址,不是第三方凭据,本机 7 份 env 备份里从未有过非空值;同族 `USDT_ERC20_ADDRESS` 早有值,说明这是机主掌握的信息)。不填的后果已定位:TRC20 那条下单路径拿不到地址即 fail,与 webhook 无关(webhook 的 secret 本批已填回)。',
  '- [ ]G-317 `USDT_TRC20_ADDRESS` 仍空（**等机主给值**——它是平台自己的 USDT-TRC20 收款地址,不是第三方凭据,本机 7 份 env 备份里从未有过非空值;同族 `USDT_ERC20_ADDRESS` 早有值,说明这是机主掌握的信息)。不填的后果已定位:TRC20 那条下单路径拿不到地址即 fail,与 webhook 无关(webhook 的 secret 本批已填回)。',
  '- [ ] G-301 **与上面两行不相干的另一件事**:一行都不许被顺手改动。',
].join('\n')

test('T17 折叠档纯函数:同题两号恰好折一条、第二遍零改动、编号相同与已带指针的族一律不碰', () => {
  const doc = [
    '- [ ] **G-11. 同一件事**:第一份登记,持有行。',
    '- [ ] **G-12. 同一件事**:并发取号抢到的另一个号,同一件事。',
    '- [ ] **G-13. 别的事**:与上面两行无关。',
  ].join('\n')
  const L = doc.split('\n')
  // 夹具自证:两行必须"题面逐字相等而编号互异",否则整条断言恒真(第一版就恒真过一次)
  if (titleOf(L[0]) !== titleOf(L[1])) throw new Error('夹具的题面不相等 ⇒ 测不到这一型')
  if (!keyOfRow(L[0]) || !keyOfRow(L[1])) throw new Error('夹具的编号不被 keyOfRow 认得 ⇒ 这一臂恒真,换形态而不是删断言')
  if (keyOfRow(L[0]) === keyOfRow(L[1])) throw new Error('夹具的编号没互异 ⇒ 这是 F1/F4 的地盘,不是 F10')
  const f = applyTwinFolds(doc, '2026-09-28')
  if (f.edits.length !== 1) throw new Error(`一族两行应恰好折 1 行,实测 ${f.edits.length}`)
  if (f.edits[0].line !== 2) throw new Error(`持有行必须是位置最靠前的 L1,实测折了 L${f.edits[0].line}`)
  if (f.text.split('\n')[0] !== L[0]) throw new Error('持有行被改动 ⇒ 一行都不许顺手改')
  if (f.text.split('\n')[2] !== L[2]) throw new Error('不相关行被改动')
  if (!/^- \[ \]/.test(f.edits[0].after)) throw new Error(`本档不得动勾选:${f.edits[0].after.slice(0, 20)}`)
  if (!isTwinFolded(f.edits[0].after)) throw new Error('产物必须被自家的形态判据认得(否则第二遍会重折)')
  if (stripTwinFold(f.edits[0].after) !== L[1]) throw new Error('剥掉本档注记后必须逐字回到底稿')
  // 幂等 —— 本票的全部价值就在这条上:union 会把没折的原件重新塞回来,所以折叠必须每次重跑,
  // 而"每次重跑"不产生新改动才算收敛(第二遍若还能折,post-commit 就是一台永动机)。
  const again = applyTwinFolds(f.text, '2026-09-28')
  if (again.edits.length !== 0 || again.text !== f.text) throw new Error(`第二遍必须零改动,实测 ${again.edits.length} 行`)
  // 反向对照 A:同题而**编号相同** ⇒ composite 相等 ⇒ 那是 F1/F4 那一维,本档不得插手(混维=两套翻勾判据互咬)
  const sameKey = foldTwins(['- [ ] **G-11. 同一件事**:甲。', '- [ ] **G-11. 同一件事**:乙。'], '2026-09-28')
  if (sameKey.edits.length !== 0) throw new Error(`编号相同的族被本档折了 ${sameKey.edits.length} 行 ⇒ 越界`)
  // 反向对照 B:族内已有一条带 F4 归并指针 ⇒ 不得再折(指针行是"已判定"的形状,持有行也不许被换)
  const ptr = foldTwins(
    [
      '- [ ] **G-11. 同一件事**:甲。',
      '- [ ] **G-12. 同一件事** 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记,派单以那条为准。〕',
    ],
    '2026-09-28',
  )
  if (ptr.edits.length !== 0) throw new Error('已带归并指针的族被重折 ⇒ 与 F4 那一维打架')
  // 反向对照 C:全组已完成 ⇒ 只点名不动手(翻勾与归档是别人的面),且**不得**记成"已修"
  const allDone = foldTwins(
    ['- [x] ✅(2026-09-20) **G-21. 全族已完成**:甲。', '- [x] ✅(2026-09-21) **G-22. 全族已完成**:乙。'],
    '2026-09-28',
  )
  if (allDone.edits.length !== 0 || !allDone.undetermined.join().includes('已完成'))
    throw new Error(`全已完成族必须"零改动 + 点名未判定",实测 edits=${allDone.edits.length} und=${JSON.stringify(allDone.undetermined)}`)
  // 反向对照 D:组内行数超上限 ⇒ 不猜持有行(噪声与真事故都要人来判)
  const big = foldTwins(
    Array.from({ length: __test__.TWIN_GROUP_MAX + 1 }, (_, i) => `- [ ] **G-${100 + i}. 超上限族**:同一件事第 ${i} 份。`),
    '2026-09-28',
  )
  if (big.edits.length !== 0 || !big.undetermined.join().includes('上限'))
    throw new Error(`超上限族必须整组交人工,实测 edits=${big.edits.length}`)
})

test('T18 摘号一律喂真尺子,并配"把编号写进指针"的正对照;守门 71 的两把判据必须不受影响', () => {
  const f = applyTwinFolds(TWIN_REAL, '2026-09-28')
  if (f.edits.length !== 1) throw new Error(`逐字真档夹具应折 1 行,实测 ${f.edits.length} ⇒ 夹具与判据已漂开`)
  const after = f.edits[0].after
  // ① 摘号的真判据(2026-09-29 换):旧写法断言 `keyOfRow(after) === null`,而那身隐形来自索引层
  //    "括注把编号推出 48 字窗口"的缺陷 —— 同一缺陷当天让 39 个已用号看起来空闲,lib 修好后它必然现形。
  //    现在喂的还是**索引层那一份**尺子,判的换成可证的两条:主键不得被换成别人的号 ∧ 指针族必须在场。
  const kAfter = keyOfRow(after)
  if (kAfter !== null && kAfter !== keyOfRow(f.edits[0].before))
    throw new Error(`折叠后主键换成 ${String(kAfter)}(折前主键 ${String(keyOfRow(f.edits[0].before))})⇒ 这一折给本行改了身份`)
  if (!DUP_POINTER_RE.test(after)) throw new Error('折叠行不含【归并】重复登记副本 ⇒ 不会被派单口径逐出')
  if (compositeBlind(after, TWIN_REAL.split('\n')[0]) !== true)
    throw new Error('折叠行必须已退出 composite 口径的活动副本计数(否则 F4 会来重标它)')
  // ② 正对照:把编号写进指针的 48 字符窗口 ⇒ 真尺子**必须**取到键。
  //    少了这一臂,上面那条 null 就只是同义反复(今天真犯过:指针里写了持有行的编号且落在窗口内,
  //    于是"折掉一条副本"反而给账面新增一次撞号)。
  const poisoned = f.edits[0].before.replace(/^- \[ \] */, '- [ ] （【归并】副本·持有行 G-999）')
  if (keyOfRow(poisoned) === null) throw new Error('正对照失效:编号写进窗口内尺子竟取不到 ⇒ 这条断言没有牙')
  if (!(twinFoldRejectReason(f.edits[0].before, poisoned) || '').includes('主键'))
    throw new Error(`拒折判据必须点名"折完仍有主键",实得:${twinFoldRejectReason(f.edits[0].before, poisoned)}`)
  // ③ 守门 71 侧:注记包在全角括号里 ⇒ `checkboxBody` 剥得掉 ⇒ "行首名额"与"标记"都不受任何影响。
  //    这条不对称是本档的落点:换成 `〔〕`(F4 与旧一次性折叠用的那对)就会与回捞层互咬 ——
  //    防丢层把合法折叠读成"整行消失"⇒ post-commit 塞回未折叠原件 ⇒ 折叠被原地复活(G-307 同型)。
  if (headIdOf(f.edits[0].before) !== headIdOf(after))
    throw new Error(`门 71 的"行首名额"被折叠改变了:${headIdOf(f.edits[0].before)}→${headIdOf(after)} ⇒ 会与回捞层互咬`)
  if (markerOf(f.edits[0].before) !== markerOf(after))
    throw new Error(`门 71 的整行标记被折叠改变了:${JSON.stringify(markerOf(f.edits[0].before))}→${JSON.stringify(markerOf(after))}`)
  if (lostMarkers(TWIN_REAL, f.text).length !== 0)
    throw new Error(`折叠后被判"整行消失"的登记行 ${lostMarkers(TWIN_REAL, f.text).length} 处 ⇒ 拒落是对的,这里却红了`)
  const setOf = (s) => [...headIdSet(s)].sort().join(',')
  if (setOf(TWIN_REAL) !== setOf(f.text)) throw new Error(`整档行首编号集合发生变化:${setOf(TWIN_REAL)} → ${setOf(f.text)}`)
  // ④ 派单口径:折掉的行必须被 `DUP_POINTER_RE` 认出并逐出 --open(否则"摘号"只是换个地方挂账)
  if (!DUP_POINTER_RE.test(after)) throw new Error('折叠行不含【归并】重复登记副本 ⇒ 不会被派单口径逐出')
  const c0 = auditPlan(TWIN_REAL).counts
  const c1 = auditPlan(f.text).counts
  if (c0.open !== c1.open) throw new Error(`本档不删行不改勾选,未勾选数却从 ${c0.open} 变成 ${c1.open}`)
  if (!(c1.claimable < c0.claimable)) throw new Error(`派单口径没缩小(${c0.claimable}→${c1.claimable})⇒ 折叠对派单无效,这一票就白做`)
})

/**
 * composite 口径下这行是否已退出"活动副本"计数。
 * 旧义是"给不出 composite 键 ⇒ 隐形",那身隐形来自索引层装饰档漏算的缺陷,lib 修好后恒假。
 * 现判可证的那一条:F4 按 编号+题面 分组 —— 折叠行保留**自己的**编号 ⇒ 与持有行不成组;
 * 而"不再算一条活待办"由 DUP_POINTER 过滤负责(① 与 ④ 分别钉住)。共享 composite 键 = 没摘干净。
 */
function compositeBlind(line, keeperLine) {
  const c = compositeKeyOf(line)
  if (!c) return true
  return c !== compositeKeyOf(keeperLine)
}

test('T19 零损失断言必须拒落:四种"会被误判"的场景各自点名,一条都不许静默通过', () => {
  const doc = TWIN_REAL
  const f = applyTwinFolds(doc, '2026-09-28')
  // (a) 行号在落地前挪位(并发 append 是本仓的常态):声明的 before 对不上 ⇒ 整批不落
  const shifted = '# 新塞进来的一行标题\n' + doc
  const pa = verifyTwinFold(shifted, shifted, f.edits, f.refused).problems
  if (!pa.some((x) => x.includes('before'))) throw new Error(`底稿不等必须被点名:${JSON.stringify(pa)}`)
  // (b) 偷偷改了一行没声明的:结构等值(新内容 == 前缀 ⊕ 本行 ⊕ 后缀)不成立
  const tampered = f.text.replace('- [ ] G-301 **与上面两行不相干的另一件事**:一行都不许被顺手改动。', '- [ ] G-301 被改掉了')
  const pb = verifyTwinFold(doc, tampered, f.edits, f.refused).problems
  if (!pb.some((x) => x.includes('未登记'))) throw new Error(`未登记改动必须被点名:${JSON.stringify(pb)}`)
  // (c) 产物本身有害(编号写进了 48 字符窗口):同一处位置、同样一行不删,零损失断言仍必须炸
  const badAfter = f.edits[0].before.replace(/^- \[ \]*/, '- [ ] （【归并】副本·持有行 G-999）')
  const badEdits = [{ ...f.edits[0], after: badAfter }]
  const badText = doc.split('\n').map((l, i) => (i === f.edits[0].line - 1 ? badAfter : l)).join('\n')
  const pc = verifyTwinFold(doc, badText, badEdits, f.refused).problems
  if (!pc.some((x) => x.includes('主键'))) throw new Error(`"折完仍有主键"必须炸:${JSON.stringify(pc)}`)
  // (d) 取不到整档 ⇒ 判"未判定",不得当成"没有债"(这是本仓最高频的失效方向)
  const pd = verifyTwinFold(doc, undefined, f.edits, []).problems
  if (!pd.some((x) => x.includes('未判定'))) throw new Error(`入参不是整档文本必须判未判定:${JSON.stringify(pd)}`)
  if (applyTwinFoldsSafe(undefined) !== 'throw') throw new Error('applyTwinFolds 拿到非字符串必须抛错,不得 String(undefined) 造一份单行假文档')
  // (e) 可逆性哨兵:标题里本来就带「…」的族是 HEAD 面实测形态(19 条里 4 条如此)。
  //     非贪婪的剥取会停在标题内部那个 `」` ⇒ 把**合法**折叠误判成"不可逆"而永久拒绝,
  //     那一族就再也没有出口。这一臂钉的是"误拒"方向 —— 与上面四条同为有牙断言。
  const qDoc = [
    '- [ ] G-1 **桌面端「启动后先进托盘」**:甲,持有行。',
    '- [ ] G-2 **桌面端「启动后先进托盘」**:乙,同一件事的另一个编号。',
  ].join('\n')
  if (!titleOf(qDoc.split('\n')[0]).includes('」')) throw new Error('夹具的题面没含「」⇒ 这一臂恒真,换形态而不是删断言')
  const q = applyTwinFolds(qDoc, '2026-09-28')
  if (q.edits.length !== 1 || q.refused.length !== 0)
    throw new Error(`题面含「」的族必须折得下来,实测 edits=${q.edits.length} refused=${JSON.stringify(q.refused.map((r) => r.reason))}`)
  if (stripTwinFold(q.edits[0].after) !== qDoc.split('\n')[1]) throw new Error('贪婪哨兵剥回来的不是底稿 ⇒ 可逆性只是看起来成立')
  if (verifyTwinFold(qDoc, q.text, q.edits, q.refused).problems.length)
    throw new Error(`正当折叠被零损失断言误拒:${JSON.stringify(verifyTwinFold(qDoc, q.text, q.edits, q.refused).problems)}`)
  // (f) 反向:正文里**本来就**有同款留痕的行不得再折(哨兵会过剥 ⇒ 不可逆 ⇒ 必须拒)
  const twice = q.edits[0].after
  if (twinFoldRejectReason(stripTwinFold(twice), buildTwinFold(twice, qDoc.split('\n')[0], '2026-09-28') ?? '') === null)
    throw new Error('对已带留痕的行再折一次必须被拒 —— 两次注记叠在一行上等于伪造底稿')
})

function applyTwinFoldsSafe(x) {
  try {
    applyTwinFolds(x, '2026-09-28')
    return 'no-throw'
  } catch {
    return 'throw'
  }
}

test('T20 端到端(独立仓)--fold-twins --commit:产出一枚只含台账的提交,再跑一遍零提交且不改工作树', () => {
  const plan = ['# 计划', '', ...TWIN_REAL.split('\n'), ''].join('\n')
  const env = fixtureRepo(plan, 'fixture: 同一件事被并发取号登成两行(G-300/G-317)')
  try {
    const report = runCli(env, ['--fold-twins'])
    if (report.code !== 0) throw new Error(`报告档应 exit 0,实得 ${report.code}:${report.out}`)
    if (!/拟折 1 行/.test(report.out)) throw new Error(`报告档没数对三态:${report.out}`)
    if (countCommits(env.dir) !== 1) throw new Error('报告档写盘了 —— 未加 --commit 必须一行不改')
    if (report.added.length !== 0) throw new Error(`报告档留下文件 ${JSON.stringify(report.added)}`)
    const r = runCli(env, ['--fold-twins', '--commit'])
    if (r.code !== 0) throw new Error(`落地档应 exit 0,实得 ${r.code}:${r.out}`)
    if (!/折叠档落地/.test(r.out)) throw new Error(`输出未点名落地:${r.out.trim()}`)
    const head = gitQ(env.dir, ['show', 'HEAD:PROJECT_PLAN.md'])
    const lines = head.split(/\r?\n/)
    const kept = lines.find((l) => l.includes('G-300 `USDT_TRC20_ADDRESS`'))
    const folded = lines.find((l) => isTwinFolded(l))
    if (!kept || keyOfRow(kept) !== 'G-300') throw new Error(`持有行必须还是带号的 G-300:${JSON.stringify(kept && kept.slice(0, 60))}`)
    if (!folded) throw new Error('HEAD 里找不到折叠档 ⇒ 落地没生效(而输出却说成功了)')
    if (keyOfRow(folded) !== headIdOf(folded))
      throw new Error(
        `落地面折叠行的主键不再是它自己的行首号:${keyOfRow(folded)} vs ${headIdOf(folded)}(隐形已从判据里退出,逐出派单靠指针)`,
      )
    if (!DUP_POINTER_RE.test(folded)) throw new Error('落地面折叠行缺【归并】重复登记副本指针 ⇒ 派单口径不会逐出它')
    if (!/^- \[ \]/.test(folded)) throw new Error(`折叠行勾被翻了:${folded.slice(0, 20)}`)
    if (!/\(原编号 G-317;持有行题面「.*」\)$/.test(folded))
      throw new Error('折叠行必须在**行尾**留原编号沿革(否则日后无人查得到它原来是谁,而沿革写进窗口就会被取成自己的主键)')
    if (stripTwinFold(folded) !== TWIN_REAL.split('\n')[1]) throw new Error('HEAD 面上的折叠档剥回注记后不等于原件')
    if (lostMarkers(plan, head).length !== 0) throw new Error(`落地后被门 71 判为消失的登记行 ${lostMarkers(plan, head).length} 处 ⇒ 会与回捞层互咬`)
    if (lines.length !== plan.split('\n').length) throw new Error(`行数变了 ${plan.split('\n').length}→${lines.length}(本档只许改行内内容)`)
    const paths = gitQ(env.dir, ['show', '--name-only', '--format=', 'HEAD']).trim().split('\n').filter(Boolean)
    if (paths.length !== 1 || paths[0] !== 'PROJECT_PLAN.md') throw new Error(`提交含意外路径:${JSON.stringify(paths)}`)
    if (countCommits(env.dir) !== 2) throw new Error('提交总数应为 2(fixture + 折叠)')
    if (readFileSync(path.join(env.dir, 'PROJECT_PLAN.md'), 'utf8') !== plan)
      throw new Error('工作树副本被折叠档改写 ⇒ 越权(并发会话的盘不是我的输出面)')
    const again = runCli(env, ['--fold-twins', '--commit'])
    if (again.code !== 0 || !/无可折/.test(again.out)) throw new Error(`第二遍应判"无可折":${again.out.trim()}`)
    if (countCommits(env.dir) !== 2) throw new Error('幂等失败:第二遍又产出了一枚提交')
  } finally {
    rmScratch(env.dir)
  }
})

test('T21 端到端 --heal --commit 现在也执行这一维,且与翻勾那一维互不打架(向后兼容)', () => {
  const plan = [
    '# 计划',
    '',
    '- [x] ✅(2026-09-20) **D9 同一件事**:做完了。',
    '- [ ] **D9 同一件事**:另一侧还挂着未勾。',
    '- [ ] **D8 真待办**:还没人做。',
    '- [ ] **G-41. 孪生登记**:第一份登记,持有行。',
    '- [ ] **G-42. 孪生登记**:同一件事,并发取号取了另一个号。',
    '',
  ].join('\n')
  /**
   * 夹具自证(本条连踩两次):① 编号必须被**真尺子**认得出,② 题面必须过 `compositeKeyOf`
   * 那道 ≥4 字的闸 —— 两条任一不满足,foldTwins 都会把整族当"看不见"跳过,于是这条端到端
   * 断言恒真地"通过",而 --heal 那一维其实一行都没折(判据失效的表现永远是安静)。
   */
  const twinPair = plan.split('\n').filter((l) => /孪生登记/.test(l))
  if (twinPair.length !== 2) throw new Error('夹具的孪生对没成对')
  for (const l of twinPair) if (keyOfRow(l) === null) throw new Error(`夹具的编号不被 keyOfRow 认得 ⇒ 这一臂恒真:${l.slice(0, 30)}`)
  if (titleOf(twinPair[0]) !== titleOf(twinPair[1])) throw new Error('夹具的两行题面不相等 ⇒ 测不到这一型')
  if ((titleOf(twinPair[0]) ?? '').length < 4) throw new Error('题面短于尺子的 ≥4 字闸 ⇒ 夹具恒真,加长题面而不是删断言')
  const env = fixtureRepo(plan, 'fixture: 一条 F1 分叉 + 一对同题不同编号的孪生待办')
  try {
    const r = runHeal(env)
    if (r.code !== 0) throw new Error(`自愈应 exit 0,实得 ${r.code}:${r.out}`)
    if (!/自愈落地/.test(r.out)) throw new Error(`输出未点名落地:${r.out.trim()}`)
    const head = gitQ(env.dir, ['show', 'HEAD:PROJECT_PLAN.md'])
    // 两维同一枚提交:F1 翻了勾,F10 折了副本 —— 只应有一枚提交
    if (countCommits(env.dir) !== 2) throw new Error(`两维应合到一枚提交里,实测提交数 ${countCommits(env.dir)}`)
    if (!/\[归并\]/.test(head)) throw new Error('F1 那一维没做(向后兼容破了)')
    const folded = head.split(/\r?\n/).find((l) => isTwinFolded(l))
    if (!folded) throw new Error('F10 这一维没随 --heal 一起执行 ⇒ 早退判据或调度漏了它')
    if (keyOfRow(folded) !== 'G-42')
      throw new Error(`F10 落地面折叠行的主键不再是它自己那个号:实得 ${String(keyOfRow(folded))}`)
    if (!DUP_POINTER_RE.test(folded)) throw new Error('F10 落地面折叠行缺副本指针 ⇒ --open 仍会把它算一条活')
    if (!/^- \[ \]/.test(folded)) throw new Error('两维打架:折叠行动了勾选')
    if (!head.includes('- [ ] **D8 真待办**:还没人做。')) throw new Error('真待办被误动')
    if (head.split(/\r?\n/).length !== plan.split('\n').length) throw new Error('行数变了(两维都只许改行内内容)')
    const second = runHeal(env)
    if (second.code !== 0 || !/无状态分叉/.test(second.out)) throw new Error(`第二遍应判"无需自愈":${second.out.trim()}`)
    if (countCommits(env.dir) !== 2) throw new Error('幂等失败:第二遍又产出提交')
  } finally {
    rmScratch(env.dir)
  }
})

test('T22 源级反向锁:指针构造里没有行号也没有编号,没有豁免清单,落地只走 bypass-git 那一份 plumbing', () => {
  const src = readFileSync(new URL('../plan-tasks-merge.mjs', import.meta.url), 'utf8')
  const seg = (from, to) => {
    const i = src.indexOf(from)
    if (i < 0) throw new Error(`源里找不到 ${from} —— 结构被改名,这条锁正在无声失效`)
    const j = to ? src.indexOf(to, i) : src.length
    return src.slice(i, j < 0 ? src.length : j)
  }
  const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  // ① 构造折叠行的那一段(注记 + 行尾沿革)剥掉散文后,既不得出现行号锚,也不得出现任何编号字面量
  const build = decomment(seg('export function twinFoldNote', '/** 剥掉**本档**写的注记'))
  if (/\bL\d{1,6}\b/.test(build)) throw new Error('折叠行的构造里出现了行号锚(§1 规矩 3:行号在任何一次 append 后都会挪位)')
  if (/[A-Za-z]{1,3}-\d{1,5}\b/.test(build.replace(/\d{4}-\d{2}-\d{2}/g, '')))
    throw new Error('折叠行的构造里出现了编号字面量 ⇒ 指针会把副本自己的主键重新领回来')
  const note = twinFoldNote('2026-09-28')
  if (/[A-Za-z]{1,3}-\d{1,5}/.test(note.replace(/\d{4}-\d{2}-\d{2}/g, ''))) throw new Error(`注记里含编号形态:${note}`)
  if (/\bL\d{1,6}\b/.test(note)) throw new Error(`注记里含行号:${note}`)
  if (/[）)]/.test(note.slice(1, -1))) throw new Error('注记内部出现闭括号 ⇒ 全角括号不再是"一行一个括号",门 71 的剥取会失败')
  if (!note.startsWith('（') || !note.endsWith('）')) throw new Error('注记必须整体包在全角括号里(门 71 只剥这一族装饰)')
  // ② 没有豁免清单、没有硬编码编号:整段判据不得引用 archive 豁免通道或任何 id 名单
  if (/archivedCopy|archiveExemptFor|dropArchivedLost/.test(seg('export function foldTwins', 'export function verifyTwinFold')))
    throw new Error('折叠档用归档豁免通道绕过门 71 ⇒ 那是"先写再说",本票要求把形状做对而不是把看守买通')
  // ③ 落地只走 lib/bypass-git 那一份 plumbing,且绝不出现"整仓 reset / 改工作树"
  const land = seg('export function twinFoldAndLand', 'export function healAndLand')
  for (const need of ['commitTreeWithIndex', 'casUpdateRef', 'alignSharedIndex', 'catBatch'])
    if (!land.includes(need)) throw new Error(`落地档没引 ${need} —— 自己拼 git 命令读内容会被守门 118 判面不符,也不满足"每次 CAS 前重读 HEAD"`)
  if (/git[^\n]*(checkout|reset\s+--hard|reset HEAD)/.test(land)) throw new Error('落地档动了共享工作树/全局 reset —— 越权')
  if (/writeFileSync\([^)]*PROJECT_PLAN/.test(land)) throw new Error('落地档直接写台账文件 —— 必须走对象空间')
  // ④ 调度必须真的在:CLI 开关 + --heal 那一路真的调了这一维 + 闭合断言挂在停手判据里
  if (!/has\('--fold-twins'\)/.test(src)) throw new Error("CLI 没解析 --fold-twins —— 函数在而入口不在")
  if (!/return twinFoldAndLand\(\)/.test(src)) throw new Error('--fold-twins --commit 没真的调落地函数')
  const heal = seg('export function healAndLand', 'export function dedupeAndLand')
  if (!heal.includes('applyTwinFolds') || !heal.includes('verifyTwinFold')) throw new Error('--heal 那一路没接折叠维(只接了一半就是账面全绿而活还在)')
  if (!seg('export function healStopReasons').includes('折叠维未闭合')) throw new Error('闭合断言没挂进 healStopReasons —— 谁忘记调 verifyTwinFold 就无声变绿')
})

test('A3 --fold-twins 的三态输出必须分开打,判不出不得被写成通过', () => {
  const env = fixtureRepo(
    [
      '# 计划',
      '',
      '- [x] ✅(2026-09-20) **G-31. 全族已完成**:甲。',
      '- [x] ✅(2026-09-21) **G-32. 全族已完成**:乙。',
      '',
    ].join('\n'),
    'fixture: 一对同题不同编号但都已完成的登记',
  )
  try {
    const r = runCli(env, ['--fold-twins'])
    if (r.code !== 0) throw new Error(`报告档应 exit 0,实得 ${r.code}:${r.out}`)
    if (!/判不出 1 条/.test(r.out)) throw new Error(`未判定必须逐条点名:${r.out}`)
    if (/F10 = 0 成员/.test(r.out)) throw new Error('把"判不出"打成"无成员"= 把未判定记成通过')
    if (/拟折 [1-9]/.test(r.out)) throw new Error('全已完成的一族被折了 ⇒ 两维互咬')
    if (countCommits(env.dir) !== 1 || r.added.length !== 0) throw new Error('报告档写了东西')
    // 白名单必须认这一枚旗标(A1 同族口径):否则 --fold-twins 会被 inspectArgs 拒成 exit 2,
    // 而"入口在、白名单不在"这一型在账面上表现为"命令不存在",读的人没有任何线索去查为什么。
    if (!KNOWN_FLAGS.includes('--fold-twins')) throw new Error('--fold-twins 不在 KNOWN_FLAGS 里 ⇒ 会被拒成 exit 2')
  } finally {
    rmScratch(env.dir)
  }
})

/**
 * T23 接线锁(源码级)。为什么行为测试不够:`pointerVisibilityRegression` 是差值护栏,
 * 它写在文件里而**两处落地闸没调它**时,行为测试照样绿(函数自己会算),提交链却一路放行
 * "把一族最后一个代表标上指针"的归并 —— 守门 70/76/81/115 记过多次的同一型。
 * 取号旗标也在这里钉:旗标进了分支而没进 KNOWN_FLAGS 会被 inspectArgs 拒成 exit 2,
 * 症状是"命令不存在",而没人会去查白名单。
 */
test('T23 差值护栏必须挂在两处落地闸上,恢复旗标必须在白名单里', () => {
  const src = readFileSync(path.resolve(ROOT, 'scripts', 'plan-tasks-merge.mjs'), 'utf8')
  const body = (name) => {
    const at = src.indexOf(`export function ${name}(`)
    if (at < 0) throw new Error(`找不到 ${name}(改名要同步本锁)`)
    const next = src.indexOf('\nexport ', at + 1)
    return src.slice(at, next < 0 ? src.length : next)
  }
  for (const fn of ['healStopReasons', 'verifyMerge'])
    if (!/pointerVisibilityRegression\(/.test(body(fn)))
      throw new Error(`${fn} 没调用差值护栏 ⇒ 提交链上等于没有这条判据`)
  if (!KNOWN_FLAGS.includes('--restore-terminals'))
    throw new Error('--restore-terminals 不在 KNOWN_FLAGS ⇒ 会被 inspectArgs 拒成"命令不存在"')
  // 兜底键必须走剥注记那一份实现;回到行内正则就等于让 97 行不同任务并成一个假族
  const audit = body('auditPointerTerminals')
  if (!/stripMergeNotes\(/.test(audit))
    throw new Error('auditPointerTerminals 的兜底键不再剥注记 ⇒ 假族回来(编号取不回、二层失明)')
  // 走权威入口再量一次判据本身(§"验判据必须走权威入口"):源码里写了调用点不等于判据算得对,
  // 两头都要钉 —— 上一枚提交就是因为只钉了文字而把一条恒不成立的断言当成交付。
  const GK = ' 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'
  const oneLive = ['- [ ] G-910. 活。', `- [ ] G-910. 活。${GK}`].join('\n')
  const allPointed = [`- [ ] G-910. 活。${GK}`, `- [ ] G-910. 活。${GK}`].join('\n')
  if (pointerVisibilityRegression(oneLive, allPointed) === null)
    throw new Error('抹掉一族唯一代表的改动必须被差值护栏点名 —— 它不点名就等于这条判据不存在')
  if (pointerVisibilityRegression(oneLive, `${oneLive}\n- [ ] G-911. 另一件新登记`) !== null)
    throw new Error('没有弄丢任何代表的改动不得被护栏拦(拦正当动作 = 逼下一个人跳门)')
})

/**
 * T24 端到端(独立仓):恢复档三态各钉一次。
 *  报告档 ⇒ 零写盘、零提交、必须点名那一族;
 *  落地档 ⇒ 一枚只含台账的提交,落地面该行不再带指针、该族不再隐形;
 *  复跑 ⇒ 0 edits(幂等),再落一枚空提交就是"跑过一次就算修好"的反面。
 * 另配一条**拒绝臂**:裸形态(无闭符)那一族一行都不许动,且退出码仍为 0(少做一件事不是错)。
 */
test('T24 端到端 --restore-terminals:报告零写盘、落地真的把该族救回派单、复跑幂等、裸形态拒动', () => {
  const NOTE =
    ' 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'
  const L = '- [ ] G-900. 被两行互指遮住的活:题面在注记之前。'
  const plan = ['# 计划', '', `${L}${NOTE}`, `${L}${NOTE}`, ''].join('\n')
  const env = fixtureRepo(plan, 'fixture: 一族两行全部带副本指针 ⇒ 对派单彻底隐形')
  try {
    const a0 = auditPointerTerminals(plan)
    if (a0.hiddenFamilies !== 1) throw new Error(`夹具本身没造出隐形族(hidden=${a0.hiddenFamilies})⇒ 本锁无牙`)
    const report = runCli(env, ['--restore-terminals'])
    if (report.code !== 0) throw new Error(`报告档应 exit 0,实得 ${report.code}:${report.out}`)
    if (!/可自动恢复 1 行/.test(report.out))
      throw new Error(`报告档没数对:${report.out.trim().slice(0, 160)}`)
    if (countCommits(env.dir) !== 1) throw new Error('报告档写盘了')
    if (report.added.length !== 0) throw new Error(`报告档留下文件 ${JSON.stringify(report.added)}`)
    const land = runCli(env, ['--restore-terminals', '--commit'])
    if (land.code !== 0) throw new Error(`落地档应 exit 0,实得 ${land.code}:${land.out}`)
    if (!/恢复档落地/.test(land.out)) throw new Error(`输出未点名落地:${land.out.trim().slice(0, 200)}`)
    if (countCommits(env.dir) !== 2) throw new Error(`落地档应只多一枚提交,实得 ${countCommits(env.dir)}`)
    const files = gitQ(env.dir, ['show', '--name-only', '--format=', 'HEAD']).split(/\r?\n/).filter(Boolean)
    if (files.length !== 1 || files[0] !== 'PROJECT_PLAN.md')
      throw new Error(`落地提交含别人的路径:${JSON.stringify(files)}`)
    const head = gitQ(env.dir, ['show', 'HEAD:PROJECT_PLAN.md'])
    if (auditPointerTerminals(head).hiddenFamilies !== 0)
      throw new Error(`落地后仍被判隐形(而输出说成功了):${head.split(/\r?\n/)[2]}`)
    const again = runCli(env, ['--restore-terminals', '--commit'])
    if (countCommits(env.dir) !== 2) throw new Error(`复跑又落了一枚 ⇒ 幂等失败:${again.out.trim().slice(0, 160)}`)
    if (!/无可自动恢复/.test(again.out)) throw new Error(`复跑应明说没事可做:${again.out.trim().slice(0, 160)}`)
    // 拒绝臂:裸形态一行都不许动
    const BARE = '- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L7 重复。本行不进派单口径。'
    const env2 = fixtureRepo([BARE, BARE, ''].join('\n'), 'fixture: 裸形态注记(无闭符)')
    try {
      const r2 = runCli(env2, ['--restore-terminals', '--commit'])
      if (r2.code !== 0) throw new Error(`拒落应仍 exit 0(少做一件事不是错),实得 ${r2.code}`)
      if (countCommits(env2.dir) !== 1) throw new Error(`裸形态被动了 ⇒ 按行尾剥会吃作者正文:${r2.out.slice(0, 160)}`)
      if (!/结构边界/.test(r2.out)) throw new Error(`拒绝必须点名理由:${r2.out.trim().slice(0, 200)}`)
    } finally {
      rmScratch(env2.dir)
    }
  } finally {
    rmScratch(env.dir)
  }
})

/**
 * T25 剥除器的安全性:注记里套同种括号必须按**深度配平**走完,不能停在第一个闭符;
 * 注记后面紧跟的作者正文必须逐字留下(真仓有 3 处 `〔进展@…〕` 就写在注记之后)。
 * 这一条是恢复动作唯一的"不吃正文"证明,少了它整个出口就是不可审计的。
 */
test('T25 stripMergeNotes:嵌套同种括号配平、尾随作者正文逐字保留、裸形态与未闭合一律拒绝', () => {
  const nested = '- [ ] G-901. 活。〔【归并】重复登记副本(2026-09-28):逐字相同的另一条登记 (与本行正文逐字相同,可按正文检索),派单以那条为准。〕'
  const s1 = stripMergeNotes(nested)
  if (s1.refused || s1.text !== '- [ ] G-901. 活。')
    throw new Error(`嵌套半角括号必须走配平,实测 refused=${s1.refused} text=${JSON.stringify(s1.text)}`)
  const trailed = nested + '〔进展@2026-09-28/主会话:这条是作者自己写的,一个字都不许动〕'
  const s2 = stripMergeNotes(trailed)
  if (!s2.text.endsWith('〔进展@2026-09-28/主会话:这条是作者自己写的,一个字都不许动〕'))
    throw new Error(`尾随的作者正文被吞了:${JSON.stringify(s2.text)}`)
  const bare = stripMergeNotes('- [ ] **[归并]** 【归并】重复登记副本:本行与同标题登记 L7 重复。')
  if (!bare.refused) throw new Error('裸形态(无开括号紧贴)必须 refused,不许按行尾剥')
  const unclosed = stripMergeNotes('- [ ] G-902. 活。〔【归并】重复登记副本(2026-09-28):没有闭符')
  if (!unclosed.refused) throw new Error('未闭合必须 refused —— 猜行尾就是猜作者的正文边界')
  const r = restoreMergeNote(trailed)
  if (r.text === undefined || !/进展@/.test(r.text) || DUP_POINTER_RE.test(r.text))
    throw new Error(`恢复单行必须只剥副本注记并留下进展,实测 ${JSON.stringify(r)}`)
  if (restoreMergeNote('- [ ] 本来就干净的行').text !== undefined)
    throw new Error('不带指针的行不得被当成恢复对象')
  if (buildRestoreTerminals('# 标题\n\n- [ ] 只有一行且不带指针\n').edits.length !== 0)
    throw new Error('没有隐形族时不得凭空造出改动')
  const bad = buildRestoreTerminals(
    ['- [ ] G-903. 活。', '- [ ] G-903. 活。 〔【归并】重复登记副本(2026-09-28):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'].join('\n'),
  )
  if (verifyRestoreTerminals(bad.text, bad.text.replace('G-903. 活。', 'G-903. 活了'), bad.edits).problems.length === 0)
    throw new Error('零损失对账必须拒绝"顺手改正文"')
})

/**
 * T26 G-341 —— 同一次运行里,抬头读数与交付校验读数必须是**同一个数**,且结论行点名判定面。
 *
 * 立因(票面原文):`--heal`(纯报告档)曾在同一次运行、同一个判定面(HEAD blob)上喊出两个
 * "可自动收口"—— 抬头 `F3 220 处(其中可自动收口 2 …)`,末行交付校验拒绝落地时
 * `F3(可自动收口)未归零:4 处`,而落地闸用的是后一个。成因是两处**各算一遍**:报告侧算
 * `audit(输入面)`、校验侧算 `audit(归并后)`,同一个名字挂了两把尺子。
 *
 * 为什么这条用例必须住在镜像而不是只住在 `--self-test`:§22c —— 提交链与 CI 跑的是
 * `node --test`,只锁自检档等于"revert 掉本次修复也能过 CI"。
 *
 * 钉住的不变量(四条,缺一不可,少任何一条这条用例就退化成恒真):
 *  ① 夹具必须**真的发散**:归并前 `rotatedAuto` ≠ 归并后 —— 否则"两个数相等"可以由"两个 0"冒充;
 *  ② 抬头那一行报的"可自动收口"数字 === 落地闸所判的那个数字(`verifyMerge().f3.auto`),
 *     两者都取自唯一出口 `f3Reading()` 返回的**同一份结果**;
 *  ③ 交付校验那条红(非零时)报的数字与抬头同源 —— 用"归并后仍有 1 处"的那一档量,
 *     使两处都被迫读同一个字段才可能相等;
 *  ④ 判定面必须随读数一起喊出来:点了面 ⇒ 逐字带那个名字;没点面 ⇒ 老实说"未判定",
 *     绝不冒充某个面(与本仓其它台账器同一条口径)。
 */
test('T26 G-341 抬头读数与交付校验读数必须相等,且结论行点名判定面', () => {
  // 夹具逐字取自本文件 T11 那条已验牙的形态:指针行与它指向的行**同复合主键**(可自动收口那一型),
  // 另带一条"无出口"的 ref 族行(不得被自动改),使归并后 auto 归零而 noExit 仍在。
  const dupLine =
    '- [ ] **D7 甲事**:还没人做。 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记在 L4,派单以那条为准。〕'
  const src = [
    '# 计划',
    '',
    dupLine,
    '- [ ] **D7 甲事**:还没人做。',
    '- [ ] **D8 乙事**:说明。 〔另见 L9 的那一条。〕',
    '',
  ].join('\n')
  setRunFace('head')
  try {
    const r = buildMerge(src, '2026-09-28')
    const v = verifyMerge(src, r.text, r.changed)
    // ① 发散前提:归并前 1 处、归并后 0 处。夹具若不再发散,②就失去对象 —— 当场点名而不是沉默。
    if (v.f3.before.rotatedAuto !== 1 || v.f3.auto !== 0)
      throw new Error(
        `夹具不再发散(归并前 auto=${v.f3.before.rotatedAuto}、归并后 auto=${v.f3.auto})⇒ 本用例退化成"两个 0 相等"的恒真式,换形态而不是删断言`,
      )
    // ② 抬头那一行的数字必须等于落地闸所判的那个数字
    const head = v.f3.headClause()
    const m = /可自动收口\s*(\d+)\s*处/.exec(head)
    if (!m)
      throw new Error(
        `抬头行不再报"可自动收口 N 处"这一档 ⇒ 本用例失去对象(改名要同步本锁):${head.slice(0, 160)}`,
      )
    if (Number(m[1]) !== v.f3.auto)
      throw new Error(
        `同一次运行给出两个"可自动收口":抬头 ${m[1]} 处 / 交付校验 ${v.f3.auto} 处 —— 正是 G-341 的病根,读数必须出自 f3Reading() 的同一份结果`,
      )
    // ②b 反方向:归并已把可收口那一族修完 ⇒ 那道红**不得**响。它响了就等于闸读回了输入面
    // (与②同一条不变量的另一侧 —— 只测一侧,把读数换成 before 也能"看起来相等"地糊过去)。
    if (v.problems.some((x) => /F3\(可自动收口\)/.test(x)))
      throw new Error(
        `正当归并已把可收口族修完(auto=${v.f3.auto}),交付校验却仍报 F3 红:${JSON.stringify(v.problems)}`,
      )
    // 归并前那份仍要在(信息不藏),但它只能顶着"归并前基线"的名字出现
    if (!/归并前基线 1 处/.test(head))
      throw new Error(`归并前那一份读数被藏掉了(不得为了凑相等而少报):${head.slice(0, 200)}`)
    // ③ 交付校验那条红的数字与抬头同源:换一档"归并后仍剩 1 处"(merged=src,即什么都没修)来量
    const stuck = verifyMerge(src, src, [])
    const gp = stuck.problems.find((x) => x.includes('F3(可自动收口)未归零'))
    if (!gp)
      throw new Error(
        `归并后仍有 1 处时交付校验必须产出那条红(闸被放宽成 0 就是拆安全闸):${JSON.stringify(stuck.problems)}`,
      )
    const g = /(\d+)\s*处/.exec(gp)
    if (!g || Number(g[1]) !== stuck.f3.auto)
      throw new Error(`交付校验行的数字与出口读数不同源:红="${gp}" auto=${stuck.f3.auto}`)
    if (!/判定面:HEAD blob/.test(gp))
      throw new Error(`交付校验结论行没点名判定面:"${gp}" —— 读者无从知道这判的是哪一面`)
    const hm = /可自动收口\s*(\d+)\s*处/.exec(stuck.f3.headClause())
    if (!hm || Number(hm[1]) !== stuck.f3.auto)
      throw new Error(
        `同一份结果的抬头与闸不同数:head="${stuck.f3.headClause().slice(0, 120)}" auto=${stuck.f3.auto}`,
      )
    // ④ 调用方没点判定面 ⇒ 出口只能老实说"未判定",绝不冒充
    setRunFace(null)
    const naked = verifyMerge(src, r.text, r.changed).f3
    if (!naked.headClause().includes('判定面:未判定'))
      throw new Error(`没点面却报出了某个面名(冒充 ⇒ 台账器口径)：${naked.headClause().slice(0, 200)}`)
    if (runFaceLabel() !== '未判定') throw new Error('runFaceLabel 未随 setRunFace(null) 归位')
  } finally {
    setRunFace(null)
  }
})

/**
 * T27 G-341 端到端(独立仓)—— 把 ② 从"两个函数返回值"提到"同一次运行的 stdout 上那两个数"。
 * 为什么必须再跑一次 CLI:报告侧的抬头行住在 `main()`,交付校验行住在 `verifyMerge()`,
 * 只测出口函数会漏掉"有人在 main 里自己再算一遍"这一型(那正是立项时发生的形态)。
 * 夹具与 T26 同一份(归并前 1 处 / 归并后 0 处),所以改动前那两行必然给出 1 与 0。
 */
test('T27 G-341 端到端:同一次 --heal 的抬头行与结论行必须报同一个"可自动收口"', () => {
  const dupLine =
    '- [ ] **D7 甲事**:还没人做。 〔【归并】重复登记副本(2026-09-26):同主键的另一条登记在 L4,派单以那条为准。〕'
  const plan = [
    '# 计划',
    '',
    dupLine,
    '- [ ] **D7 甲事**:还没人做。',
    '- [ ] **D8 乙事**:说明。 〔另见 L9 的那一条。〕',
    '',
  ].join('\n')
  const env = fixtureRepo(plan, 'fixture: 一条可自动收口的行号指针')
  try {
    const cli = runCli(env, ['--heal'])
    const head = /可自动收口\s*(\d+)\s*处/.exec(cli.out)
    const concl = /F3\(可自动收口\)\/F4 = \d+\/\d+\/(\d+)\/\d+/.exec(cli.out)
    if (!head)
      throw new Error(
        `报告没有报出"可自动收口 N 处"(抬头形态变了,本锁需同步):${cli.out.trim().slice(0, 300)}`,
      )
    if (!concl)
      throw new Error(
        `交付校验结论行没报 F3(可自动收口) 那一档 ⇒ 闸被删或结论形态变了:${cli.out.trim().slice(0, 400)}`,
      )
    if (head[1] !== concl[1])
      throw new Error(
        `同一次运行给出两个"可自动收口":抬头 ${head[1]} 处 / 交付校验 ${concl[1]} 处(G-341 复发)`,
      )
    // 发散前提:这一轮归并前确实有 1 处 —— 否则"相等"可以由"两个 0"冒充
    if (!/归并前可收 1 处/.test(cli.out))
      throw new Error(
        `夹具没发散(归并前那一份读数不见了):${cli.out.trim().slice(0, 300)}`,
      )
    // 结论行必须点名判定面(独立仓判的就是 HEAD blob)
    if (!/判定面:HEAD blob/.test(cli.out))
      throw new Error(`结论行未点名判定面:${cli.out.trim().slice(0, 300)}`)
  } finally {
    rmScratch(env.dir)
  }
})

// ══ T28 / T29(G-761 票面那句验收判据:跨态单行孪生必须把 F1 打到 0 且不再起红)══════
/**
 * 这一对用例**不钉"有没有单行档"** —— 那一半早已住在同一份 `plan-tasks-merge.mjs` 里
 * (G-336 `--dedupe-rows` 管已勾档、G-741 `--dedupe-open-rows` 管未勾带指针档、G-761 补租约硬跳过
 * 并把 `--dedupe-blocks` 在 F6=0 时的报告补成同报单行读数),本票不许再造第四把尺子。
 * 它钉的是票面最后那句:**「归并后 F1 归零,且下一轮收敛不被同一件事的副本顶回来」**。
 *
 * 为什么这句话此前无人守:两份删除档的零损失断言只判 **F1 不涨**(`fDimRegressions`),于是
 * "删完副本仍剩一条未勾行压在同一条已勾持有行上"这种 F1=1 的产物照样判绿落地;而
 * `git-sync-converge` 的落地门看的是 **F1 是不是 0**(2026-10-08 真仓那一例:持有行翻勾后
 * F1 0→3 ⇒ 拒推,最后靠 `--heal --commit` 归并 17 行才解卡)。"不涨"与"归零"之间那一格就是本票对象。
 *
 * 三条不变量成对钉:
 *  A 先 `--heal` 再 `--dedupe-rows` ⇒ F1 归零 ∧ 一行不删 ∧ 幂等闭合;
 *  B 先 `--dedupe-open-rows` 再 `--heal` ⇒ 同样归零(序不敏感,否则"该先跑哪档"又变成一次人工裁决),
 *    幸存那行按设计保持未勾且不进派单口径(claimable=0)⇒ 它不再顶住收敛门;
 *  C 天然成对的**短行**(整行 <40 字符)两档一份都不许吃(阈值不得为变绿而放宽)。
 * 顶回来的机制住在守门 71:翻勾若把正文挤举行首,防丢层就把合法翻勾读成"整行消失"并回捞旧行,
 * F1 重新起红(G-307 那两小时 24 枚"恢复型"提交就是这么来的)。所以链的每一环都用 `lostMarkers`
 * 复验,而不是只在折叠档那一档验。T29 的三把变异就按 A/B/C 三环各配一把。
 */
const XID = 'G-99000071'
const XDAY = '2026-10-10'
const XBODY =
  '跨态单行孪生链:一条任务被抄成三份逐字相同的未勾副本,另有一条已勾的持有行,正文长度越过四十字符噪声阈。'
const XHOLD = `- [x] ✅(2026-10-08) **${XID} ${XBODY}`
const XCOPY = `- [ ] **${XID} ${XBODY}`
const XPTR = `${XCOPY} 〔【归并】重复登记副本(2026-10-08):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕`
/** 票面那一例的夹具:1 条已勾持有行 + 3 份逐字相同的未勾副本。 */
const XFACE = ['# 计划', '', XHOLD, XCOPY, XCOPY, XCOPY, ''].join('\n')
/** 同一例的"副本已带指针"形态(未勾档的准入条件第⑤条)。 */
const XPTRFACE = ['# 计划', '', XHOLD, XPTR, XPTR, XPTR, ''].join('\n')
/** 成对反例:同族形态但整行短于 40 字符 —— 两档都必须对它一份不吃。 */
const XSHORT_DONE = '- [x] ✅(2026-10-08) G-99000072 短行'
const XSHORT_OPEN = '- [ ] G-99000073 短行〔【归并】重复登记副本〕'
const XSHORTFACE = ['# 计划', '', XSHORT_DONE, XSHORT_DONE, XSHORT_OPEN, XSHORT_OPEN, ''].join('\n')

const f1Of = (t) => auditPlan(t).counts.forks

/** A 臂:先翻勾、再摘已勾副本;六条读数一次算完,返回不合格项(空数组 = 链闭合)。 */
function chainProblems(mod, src) {
  const bad = []
  const h = mod.buildMerge(src, XDAY)
  if (h.changed.length !== 3)
    bad.push(
      `--heal 只动了 ${h.changed.length} 行(应为 3 份副本);refused=${JSON.stringify(h.refused)} 待裁=${JSON.stringify(h.adjudicationNeeded)}`,
    )
  if (h.text.split('\n').length !== src.split('\n').length)
    bad.push('--heal 改了行数(票面边界 1:归并只许翻勾/加指针,禁止删行)')
  if (f1Of(h.text) !== 0) bad.push(`--heal 后 F1=${f1Of(h.text)} 未归零(收敛门照旧拒推)`)
  for (const c of h.changed) {
    if (!forkPreserved(c.before, c.after)) bad.push(`L${c.line} 翻勾改到正文 ⇒ 谁作数须由人裁`)
    if (!new RegExp(`^- \\[x\\] ✅\\(\\d{4}-\\d{2}-\\d{2}\\) \\*\\*${XID} `).test(c.after))
      bad.push(`L${c.line} 翻勾后正文不在行首(守门 71 的行首判活会读成丢行):${c.after.slice(0, 56)}`)
  }
  const lost = lostMarkers(src, h.text).length
  if (lost !== 0) bad.push(`守门 71 判为整行消失 ${lost} 处 ⇒ 自愈会回捞旧行、F1 重新起红`)
  if (!h.text.includes(XID)) bad.push(`主键 ${XID} 整族从面上消失(无声删除)`)
  const d = mod.buildRowDedupe(h.text)
  if (d.deletedCount !== 2)
    bad.push(`heal 之后单行已完成档拟删 ${d.deletedCount} 行(应为 2:摘第 2..3 份,留首次出现)`)
  const p = mod.verifyRowDedupe(h.text, d.text, d.deletedCount)
  if (p.length) bad.push(`删副本的零损失断言未过:${p.join(' | ')}`)
  if (f1Of(d.text) !== 0) bad.push(`删完副本后 F1=${f1Of(d.text)} 又非 0 ⇒ 链不闭合`)
  if (mod.findRowTwins(d.text).length !== 0) bad.push('单行已完成档不幂等:删完仍有等值孪生组')
  if (auditPlan(d.text).counts.open !== 0) bad.push('删完还剩未勾行(把活账删成了假绿)')
  return bad
}

/** B 臂:先摘未勾副本、再 heal —— 结论必须与 A 臂同色(序不敏感)。 */
function pointerOrderProblems(mod, src) {
  const bad = []
  const o = mod.buildOpenRowDedupe(src)
  if (o.deletedCount !== 2) bad.push(`未勾带指针档拟删 ${o.deletedCount} 行(应为 2)`)
  const p = mod.verifyOpenRowDedupe(src, o.text, o.deletedCount, null, o.droppedLines)
  if (p.length) bad.push(`未勾档零损失断言未过:${p.join(' | ')}`)
  const c1 = auditPlan(o.text).counts
  if (c1.forks !== 0) bad.push(`先删副本这一序下 F1=${c1.forks} 未归零`)
  if (c1.open !== 1) bad.push(`应恰好剩一条副本指针行当族内终端代表,实得 open=${c1.open}`)
  if (c1.claimable !== 0) bad.push(`幸存的副本指针行不得进派单口径,实得 claimable=${c1.claimable}`)
  const again = mod.buildMerge(o.text, XDAY)
  if (again.changed.length !== 0)
    bad.push(`删完仍需再 heal(${again.changed.length} 行)⇒ 序敏感,"该先跑哪档"会变成一次人工裁决`)
  return bad
}

/** C 臂:天然成对的短行两档都不许吃(阈值放宽的唯一反证)。 */
function noiseProblems(mod, src) {
  const bad = []
  const d = mod.buildRowDedupe(src)
  if (d.deletedCount !== 0) bad.push(`短行被已完成档吃掉 ${d.deletedCount} 行(40 字符阈是它唯一的防线)`)
  if (mod.findRowTwins(src).length !== 0) bad.push('短行被算成了等值孪生组')
  const o = mod.buildOpenRowDedupe(src)
  if (o.deletedCount !== 0) bad.push(`短行被未勾带指针档吃掉 ${o.deletedCount} 行`)
  if (d.text !== src) bad.push('已完成档对短行动了行(产物必须逐字等于输入)')
  if (o.text !== src) bad.push('未勾档对短行动了行(产物必须逐字等于输入)')
  return bad
}

test('T28 跨态单行孪生的出口链:F1 归零 ∧ 一行不删 ∧ 序不敏感 ∧ 短行不吃', () => {
  // 发散前提:夹具必须真的等于票面那一例,否则下面每条都可能由"两个 0 相等"冒充。
  const c0 = auditPlan(XFACE).counts
  if (c0.forks !== 1 || c0.dupOpenCopies !== 2)
    throw new Error(
      `夹具不再等于票面那一例(F1=${c0.forks} F4=${c0.dupOpenCopies},应为 1/2)⇒ 本用例失去对象,换夹具而不是删断言`,
    )
  for (const [n, l] of [['XHOLD', XHOLD], ['XCOPY', XCOPY], ['XPTR', XPTR]])
    if (l.length < 40) throw new Error(`${n} 掉到 40 字符噪声阈以下,两档结构性看不见它`)
  const sh = XSHORTFACE.split('\n').filter((l, _i, all) => l.startsWith('- [') && all.filter((x) => x === l).length > 1)
  if (sh.length !== 4) throw new Error(`短行反例夹具退化(应含 2 对逐字相同行 = 4 行,实得 ${sh.length})⇒ C 臂没有在测的东西`)

  const a = chainProblems({ buildMerge, buildRowDedupe, verifyRowDedupe, findRowTwins }, XFACE)
  if (a.length) throw new Error(`A 臂(先 --heal 再 --dedupe-rows)不闭合:\n  ${a.join('\n  ')}`)
  const b = pointerOrderProblems({ buildOpenRowDedupe, verifyOpenRowDedupe, buildMerge }, XPTRFACE)
  if (b.length) throw new Error(`B 臂(先 --dedupe-open-rows 再 --heal)不闭合:\n  ${b.join('\n  ')}`)
  const c = noiseProblems({ buildRowDedupe, buildOpenRowDedupe, findRowTwins }, XSHORTFACE)
  if (c.length) throw new Error(`C 臂(天然成对的短行)被吃:\n  ${c.join('\n  ')}`)
})

test('T29 变异自证:三把变异各打断链上一环(证明 T28 那三条不是恒真式)', async () => {
  const SCRIPTS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const variants = [
    {
      name: '翻勾形态退回"注记前置"(G-307 那一型)',
      // 生产侧 rewriteFork 只是 lib 那一份的薄调用点;换成旧形态后正文不再在行首 ⇒
      // forkPreserved 拒绝翻勾 ⇒ 副本停在未勾态、F1 不归零。红的是 A 臂,不是"少改一点"。
      apply: (t) =>
        t.replace(
          'function rewriteFork(line, key, today) {\n  return buildForkedLine(line, key, today)\n}',
          "function rewriteFork(line, key, today) {\n  return '- [x] ' + String.fromCodePoint(0x2705) + '(' + today + ') **[归并]** 同题副本 ' + line.slice(6)\n}",
        ),
      expect: (bad) => bad.some((x) => /未归零|行首/.test(x)),
    },
    {
      name: '把 40 字符噪声阈降到 8(阈值放宽)',
      apply: (t) => t.replace('const ROW_MIN_LEN = 40', 'const ROW_MIN_LEN = 8'),
      expect: (bad) => bad.some((x) => /短行被|短行被算成/.test(x)),
    },
    {
      name: '把"删第 2..N 份"改成"删全部份"(幸存份被抹掉)',
      apply: (t) => t.replace('for (const ln of g.at.slice(1)) {', 'for (const ln of g.at) {'),
      expect: (bad) => bad.some((x) => /拟删 3 行|零损失断言未过|一份都不剩/.test(x)),
    },
  ]
  for (const v of variants) {
    const dir = mkScratch('plan-merge-mut')
    let mod
    try {
      const dst = path.join(dir, 'scripts')
      mkdirSync(dst, { recursive: true })
      copyScriptWithClosure(SCRIPTS_DIR, 'plan-tasks-merge.mjs', dst, [
        'lib/plan-task-index.mjs',
        'lib/scratch-dir.mjs',
      ])
      const p = path.join(dst, 'plan-tasks-merge.mjs')
      const srcTxt = readFileSync(p, 'utf8')
      const outTxt = v.apply(srcTxt)
      if (outTxt === srcTxt)
        throw new Error(`变异「${v.name}」一个字节都没改下去 ⇒ 变异靶写歪了,T28 对应那条仍是恒真的`)
      writeFileSync(p, outTxt, 'utf8')
      mod = await import(pathToFileURL(p).href)
    } catch (e) {
      rmScratch(dir)
      throw e
    }
    const bad = [
      ...chainProblems(mod, XFACE),
      ...pointerOrderProblems(mod, XPTRFACE),
      ...noiseProblems(mod, XSHORTFACE),
    ]
    // 变异模块已进 import 缓存,摘掉盘上那份不影响已装载的模块(本套件 import 后不再回读它)
    rmScratch(dir)
    if (bad.length === 0)
      throw new Error(
        `变异「${v.name}」之后 T28 三条断言一条都没红 ⇒ 那条断言恒真,变异自证不成立(本仓"把没判写成判过了"的最高频形态)`,
      )
    if (!v.expect(bad))
      throw new Error(
        `变异「${v.name}」翻红的是别处,不是它该打断的那一环 ⇒ 靶位与断言不对应。实得:${bad.join(' | ').slice(0, 500)}`,
      )
  }
})
