// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { fetchApi, fetchRaw } from '@/lib/api'
import type { FileItem } from '@/components/workspace/file-list'
import type { ProjectDetail } from './types'

export const AI_MOCK = {
  diffOld: 'export function auth(token: string) {\n  return verify(token)\n}',
  diffNew:
    'export function auth(token: string): Promise<User> {\n  return verify(token).then(decode)\n}',
  inlineDiff:
    ' export function auth(token) {\n-  return verify(token)\n+  return verify(token).then(decode)\n }',
  tasks: [
    {
      id: 't1',
      title: 'review 认证模块',
      status: 'in-progress' as const,
      priority: 'high' as const,
      assignee: 'Alice',
    },
    { id: 't2', title: '补充 README', status: 'todo' as const, priority: 'low' as const },
  ],
  routines: [
    { id: 'r1', name: '每日构建', schedule: '0 9 * * *', enabled: true, lastRun: '今天 09:00' },
    { id: 'r2', name: '每周清理', schedule: '0 0 * * 0', enabled: false },
  ],
  folders: [
    {
      id: 'f1',
      name: 'src',
      path: '/src',
      children: [
        { id: 'f1-1', name: 'auth', path: '/src/auth' },
        { id: 'f1-2', name: 'utils', path: '/src/utils' },
      ],
    },
    { id: 'f2', name: 'tests', path: '/tests' },
  ],
}

export async function fetchProject(id: string): Promise<ProjectDetail> {
  const res = await fetchApi<{ project: ProjectDetail }>(`/api/workspace/projects/${id}`)
  if (!res.success) throw new Error(res.error)
  return res.data.project
}

export async function fetchFiles(projectId: string): Promise<FileItem[]> {
  const res = await fetchApi<{ files: FileItem[] }>(`/api/workspace/projects/${projectId}/files`)
  if (!res.success) throw new Error(res.error)
  return res.data.files
}

// 2026-09-09 0-5 迁移:uploadFile / downloadFile 改走统一链路,删除旧版直接 fetch。
// 旧豁免理由已过时:共享层 fetchApi 现支持 FormData 透传(client.ts isFormData 检查,
// 不强制 Content-Type,multipart 边界由浏览器生成);二进制走 fetchRaw(自动带鉴权头)。
export async function uploadFile(
  projectId: string,
  file: File,
  errorMsg: string,
): Promise<FileItem> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetchApi<{ file: FileItem }>(`/api/workspace/projects/${projectId}/files`, {
    method: 'POST',
    body: formData,
  })
  // 网关 502 等返回 HTML 错误页时,共享层把响应文本归一为 error message,统一兜底 errorMsg
  if (!res.success || !res.data?.file) throw new Error(res.success ? errorMsg : (res.error || errorMsg))
  return res.data.file
}

export async function downloadFile(file: FileItem, errorMsg: string) {
  const blob = await fetchRaw(`/api/workspace/files/${file.id}`).catch(() => {
    throw new Error(errorMsg)
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export async function removeFile(fileId: string): Promise<void> {
  const res = await fetchApi(`/api/workspace/files/${fileId}`, { method: 'DELETE' })
  if (!res.success) throw new Error(res.error)
}

// 2026-09-08:文件转 Markdown(anydoc 引擎,16 格式)。后端为 POST /api/files/:id/convert-markdown,
// 失败时 422 + code/message 携带具体原因(扫描件需 OCR/文件加密/结构损坏等)。
// 2026-09-08 修复:必须带空 JSON body + Content-Type。生产经 Cloudflare 链路转发后,
// 无 CT 的空 body POST 会被 Fastify 判 415(直连 8801/8802 无法复现);而空 body +
// JSON CT 又因空 body 解析失败 400。实测发 '{}' + JSON CT 全链路 200。
export async function convertFileToMarkdown(fileId: string): Promise<{
  markdown: string
  fileName: string
}> {
  const res = await fetchApi<{ markdown: string; fileName: string }>(
    `/api/files/${fileId}/convert-markdown`,
    { method: 'POST', body: JSON.stringify({}) },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
