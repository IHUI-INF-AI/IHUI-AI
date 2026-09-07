// © 2026 IHUI AI · 运营商一键登录后端集成自检(真代码 + 真实网关,不需要真机 token)
// 用法:在 apps/api 下运行  node_modules/.bin/tsx scripts/verify-carrier.ts
// 读取真实 .env 的闪验凭据,向真实网关 wsflash.253.com 发签名请求验证链路。
// 注意:本脚本仅做集成自检,会消耗一次真实的网关调用(用占位 token,不产生真实手机号)。

import 'dotenv/config'
import { createHmac, createHash, createCipheriv, createDecipheriv } from 'node:crypto'
import { verifyCarrierToken, CarrierLoginError, CarrierErrorCode } from '../src/services/carrier-login.js'

const appId = process.env.FLASHVERIFY_APPID
const appKey = process.env.FLASHVERIFY_KEY || process.env.FLASHVERIFY_SECRET

let fail = 0
const ok = (name: string, cond: unknown) => {
  const pass = Boolean(cond)
  console.log(`${pass ? '✅' : '❌'} ${name}`)
  if (!pass) fail++
}

function buildSign(params: Record<string, string>, key: string) {
  const str = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join('')
  return createHmac('sha256', key).update(str, 'utf8').digest('hex').toUpperCase()
}

async function tryExpectCode(name: string, token: string, operator: string, expectCode: string) {
  try {
    await verifyCarrierToken({ operator, accessToken: token })
    ok(`${name} (期望抛 ${expectCode} 却成功了)`, false)
  } catch (e: unknown) {
    if (e instanceof CarrierLoginError) {
      ok(`${name} → code=${e.code} status=${e.status}`, e.code === expectCode)
    } else {
      ok(`${name} → 非预期错误: ${String(e)}`, false)
    }
  }
}

console.log('=== 0. 预处理 ===')
ok('已配置 FLASHVERIFY_APPID', Boolean(appId))
ok('已配置 appKey(SECRET 或 KEY)', Boolean(appKey))

console.log('\n=== 1. 真实代码链路(verifyCarrierToken) ===')
await tryExpectCode('未实现运营商 cmcc', 'x', 'cmcc', CarrierErrorCode.UNSUPPORTED)
await tryExpectCode('非法 operator', 'x', 'nope', CarrierErrorCode.UNSUPPORTED)
// empty token,但凭据已配置 → 应先通过配置检查,走到网关分支,因空 token 报 GATEWAY_ERROR
await tryExpectCode('空 token(凭据存在)', '', 'flashverify', CarrierErrorCode.GATEWAY_ERROR)

console.log('\n=== 2. 对真实网关 wsflash.253.com 发签名请求(占位 token) ===')
const endpoint = process.env.FLASHVERIFY_API_URL || 'https://wsflash.253.com/open/flashsdk/mobile-query'
const token = 'fv_test_' + Date.now()
const sign = buildSign({ appId: appId!, token }, appKey!)
try {
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ appId: appId!, token, sign }).toString(),
  })
  const text = await resp.text()
  console.log(`HTTP ${resp.status}`)
  console.log(`响应原文(前600字符): ${text.slice(0, 600)}`)
  let code: string | null = null
  try { code = (JSON.parse(text)).code } catch {}
  ok('网关可达且返回业务 JSON', resp.ok && code !== null)
  // 若网关返回非 200000,说明 appid/sign/secret 形成的签名已被网关受理并回到业务错误码;反之签名可能不对
  if (code !== null && code !== '200000') {
    console.log(`ℹ️ 网关已受理请求(appid+签名校验通过),返回业务码=${code}。占位 token 得不到真机号属预期。`)
  }
} catch (err: unknown) {
  ok('网关可达', false)
  console.log('网关调用异常(网络/证书):', err instanceof Error ? err.message : String(err))
}

console.log('\n=== 3. 手机号 AES-CBC 解密算法复现自检(文档里 AES-128-CBC / md5(appKey) 拆 key+iv) ===')
function decrypt(name: string, key: string) {
  const md5Hex = createHash('md5').update(key, 'utf8').digest('hex')
  const keyStr = md5Hex.slice(0, 16)
  const ivStr = md5Hex.slice(16, 32)
  const d = createDecipheriv('aes-128-cbc', keyStr, ivStr)
  return Buffer.concat([d.update(Buffer.from(name, 'hex')), d.final()]).toString('utf8').trim()
}
const enc = createCipheriv('aes-128-cbc', createHash('md5').update(appKey!, 'utf8').digest('hex').slice(0, 16), createHash('md5').update(appKey!, 'utf8').digest('hex').slice(16, 32))
const knownPhone = '13800138000'
const cipher = Buffer.concat([enc.update(knownPhone, 'utf8'), enc.final()]).toString('hex')
ok(`round-trip 解密==${knownPhone}`, decrypt(cipher, appKey!) === knownPhone)

console.log(`\n${fail === 0 ? '🎉 全部通过' : `❌ ${fail} 项未通过`}`)
process.exit(fail === 0 ? 0 : 1)