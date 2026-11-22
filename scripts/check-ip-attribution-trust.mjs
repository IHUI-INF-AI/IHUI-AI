#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 只读尺子：IP 归属判定是否仍建立在"客户端不可伪造"的事实上。
 *
 * 立因（2026-10-28 实测）：fastify `trustProxy` 的数组形态在 socket 对端命中 TRUSTED_PROXIES 时
 * 取 **X-Forwarded-For 最左值** 作为 request.ip，而该字段由客户端整写。实测三态：
 *   ① 回环直连 /api/admin/stats ⇒ 401（过分段）
 *   ② 再加 `X-Forwarded-For: 8.8.8.8` ⇒ 403 —— request.ip 完全由该头决定
 *   ③ 公网经 EdgeOne ⇒ 403，且伪造 `X-Forwarded-For: 127.0.0.1` 无效
 * ③ 之所以成立，**只是**"CDN 出口 IP 恰好不在本表里"。谁按常规做法把代理出口 IP 填进表，
 * admin 网络分段 / IP 信誉封禁 / 限流键就同时退化成"填 127.0.0.1 即以内网身份通行"。
 *
 * 本尺子不判"现在有没有被绕"，判的是"巧合还在不在"：
 *   ok        —— 表里只有回环/站内私网项 ⇒ 公网客户端的头进不了判定（现状，依赖前提写在输出里）
 *   breach    —— 表里出现公网地址 ⇒ 该地址的对端会命中本表 ⇒ 伪造即刻生效，必须先去改 cf-connecting-ip
 *   unjudged  —— 生效值取不到 ⇒ 不猜、不记绿（§0.3）
 *
 * 刻意**不进提交链**（§12e：它判本机运行配置，提交者结构上满足不了）；调度面 = git-guardian 巡检轮。
 */

import { pathToFileURL } from 'node:url'
import { readManagedEnvText } from './lib/managed-env-face.mjs'

/** config 里的默认值（唯一真相在 apps/api/src/config/index.ts，此处只取"未设时是什么"） */
const CONFIG_DEFAULT = '127.0.0.1,::1'

/**
 * 单条受信任项归族。不做完整 CIDR 展开，只回答"这一项可能把哪一类对端变成受信"：
 * 公网地址 ⇒ 意味着真实互联网对端会命中本表（那一格的 XFF 采信面就开了）。
 */
export function classifyTrustEntry(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return 'invalid'
  const [addr, prefix] = value.split('/')
  if (prefix !== undefined && !/^\d{1,3}$/.test(prefix)) return 'invalid'
  if (addr === '::1' || addr === '127.0.0.1') return 'loopback'
  if (addr === '0.0.0.0' || addr === '::') return 'invalid' // 一刀切放行，比公网项更糟
  if (addr.includes(':')) {
    const l = addr.toLowerCase()
    if (l === '::1' || l.startsWith('fe80:') || l.startsWith('fc') || l.startsWith('fd'))
      return 'private'
    return 'public'
  }
  const parts = addr.split('.')
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p) || Number(p) > 255))
    return 'invalid'
  const [a, b] = parts.map(Number)
  if (a === 127) return 'loopback'
  if (a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)) return 'private'
  if (a === 169 && b === 254) return 'loopback' // link-local：本机/云元数据面，等同回环风险，不算"公网对端"
  return 'public'
}

/** 生效值：.env 里设了就用它，否则用 config 默认；两处都取不到 ⇒ null（由调用方落 unjudged） */
export function resolveEffectiveTrustList(envText) {
  if (envText === null || envText === undefined) return null
  const m = envText.match(/^TRUSTED_PROXIES=(.*)$/m)
  if (!m) return { raw: CONFIG_DEFAULT, source: 'config 默认（.env 未设本键）' }
  const raw = m[1].trim()
  if (raw === '') return { raw: '', source: '.env 显式留空（不信任任何代理）' }
  return { raw, source: '.env 现值' }
}

