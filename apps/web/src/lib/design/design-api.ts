/**
 * Design 模式 API 封装(2026-07-23 立,对标 TRAE Work Design 模式)。
 *
 * 三个能力:
 *  1. 评论持久化:POST /design/comments + GET /design/comments/:previewId
 *  2. AI 生成 HTML:POST /ai/llm/chat(代理到 ai-service /api/llm/complete)
 *  3. 预览保存/列表:POST /design/preview + GET /design/previews(已有,封装为函数)
 *
 * 复用 @/lib/api 的 fetchApi(自动注入 token + base url + 重试 + 熔断)。
 */
import { fetchApi } from '@/lib/api'
import type { DesignComment, DesignPreview, DesignPreviewResponse } from '@ihui/shared'
import { deriveComponentName, exportCode as convertCode } from './code-exporter'

export type { ExportFormat } from './code-exporter'

/** GET /design/comments/:previewId 返回结构。 */
interface DesignCommentsResponse {
  comments: DesignComment[]
  total: number
}

/** GET /design/previews 返回结构。 */
interface DesignPreviewsResponse {
  previews: DesignPreview[]
  total: number
}

/** 列出指定预览的所有评论(最新在头部)。 */
export async function listComments(previewId: string): Promise<DesignComment[]> {
  const res = await fetchApi<DesignCommentsResponse>(`/design/comments/${encodeURIComponent(previewId)}`)
  if (res.success) return res.data.comments ?? []
  throw new Error(res.error)
}

/** 新增评论(持久化到 Redis List)。elementId 可选,用于关联画布元素。 */
export async function createComment(
  previewId: string,
  content: string,
  elementId?: string,
): Promise<DesignComment> {
  const res = await fetchApi<DesignComment>('/design/comments', {
    method: 'POST',
    body: JSON.stringify({ previewId, content, elementId }),
  })
  if (res.success) return res.data
  throw new Error(res.error)
}

/** 列出当前用户所有预览。 */
export async function listPreviews(): Promise<DesignPreview[]> {
  const res = await fetchApi<DesignPreviewsResponse>('/design/previews')
  if (res.success) return res.data.previews ?? []
  throw new Error(res.error)
}

/** 保存预览。 */
export async function savePreview(name: string, html: string): Promise<DesignPreview> {
  const res = await fetchApi<DesignPreviewResponse>('/design/preview', {
    method: 'POST',
    body: JSON.stringify({ name, html }),
  })
  if (res.success) return res.data.preview
  throw new Error(res.error)
}

/** ai-service /api/llm/complete 返回结构(经 /ai/llm/chat 代理)。 */
interface LlmCompleteResult {
  content?: string
  [k: string]: unknown
}

/**
 * 调 LLM 生成完整 HTML 页面。
 *
 * 走 /ai/llm/chat(apps/api 代理到 ai-service /api/llm/complete),复用项目已有 LLM 链路。
 * prompt 模板:要求 LLM 只返回 HTML 代码,不带 markdown 代码块标记。
 *
 * @param userPrompt 用户自然语言描述(如"一个登录页,带用户名密码输入框")
 * @returns 纯 HTML 字符串(已剥离 markdown 代码块标记)
 */
export async function generateHtml(userPrompt: string): Promise<string> {
  const systemPrompt =
    'You are a frontend engineer. Generate a complete, self-contained HTML page with inline CSS for the user request. Return ONLY raw HTML code, no markdown fences, no explanations.'
  const res = await fetchApi<LlmCompleteResult>('/ai/llm/chat', {
    method: 'POST',
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  if (!res.success) throw new Error(res.error)
  const raw = res.data.content ?? ''
  return stripCodeFence(raw)
}

/** 剥离 LLM 输出中可能裹挟的 markdown 代码块标记(```html ... ```)。 */
function stripCodeFence(text: string): string {
  let s = text.trim()
  // 匹配开头的 ```html / ```htm / ``` 等
  const openMatch = s.match(/^```[a-zA-Z]*\s*\n?/)
  if (openMatch) {
    s = s.slice(openMatch[0].length)
  }
  // 匹配结尾的 ```
  if (s.endsWith('```')) {
    s = s.slice(0, -3)
  }
  return s.trim()
}

/**
 * 导出代码:把画布 HTML 转为 React/Vue/HTML 组件代码并触发浏览器下载。
 *
 * 纯前端转换,无需后端 API。组件名从 previewName 派生(PascalCase),
 * 非 ASCII 回退到 DesignComponent。
 *
 * @param format 导出格式 'react' | 'vue' | 'html'
 * @param html 画布 HTML 字符串(iframe srcDoc 的用户 HTML 部分)
 * @param previewName 预览名(派生组件名用)
 * @returns 下载文件名
 */
export async function exportCode(
  format: 'react' | 'vue' | 'html',
  html: string,
  previewName: string,
): Promise<{ filename: string }> {
  const componentName = deriveComponentName(previewName)
  const result = convertCode({ format, componentName, html })
  triggerDownload(result.filename, result.content)
  return { filename: result.filename }
}

/** 浏览器下载:Blob + URL.createObjectURL + a.click()。 */
function triggerDownload(filename: string, content: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
