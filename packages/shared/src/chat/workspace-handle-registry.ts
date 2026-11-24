// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器工作区句柄注册表:键分配 + 授权恢复。
 *
 * 与 `workspace-context-loader.ts` 分工:
 *  - loader 负责「句柄存在哪、目录怎么读」
 *  - 本模块负责「同名目录怎么区分、刷新后怎么在用户手势内恢复授权」
 *
 * 为什么单独成文件:这两个操作都依赖句柄 Map/IndexedDB 的既有状态,
 * 但属于「注册表策略」而非「上下文加载」,放在一起会继续把 loader 撑大。
 */

import {
  getBrowserWorkspaceHandle,
  hydrateBrowserWorkspaceHandles,
} from './workspace-context-loader'

/**
 * 为一次浏览器目录选择解析稳定的工作区键。
 *
 * showDirectoryPicker 只暴露文件夹名,不同路径下的同名目录会撞键 ——
 * 旧实现直接覆盖句柄,表现为「切回 A 项目却读到 B 项目的文件」。这里用
 * isSameEntry 判定是否同一目录:
 *  - 同一目录:复用已有键(可能带 #n 后缀),不产生重复条目
 *  - 不同目录:分配 `name#2`、`name#3`…
 */
export async function resolveBrowserWorkspaceKeyForHandle(
  handle: FileSystemDirectoryHandle,
): Promise<string> {
  const registered = await hydrateBrowserWorkspaceHandles()
  const base = handle.name || 'workspace'
  const candidates = registered.filter((k) => k === base || k.startsWith(`${base}#`))
  for (const key of candidates) {
    const existing = getBrowserWorkspaceHandle(key)
    if (!existing) continue
    try {
      if (await existing.isSameEntry(handle)) return key
    } catch {
      // isSameEntry 在部分浏览器/已失效句柄上会抛错,按不同目录处理
    }
  }
  if (!registered.includes(base)) return base
  let n = 2
  while (registered.includes(`${base}#${n}`)) n += 1
  return `${base}#${n}`
}

/**
 * 在当前用户手势内恢复目录授权(点击工作区按钮/菜单项时调用)。
 * 刷新后 queryPermission 常为 'prompt',此时只有 requestPermission 能在手势内恢复。
 */
export async function requestBrowserWorkspacePermission(
  name: string,
): Promise<PermissionState | 'missing'> {
  const handle = getBrowserWorkspaceHandle(name)
  if (!handle) return 'missing'
  const request = (
    handle as FileSystemDirectoryHandle & {
      requestPermission?: (d: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>
    }
  ).requestPermission
  if (!request) return 'granted'
  try {
    return await request.call(handle, { mode: 'readwrite' })
  } catch {
    return 'prompt'
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
