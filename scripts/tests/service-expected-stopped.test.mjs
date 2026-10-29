// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 『停着是设计内』豁免的行为锁(2026-10-28;2026-10-29 补 web 蓝绿族与 PAUSED 档)。
 *
 * 这一族判据最容易出的错是**方向错**:豁免范围一不小心放大,表就成了新的消红通道
 * (§"skipped 不能成为消红通道" 记过同型)。所以每条正例都配一条"看起来像但不该被豁免"的反例:
 *   · 停着 + 只有 STATE/端口无应答 ⇒ 豁免;
 *   · 停着 + 还有 Application 路径烂掉 ⇒ **不**豁免(其余问题必须照旧红);
 *   · 跑着但端口不应答 ⇒ **不**豁免(那是真故障,不是"设计内停止");
 *   · STATE 量不到 ⇒ **不**豁免("没判"不等于"停着");
 *   · **STATE=PAUSED ⇒ 不豁免**(挂起 = nssm 节流/应用起不来的真故障,不是"按设计停着" —— 实测 IHUI-WEB-ROUTER)。
 * 蓝绿一侧另有两条硬要求(2026-10-29,机主令"补齐监控面、不留盲区"):
 *   · **新加的族条目不是空转**:每条"按设计 Stop ⇒ 不报红"的正例都配一条"把该族/该条从台账里摘掉 ⇒
 *     必须翻红"的反向对照(摘掉不翻红 = 那条例外压根没生效,正是本仓最贵的假绿);
 *   · **状态文件取不到 ⇒ 该族未判定**,一枚豁免都不给,绝不退"默认色"去猜(§0.3)。
 * 动作器一侧另有两条:门裁定 expected-stopped 时**不动作**,且该台即使不在 services 台账里
 * 也必须在报告里出现(否则"被判成设计内"与"压根没看见"同形)。
 *
 * 本文件**不复制任何判据常量**(§22c / 门 191):档位、问题串、族清单一律 import 源脚本的出口;
 * 台账正文读仓内真件,夹具只构造"服务读数",级别一律由 judgeService 现算。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  applyExpectedStopped,
  blueGreenFamiliesOf,
  EXPECTED_STOPPED_PATH,
  judgeService,
  loadExpectedStopped,
  renderText,
  stateBandOf,
  stateProblemOf,
} from '../check-service-binary-paths.mjs'
import { decideRound, parseConfig, verdictOf } from '../heal-unresponsive-services.mjs'

const LEDGER = 'expected-stopped-services.json'
const BG = 'api-bluegreen.json'

/** 夹具:一个"量到问题"的服务条目(形状与门 meta.services 的元素一致)。 */
function row(name, { stateValue = 'STOPPED', problems = ['STATE=STOPPED'], extra = {} } = {}) {
  return {
    name,
    level: problems.length ? 'issue' : 'ok',
    problems: [...problems],
    rec: { state: stateValue === null ? { kind: 'unmeasured', reason: '量不到' } : { kind: 'measured', value: stateValue } },
    ...extra,
  }
}

function names(txt) {
  return new Map([[String(txt).toLowerCase(), { source: 'static', reason: '测试', reviewBy: '2027-01-01' }]])
}

test('豁免:停着且唯一的坏就是"停着"⇒ 降为 skipped 并带上出处', () => {
  const rows = [
    row('IHUI-API'),
    row('IHUI-API-BLUE', { problems: ['STATE=STOPPED', '监听无应答(tcp):127.0.0.1:8842 —— 声明端口无应答'] }),
  ]
  const exp = { names: new Map([...names('IHUI-API'), ...names('IHUI-API-BLUE')]), notes: [] }
  const r = applyExpectedStopped(rows, exp)
  assert.equal(r.applied.length, 2)
  assert.equal(r.kept.length, 0)
  assert.equal(rows[0].level, 'skipped')
  assert.equal(rows[0].expectedStopped.source, 'static')
  assert.equal(rows[1].level, 'skipped')
})

