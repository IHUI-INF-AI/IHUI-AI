// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * publish-mobile-ipa.mjs 的镜像测试(2026-11-03 立)。判据 import 源文件 `__test__`,零复算(§22c)。
 *
 * 这组用例守的是三件历史上真出过事的边:
 *   ① **版本号不许编**:release 里没有 `ios-version.json` 且没显式给号 ⇒ 未判定、零写盘
 *      (APK 侧 2026-10 那条"下载页显示 v0.1.74、手机上显示 0.0.5"的两号对不上,就是猜号猜出来的);
 *   ② **账实不符不许上腿**:下载落盘大小 ≠ release API 报的 size ⇒ 删掉并抛错;
 *   ③ **落点只认生产签出**:chosen=null 时 exit 2 点名已试路径,绝不回落主仓影子目录
 *      (静默回落 = 发了个没人服务的目录而账面是绿的)。
 *   另加两条形状锁:指针/版本名必须走 `.ipa`(摘掉 ext 参数即翻红),登记腿必须写 platform='ios'。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import { __test__ as ipa, main as mainIpa } from '../publish-mobile-ipa.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const {
  pickIpaReleaseAssets,
  judgeIpaVersionDoc,
  parseArgs,
  downloadIpaTo,
  makeLocalProbeFetch,
  LATEST_IPA_KEY,
  IPA_EXT,
} = ipa

function releaseDoc(withVersion = true) {
  const assets = [{ name: 'ihui-ai-latest.ipa', size: 1234, browser_download_url: 'https://g/x/ihui-ai-latest.ipa' }]
  if (withVersion) {
    assets.push({ name: 'ios-version.json', size: 40, browser_download_url: 'https://g/x/ios-version.json' })
  }
  return { tag_name: 'ios-nightly', published_at: '2026-11-03T00:00:00Z', assets }
}

test('pickIpaReleaseAssets:有包有自证 ⇒ ok;没版本资产 ⇒ ok 但 versionAssetUrl=null(交上层判)', () => {
  const full = pickIpaReleaseAssets(releaseDoc(true))
  assert.equal(full.state, 'ok')
  assert.equal(full.size, 1234)
  assert.match(String(full.versionAssetUrl), /ios-version\.json$/)
  const noVer = pickIpaReleaseAssets(releaseDoc(false))
  assert.equal(noVer.state, 'ok')
  assert.equal(noVer.versionAssetUrl, null)
})

test('pickIpaReleaseAssets:文档不可用 / 包缺 / 直链缺 / size 读不出 ⇒ 四种未判定各有各的原因码', () => {
  assert.equal(pickIpaReleaseAssets(null).reason, 'release-doc-unreachable')
  assert.equal(pickIpaReleaseAssets({ tag_name: 't', assets: [] }).reason, 'ipa-asset-missing:ihui-ai-latest.ipa')
  assert.equal(
    pickIpaReleaseAssets({ tag_name: 't', assets: [{ name: 'ihui-ai-latest.ipa', size: 5 }] }).reason,
    'ipa-asset-has-no-download-url',
  )
  assert.equal(
    pickIpaReleaseAssets({ tag_name: 't', assets: [{ name: 'ihui-ai-latest.ipa', size: 0, browser_download_url: 'https://x' }] }).reason,
    'ipa-asset-size-unreadable:0',
  )
})

test('judgeIpaVersionDoc:semver + 纯数字构建号才算数,其余一律未判定(不猜、不四舍五入)', () => {
  assert.deepEqual(judgeIpaVersionDoc({ version: '0.0.9', buildNumber: '26110301' }), {
    state: 'ok',
    version: '0.0.9',
    buildNumber: '26110301',
  })
  assert.equal(judgeIpaVersionDoc({ version: '0.0', buildNumber: '1' }).reason, 'version-asset-no-semver:0.0')
  assert.equal(judgeIpaVersionDoc({ version: '1.0.0' }).reason, 'version-asset-no-build-number:(空)')
  assert.equal(judgeIpaVersionDoc('not json').reason, 'version-asset-not-json')
  // `null` 是合法 JSON 但不是文档 ⇒ 归"形状不对",与"解析失败"分开(两态不并桶)
  assert.equal(judgeIpaVersionDoc(null).reason, 'version-asset-shape')
  assert.equal(judgeIpaVersionDoc('null').reason, 'version-asset-shape')
})

test('downloadIpaTo:落盘大小与 API 不符 ⇒ 抛错并把残件删掉(账实不符不许留在腿上)', async () => {
  const dir = mkScratch('ipa-size-mismatch')
  const fakeFetch = async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => new Uint8Array(10).buffer,
  })
  await assert.rejects(
    () => downloadIpaTo({ url: 'https://x/a.ipa', size: 999, destDir: dir, token: '', fetchImpl: fakeFetch }),
    /大小与 release API 不符/,
  )
  assert.equal(existsSync(join(dir, 'ihui-ai-latest.ipa')), false, '残件必须删掉')
  rmScratch(dir)
})

test('makeLocalProbeFetch:探针必须带 Host(本地源站只听 127.0.0.1)', async () => {
  let seen = null
  const probe = makeLocalProbeFetch(async (url, init) => {
    seen = { url, init }
    return { ok: true, status: 302 }
  })
  await probe('http://127.0.0.1:80/remote-images/download/ihui-ai-latest.ipa', { redirect: 'manual' })
  assert.equal(seen.init.headers.Host, 'www.aizhs.top')
  assert.equal(seen.init.redirect, 'manual')
})