export function judgeTrustList(effective) {
  if (effective === null) {
    return { state: 'unjudged', reason: '既读不到 apps/api/.env，也拿不到 config 默认 ⇒ 未判定' }
  }
  const entries = effective.raw
    ? effective.raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  if (entries.length === 0) {
    return {
      state: 'ok',
      reason: `${effective.source}：不信任任何代理 ⇒ request.ip == socket 远端地址，客户端头进不了判定`,
      entries: [],
    }
  }
  const families = entries.map((e) => ({ entry: e, family: classifyTrustEntry(e) }))
  const offenders = families.filter((f) => f.family === 'public' || f.family === 'invalid')
  if (offenders.length > 0) {
    return {
      state: 'breach',
      reason:
        `命中本表的对端会把 X-Forwarded-For 最左值当成 request.ip；下列项使公网客户端的头进入判定：` +
        offenders.map((o) => `${o.entry}(${o.family})`).join(' '),
      entries: families,
      fix: '先把权威客户端 IP 改成只认边缘设置的 cf-connecting-ip（客户端自带那条会被边缘覆盖），再保留本表项',
    }
  }
  return {
    state: 'ok',
    reason:
      `${effective.source}：全部条目属回环/站内私网 ⇒ 公网请求的 socket 对端不命中本表，伪造 XFF 进不了判定。` +
      `注意这是"巧合成立"：一旦有人把 CDN/cloudflared 出口 IP 填进来即翻为 breach（见 config 头注实测三态）`,
    entries: families,
  }
}

function main() {
  const selfTest = process.argv.includes('--self-test')
  const asJson = process.argv.includes('--json')
  if (selfTest) return runSelfTest()

  // 取材走受管 .env 唯一出口（lib/managed-env-face.mjs；门 118 的取材面纪律）。
  // 取不到 ⇒ null，由判定层落 unjudged —— 绝不回落成"当作没设"。
  const envText = readManagedEnvText('apps/api/.env')
  const verdict = judgeTrustList(resolveEffectiveTrustList(envText))
  if (asJson) {
    console.log(JSON.stringify(verdict))
  } else {
    console.log(`[ip-attribution-trust] state=${verdict.state} ${verdict.reason}`)
    if (verdict.entries?.length) {
      console.log('  条目归族: ' + verdict.entries.map((e) => `${e.entry}→${e.family}`).join(', '))
    }
    if (verdict.fix) console.log(`  出路: ${verdict.fix}`)
  }
  if (verdict.state === 'breach') return process.exit(1)
  if (verdict.state === 'unjudged') return process.exit(2)
  return process.exit(0)
}

function runSelfTest() {
  const cases = [
    // [输入 .env 文本, 期望状态, 说明]
    ['# nothing\n', 'ok', '未设本键 ⇒ 走 config 默认（仅回环）'],
    ['TRUSTED_PROXIES=127.0.0.1,::1\n', 'ok', '显式只回环'],
    ['TRUSTED_PROXIES=\n', 'ok', '显式留空 ⇒ 完全不信代理'],
    ['TRUSTED_PROXIES=10.0.0.0/8\n', 'ok', '站内私网'],
    ['TRUSTED_PROXIES=104.16.0.0/12\n', 'breach', 'CDN 出口段填进表 ⇒ 伪造 XFF 即刻生效'],
    ['TRUSTED_PROXIES=0.0.0.0\n', 'breach', '一刀切放行比公网项更糟，必须判 breach'],
  ]
  let pass = 0
  for (const [text, expect, note] of cases) {
    const got = judgeTrustList(resolveEffectiveTrustList(text)).state
    const ok = got === expect
    if (ok) pass++
    console.log(`${ok ? '✅' : '❌'} ${note}：期望 ${expect}，得到 ${got}`)
  }
  // 取不到输入必须是未判定，不许冒充 ok，也不许冒充 breach
  const u = judgeTrustList(resolveEffectiveTrustList(null)).state
  console.log(`${u === 'unjudged' ? '✅' : '❌'} 取不到生效值：期望 unjudged，得到 ${u}`)
  if (u !== 'unjudged') process.exit(1)
  // 反向自证：摘掉 breach 分支会全绿 ⇒ 这条必须存在
  if (classifyTrustEntry('8.8.8.8') !== 'public') {
    console.log('❌ 公网归族失效')
    process.exit(1)
  }
  console.log(
    pass === cases.length
      ? `SELF-TEST PASS ${pass + 2}/${cases.length + 2}`
      : `SELF-TEST FAIL ${pass}/${cases.length}`,
  )
  process.exit(pass === cases.length ? 0 : 1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { classifyTrustEntry, resolveEffectiveTrustList, judgeTrustList }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