test('反例:停着但还有别的坏(Application 路径不是可用文件)⇒ 不豁免,仍红', () => {
  const rows = [row('IHUI-API', { problems: ['STATE=STOPPED', 'Application 路径不是可用文件(missing):F:/x.exe'] })]
  const r = applyExpectedStopped(rows, { names: names('IHUI-API'), notes: [] })
  assert.equal(r.applied.length, 0)
  assert.equal(r.kept.length, 1)
  assert.equal(rows[0].level, 'issue')
  assert.match(r.kept[0].why, /Application 路径不是可用文件/)
})

test('反例:跑着却端口无应答 ⇒ 不豁免(那是真故障,不是"设计内停止")', () => {
  const rows = [row('IHUI-API-GREEN', { stateValue: 'RUNNING', problems: ['监听无应答(tcp):127.0.0.1:8843 —— 声明端口无应答'] })]
  const r = applyExpectedStopped(rows, { names: names('IHUI-API-GREEN'), notes: [] })
  assert.equal(r.applied.length, 0)
  assert.equal(rows[0].level, 'issue')
})

test('反例:STATE 量不到 ⇒ 不豁免("没判"不等于"停着")', () => {
  const rows = [row('IHUI-API', { stateValue: null, problems: ['STATE=未判定'] })]
  const r = applyExpectedStopped(rows, { names: names('IHUI-API'), notes: [] })
  assert.equal(r.applied.length, 0)
  assert.match(r.kept[0].why, /STATE 这一维量不到/)
})

test('反例:未登记的服务一台都不动', () => {
  const rows = [row('OTHER-SVC')]
  const r = applyExpectedStopped(rows, { names: names('IHUI-API'), notes: [] })
  assert.equal(r.applied.length, 0)
  assert.equal(r.kept.length, 0)
  assert.equal(rows[0].level, 'issue')
})

test('台账读不到 ⇒ 空清单 + 说明(不豁免任何人,方向朝"更响"倒)', () => {
  const r = loadExpectedStopped({ exists: () => false })
  assert.equal(r.names.size, 0)
  assert.equal(r.notes.length, 1)
  assert.match(r.notes[0], /台账不在位/)
})

test('台账 reviewBy 已过期 ⇒ 该条失效并点名', () => {
  const r = loadExpectedStopped({
    exists: () => true,
    nowMs: Date.parse('2027-06-01T00:00:00Z'),
    readText: (p) =>
      p.endsWith(LEDGER)
        ? JSON.stringify({ static: [{ name: 'IHUI-API', reason: 'x', reviewBy: '2027-01-01' }], blueGreen: null })
        : '{}',
  })
  assert.equal(r.names.size, 0)
  assert.match(r.notes.join('\n'), /reviewBy 缺失或已过期/)
})

test('蓝绿:active=green ⇒ 只豁免 BLUE,活跃色 GREEN 绝不进豁免集', () => {
  const r = loadExpectedStopped({
    exists: () => true,
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    readText: (p) => {
      if (p.endsWith(LEDGER))
        return JSON.stringify({
          static: [],
          blueGreen: {
            families: [
              {
                family: 'api',
                stateFile: 'X:/run/' + BG,
                reviewBy: '2027-01-01',
                colors: { blue: { service: 'IHUI-API-BLUE', port: 8842 }, green: { service: 'IHUI-API-GREEN', port: 8843 } },
              },
            ],
          },
        })
      if (p.endsWith(BG)) return JSON.stringify({ active: 'green' })
      throw new Error('ENOENT:' + p)
    },
  })
  assert.equal(r.names.has('ihui-api-blue'), true)
  assert.equal(r.names.has('ihui-api-green'), false)
  assert.equal(r.families[0].state, 'measured')
  assert.equal(r.families[0].active, 'green')
})

test('蓝绿:旧单族形(blueGreen 直接带 colors)仍按一族读 —— 别的机/别的会话的台账副本没升级时不得把 api 冷备刷成天天假红(§12e)', () => {
  const r = loadExpectedStopped({
    exists: () => true,
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    readText: (p) => {
      if (p.endsWith(LEDGER))
        return JSON.stringify({
          static: [],
          blueGreen: {
            family: 'api',
            stateFile: 'X:/run/' + BG,
            reviewBy: '2027-01-01',
            defaultActive: 'blue',
            colors: { blue: { service: 'IHUI-API-BLUE' }, green: { service: 'IHUI-API-GREEN' } },
          },
        })
      if (p.endsWith(BG)) return JSON.stringify({ active: 'green' })
      throw new Error('ENOENT:' + p)
    },
  })
  assert.equal(r.families.length, 1)
  assert.equal(r.names.has('ihui-api-blue'), true)
  assert.equal(r.names.has('ihui-api-green'), false)
})

