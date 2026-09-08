// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器 IDE 人工保存链(2026-09-07 立)
 *
 * 用户在 Monaco 编辑器里改代码后,Ctrl/Cmd+S 要把内容真实落盘到工作区文件。
 * 复用 AI 工具同款写入机制(File System Access API):
 *   - 句柄缓存来自 workspace-context-loader.ts 的 browserHandles(与 AI 工具完全一致),
 *     通过 getBrowserWorkspaceHandle(name) 取回用户授权过的 FileSystemDirectoryHandle。
 *   - 实际写入复用 workspace-tool-executor.ts 的 executeWorkspaceTool('write_file')
 *     (与 AI 工具完全同款 splitPath/ensureDirHandle/getFileHandle/createWritable 路径),
 *     确保人工保存与 AI 写文件行为一致,不另起炉灶。
 *
 * 仅 web 非 Tauri 环境有效:浏览器安全模型下写文件必须依赖用户授权过的 DirectoryHandle。
 * 若当前工作区没有可用句柄(未通过"打开文件夹"授权),返回 no-handle,由调用方优雅提示。
 */

import { getBrowserWorkspaceHandle } from '@/lib/workspace-context-loader'
import { executeWorkspaceTool } from '@/lib/workspace-tool-executor'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useAiPanelStore } from '@/stores/ai-panel'

export interface SaveResult {
  ok: boolean
  /** 失败原因分类 */
  reason?: 'no-handle' | 'write-error' | 'bad-path'
  message?: string
  bytes?: number
}

/** 取路径最后一段(文件夹名),兼容 Windows 反斜杠 */
function basenameOf(p: string): string {
  const norm = p.replace(/\\/g, '/').replace(/\/+$/, '')
  const i = norm.lastIndexOf('/')
  return i === -1 ? norm : norm.slice(i + 1)
}

/**
 * 把编辑器 tab 的 filePath 规整为相对工作区根目录的 POSIX 路径,供 writeFileToHandle 使用。
 *
 * - 已是相对路径(如 src/a.ts)→ 原样返回
 * - 绝对路径且以 workspacePath 为前缀 → 剥离前缀(G:\WS\src\a.ts → src/a.ts)
 * - 反斜杠统一为 /
 */
export function toRelativeWorkspacePath(filePath: string, workspacePath: string): string {
  if (!filePath) return ''
  const p = filePath.replace(/\\/g, '/')
  const ws = (workspacePath ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
  if (ws && (p === ws || p.startsWith(ws + '/'))) {
    return p.slice(ws.length).replace(/^\/+/, '')
  }
  return p
}

/**
 * 解析当前活动工作区的 FileSystemDirectoryHandle。
 *
 * 候选 key 依次尝试(去重、跳过空值),命中即返回:
 *   1. IDE 工作区路径(workspacePath,可能是完整路径或文件夹名)
 *   2. IDE 工作区路径的 basename(浏览器 showDirectoryPicker 仅返回文件夹名)
 *   3. AI 面板当前活动工作区名(与 AI 工具共用同一缓存)
 * 全部未命中返回 null(表示当前不可写)。
 */
export function resolveWorkspaceDirectoryHandle(): FileSystemDirectoryHandle | null {
  const ideWs = useIDEWorkspace.getState().workspacePath ?? ''
  const aiName = useAiPanelStore.getState().activeWorkspace?.name ?? ''
  const candidates = Array.from(new Set([ideWs, basenameOf(ideWs), aiName].filter(Boolean)))
  for (const key of candidates) {
    const handle = getBrowserWorkspaceHandle(key)
    if (handle) return handle
  }
  return null
}

/**
 * 把编辑器内容保存到工作区文件。
 *
 * @param filePath 编辑器 tab 的文件路径(相对或绝对均可)
 * @param content  待写入的文件内容
 * @returns SaveResult — ok=true 表示落盘成功;否则 reason 区分 no-handle / write-error / bad-path
 */
export async function saveWorkspaceTextFile(
  filePath: string,
  content: string,
): Promise<SaveResult> {
  const handle = resolveWorkspaceDirectoryHandle()
  if (!handle) {
    return {
      ok: false,
      reason: 'no-handle',
      message: '当前工作区未授权本地文件写入(缺少 DirectoryHandle)',
    }
  }
  const wsPath = useIDEWorkspace.getState().workspacePath ?? ''
  const rel = toRelativeWorkspacePath(filePath, wsPath)
  if (!rel) {
    return { ok: false, reason: 'bad-path', message: '无法解析目标文件路径' }
  }
  try {
    const { error } = await executeWorkspaceTool('write_file', { path: rel, content }, handle)
    if (error) return { ok: false, reason: 'write-error', message: error }
    return { ok: true, bytes: content.length }
  } catch (err) {
    return { ok: false, reason: 'write-error', message: (err as Error).message }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