test('parseArgs:模式与参数形状', () => {
  assert.deepEqual(
    parseArgs(['--ipa', '/tmp/a.ipa', '--version', '1.2.3', '--build-number', '42']).mode,
    'file',
  )
  assert.equal(parseArgs(['--from-release']).mode, 'release')
  assert.throws(() => parseArgs(['--nope']), /未知参数/)
})

/** 真跑 main:只注入 IO(fetch/env/落点/登记桩),发布与指针序列走真实现 */
function fakeWorld({ doc, versionDoc, registerOk = true }) {
  const scratch = mkScratch('ipa-main')
  const logs = []
  const errs = []
  const registerCalls = []
  const fetchImpl = async (url) => {
    const u = String(url)
    if (u.includes('releases/tags/')) return { ok: true, status: 200, json: async () => doc }
    if (u.endsWith('ios-version.json')) return { ok: true, status: 200, json: async () => versionDoc }
    if (u.includes('ihui-ai-latest.ipa')) {
      const body = Buffer.alloc(1234, 7)
      return { ok: true, status: 200, arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.length) }
    }
    return { ok: false, status: 404, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) }
  }
  const verifyStub = async (opts) => {
    logs.push(`verify:${opts.latestKey}|${opts.ext}|${opts.contentTypeNeedle}`)
    return { location: 'https://www.aizhs.top/remote-images/download/ihui-ai-0.0.9-26110301.ipa', status: 200, contentType: 'application/octet-stream', size: 1234 }
  }
  const registerStub = async (opts) => {
    registerCalls.push(opts)
    return registerOk ? { ok: true, status: 'registered', leg: 'db' } : { ok: false, status: 'unregistered' }
  }
  const run = () =>
    mainIpa(['--from-release'], {
      env: {},
      fetchImpl,
      githubToken: () => '',
      ipaSiteLegPlan: () => ({
        candidates: [{ source: 'prod-checkout', dir: scratch }],
        chosen: { source: 'prod-checkout', dir: scratch },
        envOverride: null,
      }),
      dlDir: join(scratch, 'dl'),
      out: (m) => logs.push(String(m)),
      err: (m) => errs.push(String(m)),
      verifySiteLegLive: verifyStub,
      publishRegisterStep: registerStub,
    })
  return { scratch, logs, errs, registerCalls, run }
}

test('main 端到端:取到自证版本 ⇒ 落版本名 .ipa + 翻 ihui-ai-latest.ipa 指针 + 登记 ios', async () => {
  const w = fakeWorld({ doc: releaseDoc(true), versionDoc: { version: '0.0.9', buildNumber: '26110301' } })
  const rc = await w.run()
  assert.equal(rc, 0, w.errs.join('\n'))
  const names = readdirSync(w.scratch).filter((n) => !n.startsWith('dl'))
  assert.ok(names.includes('ihui-ai-0.0.9-26110301.ipa'), `版本副本必须带 .ipa 后缀,实际 ${names.join(',')}`)
  assert.ok(names.includes(`${LATEST_IPA_KEY}.redirect.json`), '指针文件名必须用 ipa 的 latest key')
  const ptr = JSON.parse(readFileSync(join(w.scratch, `${LATEST_IPA_KEY}.redirect.json`), 'utf-8'))
  assert.equal(ptr.url, `https://www.aizhs.top/remote-images/download/ihui-ai-0.0.9-26110301.ipa`)
  assert.equal(ptr.size, 1234)
  assert.equal(w.registerCalls[0].platform, 'ios')
  assert.equal(w.registerCalls[0].latestKey, LATEST_IPA_KEY)
  assert.match(w.logs.join('\n'), /octet-stream/, '自证必须按 ipa 的 content-type 判')
  rmScratch(w.scratch)
})

test('变异自证:release 里没有 ios-version.json 且没显式给号 ⇒ exit 2 且**零写盘**', async () => {
  const w = fakeWorld({ doc: releaseDoc(false), versionDoc: null })
  const rc = await w.run()
  assert.equal(rc, 2)
  assert.match(w.errs.join('\n'), /未判定/)
  const leftovers = readdirSync(w.scratch).filter((n) => !n.startsWith('dl'))
  assert.equal(leftovers.length, 0, `未判定时必须一个字节都不写,实际留下了 ${leftovers.join(',')}`)
  rmScratch(w.scratch)
})

test('登记腿不 ok ⇒ 非零退出(包已发但不许把"没登记"说成成功)', async () => {
  const w = fakeWorld({ doc: releaseDoc(true), versionDoc: { version: '0.0.9', buildNumber: '26110301' }, registerOk: false })
  const rc = await w.run()
  assert.equal(rc, 1)
  rmScratch(w.scratch)
})

test('形状锁:扩展名与 latest key 只能来自参数化默认(摘掉即翻红)', () => {
  const src = readFileSync(join(import.meta.dirname, '..', 'publish-mobile-apk.mjs'), 'utf-8')
  assert.match(src, /function versionKey\(version, versionCode, \{ ext = 'apk' \} = \{\}\)/, 'versionKey 必须收 ext 默认 apk')
  assert.match(src, /latestKey = LATEST_KEY/, 'publishSiteLeg 的指针名必须可参数化')
  assert.equal(IPA_EXT, '.ipa')
  assert.equal(LATEST_IPA_KEY, 'ihui-ai-latest.ipa')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
