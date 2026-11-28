// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区工具执行器的**唯一实现**(2026-09-28 由 `apps/web/src/lib/workspace-tool-executor.ts`
 * 逐字搬入,票㉑;原路径降为 re-export 包装)。
 *
 * 搬家的判据不是"看起来该复用",而是这条链的服务端条件:
 * `apps/ai-service/app/routers/llm.py` 的委托分支是 `if req.workspace_context and tool_name in _FS_DEPENDENT_TOOLS`
 * —— 只要请求带了 `workspace_context`,fs 类工具就**不在服务端执行**,而是发 tool-delegate 帧回客户端。
 * 于是"谁能执行"由端决定,而"执行成语义是什么"(12 个 case 的参数名、报错文案、只替换第一处、
 * 1MB 截断、SKIP_DIRS 清单)必须是**一份**。留在 web 里,第二个端要么抄一份(必漂),要么不接(=单端能力)。
 *
 * 本文件刻意不含任何宿主专有 API:全文只用 `FileSystemDirectoryHandle` 与其方法,
 * 因此 web(浏览器 / Tauri 降级)与扩展侧栏(chrome-extension://,实测同样暴露 FSA)可直接共用。
 */

import {
  applyHumanEdit,
  recordAiAttribution,
  type AttributionOrigin,
  type AttributionRange,
  type LineAttribution,
} from '../attribution'

/**
 * 浏览器端工具执行代理(2026-08-02 立,阶段 2)
 *
 * web 非 Tauri 环境下,ai-service 在远程服务器无法访问用户本地文件,
 * 当 LLM 调用 fs 类工具(read_file/search_codebase 等)时,ai-service 通过
 * SSE tool-delegate 事件委托前端执行,前端用 FileSystemDirectoryHandle 读取/写入文件,
 * 通过 POST API 回传结果给 ai-service,恢复 tool loop。
 *
 * 与 workspace-context-loader.ts(阶段 1)的关系:
 *   - 阶段 1:LLM 启动前预加载工作区文件内容到 system prompt(一次性)
 *   - 阶段 2:LLM 在 tool loop 中按需调用 fs 工具,前端实时执行回传
 *   - 两者互补:阶段 1 提供"预览",阶段 2 提供"按需读/写"
 */

export interface ToolExecutionResult {
  result: string | null
  error: string | null
}

/**
 * 落盘归因的上下文(可选):AI 工具写文件时,由调用方注入溯源信息与既有记录。
 * 归因**只认实际 diff** —— 下方 toolWriteFile 在写之前先读旧内容,写之后用 recordAiAttribution
 * 对比前后真实内容;人工保存(mode='human')走 applyHumanEdit,把被改动的 AI 行翻成 ai-then-human。
 * 归因失败绝不影响写入本身(仅回调,不抛)。
 */
export interface AttributionTrace {
  origin: AttributionOrigin
  /** 'ai'(默认)= 工具写入; 'human' = 用户手动保存 */
  mode?: 'ai' | 'human'
  /** 该文件既有的归因记录(无则空数组) */
  records?: readonly LineAttribution[]
  /** 写入成功后回传新记录(压缩区间),调用方负责持久化 */
  onRecord?: (
    ranges: AttributionRange[],
    info: { filePath: string; before: string; after: string },
  ) => void
}

const MAX_FILE_SIZE = 1024 * 1024 // 1MB
const MAX_SEARCH_RESULTS = 50

/**
 * 运营内容工具(公告/轮播)的端侧操作面(G-17,2026-11-28)。
 *
 * 本文件刻意不含宿主专有 API,所以 admin 端点的 HTTP 调用由消费方注入:
 * web 侧在 apps/web/src/lib/admin-content-ops.ts 用 @ihui/api-client 组装,
 * RN/桌面将来接同一接口即可复用全部 case。函数返回统一 outcome,由
 * toolAdminContent 转成 ToolExecutionResult(result=JSON 序列化的 data)。
 */
export interface AdminContentOpOutcome {
  ok: boolean
  data?: unknown
  message?: string
}

/** 列表查询参数:全部是可上 query string 的原始值(与 api-client PageQuery 对齐)。 */
export type AdminContentQuery = Record<string, string | number | boolean | undefined>

export interface AdminContentOps {
  listAnnouncements(query?: AdminContentQuery): Promise<AdminContentOpOutcome>
  createAnnouncement(body: Record<string, unknown>): Promise<AdminContentOpOutcome>
  updateAnnouncement(id: string, body: Record<string, unknown>): Promise<AdminContentOpOutcome>
  listCarousels(query?: AdminContentQuery): Promise<AdminContentOpOutcome>
  createCarousel(body: Record<string, unknown>): Promise<AdminContentOpOutcome>
  updateCarousel(id: string, body: Record<string, unknown>): Promise<AdminContentOpOutcome>
}

/** 运营内容委托工具名(与 ai-service llm.py::_ADMIN_DELEGATE_TOOLS 同清单,守门对账)。 */
export const ADMIN_CONTENT_TOOL_NAMES: readonly string[] = [
  'announce_list',
  'announce_create',
  'announce_update',
  'carousel_list',
  'carousel_create',
  'carousel_update',
]

function pickString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key]
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function pickBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const v = args[key]
  return typeof v === 'boolean' ? v : undefined
}