test('蓝绿:状态文件不在位 ⇒ 该族**未判定**,一枚豁免都不给(绝不退默认色去猜)', () => {
  const r = loadExpectedStopped({
    exists: (p) => String(p).endsWith(LEDGER), // 状态文件"不存在"
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    readText: () =>
      JSON.stringify({
        static: [],
        blueGreen: {
          families: [
            {
              family: 'api',
              stateFile: 'X:/run/' + BG,
              reviewBy: '2027-01-01',
              defaultActive: 'green',
              colors: { blue: { service: 'IHUI-API-BLUE' }, green: { service: 'IHUI-API-GREEN' } },
            },
          ],
        },
      }),
  })
  assert.equal(r.families[0].state, 'undetermined')
  assert.equal(r.names.size, 0)
  assert.match(r.notes.join('\n'), /未判定/)
  assert.match(r.notes.join('\n'), /状态文件不在位/)
})

test('蓝绿:active 形态不认识 ⇒ 同样落未判定,不猜(§0.3「没判绝不写成判过」)', () => {
  const r = loadExpectedStopped({
    exists: () => true,
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    readText: (p) => {
      if (p.endsWith(LEDGER))
        return JSON.stringify({
          static: [],
          blueGreen: { families: [{ family: 'api', stateFile: 'X:/run/' + BG, reviewBy: '2027-01-01', colors: { blue: { service: 'IHUI-API-BLUE' }, green: { service: 'IHUI-API-GREEN' } } }] },
        })
      if (p.endsWith(BG)) return JSON.stringify({ active: 'GREEn' })
      throw new Error('ENOENT:' + p)
    },
  })
  assert.equal(r.families[0].state, 'undetermined')
  assert.equal(r.names.size, 0)
  assert.match(r.notes.join('\n'), /active 不是 blue\/green/)
})

test('蓝绿:族 reviewBy 过期 ⇒ 该族失效并点名(豁免必须会到期,§0.7)', () => {
  const r = loadExpectedStopped({
    exists: () => true,
    nowMs: Date.parse('2027-06-01T00:00:00Z'),
    readText: (p) => {
      if (p.endsWith(LEDGER))
        return JSON.stringify({
          static: [],
          blueGreen: { families: [{ family: 'api', stateFile: 'X:/run/' + BG, reviewBy: '2027-01-01', colors: { blue: { service: 'IHUI-API-BLUE' }, green: { service: 'IHUI-API-GREEN' } } }] },
        })
      if (p.endsWith(BG)) return JSON.stringify({ active: 'green' })
      throw new Error('ENOENT:' + p)
    },
  })
  assert.equal(r.names.size, 0)
  assert.equal(r.families[0].state, 'expired')
  assert.match(r.notes.join('\n'), /reviewBy 缺失或已过期/)
})

test('动作器:门裁定 expected-stopped ⇒ 不动作(verdict 档位先于 STATE 判定)', () => {
  const gate = { rec: { state: { kind: 'measured', value: 'STOPPED' } }, expectedStopped: { source: 'blue-green', reason: '冷备' } }
  const v = verdictOf('IHUI-API-BLUE', gate)
  assert.equal(v.verdict, 'expected-stopped')
})

test('动作器:expected-stopped 的台即使不在 services 台账里也要在报告里出现', () => {
  const config = parseConfig(
    JSON.stringify({
      limits: { consecutiveRounds: 2, cooldownMinutes: 60, maxRestartsPerWindow: 2, windowMinutes: 60 },
      services: [{ name: 'A', reason: 'r', owner: 'o', reviewBy: '2027-01-01' }],
    }),
  )
  const { actions } = decideRound({
    config,
    state: { services: {}, restarts: [] },
    verdicts: { 'RETIRED-SVC': { verdict: 'expected-stopped', why: '门已裁定' }, A: { verdict: 'answering', why: 'ok' } },
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    apply: true,
  })
  const hit = actions.find((a) => a.name === 'RETIRED-SVC')
  assert.ok(hit, '不在册的 expected-stopped 必须报名,不能静默')
  assert.equal(hit.kind, 'expected-stopped')
  assert.match(hit.why, /台账未登记该服务/)
})

