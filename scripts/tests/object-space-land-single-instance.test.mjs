// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `object-space-land` 单实例闸的镜像锁(2026-11-06 立,机理由环机制席承担)。
 *
 * 钉的是四格互不重复的失效方向:
 *  ① 别人正持有 ⇒ 排队等,等到就做成(不是"见锁就退");
 *  ② 等满上限 ⇒ **未判定** exit 2 形态 + release=null(跳过者结构上删不掉持有者的活锁);
 *  ③ `error` / `undetermined` 一律**不等**并原样上报(拿不到锁的状态时绝不把"没判"读成"无锁");
 *  ④ 接线顺序:闸必须排在一切取材之前(先跑两面全量审再发现该等 = 白吃一次并发)。
 *
 * 零 IO:全部走注入面(acquireOnce / sleep),不建真锁目录、不真等墙钟、不派生 PowerShell。
 * §22c:判据 import 源脚本出口,本文件不复抄任何一行判定。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acquireLandLock, landLockDirOf, LAND_LOCK_UNIT } from '../object-space-land.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const LANDER = join(ROOT, 'scripts/object-space-land.mjs')

/** 造一串按次序返回的假 acquireOnce,并记录被调用次数。 */
function scriptOutcomes(list) {
  const calls = []
  return {
    calls,
    acquireOnce: (opts) => {
      calls.push(opts)
      const next = list.shift()
      if (next === undefined) throw new Error('注入序列用尽(测试没穷尽分支)')
      return typeof next === 'function' ? next(opts) : next
    },
  }
}
const ok = {
  acquired: true,
  kind: 'acquired',
  why: '',
  holder: null,
  release: () => ({ released: true, why: '' }),
}
const held = (pid = 4242) => ({
  acquired: false,
  kind: 'skipped-held',
  why: `持有者 pid=${pid} 活着 ⇒ 不抢`,
  holder: { pid, ts: Date.now() },
  release: null,
})

test('① 首枚直接到位:acquired + release 在位 + 只调用一次', () => {
  const { calls, acquireOnce } = scriptOutcomes([ok])
  const r = acquireLandLock({ dir: '/tmp/x.lock', acquireOnce, sleep: () => {} })
  assert.equal(r.acquired, true, JSON.stringify(r))
  assert.equal(r.kind, 'acquired')
  assert.equal(typeof r.release, 'function')
  assert.equal(calls.length, 1, '拿得到就不该再兜一圈')
  assert.equal(r.attempts, 1)
})

test('② 别人持有 ⇒ 排队等到为止(等得到就做成,不是见锁就退)', () => {
  const { calls, acquireOnce } = scriptOutcomes([held(), held(), ok])
  const slept = []
  const r = acquireLandLock({
    dir: '/tmp/x.lock',
    waitMs: 60_000,
    pollMs: 1_500,
    acquireOnce,
    sleep: (ms) => slept.push(ms),
  })
  assert.equal(r.acquired, true, `等到就该拿到:${JSON.stringify(r.why)}`)
  assert.equal(calls.length, 3)
  assert.equal(r.attempts, 3)
  assert.deepEqual(slept, [1500, 1500], '每次等待取 pollMs 与余额的较小者')
})

test('③ 等满上限 ⇒ 未判定形态,且跳过者拿不到 release(删不掉别人的活锁)', () => {
  // 假时钟:sleep 直接把 now 往前拨 —— 上限那一格必须能确定性地跑到边界,而不是靠墙钟真等。
  let t = 0
  const clock = () => t
  const bump = (ms) => {
    t += ms
  }
  const { calls, acquireOnce } = scriptOutcomes([held(), held(), held(), held()])
  const r = acquireLandLock({
    dir: '/tmp/x.lock',
    waitMs: 3_000,
    pollMs: 1_000,
    acquireOnce,
    now: clock,
    sleep: bump,
  })
  assert.equal(r.acquired, false)
  assert.equal(r.timedOut, true, '必须把"等满"与"没等"分得开,否则读数同形')
  assert.equal(r.kind, 'skipped-held', '终局原因仍是那一格被人持有,不是自造一种失败')
  assert.equal(r.release, null, 'release 只在拿到锁时给出')
  assert.match(r.why, /持有者 pid=4242/, 'why 必须点名持有者,交人工/下一轮判读')
  assert.equal(r.attempts, 4, `按 3s/1s 应当恰好试满 4 次:${r.attempts}`)
  assert.equal(r.waitedMs, 3_000)
  assert.equal(calls.length, 4)
})

