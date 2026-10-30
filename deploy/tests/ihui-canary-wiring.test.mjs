#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「金丝雀发布 · 灰度分流」的三条硬判据 + 接线锁(O65 第 2 期 · 2026-10-28 装车批)。
 *
 * §22c:判据一律 import 源脚本,本文件不复制第二份判据。
 *
 *  ① 改 policy 即改分流   —— 档位比例与灰度槽位端口只住 scripts/data/canary-policy.json 一处;
 *                            同一命令行喂两份策略文件,输出必须跟着策略走;策略里没有 traffic 段
 *                            ⇒ 未判定(exit 2),结构上不存在"内置默认比例"。
 *  ② 异常阈值触发回滚调用 —— 候选全失败样本 ⇒ canary-verdict rc=3(fail)⇒ stage 动作 rollback
 *                            ⇒ 落盘契约比例归零(分流器下一次读契约就是"全回现网");
 *                            正向对照:全通过 ⇒ rc=0 ⇒ advance 到档位表下一档(比例仍取自策略)。
 *  ③ 摘掉接线即翻红       —— 生产判据 wiringGaps 与 CLI 双双真跑成对变异夹具:每一根线
 *                            (stage 调用 / gray 进程编排 / 灰期策略派生 / --verdict 推进 /
 *                            撤灰度 stop / 整包回滚出口)被摘掉都必须翻红;被审文件取不到
 *                            ⇒ 未判定(exit 2),不记绿也不冒红。
 *  ④ 进程编排(需 PowerShell 7)—— 灰度槽位端口按契约现读而不是写死;-SplitOnly 真起真停分流器。
 *                            取不到 pwsh ⇒ 该档 skip 并如实写"未判定",不拿"没跑"当"跑过"。
 *
 * 本文件不连生产、不部署、不回滚:灰度实例与上游都是本地假端口/临时契约文件。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import net from 'node:net'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { mkScratch, rmScratch } from '../../scripts/lib/scratch-dir.mjs'
import { __test__ as WIRING } from '../win/ihui-canary-wiring.mjs'
import { loadTrafficPolicy } from '../../scripts/canary-traffic.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const WIRING_CLI = join(ROOT, 'deploy', 'win', 'ihui-canary-wiring.mjs')
const STAGE_CLI = join(ROOT, 'deploy', 'win', 'ihui-canary-stage.mjs')
const TRAFFIC_CLI = join(ROOT, 'scripts', 'canary-traffic.mjs')
const VERDICT_CLI = join(ROOT, 'scripts', 'canary-verdict.mjs')
const GRAY_PS1 = join(ROOT, 'deploy', 'win', 'ihui-canary-gray.ps1')
const LOOP_PS1 = WIRING.DEFAULT_LOOP_PS1
const POLICY_PATH = join(ROOT, 'scripts', 'data', 'canary-policy.json')

// 期望值一律从策略文件现读(§0.1 凡数字现读),本文件不抄第二份数值。
const REAL = loadTrafficPolicy(readFileSync(POLICY_PATH, 'utf8'))

const run = (exe, args, opts = {}) => {
  const r = spawnSync(exe, args, { encoding: 'utf8', cwd: ROOT, windowsHide: true, timeout: 180_000, ...opts })
  return { rc: r.status, out: String(r.stdout ?? ''), err: String(r.stderr ?? '') }
}
const runNode = (script, args, opts = {}) => run(process.execPath, [script, ...args], opts)

/** 策略副本:只改被检的那一格,其余逐字沿用仓内策略。 */
function policyCopy(dir, name, mutate) {
  const doc = JSON.parse(readFileSync(POLICY_PATH, 'utf8'))
  mutate(doc)
  const p = join(dir, name)
  writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  return p
}

/** 先 bind 再 close 拿一个当前没人监听的端口(模拟"灰度实例不在位")。 */
async function freePort() {
  const s = createServer(() => {})
  await new Promise((r) => s.listen(0, '127.0.0.1', r))
  const port = s.address().port
  await new Promise((r) => s.close(r))
  return port
}

