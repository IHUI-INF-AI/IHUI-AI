#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * notify-desktop-release.mjs — 桌面端发版成功后的多通道通知派发器(零依赖)。
 *
 * 由 release-desktop.yml 的 notify-release job 在 publish-updater-json 成功后调用。
 * 设计原则(与 notify-deploy-failure-ci.mjs 同型):
 *   - 只用 node: 内置模块 + runner 自带 curl,不读 workspace、不装依赖;
 *   - 每个通道独立 try/catch,凭据缺失/投递失败只 warn,不阻塞其他通道;
 *   - 整体 exit 0(通知失败绝不把一个成功的发版判成失败),--strict 时才 exit 1。
 *
 * 通道(按 RELEASE_NOTIFY_CHANNELS 逗号分隔选择,默认全部):
 *   admin-email   发版通知到管理员邮箱(凭据 SMTP_* + ALERT_EMAIL_TO;已验证可用)
 *   inapp         站内公告(POST /api/announcements,凭据 RELEASE_NOTIFY_API_URL + RELEASE_NOTIFY_TOKEN)
 *   broadcast     用户更新邮件群发(POST /api/announcements/email-push,同上凭据)
 *   im            即时通讯webhook(钉钉/飞书/企微,凭据 DINGTALK_WEBHOOK_URL / FEISHU_WEBHOOK_URL / WECOM_WEBHOOK_URL)
 *
 * 用法:
 *   node .github/scripts/notify-desktop-release.mjs \
 *     --tag desktop-v0.1.78 --version 0.1.78 \
 *     --run-url https://github.com/.../actions/runs/123 \
 *     [--channels admin-email,inapp,broadcast,im] [--dry-run] [--strict]
 *
 * 环境变量(全部可选,缺哪个就跳过对应通道):
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM / ALERT_EMAIL_TO
 *   RELEASE_NOTIFY_API_URL  (如 https://api.aizhs.top)
 *   RELEASE_NOTIFY_TOKEN    (有权限写公告的 JWT;CI 专用,非管理员个人 token)
 *   DINGTALK_WEBHOOK_URL / FEISHU_WEBHOOK_URL / WECOM_WEBHOOK_URL
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const has = (f) => argv.includes(f)
const opt = (f) => {
  const i = argv.indexOf(f)
  return i >= 0 ? argv[i + 1] : undefined
}

const tag = opt('--tag') || 'desktop-v0.1.78'
const version = opt('--version') || tag.replace(/^desktop-v/, '')
const runUrl = opt('--run-url') || ''
const dryRun = has('--dry-run')
const strict = has('--strict')
const channels = (opt('--channels') || process.env.RELEASE_NOTIFY_CHANNELS ||
  'admin-email,inapp,broadcast,im').split(',').map((s) => s.trim()).filter(Boolean)

const repo = process.env.GITHUB_REPOSITORY || 'IHUI-INF-AI/IHUI-AI'
const releaseUrl = `https://github.com/${repo}/releases/tag/${tag}`
const downloadUrl = `https://aizhs.top/download`
const feedUrl = 'https://aizhs.top/desktop-feed.json'

const results = []
const record = (channel, ok, detail) => {
  results.push({ channel, ok, detail })
  console.log(`[notify] ${ok ? 'OK' : 'SKIP/FAIL'} ${channel}: ${detail}`)
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const title = `智汇AI 桌面端 ${version} 已发布`
const summary = `桌面端 ${version} 已通过 CI 全平台构建并发布（Windows / macOS / Linux）。自动更新用户将在启动时收到升级提示；官网下载栏已同步为最新版。`

/** 通道:管理员邮件(SMTP 直发,复用零依赖 mime 构造) */
function notifyAdminEmail() {
  const host = (process.env.SMTP_HOST || '').trim()
  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10)
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASS || ''
  const fromRaw = (process.env.SMTP_FROM || '智汇AI <lizong@aizhs.top>').trim()
  const recipients = (process.env.ALERT_EMAIL_TO || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!host || !user || !pass || recipients.length === 0) {
    record('admin-email', false, 'SMTP 凭据或收件人未配置,跳过'); return
  }
  const fm = fromRaw.match(/<([^>]+)>/)
  const fromAddr = (fm ? fm[1] : fromRaw).trim()
  if (!fromAddr.includes('@')) { record('admin-email', false, `SMTP_FROM 非法:${fromRaw}`); return }

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111">
  <h2 style="color:#067647;margin:0 0 12px">${escapeHtml(title)}</h2>
  <p style="margin:0 0 16px">${escapeHtml(summary)}</p>
  <table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px">
    <tr><td style="background:#f5f5f5">版本</td><td>${escapeHtml(version)}</td></tr>
    <tr><td style="background:#f5f5f5">Tag</td><td>${escapeHtml(tag)}</td></tr>
    <tr><td style="background:#f5f5f5">Release</td><td><a href="${escapeHtml(releaseUrl)}">${escapeHtml(releaseUrl)}</a></td></tr>
    <tr><td style="background:#f5f5f5">下载页</td><td><a href="${escapeHtml(downloadUrl)}">${escapeHtml(downloadUrl)}</a></td></tr>
    <tr><td style="background:#f5f5f5">更新源</td><td><a href="${escapeHtml(feedUrl)}">${escapeHtml(feedUrl)}</a></td></tr>
    ${runUrl ? `<tr><td style="background:#f5f5f5">Run</td><td><a href="${escapeHtml(runUrl)}">${escapeHtml(runUrl)}</a></td></tr>` : ''}
  </table>
  <p style="margin:16px 0 0;color:#666;font-size:12px">本邮件由 .github/scripts/notify-desktop-release.mjs 零依赖直发。</p>
</body></html>`
  const enc = (v) => `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=`
  const mime = [
    `From: ${enc('智汇AI')} <${fromAddr}>`,
    `To: ${recipients.join(', ')}`,
    `Subject: ${enc(title)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomBytes(12).toString('hex')}@aizhs.top>`,
    'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '',
    Buffer.from(html, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'), '',
  ].join('\r\n')

  if (dryRun) { record('admin-email', true, `dry-run: to=${recipients.length} 人 subject=${title}`); return }
  const f = join(tmpdir(), `ihui-release-${randomBytes(8).toString('hex')}.eml`)
  writeFileSync(f, mime, { encoding: 'utf8', mode: 0o600 })
  const smtpUrl = port === 465 ? `smtps://${host}:${port}` : `smtp://${host}:${port}`
  const args = ['--silent', '--show-error', '--url', smtpUrl]
  if (port !== 465) args.push('--ssl-reqd')
  args.push('--user', `${user}:${pass}`, '--mail-from', fromAddr)
  for (const r of recipients) args.push('--mail-rcpt', r)
  args.push('--upload-file', f, '--connect-timeout', '15', '--max-time', '60')
  const res = spawnSync('curl', args, { encoding: 'utf8' })
  try { unlinkSync(f) } catch { /* ignore */ }
  const err = (res.stderr || '').replaceAll(pass, '***').trim()
  if (res.error || res.status !== 0) { record('admin-email', false, `SMTP 失败:${res.error?.message || err || res.status}`); return }
  record('admin-email', true, `已投递 ${recipients.length} 人`)
}

/** 站内公告 + 用户邮件群发:调生产 API(需 RELEASE_NOTIFY_API_URL + TOKEN) */
function notifyApi(kind) {
  const base = (process.env.RELEASE_NOTIFY_API_URL || '').trim().replace(/\/$/, '')
  const token = (process.env.RELEASE_NOTIFY_TOKEN || '').trim()
  if (!base || !token) { record(kind, false, 'RELEASE_NOTIFY_API_URL/TOKEN 未配置,跳过'); return }
  const isBroadcast = kind === 'broadcast'
  const path = isBroadcast ? '/api/announcements/email-push' : '/api/announcements'
  const body = isBroadcast
    ? JSON.stringify({ kind: 'changelog', version, date: new Date().toISOString().slice(0, 10), items: [summary, `Release: ${releaseUrl}`] })
    : JSON.stringify({ title, content: summary, type: 'release', platform: 'web', published: true })
  if (dryRun) { record(kind, true, `dry-run: POST ${base}${path}`); return }
  const res = spawnSync('curl', ['--silent', '--show-error', '--max-time', '30',
    '-X', 'POST', `${base}${path}`,
    '-H', 'Content-Type: application/json', '-H', `Authorization: Bearer ${token}`,
    '--data-binary', body], { encoding: 'utf8' })
  const out = (res.stdout || '').slice(0, 200)
  if (res.error || res.status !== 0) { record(kind, false, `API 失败:${res.error?.message || out || res.status}`); return }
  record(kind, true, `POST ${path} ok`)
}

/** IM webhook:钉钉/飞书/企微,凭据缺失跳过 */
function notifyIm() {
  const text = `**${title}**\n\n${summary}\n\n[下载页](${downloadUrl}) · [Release](${releaseUrl})`
  const targets = []
  if (process.env.DINGTALK_WEBHOOK_URL) targets.push(['dingtalk', process.env.DINGTALK_WEBHOOK_URL,
    JSON.stringify({ msgtype: 'markdown', markdown: { title, text } })])
  if (process.env.FEISHU_WEBHOOK_URL) targets.push(['feishu', process.env.FEISHU_WEBHOOK_URL,
    JSON.stringify({ msg_type: 'interactive', card: { header: { title: { tag: 'plain_text', content: title } },
      elements: [{ tag: 'markdown', content: text }] } })])
  if (process.env.WECOM_WEBHOOK_URL) targets.push(['wecom', process.env.WECOM_WEBHOOK_URL,
    JSON.stringify({ msgtype: 'markdown', markdown: { content: text } })])
  if (targets.length === 0) { record('im', false, 'IM webhook 未配置,跳过'); return }
  for (const [name, url, body] of targets) {
    if (dryRun) { record(`im/${name}`, true, `dry-run: POST ${name}`); continue }
    const res = spawnSync('curl', ['--silent', '--show-error', '--max-time', '30',
      '-X', 'POST', url, '-H', 'Content-Type: application/json', '--data-binary', body], { encoding: 'utf8' })
    const out = (res.stdout || '').slice(0, 160)
    if (res.error || res.status !== 0) record(`im/${name}`, false, `失败:${res.error?.message || out || res.status}`)
    else record(`im/${name}`, true, '已推送')
  }
}

console.log(`[notify] desktop release ${version} channels=${channels.join(',')} ${dryRun ? '(DRY-RUN)' : ''}`)
for (const ch of channels) {
  try {
    if (ch === 'admin-email') notifyAdminEmail()
    else if (ch === 'inapp') notifyApi('inapp')
    else if (ch === 'broadcast') notifyApi('broadcast')
    else if (ch === 'im') notifyIm()
    else record(ch, false, `未知通道:${ch}`)
  } catch (e) {
    record(ch, false, `异常:${String(e?.message || e).slice(0, 120)}`)
  }
}
const failed = results.filter((r) => !r.ok).length
console.log(`[notify] done: total=${results.length} skipped_or_failed=${failed}`)
// 通知失败不阻塞发版;仅 --strict 时以失败通道数退出(给人工诊断用)
process.exit(strict && failed > 0 ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
