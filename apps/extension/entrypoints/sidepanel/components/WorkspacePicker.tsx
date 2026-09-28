// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useI18n } from '../../../src/i18n'
import {
  clearActiveWorkspace,
  pickWorkspaceDirectory,
  subscribeActiveWorkspace,
  type ActiveWorkspace,
  type WorkspaceFailure,
  type WorkspaceFailureKind,
} from '../../../lib/workspace-store'

/**
 * 侧栏的"选择本地工作区目录"入口(票㉑ 展示层)。
 *
 * 状态与取句柄都在 lib/workspace-store(唯一真相源),本文件只做两件事:
 * 订阅活动工作区并在用户手势里把 pick 交出去。
 */

/**
 * 失败态要不要出文案 —— aborted / unsupported 一律不出:
 * 取消不是故障,能力缺失时本端今天的行为就是"点了没反应",这里不新造一套提示语。
 * 唯一允许出的两档(denied / not-writable)也只回显 DOMException 的 name,
 * 因为界面文案必须走语言包,而这里没有为它登记任何新键。
 */
export function shouldShowFailure(kind: WorkspaceFailureKind): boolean {
  return kind === 'denied' || kind === 'not-writable'
}

export function WorkspacePicker() {
  const { t } = useI18n()
  const [workspace, setWorkspace] = useState<ActiveWorkspace | null>(null)
  const [failure, setFailure] = useState<WorkspaceFailure | null>(null)

  // subscribeActiveWorkspace 的返回值就是取消函数,必须原样交给 React 做卸载清理,
  // 否则换一个目录时 emit 会打到已经卸载的面板。
  useEffect(() => subscribeActiveWorkspace(setWorkspace), [])

  const handlePick = async (): Promise<void> => {
    const outcome = await pickWorkspaceDirectory()
    setFailure(outcome.failure)
  }

  if (workspace) {
    return (
      <div
        className="flex items-center gap-1.5 rounded-md border border-border bg-muted px-2 py-1.5 text-xs"
        data-testid="ext-workspace-picker"
      >
        <span className="min-w-0 flex-1 truncate text-foreground">{workspace.name}</span>
        <button
          type="button"
          aria-label={t('agent.permission')}
          className="shrink-0 cursor-pointer rounded-sm border border-border bg-transparent p-1 text-muted-foreground hover:bg-muted/60"
          data-testid="ext-workspace-clear"
          onClick={() => clearActiveWorkspace()}
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col" data-testid="ext-workspace-picker">
      <button
        type="button"
        className="w-fit cursor-pointer rounded-sm border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground hover:bg-muted/60"
        data-testid="ext-workspace-pick"
        onClick={() => {
          void handlePick()
        }}
      >
        <span>{t('apps.workspace')}</span>
      </button>
      {failure && shouldShowFailure(failure.kind) ? (
        <p
          className="mt-1 font-mono text-[11px] text-muted-foreground"
          data-testid="ext-workspace-failure"
        >
          {failure.detail}
        </p>
      ) : null}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