const portAnswers = (port, timeoutMs = 1200) =>
  new Promise((res) => {
    const s = net.connect({ host: '127.0.0.1', port })
    const done = (ok) => {
      try {
        s.destroy()
      } catch {
        /* 已断开 */
      }
      res(ok)
    }
    s.setTimeout(timeoutMs, () => done(false))
    s.once('connect', () => done(true))
    s.once('error', () => done(false))
  })

const sampleLine = (endpoint, kind, verdict, ms) =>
  JSON.stringify({
    v: 1,
    ts: '2026-10-28T00:00:00.000Z',
    stage: 'candidate',
    endpoint,
    kind,
    verdict,
    status: verdict === 'pass' ? 200 : 500,
    ms,
  })

/** 按策略 minSamples 现读造一批同判决样本(样本数不足会被判"未判定",那是另一格)。 */
function samplesFor(dir, name, verdict) {
  const ids = REAL.endpoints.filter((e) => e.kind === 'origin').map((e) => e.id)
  assert.ok(ids.length > 0, '策略里一条 origin 腿都没有 ⇒ 造不出可判样本')
  const n = Math.max(REAL.thresholds.minSamples, 2)
  const lines = []
  for (let i = 0; i < n; i += 1) for (const id of ids) lines.push(sampleLine(id, 'origin', verdict, 10))
  const p = join(dir, name)
  writeFileSync(p, `${lines.join('\n')}\n`, 'utf8')
  return p
}

// ── ① 改 policy 即改分流 ────────────────────────────────────────────────────
test('T1 比例与灰度槽位端口只住 canary-policy.json:换策略文件 ⇒ 分流跟着换', async () => {
  const dir = mkScratch('canary-wiring-t1-')
  try {
    // 现策略:起始档比例 = 档位表第一档,槽位端口 = traffic.slots.canary.port
    const realInit = runNode(STAGE_CLI, ['--init', '--sha', 'sha-real', '--contract', join(dir, 'ramp-real.json')])
    assert.equal(realInit.rc, 0, `${realInit.out}\n${realInit.err}`)
    const c0 = JSON.parse(realInit.out).contract
    assert.equal(c0.percent, REAL.stages[0].percent, '起始比例必须等于策略档位表第一档')
    assert.equal(c0.slots.canary.port, REAL.slots.canary.port, '灰度槽位端口必须等于策略 slots.canary.port')

    // 改策略(档位表 + 灰度槽位端口)⇒ 同一条命令行输出同步变
    const altCanary = await freePort()
    const p2 = policyCopy(dir, 'policy-alt.json', (doc) => {
      doc.traffic.stages = [
        { id: 'ramp-a', percent: 42 },
        { id: 'ramp-b', percent: 51 },
        { id: 'ramp-full', percent: 100 },
      ]
      doc.traffic.slots.canary.port = altCanary
    })
    const altInit = runNode(STAGE_CLI, ['--init', '--sha', 'sha-alt', '--policy', p2, '--contract', join(dir, 'ramp-alt.json')])
    assert.equal(altInit.rc, 0, `${altInit.out}\n${altInit.err}`)
    const c1 = JSON.parse(altInit.out).contract
    assert.equal(c1.percent, 42, '改了策略的档位表却没改到分流比例 ⇒ 代码里藏着第二份数值')
    assert.equal(c1.slots.canary.port, altCanary)
    assert.notEqual(c1.percent, c0.percent)

    // 推进档同样跟随
    const adv = runNode(TRAFFIC_CLI, ['--advance', '--policy', p2, '--verdict', 'pass', '--current', 'off'])
    assert.equal(adv.rc, 0, adv.err)
    assert.equal(JSON.parse(adv.out).percent, 42)

    // 灰期采样策略:被列进 grayEndpoints 的源站端点改指**策略里那一份**端口
    const gp = join(dir, 'gray-policy.json')
    const derived = runNode(TRAFFIC_CLI, ['--gray-policy', '--policy', p2, '--stage', 'ramp-a', '--out', gp])
    assert.equal(derived.rc, 0, derived.err)
    const ddoc = JSON.parse(readFileSync(gp, 'utf8'))
    const web = ddoc.endpoints.find((e) => e.id === REAL.grayEndpoints[0])
    assert.equal(new URL(web.url).port, String(altCanary), '灰期采样目标没有跟着策略端口走')
    const api = ddoc.endpoints.find((e) => e.id === 'api-origin')
    const apiReal = REAL.endpoints.find((e) => e.id === 'api-origin')
    assert.equal(new URL(api.url).port, new URL(apiReal.url).port, '不在 grayEndpoints 里的源站端点被误改')

    // 反向对照:把 traffic 段整个摘掉 ⇒ 未判定(exit 2),而不是回落某个默认比例
    const p3 = policyCopy(dir, 'policy-notraffic.json', (doc) => {
      delete doc.traffic
    })
    const noTraffic = runNode(STAGE_CLI, ['--init', '--sha', 'sha-x', '--policy', p3, '--contract', join(dir, 'none.json')])
    assert.equal(noTraffic.rc, 2, `策略缺 traffic 段必须未判定,实得 rc=${noTraffic.rc}`)
    assert.match(`${noTraffic.out}${noTraffic.err}`, /未判定/)
    assert.ok(!existsSync(join(dir, 'none.json')), '未判定不得留下半份契约')
  } finally {
    rmScratch(dir)
  }
})

