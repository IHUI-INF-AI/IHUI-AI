import { create } from 'zustand'

import type { Rule, RuleInput, RuleUpdate } from '@ihui/types'

/**
 * Rules 管理 UI 状态 store(2026-07-22 立,对标 Trae IDE Rules)。
 *
 * 数据获取由 use-rules.ts 的 react-query 负责,本 store 只管 UI 态:
 *  - editingRule:当前编辑的规则(null=关闭编辑面板)
 *  - isCreating:是否在新建模式
 *  - testDialogRule:当前打开测试对话框的规则
 *  - testMessage / testResult:测试输入 + 结果
 *  - optimisticRules:乐观更新缓存(react-query 刷新前临时显示)
 */

interface RulesUiState {
  editingRule: Rule | null
  isCreating: boolean
  testDialogRule: Rule | null
  testMessage: string
  testResult: { matched: boolean; reason: string } | null
  testing: boolean

  startCreate: () => void
  startEdit: (rule: Rule) => void
  closeEditor: () => void
  openTestDialog: (rule: Rule) => void
  closeTestDialog: () => void
  setTestMessage: (msg: string) => void
  setTestResult: (result: { matched: boolean; reason: string } | null) => void
  setTesting: (testing: boolean) => void
}

export const useRulesStore = create<RulesUiState>((set) => ({
  editingRule: null,
  isCreating: false,
  testDialogRule: null,
  testMessage: '',
  testResult: null,
  testing: false,

  startCreate: () =>
    set({ isCreating: true, editingRule: null }),
  startEdit: (rule) =>
    set({ editingRule: rule, isCreating: false }),
  closeEditor: () =>
    set({ editingRule: null, isCreating: false }),
  openTestDialog: (rule) =>
    set({ testDialogRule: rule, testMessage: '', testResult: null }),
  closeTestDialog: () =>
    set({ testDialogRule: null, testMessage: '', testResult: null }),
  setTestMessage: (msg) => set({ testMessage: msg }),
  setTestResult: (result) => set({ testResult: result }),
  setTesting: (testing) => set({ testing }),
}))

/** 优先级 Badge 颜色:高 ≥70 绿 / 中 30-69 黄 / 低 <30 灰 */
export function priorityVariant(
  priority: number,
): 'default' | 'secondary' | 'outline' {
  if (priority >= 70) return 'default'
  if (priority >= 30) return 'secondary'
  return 'outline'
}

/** 作用域中文标签 */
export function scopeLabel(scope: Rule['scope']): string {
  switch (scope) {
    case 'global':
      return '全局'
    case 'workspace':
      return '工作区'
    case 'agent':
      return 'Agent'
    default:
      return scope
  }
}

/** 匹配类型中文标签 */
export function matchTypeLabel(matchType: Rule['matchType']): string {
  switch (matchType) {
    case 'always':
      return '始终'
    case 'keyword':
      return '关键词'
    case 'regex':
      return '正则'
    case 'semantic':
      return '语义'
    default:
      return matchType
  }
}

export type { Rule, RuleInput, RuleUpdate }
