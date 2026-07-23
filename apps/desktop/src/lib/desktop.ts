import { invoke } from '@tauri-apps/api/core'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'

// ================== 自动启动 ==================

/** 启用开机自启(参数 --minimized 已在 Rust 端 plugin init 配置)。 */
export async function enableAutostart(): Promise<void> {
  await invoke('plugin:autostart|enable')
}

/** 禁用开机自启。 */
export async function disableAutostart(): Promise<void> {
  await invoke('plugin:autostart|disable')
}

/** 查询当前开机自启状态。 */
export async function isAutostartEnabled(): Promise<boolean> {
  return await invoke<boolean>('plugin:autostart|is_enabled')
}

// ================== 窗口控制 ==================

/** 显示主窗口(用于 TS 侧主动唤起,如托盘菜单的 TS 调用)。 */
export async function showMainWindow(): Promise<void> {
  await invoke('plugin:window|show', { label: 'main' })
}

/** 隐藏主窗口(最小化到托盘)。 */
export async function hideMainWindow(): Promise<void> {
  await invoke('plugin:window|hide', { label: 'main' })
}

/** 切换主窗口显示/隐藏(用于全局快捷键的 TS 侧调用,如果需要)。 */
export async function toggleMainWindow(): Promise<boolean> {
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
 */
export async function sendDesktopNotification(title: string, body: string): Promise<void> {
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
    // 非 Tauri 环境或权限被拒,静默忽略
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

/** 读取文本文件(UTF-8)。 */
export async function readTextFile(path: string): Promise<ReadTextResult> {
  return await invoke<ReadTextResult>('read_text_file', { path })
}

/** 读取二进制文件,返回 base64 + MIME(用于图片/附件预览)。 */
export async function readBinaryFile(path: string): Promise<ReadBinaryResult> {
  return await invoke<ReadBinaryResult>('read_binary_file', { path })
}

/** 写入文本文件(覆盖)。父目录不存在时自动创建。 */
export async function writeTextFile(path: string, content: string): Promise<void> {
  await invoke('write_text_file', { path, content })
}

/** 列出目录下的文件/子目录(非递归,文件在前目录在后)。 */
export async function listDir(path: string): Promise<DirListResult> {
  return await invoke<DirListResult>('list_dir', { path })
}

/** 获取单个文件/目录的元信息。 */
export async function statFile(path: string): Promise<FileInfo> {
  return await invoke<FileInfo>('stat_file', { path })
}

/**
 * 打开文件选择对话框(单选)。
 * @param filters 文件类型过滤(默认所有文件)
 * @returns 选中文件路径,取消返回 null
 */
export async function pickFile(
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }> = [FILE_FILTERS.all],
): Promise<string | null> {
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
 * @returns 选中文件路径数组,取消返回空数组
 */
export async function pickFiles(
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }> = [FILE_FILTERS.all],
): Promise<string[]> {
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
 * @returns 选中目录路径,取消返回 null
 */
export async function pickDirectory(): Promise<string | null> {
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
 * @returns 用户选择的保存路径,取消返回 null
 */
export async function pickSavePath(
  defaultName: string,
  filters: ReadonlyArray<{ name: string; extensions: ReadonlyArray<string> }> = [FILE_FILTERS.all],
): Promise<string | null> {
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

/** 判断当前是否在 Tauri 桌面端运行(非浏览器环境)。 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/** 格式化文件大小(字节 → KB/MB/GB)。 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
