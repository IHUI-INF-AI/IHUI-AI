#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 证书过期检查脚本
 *
 * 检查项目根目录下 cert/ 下所有证书文件的有效期:
 * - 提前 30 天告警 (黄色)
 * - 已过期告警 (红色,exit code 1)
 * - 私钥格式校验 (PKCS#8 / RSA 2048)
 * - 证书与私钥匹配性校验
 *
 * 用法:
 *   pnpm cert:check                     # 默认检查 cert/ 目录
 *   pnpm cert:check --dir ./certs       # 自定义目录
 *   pnpm cert:check --warn-days 60      # 自定义告警阈值
 *   pnpm cert:check --json              # JSON 输出 (供监控接入)
 *
 * 退出码:
 *   0  - 全部正常
 *   1  - 有证书已过期
 *   2  - 有证书将在 N 天内过期
 *   3  - 证书文件缺失或格式错误
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { X509Certificate, createPrivateKey, createPublicKey, createSign, createVerify, randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

// ── 解析参数 ───────────────────────────────────────────────────────
const args = process.argv.slice(2)
let certDir = resolve(PROJECT_ROOT, 'cert')
let warnDays = 30
let jsonOutput = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' && args[i + 1]) {
    certDir = resolve(args[i + 1])
    i++
  } else if (args[i] === '--warn-days' && args[i + 1]) {
    warnDays = parseInt(args[i + 1], 10)
    i++
  } else if (args[i] === '--json') {
    jsonOutput = true
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.info('用法: pnpm cert:check [--dir <path>] [--warn-days <N>] [--json]')
    process.exit(0)
  }
}

// ── 颜色辅助 ───────────────────────────────────────────────────────
const colors = {
  red: (s) => process.stdout.isTTY ? `\x1b[31m${s}\x1b[0m` : s,
  yellow: (s) => process.stdout.isTTY ? `\x1b[33m${s}\x1b[0m` : s,
  green: (s) => process.stdout.isTTY ? `\x1b[32m${s}\x1b[0m` : s,
  gray: (s) => process.stdout.isTTY ? `\x1b[90m${s}\x1b[0m` : s,
  bold: (s) => process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s,
}

const log = (...a) => { if (!jsonOutput) console.info(...a) }
const err = (...a) => { if (!jsonOutput) console.error(...a) }

// ── 检查结果收集 ──────────────────────────────────────────────────
const results = {
  ok: 0,
  warning: 0,
  error: 0,
  unrecognized: 0,
  items: [],
}

function recordItem(item) {
  results.items.push(item)
  if (item.severity === 'ok') results.ok++
  else if (item.severity === 'warning') results.warning++
  else if (item.severity === 'error') results.error++
}

/**
 * **按内容**判一个 .pem 是什么(看 PEM 的 MARKER 行),不按文件名。
 *
 * 立因(2026-09-27 实测):旧分类写的是 `f.includes('key')` ⇒ `cert/pub_key.pem`
 * (微信支付**公钥模式**签发的 `-----BEGIN PUBLIC KEY-----`)被投进"私钥"那一路去跑
 * `createPrivateKey`,必然 `error:1E08010C:DECODER routines::unsupported` —— 于是这份周报
 * **永远挂着一条 error**。一条永远红的项与一道永远红的门是同一种病:读的人学会跳过它,
 * 真过期那天也一起被跳过。文件名里的 `pub_key`/`apiclient_key` 谁也没规定含义,
 * 而 PEM 自己写了它是什么 —— 判据该信内容。
 * @returns {{kind:'cert'|'public-key'|'private-key'|'other'|'unknown', marker:string|null}}
 */
export function classifyPemKind(text) {
  const m = /-----BEGIN ([A-Z0-9 ]+?)-----/.exec(String(text || ''))
  if (!m) return { kind: 'unknown', marker: null }
  const marker = m[1].trim()
  if (marker === 'CERTIFICATE') return { kind: 'cert', marker }
  if (marker === 'PUBLIC KEY' || marker === 'RSA PUBLIC KEY' || marker === 'EC PUBLIC KEY' || marker === 'DSA PUBLIC KEY')
    return { kind: 'public-key', marker }
  if (marker.endsWith('PRIVATE KEY')) return { kind: 'private-key', marker }
  return { kind: 'other', marker }
}

/**
 * 公钥(含微信支付"公钥模式"的 `pub_key.pem`):**没有到期概念**,所以不判过期、也不算错误。
 * 但"读得动"要判:解析不了就是真坏了(签名验证会静默失败 ⇒ 回调验签不通过)。
 * 刻意不冒充成"已确认证书有效"——它压根没有效期可确认。
 */
