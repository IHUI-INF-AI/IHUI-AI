// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import type { BatchConversationAction } from '@ihui/api-client'
import { Button, Checkbox } from '@ihui/ui-react'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'

/**
 * 侧栏批量动作条(V3 #62 第 62 票)。
 *
 * 契约:它**不持有**选中集 —— 全部选中状态由 useConversationSelection 单一持有者
 * 经 props 传入。这样"已选 N 项"与行内复选框不可能分叉。
 * 唯一的本地状态是"批量删除二次确认"这个瞬时 UI 态(不是选中集,不构成第二真相)。
 *
 * 动作面只放侧栏已有的行内语义(归档 / 取消归档 / 删除):侧栏行菜单里从来没有
 * "收藏",所以这里不凭空补一个批量收藏(/chat/history 整页列表有,是它自己的面)。
 */
export interface ConversationBatchBarProps {
  /** 当前可见且被选中的数量 */
  selectedCount: number
  /** 当前可见列表总数(为 0 时全选不可用) */
  totalCount: number
  /** 全选(复选框打勾) */
  allSelected: boolean
  /** 部分选中(复选框 indeterminate) */
  someSelected: boolean
  /** 批量请求在飞:所有动作互斥,避免两个批量写并行打架 */
  busy: boolean
  /** 全选 / 全不选 */
  onToggleAll: (checked: boolean) => void
  /** 反选 */
  onInvert: () => void
  /** 发起批量动作(delete 会先走二次确认,由本组件内部拦下) */
  onBatch: (action: BatchConversationAction) => void
  /**
   * 「取消选择」= 清空选中,但**留在**多选态。
   * 退出多选态的开关是标题行那枚 aria-pressed 的切换按钮,不重复一个出口:
   * 一个按钮同时"清空"和"退出",用户想重挑就得再点一次开关。
   */
  onCancel: () => void
}

export function ConversationBatchBar({
  selectedCount,
  totalCount,
  allSelected,
  someSelected,
  busy,
  onToggleAll,
  onInvert,
  onBatch,
  onCancel,
}: ConversationBatchBarProps) {
  const t = useTranslations('chatHistory')
  const [pendingBatchDelete, setPendingBatchDelete] = useState(false)
  // 一次只能有一个动作在飞;删除二次确认打开时其余动作也一并禁用,避免
  // 确认框还在读旧的 count 而列表已被另一个动作改掉。
  const disabled = busy || selectedCount === 0

  return (
    <>
      <div
        role="group"
        aria-label={t('selectedCount', { count: selectedCount })}
        aria-live="polite"
        data-testid="conversation-batch-bar"
        className="flex flex-wrap items-center gap-1 px-1.5 py-1"
      >
        <Checkbox
          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
          onCheckedChange={(checked) => onToggleAll(checked === true)}
          disabled={totalCount === 0}
          aria-label={t('selectAll')}
          data-testid="batch-select-all"
        />
        <span className="min-w-0 truncate text-[11px] font-medium tabular-nums text-muted-foreground">
          {t('selectedCount', { count: selectedCount })}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={onInvert}
          disabled={disabled || totalCount === 0}
          data-testid="batch-invert"
        >
          <span>{t('invertSelection')}</span>
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onBatch('archive')}
          disabled={disabled}
          data-testid="batch-archive"
        >
          <Archive className="mr-1 h-3.5 w-3.5" />
          <span>{t('batchArchive')}</span>
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => onBatch('unarchive')}
          disabled={disabled}
          data-testid="batch-unarchive"
        >
          <ArchiveRestore className="mr-1 h-3.5 w-3.5" />
          <span>{t('batchUnarchive')}</span>
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="text-destructive"
          onClick={() => setPendingBatchDelete(true)}
          disabled={disabled}
          data-testid="batch-delete-btn"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          <span>{t('batchDelete')}</span>
        </Button>
        <Button
          variant="ghost"
          size="xs"
          onClick={onCancel}
          disabled={busy}
          data-testid="batch-cancel"
        >
          <span>{t('cancelSelection')}</span>
        </Button>
      </div>

      <ConfirmDialog
        open={pendingBatchDelete}
        title={t('batchDelete')}
        content={t('confirmBatchDelete', { count: selectedCount })}
        confirmText={t('batchDelete')}
        cancelText={t('cancelSelection')}
        variant="danger"
        loading={busy}
        onConfirm={() => {
          setPendingBatchDelete(false)
          onBatch('delete')
        }}
        onCancel={() => setPendingBatchDelete(false)}
      />
    </>
  )
}
