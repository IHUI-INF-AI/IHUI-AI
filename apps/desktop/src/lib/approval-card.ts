// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 2026-10-26 立:desktop 审批卡组件(框架无关版,对标 web `PageClient` 的审批区)。
//
// desktop 本地没有 React,这里用原生 DOM 构建一张审批卡(纯函数式渲染:输入 task + 回调 ⇒ 返回 HTMLElement)。
// `renderApprovalDeck` 负责把一组待审委派 diff 挂载到容器,供 Tauri webview 内或本地覆盖层直接使用。

import type { TaskDispatch } from '@ihui/shared/tasks/dispatch'

export interface ApprovalCardHandlers {
  onApprove: (taskId: string) => void
  onDeny: (taskId: string) => void
}

const APPROVAL_STATE_LABEL: Record<string, string> = {
  awaiting: '待审批',
  approved: '已放行',
  denied: '已拒绝',
  expired: '已过期',
  stopped: '已停止',
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

/**
 * 渲染单张审批卡(对标 PageClient 的 amber 审批块):
 * 命令文案 + 发起/执行设备 + 时间 + 放行/拒绝两个按钮。
 */
export function renderApprovalCard(
  task: TaskDispatch,
  handlers: ApprovalCardHandlers,
): HTMLElement {
  const card = el('div', 'ihui-approval-card')
  card.dataset.taskId = task.id

  card.appendChild(el('code', 'ihui-approval-cmd', task.command))

  const meta = el('div', 'ihui-approval-meta')
  meta.appendChild(el('span', undefined, `发起: ${task.fromDevice}`))
  meta.appendChild(el('span', undefined, `执行: ${task.toDevice}`))
  const created = task.createdAt ? new Date(task.createdAt).toLocaleString() : ''
  if (created) meta.appendChild(el('span', undefined, created))
  card.appendChild(meta)

  const actions = el('div', 'ihui-approval-actions')
  const approve = el('button', 'ihui-approval-approve', '放行')
  approve.type = 'button'
  approve.addEventListener('click', () => handlers.onApprove(task.id))
  const deny = el('button', 'ihui-approval-deny', '拒绝')
  deny.type = 'button'
  deny.addEventListener('click', () => handlers.onDeny(task.id))
  actions.appendChild(approve)
  actions.appendChild(deny)
  card.appendChild(actions)

  if (task.approval) {
    const st = APPROVAL_STATE_LABEL[task.approval.state] ?? task.approval.state
    card.appendChild(el('span', 'ihui-approval-state', st))
  }

  return card
}

/**
 * 把一组待审委派渲染进容器(按 task.id diff,避免重复重建导致按钮丢焦点/重复绑定)。
 * 返回是否渲染了任何卡片。
 */
export function renderApprovalDeck(
  container: HTMLElement,
  pending: TaskDispatch[],
  handlers: ApprovalCardHandlers,
): boolean {
  const wanted = new Set(pending.map((t) => t.id))
  // 移除不再待审的卡
  for (const child of Array.from(container.children)) {
    const id = (child as HTMLElement).dataset.taskId
    if (id && !wanted.has(id)) container.removeChild(child)
  }
  // 新增/更新
  for (const task of pending) {
    const existing = container.querySelector<HTMLElement>(`[data-task-id="${CSS.escape(task.id)}"]`)
    const fresh = renderApprovalCard(task, handlers)
    if (existing) {
      container.replaceChild(fresh, existing)
    } else {
      container.appendChild(fresh)
    }
  }
  return pending.length > 0
}
