// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 代码块「应用到工作区文件」执行链(P0-2,2026-09-12 立)
 *
 * 职责:
 *  - 读取目标文件旧内容(优先浏览器 DirectoryHandle,回退 IDE fetchFileContent API/Tauri 路径)
 *  - 调 POST /api/v1/ai/apply-diff 写入(与 InlineDiffCard Accept 完全同款后端沙箱+权限校验链路)
 *    后端对「文件不存在」场景本就跳过 oldContent 校验并 createDirs 新建(v1-apply-diff.ts:110-119)
 *  - 成功后把文件在 IDE 编辑器打开(openFile + setActiveTopTab('editor'))
 *
 * 与 use-apply-diff.ts 的关系:同款后端端点与权限链路,但本模块服务于
 * MarkdownStream 代码块(无 message/toolCall 上下文),不走 chat store 的
 * setToolCallApplyStatus,状态由调用方(CodeBlockActionButton)本地管理。
 */

import { fetchApi } from '@/lib/api'
import { executeWorkspaceTool } from '@/lib/workspace-tool-executor'
import { resolveWorkspaceDirectoryHandle, toRelativeWorkspacePath } from '@/lib/workspace-file-save'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { useAiPanelStore } from '@/stores/ai-panel'
import { EXT_LANG } from '@/stores/ide-workspace'
import { toast } from '@/components/common'

/** 从代码块语言标记推断默认文件名(无明确文件名时兜底) */
const LANG_EXT: Record<string, string> = {
  typescript: 'ts',
  ts: 'ts',
  tsx: 'tsx',
  javascript: 'js',
  js: 'js',
  jsx: 'jsx',
  python: 'py',
  py: 'py',
  go: 'go',
  rust: 'rs',
  rs: 'rs',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'cs',
  cs: 'cs',
  php: 'php',
  ruby: 'rb',
  rb: 'rb',
  swift: 'swift',
  kotlin: 'kt',
  kt: 'kt',
  shell: 'sh',
  bash: 'sh',
  sh: 'sh',
  sql: 'sql',
  html: 'html',
  css: 'css',
  scss: 'scss',
  json: 'json',
  yaml: 'yml',
  yml: 'yml',
  markdown: 'md',
  md: 'md',
  vue: 'vue',
  svelte: 'svelte',
}

/** 从代码块首行注释中探测文件名(如 "// app.ts" / "# main.py" / 块注释包住的 "index.css") */
export function detectFileNameFromCode(code: string, language?: string): string {
  const firstLine = (code.split('\n')[0] ?? '').trim()
  // 单行注释后跟路径样式的 token:xxx.ext / xxx/yyy.ext
  const m = firstLine.match(/^(?:\/\/|#|\/\*|--|<!--)\s*([\w./-]+\.[A-Za-z0-9]+)\s*(?:\*\/)?$/)
  if (m?.[1]) return m[1]
  // 退化:无注释,直接看首行是不是路径样式 token
  const bare = firstLine.match(/^([\w./-]+\.[A-Za-z0-9]+)$/)
  if (bare?.[1]) return bare[1]
  // 兜底:按语言给默认名
  const ext = LANG_EXT[(language ?? '').toLowerCase()] ?? 'txt'
  return `snippet.${ext}`
}

interface ApplyDiffResponse {
  applied: boolean
  path: string
}

export interface ApplyCodeBlockResult {
  ok: boolean
  /** 成功时返回落盘路径(相对工作区) */
  path?: string
  error?: string
}

/** 解析当前活动工作区路径(AI 面板绑定优先,回退 IDE 工作区) */
function resolveWorkspacePath(): string | null {
  const aiWs = useAiPanelStore.getState().activeWorkspace?.path
  if (aiWs) return aiWs
  const ideWs = useIDEWorkspace.getState().workspacePath
  return ideWs || null
}

/** 读文件旧内容:优先浏览器 handle,回退 IDE fetchFileContent(API/Tauri) */
async function readOldContent(relPath: string): Promise<string | null> {
  const handle = resolveWorkspaceDirectoryHandle()
  if (handle) {
    const { result, error } = await executeWorkspaceTool('read_file', { path: relPath }, handle)
    if (error === null && result !== null) return result
    return null // 文件不存在或读失败 → 视为新建
  }
  // 无浏览器 handle:走 IDE 的 API/Tauri 读文件路径
  const ideWs = useIDEWorkspace.getState()
  if (!ideWs.workspacePath) return null
  const content = await ideWs.fetchFileContent(relPath)
  return content || null
}

/**
 * 应用代码块内容到工作区文件。
 *
 * @param code 代码块内容
 * @param language 代码块语言标记(```ts 等)
 * @param fileNameOverride 用户显式指定的文件名(探测失败时允许 CodeBlock 输入框指定)
 */
export async function applyCodeBlockToFile(
  code: string,
  language?: string,
  fileNameOverride?: string,
): Promise<ApplyCodeBlockResult> {
  const workspacePath = resolveWorkspacePath()
  if (!workspacePath) {
    toast.error('未绑定工作区', {
      description: '请先在 AI 面板或 IDE 打开本地文件夹,才能应用代码块',
    })
    return { ok: false, error: 'no-workspace' }
  }

  const fileName = fileNameOverride || detectFileNameFromCode(code, language)
  const rel = toRelativeWorkspacePath(fileName, workspacePath)
  if (!rel || rel.startsWith('../') || rel.includes('/../')) {
    return { ok: false, error: 'bad-path' }
  }

  // 读旧内容(拿不到视为新建,old_content 传空,后端跳过一致性校验)
  const oldContent = (await readOldContent(rel)) ?? ''

  try {
    const r = await fetchApi<ApplyDiffResponse>('/api/v1/ai/apply-diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: rel,
        oldContent,
        newContent: code,
        workspacePath,
      }),
    })
    if (!r.success || !r.data?.applied) {
      const msg = r.error ?? '服务端未应用改动'
      toast.error('应用失败', { description: msg })
      return { ok: false, error: msg }
    }
    // 成功:在 IDE 打开该文件(复用 LSP 跳转同款 FileNode 构造)
    const ide = useIDEWorkspace.getState()
    const name = rel.split('/').pop() ?? rel
    const ext = name.includes('.') ? (name.split('.').pop() ?? '') : ''
    ide.openFile({
      id: rel,
      name,
      path: rel,
      type: 'file',
      language: EXT_LANG[ext] ?? 'text',
    })
    ide.setActiveTopTab('editor')
    toast.success('已应用到文件', { description: rel })
    return { ok: true, path: rel }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    toast.error('应用失败', { description: msg })
    return { ok: false, error: msg }
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
