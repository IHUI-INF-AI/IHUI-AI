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
  /** 机器可判原因(unavailable/undetermined 携带;ok 缺省)。 */
  reason?: string
}

/** 后端 data 形态(status=ok 与另两态字段不同)。 */
interface UrlPreviewData {
  status: 'ok' | 'unavailable' | 'undetermined'
  url: string
  title?: string
  description?: string
  reason?: string
}

/** http(s) 链接识别:取粘贴文本里第一条(宽松边界,尾随标点在剪掉一步处理)。 */
const URL_DETECT_RE = /https?:\/\/[^\s<>"'`]+/i
/** 尾随标点:中英句读/括号在 URL 语义外(如"看下 https://a.com/b。"),剪掉。 */
const TRAILING_PUNCT_RE = /[.,;:!?\u3002\uFF0C\uFF1B\uFF1A\uFF01\uFF1F\u3001\u3009\u300B)\]}]+$/u

/** 从粘贴文本提取第一条 http(s) 链接;没有则 null。纯函数(测试与 hook 共用,禁止第二份)。 */
export function detectPastedUrl(text: string): string | null {
  if (!text) return null
  const m = URL_DETECT_RE.exec(text)
  if (!m || !m[0]) return null
  const trimmed = m[0].replace(TRAILING_PUNCT_RE, '')
  // 剪完协议头后必须还有主机字符(" http:// "本身不算链接)。
  return /^https?:\/\/\S+/i.test(trimmed) ? trimmed : null
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

  const probeFromPaste = React.useCallback((text: string): void => {
    const url = detectPastedUrl(text)
    if (!url) return
    if (probedUrlsRef.current.has(url) || inflightUrlRef.current === url) return
    probedUrlsRef.current.add(url)
    inflightUrlRef.current = url
    setPreview({ status: 'loading', url })

    const finish = (next: LinkPreviewState): void => {
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
    setPreview(null)
  }, [])

  return { preview, probeFromPaste, reset }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
