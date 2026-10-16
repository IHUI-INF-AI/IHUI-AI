// 端到端验证:渲染一封真实邮件 → finalizeEmailHtml 挂内嵌图 → 真发出去。
// 交付后用 IMAP 复核邮件体里是否真有 cid 附件(见 imap_verify_inline.py)。
import { renderVerificationEmail } from 'file:///D:/IHUI-AI/apps/api/src/services/email-templates.ts'
import {
  finalizeEmailHtml,
  loadInlineImages,
  missingInlineImageAssets,
} from 'file:///D:/IHUI-AI/apps/api/src/services/email-assets.ts'
import nodemailer from 'nodemailer'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const env = {}
for (const line of readFileSync('D:/IHUI-AI/apps/api/.env', 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
  if (m) env[m[1]] = m[2]
}

const imgs = loadInlineImages()
console.log('[1] 加载到的内嵌图:', imgs.map((i) => `${i.cid} ${i.filename} ${i.content.length}B sha1=${createHash('sha1').update(i.content).digest('hex').slice(0, 8)}`))
console.log('[1b] 缺席资产:', missingInlineImageAssets())

const r = renderVerificationEmail(String(Math.floor(100000 + Math.random() * 900000)), 'login')
const prepared = finalizeEmailHtml(r.html)
console.log('[2] 挂上的附件:', prepared.attachments.map((a) => a.cid))
console.log('[2b] 降级为外链的 cid:', prepared.downgraded)
console.log('[3] HTML 里 cid 引用数:', (prepared.html.match(/cid:ihui-/g) ?? []).length)

const to = env.ALERT_EMAIL_TO || env.SMTP_USER
const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: Number(env.SMTP_PORT || 587),
  secure: Number(env.SMTP_PORT) === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  family: 4,
})
const info = await transporter.sendMail({
  from: `"智汇AI官方" <${env.SMTP_USER}>`,
  to,
  subject: r.subject,
  html: prepared.html,
  text: r.text,
  attachments: prepared.attachments,
})
console.log('[4] 已发送:', { to, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected })
