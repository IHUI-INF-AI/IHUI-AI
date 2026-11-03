// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CI 告警脚本需要 stdout 诊断 */
/**
 * CI 部署失败告警的最小派发器(零依赖)。
 *
 * 为什么存在(2026-11-04):
 *   blue-green-deploy 的失败通知步原先走 `tsx apps/api/scripts/notify-deploy-failure.ts`,
 *   其 import 链要求 packages/shared/node_modules/@ihui/api-client/dist/index.js 已构建;
 *   runner 只做 pnpm install、不构建该 dist ⇒ 2026-09-27 / 10-22 / 11-03 三次同型
 *   ERR_MODULE_NOT_FOUND,失败邮件一封都发不出。本脚本只用 node: 内置模块 + runner
 *   自带的 curl 直连 SMTP,不读取 workspace、不安装任何依赖。
 *
 * 取舍(相对品牌版):
 *   放弃 email-templates 品牌渲染与去重台账(那些住在 apps/api 的模板与 nodemailer
 *   依赖链里),换「通知链路自身不会因依赖缺失而失效」;正文保留事故判读四要素
 *   (环境/阶段/触发者/run 链接),仍是可处置的告警。品牌版式由生产机 deployloop
 *   调用 apps/api 脚本的那条路径继续承担。
 *
 * 用法:
 *   node .github/scripts/notify-deploy-failure-ci.mjs \
 *     --environment production --stage "job=deploy / run#1" --trigger octocat \
 *     --source github-actions/blue-green-deploy \
 *     --run-url https://github.com/OWNER/REPO/actions/runs/123 \
 *     [--to a@x.com,b@y.com] [--strict] [--dry-run]
 *
 * 环境变量: SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM / ALERT_EMAIL_TO
 *
 * 退出码:
 *   0  已投递;未配置且不带 --strict;--dry-run 成功
 *   1  配置缺失或投递失败且带 --strict(调用方在 failure() 分支,红只是把原因说清楚)
 */

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const hasFlag = (flag) => argv.includes(flag)
const takeOpt = (flag) => {
  const i = argv.indexOf(flag)
  return i >= 0 ? argv[i + 1] : undefined
}

const environment = takeOpt('--environment') || 'production'
const stage = takeOpt('--stage') || 'unknown'
const trigger = takeOpt('--trigger') || 'unknown'
const source = takeOpt('--source') || 'github-actions/blue-green-deploy'
const runUrl = takeOpt('--run-url') || ''
const dryRun = hasFlag('--dry-run')
const strict = hasFlag('--strict')

