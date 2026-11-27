// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * D166 链接预览探测 hook(2026-09-30 立,承 V4 §9.4③)。
 *
 * 背景:聊天输入框粘贴链接没有预览卡,发出去之后才知道读不到。本 hook 在粘贴
 * 发生时对文本里的第一条 http(s) 链接做一次轻量探测(GET /api/url-preview/preview,
 * 后端 3s 总时限 + 128KB 上限 + 不缓存正文),把"能不能读、读到什么标题"以三态
 * 卡片呈现:
 *   - loading       探测中
 *   - ok            读到了(title/description;title 缺省时前端回落展示主机名)
 *   - unavailable   判定读不到(404/410/5xx/公网域名不存在)
 *   - undetermined  未判定(需登录 401/403、超时、内网/SSRF 拦截、网络错误)——
 *                   "把没判写成判过"是同一条禁令,未判定必须与读不到分开。
 *
 * 防双抓(票面铁律:预检不得变成"抓取两次"):
 *   - 同一 URL 在本 hook 实例生命周期内只发一次探测(先记账再发请求,并发重复
 *     触发与 resolved 后的重复触发都被记账挡住);
 *   - 探测中的同一 URL 不再发第二次(inflight 守卫)。
 *
 * 不阻断发送(票面显式断言):probeFromPaste 是 fire-and-forget —— 同步不抛、
 * 异步不产生 unhandled rejection,返回 void;发送路径不读本 hook 的任何状态,
 * 预览失败/未判定绝不改变发送行为。
 */

import * as React from 'react'

import { fetchApi } from '@/lib/api'

/** 后端探测总时限(3s)。客户端传输层超时略放宽,让后端能把自己的"未判定(超时)"送达。 */
export const LINK_PREVIEW_PROBE_TIMEOUT_MS = 3000
export const LINK_PREVIEW_TRANSPORT_TIMEOUT_MS = 5000

/** 三态封闭的预览状态(loading 之外三态与后端 UrlPreviewProbeResult 一一对应)。 */
export type LinkPreviewStatus = 'loading' | 'ok' | 'unavailable' | 'undetermined'

export interface LinkPreviewState {
  status: LinkPreviewStatus
  url: string
  title?: string
  description?: string
  /** 站点图标绝对地址(ok 态可能携带;由卡片经同源媒体代理加载)。 */
  icon?: string
  /** 机器可判原因(unavailable/undetermined 携带;ok 缺省)。 */
  reason?: string
}

/** 后端 data 形态(status=ok 与另两态字段不同)。 */
interface UrlPreviewData {
  status: 'ok' | 'unavailable' | 'undetermined'
  url: string
  title?: string
  description?: string
  icon?: string
  reason?: string
}

/** http(s) 起始锚(只认 http/https,大小写不敏感)。 */
const URL_START_RE = /https?:\/\//i

/**
 * 硬边界:URL 语义之外的字符 —— Unicode 空白/控制符、ASCII 引号与尖括号、中英文引号、
 * 顿号、括号、CJK 标点与全角符号。
 *
 * 2026-11-26 实报根因:旧实现只用"空白 + ASCII 引号"当边界,于是中文正文紧贴链接时
 * (`https://example.com，绑定"…"` 全角逗号后直接接中文)整段被吞进 host;`new URL()`
 * 把它当成伪 IDN 主机(example.xn--com,,,—…)解析"成功",探测一路走到 DNS 失败,
 * 卡片只剩"暂时无法判定"。边界必须在**扫描时**截断,不能只靠事后剪尾标点。
 */
const URL_BOUNDARY_RE =
  /[\s\u0000-\u001F\u007F<>"'`\u200B-\u200F\u2018-\u201F\u2026\u2014\u2015\u3000-\u303F\uFE10-\uFE19\uFF01-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]/

/** 尾随标点(URL 语义外):中英句读、引号、括号、省略号、破折号,剪掉。 */
const TRAILING_PUNCT_RE =
  /[.,;:!?'"`\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F\u3001\u3009\u300B\u300D\u300F\u3011\uFF09\)\]\}]+$/u

/** 主机合法字符(URL 解析后 hostname 已是小写 ASCII 或 punycode;含逗号的伪 IDN 一律不认)。 */
const HOSTNAME_RE = /^(?:\[[0-9a-f:.]+\]|[a-z0-9._-]+)$/i

/** 主机标签扫描态:空 / 已见 ASCII / 已见非 ASCII(IDN 标签)。 */
type HostLabelState = 'empty' | 'ascii' | 'wide'

function isWideChar(ch: string): boolean {
  return (ch.codePointAt(0) ?? 0) > 0x7f
}

/**
 * 从 authorityStart(协议 `//` 之后)起扫到 URL 的结束位置。
 *
 * - 任何硬边界字符即止(中文标点/全角符号/引号/空白);
 * - authority(host[:port])段内:同一个标签里 ASCII 与非 ASCII 混排 ⇒ 判定为"正文粘连",
 *   在第一个越界字符处截断(`example.com绑定` ⇒ `example.com`);纯中文标签(IDN,如
 *   `例子.com`)放行,路径/查询段里的中文也放行(后端 `new URL` 会自行百分号编码)。
 */
function scanUrlEnd(text: string, authorityStart: number): number {
  let label: HostLabelState = 'empty'
  let inAuthority = true
  for (let i = authorityStart; i < text.length; i++) {
    const ch = text[i] as string
    if (URL_BOUNDARY_RE.test(ch)) return i
    if (!inAuthority) continue
    if (ch === '/' || ch === '?' || ch === '#') {
      inAuthority = false
      continue
    }
    if (ch === '.' || ch === '@') {
      label = 'empty'
      continue
    }
    if (ch === ':' || ch === '[' || ch === ']' || ch === '%') continue
    if (/[A-Za-z0-9_-]/.test(ch)) {
      if (label === 'wide') return i
      label = 'ascii'
      continue
    }
    if (isWideChar(ch)) {
      if (label === 'ascii') return i
      label = 'wide'
      continue
    }
    return i
  }
  return text.length
}

/** 候选必须是可解析的 http(s) 且主机字符合法(防"伪 IDN 主机"混进探测链)。 */
function isValidHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate)
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.length > 0 &&
      HOSTNAME_RE.test(parsed.hostname)
    )
  } catch {
    return false
  }
}

