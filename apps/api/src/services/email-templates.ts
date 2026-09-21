// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 事务邮件模板系统 —「智汇通报 / THE MECHANICAL DISPATCH」设计语言。
 *
 * 设计铁律(2026-09-19 立):
 * - 正文/按钮/验证码永远是真实 HTML 文本(可复制、可点击、无障碍可读),图片只做装饰;
 * - 按钮 = 防弹按钮(table bgcolor + <a>),QQ 邮箱等剥字体客户端仍可点击;
 * - 正文字号 ≥17px,标题 ≥27px,验证码 ≥36px 等宽加字距;
 * - 禁蓝色系;品牌色 = 酸绿 #B4FF00,安全告警 = 信号红 #FF3B2F;
 * - 所有插值必须 escapeHtml,链接域名取 CORS_ORIGIN 首项(与 payment-gateway 同约定)。
 */

import { config } from '../config/index.js'

/** 品牌色板 — 机械风(禁蓝) */
export const DISPATCH_TOKENS = {
  pageBg: '#050506',
  cardBg: '#0A0A0C',
  ink: '#F5F5F0',
  body: '#C9C9C2',
  dim: '#8A8A85',
  accent: '#B4FF00',
  danger: '#FF3B2F',
  hairline: '#3A3A40',
} as const

/** 从 CORS_ORIGIN 取 web 站点根(与 payment-gateway 同一约定) */
export function resolveWebOrigin(): string {
  const first = (config.CORS_ORIGIN ?? '').split(',')[0]?.trim()
  return first && first.length > 0 ? first.replace(/\/+$/, '') : 'https://aizhs.top'
}

/** HTML 转义(所有动态插值必须过此函数) */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 模板渲染结果:主题 + HTML + 纯文本兜底 */
export interface DispatchEmail {
  subject: string
  html: string
  text: string
}

/** 通用版式输入 */
interface DispatchLayoutInput {
  /** 栏目眉,如 TRANSACTIONAL // VERIFY_CODE */
  tag: string
  /** 主标题 */
  title: string
  /** 正文内容 HTML(调用方负责组装,内部插值须先转义) */
  bodyHtml: string
  /** 主按钮(可点击) */
  button?: { href: string; label: string; kind?: 'accent' | 'danger' | 'ghost' }
  /** 页脚补充说明(纯文本,自动转义) */
  footNote?: string
  /** 配色:默认品牌绿;security 用 danger */
  tone?: 'accent' | 'danger'
}

