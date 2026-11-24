#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `deploy/win/ihui-canary-stage.mjs` 的镜像测试(§22c:判据 import 源脚本,本文件不复制判据)。
 *
 * 钉「金丝雀发布」票面的编排层 —— 「这一轮判定之后该做什么」:
 *  ① 动作面:pass ⇒ advance / pass 且末档 ⇒ promote / fail ⇒ rollback / unknown ⇒ hold。
 *  ② 失败面:非法 verdict、空档位表、未知当前档位 ⇒ 抛 TrafficShapeError(不猜、不默认)。
 *  ③ 起始契约:进灰度期取档位表第一档(比例最小的那一档,不是 100)。
 *  ④ 契约读写:缺失/坏 JSON ⇒ null(调用方按「不在灰度期」处理);写为原子(改名,不留半份)。
 *  ⑤ 灰期采样策略:web-origin 改指 canary 槽位,api/llm 源站不动。
 *  ⑥ CLI 面:--init / --decide / --status 三条出口的落盘行为与退出码。
 *
 * 本文件不连生产、不连真实部署环:只读仓内策略文件 + 临时目录里的契约文件。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { mkScratch, rmScratch } from '../../scripts/lib/scratch-dir.mjs'
import {
  decideStageAction,
  initRampContract,
  readRampContract,
  writeRampContract,
  graySamplingPolicy,
  ACTIONS,
  CONTRACT_PATH,
  POLICY_PATH,
  EXIT_UNKNOWN,
} from '../win/ihui-canary-stage.mjs'
import { loadTrafficPolicy, TrafficShapeError } from '../../scripts/canary-traffic.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const STAGE_CLI = join(ROOT, 'deploy', 'win', 'ihui-canary-stage.mjs')

const STAGES = [
  { id: 'ramp-1', percent: 1 },
  { id: 'ramp-2', percent: 5 },
  { id: 'ramp-3', percent: 25 },
  { id: 'ramp-full', percent: 100 },
]

const REAL_POLICY = loadTrafficPolicy(readFileSync(POLICY_PATH, 'utf8'))

// 临时夹具落点 = scripts/lib/scratch-dir.mjs 唯一出口(§15b;不得用 os.tmpdir(),
// 进程 TEMP 可能钉在 C 盘 ⇒ 门 155 的名单型判据)。
const withTemp = (fn) => {
  const dir = mkScratch('ihui-canary-stage-')
  try {
    return fn(dir)
  } finally {
    rmScratch(dir)
  }
}

const runCli = (args, opts = {}) => {
  const r = spawnSync(process.execPath, [STAGE_CLI, ...args], {
    encoding: 'utf8',
    cwd: ROOT,
    windowsHide: true, // §5b 派生进程纪律:不得因机器级钩子省略逐点参数
    ...opts,
  })
  return { rc: r.status, out: String(r.stdout || ''), err: String(r.stderr || '') }
}

// ── T1 动作面:四种动作 ──────────────────────────────────────────────
test('T1 decideStageAction:pass⇒advance、末档 pass⇒promote、fail⇒rollback、unknown⇒hold', () => {
  const adv = decideStageAction({ verdict: 'pass', currentStage: '', stages: STAGES })
  assert.equal(adv.action, 'advance')
  assert.equal(adv.stage, 'ramp-1')
  assert.equal(adv.percent, 1)
  assert.equal(adv.changed, true)

  const adv2 = decideStageAction({ verdict: 'pass', currentStage: 'ramp-2', stages: STAGES })
  assert.equal(adv2.action, 'advance')
  assert.equal(adv2.stage, 'ramp-3')
  assert.equal(adv2.percent, 25)

  // 末档再 pass ⇒ 已无「下一档」⇒ promote(可全量切流),不是 advance。
  const pro = decideStageAction({ verdict: 'pass', currentStage: 'ramp-full', stages: STAGES })
  assert.equal(pro.action, 'promote')
  assert.equal(pro.stage, 'ramp-full')
  assert.equal(pro.percent, 100)
  assert.equal(pro.changed, false)

  // fail ⇒ rollback ⇒ 灰度流量归零(撤灰度,不是整份退包)。
  const rb = decideStageAction({ verdict: 'fail', currentStage: 'ramp-3', stages: STAGES })
  assert.equal(rb.action, 'rollback')
  assert.equal(rb.stage, 'off')
  assert.equal(rb.percent, 0)
  assert.equal(rb.changed, true)

  // unknown ⇒ hold ⇒ 原地不动(不放量也不回滚)。
  const hd = decideStageAction({ verdict: 'unknown', currentStage: 'ramp-2', stages: STAGES })
  assert.equal(hd.action, 'hold')
  assert.equal(hd.stage, 'ramp-2')
  assert.equal(hd.percent, 5)
  assert.equal(hd.changed, false)
})

// ── T2 动作闭集 ─────────────────────────────────────────────────────
test('T2 动作闭集:decideStageAction 只会吐出 ACTIONS 里的动作', () => {
  for (const verdict of ['pass', 'fail', 'unknown']) {
    for (const cur of ['', 'ramp-1', 'ramp-full']) {
      const a = decideStageAction({ verdict, currentStage: cur, stages: STAGES })
      assert.ok(ACTIONS.includes(a.action), `动作 ${a.action} 不在闭集内`)
    }
  }
})

// ── T3 失败面:形状坏一律抛,不猜 ────────────────────────────────────
test('T3 失败面:非法 verdict / 空档位表 / 未知当前档位 ⇒ 抛 TrafficShapeError', () => {
  assert.throws(() => decideStageAction({ verdict: 'banana', currentStage: 'ramp-1', stages: STAGES }), TrafficShapeError)
  assert.throws(() => decideStageAction({ verdict: '', currentStage: 'ramp-1', stages: STAGES }), TrafficShapeError)
  assert.throws(() => decideStageAction({ verdict: 'pass', currentStage: 'ramp-1', stages: [] }), TrafficShapeError)
  assert.throws(() => decideStageAction({ verdict: 'pass', currentStage: 'ramp-1', stages: null }), TrafficShapeError)
  assert.throws(() => decideStageAction({ verdict: 'pass', currentStage: 'ramp-9', stages: STAGES }), TrafficShapeError)
  assert.throws(() => decideStageAction({}), TrafficShapeError)
})

// ── T4 起始契约 ─────────────────────────────────────────────────────
test('T4 initRampContract:比例取档位表第一档(最小档),不是 100', () => {
  const c = initRampContract(REAL_POLICY, { sha: 'abc123', now: '2026-10-27T00:00:00Z' })
  assert.equal(c.stage, 'ramp-1')
  assert.equal(c.percent, 1)
  assert.equal(c.deploySha, 'abc123')
  assert.equal(c.slots.stable.port, 8801)
  assert.equal(c.slots.canary.port, 8845)
  assert.equal(c.routingKeyHeader, 'x-ihui-canary-key')
  assert.equal(c.tagHeader, 'x-canary-tag')
  assert.equal(c.updatedAt, '2026-10-27T00:00:00.000Z')
  assert.throws(() => initRampContract({ stages: [] }), TrafficShapeError)
  assert.throws(() => initRampContract(null), TrafficShapeError)
})

// ── T5 契约读:坏契约 ⇒ null(不得回落默认值放量) ────────────────────
test('T5 readRampContract:缺失/坏 JSON/数组 ⇒ null;合法 ⇒ 原样读出', () => {
  withTemp((dir) => {
    assert.equal(readRampContract(join(dir, 'nope.json')), null)
    const bad = join(dir, 'bad.json')
    writeFileSync(bad, '{not json', 'utf8')
    assert.equal(readRampContract(bad), null)
    const arr = join(dir, 'arr.json')
    writeFileSync(arr, '[]', 'utf8')
    assert.equal(readRampContract(arr), null)
    const nul = join(dir, 'nul.json')
    writeFileSync(nul, 'null', 'utf8')
    assert.equal(readRampContract(nul), null)
    const good = join(dir, 'good.json')
    writeFileSync(good, JSON.stringify({ v: 1, stage: 'ramp-1', percent: 1 }), 'utf8')
    const got = readRampContract(good)
    assert.equal(got.stage, 'ramp-1')
    assert.equal(got.percent, 1)
  })
})

// ── T6 契约写:原子落盘,不留半份/临时残迹 ────────────────────────────
test('T6 writeRampContract:原子写(先临时文件再改名),目录自建,不留 .tmp 残迹', () => {
  withTemp((dir) => {
    const out = join(dir, 'nested', 'deeper', 'ramp.json')
    const contract = initRampContract(REAL_POLICY, { sha: 'sha-1' })
    const written = writeRampContract(contract, out)
    assert.equal(written, resolve(out))
    assert.ok(existsSync(out))
    const back = JSON.parse(readFileSync(out, 'utf8'))
    assert.equal(back.stage, 'ramp-1')
    assert.equal(back.percent, 1)
    const leftovers = readdirSync(dirname(out)).filter((f) => f.endsWith('.tmp'))
    assert.deepEqual(leftovers, [], `残留临时文件:${leftovers.join(',')}`)
  })
})

