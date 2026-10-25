// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 自进化调度层派发点的接线锁(2026-10-26 立,第 0 期装车)。
 *
 * 立因:四件器物(auto-evolve / auto-triage / dep-advisory-radar / check-gate-rot)全部入库,
 * 却**零派发点** —— §0.9「造好没装车 = 没有」。本文件钉住四层各自的行为约束:
 *  ① 装车成套:main tick 里恰有一处真调用、__test__ 恰有导出(注释里的示例不算);
 *  ② 节流有牙:同窗口第二次零调用;
 *  ③ 自进化「无活即零落地零推送」:无票 / 预算耗尽 / 成本熔断 / 锁在 / 派单面未判定 五档都不 spawn;
 *  ④ 结论不可解析一律落「未判定」,绝不冒充干净;
 *  ⑤ 判据腐烂只喊**新增**(存量只报数),邮件身份 = 类别+计数(明细不进指纹,§5e-1)。
 *
 * 判据 import 自 `../git-guardian.mjs` 的 `__test__`(§22c),本文件不重写任何业务判定。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ as G } from '../git-guardian.mjs'
import { todayKey } from '../auto-evolve.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const GUARDIAN_SRC = readFileSync(fileURLToPath(new URL('../git-guardian.mjs', import.meta.url)), 'utf8')
const NOW = Date.parse('2026-10-26T10:00:00+08:00')
const GATES = { enabled: true, dailyDispatchBudget: 6, ticketWhitelist: ['依赖升级', '安全通告'], sessionCommandTemplate: 'x' }

function harness() {
  const dir = mkScratch('gg-evolve2-')
  const logs = []
  const files = new Map()
  const readFile = (p) => (files.has(p) ? files.get(p) : readFileSync(p, 'utf8'))
  const exists = (p) => (files.has(p) ? true : existsSync(p))
  return { dir, logs, files, readFile, exists, logger: (l) => logs.push(String(l)) }
}

const face = (lines) => ['── 判定面(HEAD blob)──', ...lines].join('\n')

test('① 装车成套:四个派发点各在 main tick 恰有一处真调用 + __test__ 有导出', () => {
  for (const name of ['dispatchAutoEvolve', 'dispatchAutoTriage', 'dispatchDepAdvisoryRadar', 'dispatchGateRot']) {
    assert.equal(typeof G[name], 'function', `__test__ 缺 ${name}`)
    const calls = GUARDIAN_SRC.split('\n').filter((l) => l.trim() === `if (!CHECK_ONLY) ${name}()`)
    assert.equal(calls.length, 1, `${name} 的派发点必须恰有一处实调用,实得 ${calls.length}`)
  }
})

test('② 节流有牙:同窗口第二次零调用', () => {
  const h = harness()
  try {
    let calls = 0
    const opts = {
      now: NOW,
      tickFile: path.join(h.dir, 'tick.json'),
      logger: h.logger,
      runner: () => {
        calls += 1
        return { ok: true, out: '✅ 无发现' }
      },
    }
    assert.equal(G.dispatchAutoTriage(opts).ran, true)
    assert.equal(calls, 1)
    const second = G.dispatchAutoTriage({ ...opts, now: NOW + 60_000 })
    assert.equal(second.ran, false)
    assert.equal(second.why, '未到节流窗口')
    assert.equal(calls, 1)
    assert.equal(G.dispatchAutoTriage({ ...opts, now: NOW + 31 * 60 * 1000 }).ran, true)
    assert.equal(calls, 2)
  } finally {
    rmScratch(h.dir)
  }
})

test('③a 自进化:派单面 0 行 ⇒ 无票可派,零 spawn', () => {
  const h = harness()
  try {
    let launched = 0
    const r = G.dispatchAutoEvolve({
      now: NOW,
      tickFile: path.join(h.dir, 't.json'),
      logger: h.logger,
      gatesLoader: () => GATES,
      readFile: h.readFile,
      exists: h.exists,
      probe: () => ({ status: 0, stdout: face([]) }),
      launcher: () => {
        launched += 1
        return {}
      },
    })
    assert.equal(r.ok, true)
    assert.equal(r.why, '无票可派')
    assert.equal(launched, 0, '无活必须零 spawn')
    assert.ok(h.logs.some((l) => /无活可派/.test(l)))
  } finally {
    rmScratch(h.dir)
  }
})

test('③b 自进化:白名单命中才 spawn,参数钉死 --once --no-triage', () => {
  const h = harness()
  try {
    let args = null
    const r = G.dispatchAutoEvolve({
      now: NOW,
      tickFile: path.join(h.dir, 't.json'),
      logger: h.logger,
      gatesLoader: () => GATES,
      readFile: h.readFile,
      exists: h.exists,
      probe: () => ({
        status: 0,
        stdout: face(['  L10  - [ ] **依赖升级:安全通告消化** 正文', '  L11  - [ ] **无关票**:正文']),
      }),
      launcher: (a) => {
        args = a.args
        return {}
      },
    })
    assert.equal(r.spawned, true)
    assert.equal(r.candidates, 1)
    assert.ok(args[0].endsWith('auto-evolve.mjs'))
    assert.deepEqual(args.slice(1), ['--once', '--no-triage'])
  } finally {
    rmScratch(h.dir)
  }
})

test('③c 自进化:今日预算耗尽 ⇒ 不 spawn(否则每小时一封「预算耗尽」逃生邮件)', () => {
  const h = harness()
  try {
    const key = todayKey(new Date(NOW))
    h.files.set(
      'LEDGER',
      Array.from({ length: 6 }, () => JSON.stringify({ ts: `${key}T01:00:00.000Z`, action: 'dispatched' })).join('\n'),
    )
    let launched = 0
    const r = G.dispatchAutoEvolve({
      now: NOW,
      tickFile: path.join(h.dir, 't.json'),
      logger: h.logger,
      ledgerFile: 'LEDGER',
      gatesLoader: () => GATES,
      readFile: h.readFile,
      exists: h.exists,
      probe: () => {
        throw new Error('预算耗尽时不得再读取票面')
      },
      launcher: () => {
        launched += 1
        return {}
      },
    })
    assert.equal(r.why, '预算耗尽')
    assert.equal(launched, 0)
  } finally {
    rmScratch(h.dir)
  }
})

test('③d 自进化:器物锁持有者存活 ⇒ 让路', () => {
  const h = harness()
  try {
    h.files.set('LOCK', JSON.stringify({ pid: process.pid }))
    let launched = 0
    const r = G.dispatchAutoEvolve({
      now: NOW,
      tickFile: path.join(h.dir, 't.json'),
      logger: h.logger,
      lockFile: 'LOCK',
      gatesLoader: () => GATES,
      readFile: h.readFile,
      exists: h.exists,
      probe: () => {
        throw new Error('锁在时不得再读取票面')
      },
      launcher: () => {
        launched += 1
        return {}
      },
    })
    assert.equal(r.why, '上一轮在跑')
    assert.equal(launched, 0)
  } finally {
    rmScratch(h.dir)
  }
})

test('③e 自进化:闸门配置坏 / 派单面未判定 ⇒ ok=false 且零 spawn(§0.3)', () => {
  const h = harness()
  try {
    let launched = 0
    const base = {
      now: NOW,
      logger: h.logger,
      readFile: h.readFile,
      exists: h.exists,
      launcher: () => {
        launched += 1
        return {}
      },
    }
    const badGates = G.dispatchAutoEvolve({
      ...base,
      tickFile: path.join(h.dir, 't1.json'),
      gatesLoader: () => {
        throw new Error('形状坏')
      },
    })
    assert.equal(badGates.ok, false)
    assert.equal(badGates.why, '闸门配置未判定')
    const badFace = G.dispatchAutoEvolve({
      ...base,
      tickFile: path.join(h.dir, 't2.json'),
      gatesLoader: () => GATES,
      probe: () => ({ status: 1, stdout: '', stderr: 'boom' }),
    })
    assert.equal(badFace.ok, false)
    assert.equal(badFace.why, '派单面未判定')
    assert.equal(launched, 0)
  } finally {
    rmScratch(h.dir)
  }
})