/** 防弹按钮(table + <a>,QQ/Outlook 均可点) */
function bulletproofButton(
  href: string,
  label: string,
  kind: 'accent' | 'danger' | 'ghost',
): string {
  const t = DISPATCH_TOKENS
  const solid = kind !== 'ghost'
  const bg = kind === 'danger' ? t.danger : t.accent
  const tdStyle = solid
    ? `bgcolor="${bg}"`
    : `bgcolor="${t.cardBg}" style="border:2px solid ${bg};"`
  const aStyle = `display:inline-block;padding:16px 46px;font-family:'Microsoft YaHei','SimHei',sans-serif;font-size:19px;font-weight:bold;letter-spacing:5px;color:${solid ? '#0A0A0C' : bg};text-decoration:none;`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td ${tdStyle}><a href="${href}" target="_blank" style="${aStyle}">${label}</a></td></tr></table>`
}

/** 创始人微信二维码(web public 静态资产,footer-data.ts QRS 同源) */
export const FOUNDER_QR_PATH = '/footer/erweima/wechat-vx.png'
/** 创始人微信号(与 SiteFooter QRS copyValue 同源) */
export const FOUNDER_WECHAT_ID = 'ok502319984'
/** 品牌图片 Logo(黑底渐变,与邮件深黑卡片底色融合;PNG 保证 Outlook/Gmail 兼容) */
export const BRAND_LOGO_PATH = '/images/logo.png'

/** 通用版式:品牌刊头(纯 HTML) + 内容 + 按钮 + 创始人直联 + 页脚 */
export function renderDispatchEmail(input: DispatchLayoutInput): string {
  const t = DISPATCH_TOKENS
  const accent = input.tone === 'danger' ? t.danger : t.accent
  const origin = resolveWebOrigin()
  const button = input.button
    ? `<tr><td style="padding:24px 36px 6px;">${bulletproofButton(input.button.href, escapeHtml(input.button.label), input.button.kind ?? 'accent')}</td></tr>`
    : ''
  const foot = input.footNote
    ? `<div style="margin-top:10px;">${escapeHtml(input.footNote)}</div>`
    : ''
  const contactQr = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>
    <td valign="middle" style="font-family:'Microsoft YaHei',sans-serif;font-size:15px;line-height:1.9;color:${t.body};">
      <div style="font-family:Consolas,monospace;font-size:13px;color:${t.dim};letter-spacing:3px;">[&nbsp;DIRECT_LINE&nbsp;//&nbsp;创始人直联&nbsp;]</div>
      <div style="margin-top:8px;">遇到任何问题,微信扫码<b style="color:${t.ink};">直接联系创始人李春川</b><br>微信号:<span style="font-family:Consolas,monospace;font-size:17px;color:${accent};letter-spacing:1px;">${FOUNDER_WECHAT_ID}</span>(长按复制)· 邮件兜底:<a href="mailto:support@aizhs.top" style="color:${accent};text-decoration:none;">support@aizhs.top</a></div>
    </td>
    <td width="124" align="right" valign="middle"><img src="${origin}${FOUNDER_QR_PATH}" width="112" height="112" alt="创始人微信二维码" style="display:block;border:1px solid ${t.hairline};padding:5px;background:${t.pageBg};"></td>
  </tr></table>`
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${t.pageBg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.pageBg}"><tr><td align="center" style="padding:24px 8px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.cardBg}" style="width:600px;max-width:600px;background:${t.cardBg};">
  <tr><td style="padding:28px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:Consolas,'Courier New',monospace;font-size:14px;color:${t.dim};letter-spacing:2px;">43.82°N&nbsp;125.32°E&nbsp;&nbsp;//&nbsp;&nbsp;IHUI-CORE<span style="color:${accent};">&nbsp;&nbsp;//&nbsp;&nbsp;${escapeHtml(input.tag)}</span></td><td width="64" align="right" valign="top"><img src="${origin}${BRAND_LOGO_PATH}" width="56" height="56" alt="IHUI AI" style="display:block;border:1px solid ${t.hairline};"></td></tr></table></td></tr>
  <tr><td style="padding:14px 36px 0;font-family:Impact,'Arial Black','Microsoft YaHei',sans-serif;font-size:64px;line-height:70px;font-weight:bold;color:${t.ink};letter-spacing:3px;">IHUI<span style="color:${accent};">.</span></td></tr>
  <tr><td style="padding:10px 36px 0;font-family:Consolas,monospace;font-size:14px;color:${t.dim};letter-spacing:5px;">智汇AI&nbsp;·&nbsp;THE&nbsp;MECHANICAL&nbsp;DISPATCH</td></tr>
  <tr><td style="padding:16px 36px 0;"><div style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr><td style="padding:26px 36px 0;font-family:Consolas,monospace;font-size:14px;color:${accent};letter-spacing:3px;">[&nbsp;${escapeHtml(input.tag)}&nbsp;]</td></tr>
  <tr><td style="padding:10px 36px 0;font-family:'Microsoft YaHei','SimHei',sans-serif;font-size:27px;font-weight:900;color:${t.ink};letter-spacing:2px;">${escapeHtml(input.title)}</td></tr>
  <tr><td style="padding:20px 36px 4px;">${input.bodyHtml}</td></tr>
  ${button}
  <tr><td style="padding:26px 36px 30px;border-top:1px dashed ${t.hairline};">
    ${contactQr}
    <div style="font-family:Consolas,monospace;font-size:13px;line-height:22px;color:${t.dim};letter-spacing:1px;">${foot}</div>
    <div style="font-family:Consolas,monospace;font-size:13px;color:${t.dim};margin-top:8px;">智汇AI集团 创始人 <span style="color:${t.ink};font-weight:bold;">李春川</span> · aizhs.top · © 2026 IHUI AI · 系统自动派发</div>
  </td></tr>