test('动作器:expected-stopped 绝不产生 restart(即使连跑多轮)', () => {
  const config = parseConfig(
    JSON.stringify({
      limits: { consecutiveRounds: 1, cooldownMinutes: 0, maxRestartsPerWindow: 9, windowMinutes: 60 },
      services: [{ name: 'IHUI-API-BLUE', reason: 'r', owner: 'o', reviewBy: '2027-01-01' }],
    }),
  )
  const { actions, next } = decideRound({
    config,
    state: { services: { 'IHUI-API-BLUE': { strikes: 5, lastRestartMs: null } }, restarts: [] },
    verdicts: { 'IHUI-API-BLUE': { verdict: 'expected-stopped', why: '冷备' } },
    nowMs: Date.parse('2026-10-28T00:00:00Z'),
    apply: true,
  })
  assert.equal(actions.some((a) => a.kind === 'restart'), false)
  assert.equal(next.restarts.length, 0)
  // strikes 也不清零:它不是"恢复",下一轮仍按原计数看待
  assert.equal(next.services['IHUI-API-BLUE'].strikes, 5)
})

// ────────────────────────────────────────────────────────────────────────────
// 2026-10-29 补:web 蓝绿三件套进存续判据 + PAUSED 显式红。
// 台账正文一律读仓内真件(scripts/data/expected-stopped-services.json),只有两族的**实时状态文件**
// 用注入替身 —— 测试不碰生产盘;而"条目到底有没有在生效"必须用真件回答,否则夹具会替台账说谎。
// 每条"按设计 Stop ⇒ 不报红"的正例都配一条"把该条摘掉 ⇒ 必须翻红"的反向对照。
// ────────────────────────────────────────────────────────────────────────────
const WEB_BG = 'web-bluegreen.json'
const REAL_LEDGER_TEXT = String(readFileSync(EXPECTED_STOPPED_PATH, 'utf8'))
const NOW = Date.parse('2026-10-29T00:00:00Z')

/** 把**真台账**连同注入的两族状态文件一起喂给源判据(唯一读取口 = loadExpectedStopped)。 */
function loadRealLedger(opts = {}) {
  const { apiActive = 'green', webActive = 'green', apiStateInPlace = true, webStateInPlace = true, ledgerText = REAL_LEDGER_TEXT, nowMs = NOW } = opts
  return loadExpectedStopped({
    nowMs,
    exists: (p) => {
      const s = String(p)
      if (s === EXPECTED_STOPPED_PATH) return true
      if (s.endsWith(WEB_BG)) return webStateInPlace
      if (s.endsWith(BG)) return apiStateInPlace
      return false
    },
    readText: (p) => {
      const s = String(p)
      if (s === EXPECTED_STOPPED_PATH) return ledgerText
      if (s.endsWith(WEB_BG)) {
        if (!webStateInPlace) throw new Error(`ENOENT:${s}`)
        return JSON.stringify({ active: webActive, blue: 8851, green: 8852, updatedAt: '2026-10-29T00:00:00+08:00' })
      }
      if (s.endsWith(BG)) {
        if (!apiStateInPlace) throw new Error(`ENOENT:${s}`)
        return JSON.stringify({ active: apiActive, blue: 8842, green: 8843, updatedAt: '2026-10-28T23:59:00+08:00' })
      }
      throw new Error(`ENOENT:${s}`)
    },
  })
}

/** 摘掉台账里某一族(反向对照用):其余内容逐字节不动,免得"翻红"是别的改动造成的。 */
function ledgerWithoutFamily(family) {
  const o = JSON.parse(REAL_LEDGER_TEXT)
  o.blueGreen.families = o.blueGreen.families.filter((f) => f.family !== family)
  return JSON.stringify(o)
}

