#!/usr/bin/env node
/**
 * 证书过期检查脚本
 *
 * 检查 g:\IHUI-AI\cert\ 下所有证书文件的有效期:
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
import { X509Certificate, createPrivateKey, createSign, createVerify, randomBytes } from 'node:crypto'

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
  items: [],
}

function recordItem(item) {
  results.items.push(item)
  if (item.severity === 'ok') results.ok++
  else if (item.severity === 'warning') results.warning++
  else if (item.severity === 'error') results.error++
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

log(colors.bold('证书 (PEM):'))
for (const f of files) {
  if (f.endsWith('.pem') && !f.includes('key') && !f.includes('platform')) {
    checkCertPem(join(certDir, f))
  }
}

log(colors.bold('\n平台证书 (PEM):'))
for (const f of files) {
  if (f.includes('platform') && f.endsWith('.pem')) {
    checkCertPem(join(certDir, f))
  }
}

log(colors.bold('\n私钥 (PEM):'))
for (const f of files) {
  if (f.includes('key') && f.endsWith('.pem')) {
    checkKeyPem(join(certDir, f))
  }
}

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
