#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 运营商一键登录的明文流量范围(2026-11-01 安全强化)。
 *
 * 判的是一枚**每次 prebuild 都会重新生成**的产物:`apps/mobile-rn/android/` 不入库
 * (`git ls-files apps/mobile-rn/android` 现读 0 条),所以 release APK 的 AndroidManifest
 * 完全由插件决定 —— 插件写什么,用户机上就跑什么。旧形态在 <application> 上写
 * `android:usesCleartextTraffic="true"`,那是对**整个 APK** 授权 http:access/refresh token、
 * 手机号、支付回跳全在同网段可被降级嗅探,而需要明文的只有闪验一家网关。
 *
 * 三条纪律各自成对:
 *  ① 基础档必须关死,且**覆盖**旧值(留着 `if (!已有)` 的判断等于把收口原地作废);
 *  ② 例外只能按域名开,且只接受纯主机名 —— 清单来自 env,不能把 URL/换行/路径塞进 XML;
 *  ③ 没供值时**不开任何例外**(后果是"一键登录失败→按既有设计降级短信验证码",
 *     而不是"默认整 App 明文")。这一条的反证是:摘掉覆盖,夹具立刻读回 'true'。
 */

import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const require = createRequire(import.meta.url)
const plugin = require(join(ROOT, 'apps/mobile-rn/plugins/withCarrier.cjs'))
const gate = plugin.__test__

test('判据单源:插件必须导出实现,本文件不复算规则', () => {
  assert.equal(typeof gate.parseCleartextHosts, 'function')
  assert.equal(typeof gate.applyCleartextPolicy, 'function')
  assert.equal(typeof gate.buildNetworkSecurityConfigXml, 'function')
})

test('① 基础档关死并覆盖旧值,同时指向 nsc', () => {
  const app = { $: { 'android:usesCleartextTraffic': 'true' } }
  gate.applyCleartextPolicy(app, [])
  assert.equal(app.$['android:usesCleartextTraffic'], 'false', '旧值没被覆盖 = 收口原地作废')
  assert.equal(app.$['android:networkSecurityConfig'], '@xml/network_security_config')
})

test('② nsc 正文:无例外时零 domain-config,有例外时逐域开且只开 http', () => {
  const empty = gate.buildNetworkSecurityConfigXml([])
  assert.match(empty, /<base-config cleartextTrafficPermitted="false" \/>/)
  assert.doesNotMatch(empty, /domain-config/, '没有供值却开出例外 = 凭空放行')

  const one = gate.buildNetworkSecurityConfigXml(['*.gw.example.com'])
  assert.match(one, /<domain-config cleartextTrafficPermitted="true">/)
  assert.match(one, /<domain includeSubdomains="true">gw\.example\.com<\/domain>/)
  // 变异自证:把基础档翻回 true 的形态必须被这条尺子量出来
  assert.doesNotMatch(one, /<base-config cleartextTrafficPermitted="true"/)
})

test('③ 例外清单验形:主机名与 *.主机名收,其余丢', () => {
  // `*.` 前缀是"含子域"的载体,由 buildNetworkSecurityConfigXml 翻成 includeSubdomains,
  // 解析层保留它(去重也是按保留形态做的)。
  assert.deepEqual(gate.parseCleartextHosts('a.example.com, *.GW.example.com ,  a.example.com'), [
    'a.example.com',
    '*.gw.example.com',
  ])
  for (const bad of [
    'http://a.example.com/',
    'a.example.com/path',
    'a exam',
    'a.example.com\n<b/>',
    '',
    ' ',
    'localhost',
  ]) {
    assert.deepEqual(gate.parseCleartextHosts(bad), [], `非法形态被收进清单:${bad}`)
  }
  assert.deepEqual(gate.parseCleartextHosts(['ok.example.com', '坏的']), ['ok.example.com'])
})

test('接线锁:插件源码里不得再出现"整 App 明文"那一行,且必须问 applyCleartextPolicy', () => {
  const src = readFileSync(join(ROOT, 'apps/mobile-rn/plugins/withCarrier.cjs'), 'utf8')
  assert.doesNotMatch(
    src,
    /\[.android:usesCleartextTraffic.\]\s*=\s*'true'/,
    '又写回 usesCleartextTraffic=true ⇒ 每次 prebuild 都给整 APK 开明文',
  )
  assert.match(src, /applyCleartextPolicy\(application, cleartextHosts\)/)
  assert.match(src, /withCarrierNetworkSecurityConfig\(config, cleartextHosts\)/)
})

test('接线锁:app.config.js 必须把 env 供值接到插件(接了却没人供 = 永远只有基础档)', () => {
  const src = readFileSync(join(ROOT, 'apps/mobile-rn/app.config.js'), 'utf8')
  assert.match(src, /cleartextHosts: process\.env\.EXPO_PUBLIC_CARRIER_CLEARTEXT_HOSTS/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