</table></td></tr></table></body></html>`
}

// ================= 版式原子 =================

const FONT_VALUE = `font-family:'Microsoft YaHei',sans-serif;font-size:19px;font-weight:bold;color:#F5F5F0;margin-top:7px;`

/** 单个数据格(label 上 / value 下) */
function cell(
  label: string,
  value: string,
  accent: string,
  opts: { right?: boolean; top?: boolean; valueStyle?: string },
): string {
  const border = `${opts.right ? `border-right:1px dashed ${accent};` : ''}${opts.top ? `border-top:1px dashed ${accent};` : ''}`
  const valueStyle = opts.valueStyle ?? FONT_VALUE
  return `<td style="padding:16px 22px;${border}"><div style="font-family:Consolas,monospace;font-size:12px;color:#8A8A85;letter-spacing:3px;">${label}</div><div style="${valueStyle}">${value}</div></td>`
}

/** 数据格行(1-3 列) */
function metaRow(cells: string[]): string {
  return `<tr>${cells.join('')}</tr>`
}

/** 数据格容器(虚线工程框) */
function metaGrid(rows: string[], accent: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed ${accent};">${rows.join('')}</table>`
}

/** 正文段落 */
function para(text: string): string {
  return `<div style="padding:0 0 20px;font-family:'Microsoft YaHei',sans-serif;font-size:18px;line-height:1.8;color:#C9C9C2;">${text}</div>`
}

/** 小注释块 */
function note(text: string): string {
  return `<div style="font-family:'Microsoft YaHei',sans-serif;font-size:15px;line-height:1.9;color:#C9C9C2;">${text}</div>`
}

// ================= 类型化模板 =================

/** 验证码场景 */
export type VerificationScene = 'register' | 'login' | 'reset'

const SCENE_TEXT: Record<VerificationScene, string> = {
  register: '注册账号',
  login: '登录账号',
  reset: '重置密码',
}