/**
 * 从粘贴文本提取第一条 http(s) 链接;没有则 null。纯函数(测试与 hook 共用,禁止第二份)。
 *
 * 扫描截断 + 尾随标点清理后仍要过 URL 解析校验;极小概率的残留按"最长合法前缀"回退
 * (最多 8 步,成本有界),绝不把解不动的字符串丢给探测端冒充"未判定"。
 */
export function detectPastedUrl(text: string): string | null {
  if (!text) return null
  const m = URL_START_RE.exec(text)
  if (!m) return null
  const start = m.index
  // 主机扫描从协议 `//` 之后起算:scheme 本身不是 authority,否则 '//' 会把状态提前判成"已出 authority"。
  const authorityStart = start + m[0].length
  let candidate = text.slice(start, scanUrlEnd(text, authorityStart)).replace(TRAILING_PUNCT_RE, '')
  for (let attempt = 0; attempt < 8 && candidate.length > 0; attempt++) {
    if (isValidHttpUrl(candidate)) return candidate
    candidate = candidate.slice(0, -1).replace(TRAILING_PUNCT_RE, '')
  }
  return null
}

export interface UseLinkPreviewReturn {
  /** 当前预览态;null = 无预览卡(未探测过或已关闭)。 */
  preview: LinkPreviewState | null
  /** 粘贴文本入口:从中识别 URL 并触发探测(同 URL 单实例只发一次)。 */
  probeFromPaste: (text: string) => void
  /** 关闭预览卡(点 × 或发送后由调用方决定是否调用)。 */
  reset: () => void
}

export function useLinkPreview(): UseLinkPreviewReturn {
  const [preview, setPreview] = React.useState<LinkPreviewState | null>(null)
  // 记账在发请求之前:同一 URL 的并发重复触发与 resolved 后重复触发都挡住。
  const probedUrlsRef = React.useRef<Set<string>>(new Set())
  const inflightUrlRef = React.useRef<string | null>(null)
  // 单调序号:先粘 A 再粘 B 时,A 的迟到响应必须丢弃,否则会把 B 的卡覆盖成 A 的;
  // reset(发送后关卡)后迟到的 A 也不得把卡"复活"在已发出的消息下方。
  const seqRef = React.useRef(0)

  const probeFromPaste = React.useCallback((text: string): void => {
    const url = detectPastedUrl(text)
    if (!url) return
    if (probedUrlsRef.current.has(url) || inflightUrlRef.current === url) return
    probedUrlsRef.current.add(url)
    inflightUrlRef.current = url
    const mySeq = ++seqRef.current
    setPreview({ status: 'loading', url })

    const finish = (next: LinkPreviewState): void => {
      if (seqRef.current !== mySeq) return
      inflightUrlRef.current = null
      setPreview(next)
    }

    // fire-and-forget:同步与异步都不向调用方抛(预览失败不阻止发送的结构性前提)。
    void (async () => {
      try {
        const res = await fetchApi<UrlPreviewData>(
          `/api/url-preview/preview?url=${encodeURIComponent(url)}`,
          { timeoutMs: LINK_PREVIEW_TRANSPORT_TIMEOUT_MS },
        )
        if (res.success) {
          const data = res.data
          if (data.status === 'ok') {
            finish({
              status: 'ok',
              url,
              ...(data.title ? { title: data.title } : {}),
              ...(data.description ? { description: data.description } : {}),
              ...(data.icon ? { icon: data.icon } : {}),
            })
          } else if (data.status === 'unavailable') {
            finish({ status: 'unavailable', url, reason: data.reason ?? 'unknown' })
          } else {
            finish({ status: 'undetermined', url, reason: data.reason ?? 'unknown' })
          }
        } else {
          // 传输层失败(4xx/5xx/网络)——我们没判定成,标"未判定"而非"读不到"。
          finish({ status: 'undetermined', url, reason: 'probe_request_failed' })
        }
      } catch {
        finish({ status: 'undetermined', url, reason: 'probe_error' })
      }
    })()
  }, [])

  const reset = React.useCallback((): void => {
    seqRef.current++
    inflightUrlRef.current = null
    setPreview(null)
  }, [])

  return { preview, probeFromPaste, reset }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
