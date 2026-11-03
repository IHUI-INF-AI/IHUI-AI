#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-mobile-download-leg 的镜像测试(不触网)。
 * 判据函数直接 import 源文件(§22c 反"只复读实现"),覆盖:
 *   单源/覆盖优先级、本机跳过、探针三态、证书基准与伪造签名、退出码优先级、参数互斥。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  DEFAULT_MOBILE_DOWNLOAD_URL,
  LATEST_KEY,
  MIN_APK_BYTES,
  MOBILE_DOWNLOAD_LEG_CONFIG_PATH,
  RELEASE_CERT_SHA256,
  RELEASE_CERT_SHA256_DISPLAY,
  SITE_LEG_PUBLIC_BASE,
  SITE_LEG_URL_PREFIX,
  judgeCertDigest,
  judgeDownloadProbe,
  resolveMobileDownloadUrl,
  summarizeExit,
} from '../lib/mobile-download-leg.mjs'
import { EXIT, classifyDownloadUrl, parseArgs } from '../check-mobile-download-leg.mjs'
import { __test__ as pub } from '../publish-mobile-apk.mjs'
import { PINNED_DOWNLOAD_URL, PLATFORM_PROFILES } from '../check-app-version-latest.mjs'

test('单源:默认 URL 来自 scripts/data/mobile-download-leg.json', () => {
  assert.equal(MOBILE_DOWNLOAD_LEG_CONFIG_PATH.endsWith('mobile-download-leg.json'), true)
  assert.equal(DEFAULT_MOBILE_DOWNLOAD_URL, 'https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk')
  assert.equal(resolveMobileDownloadUrl({}).source, MOBILE_DOWNLOAD_LEG_CONFIG_PATH)
})

test('发布/巡检两脚本读到的固定地址与单源逐字一致', () => {
  assert.equal(pub.LATEST_KEY, LATEST_KEY)
  assert.equal(pub.SITE_LEG.PublicBase, SITE_LEG_PUBLIC_BASE)
  assert.equal(pub.SITE_LEG.UrlPrefix, SITE_LEG_URL_PREFIX)
  assert.equal(pub.siteLegUrl(pub.LATEST_KEY), DEFAULT_MOBILE_DOWNLOAD_URL)
  assert.equal(PINNED_DOWNLOAD_URL, DEFAULT_MOBILE_DOWNLOAD_URL)
  assert.equal(PLATFORM_PROFILES.android.pinned, DEFAULT_MOBILE_DOWNLOAD_URL)
})

test('覆盖优先级:IHUI_MOBILE_DOWNLOAD_URL > NEXT_PUBLIC_DOWNLOAD_APK_URL > JSON', () => {
  const both = resolveMobileDownloadUrl({
    IHUI_MOBILE_DOWNLOAD_URL: 'https://cdn.example.com/a.apk',
    NEXT_PUBLIC_DOWNLOAD_APK_URL: 'https://cdn.example.com/b.apk',
  })
  assert.equal(both.url, 'https://cdn.example.com/a.apk')
  assert.equal(both.source, 'IHUI_MOBILE_DOWNLOAD_URL')

  const nextOnly = resolveMobileDownloadUrl({ NEXT_PUBLIC_DOWNLOAD_APK_URL: 'https://cdn.example.com/b.apk' })
  assert.equal(nextOnly.url, 'https://cdn.example.com/b.apk')
  assert.equal(nextOnly.source, 'NEXT_PUBLIC_DOWNLOAD_APK_URL')
})

test('本机/内网 URL 判 skipped,不触网', () => {
  for (const url of [
    'http://127.0.0.1:8802/ihui-ai-latest.apk',
    'http://localhost/apk',
    'http://192.168.1.7:8801/apk',
    'http://10.0.2.2/apk',
    'http://172.16.0.5/apk',
    'file:///tmp/ihui-ai-latest.apk',
  ]) {
    const c = classifyDownloadUrl(url)
    assert.equal(c.kind, 'local', url)
  }
  assert.equal(classifyDownloadUrl('https://www.aizhs.top/remote-images/download/ihui-ai-latest.apk').kind, 'public')
  assert.equal(classifyDownloadUrl('not-a-url').kind, 'invalid')
})

test('探针三态:200+足量=ok / 404=fail / 缺长度=undetermined', () => {
  const ok = judgeDownloadProbe({ status: 200, contentLength: 87_239_461 })
  assert.equal(ok.state, 'ok')

  const notFound = judgeDownloadProbe({ status: 404, contentLength: 10 })
  assert.equal(notFound.state, 'fail')
  assert.match(notFound.reason, /HTTP 404/)

  const tooSmall = judgeDownloadProbe({ status: 200, contentLength: MIN_APK_BYTES - 1 })
  assert.equal(tooSmall.state, 'fail')

  const noLength = judgeDownloadProbe({ status: 200, contentLength: null })
  assert.equal(noLength.state, 'undetermined')

  const ranged = judgeDownloadProbe({ status: 206, contentLength: MIN_APK_BYTES })
  assert.equal(ranged.state, 'ok')
})

test('证书基准:相等/大小写冒号归一后相等;伪造签名即 fail 并点名 62:B0:FF:0E', () => {
  assert.equal(judgeCertDigest({ actual: RELEASE_CERT_SHA256 }).state, 'ok')
  assert.equal(
    judgeCertDigest({ actual: RELEASE_CERT_SHA256.toUpperCase().replace(/(.{2})(?!$)/g, '$1:') }).state,
    'ok',
  )

  const forged = judgeCertDigest({
    actual: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  })
  assert.equal(forged.state, 'fail')
  assert.match(forged.reason, new RegExp(RELEASE_CERT_SHA256_DISPLAY.replace(/\./g, '\\.')))
  assert.match(forged.reason, new RegExp(RELEASE_CERT_SHA256))

  assert.equal(judgeCertDigest({ actual: '' }).state, 'fail')
})

test('退出码:fail 优先于 skip;只有 skip 也不绿', () => {
  assert.equal(summarizeExit([{ state: 'ok' }]), EXIT.ok)
  assert.equal(summarizeExit([{ state: 'ok' }, { state: 'skipped' }]), EXIT.skipped)
  assert.equal(summarizeExit([{ state: 'fail' }, { state: 'skipped' }]), EXIT.fail)
  assert.equal(summarizeExit([{ state: 'undetermined' }]), EXIT.skipped)
  assert.equal(EXIT.skipped !== 0, true)
})

test('参数:--apk 与 --download 互斥;未知参数拒绝', () => {
  assert.deepEqual(parseArgs(['--self-test']).selfTest, true)
  assert.equal(parseArgs(['--min-bytes', '60000000']).minBytes, 60_000_000)
  assert.throws(() => parseArgs(['--apk', 'a.apk', '--download']), /二选一/)
  assert.throws(() => parseArgs(['--nope']), /未知参数/)
  assert.throws(() => parseArgs(['--min-bytes', '0']), /非正数/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
