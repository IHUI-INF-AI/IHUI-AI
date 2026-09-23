// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * CI 部署失败品牌邮件通知 — GitHub Actions job 失败时调用。
 *
 * 背景(2026-09-21 立):GitHub 平台默认的 job 失败通知是纯文本("一大堆字"),
 * 代码无法替换那一封;本脚本在 workflow 失败分支补发一封「智汇通报」品牌告警邮件,
 * 与 api 运行时告警同一设计语言(直接 import email-templates,零版式漂移)。
 * 配好后在 GitHub 个人通知设置里关闭 Actions 失败邮件即可只收品牌版。
 *
 * 用法(monorepo 根,tsx 来自 @ihui/api devDependencies):
 *   pnpm --filter @ihui/api exec tsx scripts/notify-deploy-failure.ts \
 *     --environment production --stage "job=deploy / step=健康检查" \
 *     --trigger octocat --run-url https://github.com/.../actions/runs/1
 *
 * 环境变量(与 alert-notification-service loadConfig 同约定):
 *   SMTP_HOST / SMTP_PORT(默认 465)/ SMTP_USER / SMTP_PASS / ALERT_EMAIL_TO(逗号分隔)
 *
 * 退出码恒为 0:通知失败不应改变 job 语义;错误打印到 stderr 由 CI 日志暴露。
 */

import nodemailer from 'nodemailer'
import { renderSystemAlertEmail } from '../src/services/email-templates.js'

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? '') : ''
}

async function main(): Promise<void> {
  const host = process.env.SMTP_HOST ?? ''
  const port = Number.parseInt(process.env.SMTP_PORT ?? '465', 10) || 465
  const user = process.env.SMTP_USER ?? ''
  const pass = process.env.SMTP_PASS ?? ''
  const to = (process.env.ALERT_EMAIL_TO ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!host || !user || to.length === 0) {
    console.error('[deploy-notify] SMTP_HOST/SMTP_USER/ALERT_EMAIL_TO 未配置,跳过通知')
    return
  }

  const environment = arg('environment') || 'production'
  const stage = arg('stage')
  const trigger = arg('trigger')
  const runUrl = arg('run-url')
  const message = [
    stage ? `失败阶段:${stage}` : '',
    trigger ? `触发人:${trigger}` : '',
    runUrl ? `构建日志:${runUrl}` : '',
    '影响:该次部署未生效,线上仍由原环境承载流量,请尽快排查修复后重新部署。',
  ]
    .filter(Boolean)
    .join('\n')

  const rendered = renderSystemAlertEmail({
    severity: 'critical',
    source: `github-actions/${arg('source') || 'blue-green-deploy'}`,
    time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }),
    title: `部署失败 — ${environment}`,
    message,
  })

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: pass ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  })
  try {
    await transporter.sendMail({
      from: user,
      to: to.join(','),
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    })
    console.log('[deploy-notify] 品牌告警邮件已发送')
  } finally {
    transporter.close()
  }
}

main().catch((e: unknown) => {
  console.error('[deploy-notify] 通知发送失败:', e instanceof Error ? e.message : String(e))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