// ── T7 灰期采样策略:只改 grayEndpoints 里的源站端点 ─────────────────
test('T7 graySamplingPolicy:web-origin 改指 canary 槽位 8845,api 源站与公网腿不动,原策略不被就地改', () => {
  const gray = graySamplingPolicy(REAL_POLICY, 'ramp-1')
  const web = gray.endpoints.find((e) => e.id === 'web-origin')
  const api = gray.endpoints.find((e) => e.id === 'api-origin')
  const llm = gray.endpoints.find((e) => e.id === 'llm-origin')
  const webPub = gray.endpoints.find((e) => e.id === 'web-public')
  assert.equal(new URL(web.url).port, '8845')
  assert.equal(new URL(api.url).port, '8802')
  assert.equal(new URL(llm.url).port, '8803')
  assert.equal(new URL(webPub.url).port, '')
  // 原策略对象不得被就地改(否则第二次派生会叠加)。
  const origWeb = REAL_POLICY.endpoints.find((e) => e.id === 'web-origin')
  assert.equal(new URL(origWeb.url).port, '8801')
  // off 档 ⇒ 不派生。
  assert.equal(new URL(graySamplingPolicy(REAL_POLICY, 'off').endpoints.find((e) => e.id === 'web-origin').url).port, '8801')
})

// ── T8 真实策略文件:档位表与槽位 ────────────────────────────────────
test('T8 真实策略文件 scripts/data/canary-policy.json:档位表/槽位/灰度端点符合契约', () => {
  assert.deepEqual(REAL_POLICY.stages.map((s) => s.id), ['ramp-1', 'ramp-2', 'ramp-3', 'ramp-full'])
  assert.deepEqual(REAL_POLICY.stages.map((s) => s.percent), [1, 5, 25, 100])
  assert.equal(REAL_POLICY.slots.stable.port, 8801)
  assert.equal(REAL_POLICY.slots.canary.port, 8845)
  assert.deepEqual(REAL_POLICY.grayEndpoints, ['web-origin'])
  assert.equal(REAL_POLICY.bucketSalt, 'ihui-deploy-canary')
  // 默认契约路径落在仓内状态目录。
  assert.ok(CONTRACT_PATH.includes(join('.ihui-agent', 'state', 'canary')))
})

// ── T9 CLI 面:三条出口的落盘行为与退出码 ────────────────────────────
test('T9 CLI:--init 落盘第一档 / --decide 升档 / --decide fail 落比例归零契约 / 非法 verdict ⇒ exit 2', () => {
  withTemp((dir) => {
    const contract = join(dir, 'ramp.json')

    // --init ⇒ 落盘第一档(1%)。
    const init = runCli(['--init', '--sha', 'sha-init', '--contract', contract])
    assert.equal(init.rc, 0, init.err)
    const afterInit = JSON.parse(readFileSync(contract, 'utf8'))
    assert.equal(afterInit.stage, 'ramp-1')
    assert.equal(afterInit.percent, 1)

    // --decide pass ⇒ 升到第二档(5%)并落盘。
    const adv = runCli(['--decide', '--verdict', 'pass', '--current', 'ramp-1', '--contract', contract])
    assert.equal(adv.rc, 0, adv.err)
    const afterAdv = JSON.parse(readFileSync(contract, 'utf8'))
    assert.equal(afterAdv.stage, 'ramp-2')
    assert.equal(afterAdv.percent, 5)
    assert.equal(JSON.parse(adv.out).action, 'advance')

    // --decide unknown ⇒ hold,契约不动(仍 5%)。
    const hold = runCli(['--decide', '--verdict', 'unknown', '--current', 'ramp-2', '--contract', contract])
    assert.equal(hold.rc, 0, hold.err)
    assert.equal(JSON.parse(hold.out).action, 'hold')
    assert.equal(JSON.parse(readFileSync(contract, 'utf8')).percent, 5)

    // --decide fail ⇒ rollback,契约比例归零(分流器下一次读就是全走 stable)。
    const rb = runCli(['--decide', '--verdict', 'fail', '--current', 'ramp-2', '--contract', contract])
    assert.equal(rb.rc, 0, rb.err)
    assert.equal(JSON.parse(rb.out).action, 'rollback')
    const afterRb = JSON.parse(readFileSync(contract, 'utf8'))
    assert.equal(afterRb.stage, 'off')
    assert.equal(afterRb.percent, 0)

    // --status ⇒ 归零后不在灰度期。
    const st = runCli(['--status', '--contract', contract])
    assert.equal(st.rc, 0, st.err)
    const stDoc = JSON.parse(st.out)
    assert.equal(stDoc.inGray, false)
    assert.equal(stDoc.percent, 0)

    // 非法 verdict ⇒ 未判定(exit 2),且不写契约。
    const bad = runCli(['--decide', '--verdict', 'banana', '--current', 'ramp-1', '--contract', contract])
    assert.equal(bad.rc, EXIT_UNKNOWN)
    assert.equal(JSON.parse(readFileSync(contract, 'utf8')).percent, 0)
  })
})

// ── T10 CLI 面:缺策略文件 ⇒ 未判定(exit 2) ──────────────────────────
test('T10 CLI:策略文件不存在 ⇒ exit 2(不猜默认比例)', () => {
  withTemp((dir) => {
    const r = runCli(['--status', '--policy', join(dir, 'no-such-policy.json'), '--contract', join(dir, 'ramp.json')])
    assert.equal(r.rc, EXIT_UNKNOWN)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