// ── ② 异常阈值触发回滚调用 ──────────────────────────────────────────────────
test('T2 观察窗判死 ⇒ 契约比例归零(撤灰度),判通过 ⇒ 升到档位表下一档', () => {
  const dir = mkScratch('canary-wiring-t2-')
  try {
    const bad = samplesFor(dir, 'candidate-fail.jsonl', 'fail')
    const d = runNode(VERDICT_CLI, ['--decide', '--candidate', bad, '--json'])
    assert.equal(d.rc, 3, `候选全 5xx 必须判 fail(rc=3),实得 rc=${d.rc} out=${d.out} err=${d.err}`)
    assert.equal(JSON.parse(d.out).verdict, 'fail')

    const contract = join(dir, 'ramp.json')
    const init = runNode(STAGE_CLI, ['--init', '--sha', 'sha-1', '--contract', contract])
    assert.equal(init.rc, 0, init.err)

    // 部署环按 rc→verdict 的同一映射把结论喂给档位层:fail ⇒ rollback ⇒ 契约归零
    const dec = runNode(STAGE_CLI, [
      '--decide',
      '--verdict',
      'fail',
      '--current',
      REAL.stages[1].id,
      '--sha',
      'sha-1',
      '--contract',
      contract,
    ])
    assert.equal(dec.rc, 0, `${dec.out}\n${dec.err}`)
    const act = JSON.parse(dec.out)
    assert.equal(act.action, 'rollback')
    assert.equal(act.stage, 'off')
    assert.equal(act.percent, 0)
    assert.equal(JSON.parse(readFileSync(contract, 'utf8')).percent, 0, '契约没落盘 ⇒ 分流器下一次读到的还是老比例')

    // 正向对照:同一批命令行喂"全通过"样本 ⇒ rc=0 ⇒ 升到策略里的下一档,不是归零
    const good = samplesFor(dir, 'candidate-pass.jsonl', 'pass')
    const dp = runNode(VERDICT_CLI, ['--decide', '--candidate', good, '--json'])
    assert.equal(dp.rc, 0, `候选全绿必须 pass(rc=0),实得 rc=${dp.rc} out=${dp.out}`)
    const adv = runNode(STAGE_CLI, [
      '--decide',
      '--verdict',
      'pass',
      '--current',
      REAL.stages[0].id,
      '--sha',
      'sha-1',
      '--contract',
      contract,
    ])
    assert.equal(adv.rc, 0, adv.err)
    const advDoc = JSON.parse(adv.out)
    assert.equal(advDoc.action, 'advance')
    assert.equal(advDoc.percent, REAL.stages[1].percent, '升档后的比例必须等于档位表下一档')
    assert.equal(JSON.parse(readFileSync(contract, 'utf8')).percent, REAL.stages[1].percent)

    // unknown ⇒ 原地不动:没有证据既不放量也不回滚(这一格坏掉就是"判不了就乱动")
    const hold = runNode(STAGE_CLI, ['--decide', '--verdict', 'unknown', '--current', REAL.stages[1].id, '--contract', contract])
    assert.equal(hold.rc, 0, hold.err)
    assert.equal(JSON.parse(hold.out).action, 'hold')
    assert.equal(JSON.parse(readFileSync(contract, 'utf8')).percent, REAL.stages[1].percent)
  } finally {
    rmScratch(dir)
  }
})