/** 渲染验证码邮件(真实文本验证码,可选中复制) */
export function renderVerificationEmail(
  code: string,
  scene: VerificationScene,
  nickname?: string,
  expiresInMinutes = 5,
): DispatchEmail {
  const t = DISPATCH_TOKENS
  const sceneText = SCENE_TEXT[scene]
  // 昵称含用户输入 — 此处保留原文,由 renderDispatchEmail 统一转义(避免双重转义)
  const greeting = nickname ? `${nickname},` : ''
  const body = `
    ${para(`您正在${sceneText}。输入以下验证码完成操作:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed ${t.accent};margin:0 0 24px;"><tr><td align="center" style="padding:30px 10px;">
      <div style="font-family:Consolas,'Courier New',monospace;font-size:44px;font-weight:bold;letter-spacing:16px;text-indent:16px;color:${t.ink};">${escapeHtml(code)}</div>
      <div style="font-family:Consolas,monospace;font-size:14px;color:${t.dim};letter-spacing:2px;margin-top:12px;">请复制此验证码 · ${expiresInMinutes} 分钟内有效</div>
    </td></tr></table>
    ${note(`· 这不是您的操作?<b style="color:${t.ink};">直接忽略本邮件</b>,账号不会有任何变动。<br>· 验证码<b style="color:${t.danger};">绝不会被任何客服索要</b>,请勿告知他人。<br>· 需要帮助:<a href="mailto:support@aizhs.top" style="color:${t.accent};text-decoration:none;">support@aizhs.top</a>`)}`
  return {
    subject: `【智汇AI】${sceneText}验证码 ${code}`,
    html: renderDispatchEmail({
      tag: 'TRANSACTIONAL // VERIFY_CODE',
      title: `${greeting}您的身份验证码`,
      bodyHtml: body,
    }),
    text: `${nickname ? `${nickname},` : ''}您的${sceneText}验证码是 ${code},${expiresInMinutes} 分钟内有效。如非本人操作请忽略。`,
  }
}

/** 欢迎邮件输入 */
export interface WelcomeEmailInput {
  nickname: string
  /** 脱敏后的账号标识,如 li****chuan */
  maskedId: string
  /** 初始积分 */
  initCredits: number
}

/** 渲染注册欢迎邮件(含真实可点击控制台按钮) */
export function renderWelcomeEmail(input: WelcomeEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const impactFont = `font-family:Impact,'Arial Black',sans-serif;font-size:26px;font-weight:bold;color:${t.ink};margin-top:4px;`
  const body = `
    ${para(`欢迎入列,<b style="color:${t.ink};">${escapeHtml(input.nickname)}</b>。您的账号已创建,所有系统已就绪:`)}
    ${metaGrid(
      [
        metaRow([
          cell('OPERATOR_ID', escapeHtml(input.maskedId), t.accent, { right: true }),
          cell('CLEARANCE', `<span style="color:${t.accent};">OPERATOR·L1</span>`, t.accent, {
            right: true,
          }),
          cell('INIT_CREDITS', `+${escapeHtml(String(input.initCredits))}`, t.accent, {
            valueStyle: impactFont,
          }),
        ]),
        metaRow([
          cell('免费额度', '5 条模型对话 / 日', t.accent, { right: true, top: true }),
          cell('开放范围', '全模型雷达 + 提示词库', t.accent, { right: true, top: true }),
          cell('API 密钥', '控制台一键签发', t.accent, { top: true }),
        ]),
      ],
      t.accent,
    )}`
  const origin = resolveWebOrigin()
  return {
    subject: '【智汇AI】欢迎入列,操作员 —— 账号已创建',
    html: renderDispatchEmail({
      tag: 'TRANSACTIONAL // ACCOUNT_CREATED',
      title: '欢迎入列,操作员。',
      bodyHtml: body,
      button: { href: `${origin}/dashboard`, label: '进入控制台 →' },
    }),
    text: `欢迎入列,${input.nickname}。账号已创建,初始积分 +${input.initCredits}。进入控制台:${origin}/dashboard`,
  }
}

/** 登录安全告警输入(字段均为已脱敏值,调用方负责脱敏) */
export interface SecurityLoginInput {
  device: string
  ip: string
  location: string
  time: string
  riskLevel: string
}

/** 渲染新设备登录安全告警(信号红 + 真实锁定按钮) */
export function renderSecurityLoginEmail(input: SecurityLoginInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const mono = `font-family:Consolas,monospace;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;`
  const body = `
    ${para(`您的账号刚刚在一台<b style="color:${t.ink};">新设备</b>上登录。若非本人操作,请立即锁定:`)}
    ${metaGrid(
      [
        metaRow([
          cell('DEVICE', escapeHtml(input.device), t.danger, { right: true }),
          cell('IP(脱敏)', escapeHtml(input.ip), t.danger, { right: true, valueStyle: mono }),
          cell('LOCATION', escapeHtml(input.location), t.danger, {}),
        ]),
        metaRow([
          cell('TIME', escapeHtml(input.time), t.danger, {
            right: true,
            top: true,
            valueStyle: mono,
          }),
          cell(
            'RISK_LEVEL',
            `<span style="color:${t.danger};">[ ${escapeHtml(input.riskLevel)} ]</span>`,
            t.danger,
            { right: true, top: true },
          ),
          cell('ACTION', '确认或锁定', t.danger, { top: true }),
        ]),
      ],
      t.danger,
    )}`
  const origin = resolveWebOrigin()
  return {
    subject: '【智汇AI安全提醒】检测到新设备登录',
    html: renderDispatchEmail({
      tag: 'SECURITY // NEW_LOGIN_DETECTED',
      title: '检测到新设备登录',
      bodyHtml: body,
      button: {
        href: `${origin}/settings/login-security`,
        label: '不是本人?立即锁定账号 →',
        kind: 'danger',
      },
      tone: 'danger',
      footNote: '锁定后所有会话强制下线,需重新验证身份。确是本人可忽略本邮件。',
    }),
    text: `您的账号于 ${input.time} 在新设备(${input.device},${input.location},IP ${input.ip})登录。若非本人,请立即前往 ${origin}/settings/login-security 锁定账号。`,
  }
}

/** 维护通知输入 */
export interface MaintenanceNoticeInput {
  window: string
  scope: string
  downtime: string
}

/** 渲染系统维护通知 */
export function renderMaintenanceNoticeEmail(input: MaintenanceNoticeInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const impact = `font-family:Impact,'Arial Black',sans-serif;font-size:24px;font-weight:bold;color:${t.ink};margin-top:4px;`
  const body = `
    ${para(`维护窗口内 <b style="color:${t.ink};">API 与控制台将出现短暂不可用</b>,对话与密钥调用请提前安排。`)}
    ${metaGrid(
      [
        metaRow([
          cell(
            'WINDOW',
            `<span style="color:${t.accent};font-family:Consolas,monospace;">${escapeHtml(input.window)}</span>`,
            t.accent,
            { right: true },
          ),
          cell('SCOPE', escapeHtml(input.scope), t.accent, { right: true }),
          cell('DOWNTIME', escapeHtml(input.downtime), t.accent, { valueStyle: impact }),
        ]),
      ],
      t.accent,
    )}
    ${note('完成后将自动派发恢复确认,无需回复本邮件。')}`
  const origin = resolveWebOrigin()
  return {
    subject: `【智汇AI】例行维护通知(${input.window})`,
    html: renderDispatchEmail({
      tag: 'NOTICE // SYSTEM_MAINTENANCE',
      title: '例行维护通知',
      bodyHtml: body,
      button: { href: `${origin}/status`, label: '查看实时状态页 →', kind: 'ghost' },
    }),
    text: `例行维护:${input.window},${input.scope} 短暂不可用,预计停机 ${input.downtime}。状态页:${origin}/status`,
  }
}

/** 更新日志条目 */
export interface ChangelogItem {
  tag: 'NEW' | 'OPT' | 'FIX' | 'SEC'
  title: string
  desc: string
}

const TAG_COLOR: Record<ChangelogItem['tag'], string> = {
  NEW: '#B4FF00',
  OPT: '#B4FF00',
  FIX: '#B4FF00',
  SEC: '#FF3B2F',
}

/** 渲染版本更新日志邮件 */
export function renderChangelogEmail(input: {
  version: string
  date: string
  items: readonly ChangelogItem[]
}): DispatchEmail {
  const t = DISPATCH_TOKENS
  const rows = input.items
    .map((item, i) => {
      const last = i === input.items.length - 1
      return `<tr><td style="padding:18px 0;${last ? '' : `border-bottom:1px dashed ${t.hairline};`}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="92" valign="top" style="font-family:Consolas,monospace;font-size:16px;font-weight:bold;color:${TAG_COLOR[item.tag]};letter-spacing:1px;">[${item.tag}]</td>
          <td><div style="font-family:'Microsoft YaHei',sans-serif;font-size:20px;font-weight:900;color:${t.ink};">${escapeHtml(item.title)}</div>
              <div style="font-family:'Microsoft YaHei',sans-serif;font-size:15px;color:${t.dim};margin-top:6px;">${escapeHtml(item.desc)}</div></td>
        </tr></table></td></tr>`
    })
    .join('')
  const origin = resolveWebOrigin()
  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
    <div style="padding:24px 0 6px;font-family:'Microsoft YaHei',sans-serif;font-size:16px;color:${t.body};">升级自动完成,无需任何操作。</div>`
  return {
    subject: `【智汇AI】v${input.version} 更新日志`,
    html: renderDispatchEmail({
      tag: 'UPDATE // CHANGELOG',
      title: `v${input.version} 更新日志`,
      bodyHtml: body,
      button: { href: `${origin}/announcements`, label: '完整变更公告 →', kind: 'ghost' },
      footNote: `发布日期:${input.date}`,
    }),
    text: `v${input.version} 更新日志(${input.date}):${input.items.map((i) => `[${i.tag}] ${i.title}`).join(';')}。完整公告:${origin}/announcements`,
  }
}

