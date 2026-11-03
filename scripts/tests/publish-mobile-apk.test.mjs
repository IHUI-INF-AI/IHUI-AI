// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:判据一律 import 源脚本 __test__(§22c),本文件不复制任何判定实现
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { prodCheckoutRoot } from '../lib/prod-checkout-root.mjs'
import { __test__ as pub } from '../publish-mobile-apk.mjs'

const APK_CT = 'application/vnd.android.package-archive'

function fakeFetch(routes) {
  const calls = []
  const cancelled = []
  return {
    calls,
    cancelled,
    impl: async (url, init = {}) => {
      calls.push({ url, range: init.headers?.range ?? null, redirect: init.redirect ?? null })
      const r = routes[url]
      if (!r) throw new Error(`夹具未登记该 URL: ${url}`)
      const res = typeof r === 'function' ? r(url) : r
      const body = { cancel: () => { cancelled.push(url); return Promise.resolve() } }
      return { status: res.status, headers: { get: (k) => (res.headers?.[String(k).toLowerCase()] ?? null) }, body }
    },
  }
}

test('T1 站点腿公网地址与落点形态(与线上 cdn-server 的 --root 同形)', () => {
  assert.equal(pub.siteLegUrl('ihui-ai-latest.apk'), 'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk')
  assert.equal(pub.SITE_LEG.RelDir.split(/[\\/]/).join('/'), 'deploy/server-root/remote-images/download')
})

test('T2 落点选择:只认生产签出,主仓影子目录即使存在也不选(未判定)', () => {
  // 生产根期望值一律向单源取(§0.6):本测不复算候选序,只锁"生产优先 + 主仓影子不得兜底"。
  const prodDir = join(prodCheckoutRoot('R', () => false, {}), pub.SITE_LEG.RelDir)
  const repoDir = join('R', pub.SITE_LEG.RelDir)
  const mk = (has) => (p) => has.includes(p)
  const both = pub.siteLegPlan({ repoRoot: 'R', exists: mk([prodDir, repoDir]), env: {} })
  assert.equal(both.chosen.source, 'prod-checkout', '线上 cdn-server 读的是生产签出,选错边等于把包放到没人发的位置')
  assert.equal(both.chosen.dir, prodDir)
  const onlyRepo = pub.siteLegPlan({ repoRoot: 'R', exists: mk([repoDir]), env: {} })
  assert.equal(onlyRepo.chosen, null, '主仓影子目录不是线上 --root ⇒ 不许静默回落(repo 只作诊断点名)')
  assert.deepEqual(onlyRepo.candidates.map((c) => c.source), ['prod-checkout', 'repo'], '失败时必须点名已试路径')
  const none = pub.siteLegPlan({ repoRoot: 'R', exists: mk([]), env: {} })
  assert.equal(none.chosen, null, '两处都不存在时必须给 null,由调用方判未判定 —— 静默跳过会让对外地址停在旧包')
  assert.equal(none.candidates.length, 2)
})

test('T3 生产根取不到(仓根在 scratch 夹具内 ⇒ 单源抛出)时不炸,但 chosen=null(不回落主仓)', () => {
  // 真实失效形态:devEnvRoot 对"仓根本身在 §26 夹具里"显式抛错 ⇒ prodCheckoutRoot 抛 ⇒ 本器不得炸。
  const prev = process.env.IHUI_DEVENV_ROOT
  delete process.env.IHUI_DEVENV_ROOT
  try {
    const plan = pub.siteLegPlan({
      repoRoot: join('X:', 'ihui-scratch', 'repo'),
      exists: (p) => p === join('X:', 'ihui-scratch', 'repo', pub.SITE_LEG.RelDir),
      env: {},
    })
    assert.equal(plan.candidates.length, 1)
    assert.equal(plan.chosen, null, '取不到生产根 = 未判定,repo 影子目录再在也不许顶上')
  } finally {
    if (prev !== undefined) process.env.IHUI_DEVENV_ROOT = prev
  }
})

test('T4 站点腿正常落地:版本名实物 + 指针三键齐,指针指向本次版本', () => {
  const dir = mkScratch('apk-site-')
  try {
    const apk = join(dir, 'app-release.apk')
    writeFileSync(apk, Buffer.alloc(4096, 0x41))
    const size = statSync(apk).size
    const sha = createHash('sha256').update(readFileSync(apk)).digest('hex')
    const out = pub.publishSiteLeg({ apk, dir, version: '0.0.9', versionCode: '26102816', sha256: sha, size })
    assert.equal(out.vKey, 'ihui-ai-0.0.9-26102816.apk')
    assert.equal(statSync(out.target).size, size)
    const ptr = JSON.parse(readFileSync(out.pointerPath, 'utf8'))
    assert.equal(ptr.url, pub.siteLegUrl('ihui-ai-0.0.9-26102816.apk'))
    assert.equal(ptr.versionCode, '26102816')
    assert.equal(ptr.sha256, sha)
    assert.ok(ptr.publishedAt, '指针要带发布时间,否则事后无法判断这条 302 是何时翻的')
  } finally {
    rmScratch(dir)
  }
})