// ── ③ 摘掉接线即翻红 ────────────────────────────────────────────────────────
test('T3 接线锁:真部署环零缺口,摘掉任一根线即翻红,取不到输入即未判定', () => {
  const dir = mkScratch('canary-wiring-t3-')
  try {
    const text = readFileSync(LOOP_PS1, 'utf8')
    assert.deepEqual(WIRING.wiringGaps(text), [], 'deploy-loop 的 canary 段应零缺口(接线在位)')

    const ok = runNode(WIRING_CLI, ['--check'])
    assert.equal(ok.rc, 0, ok.out + ok.err)

    // 判据自证必须全绿(例数以末行现读,不在本文件钉数字)
    const st = runNode(WIRING_CLI, ['--self-test'])
    assert.equal(st.rc, 0, st.out + st.err)
    assert.match(st.out, /失败 0/)
    assert.ok(!st.out.includes('FAIL'), `自证里有 FAIL 行却按 0 失败收口:${st.out}`)

    const missing = runNode(WIRING_CLI, ['--check', '--file', join(dir, 'no-such-loop.ps1')])
    assert.equal(missing.rc, 2, `被审文件取不到必须未判定(rc=2),实得 rc=${missing.rc}`)

    const MUTES = [
      { want: 'W1', re: /ihui-canary-stage\.mjs/g },
      { want: 'W2', re: /ihui-canary-gray\.ps1/g },
      { want: 'W3', re: /--gray-policy/g },
      { want: 'W4', re: /--verdict/g },
      { want: 'W5', re: /-Action\s+stop/g },
      { want: 'W8', re: /-rollbackOnly/g },
    ]
    for (const m of MUTES) {
      const mutated = text.replace(m.re, '「已摘线」')
      assert.notEqual(mutated, text, `夹具前提:${m.want} 的原文根本不在被审面里`)
      const gaps = WIRING.wiringGaps(mutated)
      assert.ok(
        gaps.some((g) => g.id === m.want),
        `摘掉 ${m.want} 仍然判绿 ⇒ 接线锁是摆设(实得 ${JSON.stringify(gaps)})`,
      )
      const f = join(dir, `loop-${m.want}.ps1`)
      writeFileSync(f, mutated, 'utf8')
      const r = runNode(WIRING_CLI, ['--check', '--file', f])
      assert.equal(r.rc, 1, `CLI 对摘线副本应翻红(rc=1),实得 rc=${r.rc}:${r.out}`)
    }
  } finally {
    rmScratch(dir)
  }
})

// ── ④ 进程编排:端口按契约现读 + 分流器真起真停(需 PowerShell 7)──────────────
function findPwsh() {
  const cands = [process.env.PWSH_PATH, 'C:/Program Files/PowerShell/7/pwsh.exe', 'C:/Program Files (x86)/PowerShell/7/pwsh.exe'].filter(
    Boolean,
  )
  for (const p of cands) if (existsSync(p)) return p
  const w = spawnSync('where.exe', ['pwsh.exe'], { encoding: 'utf8', windowsHide: true })
  if (w.status === 0) {
    const hit = String(w.stdout || '')
      .split(/\r?\n/)
      .map((x) => x.trim())
      .find((x) => x && existsSync(x))
    if (hit) return hit
  }
  return ''
}