/** 新品上线输入(href 必须由调用方提供真实存在的页面路径,杜绝 404) */
export interface LaunchEmailInput {
  productName: string
  version: string
  features: readonly { title: string; desc: string }[]
  /** 「立即体验」按钮目标路径(如 /workflows),必须指向真实存在的页面 */
  ctaPath: string
}

/** 渲染新品上线邮件(01/02/03 特性条 + 真实可点击体验按钮) */
export function renderLaunchEmail(input: LaunchEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const rows = input.features
    .map((f, i) => {
      const last = i === input.features.length - 1
      return `<tr><td style="padding:18px 0;${last ? '' : `border-bottom:1px dashed ${t.hairline};`}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td width="64" valign="top" style="font-family:Impact,'Arial Black',sans-serif;font-size:30px;font-weight:bold;color:${t.accent};">0${i + 1}</td>
          <td><div style="font-family:'Microsoft YaHei',sans-serif;font-size:20px;font-weight:900;color:${t.ink};">${escapeHtml(f.title)}</div>
              <div style="font-family:'Microsoft YaHei',sans-serif;font-size:15px;color:${t.dim};margin-top:6px;">${escapeHtml(f.desc)}</div></td>
        </tr></table></td></tr>`
    })
    .join('')
  const origin = resolveWebOrigin()
  const cta = input.ctaPath.startsWith('/') ? input.ctaPath : `/${input.ctaPath}`
  const body = `
    ${para(`<b style="color:${t.accent};">${escapeHtml(input.productName)}</b>&nbsp;v${escapeHtml(input.version)}&nbsp;正式上线。这次带来:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`
  return {
    subject: `【智汇AI上新】${input.productName} v${input.version} 正式发布`,
    html: renderDispatchEmail({
      tag: 'LAUNCH // NEW_PRODUCT',
      title: `${input.productName} 正式上线`,
      bodyHtml: body,
      button: { href: `${origin}${cta}`, label: '立即体验 →' },
      footNote: `上线版本:v${input.version}`,
    }),
    text: `${input.productName} v${input.version} 正式上线。特性:${input.features.map((f) => f.title).join(' / ')}。立即体验:${origin}${cta}`,
  }
}

/** 运维系统告警输入(message 为多行纯文本,按行渲染,整体转义) */
export interface SystemAlertEmailInput {
  severity: 'info' | 'warning' | 'critical'
  source: string
  time: string
  title: string
  message: string
}

const SEVERITY_LABEL: Record<SystemAlertEmailInput['severity'], string> = {
  info: 'INFO',
  warning: 'WARNING',
  critical: 'CRITICAL',
}

/** 多行纯文本 → 逐行 div(先整体转义,空行以 &nbsp; 保位) */
function multiLineHtml(text: string): string {
  return escapeHtml(text)
    .split(/\r?\n/)
    .map((line) => `<div>${line || '&nbsp;'}</div>`)
    .join('')
}

/** 渲染运维系统告警邮件(critical/warning 信号红,info 品牌绿) */
export function renderSystemAlertEmail(input: SystemAlertEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const tone = input.severity === 'info' ? 'accent' : 'danger'
  const accent = tone === 'danger' ? t.danger : t.accent
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:17px;font-weight:bold;color:${t.ink};margin-top:7px;`
  // message 整体转义后按行拆分渲染,空行以 &nbsp; 保位
  const messageHtml = multiLineHtml(input.message)
  const body = `
    ${para(input.severity === 'info' ? '系统监测到以下事件,供知悉:' : '系统监测到异常,请值班操作员立即关注:')}
    ${metaGrid(
      [
        metaRow([
          cell(
            'SEVERITY',
            `<span style="color:${accent};">[ ${SEVERITY_LABEL[input.severity]} ]</span>`,
            accent,
            { right: true },
          ),
          cell('SOURCE', escapeHtml(input.source), accent, { right: true, valueStyle: mono }),
          cell('TIME', escapeHtml(input.time), accent, { valueStyle: mono }),
        ]),
        metaRow([
          `<td colspan="3" style="border-top:1px dashed ${accent};padding:16px 22px;"><div style="font-family:Consolas,monospace;font-size:12px;color:#8A8A85;letter-spacing:3px;margin-bottom:8px;">MESSAGE</div><div style="font-family:Consolas,'Courier New',monospace;font-size:16px;line-height:1.9;color:#F5F5F0;">${messageHtml}</div></td>`,
        ]),
      ],
      accent,
    )}
    ${note('本邮件由系统自动派发,无需回复。请前往服务器日志定位根因后再恢复。')}`
  return {
    subject: `[${SEVERITY_LABEL[input.severity]}] ${input.title}`,
    html: renderDispatchEmail({
      tag: `SYSTEM // ALERT_${SEVERITY_LABEL[input.severity]}`,
      title: input.title,
      bodyHtml: body,
      tone,
    }),
    text: `[${SEVERITY_LABEL[input.severity]}] ${input.title}\n${input.message}\n来源:${input.source} · 时间:${input.time}`,
  }
}