test('T5 顺序锁:大小不符必须抛错且不翻指针(先翻指针=把用户 302 到不存在的文件)', () => {
  const dir = mkScratch('apk-site-')
  try {
    const apk = join(dir, 'app-release.apk')
    writeFileSync(apk, Buffer.alloc(100, 0x42))
    assert.throws(() => pub.publishSiteLeg({ apk, dir, version: '0.0.9', versionCode: '1', sha256: 'x', size: 999 }), /回读大小不符/)
    assert.equal(existsSync(join(dir, `${pub.LATEST_KEY}.redirect.json`)), false, '回读不过时指针文件一条都不许留下')
  } finally {
    rmScratch(dir)
  }
})

test('T6 二次发布幂等:指针改写后仍只指最新一枚', () => {
  const dir = mkScratch('apk-site-')
  try {
    const apk = join(dir, 'app-release.apk')
    writeFileSync(apk, Buffer.alloc(200, 0x43))
    const base = { apk, dir, sha256: 'z', size: 200 }
    pub.publishSiteLeg({ ...base, version: '0.0.9', versionCode: '111' })
    pub.publishSiteLeg({ ...base, version: '0.1.0', versionCode: '222' })
    const ptr = JSON.parse(readFileSync(join(dir, `${pub.LATEST_KEY}.redirect.json`), 'utf8'))
    assert.equal(ptr.url, pub.siteLegUrl('ihui-ai-0.1.0-222.apk'))
    assert.equal(readFileSync(join(dir, `${pub.LATEST_KEY}.redirect.json`), 'utf8').split('url').length - 1, 1)
  } finally {
    rmScratch(dir)
  }
})

test('T7 sha256File 与 crypto 现算逐字节等值(防自带一份漂移的哈希)', async () => {
  const dir = mkScratch('apk-site-')
  try {
    const f = join(dir, 'a.bin')
    writeFileSync(f, Buffer.from('ihui-apk-hash-probe'))
    assert.equal(await pub.sha256File(f), createHash('sha256').update('ihui-apk-hash-probe').digest('hex'))
  } finally {
    rmScratch(dir)
  }
})

test('T8 公网自证通过:走 302→Location,且两次响应正文都被 cancel(不把 81MB 拖回本机)', async () => {
  const latest = pub.siteLegUrl(pub.LATEST_KEY)
  const loc = pub.siteLegUrl('ihui-ai-0.0.9-26102816.apk')
  const f = fakeFetch({
    [latest]: { status: 302, headers: { location: loc } },
    [loc]: { status: 206, headers: { 'content-type': APK_CT, 'content-range': 'bytes 0-0/84915649' } },
  })
  const out = await pub.verifySiteLegLive({ latestUrl: latest, expectSize: 84915649, expectVersionCode: '26102816', fetchImpl: f.impl })
  assert.equal(out.location, loc)
  assert.equal(out.size, 84915649)
  assert.deepEqual(f.cancelled.sort(), [latest, loc].sort())
  assert.equal(f.calls[1].range, 'bytes=0-0')
})

test('T9-T14 每一档失败都必须喊出来,不得静默通过', async () => {
  const latest = pub.siteLegUrl(pub.LATEST_KEY)
  const good = pub.siteLegUrl('ihui-ai-0.0.9-26102816.apk')
  const apkBody = { status: 206, headers: { 'content-type': APK_CT, 'content-range': 'bytes 0-0/84915649' } }
  const cases = [
    ['非 302(缺指针时线上会 404)', { [latest]: { status: 404, headers: {} }, [good]: apkBody }, /未按 302 应答/],
    ['302 目标是 http(降级)', { [latest]: { status: 302, headers: { location: 'http://x/a.apk' } } }, /不是 https/],
    ['302 仍指旧包(指针没翻)', { [latest]: { status: 302, headers: { location: pub.siteLegUrl('ihui-ai-0.0.8-1.apk') } } }, /仍指向旧包/],
    ['Location 取不到', { [latest]: { status: 302, headers: { location: good } }, [good]: { status: 404, headers: {} } }, /版本副本公网取不到/],
    ['Content-Type 落到占位图', { [latest]: { status: 302, headers: { location: good } }, [good]: { status: 200, headers: { 'content-type': 'image/png', 'content-length': '156' } } }, /不是 apk/],
    ['公网大小与本地不符', { [latest]: { status: 302, headers: { location: good } }, [good]: { status: 206, headers: { 'content-type': APK_CT, 'content-range': 'bytes 0-0/123' } } }, /公网回读大小不符/],
  ]
  for (const [name, routes, re] of cases) {
    const f = fakeFetch(routes)
    await assert.rejects(() => pub.verifySiteLegLive({ latestUrl: latest, expectSize: 84915649, expectVersionCode: '26102816', fetchImpl: f.impl }), re, `${name} 应当抛错`)
  }
})

test('T15 摘掉 versionCode 对账这一维会放过"指针没翻"(反向锁)', async () => {
  const latest = pub.siteLegUrl(pub.LATEST_KEY)
  const stale = pub.siteLegUrl('ihui-ai-0.0.8-1.apk')
  const f = fakeFetch({
    [latest]: { status: 302, headers: { location: stale } },
    [stale]: { status: 206, headers: { 'content-type': APK_CT, 'content-range': 'bytes 0-0/84915649' } },
  })
  // 不带 expectVersionCode 时它是"没判"而不是"判过":调用方必须显式传,否则等于没自证
  const out = await pub.verifySiteLegLive({ latestUrl: latest, expectSize: 84915649, fetchImpl: f.impl })
  assert.match(out.location, /0\.0\.8/, '不传 versionCode 时本函数不比较新旧 —— 这条断言钉住"对账靠调用方传参"这一契约')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