test('T4 gray.ps1 的灰度槽位端口按契约现读(不是写死),-SplitOnly 真起真停分流器', async (t) => {
  const pwsh = findPwsh()
  if (!pwsh) {
    t.skip('未判定:取不到 PowerShell 7 ⇒ 这一档没跑过,不得当成已验证(§0.3)')
    return
  }
  const dir = mkScratch('canary-wiring-t4-')
  const stateDir = join(dir, 'state')
  const runPs = (args) => run(pwsh, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', GRAY_PS1, ...args], { timeout: 120_000 })
  try {
    const altCanary = await freePort()
    const splitPort = await freePort()
    const p2 = policyCopy(dir, 'policy-t4.json', (doc) => {
      doc.traffic.slots.canary.port = altCanary
    })
    const contract = join(stateDir, 'ramp.json')
    const init = runNode(STAGE_CLI, ['--init', '--sha', 'sha-t4', '--policy', p2, '--contract', contract])
    assert.equal(init.rc, 0, `${init.out}\n${init.err}`)
    assert.notEqual(altCanary, REAL.slots.canary.port, '夹具前提:副本端口必须与策略默认值不同')

    // status:端口从契约现读 ⇒ 报 altCanary,而不是任何写在 ps1 里的字面量
    const st = runPs(['-Action', 'status', '-StateDir', stateDir])
    assert.equal(st.rc, 0, st.out + st.err)
    const stDoc = JSON.parse(st.out.trim().split(/\r?\n/).pop())
    assert.equal(stDoc.canaryPort, altCanary, 'gray.ps1 报的不是契约里的端口 ⇒ 端口还有一份写死的')
    assert.equal(stDoc.canaryUp, false, '该端口无人监听却报 up ⇒ 探活判据坏了')

    // start -SplitOnly:分流器真起来(灰度实例无产物时也只起分流器,契约照样有进程消费)
    const start = runPs(['-Action', 'start', '-SplitOnly', '-StateDir', stateDir, '-SplitPort', String(splitPort)])
    assert.equal(start.rc, 0, `${start.out}\n${start.err}`)
    assert.match(start.out, new RegExp(`GRAY-SPLIT up port=${splitPort}`), '分流器没真在位')
    assert.match(start.out, /GRAY-CANARY (up|not-up)/, '灰度实例的在位结论没有如实回吐')
    assert.equal(await portAnswers(splitPort), true, 'GRAY-SPLIT 报 up 但端口不应答 ⇒ 编排层在自证假话')

    // 尝试计数有消费者:-Action start 必须把这一枚 sha 记进 attempts.json(防"判不了就无限重来")
    const attemptsPath = join(stateDir, 'attempts.json')
    assert.ok(existsSync(attemptsPath), 'attempts.json 没落盘 ⇒ 尝试计数是死代码')
    assert.ok(Number(JSON.parse(readFileSync(attemptsPath, 'utf8'))['sha-t4']) >= 1, '同一枚 sha 的尝试没进账')

    const stop = runPs(['-Action', 'stop', '-StateDir', stateDir])
    assert.equal(stop.rc, 0, stop.out + stop.err)
    let gone = false
    for (let i = 0; i < 10; i += 1) {
      if (!(await portAnswers(splitPort, 600))) {
        gone = true
        break
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    assert.ok(gone, '-Action stop 报成功但分流器端口仍在应答 ⇒ 灰度撤不干净')
  } finally {
    // 兜底再停一次:夹具进程不得留在机器上
    try {
      runPs(['-Action', 'stop', '-StateDir', stateDir])
    } catch {
      /* 已经停了 */
    }
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
