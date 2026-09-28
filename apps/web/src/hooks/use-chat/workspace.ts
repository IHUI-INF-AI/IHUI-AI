// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { isTauri } from '@/lib/tauri-bridge'
import { useAiPanelStore } from '@/stores/ai-panel'
import {
  getBrowserWorkspaceHandle,
  loadWorkspaceContextCached,
  invalidateWorkspaceContextCache,
  peekWorkspaceContextCache,
  type WorkspaceContextCacheEntry,
} from '@/lib/workspace-context-loader'
import { logger } from '@/lib/logger'

/** 缓存条目形态就是共享层那一份;此处别名只为不打断既有类型引用面。 */
export type CachedBrowserContext = WorkspaceContextCacheEntry

/** 只读诊断出口(与共享层同一份存储,不再自持一份)。 */
export function getCachedBrowserContext(): WorkspaceContextCacheEntry | null {
  return peekWorkspaceContextCache()
}

/**
 * 加载浏览器端工作区上下文(2026-08-02 立,阶段 1 核心)。
 *
 * 仅在 web 非 Tauri 环境下生效:
 *   1. 从 ai-panel store 取 activeWorkspace.name
 *   2. 用 name 从 module-level Map 取 FileSystemDirectoryHandle
 *   3. 用 handle 遍历读取工作区关键文件,返回格式化 context 字符串
 *
 * Tauri 桌面端返回 undefined,走原有 workspacePath 逻辑(ai-service 直接读本地文件)。
 * 缓存策略(同一工作区只加载一次、命中前按全量文件签名校验)自 2026-09-28 起住在共享层,
 * 与本文件的端内胶水(Tauri 判定 / store 取名 / 日志出口)分两层。
 */
export async function loadBrowserWorkspaceContext(): Promise<string | undefined> {
  // Tauri 桌面端走 workspacePath,不需要 workspaceContext
  if (isTauri()) return undefined
  // 非 Tauri 环境:从 ai-panel store 拿 activeWorkspace
  const ws = useAiPanelStore.getState().activeWorkspace
  if (!ws?.name) return undefined
  return loadBrowserWorkspaceContextByName(ws.name)
}

/**
 * 按名称加载工作区上下文(带缓存 + 全量文件签名校验)。
 *
 * 2026-09-28(票㉕ 补账②)策略本体搬到 `@ihui/shared/chat/workspace-context-loader`,
 * 本文件只留端内那部分:Tauri 判定、store 取名、句柄表、日志出口。
 * 为什么必须是一份 —— 这个函数的返回值就是服务端委托开关 `workspace_context` 本身,
 * "缓存何时失效"若两端各写一遍,表现是"同一句话在 web 拿到最新代码、在扩展拿到首屏快照",
 * 而两边测试各自都绿。
 */
export async function loadBrowserWorkspaceContextByName(name: string): Promise<string | undefined> {
  const handle = getBrowserWorkspaceHandle(name)
  if (!handle) return undefined
  // 命中前的签名校验、失败不写缓存、换工作区不误清 —— 全在共享层那一份里
  return loadWorkspaceContextCached(handle, {
    onLog: (level, message) => {
      if (level === 'warn') logger.warn('[workspace-context]', message)
      else logger.info('[workspace-context]', message)
    },
  })
}

/**
 * 清除缓存上下文(2026-08-29 立,2026-09-28 起委托共享层):
 * - 传 name:仅清除该工作区缓存(移除/切换工作区时调用)
 * - 不传:清除全部(登出/重置场景)
 */
export function invalidateBrowserWorkspaceContext(name?: string): void {
  invalidateWorkspaceContextCache(name)
}