function pickNumber(args: Record<string, unknown>, key: string): number | undefined {
  const v = args[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}
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
  '.venv',
  'venv',
  'target',
  '.cargo',
  '.idea',
  '.vscode',
  'out',
  '.output',
])

export async function executeWorkspaceTool(
  toolName: string,
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
  attribution?: AttributionTrace,
): Promise<ToolExecutionResult> {
  try {
    switch (toolName) {
      case 'read_file':
        return await toolReadFile(args, handle)
      case 'write_file':
        return await toolWriteFile(args, handle, attribution)
      case 'file_edit':
        return await toolFileEdit(args, handle, attribution)
      case 'file_search':
        return await toolFileSearch(args, handle)
      case 'search_codebase':
        return await toolSearchCodebase(args, handle)
      case 'list_files':
        return await toolListFiles(args, handle)
      case 'apply_patch':
        return await toolApplyPatch(args, handle, attribution)
      case 'create_file':
        return await toolWriteFile(args, handle, attribution)
      case 'delete_file':
        return await toolDeleteFile(args, handle)
      case 'move_file':
        return await toolMoveFile(args, handle)
      case 'analyze_code':
        return await toolReadFile(args, handle)
      case 'generate_test':
        return await toolReadFile(args, handle)
      default:
        return { result: null, error: `浏览器端不支持工具: ${toolName}` }
    }
  } catch (err) {
    return { result: null, error: (err as Error).message }
  }
}

/**
 * 运营内容工具的**唯一委托入口**(G-17,2026-11-28)。
 *
 * 与 executeWorkspaceTool 分立的原因:fs 类工具依赖 FileSystemDirectoryHandle
 * (必须有活跃工作区),而运营内容工具走用户本人会话调 admin 端点,**不依赖工作区
 * 句柄** —— llm.py 的 _ADMIN_DELEGATE_TOOLS 分支在纯聊天(无 workspace_context)
 * 时也会发 tool-delegate。两族工具的执行前提不同,合用一个入口会把"无工作区"
 * 错杀到运营内容工具上(web 调用点在无工作区时提前报错返回)。判据与
 * executeWorkspaceTool 同一份文件、同一个单源纪律(镜像测试只锁 executeWorkspaceTool
 * 恰好一次,本入口是第二工具族的并列单源,不复制其判据)。
 */
export async function executeAdminContentTool(
  toolName: string,
  args: Record<string, unknown>,
  adminOps?: AdminContentOps,
): Promise<ToolExecutionResult> {
  try {
    return await toolAdminContent(toolName, args, adminOps)
  } catch (err) {
    return { result: null, error: (err as Error).message }
  }
}

// =============================================================================
// 工具实现
// =============================================================================

async function toolReadFile(
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
): Promise<ToolExecutionResult> {
  const path = typeof args.path === 'string' ? args.path : ''
  if (!path) return { result: null, error: 'read_file: path 参数缺失' }
  try {
    const fileHandle = await resolveFileHandle(handle, path)
    const file = await fileHandle.getFile()
    if (file.size > MAX_FILE_SIZE) {
      return {
        result: null,
        error: `read_file: 文件过大(${file.size} bytes > ${MAX_FILE_SIZE} bytes)`,
      }
    }
    const content = await file.text()
    return { result: content, error: null }
  } catch (err) {
    return { result: null, error: `read_file: ${(err as Error).message}` }
  }
}

