// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import type { FileNode } from '@ihui/types'
import { EXT_LANG, useIDEWorkspace } from '@/stores/ide-workspace'

/**
 * 2026-11-14(对标 DSH dsh-client-ui-deliverables 的文件引用打开通道):
 * 把「正文里的文件引用」统一落到 IDE 打开,而不是让相对路径链接变成不可点的 span。
 *
 * 纪律:
 * - 路径口径统一正斜杠(IDE tab 去重 / revealAt 落点 / 文件树 path 同一比较口径);
 * - 有行号时优先走 `revealAt`(编辑器注册的唯一落点出口,自身负责打开/等待加载);
 * - `revealAt` 未注册(编辑器未挂载)时退回纯打开,不猜行号、不报错;
 * - 空路径直接 no-op,不抛异常 —— 链路是展示层,失败方向必须无害。
 */
export function toIdePath(path: string): string {
  return path.replace(/\\/g, '/').trim()
}

/** 在 IDE 中打开工作区文件;可选行/列揭示。 */
export function openWorkspaceFileInIde(path: string, line?: number, column?: number): void {
  const target = toIdePath(path)
  if (!target) return
  const ide = useIDEWorkspace.getState()
  if (line && ide.revealAt) {
    ide.revealAt(target, line, column ?? 1)
    ide.setActiveTopTab('editor')
    return
  }
  const name = target.split('/').pop() || target
  const ext = name.includes('.') ? (name.split('.').pop() ?? '') : ''
  const file: FileNode = {
    id: target,
    name,
    path: target,
    type: 'file',
    language: EXT_LANG[ext] ?? 'text',
  }
  ide.openFile(file)
  ide.setActiveTopTab('editor')
}
