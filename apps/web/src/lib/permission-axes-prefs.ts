// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * 双轴权限的本机记忆(2026-10-26 补,79 号票前端接线面)。
 *
 * 消费点唯一:[`permission-mode-popover`](apps/web/src/components/ai/permission-mode-popover.tsx)
 * 在输入框常驻挂载处调用本 hook —— 读回上次选择,并在 `store.permissionAxes` 变化时落盘
 * (含「跟随单轴」时的清空)。
 *
 * 语义边界:
 * - 只记**显式双轴**;单轴模式不进本机记忆(单轴仍走服务端偏好,与本模块无关)。
 * - 读回失败/取值不合法 ⇒ 当作没存过(不猜、不补默认档):`SANDBOX_MODES` /
 *   `APPROVAL_POLICIES` 是唯一合法域,来自 `@ihui/types`,本文件不新增字面量档位。
 * - localStorage 读写全部包 try(隐私模式/配额满会抛),失败静默,不影响聊天主流程。
 */

import * as React from 'react'
import { APPROVAL_POLICIES, SANDBOX_MODES, type AxisPair } from '@ihui/types'
import { useAiPanelStore } from '@/stores/ai-panel'

export const PERMISSION_AXES_STORAGE_KEY = 'ihui-permission-axes'

function isAxisPair(value: unknown): value is AxisPair {
  if (!value || typeof value !== 'object') return false
  const pair = value as Record<string, unknown>
  return (
    typeof pair.sandboxMode === 'string' &&
    (SANDBOX_MODES as readonly string[]).includes(pair.sandboxMode) &&
    typeof pair.approvalPolicy === 'string' &&
    (APPROVAL_POLICIES as readonly string[]).includes(pair.approvalPolicy)
  )
}

/** 读回本机记忆;没有/坏了/读不到 ⇒ null(调用方不得据此补默认档)。 */
export function readStoredPermissionAxes(storage?: Pick<Storage, 'getItem'>): AxisPair | null {
  try {
    const raw = (storage ?? window.localStorage).getItem(PERMISSION_AXES_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isAxisPair(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 写入/清空本机记忆(传 null = 跟随单轴,删除键)。 */
export function writeStoredPermissionAxes(
  pair: AxisPair | null,
  storage?: Pick<Storage, 'setItem' | 'removeItem'>,
): void {
  try {
    const target = storage ?? window.localStorage
    if (!pair) {
      target.removeItem(PERMISSION_AXES_STORAGE_KEY)
      return
    }
    target.setItem(PERMISSION_AXES_STORAGE_KEY, JSON.stringify(pair))
  } catch {
    /* 隐私模式/配额满:本机记忆不可用,不影响请求 */
  }
}

/**
 * 挂载即读回 + 变化即落盘。
 *
 * `ready` 闸是刻意的:首帧 store 恒为 null,不能把「还没读回」读成「用户清空了记忆」
 * 去删键 —— 否则每次刷新都会先抹掉记忆再读成空。
 */
export function usePermissionAxesPersistence(): void {
  const axes = useAiPanelStore((s) => s.permissionAxes)
  const setPermissionAxes = useAiPanelStore((s) => s.setPermissionAxes)
  const ready = React.useRef(false)

  React.useEffect(() => {
    const stored = readStoredPermissionAxes()
    if (stored) setPermissionAxes(stored)
    ready.current = true
  }, [setPermissionAxes])

  React.useEffect(() => {
    if (!ready.current) return
    writeStoredPermissionAxes(axes)
  }, [axes])
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
