// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

// D06 结构化代码审查 —— 审查对象选择条(S18,2026-10-24,输入区上方轻量条)。
//
// **数据面纪律(与 InputNoticeBanner 同族)**:本组件不取数 —— 不读 store、不跑 git、
// 不读文件。选择是纯受控值(`selection` 由调用方持有,`onChange` 上抛),diff/文件
// 内容收集归发送链(接线见 `./review-target-send.ts` 与 `message-input.tsx`)。visible
// 由调用方判(生产 = `currentMode === 'review'`),组件不耦合 mode store —— 多窗格分家后
// 发送链按窗格取 mode 实例,这里若自读 store 会读错窗格。
//
// 五档(票面「审查对象选择器」= 前三档;后两档为无 git 目标时的内联补充):
//   · 未提交改动(GitCompare)  —— 只读 `git diff HEAD`,由 slash 通道收集;
//   · 指定分支(GitBranch)     —— 只读 `git diff <ref>...HEAD`,同上;
//   · 指定 commit(GitCommitHorizontal) —— 只读 `git show <sha>`,同上;
//   · 指定文件(FileCode2)/ 粘贴片段(ClipboardPaste)—— 无 git 收集,内联进正文。
// 选中档再点一次 = 取消(onChange(null));须填值的档在条内展开 Input/textarea
// (紧凑档,§4:无分割线、lucide 图标、复用 ui-react)。ref 形状(分支名/SHA)不在这里判,
// 归 `review-context.ts`(单一判定点),本组件只负责取值。

import * as React from 'react'
import { useTranslations } from 'next-intl'
import {
  ClipboardPaste,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  GitCompare,
  X,
} from 'lucide-react'

import { Button, Input } from '@ihui/ui-react'

import { cn } from '@/lib/utils'
import type { ReviewSourceKind, ReviewSourceSelection } from './review-context'

export interface ReviewTargetSelectorProps {
  /** 是否渲染(生产 = currentMode === 'review';组件不读 mode store,见头注) */
  visible: boolean
  /** 当前选择(受控);null = 未选 */
  selection: ReviewSourceSelection | null
  /** 选择变化上抛;取消选择报 null */
  onChange: (next: ReviewSourceSelection | null) => void
  className?: string
  'data-testid'?: string
}

/** 五档(顺序即 UI 顺序;labelKey 挂 chat 命名空间)。 */
const KIND_OPTIONS: ReadonlyArray<{
  kind: ReviewSourceKind
  labelKey:
    | 'reviewTargetUncommitted'
    | 'reviewTargetBranch'
    | 'reviewTargetCommit'
    | 'reviewTargetFile'
    | 'reviewTargetSnippet'
  Icon: typeof GitCompare
}> = [
  { kind: 'uncommitted', labelKey: 'reviewTargetUncommitted', Icon: GitCompare },
  { kind: 'branch', labelKey: 'reviewTargetBranch', Icon: GitBranch },
  { kind: 'commit', labelKey: 'reviewTargetCommit', Icon: GitCommitHorizontal },
  { kind: 'file', labelKey: 'reviewTargetFile', Icon: FileCode2 },
  { kind: 'snippet', labelKey: 'reviewTargetSnippet', Icon: ClipboardPaste },
]

/** 需要条内展开单行输入的档(branch/commit/file 共用同一个受控 Input 形态)。 */
const REF_INPUTS: Partial<
  Record<ReviewSourceKind, { testId: string; labelKey: string; placeholderKey: string }>
> = {
  branch: {
    testId: 'review-target-branch-input',
    labelKey: 'reviewTargetBranchLabel',
    placeholderKey: 'reviewTargetBranchPlaceholder',
  },
  commit: {
    testId: 'review-target-commit-input',
    labelKey: 'reviewTargetCommitLabel',
    placeholderKey: 'reviewTargetCommitPlaceholder',
  },
  file: {
    testId: 'review-target-file-input',
    labelKey: 'reviewTargetFileLabel',
    placeholderKey: 'reviewTargetFilePlaceholder',
  },
}

/** 切档默认值:uncommitted 无值(diff 由发送链收集);其余从空内容起。 */
function initialSelection(kind: ReviewSourceKind): ReviewSourceSelection {
  return { kind, value: kind === 'uncommitted' ? null : '' }
}

/**
 * ReviewTargetSelector — review 模式下输入区上方的审查对象选择条(纯受控,2026-10-24 立)。
 */
export function ReviewTargetSelector({
  visible,
  selection,
  onChange,
  className,
  'data-testid': testId,
}: ReviewTargetSelectorProps) {
  const t = useTranslations('chat')
  const activeKind = selection?.kind ?? null
  const activeRefInput = activeKind ? REF_INPUTS[activeKind] : undefined

  const toggleKind = (kind: ReviewSourceKind): void => {
    onChange(activeKind === kind ? null : initialSelection(kind))
  }

  if (!visible) return null

  return (
    <div
      role="group"
      aria-label={t('reviewTargetGroupLabel')}
      data-testid={testId}
      className={cn('flex flex-col gap-1.5 rounded-md bg-muted/40 p-1.5', className)}
    >
      <div className="flex flex-wrap items-center gap-1">
        <span className="px-1 text-xs text-muted-foreground">{t('reviewTargetLabel')}</span>
        {KIND_OPTIONS.map(({ kind, labelKey, Icon }) => (
          <Button
            key={kind}
            type="button"
            variant={activeKind === kind ? 'secondary' : 'ghost'}
            size="xs"
            aria-pressed={activeKind === kind}
            onClick={() => toggleKind(kind)}
            data-testid={`review-target-kind-${kind}`}
          >
            <Icon aria-hidden />
            <span>{t(labelKey)}</span>
          </Button>
        ))}
        {selection && (
          <Button
            type="button"
            variant="ghost"
            size="icon-2xs"
            aria-label={t('reviewTargetClear')}
            onClick={() => onChange(null)}
            data-testid="review-target-clear"
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      {activeRefInput && selection && (
        <Input
          value={selection.value ?? ''}
          onChange={(e) => onChange({ kind: selection.kind, value: e.target.value })}
          placeholder={t(activeRefInput.placeholderKey)}
          aria-label={t(activeRefInput.labelKey)}
          data-testid={activeRefInput.testId}
          className="h-7 rounded-sm px-2 text-xs"
        />
      )}
      {selection?.kind === 'snippet' && (
        <textarea
          value={selection.value ?? ''}
          onChange={(e) => onChange({ kind: 'snippet', value: e.target.value })}
          placeholder={t('reviewTargetSnippetPlaceholder')}
          aria-label={t('reviewTargetSnippetLabel')}
          data-testid="review-target-snippet-input"
          rows={3}
          className="w-full resize-y rounded-sm border border-input bg-transparent px-2 py-1 font-mono text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none"
        />
      )}
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
