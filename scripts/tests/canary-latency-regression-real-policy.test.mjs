#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 金丝雀「部署后自动比对**延迟**」这一腿在**真策略阈值**下的端到端锁(b24 金丝雀发布票 · CANARY 席 2026-11-01 补)。
 *
 * 立因(现读取证,不是推测):仓内既有用例把延迟判据钉在**合成策略**上
 * (`scripts/tests/canary-verdict.test.mjs` ② 用的是 maxP95Ms 500 / maxP95Ratio 2 / maxP95DeltaMs 100 的夹具阈值),
 * 而 `scripts/tests/canary-window-rehearsal.test.mjs` R2 与 `scripts/canary-window-rehearsal.mjs` 的三态夹具
 * 只有 ok / error(500) / throttle(429) 三种模式 —— **没有任何一条用例让"错误率全 0、只有延迟劣化"
 * 的现场穿过一次真 CLI + 真 HTTP 采样**。于是票面「自动比对错误率/**延迟**」的后半截
 * 从来没有在 `scripts/data/canary-policy.json` 的真阈值(1500ms / 1.5× / +500ms / 基线 P95≥50ms)下被量到过。
 *
 * 本文件不复制任何判据(§0.6):阈值逐字节继承真策略文件(当场 deepEqual 自证),
 * 采样与裁决都走真 CLI(`scripts/canary-verdict.mjs` 子进程,经 canary-window-rehearsal 的
 * sampleWindow/decideWindow 出口),夹具只负责"应答 + 故意慢",正文按策略里的 `contains` 现生成。
 * 唯一被压缩的是**采样密度**(ticks/gapMs)—— 与 R2 同一约定:窗口只是采样密度,阈值才是判据。
 *
 * 成对对照(本仓越权用例的纪律):同一份候选样本,带基线 ⇒ fail(相对延迟判据开火);
 * 不带基线 ⇒ pass(证明上一条的 fail 确实来自"与基线比",不是绝对阈值顺手打的)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { sampleWindow, decideWindow } from '../canary-window-rehearsal.mjs'

const REAL_POLICY = join(import.meta.dirname, '..', 'data', 'canary-policy.json')
// 采样密度压缩(判据字段不动):5 tick × 5ms ≈ 每轮一遍端点,拿得住 minSamples。
const FAST_WINDOW = { ticks: 5, gapMs: 5, timeoutMs: 4000 }

let scratch = null
const fileIn = (name) => {
  if (!scratch) scratch = mkScratch('canary-latency-')
  return join(scratch, name)
}

/** 起一个"应答正确但故意慢 delayMs 毫秒"的真 HTTP 夹具(routes = [{path, body}],由真策略的 contains 现生成)。 */
function startSlowFixture({ delayMs, routes }) {
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname
    const hit = routes.find((r) => r.path === path) ?? routes[0]
    setTimeout(() => {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(hit?.body ?? '{"status":"ok"}')
    }, delayMs)
  })
  return new Promise((ok, bad) => {
    server.once('error', bad)
    server.listen(0, '127.0.0.1', () =>
      ok({ port: server.address().port, close: () => new Promise((r) => server.close(() => r())) }),
    )
  })
}

/** 满足 contains 所需的最小正文(正文由策略反推,不在测试里另立一份口径)。 */
function bodyFor(contains) {
  if (!contains) return '{"status":"ok"}'
  if (contains.includes('<!DOCTYPE')) return `${contains}<html>ihui latency fixture</html>`
  return contains
}