function checkPublicKeyPem(filePath, marker) {
  try {
    const key = createPublicKey(readFileSync(filePath, 'utf-8'))
    const detail = key.asymmetricKeyDetails || {}
    recordItem({
      file: filePath,
      type: 'public-key',
      severity: 'ok',
      algorithm: `${key.asymmetricKeyType}${detail.modulusLength ? `-${detail.modulusLength}` : ''}`,
      note: '公钥无到期概念(未判有效期)',
    })
    log(`${colors.green('✓')} ${colors.gray(filePath.replace(PROJECT_ROOT, '.'))}`)
    log(`    类型: ${marker} · 算法 ${key.asymmetricKeyType.toUpperCase()}${detail.modulusLength ? `-${detail.modulusLength}` : ''} · 公钥没有有效期,本项**不判到期**`)
  } catch (e) {
    recordItem({ file: filePath, type: 'public-key', severity: 'error', message: `公钥解析失败: ${e.message}` })
    err(`${colors.red('✗')} ${filePath}`)
    err(`${colors.red(`    公钥解析失败: ${e.message}`)}`)
  }
}

/** 既不是证书也不是任何一把密钥(RSA PRIVATE KEY 之外的怪形态等):判"未判定",不记绿也不冒红 */
function checkUnrecognizedPem(filePath, marker) {
  results.unrecognized++
  recordItem({ file: filePath, type: 'unknown', severity: 'unjudged', message: `未识别的 PEM 类型: ${marker || '(无 MARKER 行)'}` })
  log(`${colors.yellow('◽')} ${filePath} —— 未识别的 PEM 类型(${marker || '无 MARKER 行'}),不计通过也不计失败`)
}

/**
 * 按内容分流一个目录下的所有 .pem。**桶的键名 = classifyPemKind 返回的 kind**,
 * 刻意不再另起一套名字(第一版就是翻在这里:分类器给 `private-key`,桶却叫 `key`,
 * 于是 `seen[kind]` 取不到 ⇒ 两把密钥全掉进"未识别",而报告读起来像"没问题")。
 */
function checkAllPemIn(dir) {
  const buckets = { cert: [], 'private-key': [], 'public-key': [], other: [], unknown: [] }
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.pem'))) {
    const p = join(dir, f)
    if (!statSync(p).isFile()) continue
    const { kind, marker } = classifyPemKind(readFileSync(p, 'utf-8'))
    buckets[kind].push({ path: p, marker })
  }
  log(colors.bold('\n证书 (X.509):'))
  for (const e of buckets.cert) checkCertPem(e.path)
  log(colors.bold('\n私钥 (PEM):'))
  for (const e of buckets['private-key']) checkKeyPem(e.path)
  log(colors.bold('\n公钥 (无有效期,只验可解析):'))
  for (const e of buckets['public-key']) checkPublicKeyPem(e.path, e.marker)
  for (const e of [...buckets.other, ...buckets.unknown]) checkUnrecognizedPem(e.path, e.marker)
  return buckets
}

// ── 检查 PEM 证书 ─────────────────────────────────────────────────
function checkCertPem(filePath) {
  if (!existsSync(filePath)) {
    recordItem({
      file: filePath,
      type: 'cert',
      severity: 'error',
      message: '文件不存在',
    })
    return
  }
  try {
    const content = readFileSync(filePath, 'utf-8')
    const cert = new X509Certificate(content)
    const notAfter = new Date(cert.validTo)
    const notBefore = new Date(cert.validFrom)
    const now = new Date()
    const daysLeft = Math.floor((notAfter.getTime() - now.getTime()) / 86400000)

    const isExpired = daysLeft < 0
    const isWarning = daysLeft >= 0 && daysLeft <= warnDays
    const severity = isExpired ? 'error' : isWarning ? 'warning' : 'ok'

    recordItem({
      file: filePath,
      type: 'cert',
      severity,
      subject: cert.subject,
      issuer: cert.issuer,
      serialNumber: cert.serialNumber,
      notBefore: notBefore.toISOString(),
      notAfter: notAfter.toISOString(),
      daysLeft,
      fingerprint256: cert.fingerprint256,
    })

    const colorFn = severity === 'error' ? colors.red : severity === 'warning' ? colors.yellow : colors.green
    const statusIcon = severity === 'error' ? '✗' : severity === 'warning' ? '⚠' : '✓'
    log(`  ${colorFn(statusIcon)} ${colors.gray(filePath.replace(PROJECT_ROOT, '.'))}`)
    log(`    Subject:    ${cert.subject}`)
    log(`    Issuer:     ${cert.issuer}`)
    log(`    Serial:     ${cert.serialNumber}`)
    log(`    Valid:      ${notBefore.toISOString().slice(0, 10)} → ${notAfter.toISOString().slice(0, 10)}`)
    log(`    Days left:  ${colorFn(`${daysLeft} 天`)}`)
  } catch (e) {
    recordItem({
      file: filePath,
      type: 'cert',
      severity: 'error',
      message: `解析失败: ${e.message}`,
    })
    err(colors.red(`  ✗ ${filePath}`))
    err(colors.red(`    解析失败: ${e.message}`))
  }
}

