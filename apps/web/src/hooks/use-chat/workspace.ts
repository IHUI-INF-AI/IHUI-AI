import { isTauri } from '@/lib/tauri-bridge'
import { useAiPanelStore } from '@/stores/ai-panel'
import { getBrowserWorkspaceHandle, loadWorkspaceContext } from '@/lib/workspace-context-loader'
import { logger } from '@/lib/logger'

/**
 * 加载浏览器端工作区上下文(2026-08-02 立,阶段 1 核心)。
 *
 * 仅在 web 非 Tauri 环境下生效:
 *   1. 从 ai-panel store 取 activeWorkspace.name
 *   2. 用 name 从 module-level Map 取 FileSystemDirectoryHandle
 *   3. 用 handle 遍历读取工作区关键文件,返回格式化 context 字符串
 *
 * Tauri 桌面端返回 undefined,走原有 workspacePath 逻辑(ai-service 直接读本地文件)。
 *
 * 缓存:同一工作区只加载一次,切换工作区后自动重新加载。
 */
export let cachedBrowserContext: { name: string; text: string } | null = null

export async function loadBrowserWorkspaceContext(): Promise<string | undefined> {
  // Tauri 桌面端走 workspacePath,不需要 workspaceContext
  if (isTauri()) return undefined
  // 非 Tauri 环境:从 ai-panel store 拿 activeWorkspace
  const ws = useAiPanelStore.getState().activeWorkspace
  if (!ws?.name) return undefined
  // 缓存命中(同一工作区不重复加载)
  if (cachedBrowserContext && cachedBrowserContext.name === ws.name) {
    return cachedBrowserContext.text
  }
  const handle = getBrowserWorkspaceHandle(ws.name)
  if (!handle) return undefined
  try {
    const result = await loadWorkspaceContext(handle)
    cachedBrowserContext = { name: ws.name, text: result.text }
    logger.info(
      `[workspace-context] loaded ${result.stats.fileCount} files, ` +
        `${result.stats.totalSize} bytes, truncated=${result.stats.truncated}`,
    )
    return result.text
  } catch (err) {
    logger.warn('[workspace-context] load failed:', err)
    return undefined
  }
}