const host = (process.env.SMTP_HOST || '').trim()
const portRaw = (process.env.SMTP_PORT || '587').trim()
const port = Number.parseInt(portRaw, 10)
const user = process.env.SMTP_USER || ''
const pass = process.env.SMTP_PASS || ''
const fromRaw = (process.env.SMTP_FROM || '智汇AI官方 <IHUI-AI@aizhs.top>').trim()
const recipients = (takeOpt('--to') || process.env.ALERT_EMAIL_TO || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

function failOrExit(message) {
  console.error(`[notify] ${message}`)
  process.exit(strict ? 1 : 0)
}

if (!host || !user || !pass || recipients.length === 0) {
  failOrExit('通道未配置(SMTP_HOST/SMTP_USER/SMTP_PASS/ALERT_EMAIL_TO 至少一项为空)，本次不投递')
}
if (!Number.isFinite(port) || port <= 0) {
  failOrExit(`SMTP_PORT 非法: ${portRaw}`)
}

const fromMatch = fromRaw.match(/<([^>]+)>/)
const fromAddr = (fromMatch ? fromMatch[1] : fromRaw).trim()
const fromName = fromMatch ? fromRaw.slice(0, fromMatch.index).trim() : ''
if (!fromAddr.includes('@')) {
  failOrExit(`SMTP_FROM 缺少合法地址: ${fromAddr}`)
}

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const subject = `【智汇通报】部署失败 — ${environment}`
const html = `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111">
  <h2 style="color:#b42318;margin:0 0 12px">部署失败告警</h2>
  <p style="margin:0 0 16px">CI 部署工作流在 <strong>${escapeHtml(environment)}</strong> 环境失败。</p>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
    <tr><td style="background:#f5f5f5">环境</td><td>${escapeHtml(environment)}</td></tr>
    <tr><td style="background:#f5f5f5">阶段</td><td>${escapeHtml(stage)}</td></tr>
    <tr><td style="background:#f5f5f5">触发者</td><td>${escapeHtml(trigger)}</td></tr>
    <tr><td style="background:#f5f5f5">来源</td><td>${escapeHtml(source)}</td></tr>
    ${runUrl ? `<tr><td style="background:#f5f5f5">Run</td><td><a href="${escapeHtml(runUrl)}">${escapeHtml(runUrl)}</a></td></tr>` : ''}
  </table>
  <p style="margin:16px 0 0;color:#666;font-size:12px">
    该工作流已于 2026-09-07 退役；生产部署由生产机 IHUI-DEPLOYLOOP 每 60s 轮询 origin/main 承担。
    本邮件由 .github/scripts/notify-deploy-failure-ci.mjs 零依赖直发。
  </p>
</body></html>`

const encodeHeader = (value) => `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`

const date = new Date().toUTCString()
const messageId = `<${randomBytes(12).toString('hex')}@aizhs.top>`
const fromHeader = fromName ? `${encodeHeader(fromName)} <${fromAddr}>` : fromAddr
const bodyBase64 = Buffer.from(html, 'utf8').toString('base64')
const wrappedBody = bodyBase64.replace(/(.{76})/g, '$1\r\n')

const mime = [
  `From: ${fromHeader}`,
  `To: ${recipients.join(', ')}`,
  `Subject: ${encodeHeader(subject)}`,
  `Date: ${date}`,
  `Message-ID: ${messageId}`,
  'MIME-Version: 1.0',
  'Content-Type: text/html; charset=UTF-8',
  'Content-Transfer-Encoding: base64',
  '',
  wrappedBody,
  '',
].join('\r\n')

const maskRecipient = (addr) => addr.replace(/^([^@])[^@]*(@.*)$/, '$1***$2')
const smtpUrl = port === 465 ? `smtps://${host}:${port}` : `smtp://${host}:${port}`

if (dryRun) {
  console.log('[notify] dry-run: 未发起任何网络请求')
  console.log(
    `[notify] channel=smtp url=${smtpUrl} starttls=${port !== 465 ? 'required' : 'implicit-tls'}`,
  )
  console.log(`[notify] from=${fromAddr} recipients=${recipients.map(maskRecipient).join(',')}`)
  console.log(`[notify] subject=${subject}`)
  console.log(
    `[notify] html_bytes=${Buffer.byteLength(html, 'utf8')} mime_bytes=${Buffer.byteLength(mime, 'utf8')}`,
  )
  console.log('[notify] mime-headers:')
  console.log(
    mime
      .split('\r\n\r\n')[0]
      .split('\r\n')
      .map((line) =>
        line.startsWith('To:') ? `To: ${recipients.map(maskRecipient).join(', ')}` : line,
      )
      .join('\n'),
  )
  process.exit(0)
}

const messageFile = join(tmpdir(), `ihui-notify-${randomBytes(8).toString('hex')}.eml`)
writeFileSync(messageFile, mime, { encoding: 'utf8', mode: 0o600 })

const curlArgs = ['--silent', '--show-error', '--url', smtpUrl]
if (port !== 465) curlArgs.push('--ssl-reqd')
curlArgs.push('--user', `${user}:${pass}`, '--mail-from', fromAddr)
for (const rcpt of recipients) curlArgs.push('--mail-rcpt', rcpt)
curlArgs.push('--upload-file', messageFile, '--connect-timeout', '15', '--max-time', '60')

const result = spawnSync('curl', curlArgs, { encoding: 'utf8' })
const stderr = (result.stderr || '').replaceAll(pass, '***').trim()
try {
  unlinkSync(messageFile)
} catch {
  /* 临时文件清理失败不改变投递结论 */
}

if (result.error) {
  failOrExit(`curl 无法启动: ${result.error.message}`)
}
if (result.status !== 0) {
  failOrExit(`SMTP 投递失败 exit=${result.status} stderr=${stderr || '(empty)'}`)
}

console.log(
  `[notify] delivered channel=smtp url=${smtpUrl} recipients=${recipients.map(maskRecipient).join(',')} subject=${subject}`,
)
process.exit(0)
