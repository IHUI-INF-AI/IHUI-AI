#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * install-rn-on-device 的镜像测试(不碰真机、不触网)。
 * 判据函数一律 import 源实现(§22c:禁止在测试里复制一份判据,第二份必然漂移)。
 * 覆盖:签名一致/不一致/debug 待装/取不到输入/显式授权自装/第三把签名/归一化阳性对照/
 *       机上诉求的失败分支/设备清单/包名解析。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// §15b:夹具落点只许走 scratch-dir 单源,不得 os.tmpdir()(TEMP 可能被钉在 C 盘)。
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

import { judgeInstall, readDeviceCert, EXIT } from '../install-rn-on-device.mjs'
import { DEBUG_CERT_SHA256 } from '../mobile-release-artifact-check.mjs'
import { normalizeCertDigest } from '../lib/mobile-download-leg.mjs'
import { listSerials, resolveAndroidPackage } from '../lib/android-toolchain.mjs'

const RELEASE = '62b0ff0e950125230683aacfb5d0b110d93d30a229ca5df1950a572255b82514'
const OTHER = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

test('S1 机上与待装同签名且等于本机正式基线 ⇒ ok', () => {
  const v = judgeInstall({ deviceDigest: RELEASE, incomingDigest: RELEASE, releaseBaseline: RELEASE })
  assert.equal(v.state, 'ok')
})

test('S2 机上与待装不等 ⇒ refused,且拒绝文案必须点名"禁止 uninstall"', () => {
  const v = judgeInstall({ deviceDigest: RELEASE, incomingDigest: OTHER, releaseBaseline: RELEASE })
  assert.equal(v.state, 'refused')
  const all = v.reasons.join(' ')
  assert.match(all, /禁止用 adb uninstall/)
  assert.match(all, /登录态/)
  // 两条指纹都要被点名,否则下一个人无从判断是哪一侧错了
  assert.match(all, new RegExp(normalizeCertDigest(RELEASE).slice(0, 16)))
  assert.match(all, new RegExp(normalizeCertDigest(OTHER).slice(0, 16)))
})

test('S3 待装是 debug 证书 ⇒ refused(即使机上也是 debug)', () => {
  const v = judgeInstall({
    deviceDigest: DEBUG_CERT_SHA256,
    incomingDigest: DEBUG_CERT_SHA256,
    releaseBaseline: RELEASE,
  })
  assert.equal(v.state, 'refused')
  assert.match(v.reasons.join(' '), /重出正式签名包/)
})

test('S4 显式 --allow-debug-signing 的 debug↔debug 自装 ⇒ ok 且必须留痕', () => {
  const v = judgeInstall({
    deviceDigest: DEBUG_CERT_SHA256,
    incomingDigest: DEBUG_CERT_SHA256,
    releaseBaseline: null,
    allowDebugSigning: true,
  })
  assert.equal(v.state, 'ok')
  assert.match(v.reasons.join(' '), /显式授权/)
  assert.match(v.reasons.join(' '), /不得用于发布/)
})

test('S5 取不到机上指纹 ⇒ unjudged(§0.3 不冒绿也不冒红)', () => {
  assert.equal(judgeInstall({ deviceDigest: '', incomingDigest: RELEASE, releaseBaseline: RELEASE }).state, 'unjudged')
})

test('S6 取不到待装指纹 ⇒ unjudged', () => {
  assert.equal(judgeInstall({ deviceDigest: RELEASE, incomingDigest: '', releaseBaseline: RELEASE }).state, 'unjudged')
})

test('S7 两侧同签名但都不等于本机正式基线 ⇒ refused(存在第三把签名)', () => {
  const v = judgeInstall({ deviceDigest: OTHER, incomingDigest: OTHER, releaseBaseline: RELEASE })
  assert.equal(v.state, 'refused')
  assert.match(v.reasons.join(' '), /第三把签名/)
})

test('S8 归一化阳性对照:带冒号/大写的同一指纹仍判等(否则好尺子会误拒)', () => {
  const pretty = RELEASE.replace(/(.{2})/g, '$1:').toUpperCase().replace(/:$/, '')
  const v = judgeInstall({ deviceDigest: pretty, incomingDigest: RELEASE, releaseBaseline: RELEASE })
  assert.equal(v.state, 'ok')
})