async function toolWriteFile(
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
  attribution?: AttributionTrace,
): Promise<ToolExecutionResult> {
  const path = typeof args.path === 'string' ? args.path : ''
  const content = typeof args.content === 'string' ? args.content : ''
  if (!path) return { result: null, error: 'write_file: path 参数缺失' }
  try {
    // 归因必须在写之前取旧内容:之后对比真实前后文本,才能只标记实际改动的行
    let before: string | null = null
    if (attribution?.onRecord) {
      const prior = await toolReadFile({ path }, handle)
      before = prior.error ? '' : (prior.result ?? '')
    }
    const { dir, name } = splitPath(path)
    const dirHandle = dir ? await ensureDirHandle(handle, dir) : handle
    const fileHandle = await dirHandle.getFileHandle(name, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(content)
    await writable.close()
    if (attribution?.onRecord && before !== null) {
      try {
        const ranges =
          attribution.mode === 'human'
            ? applyHumanEdit(attribution.records ?? [], before, content, {
                at: attribution.origin.at,
                filePath: path,
              })
            : recordAiAttribution(attribution.records ?? [], before, content, attribution.origin, {
                filePath: path,
              })
        attribution.onRecord(ranges, { filePath: path, before, after: content })
      } catch {
        // 归因是旁路:记录失败不得让一次已经成功的写盘变成失败
      }
    }
    return { result: `已写入 ${path}(${content.length} 字符)`, error: null }
  } catch (err) {
    return { result: null, error: `write_file: ${(err as Error).message}` }
  }
}

async function toolFileEdit(
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
  attribution?: AttributionTrace,
): Promise<ToolExecutionResult> {
  const path = typeof args.path === 'string' ? args.path : ''
  const oldString = typeof args.old_string === 'string' ? args.old_string : ''
  const newString = typeof args.new_string === 'string' ? args.new_string : ''
  if (!path) return { result: null, error: 'file_edit: path 参数缺失' }
  if (!oldString) return { result: null, error: 'file_edit: old_string 参数缺失' }

  const readResult = await toolReadFile(args, handle)
  if (readResult.error || readResult.result === null) {
    return { result: null, error: `file_edit: 读取原文件失败 - ${readResult.error}` }
  }
  const original = readResult.result
  if (!original.includes(oldString)) {
    return { result: null, error: 'file_edit: old_string 在文件中未找到' }
  }
  // replace 仅替换第一处(与 codex file_edit 语义一致;若需全替换可由 LLM 多次调用)
  const updated = original.replace(oldString, newString)
  return await toolWriteFile({ path, content: updated }, handle, attribution)
}

async function toolFileSearch(
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
): Promise<ToolExecutionResult> {
  const query = typeof args.query === 'string' ? args.query : ''
  const pathPrefix = typeof args.path === 'string' ? args.path : ''
  if (!query) return { result: null, error: 'file_search: query 参数缺失' }
  try {
    const root = pathPrefix ? await resolveDirHandle(handle, pathPrefix) : handle
    const matches: string[] = []
    const lowerQuery = query.toLowerCase()
    await walkFiles(root, pathPrefix, async (entryPath) => {
      if (matches.length >= MAX_SEARCH_RESULTS) return
      if (entryPath.toLowerCase().includes(lowerQuery)) {
        matches.push(entryPath)
      }
    })
    if (matches.length === 0) {
      return { result: '未找到匹配文件', error: null }
    }
    return { result: matches.join('\n'), error: null }
  } catch (err) {
    return { result: null, error: `file_search: ${(err as Error).message}` }
  }
}

async function toolSearchCodebase(
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
): Promise<ToolExecutionResult> {
  const query = typeof args.query === 'string' ? args.query : ''
  const pathPrefix = typeof args.path === 'string' ? args.path : ''
  if (!query) return { result: null, error: 'search_codebase: query 参数缺失' }
  try {
    const root = pathPrefix ? await resolveDirHandle(handle, pathPrefix) : handle
    const matches: string[] = []
    const lowerQuery = query.toLowerCase()
    await walkFiles(root, pathPrefix, async (entryPath, fileHandle) => {
      if (matches.length >= MAX_SEARCH_RESULTS) return
      try {
        const file = await fileHandle.getFile()
        if (file.size > MAX_FILE_SIZE) return
        const content = await file.text()
        const lines = content.split('\n')
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          if (line && line.toLowerCase().includes(lowerQuery)) {
            matches.push(`${entryPath}:${i + 1}: ${line.trim()}`)
            if (matches.length >= MAX_SEARCH_RESULTS) break
          }
        }
      } catch {
        // 读文件失败,跳过
      }
    })
    if (matches.length === 0) {
      return { result: '未找到匹配内容', error: null }
    }
    return { result: matches.join('\n'), error: null }
  } catch (err) {
    return { result: null, error: `search_codebase: ${(err as Error).message}` }
  }
}