test('④ waitMs=0 ⇒ 一枚都不等,首次持有即终局(上限可以合法地是"立刻放弃")', () => {
  const { calls, acquireOnce } = scriptOutcomes([held()])
  const r = acquireLandLock({ dir: '/tmp/x.lock', waitMs: 0, acquireOnce, sleep: () => {} })
  assert.equal(r.acquired, false)
  assert.equal(r.timedOut, true)
  assert.equal(calls.length, 1)
})

test('⑤ error / undetermined 一律不等:把"没判"读成"无锁"是最坏的一档', () => {
  for (const kind of ['error', 'undetermined']) {
    const { calls, acquireOnce } = scriptOutcomes([
      { acquired: false, kind, why: `${kind} 形态`, holder: null, release: null },
      ok,
    ])
    const r = acquireLandLock({ dir: '/tmp/x.lock', waitMs: 60_000, acquireOnce, sleep: () => {} })
    assert.equal(r.acquired, false, `${kind} 不得被当无锁继续`)
    assert.equal(r.kind, kind, `${kind} 必须原样上报,不得折成 skipped-held`)
    assert.equal(r.timedOut, false, `${kind} 不是"等满",是"根本不该等"`)
    assert.equal(calls.length, 1, `${kind} 一支都不许排队重试(等下去也不会自己变好)`)
  }
})

test('⑥ 注入出口返回形状不成立 ⇒ 落未判定并点名,不抛穿主流程', () => {
  for (const bad of [null, undefined, 'x', {}, { acquired: 'yes' }]) {
    const r = acquireLandLock({
      dir: '/tmp/x.lock',
      waitMs: 0,
      acquireOnce: () => bad,
      sleep: () => {},
    })
    assert.equal(r.acquired, false)
    assert.equal(
      r.kind,
      'undetermined',
      `返回值 ${JSON.stringify(bad)} 不是结论,不能当成"能落地"或"不能落地"`,
    )
    assert.match(r.why, /形状不成立/)
  }
})

test('⑦ 同进程重入按到位处理(它本就在临界区里,不是抢锁失败)', () => {
  const r = acquireLandLock({
    dir: '/tmp/x.lock',
    acquireOnce: () => ({ ...ok, kind: 'reentrant' }),
    sleep: () => {},
  })
  assert.equal(r.acquired, true)
  assert.equal(r.kind, 'reentrant')
})

test('⑧ 锁落点跟着被落地的仓走:不同 root 不同锁(夹具因此互不相干)', () => {
  // 用真根派生两个假 root,避开 Windows 上 "/repo/A" 会被 join 成无盘符路径这一类仪器噪声
  const ra = join(ROOT, 'tmp-fixture-A')
  const rb = join(ROOT, 'tmp-fixture-B')
  const a = landLockDirOf(ra)
  const b = landLockDirOf(rb)
  assert.notEqual(a, b)
  assert.ok(a.startsWith(ra), `落点必须在自己的仓内:${a}`)
  assert.ok(!a.startsWith(rb), 'A 的锁不得落进 B 的树里(共树夹具会互相顶住)')
  assert.match(a, /object-space-land\.lock$/)
  assert.equal(
    LAND_LOCK_UNIT,
    'object-space-land',
    'unitId 必须与 `git-lock.mjs scan|clean` 认得的这一族同名',
  )
})

