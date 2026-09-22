// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom
/**
 * hooks-manager / inline-diff-card 取词回归测试(2026-09-23 硬编码中文存量清理批次 A)
 *
 * 两层判据:
 * 1. 静态:两个组件源码剥离注释后不得再出现任何 CJK 字符(硬编码中文回潮即红)。
 * 2. 渲染:模块级常量表(EVENT_OPTIONS / ACTION_TYPE_OPTIONS / NOTIFY_CHANNEL_OPTIONS /
 *    ACTION_LABEL_KEY / STATUS_BADGE)存的是 i18n **键名**,必须在渲染处经 t() 解析成文案 ——
 *    断言"取词结果"出现在 DOM,而不是断言源码里的中文字符串(后者正是本次清理前的假象)。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { render, screen, cleanup as rlCleanup } from '@testing-library/react'

const ROOT = resolve(__dirname, '..')
const HOOKS_MANAGER = resolve(ROOT, 'src/components/hooks/hooks-manager.tsx')
const INLINE_DIFF_CARD = resolve(ROOT, 'src/components/ai/inline-diff-card.tsx')

/** 去掉行注释 / 块注释 / JSX 注释,只留真实代码 */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

// ─── next-intl mock:命中词表返回中文,未命中回显键名(不影响断言) ───────────
const HOOKS_ZH: Record<string, string> = {
  manageTitle: 'Hook 管理',
  create: '新建 Hook',
  loading: '加载中',
  disabled: '已禁用',
  viewLogs: '查看日志',
  edit: '编辑',
  fieldName: '名称',
  fieldDescription: '描述',
  fieldEvent: '触发事件',
  fieldActionType: '动作类型',
  'event.toolBefore': '工具调用前',
  'event.sessionEnd': '会话结束',
  'action.script': '脚本',
  'action.log': '日志',
  'action.notify': '通知',
  'channel.email': '邮件',
  testResultTitle: '测试结果',
}
const COMMON_ZH: Record<string, string> = {
  delete: '删除',
  cancel: '取消',
  save: '保存',
  create: '创建',
  close: '关闭',
}
const AI_PANE_ZH: Record<string, string> = {
  'diffStatus.pending': '待确认',
  'diffStatus.applied': '已应用',
  'changes.newFile': '新文件',
  'diffHunk.rejected': '已拒绝',
  'diffHunk.applyingSelected': '应用中',
}

function makeT(table: Record<string, string>) {
  const fn = (key: string, values?: Record<string, string | number>) => {
    const text = table[key] ?? key
    if (!values) return text
    return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''))
  }
  return Object.assign(fn, {
    raw: (key: string) => table[key] ?? key,
    has: (key: string) => key in table,
  })
}

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) =>
    ns === 'common' ? makeT(COMMON_ZH) : ns === 'ai.pane' ? makeT(AI_PANE_ZH) : makeT(HOOKS_ZH),
}))

// ─── 数据层 mock:不触发 react-query / api-client ─────────────────────────
const DRAFT = {
  id: 'h1',
  name: 'demo-hook',
  description: '',
  event: 'tool.before',
  condition: '',
  actionType: 'script',
  webhookUrl: '',
  webhookMethod: 'POST',
  webhookHeaders: '',
  webhookBody: '',
  scriptCommand: '',
  notifyChannel: 'toast',
  notifyMessage: '',
  logMessage: '',
}
let editorMode: 'closed' | 'create' | 'edit' = 'closed'

vi.mock('@/stores/hooks', () => ({
  useHooksStore: () => ({
    draft: DRAFT,
    editorMode,
    testResult: null,
    viewingLogsHookId: null,
    testingHookId: null,
    openCreate: vi.fn(),
    openEdit: vi.fn(),
    openLogs: vi.fn(),
    closeEditor: vi.fn(),
    closeLogs: vi.fn(),
    setDraft: vi.fn(),
    setTestingHookId: vi.fn(),
    setTestResult: vi.fn(),
  }),
  draftToCreateInput: (d: unknown) => d,
  draftToUpdateInput: (d: unknown) => d,
}))

vi.mock('@/hooks/use-hooks', () => ({
  useHooks: () => ({
    hooks: [
      {
        id: 'h1',
        name: 'demo-hook',
        description: '',
        enabled: false,
        event: 'tool.before',
        action: { type: 'script' },
      },
    ],
    isLoading: false,
    isCreating: false,
    isUpdating: false,
    isTesting: false,
    createHook: vi.fn(),
    updateHook: vi.fn(),
    deleteHook: vi.fn(),
    toggleHook: vi.fn(),
    testHook: vi.fn(),
  }),
  useHookLogs: () => ({ logs: [], isLoading: false }),
}))

vi.mock('@/hooks/use-confirm', () => ({
  useConfirm: () => ({ confirm: vi.fn(), ConfirmDialogRenderer: () => null }),
}))

import { HooksManager } from '../src/components/hooks/hooks-manager'

afterEach(() => {
  rlCleanup()
})

describe('硬编码中文存量清理(批次 A)静态判据', () => {
  it('hooks-manager.tsx 剥离注释后无 CJK 字符', () => {
    const residue = stripComments(readFileSync(HOOKS_MANAGER, 'utf8')).match(/[\u3400-\u9fff]/g)
    expect(residue, `仍存在硬编码中文: ${residue?.slice(0, 8).join('')}`).toBeNull()
  })

  it('inline-diff-card.tsx 剥离注释后无 CJK 字符', () => {
    const residue = stripComments(readFileSync(INLINE_DIFF_CARD, 'utf8')).match(/[\u3400-\u9fff]/g)
    expect(residue, `仍存在硬编码中文: ${residue?.slice(0, 8).join('')}`).toBeNull()
  })
})

describe('HooksManager 取词渲染', () => {
  it('列表态:标题/按钮/aria 名全部来自 t()', () => {
    editorMode = 'closed'
    render(<HooksManager />)
    expect(screen.getByText('Hook 管理')).toBeTruthy()
    expect(screen.getAllByText('新建 Hook').length).toBeGreaterThan(0)
    expect(screen.getByText('已禁用')).toBeTruthy()
    expect(screen.getByLabelText('查看日志')).toBeTruthy()
    expect(screen.getByLabelText('编辑')).toBeTruthy()
    expect(screen.getByLabelText('删除')).toBeTruthy()
    // 动作徽章走 ACTION_LABEL_KEY → t(),不再是常量表里的中文
    expect(screen.getByText('脚本')).toBeTruthy()
  })

  it('编辑器态:Field label 与下拉 option 均经 t() 解析', () => {
    editorMode = 'edit'
    render(<HooksManager />)
    expect(screen.getByText('名称')).toBeTruthy()
    expect(screen.getByText('描述')).toBeTruthy()
    expect(screen.getByText('触发事件')).toBeTruthy()
    expect(screen.getByText('动作类型')).toBeTruthy()
    expect(screen.getByText('工具调用前')).toBeTruthy()
    expect(screen.getByText('会话结束')).toBeTruthy()
    expect(screen.getByText('日志')).toBeTruthy()
    expect(screen.getByText('取消')).toBeTruthy()
    expect(screen.getByText('保存')).toBeTruthy()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