async function toolListFiles(
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
): Promise<ToolExecutionResult> {
  const pathPrefix = typeof args.path === 'string' ? args.path : ''
  try {
    const dir = pathPrefix ? await resolveDirHandle(handle, pathPrefix) : handle
    const entries: string[] = []
    const iterable = dir as unknown as {
      values(): AsyncIterableIterator<FileSystemHandle>
    }
    for await (const entry of iterable.values()) {
      const prefix = entry.kind === 'directory' ? '[dir]  ' : '[file] '
      const fullPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name
      entries.push(`${prefix}${fullPath}`)
    }
    if (entries.length === 0) {
      return { result: '(空目录)', error: null }
    }
    return { result: entries.join('\n'), error: null }
  } catch (err) {
    return { result: null, error: `list_files: ${(err as Error).message}` }
  }
}

async function toolApplyPatch(
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
  attribution?: AttributionTrace,
): Promise<ToolExecutionResult> {
  const path = typeof args.path === 'string' ? args.path : ''
  const patch = typeof args.patch === 'string' ? args.patch : ''
  if (!path) return { result: null, error: 'apply_patch: path 参数缺失' }
  if (!patch) return { result: null, error: 'apply_patch: patch 参数缺失' }

  const readResult = await toolReadFile(args, handle)
  if (readResult.error || readResult.result === null) {
    return { result: null, error: `apply_patch: 读取原文件失败 - ${readResult.error}` }
  }
  try {
    const updated = applyUnifiedDiff(readResult.result, patch)
    if (updated === null) {
      return { result: null, error: 'apply_patch: patch 解析或应用失败' }
    }
    return await toolWriteFile({ path, content: updated }, handle, attribution)
  } catch (err) {
    return { result: null, error: `apply_patch: ${(err as Error).message}` }
  }
}

async function toolDeleteFile(
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
): Promise<ToolExecutionResult> {
  const path = typeof args.path === 'string' ? args.path : ''
  if (!path) return { result: null, error: 'delete_file: path 参数缺失' }
  try {
    const { dir, name } = splitPath(path)
    const dirHandle = dir ? await resolveDirHandle(handle, dir) : handle
    await dirHandle.removeEntry(name)
    return { result: `已删除 ${path}`, error: null }
  } catch (err) {
    return { result: null, error: `delete_file: ${(err as Error).message}` }
  }
}

async function toolMoveFile(
  args: Record<string, unknown>,
  handle: FileSystemDirectoryHandle,
): Promise<ToolExecutionResult> {
  const source = typeof args.source === 'string' ? args.source : ''
  const destination = typeof args.destination === 'string' ? args.destination : ''
  if (!source) return { result: null, error: 'move_file: source 参数缺失' }
  if (!destination) return { result: null, error: 'move_file: destination 参数缺失' }

  const readResult = await toolReadFile({ path: source }, handle)
  if (readResult.error || readResult.result === null) {
    return { result: null, error: `move_file: 读取源文件失败 - ${readResult.error}` }
  }
  const writeResult = await toolWriteFile({ path: destination, content: readResult.result }, handle)
  if (writeResult.error) {
    return { result: null, error: `move_file: 写入目标文件失败 - ${writeResult.error}` }
  }
  const deleteResult = await toolDeleteFile({ path: source }, handle)
  if (deleteResult.error) {
    return {
      result: `已复制到 ${destination},但删除源文件失败: ${deleteResult.error}`,
      error: null,
    }
  }
  return { result: `已移动 ${source} → ${destination}`, error: null }
}

// =============================================================================
// 运营内容工具(G-17,2026-11-28):公告/轮播 CRUD,经注入的 AdminContentOps 调
// 既有 admin 端点(鉴权 = 用户本人会话过 requireAdmin;写操作另有 tool-approval 卡)。
// =============================================================================