test('⑨ 接线形状锁:闸排在一切取材之前,拿不到就 exit 2(造好没装车 = 没有)', () => {
  const src = readFileSync(LANDER, 'utf8')
  const gate = src.indexOf('acquireLandLock({ dir: landLockDirOf(root) })')
  const firstRead = src.indexOf("const head0 = git(['rev-parse', 'HEAD']")
  assert.ok(gate > 0 && firstRead > 0, '两处出口都必须在 main 里现读得到')
  assert.ok(gate < firstRead, '单实例闸必须排在首次 git 取材之前(否则并发照旧叠加,只是白跑两面)')
  assert.match(
    src,
    /if \(!landLock\.acquired\)[\s\S]{0,700}process\.exit\(2\)/,
    '拒落必须是 exit 2(未判定档),不是 0 也不是静默继续',
  )
  assert.match(
    src,
    /process\.on\('exit'[\s\S]{0,400}landLock\.release/,
    'release 必须挂 exit:异常路径同样交还',
  )
  assert.doesNotMatch(
    src,
    /LAND_ALLOW_STALE=1[\s\S]{0,120}acquireLandLock/,
    '单实例闸不得与"关掉陈旧守卫"那一条串成同一出路',
  )
  // 父目录那一格是本枚真踩出来的回归(见 ⑩/⑪):建父层必须排在 acquireOnce 之前
  assert.ok(
    src.indexOf('ensureParent(dir)') < src.indexOf('last = acquireOnce('),
    'ensureParent 必须排在 acquireOnce 之前,否则 rename 当场 ENOENT',
  )
})

test('⑩ 父目录建不出来 ⇒ 未判定并点名,绝不退化成"当无锁继续"', () => {
  let touched = 0
  const r = acquireLandLock({
    dir: '/tmp/none/x.lock',
    ensureParent: () => {
      touched += 1
      throw Object.assign(new Error('EPERM'), { code: 'EPERM' })
    },
    acquireOnce: () => {
      throw new Error('父层没建成就该停在这里,不该再碰锁原语')
    },
  })
  assert.equal(touched, 1, '必须先建父层再谈抢锁')
  assert.equal(r.acquired, false)
  assert.equal(r.kind, 'undetermined')
  assert.match(r.why, /EPERM/)
  assert.equal(r.attempts, 0, 'acquireOnce 一次都不许被调用')
})

test('⑪ 真夹具端到端:父层缺失的根照样拿得到锁;第二枚被顶住且不误删活锁', async () => {
  const { mkScratch, rmScratch } = await import('../lib/scratch-dir.mjs')
  const { spawn } = await import('node:child_process')
  const dir = mkScratch('osl-lock-')
  // A 必须**并发**跑。上一版这里用 spawnSync:A 先跑完 6 秒并交还,B 合法拿到锁 ⇒
  // 用例把"互斥没生效"读成"锁工作正常"。那是假绿,而且方向正好反了(它唯一要证的就是那一格)。
  const collect = (p) =>
    new Promise((res) => {
      let out = ''
      let err = ''
      p.stdout.on('data', (d) => (out += d))
      p.stderr.on('data', (d) => (err += d))
      p.on('close', (code) => res({ code, out, err }))
    })
  try {
    const probe = join(import.meta.dirname, 'fixtures', 'land-lock-two-process.mjs')
    const lockDir = join(dir, 'repo', '.ihui-agent', 'state', 'object-space-land.lock')
    const aP = spawn(process.execPath, [probe, 'A', dir], { windowsHide: true })
    // 等 A 真把 meta 写上再放 B:排除"B 早于 A 建锁"这种与判据无关的竞态
    const t0 = Date.now()
    while (!existsSync(join(lockDir, 'meta.json')) && Date.now() - t0 < 10_000) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
    }
    assert.ok(existsSync(join(lockDir, 'meta.json')), 'A 必须在 10 秒内把锁写上,否则这题测不到并发')
    const b = await collect(
      spawn(process.execPath, [probe, 'B', dir], {
        windowsHide: true,
        env: { ...process.env, IHUI_LAND_SINGLE_INSTANCE_WAIT_MS: '1' },
      }),
    )
    const a = await collect(aP)
    assert.equal(a.code, 0, `A 应正常拿到并交还:\n${a.out}\n${a.err}`)
    assert.match(a.out, /A acquired=true kind=acquired/, `父层缺失的根必须照样拿得到锁:\n${a.out}`)
    assert.match(a.out, /A released=true/, 'A 交还得成功,否则锁会留成残留')
    assert.match(b.out, /B acquired=false kind=skipped-held/, `B 应被顶住:\n${b.out}\n${b.err}`)
    assert.match(b.out, /release=null\(对\)/, `跳过者不得拿到 release:\n${b.out}`)
    assert.match(b.out, /锁仍在\(对\)/, 'B 不许把 A 的活锁删掉')
    // 身份读数在 `why` 里(原语的 skipped-held 那一支不填 holder)—— 断言必须问真在报数的那一格,
    // 问一个恒空的字段会得到"永远不符"或"永远符合"两种假读数
    assert.match(b.out, /持有者 unit=object-space-land pid=\d+/, `读数必须点名持有者:\n${b.out}`)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
