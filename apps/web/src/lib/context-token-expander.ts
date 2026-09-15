// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { getBrowserWorkspaceHandle } from '@/lib/workspace-context-loader'
import { useAiPanelStore } from '@/stores/ai-panel'

/**
 * 发送前上下文引用 token 展开(对标 Trae @目录 / # 语义源,任务 #18):
 * - #Codebase / #Terminal / #Docs(大小写不敏感)
 * - @目录:<路径>(路径不含空格/反引号)
 * 展开块包裹格式对齐 #Rule(<xxx>…</xxx>,store/持久化保留原始用户输入),
 * 展开后 token 不残留。零后端改动,全部在客户端发送前完成。
 *
 * #Terminal 可行性:终端 store(useTerminalStore)仅存会话元数据/pane/命令历史,
 * 实时 xterm 缓冲未通过任何全局 store/访问器暴露(见 stores/terminal.ts),
 * 因此降级注入「(暂无终端输出)」。
 */

const MAX_TREE_CHARS = 8000
const MAX_ENTRIES_PER_DIR = 30
const MAX_DOCS_CHARS = 4000
const TRUNCATE_MARK = '…(已截断)'

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage',
  '__pycache__',
  'target',
  'out',
  '.output',
  'venv',
  'env',
])

const DOCS_FILES = ['CLAUDE.md', 'AGENTS.md', 'README.md'] as const

/** 当前活跃工作区句柄(浏览器端 FileSystemDirectoryHandle,会话级) */
function getActiveWorkspaceHandle(): FileSystemDirectoryHandle | null {
  const ws = useAiPanelStore.getState().activeWorkspace
  if (!ws || !ws.name) return null
  return getBrowserWorkspaceHandle(ws.name)
}

interface DirEntry {
  name: string
  isDir: boolean
}

/** 单层列举(上限 MAX_ENTRIES_PER_DIR,跳过 SKIP_DIRS,目录优先排序) */
async function listEntries(handle: FileSystemDirectoryHandle): Promise<DirEntry[]> {
  const iterable = handle as unknown as { values(): AsyncIterableIterator<FileSystemHandle> }
  const out: DirEntry[] = []
  for await (const entry of iterable.values()) {
    if (entry.kind === 'directory' && SKIP_DIRS.has(entry.name)) continue
    if (out.length >= MAX_ENTRIES_PER_DIR) break
    out.push({ name: entry.name, isDir: entry.kind === 'directory' })
  }
  out.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
  return out.slice(0, MAX_ENTRIES_PER_DIR)
}

/** 2 层目录树摘要(根 + 第 1/2 层),总字符上限 MAX_TREE_CHARS,超限尾部截断标注 */
async function buildDirTree(handle: FileSystemDirectoryHandle, rootName: string): Promise<string> {
  const lines: string[] = [`${rootName}/`]
  let total = rootName.length + 2
  let truncated = false

  const level1 = await listEntries(handle)
  for (const e1 of level1) {
    if (truncated) break
    const line1 = `  ${e1.name}${e1.isDir ? '/' : ''}`
    if (total + line1.length + 1 > MAX_TREE_CHARS) {
      truncated = true
      break
    }
    lines.push(line1)
    total += line1.length + 1
    if (!e1.isDir) continue
    try {
      const sub = await handle.getDirectoryHandle(e1.name)
      const level2 = await listEntries(sub)
      for (const e2 of level2) {
        if (truncated) break
        const line2 = `    ${e2.name}${e2.isDir ? '/' : ''}`
        if (total + line2.length + 1 > MAX_TREE_CHARS) {
          truncated = true
          break
        }
        lines.push(line2)
        total += line2.length + 1
      }
    } catch {
      // 子目录读取失败跳过
    }
  }
  if (truncated) lines.push(TRUNCATE_MARK)
  return lines.join('\n')
}

/** 按相对路径逐段解析子目录句柄(任一分段缺失返回 null) */
async function resolveSubHandle(
  root: FileSystemDirectoryHandle,
  relPath: string,
): Promise<FileSystemDirectoryHandle | null> {
  const segs = relPath.split('/').filter(Boolean)
  let cur: FileSystemDirectoryHandle = root
  for (const seg of segs) {
    try {
      cur = await cur.getDirectoryHandle(seg)
    } catch {
      return null
    }
  }
  return cur
}

async function expandCodebase(): Promise<string> {
  const handle = getActiveWorkspaceHandle()
  if (!handle) return '\n<context_codebase>\n(无活跃工作区)\n</context_codebase>\n'
  const tree = await buildDirTree(handle, handle.name)
  return `\n<context_codebase>\n${tree}\n</context_codebase>\n`
}

async function expandTerminal(): Promise<string> {
  return '\n<context_terminal>\n(暂无终端输出)\n</context_terminal>\n'
}

async function expandDocs(): Promise<string> {
  const handle = getActiveWorkspaceHandle()
  if (!handle) return '\n<context_docs>\n(无活跃工作区)\n</context_docs>\n'
  const parts: string[] = []
  for (const name of DOCS_FILES) {
    try {
      const fileHandle = await handle.getFileHandle(name)
      const file = await fileHandle.getFile()
      const raw = await file.text()
      const body =
        raw.length > MAX_DOCS_CHARS ? `${raw.slice(0, MAX_DOCS_CHARS)}\n${TRUNCATE_MARK}` : raw
      parts.push(`### ${name}\n${body}`)
    } catch {
      // 文件缺失跳过
    }
  }
  const body = parts.length > 0 ? parts.join('\n\n') : '(无文档文件)'
  return `\n<context_docs>\n${body}\n</context_docs>\n`
}

async function expandDirMention(text: string): Promise<string> {
  const re = /@目录:([^\s`]+)/g
  const matches = [...text.matchAll(re)]
  if (matches.length === 0) return text
  const handle = getActiveWorkspaceHandle()
  let result = text
  for (const m of matches) {
    const relPath = m[1] as string
    let block: string
    if (!handle) {
      block = `\n<context_directory path="${relPath}">\n(无活跃工作区)\n</context_directory>\n`
    } else {
      const sub = await resolveSubHandle(handle, relPath)
      if (!sub) {
        block = `\n<context_directory path="${relPath}">\n(目录不存在)\n</context_directory>\n`
      } else {
        const tree = await buildDirTree(sub, relPath)
        block = `\n<context_directory path="${relPath}">\n${tree}\n</context_directory>\n`
      }
    }
    result = result.replace(m[0], block)
  }
  return result
}

/** 异步正则替换(global):对每个匹配调用 fn 生成替换串 */
async function replaceAsync(
  source: string,
  re: RegExp,
  fn: (match: string) => Promise<string>,
): Promise<string> {
  const tasks: Array<Promise<string>> = []
  source.replace(re, (m) => {
    tasks.push(fn(m))
    return ''
  })
  const subs = await Promise.all(tasks)
  let i = 0
  return source.replace(re, () => subs[i++] as string)
}

/**
 * 展开正文中的上下文引用 token(对标 #Rule 的发送前展开姿势):
 * 先处理 @目录:<路径>,再依次处理 #codebase / #terminal / #docs(大小写不敏感)。
 * 返回展开后的文本;若无任何 token 则原样返回。
 */
export async function expandContextTokens(text: string): Promise<string> {
  let result = await expandDirMention(text)
  result = await replaceAsync(result, /#codebase\b/gi, expandCodebase)
  result = await replaceAsync(result, /#terminal\b/gi, expandTerminal)
  result = await replaceAsync(result, /#docs\b/gi, expandDocs)
  return result
}