async function toolAdminContent(
  toolName: string,
  args: Record<string, unknown>,
  adminOps?: AdminContentOps,
): Promise<ToolExecutionResult> {
  if (!adminOps) {
    return {
      result: null,
      error: `${toolName}: 运营内容工具由浏览器端以用户本人会话执行,当前端未接入执行面(仅 web 聊天可用)`,
    }
  }
  let outcome: AdminContentOpOutcome
  switch (toolName) {
    case 'announce_list': {
      const query: AdminContentQuery = {}
      const page = pickNumber(args, 'page')
      if (page !== undefined) query.page = page
      const pageSize = pickNumber(args, 'pageSize')
      if (pageSize !== undefined) query.pageSize = pageSize
      const title = pickString(args, 'title')
      if (title !== undefined) query.title = title
      const isPublished = pickBoolean(args, 'isPublished')
      if (isPublished !== undefined) query.isPublished = isPublished
      outcome = await adminOps.listAnnouncements(query)
      break
    }
    case 'announce_create': {
      const title = pickString(args, 'title')
      const content = args.content
      if (!title) return { result: null, error: 'announce_create: title 参数缺失' }
      if (typeof content !== 'string' || content.length === 0) {
        return { result: null, error: 'announce_create: content 参数缺失' }
      }
      const body: Record<string, unknown> = { title, content }
      const type = pickString(args, 'type')
      if (type !== undefined) body.type = type
      const isPinned = pickBoolean(args, 'isPinned')
      if (isPinned !== undefined) body.isPinned = isPinned
      const isPublished = pickBoolean(args, 'isPublished')
      if (isPublished !== undefined) body.isPublished = isPublished
      outcome = await adminOps.createAnnouncement(body)
      break
    }
    case 'announce_update': {
      const id = pickString(args, 'id')
      if (!id) return { result: null, error: 'announce_update: id 参数缺失(先用 announce_list 查)' }
      const body: Record<string, unknown> = {}
      const title = pickString(args, 'title')
      if (title !== undefined) body.title = title
      if (typeof args.content === 'string' && args.content.length > 0) body.content = args.content
      const type = pickString(args, 'type')
      if (type !== undefined) body.type = type
      const isPinned = pickBoolean(args, 'isPinned')
      if (isPinned !== undefined) body.isPinned = isPinned
      const isPublished = pickBoolean(args, 'isPublished')
      if (isPublished !== undefined) body.isPublished = isPublished
      if (Object.keys(body).length === 0) {
        return { result: null, error: 'announce_update: 没有要更新的字段' }
      }
      outcome = await adminOps.updateAnnouncement(id, body)
      break
    }
    case 'carousel_list': {
      const query: AdminContentQuery = {}
      const page = pickNumber(args, 'page')
      if (page !== undefined) query.page = page
      const pageSize = pickNumber(args, 'pageSize')
      if (pageSize !== undefined) query.pageSize = pageSize
      const search = pickString(args, 'search')
      if (search !== undefined) query.search = search
      outcome = await adminOps.listCarousels(query)
      break
    }
    case 'carousel_create': {
      const body: Record<string, unknown> = {}
      for (const key of ['title', 'position', 'imageUrl', 'linkUrl', 'description'] as const) {
        const v = pickString(args, key)
        if (v !== undefined) body[key] = v
      }
      const sort = pickNumber(args, 'sort')
      if (sort !== undefined) body.sort = sort
      const status = pickNumber(args, 'status')
      if (status !== undefined) body.status = status
      outcome = await adminOps.createCarousel(body)
      break
    }
    case 'carousel_update': {
      const id = pickString(args, 'id')
      if (!id) return { result: null, error: 'carousel_update: id 参数缺失(先用 carousel_list 查)' }
      const body: Record<string, unknown> = {}
      for (const key of ['title', 'position', 'imageUrl', 'linkUrl', 'description'] as const) {
        const v = pickString(args, key)
        if (v !== undefined) body[key] = v
      }
      const sort = pickNumber(args, 'sort')
      if (sort !== undefined) body.sort = sort
      const status = pickNumber(args, 'status')
      if (status !== undefined) body.status = status
      if (Object.keys(body).length === 0) {
        return { result: null, error: 'carousel_update: 没有要更新的字段' }
      }
      outcome = await adminOps.updateCarousel(id, body)
      break
    }
    default:
      return { result: null, error: `浏览器端不支持工具: ${toolName}` }
  }
  if (!outcome.ok) {
    return { result: null, error: `${toolName}: ${outcome.message ?? '后台请求失败'}` }
  }
  return { result: JSON.stringify(outcome.data ?? {}), error: null }
}

// =============================================================================
// 辅助函数
// =============================================================================

interface PathParts {
  dir: string
  name: string
}

