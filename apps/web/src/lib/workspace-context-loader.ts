/**
 * 浏览器端工作区上下文加载器(2026-08-02 立)
 *
 * 浏览器安全模型限制:showDirectoryPicker 只返回 FileSystemDirectoryHandle,
 * 不暴露真实绝对路径。ai-service 在远程服务器上无法访问用户本地文件系统。
 *
 * 本模块用 FileSystemDirectoryHandle 在浏览器端遍历读取工作区关键文件,
 * 把内容通过 workspaceContext 字段传给后端,注入 system prompt。
 * 这样 LLM 能"看到"工作区文件内容,无需调用 read_file 工具。
 *
 * 仅在 web 非 Tauri 环境下使用;Tauri 桌面端走 workspacePath 真实路径。
 */

// 会话级 handle 存储(刷新页面后丢失,需用户重新选择工作区)
const browserHandles = new Map<string, FileSystemDirectoryHandle>()

/** 保存浏览器端工作区 handle(用户选文件夹后调用) */
export function saveBrowserWorkspaceHandle(name: string, handle: FileSystemDirectoryHandle): void {
  browserHandles.set(name, handle)
}

/** 获取浏览器端工作区 handle(不存在返回 null) */
export function getBrowserWorkspaceHandle(name: string): FileSystemDirectoryHandle | null {
  return browserHandles.get(name) ?? null
}

/** 清除浏览器端工作区 handle(切换/移除工作区时调用) */
export function clearBrowserWorkspaceHandle(name: string): void {
  browserHandles.delete(name)
}

// =============================================================================
// 文件遍历与读取
// =============================================================================

/** 关键文件名(优先读取,注入 system prompt) */
const PRIORITY_FILES = [
  'CLAUDE.md',
  'AGENTS.md',
  '.cursorrules',
  '.windsurfrules',
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'tsconfig.json',
  'README.md',
  'README.zh.md',
  'README.zh-CN.md',
  'README.en.md',
] as const

const PRIORITY_FILES_SET = new Set<string>(PRIORITY_FILES)

/** 文本文件扩展名(用于判断是否读取内容) */
const TEXT_EXTENSIONS = new Set([
  '.md',
  '.txt',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.cfg',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.kt',
  '.swift',
  '.css',
  '.scss',
  '.less',
  '.html',
  '.vue',
  '.svelte',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.sql',
  '.graphql',
  '.proto',
  '.env.example',
  '.gitignore',
])

/** 跳过的目录名(不遍历,避免 node_modules/.git 等噪音) */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'env',
  'target',
  '.cargo',
  '.idea',
  '.vscode',
  'out',
  '.output',
])

/** 单文件大小上限(50KB,超出跳过) */
const MAX_FILE_SIZE = 50 * 1024
/** 总 context 大小上限(2MB,超出截断) */
const MAX_TOTAL_SIZE = 2 * 1024 * 1024
/** 目录遍历最大深度(覆盖绝大多数项目结构) */
const MAX_DEPTH = 8
/** 目录遍历最大条目数(避免超大项目卡死) */
const MAX_ENTRIES = 2000

/** agent 规则文件名(任意目录层级都会被读取) */
const AGENT_FILE_NAMES = new Set(['AGENTS.md', 'CLAUDE.md', 'agent.md', 'claude.md'])

interface LoadedFile {
  path: string
  content: string
  size: number
}

export interface WorkspaceContextResult {
  /** 格式化后的 context 字符串(注入 system prompt) */
  text: string
  /** 统计信息 */
  stats: {
    fileCount: number
    totalSize: number
    truncated: boolean
  }
}

/**
 * 遍历工作区目录,读取关键文件内容,返回格式化的 context 字符串。
 *
 * 策略:
 *   1. 优先读取 PRIORITY_FILES(CLAUDE.md/AGENTS.md/package.json/README 等)
 *   2. 遍历目录树(限制深度 + 条目数),读取小文本文件内容
 *   3. 总大小超 500KB 截断
 *
 * 返回的 text 格式:
 *   <workspace_files name="xxx">
 *   ## 目录结构
 *   src/components/...
 *
 *   ## 文件内容
 *   ### CLAUDE.md
 *   <content>
 *   </workspace_files>
 */
