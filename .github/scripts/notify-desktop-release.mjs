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
 *   inapp         站内公告(POST /api/admin/content/announcement,凭据通知 token)
 *   broadcast     用户更新邮件群发(POST /api/announcements/email-push,同上凭据)
 *   im            即时通讯:群机器人 webhook 优先(推荐,无接收人/权限/IP 限制);
 *                 无 webhook 时用企业应用凭据换 token 尝试发应用消息
 *                 (钉钉 DINGTALK_APP_KEY/SECRET/APP_AGENT_ID → 根部门;企微 WECOM_CORP_ID/SECRET/AGENT_ID → @all;
 *                  飞书 FEISHU_APP_ID/SECRET/CHAT_ID → 群)。全部缺失才跳过。
 *                 注意:登录/SSO 类应用常被限权(钉钉 errcode=88)或 IP 白名单(企微 errcode=60020);
 *                 CI runner 出口 IP 不固定,IM 通道生产可用需配专用消息机器人 webhook。
 *                 任一通道失败只 WARN,不影响发版结论。
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
 *   RELEASE_NOTIFY_TOKEN    (有权限写公告的 JWT) 或 RELEASE_NOTIFY_TOKEN_FILE(JWT 文件路径;本机模式)
 *   webhook: DINGTALK_WEBHOOK_URL / FEISHU_WEBHOOK_URL / WECOM_WEBHOOK_URL(或旧名 WECHAT_WEBHOOK_URL)
 *   app 凭据: DINGTALK_APP_KEY / DINGTALK_APP_SECRET / DINGTALK_APP_AGENT_ID
 *             WECOM_CORP_ID / WECOM_SECRET / WECOM_AGENT_ID
 *             FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_CHAT_ID(需群ID)
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
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

/**
 * 站内公告 + 用户邮件群发:调生产真实端点(2026-11-17 按 apps/api/src/routes 核实)
 *   inapp     POST /api/admin/content/announcement  (admin JWT;字段 isPublished,不是 published)
 *   broadcast POST /api/announcements/email-push     (mode=changelog + 结构化 items,旧 body 必被 400 拒)
 * 凭据:RELEASE_NOTIFY_TOKEN(CI secret),或 RELEASE_NOTIFY_TOKEN_FILE 指向本机 JWT 文件。
 */
function resolveNotifyToken() {
  const inline = (process.env.RELEASE_NOTIFY_TOKEN || '').trim()
  if (inline) return inline
  const file = (process.env.RELEASE_NOTIFY_TOKEN_FILE || '').trim()
  if (!file) return ''
  try { return readFileSync(file, 'utf8').trim() } catch { return '' }
}

function notifyApi(kind) {
  const base = (process.env.RELEASE_NOTIFY_API_URL || 'https://api.aizhs.top').trim().replace(/\/$/, '')
  const token = resolveNotifyToken()
  if (!token) { record(kind, false, '通知 token 未配置(RELEASE_NOTIFY_TOKEN / _FILE),跳过'); return }
  const isBroadcast = kind === 'broadcast'
  const path = isBroadcast ? '/api/announcements/email-push' : '/api/admin/content/announcement'
  const body = isBroadcast
    ? JSON.stringify({ mode: 'changelog', version,
        items: [{ tag: 'NEW', title: `桌面端 ${version} 已发布`, desc: summary.slice(0, 280) }] })
    : JSON.stringify({ title, content: summary, type: 'release', isPinned: false,
        isPublished: true, publishedAt: new Date().toISOString() })
  if (dryRun) { record(kind, true, `dry-run: POST ${base}${path} body=${body.slice(0, 90)}...`); return }
  const res = spawnSync('curl', ['--silent', '--show-error', '--max-time', '30',
    '-X', 'POST', `${base}${path}`,
    '-H', 'Content-Type: application/json', '-H', `Authorization: Bearer ${token}`,
    '--data-binary', body], { encoding: 'utf8' })
  const out = (res.stdout || '').slice(0, 200)
  if (res.error || res.status !== 0) { record(kind, false, `API 失败:${res.error?.message || out || res.status}`); return }
  record(kind, true, `POST ${path} ok`)
}