function splitPath(path: string): PathParts {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) return { dir: '', name: '' }
  const name = parts[parts.length - 1]
  if (!name) return { dir: '', name: '' }
  if (parts.length === 1) return { dir: '', name }
  return { dir: parts.slice(0, -1).join('/'), name }
}

async function resolveFileHandle(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemFileHandle> {
  const parts = path.split('/').filter(Boolean)
  if (parts.length === 0) throw new Error('resolveFileHandle: path 为空')
  let dir = root
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!part) throw new Error(`resolveFileHandle: 路径段 ${i} 为空`)
    dir = await dir.getDirectoryHandle(part)
  }
  const last = parts[parts.length - 1]
  if (!last) throw new Error('resolveFileHandle: 文件名为空')
  return dir.getFileHandle(last)
}

async function resolveDirHandle(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle> {
  const parts = path.split('/').filter(Boolean)
  let dir = root
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part)
  }
  return dir
}

async function ensureDirHandle(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle> {
  const parts = path.split('/').filter(Boolean)
  let dir = root
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  return dir
}

/**
 * 递归遍历目录树,对每个文件调用 callback。
 * 跳过 SKIP_DIRS 目录(node_modules/.git 等)。
 *
 * FileSystemDirectoryHandle.values() 是 W3C File System Access API 标准,
 * 现代浏览器(Chrome 86+/Edge 86+)支持,但 TS lib.dom.d.ts 类型定义不完整,
 * 用类型断言访问。
 */
async function walkFiles(
  dirHandle: FileSystemDirectoryHandle,
  prefix: string,
  callback: (path: string, fileHandle: FileSystemFileHandle) => Promise<void>,
): Promise<void> {
  const iterable = dirHandle as unknown as {
    values(): AsyncIterableIterator<FileSystemHandle>
  }
  for await (const entry of iterable.values()) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.kind === 'directory') {
      if (SKIP_DIRS.has(entry.name)) continue
      await walkFiles(entry as FileSystemDirectoryHandle, entryPath, callback)
    } else if (entry.kind === 'file') {
      await callback(entryPath, entry as FileSystemFileHandle)
    }
  }
}

/**
 * 简化版 unified diff 解析与应用。
 *
 * 支持格式:
 *   --- a/path
 *   +++ b/path
 *   @@ -start,len +start,len @@
 *    context line
 *   -removed line
 *   +added line
 *
 * 简化策略:仅处理 @@ ... @@ 块,按行匹配上下文 + 应用 +/- 变更。
 * 不支持跨多 hunk 重定位,假设 hunk 头中的行号有效。
 * 解析失败返回 null。
 */
function applyUnifiedDiff(original: string, patch: string): string | null {
  const originalLines = original.split('\n')
  const result: string[] = []
  let origIdx = 0

  const lines = patch.split('\n')
  let i = 0
  // 跳过文件头(--- a/xxx / +++ b/xxx)
  while (i < lines.length && !lines[i]?.startsWith('@@')) {
    i++
  }

  while (i < lines.length) {
    const line = lines[i]
    if (!line) {
      i++
      continue
    }
    if (line.startsWith('@@')) {
      const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (!m || m[1] === undefined) return null
      const oldStart = Number(m[1])
      // 拷贝 hunk 之前的未变更内容
      while (origIdx < oldStart - 1 && origIdx < originalLines.length) {
        const origLine = originalLines[origIdx]
        if (origLine !== undefined) result.push(origLine)
        origIdx++
      }
      i++
      // 应用 hunk 体
      while (i < lines.length && !lines[i]?.startsWith('@@')) {
        const hunkLine = lines[i]
        if (!hunkLine) {
          i++
          continue
        }
        if (hunkLine.startsWith('-')) {
          // 删除行:跳过原文件对应行(不校验内容匹配)
          origIdx++
        } else if (hunkLine.startsWith('+')) {
          result.push(hunkLine.slice(1))
        } else if (hunkLine.startsWith(' ')) {
          result.push(hunkLine.slice(1))
          origIdx++
        } else if (hunkLine === '') {
          // 空行视为上下文
          result.push('')
          origIdx++
        }
        i++
      }
    } else {
      i++
    }
  }
  // 拷贝剩余未变更内容
  while (origIdx < originalLines.length) {
    const origLine = originalLines[origIdx]
    if (origLine !== undefined) result.push(origLine)
    origIdx++
  }
  return result.join('\n')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