// ── 检查 PEM 私钥 ─────────────────────────────────────────────────
function checkKeyPem(filePath) {
  if (!existsSync(filePath)) {
    recordItem({
      file: filePath,
      type: 'key',
      severity: 'error',
      message: '文件不存在',
    })
    return
  }
  try {
    const content = readFileSync(filePath, 'utf-8')
    const key = createPrivateKey(content)
    const detail = key.asymmetricKeyDetails || {}
    recordItem({
      file: filePath,
      type: 'key',
      severity: 'ok',
      algorithm: detail.modulusLength ? `RSA-${detail.modulusLength}` : key.asymmetricKeyType,
      modulusLength: detail.modulusLength,
    })
    log(`  ${colors.green('✓')} ${colors.gray(filePath.replace(PROJECT_ROOT, '.'))}`)
    log(`    Algorithm:  ${key.asymmetricKeyType.toUpperCase()}${detail.modulusLength ? `-${detail.modulusLength}` : ''}`)
  } catch (e) {
    recordItem({
      file: filePath,
      type: 'key',
      severity: 'error',
      message: `解析失败: ${e.message}`,
    })
    err(colors.red(`  ✗ ${filePath}`))
    err(colors.red(`    解析失败: ${e.message}`))
  }
}

// ── 检查证书 ↔ 私钥 匹配 ─────────────────────────────────────────
function checkCertKeyMatch(certPath, keyPath) {
  try {
    const cert = new X509Certificate(readFileSync(certPath, 'utf-8'))
    const key = createPrivateKey(readFileSync(keyPath, 'utf-8'))
    // 随机签名验证 (与 wechat-pay-cert.test.ts 一致)
    const payload = randomBytes(32).toString('hex')
    const sign = createSign('RSA-SHA256')
    sign.update(payload, 'utf-8')
    const signature = sign.sign(key, 'base64')
    const verify = createVerify('RSA-SHA256')
    verify.update(payload, 'utf-8')
    const valid = verify.verify(cert.publicKey, Buffer.from(signature, 'base64'))

    if (valid) {
      recordItem({
        file: `${certPath} ↔ ${keyPath}`,
        type: 'match',
        severity: 'ok',
        message: '签名验证通过,证书与私钥匹配',
      })
      log(`  ${colors.green('✓')} ${colors.gray('证书 ↔ 私钥 匹配性验证')}`)
    } else {
      recordItem({
        file: `${certPath} ↔ ${keyPath}`,
        type: 'match',
        severity: 'error',
        message: '签名验证失败,证书与私钥不匹配',
      })
      err(colors.red(`  ✗ 证书 ↔ 私钥 不匹配!`))
    }
  } catch (e) {
    recordItem({
      file: `${certPath} ↔ ${keyPath}`,
      type: 'match',
      severity: 'error',
      message: `验证失败: ${e.message}`,
    })
    err(colors.red(`  ✗ 证书 ↔ 私钥 验证异常: ${e.message}`))
  }
}

// ── 主流程 ─────────────────────────────────────────────────────────
log(colors.bold(`\n📋 证书过期检查  ${colors.gray(`(目录: ${certDir}, 告警阈值: ${warnDays} 天)`)}\n`))

if (!existsSync(certDir)) {
  if (jsonOutput) {
    console.info(JSON.stringify({ ok: 0, warning: 0, error: 1, items: [{ severity: 'error', message: `目录不存在: ${certDir}` }] }))
  } else {
    err(colors.red(`❌ 证书目录不存在: ${certDir}`))
  }
  process.exit(3)
}

const files = readdirSync(certDir).filter((f) => {
  const p = join(certDir, f)
  return statSync(p).isFile()
})

if (files.length === 0) {
  if (jsonOutput) {
    console.info(JSON.stringify({ ok: 0, warning: 0, error: 1, items: [{ severity: 'error', message: `目录为空: ${certDir}` }] }))
  } else {
    err(colors.yellow(`⚠️  证书目录为空: ${certDir}`))
  }
  process.exit(3)
}

// 分流一律按**内容**(见 classifyPemKind),不再按文件名 —— 旧写法把 pub_key.pem 当私钥去解析,
// 每周报告因此永远挂一条假 error。
checkAllPemIn(certDir)

// 证书 ↔ 私钥 匹配性
const merchantCert = files.find((f) => f.includes('apiclient_cert.pem') && !f.includes('platform'))
const merchantKey = files.find((f) => f.includes('apiclient_key.pem'))
if (merchantCert && merchantKey) {
  log(colors.bold('\n证书 ↔ 私钥 匹配性:'))
  checkCertKeyMatch(join(certDir, merchantCert), join(certDir, merchantKey))
}

// ── 输出汇总 ──────────────────────────────────────────────────────
log(colors.bold(`\n📊 汇总:`))
log(`  ${colors.green(`✓ OK:     ${results.ok}`)}`)
if (results.warning > 0) log(`  ${colors.yellow(`⚠ Warning: ${results.warning}`)}`)
if (results.error > 0) log(`  ${colors.red(`✗ Error:   ${results.error}`)}`)

if (jsonOutput) {
  console.info(JSON.stringify(results, null, 2))
}

if (results.error > 0) {
  log(colors.red('\n❌ 有证书错误,exit 1'))
  process.exit(1)
}
if (results.warning > 0) {
  log(colors.yellow(`\n⚠️  有证书将在 ${warnDays} 天内过期,exit 2`))
  process.exit(2)
}
log(colors.green('\n✅ 所有证书状态正常,exit 0'))
process.exit(0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