/** 用 curl 取 JSON(带 HTTP 状态),零依赖 */
function httpJson(url, opts = {}) {
  const { method = 'GET', body, headers = [] } = opts
  const args = ['--silent', '--show-error', '--max-time', '30', '-w', '\n__HTTP__%{http_code}']
  if (method === 'POST') args.push('-X', 'POST', '-H', 'Content-Type: application/json')
  for (const h of headers) args.push('-H', h)
  if (body !== undefined) args.push('--data-binary', body)
  args.push(url)
  const res = spawnSync('curl', args, { encoding: 'utf8' })
  const raw = res.stdout || ''
  const i = raw.lastIndexOf('\n__HTTP__')
  const code = i >= 0 ? raw.slice(i + 9).trim() : String(res.status)
  const payload = i >= 0 ? raw.slice(0, i) : raw
  let json = null
  try { json = JSON.parse(payload) } catch { /* 非 JSON 响应 */ }
  return { ok: res.status === 0 && /^2/.test(code), code, json, err: (res.stderr || '').trim().slice(0, 120) }
}

/**
 * IM:群机器人 webhook 优先;无 webhook 时用企业内部应用凭据换 token 发应用消息。
 * webhook 无需接收人;app 模式:钉钉发根部门(dept_id_list=[1])、企微发 @all、飞书需 FEISHU_CHAT_ID。
 */