export async function loadWorkspaceContext(
  handle: FileSystemDirectoryHandle,
): Promise<WorkspaceContextResult> {
  const files: LoadedFile[] = []
  let totalSize = 0
  let truncated = false
  let entryCount = 0
  const tree: string[] = []

  // 1. 优先读取关键文件(根目录)
  for (const fileName of PRIORITY_FILES) {
    if (totalSize >= MAX_TOTAL_SIZE) {
      truncated = true
      break
    }
    try {
      const fileHandle = await handle.getFileHandle(fileName)
      const file = await fileHandle.getFile()
      if (file.size > MAX_FILE_SIZE) continue
      const content = await file.text()
      files.push({ path: fileName, content, size: file.size })
      totalSize += file.size
    } catch {
      // 文件不存在,跳过
    }
  }

  // 2. 遍历目录树,读取文本文件
  await walkDir(handle, '', 0, async (entryPath, fileHandle) => {
    if (truncated || entryCount >= MAX_ENTRIES) {
      truncated = true
      return
    }
    entryCount++
    tree.push(entryPath)

    // agent 规则文件(AGENTS.md/CLAUDE.md 等)不受总大小限制,任意目录层级必读
    const baseName = entryPath.slice(entryPath.lastIndexOf('/') + 1)
    const isAgentFile = AGENT_FILE_NAMES.has(baseName)

    if (!isAgentFile && totalSize >= MAX_TOTAL_SIZE) {
      truncated = true
      return
    }

    // 跳过已在 PRIORITY_FILES 中读取的根目录文件
    if (PRIORITY_FILES_SET.has(entryPath)) return

    // 判断是否文本文件
    const ext = getExtension(entryPath)
    if (!TEXT_EXTENSIONS.has(ext)) return

    try {
      const file = await fileHandle.getFile()
      if (file.size > MAX_FILE_SIZE) return
      const content = await file.text()
      files.push({ path: entryPath, content, size: file.size })
      totalSize += file.size
    } catch {
      // 读取失败,跳过
    }
  })

  // 3. 格式化输出
  const parts: string[] = []
  parts.push(`<workspace_files name="${escapeHtml(handle.name)}">`)

  // 目录结构
  if (tree.length > 0) {
    parts.push('## 目录结构')
    parts.push(tree.slice(0, 500).join('\n'))
    if (tree.length > 500) {
      parts.push(`... (共 ${tree.length} 个文件,已截断)`)
    }
  }

  // 文件内容(agent 规则文件排最前,便于提取)
  if (files.length > 0) {
    parts.push('\n## 文件内容')
    const sorted = [...files].sort((a, b) => {
      const aAgent = AGENT_FILE_NAMES.has(a.path.slice(a.path.lastIndexOf('/') + 1)) ? 0 : 1
      const bAgent = AGENT_FILE_NAMES.has(b.path.slice(b.path.lastIndexOf('/') + 1)) ? 0 : 1
      return aAgent - bAgent
    })
    for (const f of sorted) {
      parts.push(`\n### ${f.path}`)
      parts.push('```')
      parts.push(f.content)
      parts.push('```')
    }
  }

  if (truncated) {
    parts.push('\n(工作区文件较多,已截断,仅加载部分文件)')
  }

  parts.push('</workspace_files>')

  return {
    text: parts.join('\n'),
    stats: {
      fileCount: files.length,
      totalSize,
      truncated,
    },
  }
}

// =============================================================================
// 内部工具
// =============================================================================

function getExtension(path: string): string {
  const idx = path.lastIndexOf('.')
  if (idx < 0) return ''
  return path.slice(idx).toLowerCase()
}

function escapeHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return c
    }
  })
}

/**
 * 递归遍历目录,对每个文件调用 callback。
 * 限制深度 + 跳过 SKIP_DIRS。
 *
 * FileSystemDirectoryHandle.values() 是 W3C File System Access API 标准,
 * 现代浏览器(Chrome 86+/Edge 86+)支持,但 TS lib.dom.d.ts 类型定义不完整,
 * 用类型断言访问。
 */
async function walkDir(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  depth: number,
  callback: (path: string, fileHandle: FileSystemFileHandle) => Promise<void>,
): Promise<void> {
  if (depth >= MAX_DEPTH) return

  // TS lib.dom.d.ts 未声明 values(),用类型断言访问标准 API
  const iterable = dirHandle as unknown as {
    values(): AsyncIterableIterator<FileSystemHandle>
  }
  for await (const entry of iterable.values()) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(entry.name)) continue
      await walkDir(entry as FileSystemDirectoryHandle, entryPath, depth + 1, callback)
    } else if (entry.kind === 'file') {
      await callback(entryPath, entry as FileSystemFileHandle)
    }
  }
}

// =============================================================================
// 缓存失效:agent 规则文件签名
// =============================================================================

/** agent 规则文件签名(mtime + size,用于检测变更触发重索引) */
export interface AgentFileSignature {
  path: string
  lastModified: number
  size: number
}

/**
 * 轻量收集工作区内所有 agent 规则文件的签名(不读文件内容)。
 * 用于缓存命中前校验:文件有增删改(mtime/size/路径集合变化)则触发全量重索引。
 */
export async function collectAgentFileSignatures(
  handle: FileSystemDirectoryHandle,
): Promise<AgentFileSignature[]> {
  const sigs: AgentFileSignature[] = []
  await walkDir(handle, '', 0, async (entryPath, fileHandle) => {
    const baseName = entryPath.slice(entryPath.lastIndexOf('/') + 1)
    if (!AGENT_FILE_NAMES.has(baseName)) return
    try {
      const file = await fileHandle.getFile()
      sigs.push({ path: entryPath, lastModified: file.lastModified, size: file.size })
    } catch {
      // 读取失败,跳过
    }
  })
  sigs.sort((a, b) => a.path.localeCompare(b.path))
  return sigs
}

/** 比较两份签名是否一致(路径集合 + mtime + size 全等) */
export function agentSignaturesEqual(a: AgentFileSignature[], b: AgentFileSignature[]): boolean {
  if (a.length !== b.length) return false
  return a.every((s, i) => {
    const other = b[i]
    return (
      !!other &&
      s.path === other.path &&
      s.lastModified === other.lastModified &&
      s.size === other.size
    )
  })
}
