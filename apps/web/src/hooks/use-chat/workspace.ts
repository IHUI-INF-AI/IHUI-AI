import { isTauri } from '@/lib/tauri-bridge'
import { useAiPanelStore } from '@/stores/ai-panel'
import {
  getBrowserWorkspaceHandle,
  loadWorkspaceContext,
  collectAgentFileSignatures,
  agentSignaturesEqual,
  type AgentFileSignature,
} from '@/lib/workspace-context-loader'
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
 * 缓存(2026-08-29 增强):同一工作区只加载一次;命中缓存前先用
 * agent 规则文件签名(mtime/size)校验,文件有增删改则自动全量重索引。
 */
export interface CachedBrowserContext {
  name: string
  text: string
  agentSig: AgentFileSignature[]
}

export let cachedBrowserContext: CachedBrowserContext | null = null

export async function loadBrowserWorkspaceContext(): Promise<string | undefined> {
  // Tauri 桌面端走 workspacePath,不需要 workspaceContext
  if (isTauri()) return undefined
  // 非 Tauri 环境:从 ai-panel store 拿 activeWorkspace
  const ws = useAiPanelStore.getState().activeWorkspace
  if (!ws?.name) return undefined
  return loadBrowserWorkspaceContextByName(ws.name)
}

/**
 * 按名称加载工作区上下文(带缓存 + agent 文件签名校验)。
 * 添加工作区时可立即调用做全量索引预热,后续发消息直接命中缓存。
 */
export async function loadBrowserWorkspaceContextByName(name: string): Promise<string | undefined> {
  const handle = getBrowserWorkspaceHandle(name)
  if (!handle) return undefined

  // 缓存命中前校验 agent 文件签名(轻量:只 getFile 取元数据,不读内容)
  if (cachedBrowserContext?.name === name) {
    try {
      const currentSig = await collectAgentFileSignatures(handle)
      if (agentSignaturesEqual(currentSig, cachedBrowserContext.agentSig)) {
        return cachedBrowserContext.text
      }
      logger.info('[workspace-context] agent files changed, reloading full context')
    } catch (err) {
      logger.warn('[workspace-context] signature check failed, reloading:', err)
    }
  }

  try {
    const result = await loadWorkspaceContext(handle)
    const agentSig = await collectAgentFileSignatures(handle)
    cachedBrowserContext = { name, text: result.text, agentSig }
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

/**
 * 清除缓存上下文(2026-08-29 立)。
 * - 传 name:仅清除该工作区缓存(移除/切换工作区时调用)
 * - 不传:清除全部(登出/重置场景)
 */
export function invalidateBrowserWorkspaceContext(name?: string): void {
  if (!name || cachedBrowserContext?.name === name) {
    cachedBrowserContext = null
  }
}