test('S9 本机无正式基线时不得把"取不到基线"当成不一致', () => {
  const v = judgeInstall({ deviceDigest: RELEASE, incomingDigest: RELEASE, releaseBaseline: null })
  assert.equal(v.state, 'ok')
})

test('S10a 机上诉求正向臂:pm path → pull 落盘 → 交给唯一的 apkCert', () => {
  const dir = mkScratch('install-rn-cert')
  const calls = []
  try {
    const fakePull = (adb, args) => {
      calls.push(args.join(' '))
      if (args.includes('pm')) return { ok: true, stdout: 'package:/data/app/x==/zh.ai.sq-Y==/base.apk\n' }
      writeFileSync(join(dir, 'S-base.apk'), 'not-a-real-apk')
      return { ok: true, stdout: '1 file pulled' }
    }
    const seen = []
    const r = readDeviceCert({
      adb: 'adb',
      serial: 'S',
      pkg: 'zh.ai.sq',
      scratch: dir,
      pull: fakePull,
      certifier: (p) => {
        seen.push(p)
        return { digest: RELEASE, dn: 'CN=IHUI AI' }
      },
    })
    assert.equal(r.digest, RELEASE)
    assert.ok(calls.some((c) => c.includes('pm') && c.includes('zh.ai.sq')), '必须真问 pm path')
    assert.ok(calls.some((c) => c.includes('pull')), '必须真 pull 下来再读')
    assert.equal(seen.length, 1)
    assert.equal(seen[0], join(dir, 'S-base.apk'), '喂给 apkCert 的必须是 pull 到本地的副本')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('S10b pull 报成功却没落盘 ⇒ 必须报错,不得凭"pull 说成功"返回指纹', () => {
  const dir = mkScratch('install-rn-cert-missing')
  try {
    const r = readDeviceCert({
      adb: 'adb',
      serial: 'S',
      pkg: 'zh.ai.sq',
      scratch: join(dir, 'not-created'),
      pull: (adb, args) =>
        args.includes('pm')
          ? { ok: true, stdout: 'package:/data/app/x==/zh.ai.sq-Y==/base.apk\n' }
          : { ok: true, stdout: '1 file pulled' },
      certifier: () => ({ digest: RELEASE }),
    })
    assert.match(r.error ?? '', /pull 报成功但本地无文件/)
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('S11 pm path 里没有 base.apk ⇒ 明确报错(split apk 不得静默当成无包)', () => {
  const r = readDeviceCert({
    adb: 'adb',
    serial: 'S',
    pkg: 'zh.ai.sq',
    scratch: '/tmp',
    pull: () => ({ ok: true, stdout: 'package:/data/app/x==/zh.ai.sq-Y==/split_config.arm64_v8a.apk\n' }),
    certifier: () => ({ digest: RELEASE }),
  })
  assert.match(r.error ?? '', /base\.apk/)
})

test('S12 adb 派生失败 ⇒ error 透传,不返回空指纹冒充"机上没装"', () => {
  const r = readDeviceCert({
    adb: 'adb',
    serial: 'S',
    pkg: 'zh.ai.sq',
    scratch: '/tmp',
    pull: () => ({ ok: false, error: 'device offline' }),
    certifier: () => ({ digest: RELEASE }),
  })
  assert.match(r.error ?? '', /device offline/)
})

test('S13 设备清单只取已授权 device;零设备得空集(不得当成一台)', () => {
  assert.deepEqual(listSerials('List of devices attached\nabc123 device\nxyz offline\n'), ['abc123'])
  assert.deepEqual(listSerials('List of devices attached\n\n'), [])
})

test('S14 包名解析必须非空且带出处(空包名会 dump 全部应用)', () => {
  const p = resolveAndroidPackage({})
  assert.equal(p.ok, true)
  assert.ok(p.pkg.length > 0)
  assert.ok(p.source)
})

test('S15 退出码三档互不相同(问责时能分桶)', () => {
  assert.notEqual(EXIT.OK, EXIT.REFUSED)
  assert.notEqual(EXIT.REFUSED, EXIT.UNJUDGED)
  assert.equal(EXIT.UNJUDGED, 2)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
