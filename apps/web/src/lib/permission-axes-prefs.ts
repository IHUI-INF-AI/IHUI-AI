// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 79 号票(2026-10-25 立):权限双轴(sandbox_mode × approval_policy)的**本机记忆**。
 *
 * 立因:双轴此前只在 store 里(会话级),刷新即回"跟随单轴" —— 用户在弹层里选过的
 * 沙箱 × 审批每次冷启动都要重选。本文件把这份选择落到 localStorage,并在挂载时读回。
 *
 * 三条口径:
 * - 只存**两轴齐备**的一对。存储是跨版本存活的,半对/拼写漂移(手改、旧格式)一律判
 *   失效回 null,不把认不出的半成品喂给请求侧(否则"我选了只读"变成"按默认跑")。
 * - 清空(用户点"跟随单轴")= removeItem:没有显式选择就是没有可记的偏好,
 *   留着旧值会让下次冷启动复现一个用户已经撤掉的授权档。
 * - 读回只在 store 尚无显式双轴时生效(见 usePermissionAxesPersistence):
 *   本会话内用户刚做的选择永远优先于上一台的记忆。
 */

import * as React from 'react'
import { normalizeApprovalPolicy, normalizeSandboxMode, type AxisPair } from '@ihui/types'

import { useAiPanelStore } from '@/stores/ai-panel'

/** localStorage 键(仓内 `ihui_` 前缀风格,与 ihui_web_search_enabled 同档) */
export const PERMISSION_AXES_STORAGE_KEY = 'ihui_permission_axes'

function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    // 隐私模式 / 存储被禁用:按"没有记忆"处理,调用方照常跑默认语义
    return null
  }
}

/**
 * 读回上次显式选择的双轴;没有记录 / 记录认不出 / 只有半对 ⇒ null(不猜、不兜)。
 *
 * 归一走 `@ihui/types` 的 normalize*(与后端 permission_axis.py 同一份成员/别名),
 * 端内不写第二份枚举表。返回值必是两轴齐备的 `AxisPair`。
 */
export function readStoredPermissionAxes(
  storage: Storage | null = defaultStorage(),
): AxisPair | null {
  if (!storage) return null
  let raw: string | null = null
  try {
    raw = storage.getItem(PERMISSION_AXES_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null || raw === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const record = parsed as Record<string, unknown>
  const sandboxMode = normalizeSandboxMode(record.sandboxMode)
  const approvalPolicy = normalizeApprovalPolicy(record.approvalPolicy)
  // 半对 = 认不出的一侧:整对判失效,绝不补默认档(方向相反的失真)
  if (sandboxMode === null || approvalPolicy === null) return null
  return { sandboxMode, approvalPolicy }
}

/** 写入显式双轴;`null` = 清掉记忆(用户撤回到"跟随单轴")。 */
export function writeStoredPermissionAxes(
  pair: AxisPair | null,
  storage: Storage | null = defaultStorage(),
): void {
  if (!storage) return
  try {
    if (pair === null) {
      storage.removeItem(PERMISSION_AXES_STORAGE_KEY)
      return
    }
    storage.setItem(PERMISSION_AXES_STORAGE_KEY, JSON.stringify(pair))
  } catch {
    // 隐私模式 / quota 超出:静默失败;读侧会按"没有记忆"处理,不会读到半成品
  }
}

/**
 * 挂载一次即完成"读回 + 变化即落盘"。
 *
 * 只挂在权限弹层(PermissionModePopover,由输入框常驻渲染)上,不散在各调用点:
 * 双轴的写入口只有 store 的 setPermissionAxes 一处,这里订阅它就覆盖了
 * 选择器点选、弹层/斜杠命令切单轴时的清空、以及未来新增的写入口。
 */
export function usePermissionAxesPersistence(): void {
  React.useEffect(() => {
    const panel = useAiPanelStore.getState()
    if (panel.permissionAxes === null) {
      const stored = readStoredPermissionAxes()
      if (stored !== null) panel.setPermissionAxes(stored)
    }
    return useAiPanelStore.subscribe((state, prev) => {
      if (state.permissionAxes === prev.permissionAxes) return
      writeStoredPermissionAxes(state.permissionAxes)
    })
    // 只在挂载时接线一次:读写实现无外部依赖,重跑只会重复挂监听
  }, [])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