/** 摘掉台账里某条静态登记(反向对照用),同样只动那一条。 */
function ledgerWithoutStatic(name) {
  const o = JSON.parse(REAL_LEDGER_TEXT)
  o.static = o.static.filter((s) => s.name !== name)
  return JSON.stringify(o)
}

const meas = (v) => ({ kind: 'measured', value: v })
const unverdicted = (reason) => ({ kind: 'unmeasured', reason })

/**
 * 一条"除了 STATE 之外全都量到且都好"的服务读数;级别与问题串一律由源判据 judgeService 现算
 * (测试不手写问题串 ⇒ 不会出现"夹具里的字符串与门里那把尺子漂移"这一型)。
 */
function svcRow(name, state, { port = 8851 } = {}) {
  const rec = {
    name,
    state: state === null ? unverdicted('该服务名不在 STATE 枚举结果里') : meas(state),
    application: meas('D:\\DevEnv\\runtimes\\node\\node.exe'),
    applicationSources: ['registry+nssm'],
    appExists: meas('file'),
    appDirectory: meas('D:/DevEnv/ihui-prod/apps/web'),
    appDirectoryExists: meas('dir'),
    ports: meas([port]),
    observed: state === 'RUNNING' ? meas({ endpoints: [{ address: '127.0.0.1', port, pid: 4321 }], truncated: false }) : meas({ endpoints: [], truncated: false }),
    probe: state === 'RUNNING' ? meas({ listening: true, ports: [port], labels: [`127.0.0.1:${port}`] }) : unverdicted('该服务不是 RUNNING,没有活进程可探'),
    nssmManaged: meas(true),
    runtime: state === 'RUNNING' ? meas({ verdict: 'fresh', detail: '脚本不比进程旧' }) : unverdicted('非 RUNNING ⇒ 没有活进程可与脚本比'),
  }
  const j = judgeService(rec)
  return { name, rec, level: j.level, problems: [...j.problems], blind: j.blind, hardBlind: j.hardBlind }
}

/** 走一遍"门读完台账后干什么":就地降级 + 返回 applied/kept/notes/families。 */
function gate(rows, expected) {
  return applyExpectedStopped(rows, expected)
}

test('台账自证:api 与 web 两族逐族登记,两族状态文件都量到时豁免集恰好是两枚冷备色(+ 两枚已退役单实例)', () => {
  const fams = blueGreenFamiliesOf(JSON.parse(REAL_LEDGER_TEXT))
  assert.deepEqual(fams.map((f) => f.family).sort(), ['api', 'web'], '两族必须在真台账里,且只有这两族')
  const r = loadRealLedger()
  assert.deepEqual(
    [...r.names.keys()].sort(),
    ['ihui-api', 'ihui-api-blue', 'ihui-web', 'ihui-web-blue'],
    'active=green 时该被免的只有两枚退役单实例与两族的 blue',
  )
  assert.deepEqual(r.families.map((f) => `${f.family}:${f.state}:${f.active}`).sort(), ['api:measured:green', 'web:measured:green'])
  // 三件套里的 router 与"活跃色"一起必须在射程内:router 绝不在豁免集里
  assert.equal(r.names.has('ihui-web-router'), false)
  assert.equal(r.names.has('ihui-api-router'), false)
  assert.equal(r.names.has('ihui-web-green'), false)
})

test('①web 冷备色按设计 Stop ⇒ 不报红(降为 skipped 并带上族/色出处)', () => {
  const rows = [svcRow('IHUI-WEB-BLUE', 'STOPPED')]
  assert.equal(rows[0].level, 'issue', '豁免前必须是 issue(judgeService 现算),否则这条例外在证明替身')
  const res = gate(rows, loadRealLedger())
  assert.equal(rows[0].level, 'skipped')
  assert.equal(rows[0].expectedStopped.source, 'blue-green')
  assert.equal(rows[0].expectedStopped.family, 'web')
  assert.equal(rows[0].expectedStopped.color, 'blue')
  assert.equal(res.applied.length, 1)
})

