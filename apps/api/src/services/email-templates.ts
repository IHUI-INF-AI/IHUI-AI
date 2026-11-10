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
 *
 * 「一键复制」为什么不在邮件里写 JS(2026-11-07 立):
 * QQ 邮箱 / Gmail / Outlook / 163 一律剥离 <script>、内联 onclick 与 clipboard API,
 * 邮件正文里的「复制按钮」物理上不可能写剪贴板。唯一可达路径 = 按钮是真实 <a> 链接,
 * 把验证码带到站点落地页(apps/web/public/verify-code.htm),由落地页完成复制。
 * 邮件内同时保留 `user-select:all` 单击全选 + 纯文本兜底,链路断在哪一层都不至于复制不了。
 * 落地页只读 query、不发请求、不校验/消费验证码,有效期仍由后端 code-store 裁决。
 *
 * 本模块保持零副作用(不 import config):CI 脚本(如部署失败通知)可在
 * 无完整环境变量的进程中直接 import 复用品牌版式,CORS_ORIGIN 直读 env。
 */

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

/* ================================================================== *
 * 品牌发件人与收件人语言(2026-11-10 立,单一真相源)
 *
 * 为什么必须收在这里:同一个「发件人显示名」在收件箱里曾同时出现
 * 「智汇AI」「智汇AI官方」「502319984」三种形态 —— 根子不是某处写错,
 * 而是它同时有四个独立默认值(SMTP_FROM / RESEND_FROM / config 默认 /
 * CI 的 secrets),外加"裸地址无显示名"这一形态。四个默认值必然漂移。
 *
 * 收敛口径:
 *   · 显示名只有 BRAND_MAIL_DISPLAY_NAME 一个值,任何通道都从这里取;
 *   · 地址段仍由配置给(QQ SMTP 要求 From 地址 == 登录账号,不能硬编码);
 *   · 本模块零副作用,CI 脚本可直接 import,不必连带 db/redis。
 * ================================================================== */

/** 品牌发件人显示名。全站唯一取值点,禁止在别处另写一份字面量。 */
export const BRAND_MAIL_DISPLAY_NAME = '智汇AI'

/**
 * 创始人微信号(与 SiteFooter QRS copyValue 同源)。
 * 定义在版式外壳文案之前 —— 那些常量在模块初始化时就要读它。
 */
export const FOUNDER_WECHAT_ID = 'ok502319984'

/** 邮件语言:zh = 中文(国内收件人,默认);en = 英文(海外收件人) */
export type MailLocale = 'zh' | 'en'

/**
 * 国内主流邮箱域名。用于「给国内发中文、给海外发英文」的判定。
 *
 * 这张表原先住在 email-service.ts,而部署告警脚本刻意不 import 那个文件
 * (它会连带 db/redis,而告警发生时数据库可能本身就是坏的)。判据必须能被
 * 无副作用地复用,故上移到本模块,email-service 侧改为 re-export(仍单源)。
 */
export const DOMESTIC_EMAIL_DOMAINS: ReadonlySet<string> = new Set<string>([
  'qq.com',
  'foxmail.com',
  '163.com',
  '126.com',
  'yeah.net',
  'sina.com',
  'sina.cn',
  'sohu.com',
  '139.com',
  'aliyun.com',
  'mail.aliyun.com',
  '189.cn',
  'wo.cn',
  'vip.qq.com',
  'vip.163.com',
  '263.net',
])

/** 判断邮箱是否为国内主流邮箱(域名不在表内 = 海外,走英文)。 */
export function isDomesticEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim()
  if (!domain) return false
  return DOMESTIC_EMAIL_DOMAINS.has(domain)
}

/** 收件人 → 邮件语言:国内主流邮箱中文,其余英文。 */
export function localeForRecipient(email: string): MailLocale {
  return isDomesticEmail(email) ? 'zh' : 'en'
}

/** 从任意 From 形态里抽地址段:`X <a@b>` / `"X" <a@b>` / `a@b` 三种都吃。 */
export function extractMailAddress(raw: string): string {
  const s = (raw ?? '').trim()
  if (s === '') return ''
  const angle = /<([^>]+)>/.exec(s)
  return (angle ? (angle[1] ?? '') : s).trim()
}

/**
 * SMTP 的 From:显示名恒为品牌名,地址保留传入值。
 * 显示名带双引号 —— nodemailer 会按 RFC 2047 编码中文,SMTP 头更稳。
 */
export function brandSmtpFrom(address: string): string {
  const addr = extractMailAddress(address)
  return addr === '' ? '' : `"${BRAND_MAIL_DISPLAY_NAME}" <${addr}>`
}

/** Resend 的 from:同一品牌名,不带引号(与 Resend 文档示例同形)。 */
export function brandResendFrom(address: string): string {
  const addr = extractMailAddress(address)
  return addr === '' ? '' : `${BRAND_MAIL_DISPLAY_NAME} <${addr}>`
}

/**
 * SMTP 出口的 From 地址段解析:必须等于登录账号,否则回落登录账号。
 * 这条约束写在传输层而不是各出口里,原因是它有两个独立来源、漏任一处都会静默失效:
 *
 * 1. **中继拒绝**:经 smtp.qq.com 这类"账号即发件人"的中继发信时,From 的邮箱段与
 *    SMTP_USER 不一致会被 550 拒。2026-11-10 实测:生产 `.env` 的 `SMTP_FROM` 地址段
 *    恰好等于 `SMTP_USER`,于是这条约束一直是"配置侥幸"——换一台机、换一份 `.env`
 *    (例如 `.env.example` 与 docker-compose 的 `noreply@aizhs.top` 缺省值)就立刻踩中。
 * 2. **显示名漂移**:`SMTP_FROM` 常被写成 `显示名 <地址>` 整串。若出口直接把它当 From,
 *    显示名就由配置决定 ⇒ 同一个品牌在不同通道长出不同名字(收件箱曾同时出现
 *    「智汇AI」「智汇AI官方」「502319984」)。地址段与显示名必须分开处理。
 *
 * 返回值恒为已品牌化的完整 From(`"智汇AI" <地址>`);配置读不出地址时回落 `user`,
 * 两者都空时返回空串(调用方据此判定"未配置",不要拿空 From 去投递)。
 */
