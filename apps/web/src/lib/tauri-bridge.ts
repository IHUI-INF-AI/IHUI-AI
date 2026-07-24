import { invoke } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'

/**
 * Web 端 Tauri Bridge:在 Tauri WebView 中调用 desktop 端 Rust 命令。
 * 非 Tauri 环境(普通浏览器)下,所有函数返回安全默认值或抛出明确错误,
 * 不影响 web 端其他功能(纯浏览器场景下文件/窗口/通知能力自然失效)。
 *
 * 与 apps/desktop/src/lib/desktop.ts 的 bridge 逻辑一一对应,共享同一 Rust 后端。
 */

/** 判断当前是否在 Tauri 桌面端运行(非浏览器环境)。 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 非 Tauri 环境统一抛错(用于文件读写等无安全默认值的场景)。 */
function requireTauri(): void {
  if (!isTauri()) {
    throw new Error('Not in Tauri environment')
  }
}

// ================== 自动启动 ==================

/** 启用开机自启(参数 --minimized 已在 Rust 端 plugin init 配置)。 */
export async function enableAutostart(): Promise<void> {
  if (!isTauri()) return
  await invoke('plugin:autostart|enable')
}

/** 禁用开机自启。 */
export async function disableAutostart(): Promise<void> {
  if (!isTauri()) return
  await invoke('plugin:autostart|disable')
}

/** 查询当前开机自启状态。 */
export async function isAutostartEnabled(): Promise<boolean> {
  if (!isTauri()) return false
  return await invoke<boolean>('plugin:autostart|is_enabled')
}

// ================== 窗口控制 ==================

/** 显示主窗口(用于 TS 侧主动唤起,如托盘菜单的 TS 调用)。 */
export async function showMainWindow(): Promise<void> {
  if (!isTauri()) return
  await invoke('plugin:window|show', { label: 'main' })
}

/** 隐藏主窗口(最小化到托盘)。 */
export async function hideMainWindow(): Promise<void> {
  if (!isTauri()) return
  await invoke('plugin:window|hide', { label: 'main' })
}

/** 切换主窗口显示/隐藏(用于全局快捷键的 TS 侧调用,如果需要)。 */
export async function toggleMainWindow(): Promise<boolean> {
  if (!isTauri()) return false
  const visible = await invoke<boolean>('plugin:window|is_visible', { label: 'main' })
  if (visible) {
    await invoke('plugin:window|hide', { label: 'main' })
  } else {
    await invoke('plugin:window|show', { label: 'main' })
    await invoke('plugin:window|set_focus', { label: 'main' })
  }
  return !visible
}

// ================== 原生通知 ==================

/**
 * 发送系统原生通知(标题 + 正文)。
 * 自动处理权限请求(首次调用时请求,已授权则直接发送)。
 * 非 Tauri 环境或权限被拒时静默忽略。
 */
export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (!isTauri()) return
  try {
    let granted = await invoke<boolean>('plugin:notification|is_permission_granted')
    if (!granted) {
      const permission = await invoke<string>('plugin:notification|request_permission')
      granted = permission === 'granted'
    }
    if (granted) {
      await invoke('plugin:notification|notify', { options: { title, body } })
    }
  } catch {
    // 权限被拒或调用失败,静默忽略
  }
}

// ================== 本地文件访问 ==================

export interface FileInfo {
  path: string
  name: string
  size: number
  isDir: boolean
  extension: string
}

export interface ReadTextResult {
  content: string
  size: number
}

export interface ReadBinaryResult {
  base64: string
  size: number
  mime: string
}

export interface DirListResult {
  entries: FileInfo[]
}

/** 文件选择过滤器(常用类型,Web 端没有)。 */
export const FILE_FILTERS = {
  images: { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] },
  text: { name: '文本', extensions: ['txt', 'md', 'log', 'csv', 'json', 'xml', 'yml', 'yaml', 'toml'] },
  pdf: { name: 'PDF', extensions: ['pdf'] },
  all: { name: '所有文件', extensions: ['*'] },
} as const

/** 读取文本文件(UTF-8)。非 Tauri 环境抛错。 */
export async function readTextFile(path: string): Promise<ReadTextResult> {
  requireTauri()
  return await invoke<ReadTextResult>('read_text_file', { path })
}

/** 读取二进制文件,返回 base64 + MIME(用于图片/附件预览)。非 Tauri 环境抛错。 */
export async function readBinaryFile(path: string): Promise<ReadBinaryResult> {
  requireTauri()
  return await invoke<ReadBinaryResult>('read_binary_file', { path })
}

/** 写入文本文件(覆盖)。父目录不存在时自动创建。非 Tauri 环境抛错。 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  requireTauri()
  await invoke('write_text_file', { path, content })
}

/** 列出目录下的文件/子目录(非递归,文件在前目录在后)。非 Tauri 环境返回空列表。 */
export async function listDir(path: string): Promise<DirListResult> {
  if (!isTauri()) return { entries: [] }
  return await invoke<DirListResult>('list_dir', { path })
}

/** 获取单个文件/目录的元信息。非 Tauri 环境抛错。 */
export async function statFile(path: string): Promise<FileInfo> {
  requireTauri()
  return await invoke<FileInfo>('stat_file', { path })
}