test('④a 判据腐烂:新增才喊人,身份 = 类别+计数(明细不进 dedupKey)', () => {
  const h = harness()
  try {
    const mails = []
    const r = G.dispatchGateRot({
      now: NOW,
      tickFile: path.join(h.dir, 't1.json'),
      logger: h.logger,
      runner: () => ({
        ok: true,
        out: JSON.stringify({
          overall: 'new',
          rot: [{ source: 'judgement-libs', resolved: 'scripts/lib/x.mjs' }],
          newRot: [{ source: 'judgement-libs', resolved: 'scripts/lib/x.mjs' }],
        }),
      }),
      notifier: (name, detail, opts) => mails.push({ name, detail, opts }),
    })
    assert.equal(r.ok, false)
    assert.equal(r.fresh, 1)
    assert.equal(mails.length, 1)
    assert.equal(mails[0].opts.dedupKey, 'gate-rot:new:1')
    assert.ok(!mails[0].opts.dedupKey.includes('x.mjs'), '明细路径不得进邮件身份')
    assert.ok(mails[0].detail.includes('scripts/lib/x.mjs'), '明细必须在正文里点名')

    const known = G.dispatchGateRot({
      now: NOW,
      tickFile: path.join(h.dir, 't2.json'),
      logger: h.logger,
      runner: () => ({
        ok: true,
        out: JSON.stringify({
          overall: 'known',
          rot: [{ source: 'judgement-libs', resolved: 'scripts/lib/x.mjs' }],
          newRot: [],
        }),
      }),
      notifier: () => mails.push({ name: 'should-not-send' }),
    })
    assert.equal(known.ok, true)
    assert.equal(known.known, 1)
    assert.equal(mails.length, 1, '存量腐烂不得喊人')
  } finally {
    rmScratch(h.dir)
  }
})

test('④b 判据腐烂:undetermined / 不可解析 ⇒ ok=false(不记绿)', () => {
  const h = harness()
  try {
    const u = G.dispatchGateRot({
      now: NOW,
      tickFile: path.join(h.dir, 't1.json'),
      logger: h.logger,
      runner: () => ({ ok: true, out: JSON.stringify({ overall: 'undetermined', undetermined: [{ why: '读不到注册表' }] }) }),
      notifier: () => assert.fail('未判定不得喊新增'),
    })
    assert.equal(u.ok, false)
    assert.equal(u.why, '未判定')
    const bad = G.dispatchGateRot({
      now: NOW,
      tickFile: path.join(h.dir, 't2.json'),
      logger: h.logger,
      runner: () => ({ ok: true, out: 'not json' }),
    })
    assert.equal(bad.ok, false)
    assert.equal(bad.why, '结论不可解析')
  } finally {
    rmScratch(h.dir)
  }
})

test('④c 依赖通告:JSON 读数进日志;未判定/不可解析 ⇒ ok=false', () => {
  const h = harness()
  try {
    const ok = G.dispatchDepAdvisoryRadar({
      now: NOW,
      tickFile: path.join(h.dir, 't1.json'),
      logger: h.logger,
      runner: () => ({
        ok: true,
        out: 'noise\n{"overall":"tickets","advisories":257,"candidates":80,"tickets":[{"module":"a"}],"suppressed":77,"registered":["a"]}\n',
      }),
    })
    assert.equal(ok.ok, true)
    assert.equal(ok.tickets, 1)
    assert.equal(ok.registered, 1)
    const und = G.dispatchDepAdvisoryRadar({
      now: NOW,
      tickFile: path.join(h.dir, 't2.json'),
      logger: h.logger,
      runner: () => ({ ok: true, out: '{"overall":"undetermined","why":"pnpm audit rc=1"}' }),
    })
    assert.equal(und.ok, false)
    const bad = G.dispatchDepAdvisoryRadar({
      now: NOW,
      tickFile: path.join(h.dir, 't3.json'),
      logger: h.logger,
      runner: () => ({ ok: true, out: 'no json here' }),
    })
    assert.equal(bad.ok, false)
  } finally {
    rmScratch(h.dir)
  }
})

test('⑤ 分诊轮:登记/未判定计数进读数,失败不冒充成功', () => {
  const h = harness()
  try {
    const r = G.dispatchAutoTriage({
      now: NOW,
      tickFile: path.join(h.dir, 't1.json'),
      logger: h.logger,
      runner: () => ({ ok: true, out: '分诊轮:今日已登记 1/3\n  ℹ grafana-alerts:未判定(x)\n  ✅ 已登记:某票' }),
    })
    assert.equal(r.registered, 1)
    assert.equal(r.undetermined, 1)
    const bad = G.dispatchAutoTriage({
      now: NOW,
      tickFile: path.join(h.dir, 't2.json'),
      logger: h.logger,
      runner: () => ({ ok: false, out: '', err: 'boom' }),
    })
    assert.equal(bad.ok, false)
  } finally {
    rmScratch(h.dir)
  }
})

test('⑥ 断言在盘:器物文件必须存在(派发点指向缺失文件 ⇒ 恒未判定)', () => {
  for (const f of ['auto-evolve.mjs', 'auto-triage.mjs', 'dep-advisory-radar.mjs', 'check-gate-rot.mjs']) {
    assert.ok(existsSync(fileURLToPath(new URL(`../${f}`, import.meta.url))), `缺器物 ${f}`)
  }
})
