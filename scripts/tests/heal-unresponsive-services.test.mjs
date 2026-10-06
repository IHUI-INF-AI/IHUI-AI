// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:`scripts/heal-unresponsive-services.mjs`(不响应服务的自愈动作器)。
 *
 * 它守的不是"逻辑对不对"(那由动作器自己的 --self-test 15 条覆盖),而是**装没装车、
 * 判据有没有第二份、以及"没判"能不能被读成"判过了"**这三型 —— 本仓记过最多次的失效形态。
 * 台账 G-978121:三层重启方案的第三层。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { maskCommentsStringsAndRegex } from '../lib/code-mask.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const HEALER = path.join(ROOT, 'scripts', 'heal-unresponsive-services.mjs')
const GUARDIAN = path.join(ROOT, 'scripts', 'git-guardian.mjs')
const CONFIG = path.join(ROOT, 'scripts', 'data', 'service-auto-restart.json')

const heal = await import('../heal-unresponsive-services.mjs')
const { parseConfig, decideRound, verdictOf, main } = heal.__test__

const NOW = Date.parse('2026-10-01T12:00:00Z')
const scratch = mkScratch('heal-mirror')
after(() => rmScratch(scratch))

/** 造一份门的 --json 报告(字段形状与真机一致,不自己发明)。 */
function gateReport(entries) {
  return JSON.stringify({
    services: entries.map(([name, stateVal, probe]) => ({ name, level: 'x', rec: { state: { kind: 'measured', value: stateVal }, probe } })),
  })
}
const answering = { kind: 'measured', value: { listening: true, ports: [8802] } }
const silent = { kind: 'measured', value: { listening: false, labels: ['127.0.0.1:8802'] } }
const undet = { kind: 'unmeasured', reason: '任务型,此维不适用' }

function fixtureConfig(dir, services) {
  const p = path.join(dir, 'cfg.json')
  writeFileSync(
    p,
    JSON.stringify(
      {
        limits: { consecutiveRounds: 2, cooldownMinutes: 60, maxRestartsPerWindow: 2, windowMinutes: 60 },
        services,
        excluded: [],
      },
      null,
      2,
    ),
    'utf8',
  )
  return p
}
const entry = (name, reviewBy = '2099-01-01') => ({ name, reason: '夹具理由', owner: '夹具', reviewBy })