export function resolveBrandSmtpFrom(configured: string | undefined, user: string | undefined): string {
  const account = extractMailAddress(user ?? '')
  const configuredAddr = extractMailAddress(configured ?? '')
  const addr =
    configuredAddr !== '' && account !== '' && configuredAddr.toLowerCase() === account.toLowerCase()
      ? configuredAddr
      : account !== ''
        ? account
        : configuredAddr
  return brandSmtpFrom(addr)
}

/** 一组同语言收件人。 */
export interface MailRecipientGroup {
  locale: MailLocale
  to: string[]
}

/**
 * 按收件人域名分组:国内主流邮箱 → zh,其余 → en。
 *
 * 为什么必须分组而不是"选一个主语言":一封邮件只有一种语言,混合收件人时无论选哪边,
 * 另一边都会收到看不懂的邮件 —— 而"给国外用户发英文"正是本次需求的一半。
 * 顺序固定 zh 在前:它是主语言,调度侧的去重台账与 dry-run 展示都取第一组。
 *
 * 判据本体只有一份(2026-11-10):告警派发器与运行期告警通知服务都要分流,
 * 各写一份必然在某次改域名表时漂开,故收敛到模板层(零副作用,可被脚本直接引用)。
 */
export function groupRecipientsByLocale(to: readonly string[]): MailRecipientGroup[] {
  const zh: string[] = []
  const en: string[] = []
  for (const addr of to) {
    if (localeForRecipient(addr) === 'zh') zh.push(addr)
    else en.push(addr)
  }
  const groups: MailRecipientGroup[] = []
  if (zh.length > 0) groups.push({ locale: 'zh', to: zh })
  if (en.length > 0) groups.push({ locale: 'en', to: en })
  return groups
}

/**
 * 邮件内不可用(收件端不可达)的原点形态:回环 / 内网私有段 / tauri 自定义协议。
 *
 * 2026-10-15 实测根因:生产 apps/api/.env 的
 * `CORS_ORIGIN=http://localhost:8801,http://localhost:8804,...` 首项就是 localhost,
 * 而旧实现取**首项** ⇒ 邮件里的 Logo、二维码、以及"进入控制台""立即锁定账号"等
 * 所有按钮链接全部指向 `http://localhost:8801/...`,收件端取不到图、点不开按钮。
 * CORS 允许表里本来就必须带本地开发端口,错的不是这张表,是"拿它当邮件站点根"这一步。
 */
/**
 * 一个候选原点是否**可被引文收件端解析**(即:真公网 http(s))。
 *
 * 判据刻意做成**白名单**而不是黑名单:
 *   黑名单那一版枚举 `localhost|127.|tauri:|file:` 等形态,而"枚举不可达形态"这件事
 *   本身没有上界 —— 实测 `file://` 就因为不在名单里而被判成"公网",于是邮件里出现
 *   `href="file:/dashboard"`。改成"必须是 http(s) 且主机名不是本机/内网/local"之后,
 *   任何非 http 协议(含以后新冒出来的)一律落回兜底,不再靠逐个补齐。
 */