test('①反向对照:把 web 族从台账里摘掉 ⇒ 同一读数必须翻红(证明那条例外不是空转)', () => {
  const rows = [svcRow('IHUI-WEB-BLUE', 'STOPPED')]
  const res = gate(rows, loadRealLedger({ ledgerText: ledgerWithoutFamily('web') }))
  assert.equal(rows[0].level, 'issue', '摘掉条目后还"不报红" ⇒ 这条例外压根没生效,测试是假绿')
  assert.equal(res.applied.length, 0)
  assert.equal(rows[0].problems[0], stateProblemOf('STOPPED'))
})

test('①b 已退役的单实例 IHUI-WEB 停着不报红(它一旦起来就与 router 抢 8801)', () => {
  const rows = [svcRow('IHUI-WEB', 'STOPPED', { port: 8801 })]
  const res = gate(rows, loadRealLedger())
  assert.equal(rows[0].level, 'skipped')
  assert.equal(rows[0].expectedStopped.source, 'static')
  assert.equal(res.applied.length, 1)
})

test('①b 反向对照:摘掉 IHUI-WEB 那条静态登记 ⇒ 同一读数必须翻红(静态条目也不许是死配置)', () => {
  const rows = [svcRow('IHUI-WEB', 'STOPPED', { port: 8801 })]
  gate(rows, loadRealLedger({ ledgerText: ledgerWithoutStatic('IHUI-WEB') }))
  assert.equal(rows[0].level, 'issue')
})

test('②web 活跃色停着 ⇒ 报红,而同族冷备色仍被豁免(绝不把整族一起免掉)', () => {
  const rows = [svcRow('IHUI-WEB-GREEN', 'STOPPED', { port: 8852 }), svcRow('IHUI-WEB-BLUE', 'STOPPED', { port: 8851 })]
  const res = gate(rows, loadRealLedger({ webActive: 'green' }))
  assert.equal(rows[0].level, 'issue', '活跃色停着 = 全站 web 挂,必须照旧报红')
  assert.equal(rows[1].level, 'skipped')
  assert.equal(res.applied.length, 1)
})

test('②反向配对:状态文件改记 active=blue ⇒ 两色红绿互换(活跃色真由状态文件决定,不是写死的)', () => {
  const rows = [svcRow('IHUI-WEB-GREEN', 'STOPPED', { port: 8852 }), svcRow('IHUI-WEB-BLUE', 'STOPPED', { port: 8851 })]
  gate(rows, loadRealLedger({ webActive: 'blue' }))
  assert.equal(rows[0].level, 'skipped', '此时 green 才是冷备')
  assert.equal(rows[1].level, 'issue', '此时 blue 是活跃色,停着必须红')
})

test('③PAUSED 是显式真故障:即使那一色在豁免集里,也绝不并入"Stopped 属预期"', () => {
  const expected = loadRealLedger({ webActive: 'green' })
  const rows = [svcRow('IHUI-WEB-BLUE', 'PAUSED', { port: 8851 }), svcRow('IHUI-WEB-ROUTER', 'PAUSED', { port: 8801 })]
  const res = gate(rows, expected)
  assert.equal(rows[0].level, 'issue', '冷备色挂起 ⇒ 真故障档,台账免不到它')
  assert.match(rows[0].problems[0], /PAUSED/)
  assert.equal(res.applied.length, 0)
  assert.deepEqual(res.kept.map((k) => `${k.name}:${k.band}`), ['IHUI-WEB-BLUE:paused'])
  assert.match(res.kept[0].why, /挂起档/)
  // router 压根不在豁免集的射程里(唯一入口,停着/挂起都只能是真故障)
  assert.equal(expected.names.has('ihui-web-router'), false)
  assert.equal(rows[1].level, 'issue')
  assert.match(rows[1].problems[0], /挂起档/)
})

test('③反向对照:同一夹具把档位换成 STOPPED ⇒ 必须被豁免(证明上一条的翻红来自档位,不是夹具恒红)', () => {
  const rows = [svcRow('IHUI-WEB-BLUE', 'STOPPED', { port: 8851 })]
  const res = gate(rows, loadRealLedger({ webActive: 'green' }))
  assert.equal(rows[0].level, 'skipped')
  assert.equal(res.applied.length, 1)
})