/** 真策略 ⇒ 测试策略:端点地址换成本次夹具端口,阈值逐字节照抄(只去掉公网腿、只压采样密度)。 */
function buildPolicy(real, { port, label, thresholds }) {
  const endpoints = real.endpoints
    .filter((e) => e.kind === 'origin')
    .map((e) => {
      const u = new URL(e.url)
      const path = u.pathname === '' || u.pathname === '/' ? '/' : u.pathname
      return { ep: { id: e.id, kind: e.kind, url: `http://127.0.0.1:${port}${path}`, contains: e.contains }, path }
    })
  assert.ok(endpoints.length > 0, `${label}:真策略必须有 origin 腿,否则这格无从可判`)
  const doc = { version: real.version, window: FAST_WINDOW, thresholds, endpoints: endpoints.map((x) => x.ep) }
  const path = fileIn(`policy-${label}.json`)
  writeFileSync(path, `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
  return { path, endpoints: doc.endpoints, routes: endpoints.map((x) => ({ path: x.path, body: bodyFor(x.ep.contains) })) }
}

test.after(() => {
  if (scratch) {
    try {
      rmScratch(scratch)
    } catch { /* 清理失败由 §26 每日 Temp 体检兜,不改判据结论 */ }
    scratch = null
  }
})

test('L1 真策略阈值下:"错误率全 0 + 仅延迟劣化" ⇒ 观察窗必须判 fail(且带基线读数)', async () => {
  const real = JSON.parse(readFileSync(REAL_POLICY, 'utf8'))
  const th = real.thresholds
  assert.ok(
    typeof th.maxP95Ms === 'number' && typeof th.maxP95Ratio === 'number' &&
      typeof th.maxP95DeltaMs === 'number' && typeof th.minBaselineP95Ms === 'number',
    '真策略必须同时给出延迟四维阈值,缺一个这格就判不出来',
  )

  // 基线延迟:必须 ≥ minBaselineP95Ms,否则相对判据按设计不启用(不拿 1 枚快样本当基准)。
  const baselineDelayMs = Math.max(60, Math.round(th.minBaselineP95Ms) + 15)
  // 候选延迟:同时越过 1.5× 放大与 +500ms 增量,但**留在绝对阈值以内** —— 这样 fail 只可能是
  // "跟基线比出来的",不是绝对上限顺手打的。留 200ms 余量给定时器抖动。
  const candidateDelayMs = Math.max(
    Math.round(baselineDelayMs * th.maxP95Ratio) + 120,
    Math.round(baselineDelayMs + th.maxP95DeltaMs) + 120,
  )
  assert.ok(
    candidateDelayMs + 200 < th.maxP95Ms,
    `夹具算术前提破了:候选 ${candidateDelayMs}ms 加余量必须 < 绝对阈值 ${th.maxP95Ms}ms,` +
      '否则"绝对阈值没开火"这条对照不成立 —— 策略改了延迟阈值请同步重排本用例的延迟推导',
  )

  // 夹具正文直接由真策略的 contains 反推(测试里不另立一份"正确应答"口径)。
  const routes = real.endpoints
    .filter((e) => e.kind === 'origin')
    .map((e) => {
      const p = new URL(e.url).pathname
      return { path: p === '' || p === '/' ? '/' : p, body: bodyFor(e.contains) }
    })
  const fast = await startSlowFixture({ delayMs: baselineDelayMs, routes })
  const slow = await startSlowFixture({ delayMs: candidateDelayMs, routes })
  try {
    const basePath = buildPolicy(real, { port: fast.port, label: 'baseline', thresholds: th })
    const candPath = buildPolicy(real, { port: slow.port, label: 'candidate', thresholds: th })
    assert.deepEqual(
      JSON.parse(readFileSync(candPath.path, 'utf8')).thresholds,
      th,
      '测试策略的阈值必须与真策略逐字节相同(换了量的就不是同一条判据)',
    )

    const b = await sampleWindow({ policyPath: basePath.path, stage: 'baseline', outFile: fileIn('baseline.jsonl') })
    assert.equal(b.rc, 0, '基线采样必须跑完')
    const c = await sampleWindow({ policyPath: candPath.path, stage: 'candidate', outFile: fileIn('candidate.jsonl') })
    assert.equal(c.rc, 0, '候选采样必须跑完')

    // 一手证据:候选样本错误率恒 0(全 200 / verdict=pass)⇒ 下面的 fail 不可能是错误率打出来的。
    const candRecords = readFileSync(c.outFile, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l))
    assert.ok(candRecords.length >= th.minSamples, `候选样本必须 ≥ minSamples=${th.minSamples}`)
    for (const r of candRecords) {
      assert.equal(r.verdict, 'pass', `候选必须全 pass(延迟劣化不是错误):${r.endpoint} status=${r.status}`)
      assert.equal(r.status, 200, `候选必须全 200:${JSON.stringify(r)}`)
    }

    const ledger = fileIn('deploy-decisions.jsonl')
    const withBase = await decideWindow({
      policyPath: candPath.path,
      candidate: c.outFile,
      baseline: b.outFile,
      ledger,
      sha: 'canary-latency-lock',
    })
    assert.equal(withBase.rc, 3, `带基线的延迟劣化必须判 fail(rc=3),实得 rc=${withBase.rc} out=${withBase.out}`)
    assert.equal(withBase.payload?.verdict, 'fail', '带基线判定 = fail')
    assert.equal(withBase.payload?.comparedWithBaseline, true, '必须真的与基线比过(不然是绝对阈值开的火)')
    const reasons = (withBase.payload?.reasons ?? []).join(' ')
    assert.ok(/P95/.test(reasons), `失败理由必须点名 P95,实得:${reasons}`)
    assert.ok(/基线/.test(reasons), `失败理由必须带基线读数(可复核),实得:${reasons}`)
    assert.ok(!/错误率\s*[\d.]+%?\s*>/.test(reasons), `理由里不得出现"错误率超阈":${reasons}`)

    // 成对正向对照:同一份候选、**不给基线** ⇒ 绝对阈值没超 ⇒ 必须 pass。
    const noBase = await decideWindow({
      policyPath: candPath.path,
      candidate: c.outFile,
      baseline: null,
      ledger,
      sha: 'canary-latency-lock-nobase',
    })
    assert.equal(noBase.rc, 0, `无基线时同一份候选必须 pass(证明上一条 fail 来自相对判据),实得 rc=${noBase.rc}`)
    assert.equal(noBase.payload?.verdict, 'pass', '无基线判定 = pass')
  } finally {
    await fast.close()
    await slow.close()
  }
})

test('L2 形状自锁:阈值被改小到"绝对上限也超"时,本用例必须当场拒绝而不是悄悄变绿', () => {
  const real = JSON.parse(readFileSync(REAL_POLICY, 'utf8'))
  const th = { ...real.thresholds, maxP95Ms: 100 }
  const baselineDelayMs = Math.max(60, Math.round(th.minBaselineP95Ms) + 15)
  const candidateDelayMs = Math.max(
    Math.round(baselineDelayMs * th.maxP95Ratio) + 120,
    Math.round(baselineDelayMs + th.maxP95DeltaMs) + 120,
  )
  assert.equal(
    candidateDelayMs + 200 < th.maxP95Ms,
    false,
    '反例前提:把绝对阈值压到 100ms 时,延迟推导必须落到"对照不成立"那一侧 —— L1 的 ok() 才会真的拦',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