function isPublicHttpOrigin(candidate: string): boolean {
  let u: URL
  try {
    u = new URL(candidate)
  } catch {
    return false // 解析不出原点 ⇒ 更不可能被收件端取到
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  // IPv6 字面量带方括号,先剥掉再判
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === '' || host === 'localhost' || host.endsWith('.localhost')) return false
  if (host === '::1' || host === '0.0.0.0') return false
  if (host.endsWith('.local')) return false // mDNS,公网不可解析
  if (/^127\./.test(host)) return false
  if (/^10\./.test(host)) return false
  if (/^192\.168\./.test(host)) return false
  if (/^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return false
  if (/^169\.254\./.test(host)) return false // link-local(云厂商元数据地址同段)
  // 至少要像个主机名:含点(域名/IPv4)或含冒号(裸 IPv6 字面量)
  return host.includes('.') || host.includes(':')
}

/**
 * 从 CORS_ORIGIN 取**可被公网解析**的 web 站点根(与 payment-gateway 同一约定;
 * 直读 env 保持模块零副作用)。
 *
 * 取第一个真公网 http(s) 原点;一个都没有才回落品牌域名 ——
 * 失效方向必须是"落到 aizhs.top",绝不可以是"落到 localhost / 落到 file://"。
 */
export function resolveWebOrigin(): string {
  const candidates = (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const hit = candidates.find(isPublicHttpOrigin)
  return hit ? hit.replace(/\/+$/, '') : 'https://aizhs.top'
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
  /**
   * 版式语言。缺省 'zh' = 中文页面(中文站的主要收件人);
   * 海外收件人由调用方显式传 'en' —— 见 localeForRecipient。
   */
  locale?: MailLocale
}

/**
 * 版式外壳文案(刊头副标 / 创始人直联 / 页脚 / 联络块),按语言各一份。
 */
const DISPATCH_CHROME: Record<
  MailLocale,
  {
    brandLine: string
    directLine: string
    contact: (accent: string) => string
    qrAlt: string
    footer: string
  }
> = {
  zh: {
    brandLine: '智汇AI&nbsp;·&nbsp;智汇通报',
    directLine: '[&nbsp;创始人直联&nbsp;]',
    contact: (accent) =>
      '遇到任何问题,微信扫码<b style="color:#F5F5F0;">直接联系创始人李春川</b><br>微信号:' +
      `<span style="font-family:Consolas,monospace;font-size:17px;color:${accent};letter-spacing:1px;">${FOUNDER_WECHAT_ID}</span>` +
      `(长按复制)· 邮件兜底:<a href="mailto:support@aizhs.top" style="color:${accent};text-decoration:none;">support@aizhs.top</a>`,
    qrAlt: '创始人微信二维码',
    footer: `智汇AI集团 创始人 <span style="color:${DISPATCH_TOKENS.ink};font-weight:bold;">李春川</span> · aizhs.top · © 2026 智汇AI · 系统自动派发`,
  },
  en: {
    brandLine: 'IHUI&nbsp;AI&nbsp;·&nbsp;THE&nbsp;MECHANICAL&nbsp;DISPATCH',
    directLine: '[&nbsp;DIRECT_LINE&nbsp;//&nbsp;FOUNDER&nbsp;]',
    contact: (accent) =>
      'Need help? Scan the WeChat QR to <b style="color:#F5F5F0;">reach the founder directly</b><br>WeChat ID:' +
      `<span style="font-family:Consolas,monospace;font-size:17px;color:${accent};letter-spacing:1px;">${FOUNDER_WECHAT_ID}</span>` +
      ` · Email: <a href="mailto:support@aizhs.top" style="color:${accent};text-decoration:none;">support@aizhs.top</a>`,
    qrAlt: 'Founder WeChat QR code',
    footer: `IHUI AI · Founder <span style="color:${DISPATCH_TOKENS.ink};font-weight:bold;">Li Chunchuan</span> · aizhs.top · © 2026 IHUI AI · Automated message`,
  },
}

/**
 * 防弹按钮(table + <a>,QQ/Outlook 均可点)。
 *
 * opts 缺省时输出与历史版本**逐字一致**(欢迎/告警/收据等所有既有邮件不受影响);
 * compact/center 只给验证码框内那枚「一键复制」按钮用 —— 同一份形态实现,不另抄一份。
 * 注意:href 的转义责任在调用方(与 renderDispatchEmail 的 button.label 同约定)。
 */
function bulletproofButton(
  href: string,
  label: string,
  kind: 'accent' | 'danger' | 'ghost',
  opts?: { compact?: boolean; center?: boolean },
): string {
  const t = DISPATCH_TOKENS
  const solid = kind !== 'ghost'
  const bg = kind === 'danger' ? t.danger : t.accent
  const tdStyle = solid
    ? `bgcolor="${bg}"`
    : `bgcolor="${t.cardBg}" style="border:2px solid ${bg};"`
  const padding = opts?.compact ? '12px 30px' : '16px 46px'
  const fontSize = opts?.compact ? '16px' : '19px'
  const letterSpacing = opts?.compact ? '2px' : '5px'
  const aStyle = `display:inline-block;padding:${padding};font-family:'Microsoft YaHei','SimHei',sans-serif;font-size:${fontSize};font-weight:bold;letter-spacing:${letterSpacing};color:${solid ? '#0A0A0C' : bg};text-decoration:none;`
  // 邮件客户端里 td[align=center] 不保证让嵌套 table 居中,必须自带 align + margin:auto
  const tableAttrs = opts?.center ? ` align="center" style="margin:0 auto;"` : ''
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${tableAttrs}><tr><td ${tdStyle}><a href="${href}" target="_blank" style="${aStyle}">${label}</a></td></tr></table>`
}

/** 创始人微信二维码(web public 静态资产,footer-data.ts QRS 同源) */
export const FOUNDER_QR_PATH = '/footer/erweima/wechat-vx.png'
/** 品牌图片 Logo(黑底渐变,与邮件深黑卡片底色融合;PNG 保证 Outlook/Gmail 兼容) */
export const BRAND_LOGO_PATH = '/images/logo.png'

/**
 * 邮件内嵌图片 = 附件 + CID 引用(2026-10-15 立,根治"邮件 Logo 永远加载不出来")。
 *
 * 旧形态是 `${origin}/images/logo.png` 外链,三重不可达:
 * ① origin 实为 `http://localhost:8801`(生产 CORS_ORIGIN 首项)⇒ 收件端必然取不到;
 * ② 即便换成公网域名,QQ 邮箱 / Gmail / Outlook 默认拦截"远程图片",仍不显示;
 * ③ 867KB 的 2534×2534 原图按 56×56 渲染,每封信白搭 1MB。
 *
 * 根治:图片随邮件正文一起到达收件端(内嵌附件,src="cid:..."),与远程图片
 * 拦截策略、站点可达性、origin 配置**全部解耦**。
 * 附带的必然要求:内嵌图必须是小图 —— 160×160/7KB、256×256/33KB 的专用派生图。
 *
 * ⚠️ 只有 HTML 里真的出现 `cid:xxx` 才会挂对应附件(见 email-assets.ts 的按 CID 过滤),
 * 否则图片会变成邮件底部一个多余的"下载附件"。
 */
export const EMAIL_LOGO_CID = 'ihui-brand-logo'
export const EMAIL_QR_CID = 'ihui-founder-qr'
/** 邮件专用小图(相对 apps/web/public);外链兜底时才回落到上面的原图路径 */
export const EMAIL_LOGO_ASSET = '/images/logo-email.png'
export const EMAIL_QR_ASSET = '/footer/erweima/wechat-vx-email.png'

/** 通用版式:品牌刊头(纯 HTML) + 内容 + 按钮 + 创始人直联 + 页脚 */
export function renderDispatchEmail(input: DispatchLayoutInput): string {
  const t = DISPATCH_TOKENS
  const locale = input.locale ?? 'zh'
  const chrome = DISPATCH_CHROME[locale]
  const accent = input.tone === 'danger' ? t.danger : t.accent
  const button = input.button
    ? `<tr><td style="padding:24px 36px 6px;">${bulletproofButton(input.button.href, escapeHtml(input.button.label), input.button.kind ?? 'accent')}</td></tr>`
    : ''
  const foot = input.footNote
    ? `<div style="margin-top:10px;">${escapeHtml(input.footNote)}</div>`
    : ''
  const contactQr = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;"><tr>
    <td valign="middle" style="font-family:'Microsoft YaHei',sans-serif;font-size:15px;line-height:1.9;color:${t.body};">
      <div style="font-family:Consolas,monospace;font-size:13px;color:${t.dim};letter-spacing:3px;">${chrome.directLine}</div>
      <div style="margin-top:8px;">${chrome.contact(accent)}</div>
    </td>
    <td width="124" align="right" valign="middle"><img src="cid:${EMAIL_QR_CID}" width="112" height="112" alt="${chrome.qrAlt}" style="display:block;border:1px solid ${t.hairline};padding:5px;background:${t.pageBg};"></td>
  </tr></table>`
  return `<!DOCTYPE html>
<html lang="${locale === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${t.pageBg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.pageBg}"><tr><td align="center" style="padding:24px 8px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.cardBg}" style="width:600px;max-width:600px;background:${t.cardBg};">
  <tr><td style="padding:28px 36px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-family:Consolas,'Courier New',monospace;font-size:14px;color:${t.dim};letter-spacing:2px;">IHUI-CORE<span style="color:${accent};">&nbsp;&nbsp;//&nbsp;&nbsp;${escapeHtml(input.tag)}</span></td><td width="64" align="right" valign="top"><img src="cid:${EMAIL_LOGO_CID}" width="56" height="56" alt="IHUI AI" style="display:block;border:1px solid ${t.hairline};"></td></tr></table></td></tr>
  <tr><td style="padding:14px 36px 0;font-family:Impact,'Arial Black','Microsoft YaHei',sans-serif;font-size:64px;line-height:70px;font-weight:bold;color:${t.ink};letter-spacing:3px;">IHUI<span style="color:${accent};">.</span></td></tr>
  <tr><td style="padding:10px 36px 0;font-family:Consolas,monospace;font-size:14px;color:${t.dim};letter-spacing:5px;">${chrome.brandLine}</td></tr>
  <tr><td style="padding:16px 36px 0;"><div style="height:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</div></td></tr>
  <tr><td style="padding:26px 36px 0;font-family:Consolas,monospace;font-size:14px;color:${accent};letter-spacing:3px;">[&nbsp;${escapeHtml(input.tag)}&nbsp;]</td></tr>
  <tr><td style="padding:10px 36px 0;font-family:'Microsoft YaHei','SimHei',sans-serif;font-size:27px;font-weight:900;color:${t.ink};letter-spacing:2px;">${escapeHtml(input.title)}</td></tr>
  <tr><td style="padding:20px 36px 4px;">${input.bodyHtml}</td></tr>
  ${button}
  <tr><td style="padding:26px 36px 30px;border-top:1px dashed ${t.hairline};">
    ${contactQr}
    <div style="font-family:Consolas,monospace;font-size:13px;line-height:22px;color:${t.dim};letter-spacing:1px;">${foot}</div>
    <div style="font-family:Consolas,monospace;font-size:13px;color:${t.dim};margin-top:8px;">${chrome.footer}</div>
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
export type VerificationScene = 'register' | 'login' | 'reset' | 'bind'

const SCENE_TEXT: Record<VerificationScene, string> = {
  register: '注册账号',
  login: '登录账号',
  reset: '重置密码',
  bind: '绑定邮箱',
}

/** 一键复制落地页路径(静态资源,见 apps/web/public/verify-code.htm)。 */
export const VERIFY_CODE_COPY_PATH = '/verify-code.htm'

/**
 * 生成「一键复制验证码」落地页链接。
 *
 * code 一律走 URLSearchParams 编码(禁止手拼 query);调用方还必须对整串 URL 再过一次
 * escapeHtml 才能塞进 href —— 否则 `&` 会截断属性,code 里的引号会造成属性注入。
 * exp/scene 只用于落地页展示有效期与场景文案,**不是**验证码本身的有效期裁决依据
 * (裁决权始终在后端 code-store)。
 */
export function buildVerifyCodeCopyUrl(
  code: string,
  scene: VerificationScene,
  expiresInMinutes: number,
): string {
  const params = new URLSearchParams({ code, scene, exp: String(expiresInMinutes) })
  return `${resolveWebOrigin()}${VERIFY_CODE_COPY_PATH}?${params.toString()}`
}

/**
 * 验证码右侧的「一键复制」小按钮(2026-11-07 二次改版)。
 *
 * 用户明确要求:文案**只有「一键复制」四个字**、与验证码同一行且在其右侧、
 * 不要大块实心色 —— 大酸绿块抢视觉重心,在手机上尤其笨重。
 * 形态仍是防弹 `table + <a>`(邮件正文禁 JS,写不了剪贴板,只能靠真实链接中转),
 * 但视觉改成深底 + 1px 酸绿细描边 + 酸绿小字 + 圆角胶囊,尺寸只够四字。
 * `border-radius` 被 Outlook 桌面剥离时退化成直角,不影响可读性。
 */
function inlineCopyButton(href: string): string {
  const t = DISPATCH_TOKENS
  const aStyle =
    `display:inline-block;padding:9px 13px;font-family:'Microsoft YaHei','SimHei',sans-serif;` +
    `font-size:13px;line-height:13px;font-weight:bold;letter-spacing:1px;color:${t.accent};` +
    `text-decoration:none;white-space:nowrap;`
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${t.cardBg}" align="center" valign="middle" style="border:1px solid ${t.accent};border-radius:4px;"><a href="${href}" target="_blank" style="${aStyle}">${escapeHtml('一键复制')}</a></td></tr></table>`
}

/**
 * 渲染验证码邮件(真实文本验证码 + 右侧一键复制 + 点选全选 + 纯文本兜底,四层可达)。
 *
 * 覆盖 register / login / reset / bind 全部发码场景 —— 四个场景共用这一个渲染器。
 * 布局铁律:验证码与复制按钮**同一个 <tr> 的两个 <td>**,按钮永远在右;
 * 窄屏时靠缩小字号/字距给按钮留位,绝不退回「按钮堆在下方」的旧版式。
 */
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
  const copyUrl = buildVerifyCodeCopyUrl(code, scene, expiresInMinutes)
  // href 先转义:escapeHtml(copyUrl) 把 query 分隔符 & 变成 &amp;,浏览器解析后仍是 &
  const copyButton = inlineCopyButton(escapeHtml(copyUrl))
  const body = `
    ${para(`您正在${sceneText}。输入以下验证码完成操作:`)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px dashed ${t.accent};margin:0 0 24px;"><tr><td align="center" style="padding:26px 10px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>
        <td align="center" valign="middle" style="padding-right:14px;"><div style="font-family:Consolas,'Courier New',monospace;font-size:40px;font-weight:bold;letter-spacing:10px;text-indent:10px;color:${t.ink};user-select:all;-webkit-user-select:all;-moz-user-select:all;-ms-user-select:all;-webkit-touch-callout:default;cursor:pointer;" title="单击全选验证码">${escapeHtml(code)}</div></td>
        <td align="left" valign="middle">${copyButton}</td>
      </tr></table>
      <div style="font-family:Consolas,monospace;font-size:14px;color:${t.dim};letter-spacing:2px;margin-top:16px;">手机可长按数字复制 · ${expiresInMinutes} 分钟内有效</div>
    </td></tr></table>
    ${note(`· 这不是您的操作?<b style="color:${t.ink};">直接忽略本邮件</b>,账号不会有任何变动。<br>· 验证码<b style="color:${t.danger};">绝不会被任何客服索要</b>,请勿告知他人。<br>· 需要帮助:<a href="mailto:support@aizhs.top" style="color:${t.accent};text-decoration:none;">support@aizhs.top</a>`)}`
  return {
    subject: `【智汇AI】${sceneText}验证码 ${code}`,
    html: renderDispatchEmail({
      tag: 'TRANSACTIONAL // VERIFY_CODE',
      title: `${greeting}您的身份验证码`,
      bodyHtml: body,
    }),
    text: `${nickname ? `${nickname},` : ''}您的${sceneText}验证码是 ${code},${expiresInMinutes} 分钟内有效。一键复制:${copyUrl}。如非本人操作请忽略。`,
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
  /**
   * 邮件语言,缺省 'zh'。
   *
   * 2026-11-10 机主定案:中文收件人看到的是「[警告] / 严重级别 / 来源 / 时间 / 告警内容」,
   * 不再出现 WARNING / SEVERITY / MESSAGE 这类只能靠猜的英文;海外收件人仍走 'en'
   * (由调用方按收件域名判定,判据见 localeForRecipient)。
   */
  locale?: MailLocale
}

/** 告警邮件全部可见文案,按语言各一份(标签与级别词必须同源,否则两处会漂)。 */
interface AlertCopy {
  /** 邮件主题里的级别前缀 */
  subjectPrefix: Record<SystemAlertEmailInput['severity'], string>
  /** 刊头栏目眉 */
  tag: Record<SystemAlertEmailInput['severity'], string>
  /** 数据格标签 */
  label: { severity: string; source: string; time: string; message: string }
  /** 级别取值(数据格里方括号内的词) */
  severityValue: Record<SystemAlertEmailInput['severity'], string>
  introInfo: string
  introAlert: string
  footNote: string
  /** 纯文本兜底里的字段名 */
  textSource: string
  textTime: string
  /**
   * 缺省主题(调用方没给 --title 时用它)。
   *
   * 2026-11-10:原先脚本里硬编码 `部署失败 — ${env}`,于是英文收件人收到
   * `[CRITICAL] 部署失败 — production` —— 级别词翻成英文、标题仍中文,
   * 半中半英比全中文更难读。标题同属可见文案,必须与 subjectPrefix 同源。
   */
  defaultTitle: (environment: string) => string
}

const ALERT_COPY: Record<MailLocale, AlertCopy> = {
  zh: {
    subjectPrefix: { info: '提示', warning: '警告', critical: '严重' },
    tag: { info: '系统通知', warning: '系统警告', critical: '系统严重告警' },
    label: { severity: '严重级别', source: '来源', time: '时间', message: '告警内容' },
    severityValue: { info: '提示', warning: '警告', critical: '严重' },
    introInfo: '系统监测到以下事件,供知悉:',
    introAlert: '系统监测到异常,请值班操作员立即关注:',
    footNote: '本邮件由系统自动派发,无需回复。请前往服务器日志定位根因后再恢复。',
    textSource: '来源',
    textTime: '时间',
    defaultTitle: (environment) => `部署失败 — ${environment}`,
  },
  en: {
    subjectPrefix: { info: 'INFO', warning: 'WARNING', critical: 'CRITICAL' },
    tag: { info: 'SYSTEM // ALERT_INFO', warning: 'SYSTEM // ALERT_WARNING', critical: 'SYSTEM // ALERT_CRITICAL' },
    label: { severity: 'SEVERITY', source: 'SOURCE', time: 'TIME', message: 'MESSAGE' },
    severityValue: { info: 'INFO', warning: 'WARNING', critical: 'CRITICAL' },
    introInfo: 'The system recorded the following event for your information:',
    introAlert: 'The system detected an anomaly. On-call operators please investigate immediately:',
    footNote: 'This mail is dispatched automatically; do not reply. Locate the root cause in the server logs before restoring service.',
    textSource: 'Source',
    textTime: 'Time',
    defaultTitle: (environment) => `Deploy failed — ${environment}`,
  },
}

/**
 * 取缺省主题(按语言)。调用方不传 --title 时用它,避免脚本里硬编码某一语言的标题。
 * 显式 `--title` 始终优先——调查者手写的标题不该被翻译覆盖。
 */
export function defaultAlertTitle(environment: string, locale: MailLocale = 'zh'): string {
  return ALERT_COPY[locale].defaultTitle(environment)
}

/** 多行纯文本 → 逐行 div(先整体转义,空行以 &nbsp; 保位) */
function multiLineHtml(text: string): string {
  return escapeHtml(text)
    .split(/\r?\n/)
    .map((line) => `<div>${line || '&nbsp;'}</div>`)
    .join('')
}

/** 渲染运维系统告警邮件(critical/warning 信号红,info 品牌绿;默认中文) */
export function renderSystemAlertEmail(input: SystemAlertEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const locale = input.locale ?? 'zh'
  const copy = ALERT_COPY[locale]
  const tone = input.severity === 'info' ? 'accent' : 'danger'
  const accent = tone === 'danger' ? t.danger : t.accent
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:17px;font-weight:bold;color:${t.ink};margin-top:7px;`
  // message 整体转义后按行拆分渲染,空行以 &nbsp; 保位
  const messageHtml = multiLineHtml(input.message)
  const body = `
    ${para(input.severity === 'info' ? copy.introInfo : copy.introAlert)}
    ${metaGrid(
      [
        metaRow([
          cell(
            copy.label.severity,
            `<span style="color:${accent};">[ ${copy.severityValue[input.severity]} ]</span>`,
            accent,
            { right: true },
          ),
          cell(copy.label.source, escapeHtml(input.source), accent, { right: true, valueStyle: mono }),
          cell(copy.label.time, escapeHtml(input.time), accent, { valueStyle: mono }),
        ]),
        metaRow([
          `<td colspan="3" style="border-top:1px dashed ${accent};padding:16px 22px;"><div style="font-family:Consolas,monospace;font-size:12px;color:#8A8A85;letter-spacing:3px;margin-bottom:8px;">${escapeHtml(copy.label.message)}</div><div style="font-family:Consolas,'Courier New',monospace;font-size:16px;line-height:1.9;color:#F5F5F0;">${messageHtml}</div></td>`,
        ]),
      ],
      accent,
    )}
    ${note(copy.footNote)}`
  return {
    subject: `[${copy.subjectPrefix[input.severity]}] ${input.title}`,
    html: renderDispatchEmail({
      tag: copy.tag[input.severity],
      title: input.title,
      bodyHtml: body,
      locale,
      tone,
    }),
    text: `[${copy.subjectPrefix[input.severity]}] ${input.title}\n${input.message}\n${copy.textSource}:${input.source} · ${copy.textTime}:${input.time}`,
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
          cell('STATUS', `<span style="color:${t.accent};">[ 已支付 / PAID ]</span>`, t.accent, {}),
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
      footNote:
        '本收据由系统自动派发,可作为支付凭证留存;如遇资产未到账,请通过下方创始人直联联系我们处理。',
    }),
    text: `您的订单已支付成功。订单号 ${input.orderNo};商品 ${input.productTitle}${input.quantity > 1 ? ` ×${input.quantity}` : ''};金额 ¥${input.amountYuan};支付方式 ${input.payType};时间 ${input.paidAt}。查看:${input.subscriptionUrl}`,
  }
}

// ================= 资金/权益结果通知 =================

/** 退款结果通知输入(refundAmountYuan 由调用方按 numeric(10,2) 元格式传入) */
export interface RefundResultEmailInput {
  userName?: string
  orderNo: string
  refundAmountYuan: string
  status: 'completed' | 'rejected' | 'failed'
  reason?: string
  finishedAt: string
  /** 订单列表落地页完整 URL(调用方保证真实存在,杜绝 404) */
  ordersUrl: string
}

const REFUND_STATUS_LABEL: Record<RefundResultEmailInput['status'], string> = {
  completed: '退款成功',
  rejected: '退款未通过',
  failed: '退款失败',
}

const REFUND_STATUS_TAG: Record<RefundResultEmailInput['status'], string> = {
  completed: 'BILLING // REFUND_COMPLETED',
  rejected: 'BILLING // REFUND_REJECTED',
  failed: 'BILLING // REFUND_FAILED',
}

/** 渲染退款结果通知(completed 品牌绿,rejected/failed 信号红) */
export function renderRefundResultEmail(input: RefundResultEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const ok = input.status === 'completed'
  const accent = ok ? t.accent : t.danger
  const tone = ok ? 'accent' : 'danger'
  const label = REFUND_STATUS_LABEL[input.status]
  const impact = `font-family:Impact,'Arial Black',sans-serif;font-size:26px;font-weight:bold;color:${accent};margin-top:4px;`
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;`
  const reasonRow = input.reason
    ? [
        metaRow([
          `<td colspan="2" style="border-top:1px dashed ${accent};padding:16px 22px;"><div style="font-family:Consolas,monospace;font-size:12px;color:#8A8A85;letter-spacing:3px;">REASON</div><div style="font-family:'Microsoft YaHei',sans-serif;font-size:18px;line-height:1.8;color:${t.ink};margin-top:7px;">${escapeHtml(input.reason)}</div></td>`,
        ]),
      ]
    : []
  const body = `
    ${para(
      ok
        ? '您的退款申请已处理完成,款项将按原支付路径退回,请注意查收:'
        : '很抱歉,您的退款申请未能完成,订单资产状态保持不变:',
    )}
    ${metaGrid(
      [
        metaRow([
          cell('ORDER_NO', escapeHtml(input.orderNo), accent, { right: true, valueStyle: mono }),
          cell('STATUS', `<span style="color:${accent};">[ ${label} ]</span>`, accent, {}),
        ]),
        metaRow([
          cell('REFUND_AMOUNT', `¥${escapeHtml(input.refundAmountYuan)}`, accent, {
            right: true,
            top: true,
            valueStyle: impact,
          }),
          cell('FINISHED_AT', escapeHtml(input.finishedAt), accent, {
            top: true,
            valueStyle: mono,
          }),
        ]),
        ...reasonRow,
      ],
      accent,
    )}`
  return {
    subject: `【智汇AI】${label} · 订单 ${input.orderNo}`,
    html: renderDispatchEmail({
      tag: REFUND_STATUS_TAG[input.status],
      title: label,
      bodyHtml: body,
      button: {
        href: input.ordersUrl,
        label: '查看我的订单 →',
        kind: ok ? 'accent' : 'ghost',
      },
      tone,
      footNote: ok
        ? '退款按原路退回,到账时间以支付渠道为准(通常 1-3 个工作日);如逾期未到账请通过下方创始人直联联系我们。'
        : '如对处理结果有异议,请通过下方创始人直联联系我们复核。',
    }),
    text: `${label}:订单 ${input.orderNo},退款金额 ¥${input.refundAmountYuan}${
      input.reason ? `,原因:${input.reason}` : ''
    },时间 ${input.finishedAt}。查看订单:${input.ordersUrl}`,
  }
}

/** 提现结果通知输入(amountYuan/feeYuan 由调用方按 分→元 换算传入) */
export interface WithdrawalResultEmailInput {
  userName?: string
  amountYuan: string
  feeYuan: string
  method: string
  status: 'approved' | 'rejected'
  rejectReason?: string
  processedAt: string
  /** 提现记录落地页完整 URL(调用方保证真实存在,杜绝 404) */
  withdrawUrl: string
}

/** 渲染提现结果通知(approved 品牌绿,rejected 信号红 + 驳回原因) */
export function renderWithdrawalResultEmail(input: WithdrawalResultEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const ok = input.status === 'approved'
  const accent = ok ? t.accent : t.danger
  const tone = ok ? 'accent' : 'danger'
  const statusText = ok ? '打款处理中' : '已驳回'
  const statusEn = ok ? 'PROCESSING' : 'REJECTED'
  const impact = `font-family:Impact,'Arial Black',sans-serif;font-size:26px;font-weight:bold;color:${accent};margin-top:4px;`
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;`
  const reasonRow = input.rejectReason
    ? [
        metaRow([
          `<td colspan="2" style="border-top:1px dashed ${accent};padding:16px 22px;"><div style="font-family:Consolas,monospace;font-size:12px;color:#8A8A85;letter-spacing:3px;">REASON</div><div style="font-family:'Microsoft YaHei',sans-serif;font-size:18px;line-height:1.8;color:${t.ink};margin-top:7px;">${escapeHtml(input.rejectReason)}</div></td>`,
        ]),
      ]
    : []
  const body = `
    ${para(
      ok
        ? '您的提现申请已审核通过,打款正在处理中,到账后请留意收款账户:'
        : '您的提现申请被驳回,冻结金额已原路退回您的可用余额:',
    )}
    ${metaGrid(
      [
        metaRow([
          cell('AMOUNT', `¥${escapeHtml(input.amountYuan)}`, accent, {
            right: true,
            valueStyle: impact,
          }),
          cell('METHOD', escapeHtml(input.method), accent, { valueStyle: mono }),
        ]),
        metaRow([
          cell('FEE', `¥${escapeHtml(input.feeYuan)}`, accent, { right: true, top: true }),
          cell(
            'STATUS',
            `<span style="color:${accent};">[ ${statusText} / ${statusEn} ]</span>`,
            accent,
            { top: true },
          ),
        ]),
        ...reasonRow,
      ],
      accent,
    )}`
  return {
    subject: ok ? '【智汇AI】提现审核通过,打款处理中' : '【智汇AI】提现申请被驳回,金额已退回余额',
    html: renderDispatchEmail({
      tag: ok ? 'BILLING // WITHDRAWAL_APPROVED' : 'BILLING // WITHDRAWAL_REJECTED',
      title: ok ? '提现审核通过' : '提现申请被驳回',
      bodyHtml: body,
      button: {
        href: input.withdrawUrl,
        label: '查看提现记录 →',
        kind: ok ? 'accent' : 'ghost',
      },
      tone,
      footNote: ok
        ? '打款到账时间以收款渠道为准;如长期未到账请通过下方创始人直联联系我们。'
        : '调整后可重新发起提现;如有疑问请通过下方创始人直联联系我们。',
    }),
    text: `${ok ? '提现审核通过' : '提现申请被驳回'}:到账 ¥${input.amountYuan}(手续费 ¥${input.feeYuan}),方式 ${input.method},时间 ${input.processedAt}${
      input.rejectReason ? `,驳回原因:${input.rejectReason}` : ''
    }。查看记录:${input.withdrawUrl}`,
  }
}

/** 兑换码成功通知输入(newTokenBalance 为 -1 时表示无限额度) */
export interface RedeemSuccessEmailInput {
  userName?: string
  code: string
  tokenAmount: number
  newTokenBalance: number
  /** API Key 落地页完整 URL(调用方保证真实存在,杜绝 404) */
  keysUrl: string
}

/** 渲染兑换码成功通知(品牌绿喜庆版式 + Impact +token 大字) */
export function renderRedeemSuccessEmail(input: RedeemSuccessEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const impact = `font-family:Impact,'Arial Black',sans-serif;font-size:26px;font-weight:bold;color:${t.accent};margin-top:4px;`
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;`
  const balanceText =
    input.newTokenBalance === -1 ? '∞ 无限' : escapeHtml(String(input.newTokenBalance))
  const body = `
    ${para('兑换码兑换成功,Token 已实时到账您的 API Key:')}
    ${metaGrid(
      [
        metaRow([
          cell('CODE', escapeHtml(input.code), t.accent, { right: true, valueStyle: mono }),
          cell('TOKENS', `+${input.tokenAmount}`, t.accent, { valueStyle: impact }),
        ]),
        metaRow([
          cell('BALANCE', balanceText, t.accent, { right: true, top: true, valueStyle: mono }),
          cell('STATUS', `<span style="color:${t.accent};">[ 兑换成功 / OK ]</span>`, t.accent, {
            top: true,
          }),
        ]),
      ],
      t.accent,
    )}`
  return {
    subject: `【智汇AI】兑换成功,Token +${input.tokenAmount} 已到账`,
    html: renderDispatchEmail({
      tag: 'BILLING // REDEEM_OK',
      title: '兑换码兑换成功',
      bodyHtml: body,
      button: { href: input.keysUrl, label: '查看我的 API Key →' },
      footNote: 'Token 余额实时生效,可直接用于模型调用;如未到账请通过下方创始人直联联系我们。',
    }),
    text: `兑换码 ${input.code} 兑换成功,Token +${input.tokenAmount} 已到账,当前余额 ${
      input.newTokenBalance === -1 ? '无限' : input.newTokenBalance
    }。查看:${input.keysUrl}`,
  }
}

/** VIP 过期通知输入 */
export interface VipExpireEmailInput {
  userName?: string
  vipName?: string
  expiredAt: string
  /** 续费落地页完整 URL(调用方保证真实存在,杜绝 404) */
  renewUrl: string
}

/** 渲染 VIP 会员过期通知(信号红警示 + 真实续费按钮) */
export function renderVipExpireEmail(input: VipExpireEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;`
  const vipName = input.vipName
    ? `<b style="color:${t.ink};">${escapeHtml(input.vipName)}</b>`
    : 'VIP 会员'
  const body = `
    ${para(`您的${vipName}已于 <b style="color:${t.danger};">${escapeHtml(input.expiredAt)}</b> 到期失效,会员特权已停止:专属折扣、优先算力、专属客服等权益将按普通用户标准执行。`)}
    ${metaGrid(
      [
        metaRow([
          cell('EXPIRED_AT', escapeHtml(input.expiredAt), t.danger, {
            right: true,
            valueStyle: mono,
          }),
          cell(
            'STATUS',
            `<span style="color:${t.danger};">[ 已失效 / EXPIRED ]</span>`,
            t.danger,
            {},
          ),
        ]),
      ],
      t.danger,
    )}
    ${note('· 续费后特权<b style="color:' + t.ink + ';">立即恢复</b>,历史数据与配置完整保留。<br>· 您的数据与余额不受影响,仅权益降级为普通用户标准。')}`
  return {
    subject: '【智汇AI】您的 VIP 会员已到期,续费立即恢复特权',
    html: renderDispatchEmail({
      tag: 'BILLING // VIP_EXPIRED',
      title: 'VIP 会员已到期',
      bodyHtml: body,
      button: { href: input.renewUrl, label: '立即续费 →', kind: 'danger' },
      tone: 'danger',
      footNote: '到期后专属折扣与优先算力已停用;续费遇到问题请通过下方创始人直联联系我们。',
    }),
    text: `您的 VIP 会员已于 ${input.expiredAt} 到期失效。续费立即恢复特权:${input.renewUrl}`,
  }
}

/** 发票结果通知输入(amountYuan 由调用方按 分→元 换算传入;收件人=用户指定收票邮箱) */
export interface InvoiceResultEmailInput {
  userName?: string
  invoiceType: 'plain' | 'vat_special'
  /** 发票抬头 */
  title: string
  amountYuan: string
  orderNo: string
  status: 'issued' | 'rejected'
  invoiceNo?: string
  invoiceUrl?: string
  reason?: string
  finishedAt: string
  /** 订单列表落地页完整 URL(调用方保证真实存在,杜绝 404) */
  ordersUrl: string
}

const INVOICE_TYPE_LABEL: Record<InvoiceResultEmailInput['invoiceType'], string> = {
  plain: '电子普通发票',
  vat_special: '增值税专用发票',
}

/** 渲染发票结果通知(issued 品牌绿+发票号/下载,rejected 信号红+原因) */
export function renderInvoiceResultEmail(input: InvoiceResultEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const ok = input.status === 'issued'
  const accent = ok ? t.accent : t.danger
  const tone = ok ? 'accent' : 'danger'
  const statusText = ok ? '开具完成' : '未通过'
  const impact = `font-family:Impact,'Arial Black',sans-serif;font-size:26px;font-weight:bold;color:${accent};margin-top:4px;`
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;`
  const rows: string[] = [
    metaRow([
      cell('TYPE', escapeHtml(INVOICE_TYPE_LABEL[input.invoiceType]), accent, {
        right: true,
        valueStyle: mono,
      }),
      cell('AMOUNT', `¥${escapeHtml(input.amountYuan)}`, accent, { valueStyle: impact }),
    ]),
    metaRow([
      cell('TITLE', escapeHtml(input.title), accent, { right: true, top: true }),
      cell('STATUS', `<span style="color:${accent};">[ ${statusText} ]</span>`, accent, {
        top: true,
      }),
    ]),
  ]
  if (ok && input.invoiceNo) {
    rows.push(
      metaRow([
        cell('INVOICE_NO', escapeHtml(input.invoiceNo), accent, {
          right: true,
          top: true,
          valueStyle: mono,
        }),
        cell('ORDER_NO', escapeHtml(input.orderNo), accent, { top: true, valueStyle: mono }),
      ]),
    )
  }
  if (input.reason) {
    rows.push(
      metaRow([
        `<td colspan="2" style="border-top:1px dashed ${accent};padding:16px 22px;"><div style="font-family:Consolas,monospace;font-size:12px;color:#8A8A85;letter-spacing:3px;">REASON</div><div style="font-family:'Microsoft YaHei',sans-serif;font-size:18px;line-height:1.8;color:${t.ink};margin-top:7px;">${escapeHtml(input.reason)}</div></td>`,
      ]),
    )
  }
  const body = `
    ${para(
      ok
        ? '您申请的发票已开具完成,请及时查收下载:'
        : '很抱歉,您的开票申请未能通过,可修正后重新提交:',
    )}
    ${metaGrid(rows, accent)}`
  const button =
    ok && input.invoiceUrl
      ? { href: input.invoiceUrl, label: '下载发票 →', kind: 'accent' as const }
      : {
          href: input.ordersUrl,
          label: '查看我的订单 →',
          kind: (ok ? 'accent' : 'ghost') as 'accent' | 'ghost',
        }
  return {
    subject: ok
      ? `【智汇AI】发票已开具 · ${INVOICE_TYPE_LABEL[input.invoiceType]}`
      : '【智汇AI】开票申请未通过',
    html: renderDispatchEmail({
      tag: ok ? 'BILLING // INVOICE_ISSUED' : 'BILLING // INVOICE_REJECTED',
      title: ok ? '发票开具完成' : '开票申请未通过',
      bodyHtml: body,
      button,
      tone,
      footNote: ok
        ? '电子发票与纸质发票具有同等法律效力;如未收到或信息有误请通过下方创始人直联联系我们。'
        : '请核对抬头与税号信息后重新提交;如有疑问请通过下方创始人直联联系我们。',
    }),
    text: `${ok ? '发票已开具' : '开票申请未通过'}:${INVOICE_TYPE_LABEL[input.invoiceType]},抬头 ${input.title},金额 ¥${input.amountYuan}${
      ok && input.invoiceNo ? `,发票号 ${input.invoiceNo}` : ''
    }${input.reason ? `,原因:${input.reason}` : ''}。查看订单:${input.ordersUrl}`,
  }
}

/** 钱包充值 API Key 通知输入(newTokenBalance 为 -1 时表示无限额度;costYuan=钱包扣款 分→元) */
export interface WalletRechargeEmailInput {
  userName?: string
  keyName: string
  costYuan: string
  creditTokens: number
  newTokenBalance: number
  /** API Key 落地页完整 URL(调用方保证真实存在,杜绝 404) */
  keysUrl: string
}

/** 渲染钱包充值 API Key 成功通知(品牌绿,钱包扣款 + Key 到账) */
export function renderWalletRechargeEmail(input: WalletRechargeEmailInput): DispatchEmail {
  const t = DISPATCH_TOKENS
  const impact = `font-family:Impact,'Arial Black',sans-serif;font-size:26px;font-weight:bold;color:${t.accent};margin-top:4px;`
  const mono = `font-family:Consolas,'Courier New',monospace;font-size:19px;font-weight:bold;color:${t.ink};margin-top:7px;`
  const balanceText =
    input.newTokenBalance === -1 ? '∞ 无限' : escapeHtml(String(input.newTokenBalance))
  const body = `
    ${para('钱包扣款成功,额度已实时到账 API Key:')}
    ${metaGrid(
      [
        metaRow([
          cell('KEY', escapeHtml(input.keyName), t.accent, { right: true, valueStyle: mono }),
          cell('CREDIT', `+${input.creditTokens}`, t.accent, { valueStyle: impact }),
        ]),
        metaRow([
          cell('COST', `¥${escapeHtml(input.costYuan)}`, t.accent, {
            right: true,
            top: true,
          }),
          cell('BALANCE', balanceText, t.accent, { top: true, valueStyle: mono }),
        ]),
      ],
      t.accent,
    )}`
  return {
    subject: `【智汇AI】充值成功,额度 +${input.creditTokens} 已到账`,
    html: renderDispatchEmail({
      tag: 'BILLING // WALLET_RECHARGE_OK',
      title: '充值到账成功',
      bodyHtml: body,
      button: { href: input.keysUrl, label: '查看我的 API Key →' },
      footNote: '额度实时生效,可直接用于模型调用;如未到账请通过下方创始人直联联系我们。',
    }),
    text: `API Key「${input.keyName}」充值成功:钱包扣款 ¥${input.costYuan},额度 +${input.creditTokens},当前余额 ${
      input.newTokenBalance === -1 ? '无限' : input.newTokenBalance
    }。查看:${input.keysUrl}`,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