function notifyIm() {
  const text = `**${title}**\n\n${summary}\n\n[下载页](${downloadUrl}) · [Release](${releaseUrl})`
  const wecomWebhook = process.env.WECOM_WEBHOOK_URL || process.env.WECHAT_WEBHOOK_URL
  const webhookTargets = []
  if (process.env.DINGTALK_WEBHOOK_URL) webhookTargets.push(['dingtalk-webhook', process.env.DINGTALK_WEBHOOK_URL,
    JSON.stringify({ msgtype: 'markdown', markdown: { title, text } })])
  if (process.env.FEISHU_WEBHOOK_URL) webhookTargets.push(['feishu-webhook', process.env.FEISHU_WEBHOOK_URL,
    JSON.stringify({ msg_type: 'interactive', card: { header: { title: { tag: 'plain_text', content: title } },
      elements: [{ tag: 'markdown', content: text }] } })])
  if (wecomWebhook) webhookTargets.push(['wecom-webhook', wecomWebhook,
    JSON.stringify({ msgtype: 'markdown', markdown: { content: text } })])
  for (const [name, url, body] of webhookTargets) {
    if (dryRun) { record(`im/${name}`, true, `dry-run: POST ${name}`); continue }
    const r = httpJson(url, { method: 'POST', body })
    record(`im/${name}`, r.ok, r.ok ? 'webhook 已推送' : `webhook 失败 code=${r.code} ${r.err || ''}`)
  }

  // 钉钉:app 凭据换 token → asyncsend_v2(根部门)
  if (!process.env.DINGTALK_WEBHOOK_URL) {
    const ak = (process.env.DINGTALK_APP_KEY || '').trim()
    const as = (process.env.DINGTALK_APP_SECRET || '').trim()
    const aid = (process.env.DINGTALK_APP_AGENT_ID || '').trim()
    if (!ak || !as || !aid) record('im/dingtalk-app', false, '钉钉 app 凭据未配置,跳过')
    else if (dryRun) record('im/dingtalk-app', true, `dry-run: gettoken + asyncsend_v2(根部门, agent=${aid.slice(-3)}***)`)
    else {
      const t = httpJson(`https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(ak)}&appsecret=${encodeURIComponent(as)}`)
      const token = t.json?.access_token
      if (!token) record('im/dingtalk-app', false, `gettoken 失败 code=${t.code} errcode=${t.json?.errcode} ${t.json?.errmsg || ''}`)
      else {
        const body = JSON.stringify({ agent_id: aid, dept_id_list: [1], msg: { msgtype: 'markdown', markdown: { title, text } } })
        const r = httpJson(`https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${encodeURIComponent(token)}`, { method: 'POST', body })
        const ok = r.ok && r.json?.errcode === 0
        record('im/dingtalk-app', ok, ok ? '应用消息已推送(根部门)' : `发送失败 code=${r.code} errcode=${r.json?.errcode} ${r.json?.errmsg || ''}`)
      }
    }
  }

  // 企微:app 凭据换 token → message/send(@all)
  if (!wecomWebhook) {
    const cid = (process.env.WECOM_CORP_ID || '').trim()
    const sec = (process.env.WECOM_SECRET || '').trim()
    const aid = (process.env.WECOM_AGENT_ID || '').trim()
    if (!cid || !sec || !aid) record('im/wecom-app', false, '企微 app 凭据未配置,跳过')
    else if (dryRun) record('im/wecom-app', true, `dry-run: gettoken + message/send(@all, agent=${aid})`)
    else {
      const t = httpJson(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(cid)}&corpsecret=${encodeURIComponent(sec)}`)
      const token = t.json?.access_token
      if (!token) record('im/wecom-app', false, `gettoken 失败 code=${t.code} errcode=${t.json?.errcode} ${t.json?.errmsg || ''}`)
      else {
        const body = JSON.stringify({ touser: '@all', msgtype: 'markdown', agentid: Number(aid), markdown: { content: text } })
        const r = httpJson(`https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`, { method: 'POST', body })
        const ok = r.ok && r.json?.errcode === 0
        record('im/wecom-app', ok, ok ? '应用消息已推送(@all)' : `发送失败 code=${r.code} errcode=${r.json?.errcode} ${r.json?.errmsg || ''}`)
      }
    }
  }

  // 飞书:app 凭据换 token → im/v1/messages(需 chat_id,无则跳过)
  if (!process.env.FEISHU_WEBHOOK_URL) {
    const fid = (process.env.FEISHU_APP_ID || '').trim()
    const fsec = (process.env.FEISHU_APP_SECRET || '').trim()
    const chat = (process.env.FEISHU_CHAT_ID || '').trim()
    if (!fid || !fsec || !chat) record('im/feishu-app', false, '飞书 app 需 FEISHU_CHAT_ID(群ID)才能发,跳过')
    else if (dryRun) record('im/feishu-app', true, 'dry-run: tenant_access_token + im/v1/messages')
    else {
      const t = httpJson('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        { method: 'POST', body: JSON.stringify({ app_id: fid, app_secret: fsec }) })
      const token = t.json?.tenant_access_token
      if (!token) record('im/feishu-app', false, `token 失败 code=${t.code} apiCode=${t.json?.code} ${t.json?.msg || ''}`)
      else {
        const card = JSON.stringify({ header: { title: { tag: 'plain_text', content: title } }, elements: [{ tag: 'markdown', content: text }] })
        const body = JSON.stringify({ receive_id: chat, msg_type: 'interactive', content: card })
        const r = httpJson('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
          { method: 'POST', body, headers: [`Authorization: Bearer ${token}`] })
        const ok = r.ok && r.json?.code === 0
        record('im/feishu-app', ok, ok ? '应用消息已推送(群)' : `发送失败 code=${r.code} apiCode=${r.json?.code} ${r.json?.msg || ''}`)
      }
    }
  }

  const anyCfg = webhookTargets.length || process.env.DINGTALK_APP_KEY || process.env.WECOM_CORP_ID || process.env.FEISHU_APP_ID
  if (!anyCfg) record('im', false, 'IM 未配置(webhook 与 app 凭据都缺),跳过')
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
