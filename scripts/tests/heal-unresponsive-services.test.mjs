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

test('T7 派生形状锁:动作器与守护两处派生都带 windowsHide + timeout(§5b 弹窗、守门 80)', () => {
  for (const [label, file] of [['动作器', HEALER], ['守护派发段', GUARDIAN]]) {
    const src = readFileSync(file, 'utf8')
    const i = label === '守护派发段' ? src.indexOf('heal-unresponsive-services.mjs') : 0
    const seg = label === '守护派发段' ? src.slice(i, i + 2400) : src
    assert.ok(/windowsHide: true/.test(seg), `${label} 的派生漏 windowsHide ⇒ 守护/计划任务下必弹控制台窗`)
    assert.ok(/timeout: /.test(seg), `${label} 的派生漏 timeout ⇒ 挂一次就把整批守护拖住`)
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