test('T1 装车证明:守护里必须有定义 + 两个调用点(单轮路径与 tick 循环各一个)', () => {
  const src = readFileSync(GUARDIAN, 'utf8')
  const code = maskCommentsStringsAndRegex(src)
  assert.ok(/export function healUnresponsiveServices\(/.test(code), '守护里没有动作器定义 ⇒ 它不会被任何人调度')
  const calls = (code.match(/healUnresponsiveServices\(\)/g) || []).length
  assert.equal(calls, 2, `调用点应为 2 处(main 单轮 + tick 循环),现读 ${calls} 处 —— 少一处就等于那条路径上永不执行`)
})

/**
 * T2 摘线方向锁:动作器头注自称"已接线"时,守护必须真的调它。
 *
 * 为什么这不是同族病根(2026-10-06 逐条核过,与门 133 的 M3 / radius 的 T2 / token-sync 的 T9
 * / mode-permission 的 T9 那一族对照):那一族的病根是**判据锚绝对字面量**,而本用例两端读的是
 * **两个不同文件** —— `claimsWired` 读动作器头注(`heal-unresponsive-services.mjs`)的措辞,
 * `wired` 读调度方(`scripts/git-guardian.mjs`)里的真实调用点 `healUnresponsiveServices()`。
 * 「用措辞验措辞」才会空转;这里措辞在左、代码在右,措辞改成任何写法都动不了右边那个读数。
 * 实测两侧现读:claimsWired=true / wired=true;T1 另行钉住调用点恰好 2 处。
 *
 * 变异坐实牙口(把 git-guardian 里的调用改名,注入确认生效后):wired 读出 false ⇒ :76 判红。
 * 反向若 `wired` 也去读头注,头注里只有散文、没有 `healUnresponsiveServices()` 调用形态
 * (实测 false),那条就会退化成恒绿 —— 现在不是。
 *
 * 注::75 与 :76 是同一命题的两个书写方向(双向对账的另半边),逻辑等价不是冗余错误:
 * 少任何一半,"造好没装车"与"装车了却写没装"就有一头没人拦。
 */
test('T2 摘线方向锁:动作器头注自称"已接线"时,守护必须真的调它', () => {
  const healerSrc = readFileSync(HEALER, 'utf8')
  const guardianSrc = readFileSync(GUARDIAN, 'utf8')
  const claimsWired = /挂进|派发点|唯一的调度器|heal-unresponsive/.test(healerSrc) && /git-guardian/.test(healerSrc)
  const wired = /healUnresponsiveServices\(\)/.test(guardianSrc)
  assert.ok(!claimsWired || wired, '头注说挂在守护上,而守护没调 ⇒ "造好没装车"(守门 64/70/81/115 同型)')
  assert.ok(wired || !claimsWired, '反向:未接线时头注不得自称已接线')
})

test('T3 判据只有一份:动作器不得自带应答尺子,复验必须回跑门 153', () => {
  const src = readFileSync(HEALER, 'utf8')
  const code = maskCommentsStringsAndRegex(src)
  // 反向锁:先证明这把扫描有牙 —— 一段真调用必须命中(本仓最贵的假绿是"扫不到所以绿")
  assert.ok(/\bnet\s*\.\s*connect\b|\bcreateConnection\b/.test(maskCommentsStringsAndRegex('const s = net.connect({host:"127.0.0.1",port:1})')), '扫描器对真调用不命中 ⇒ 下面那条断言是恒真式')
  assert.ok(!/\bnet\s*\.\s*connect\b|\bcreateConnection\b|\bnew\s+Socket\s*\(/.test(code), '动作器里出现了第二把"是否应答"的尺子 ⇒ 两处算同一件事必漂移')
  const args = buildArgsText()
  assert.ok(/buildGateArgs\(/.test(code) && args.includes('--json') && args.includes('--service'), '复验不走门而走本地握手 ⇒ 判据分叉')
})
function buildArgsText() {
  const { buildGateArgs } = heal.__test__
  return JSON.stringify(buildGateArgs('IHUI-API'))
}

test('T4 遮噪只引唯一实现:动作器不得自己再写一份剥注释/剥字符串', () => {
  const src = readFileSync(HEALER, 'utf8')
  assert.ok(/from '\.\/lib\/code-mask\.js'/.test(src) || /code-mask\.mjs/.test(src), '没引 lib/code-mask.mjs ⇒ 遮罩会有第二份实现')
  assert.ok(!/function maskComments|const maskComments/.test(src), '动作器内自带剥注释函数 ⇒ 与 lib 那份必然漂开')
})

test('T5 台账三态:缺字段 / 空表 / 过期各自挡法不同,且过期只挡那一条不挡整轮', () => {
  assert.throws(() => parseConfig(JSON.stringify({ services: [{ name: 'A', reason: 'r' }] }), NOW), /缺 owner\/reviewBy/)
  assert.throws(() => parseConfig(JSON.stringify({ services: [] }), NOW), /services 为空/)
  const c = parseConfig(JSON.stringify({ services: [entry('A', '2020-01-01'), entry('B')] }), NOW)
  assert.equal(c.services.find((s) => s.name === 'A').expired, true)
  assert.equal(c.services.find((s) => s.name === 'B').expired, false)
  const r = decideRound({
    config: c,
    state: { services: { A: { strikes: 1, lastRestartMs: null }, B: { strikes: 1, lastRestartMs: null } }, restarts: [] },
    verdicts: { A: { verdict: 'silent', why: 'x' }, B: { verdict: 'silent', why: 'x' } },
    nowMs: NOW,
    apply: true,
  })
  assert.equal(r.actions.find((a) => a.name === 'A').kind, 'undetermined', '过期条目不得动作,也不得被记成故障')
  assert.equal(r.actions.find((a) => a.name === 'B').kind, 'restart', '同台账里未过期的那一条照常被处置 —— 一条过期不能拖死整轮')
})

test('T6 端到端唯一差别必须是判据:同一份 stub,silent 触发重启、undetermined 绝不触发', async () => {
  const cfgPath = fixtureConfig(scratch, [entry('IHUI-DEMO')])
  const statePath = path.join(scratch, 'state.json')
  const mk = (probe) => {
    const calls = []
    return {
      calls,
      deps: {
        gate: () => ({ ok: true, json: gateReport([['IHUI-DEMO', 'RUNNING', probe]]) }),
        restart: (name) => {
          calls.push(name)
          return { ok: true }
        },
        sleep: () => {},
      },
    }
  }
  // 第一轮:两台都只记观察
  const s1 = mk(silent)
  await main({ argv: ['--json', '--apply'], deps: s1.deps, now: () => NOW, configFile: cfgPath, stateFile: statePath })
  assert.equal(s1.calls.length, 0, '首轮不得动作(单轮抖动不算故障)')
  // 第二轮:**同一份累计状态**(计数已到阈值边缘),门的应答维给不出结论 ⇒ 即便够数也不许重启。
  // 三臂共用 statePath 是这条用例的全部意义:唯一变量必须是判据本身,否则"没动作"可能只是没攒够。
  const s2 = mk(undet)
  const r2 = await main({ argv: ['--json', '--apply'], deps: s2.deps, now: () => NOW + 60_000, configFile: cfgPath, stateFile: statePath })
  assert.equal(s2.calls.length, 0, '未判定换来重启 = 把"没判"当成"坏的"')
  assert.match(r2.text, /未判定 1/, '未判定必须报名,不得静默')
  // 第三轮:状态与上一臂逐字相同,只把门的结论换成"确实不应答"⇒ 必须动作(成对证明前两臂不是恒绿)
  const s3 = mk(silent)
  await main({ argv: ['--json', '--apply'], deps: s3.deps, now: () => NOW + 120_000, configFile: cfgPath, stateFile: statePath })
  assert.deepEqual(s3.calls, ['IHUI-DEMO'], '连续两轮不应答 + apply ⇒ 必须真重启这一台')
  // 第四臂:重启后端口恢复 ⇒ 不得再动作,且必须逐台报名"应答"(健康不许静默)
  const s4 = mk(answering)
  const r4 = await main({ argv: ['--json', '--apply'], deps: s4.deps, now: () => NOW + 130_000, configFile: cfgPath, stateFile: statePath })
  assert.equal(s4.calls.length, 0, '已恢复应答还重启 = 把好的踢一遍')
  assert.match(r4.text, /应答 1/, '健康也必须报名 —— 否则"都没事"与"没跑到"在读数上同形')
})

/**
 * 取函数体(大括号配平,不用定长窗口):先配平形参表,再从其后第一个 `{` 起配平到闭括号。
 *
 * 两个坑都在本仓踩过:
 *  - **必须先配平 `(` … `)`**:`healUnresponsiveServices(opts = {})` 的**默认值里就有 `{}`**,
 *    从声明处直接找第一个 `{` 会切在参数对象上,体只剩 2 个字符(实测区间长度 2,
 *    windowsHide / timeout 双双读成 false)。同法同坑见 heal-worktree-tracked.test.mjs 的 funcBody。
 *  - **在遮罩面上配平**:`maskCommentsStringsAndRegex` 等长(实测 161266 == 161266),
 *    字符串/正则里的括号被抹平 ⇒ 配平不会假开;断言也在遮罩面上读 ⇒ 注释里写一句
 *    `windowsHide: true` 蒙不过去(否则这条锁会被"把要求写进注释"消掉)。
 */
function funcBodyOf(masked, decl) {
  const start = masked.indexOf(decl)
  assert.ok(start >= 0, `源文件里找不到 \`${decl}\` ⇒ 锚点落空,本用例从未被测到`)
  assert.equal(
    masked.indexOf(decl, start + 1),
    -1,
    `\`${decl}\` 在源文件里不止一处 ⇒ 锚到哪一处由出现顺序决定,判据会随时漂`,
  )
  const paren = masked.indexOf('(', start)
  assert.ok(paren > 0, `\`${decl}\` 后面没有形参表 ⇒ 源文件形态变了,本用例的取体算法不再成立`)
  let depth = 0
  let i = paren
  for (; i < masked.length; i++) {
    if (masked[i] === '(') depth++
    else if (masked[i] === ')' && --depth === 0) break
  }
  const open = masked.indexOf('{', i)
  assert.ok(open > 0, `\`${decl}\` 的形参表之后没有 \`{\` ⇒ 没有函数体可言`)
  depth = 0
  for (let k = open; k < masked.length; k++) {
    if (masked[k] === '{') depth++
    else if (masked[k] === '}' && --depth === 0) return masked.slice(open, k + 1)
  }
  assert.fail(`\`${decl}\` 的花括号未配平`)
}

/**
 * T7 派生形状锁:动作器与守护两处派生都带 windowsHide + timeout(§5b 弹窗、守门 80)。
 *
 * ⚠️ **原判据是假红,2026-10-06 修**(本仓「接线声明判据」缺陷族的第五子形态:
 * **锚点取到名字匹配的「描述」而非「本体」**)。族规律:一条把真相判红的尺子,教出来的就是谎报。
 *
 * 原形态与它为什么必然假红:
 *   `const i = src.indexOf('heal-unresponsive-services.mjs')` + `src.slice(i, i + 2400)`。
 *   `indexOf` 取的是**首次出现**,而那个首次出现在**第 238 行**—— 台账里的一行**描述**:
 *       where: 'healUnresponsiveServices → heal-unresponsive-services.mjs --apply',
 *   真身 `export function healUnresponsiveServices` 在**第 2962 行**(偏移 110770),
 *   两者相距 **99505 字符**。2400 字符的窗口从描述串起算,**永远够不到真身**
 *   (实测窗口内 windowsHide=false / timeout=false,而真身体内两者皆 true)。
 *   ⇒ 判据把一段**结构上不可能含 spawn 选项**的文字,当成派生代码来要求参数。
 *
 * 为什么描述串那一处**不该**进本判据面(它在台账里是有意义的一行,不是垃圾、也不必改):
 *   `where:` 是**散文指针**,职责是告诉人"派发段会调 heal-unresponsive-services.mjs --apply",
 *   供人按图索骥。它**结构上装不下 spawn 选项**—— 一行说明文字里永远不会出现
 *   `windowsHide` / `timeout`。把派生形状的要求压到它身上,是一条**恒红**判据:
 *   唯一"通过"的方式是把这行散文改写成代码,而那正好毁掉它作为台账的意义。
 *   这正是本仓 §12f 记过的"判红则恒红 ⇒ 各会话 `--no-verify` 连带废掉链上全部守门"。
 *   ⇒ 描述串由**台账对账**那一族去验(它指的路对不对),T7 只管派生形状,两者不并桶。
 *
 * 派发点(第 3957 / 4045 行两处 `healUnresponsiveServices()` 调用)**同样不入本判据面**,
 * 理由与上面不同,别混为一谈:那两处是**裸调用**,实测其后 2400 字符内 windowsHide=false /
 *   timeout=false —— spawn 及其选项**全在 callee 函数体内**,调用点根本没有选项袋。
 *   在调用点要求 windowsHide 是**凭空发明的需求**(恒红的另一种形式)。
 *   调用点维度另有归属:T1 钉住"恰好 2 处调用点",T2 钉住"头注自称已接线时守护真调它"。
 *
 * 新锚点:`export function healUnresponsiveServices`(函数**声明**,代码结构)→ 括号配平取**整个函数体**,
 *   窗口由结构决定而非定长字符数(定长窗口就是同族的「±窗口跨邻门」:体长一改就悄悄失效)。
 */
test('T7 派生形状锁:动作器与守护两处派生都带 windowsHide + timeout(§5b 弹窗、守门 80)', () => {
  const guardianBody = funcBodyOf(
    maskCommentsStringsAndRegex(readFileSync(GUARDIAN, 'utf8')),
    'export function healUnresponsiveServices',
  )
  for (const [label, seg] of [
    // 动作器侧读全文(与修前同口径):它自己的两处 spawn 有精确形状锁 —— 动作器 `--self-test`
    // 的 V3 那条;本用例在动作器这一侧历史上就是全文读,不在本次修的面内。
    ['动作器', readFileSync(HEALER, 'utf8')],
    ['守护派发段', guardianBody],
  ]) {
    // ⚠️ 两条都**不许锚格式**:变异 MV1c/MV1d 实测,把 `timeout: X` 写成 `timeout:X`(仅去掉
    // 冒号后的空格)会让锚 `timeout: ` 的判据**假红** —— 又一次"锚绝对字面量"。
    // 反过来 `windowsHide:\s*true` 也不能只认 `true` 的某种写法之外的东西(值仍要是 true:
    // 写成 false 是 MV1,已实测转红)。`\s*` 两边都吃掉 ⇒ 排版漂移不再冒充缺陷。
    assert.ok(/windowsHide\s*:\s*true/.test(seg), `${label} 的派生漏 windowsHide ⇒ 守护/计划任务下必弹控制台窗`)
    assert.ok(/timeout\s*:/.test(seg), `${label} 的派生漏 timeout ⇒ 挂一次就把整批守护拖住`)
  }
})

test('T8 白名单台账自身可解析且每条四件齐(它是判据输入,坏一行整轮拒动)', () => {
  assert.ok(existsSync(CONFIG), '台账不在位 ⇒ 动作器按设计整轮拒动')
  const c = parseConfig(readFileSync(CONFIG, 'utf8'), NOW)
  assert.ok(c.services.length >= 5, `白名单条目少到 ${c.services.length} 条时,先怀疑台账被回写而非"都取消了"`)
  for (const s of c.services) {
    assert.ok(s.reason && s.owner && s.reviewBy, `${s.name} 缺三件之一`)
    assert.equal(s.expired, false, `${s.name} 复核日已过期(${s.reviewBy})⇒ 该回看台账,不是让它悄悄失效`)
  }
  const names = new Set(c.services.map((s) => s.name))
  assert.ok(!names.has('IHUI-PG') && !names.has('IHUI-REDIS'), '数据库/缓存不得进健康重启名单(一次停摆即全站中断)')
  assert.ok(!names.has('IHUI-PG-BACKUP'), '备份服务不在名单:它"启动即备份",时机不该由拉起策略决定')
  assert.ok(!names.has('IHUI-GIT-GUARD'), '动作器就跑在这个执行体里,自我重启=自杀')
})

test('T9 映射不猜:门的报告里缺这台服务 ⇒ 未判定(不是"没跑"也不是"没坏")', () => {
  assert.equal(verdictOf('NOPE', null).verdict, 'undetermined')
  assert.equal(verdictOf('NOPE', { rec: {} }).verdict, 'undetermined')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