/**
 * 打开文件选择对话框(单选)。
 * @param filters 文件类型过滤(默认所有文件)
 * @returns 选中文件路径,取消或非 Tauri 环境返回 null
 */
export async function pickFile(
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }> = [FILE_FILTERS.all],
): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const result = await openDialog({
      multiple: false,
      filters: filters.map((f) => ({
        name: f.name,
        extensions: [...f.extensions],
      })),
    })
    return typeof result === 'string' ? result : null
  } catch {
    return null
  }
}

/**
 * 打开多文件选择对话框。
 * @param filters 文件类型过滤
 * @returns 选中文件路径数组,取消或非 Tauri 环境返回空数组
 */
export async function pickFiles(
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }> = [FILE_FILTERS.all],
): Promise<string[]> {
  if (!isTauri()) return []
  try {
    const result = await openDialog({
      multiple: true,
      filters: filters.map((f) => ({
        name: f.name,
        extensions: [...f.extensions],
      })),
    })
    if (result === null) return []
    return Array.isArray(result) ? result : [result]
  } catch {
    return []
  }
}

/**
 * 打开目录选择对话框。
 * @returns 选中目录路径,取消或非 Tauri 环境返回 null
 */
export async function pickDirectory(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const result = await openDialog({ directory: true, multiple: false })
    return typeof result === 'string' ? result : null
  } catch {
    return null
  }
}

/**
 * 打开保存文件对话框。
 * @param defaultName 默认文件名
 * @param filters 文件类型过滤
 * @returns 用户选择的保存路径,取消或非 Tauri 环境返回 null
 */
export async function pickSavePath(
  defaultName: string,
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }> = [FILE_FILTERS.all],
): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const result = await saveDialog({
      defaultPath: defaultName,
      filters: filters.map((f) => ({
        name: f.name,
        extensions: [...f.extensions],
      })),
    })
    return result ?? null
  } catch {
    return null
  }
}

/** 格式化文件大小(字节 → KB/MB/GB)。纯函数,不依赖 Tauri。 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// ================== 窗口状态持久化 ==================

/** 保存当前主窗口位置/尺寸/最大化状态(下次启动时恢复)。 */
export async function saveWindowState(): Promise<void> {
  if (!isTauri()) return
  try {
    await invoke('save_window_state')
  } catch {
    // 非 Tauri 环境或调用失败,静默忽略
  }
}

/** 从 store 恢复主窗口状态(应用启动时由 Rust 端自动调用)。 */
export async function restoreWindowState(): Promise<void> {
  if (!isTauri()) return
  try {
    await invoke('restore_window_state')
  } catch {
    // 非 Tauri 环境或调用失败,静默忽略
  }
}

/** 重置窗口状态(清除 store 中的窗口记录,下次启动用默认尺寸)。 */
export async function resetWindowState(): Promise<void> {
  if (!isTauri()) return
  try {
    await invoke('reset_window_state')
  } catch {
    // 非 Tauri 环境或调用失败,静默忽略
  }
}

// ================== 会话历史持久化 ==================

/** 持久化的消息记录(与 Rust StoredMessage 对齐)。 */
export interface StoredMessage {
  id: string
  role: string
  content: string
}

/** 会话摘要(列表项,不含消息内容)。 */
export interface ConversationSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

/** 完整会话(含消息列表)。 */
export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: StoredMessage[]
}

export interface ConversationListResult {
  conversations: ConversationSummary[]
  activeId: string | null
}

export interface ConversationLoadResult {
  conversation: Conversation | null
}

/** 列出所有会话摘要 + 当前活跃会话 ID(按 updatedAt 倒序)。非 Tauri 环境返回空列表。 */
export async function listConversations(): Promise<ConversationListResult> {
  if (!isTauri()) return { conversations: [], activeId: null }
  return await invoke<ConversationListResult>('list_conversations')
}

/** 加载指定会话完整消息列表(不存在返回 conversation=null)。非 Tauri 环境返回 null。 */
export async function loadConversation(id: string): Promise<ConversationLoadResult> {
  if (!isTauri()) return { conversation: null }
  return await invoke<ConversationLoadResult>('load_conversation', { id })
}

/**
 * 保存/更新会话(id 已存在则覆盖,否则新增)。
 * 自动设为活跃会话。最多保留 50 条(超限时按 updatedAt 截断最早的)。
 * 非 Tauri 环境静默忽略(无法持久化)。
 */
export async function saveConversation(
  id: string,
  title: string,
  messages: StoredMessage[],
): Promise<void> {
  if (!isTauri()) return
  await invoke('save_conversation', { id, title, messages })
}

/** 删除指定会话。若被删的是活跃会话,activeId 也一并清除。 */
export async function deleteConversation(id: string): Promise<void> {
  if (!isTauri()) return
  await invoke('delete_conversation', { id })
}

/** 设置当前活跃会话 ID(null 表示清除活跃会话)。 */
export async function setActiveConversation(id: string | null): Promise<void> {
  if (!isTauri()) return
  await invoke('set_active_conversation', { id })
}