test('③档位尺:Running/Stopped/Paused/过渡/未知五档互不并桶', () => {
  const bands = ['RUNNING', 'STOPPED', 'PAUSED', 'PAUSE_PENDING', 'START_PENDING', 'WHAT-IS-THIS', ''].map((v) => stateBandOf(v).band)
  assert.deepEqual(bands, ['running', 'stopped', 'paused', 'paused', 'pending', 'unknown', 'unknown'])
  assert.equal(stateProblemOf('RUNNING'), null, 'RUNNING 这一维没有坏值')
  assert.equal(stateProblemOf('STOPPED'), 'STATE=STOPPED', '只有这一串才是『停着是设计内』能免的那一条')
  assert.match(stateProblemOf('PAUSED'), /挂起档/)
})

test('④web 状态文件取不到 ⇒ 该族**未判定**(两色都不豁免),而 api 族不受牵连', () => {
  const expected = loadRealLedger({ webStateInPlace: false })
  const famWeb = expected.families.find((f) => f.family === 'web')
  assert.equal(famWeb.state, 'undetermined')
  assert.equal(expected.names.has('ihui-web-blue'), false, '状态文件读不到就猜"活跃色是 blue"= 把真故障淹在豁免里')
  assert.equal(expected.names.has('ihui-web-green'), false)
  assert.match(expected.notes.join('\n'), /蓝绿族 web:未判定/)
  const rows = [svcRow('IHUI-WEB-BLUE', 'STOPPED'), svcRow('IHUI-API-BLUE', 'STOPPED', { port: 8842 })]
  gate(rows, expected)
  assert.equal(rows[0].level, 'issue', 'web 族未判定 ⇒ 冷备色也照旧报红(多喊一次,不是多静音一次)')
  assert.equal(rows[1].level, 'skipped', 'api 族的状态文件在位 ⇒ 它的冷备色照旧按设计豁免')
})

test('④配对:两族状态文件都取不到 ⇒ 两族都未判定,蓝绿一枚都不豁免(不猜默认色;静态退役条目不属本维)', () => {
  const expected = loadRealLedger({ apiStateInPlace: false, webStateInPlace: false })
  assert.deepEqual(expected.families.map((f) => f.state).sort(), ['undetermined', 'undetermined'])
  assert.deepEqual([...expected.names.values()].filter((v) => v.source === 'blue-green'), [], '两族都取不到 ⇒ 蓝绿一枚都不许进豁免集')
  assert.match(expected.notes.join('\n'), /不豁免任何色/)
})

test('读数面:族的活跃色/未判定与挂起档必须逐条印出来(静默降级就是本票要修的形态)', () => {
  const rows = [svcRow('IHUI-WEB-BLUE', 'PAUSED'), svcRow('IHUI-WEB-GREEN', 'RUNNING'), svcRow('IHUI-WEB-ROUTER', 'STOPPED')]
  const es = gate(rows, loadRealLedger({ webStateInPlace: false }))
  const text = renderText({
    host: 'test-host',
    platform: 'win32',
    engine: null,
    channels: { state: meas({ rows: [] }), registry: unverdicted('构造面'), listen: unverdicted('构造面') },
    services: rows,
    expectedStopped: es,
    totals: {
      services: rows.length,
      issue: rows.filter((s) => s.level === 'issue').length,
      unattested: 0,
      ok: rows.filter((s) => s.level === 'ok').length,
      skipped: rows.filter((s) => s.level === 'skipped').length,
      expectedStopped: rows.filter((s) => s.expectedStopped).length,
      dimUnmeasured: { state: 0, application: 0, ports: 0, observed: 0, probe: 0, nssmManaged: 0 },
      stateBands: ['running', 'stopped', 'paused', 'pending', 'unknown'].reduce((acc, b) => {
        acc[b] = rows.filter((s) => s.rec.state.kind === 'measured' && stateBandOf(s.rec.state.value).band === b).length
        return acc
      }, {}),
    },
  })
  assert.match(text, /蓝绿族 web:未判定/)
  assert.match(text, /STATE 档位分桶/)
  assert.match(text, /挂起档真故障:IHUI-WEB-BLUE/)
  assert.match(text, /IHUI-WEB-GREEN/)
  assert.match(text, /IHUI-WEB-ROUTER/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
