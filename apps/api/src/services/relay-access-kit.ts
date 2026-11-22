// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 接入套件拼装层(2026-11-18 立)。
 *
 * 立因:qoder2api 系网关的 LAN 模式会随机生成一枚高强度 Key、持久化到 settings,
 * 并给一条「带 Key 直达面板」的链接。本仓 Key 体系已完整(生成/哈希存储/出口绑定/白名单),
 * 缺的是**一次调用把「建 Key + 接入信息 + 直达链接」一起给出来** —— 运营现在要开三个页面
 * 才能凑齐一份可发的接入说明。
 *
 * 本模块是纯拼装(零 IO):Key 由调用方传入(生成与落库在路由层,复用既有
 * `generateApiKey`/`hashSecret`,不另造一份生成器)。
 *
 * **比对照程序多的一条**:直达链接默认**不带 Key**。带 Key 的 URL 会进浏览器历史、
 * 代理日志、截图,是真实泄漏面;对照程序默认带,本仓默认不带并显式说明怎么改。
 */

export type AccessMode = 'lan' | 'public'

export interface AccessKitInput {
  /** 站根地址,必须由调用方给出(不猜域名) */
  baseUrl: string
  /** 完整 Key(仅本次可读;本模块不持久化) */
  apiKey: string
  mode: AccessMode
  model?: string
  /** 面板路径(默认 /admin/relay);给空串则不拼面板链接 */
  panelPath?: string
  /** 是否把 Key 塞进直达链接(默认 false) */
  includeKeyInLink?: boolean
}

export interface AccessKitResult {
  ok: boolean
  code?: 'bad-base-url' | 'missing-key' | 'lan-needs-http'
  reason?: string
  /** 面板直达链接(默认不含 Key) */
  panelLink?: string
  /** 客户端接入摘要(给客服/运营直接转发的四行) */
  handoff?: string
  warnings: string[]
}

function stripSlash(v: string): string {
  return v.trim().replace(/\/+$/, '')
}

/**
 * 拼装接入套件。纯函数:同输入恒等。
 */
export function buildAccessKit(input: AccessKitInput): AccessKitResult {
  const warnings: string[] = []
  const base = stripSlash(input?.baseUrl ?? '')
  if (!base) {
    return {
      ok: false,
      code: 'bad-base-url',
      reason: 'baseUrl 为空:本模块不内置域名,请传实际站根地址(本机 127.0.0.1:端口 / 局域网 内网IP:端口)',
      warnings,
    }
  }
  if (!/^https?:\/\//i.test(base)) {
    return {
      ok: false,
      code: 'bad-base-url',
      reason: `baseUrl 缺协议头「${base}」:必须显式写 http:// 或 https://`,
      warnings,
    }
  }

  const apiKey = typeof input?.apiKey === 'string' ? input.apiKey.trim() : ''
  if (!apiKey) {
    return {
      ok: false,
      code: 'missing-key',
      reason: 'apiKey 为空:先在 Key 池建一枚,再回来拼套件',
      warnings,
    }
  }

  const isHttps = /^https:\/\//i.test(base)
  if (input.mode === 'lan' && isHttps) {
    warnings.push('LAN 模式配了 https:内网直连通常没有证书,客户端会报 TLS 错;公网用 public 模式')
  }
  if (input.mode === 'public' && !isHttps) {
    warnings.push('public 模式配了 http:公网明文会泄露 Key,务必换成 https')
  }

  const includeKey = input.includeKeyInLink === true
  const panelPath = input.panelPath === undefined ? '/admin/relay' : input.panelPath
  const panelLink = panelPath ? `${base}${panelPath}${includeKey ? `?key=${encodeURIComponent(apiKey)}` : ''}` : undefined
  if (includeKey) {
    warnings.push('直达链接带了 Key:会进浏览器历史/代理日志/截图,只在内网临时用,用完把链接作废')
  }

  const handoff = [
    `接口地址: ${base}`,
    `API Key: ${apiKey}`,
    `模型: ${(input.model ?? '').trim() || '(未指定,客户端走默认)'}`,
    `协议: OpenAI 兼容 (Chat Completions)`,
  ].join('\n')

  return { ok: true, panelLink, handoff, warnings }
}

/** 供 UI 判断"该不该给带 Key 的链接" */
export function shouldOfferKeyLink(mode: AccessMode): boolean {
  return mode === 'lan'
}

export const __test__ = { stripSlash }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