/** 余额不足邮件输入 */
export interface LowBalanceEmailInput {
  userName?: string
  keyName: string
  tokenBalance: number
  costBalanceCents: number
  thresholdCents: number
  /** 充值落地页完整 URL(调用方负责提供真实存在路径,杜绝 404) */
  purchaseUrl: string
}

/** 渲染 API Key 余额不足提醒(品牌绿 + 真实可点击充值按钮) */
export function renderLowBalanceEmail(input: LowBalanceEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const yuan = (input.costBalanceCents / 100).toFixed(2)
  const thresholdYuan = (input.thresholdCents / 100).toFixed(2)
  const impact = `font-family:Impact,'Arial Black',sans-serif;font-size:26px;font-weight:bold;color:${t.danger};margin-top:4px;`
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;`
  const body = `
    ${para(`您的 API Key <b style="color:${t.ink};">「${escapeHtml(input.keyName)}」</b> 余额已不足,为避免调用中断请尽快充值:`)}
    ${metaGrid(
      [
        metaRow([
          cell('TOKEN_BALANCE', escapeHtml(String(input.tokenBalance)), t.accent, {
            right: true,
            valueStyle: mono,
          }),
          cell('BALANCE', `¥${yuan}`, t.accent, { right: true, valueStyle: impact }),
          cell('THRESHOLD', `¥${thresholdYuan}`, t.accent, { valueStyle: mono }),
        ]),
      ],
      t.accent,
    )}`
  return {
    subject: '【智汇AI】您的 API Key 余额不足,请及时充值',
    html: renderDispatchEmail({
      tag: 'BILLING // LOW_BALANCE',
      title: 'API Key 余额不足',
      bodyHtml: body,
      button: { href: input.purchaseUrl, label: '立即充值 →' },
      footNote: `余额耗尽后该 Key 将无法继续调用,充值即时到账。${
        input.userName ? `(操作员:${input.userName})` : ''
      }`,
    }),
    text: `您的 API Key「${input.keyName}」余额不足(Token 余额 ${input.tokenBalance},¥${yuan},阈值 ¥${thresholdYuan})。立即充值:${input.purchaseUrl}`,
  }
}

/** 通用系统通知输入(content 为多行纯文本,整体转义) */
export interface NoticeEmailInput {
  /** 栏目眉,如 SYSTEM // NOTICE */
  tag: string
  title: string
  userName?: string
  content: string
}

/** 渲染通用系统通知邮件(品牌绿朴素版式;内容为纯文本自动转义,不含按钮) */
export function renderNoticeEmail(input: NoticeEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const greeting = input.userName ? `${escapeHtml(input.userName)},` : ''
  const body = `
    ${para(`${greeting}您有一条新的系统通知:`)}
    <div style="font-family:'Microsoft YaHei',sans-serif;font-size:17px;line-height:1.9;color:${t.ink};border:1px dashed ${t.accent};padding:18px 22px;margin:0 0 24px;">${multiLineHtml(input.content)}</div>`
  return {
    subject: input.title,
    html: renderDispatchEmail({
      tag: input.tag,
      title: input.title,
      bodyHtml: body,
    }),
    text: input.content,
  }
}

/** 支付成功收据输入(amountYuan 由调用方按 numeric(10,2) 元格式传入) */
export interface PaymentReceiptEmailInput {
  userName?: string
  orderNo: string
  productTitle: string
  quantity: number
  amountYuan: string
  payType: string
  paidAt: string
  /** 订单/订阅落地页完整 URL(调用方保证真实存在,杜绝 404) */
  subscriptionUrl: string
}

/** 渲染支付成功收据(品牌绿喜庆版式 + Impact 金额大字) */
export function renderPaymentReceiptEmail(input: PaymentReceiptEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const impact = `font-family:Impact,'Arial Black',sans-serif;font-size:26px;font-weight:bold;color:${t.accent};margin-top:4px;`
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;`
  const productValue = `${escapeHtml(input.productTitle)}${input.quantity > 1 ? ` <span style="color:#8A8A85;">×${input.quantity}</span>` : ''}`
  const body = `
    ${para('您的订单已支付成功,权益将即时到账。以下为您的电子收据,请留存:')}
    ${metaGrid(
      [
        metaRow([
          cell('ORDER_NO', escapeHtml(input.orderNo), t.accent, { right: true, valueStyle: mono }),
          cell('PAID_AT', escapeHtml(input.paidAt), t.accent, { valueStyle: mono }),
        ]),
        metaRow([
          `<td colspan="2" style="border-top:1px dashed ${t.accent};padding:16px 22px;"><div style="font-family:Consolas,monospace;font-size:12px;color:#8A8A85;letter-spacing:3px;">PRODUCT</div><div style="font-family:'Microsoft YaHei',sans-serif;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;">${productValue}</div></td>`,
          cell('AMOUNT', `¥${escapeHtml(input.amountYuan)}`, t.accent, { valueStyle: impact }),
        ]),
        metaRow([
          cell('PAY_TYPE', escapeHtml(input.payType || '—'), t.accent, { right: true }),
          cell(
            'STATUS',
            `<span style="color:${t.accent};">[ 已支付 / PAID ]</span>`,
            t.accent,
            {},
          ),
        ]),
      ],
      t.accent,
    )}`
  return {
    subject: `【智汇AI】支付成功收据 · 订单 ${input.orderNo}`,
    html: renderDispatchEmail({
      tag: 'BILLING // RECEIPT',
      title: '支付成功',
      bodyHtml: body,
      button: { href: input.subscriptionUrl, label: '查看我的订阅 →' },
      footNote: '本收据由系统自动派发,可作为支付凭证留存;如遇资产未到账,请通过下方创始人直联联系我们处理。',
    }),
    text: `您的订单已支付成功。订单号 ${input.orderNo};商品 ${input.productTitle}${input.quantity > 1 ? ` ×${input.quantity}` : ''};金额 ¥${input.amountYuan};支付方式 ${input.payType};时间 ${input.paidAt}。查看:${input.subscriptionUrl}`,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
