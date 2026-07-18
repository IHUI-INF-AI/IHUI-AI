#!/usr/bin/env node
/**
 * 平台证书续签 Watchdog
 *
 * 周期性拉取 WeChat 平台证书,只在有变化时写入,避免无谓重启。
 * 集成告警:
 *   - 拉取失败 → exit 1 + 打印错误 (可被 cron / systemd / 监控捕获)
 *   - 证书将在 30 天内过期 → 打印 WARN (可触发邮件/钉钉 webhook)
 *   - 拉取成功且无变化 → 静默退出
 *
 * 用法:
 *   pnpm cert:watchdog                    # 拉取 + 对比 + 条件写入
 *   pnpm cert:watchdog --force             # 强制写入(忽略对比)
 *   pnpm cert:watchdog --webhook <url>     # 告警 webhook (Slack/钉钉/飞书)
 *
 * 建议 cron 频率: 每月 1 次 (crontab: 0 9 1 * *)
 *   平台证书有效期 5 年,无需高频拉取
 *
 * 与 fetch-wechat-platform-cert.mjs 的区别:
 *   - fetch 是底层 (直接调 WeChat API)
 *   - watchdog 是中层 (对比 + 告警 + 通知)
 *   - cert:check 是上层 (只检查本地证书有效期,不发请求)
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { X509Certificate } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

// ── 解析参数 ───────────────────────────────────────────────────────
const args = process.argv.slice(2)
let force = false
let webhookUrl = null
const certPath = resolve(PROJECT_ROOT, 'cert/platform_cert.pem')

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--force') force = true
  else if (args[i] === '--webhook' && args[i + 1]) {
    webhookUrl = args[i + 1]
    i++
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.info('用法: pnpm cert:watchdog [--force] [--webhook <url>]')
    process.exit(0)
  }
}

const log = (...a) => console.info('[cert-watchdog]', ...a)
const err = (...a) => console.error('[cert-watchdog] ✗', ...a)

// ── 通知 webhook ──────────────────────────────────────────────────
async function notify(level, message) {
  if (!webhookUrl) return
  try {
    const payload = {
      level, // 'info' | 'warning' | 'error'
      service: 'wechat-pay-cert-watchdog',
      timestamp: new Date().toISOString(),
      message,
    }
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
  } catch (e) {
    err(`通知发送失败: ${e.message}`)
  }
}

// ── 读取旧证书 ─────────────────────────────────────────────────────
function readOldCert() {
  if (!existsSync(certPath)) return null
  try {
    return readFileSync(certPath, 'utf-8')
  } catch {
    return null
  }
}

// ── 比较新旧证书 ──────────────────────────────────────────────────
function isSameCert(a, b) {
  if (!a || !b) return false
  // 标准化 (去除首尾空白/换行)
  return a.replace(/\s+/g, '') === b.replace(/\s+/g, '')
}

// ── 检查证书有效期 ────────────────────────────────────────────────
function checkExpiry(certPem) {
  try {
    const cert = new X509Certificate(certPem)
    const notAfter = new Date(cert.validTo)
    const daysLeft = Math.floor((notAfter.getTime() - Date.now()) / 86400000)
    return {
      valid: true,
      notAfter: notAfter.toISOString(),
      daysLeft,
      serialNumber: cert.serialNumber,
    }
  } catch (e) {
    return { valid: false, error: e.message }
  }
}

// ── 主流程 ─────────────────────────────────────────────────────────
async function main() {
  log(`开始拉取平台证书 (${new Date().toISOString()})`)

  // 1. 调用 fetch 脚本 (复用现有逻辑)
  const fetchScript = resolve(PROJECT_ROOT, 'scripts/fetch-wechat-platform-cert.mjs')
  if (!existsSync(fetchScript)) {
    err(`fetch 脚本不存在: ${fetchScript}`)
    await notify('error', `fetch 脚本不存在: ${fetchScript}`)
    process.exit(1)
  }

  const oldCert = readOldCert()

  await new Promise((resolveProm, rejectProm) => {
    const child = spawn(
      process.execPath,
      [fetchScript],
      {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        env: process.env,
      },
    )
    child.on('exit', (code) => {
      if (code === 0) resolveProm()
      else rejectProm(new Error(`fetch 退出码 ${code}`))
    })
    child.on('error', rejectProm)
  }).catch(async (e) => {
    err(`拉取失败: ${e.message}`)
    await notify('error', `平台证书拉取失败: ${e.message}`)
    process.exit(1)
  })

  // 2. 读取新证书
  if (!existsSync(certPath)) {
    err(`拉取成功但 ${certPath} 仍未生成`)
    process.exit(1)
  }
  const newCert = readFileSync(certPath, 'utf-8')

  // 3. 对比
  if (!force && isSameCert(oldCert, newCert)) {
    log('平台证书无变化,跳过写入')
    return
  }

  if (force || !oldCert) {
    log(force ? '强制拉取模式' : '首次拉取,无旧证书对比')
  } else {
    log('平台证书已更新,需要重启 API 才能生效')
  }

  // 4. 检查新证书有效期
  const expiry = checkExpiry(newCert)
  if (!expiry.valid) {
    err(`新证书格式异常: ${expiry.error}`)
    process.exit(1)
  }
  log(`新证书序列号: ${expiry.serialNumber}`)
  log(`新证书到期: ${expiry.notAfter} (${expiry.daysLeft} 天)`)

  if (expiry.daysLeft < 30) {
    const msg = `⚠️ 平台证书将在 ${expiry.daysLeft} 天内过期 (${expiry.notAfter}),请尽快续签!`
    err(msg)
    await notify('warning', msg)
  } else {
    log('✅ 平台证书状态正常')
    await notify('info', `平台证书已更新,新序列号 ${expiry.serialNumber},${expiry.daysLeft} 天后到期`)
  }
}

main().catch((e) => {
  err(`未捕获异常: ${e.message}`)
  process.exit(1)
})
