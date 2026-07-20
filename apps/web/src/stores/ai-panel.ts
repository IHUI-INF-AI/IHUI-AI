import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

/** AI 侧边 docked 面板默认宽度(对齐旧架构 _sidebar-layout.scss --ai-panel-default-width) */
export const AI_PANEL_DEFAULT_WIDTH = 400
export const AI_PANEL_MIN_WIDTH = 320
export const AI_PANEL_MAX_WIDTH = 720

/** AI 面板当前绑定的本地工作区(参考 Trae/Codex 顶部 project selector 设计)
 *  - 用户在 AI 面板顶部"添加工作区"按钮选择本地文件夹后绑定
 *  - 绑定后标题显示 workspace.name,取代兜底"空工作区"文字
 *  - path 用于后续 AI 工具调用 fs.read/grep 等的根路径上下文
 *  - mode/techStack 来自 LocalFolderPicker 权限配置,供 UI 显示权限模式徽章 */
export interface ActiveWorkspace {
  path: string
  name: string
  /** 权限模式:default(默认需审计)/ accept-edits(自动接受编辑)/ bypass-permissions(完全跳过) */
  mode?: 'default' | 'accept-edits' | 'bypass-permissions'
  /** 技术栈标签数组(逗号分隔的 techStack 字符串拆分),用于 UI 显示技术栈 chip */
  techStack?: string[]
}

interface AiPanelState {
  /** 面板是否展开(全局唯一,任何路由可触发) */
  open: boolean
  /** 用户拖拽后的宽度(持久化) */
  width: number
  /** 拖拽中标记(禁用过渡动画) */
  isResizing: boolean
  /** 当前绑定的本地工作区(持久化,刷新后保留) */
  activeWorkspace: ActiveWorkspace | null
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  setWidth: (w: number) => void
  setResizing: (v: boolean) => void
  setActiveWorkspace: (ws: ActiveWorkspace | null) => void
}

/**
 * 全局 AI docked 面板状态。
 * - open 不持久化:每次刷新默认展开(2026-07-19 改,符合"AI 对话框默认弹出"的全局设定)
 *   merge 函数强制覆盖 rehydrate 后的 open=true,防止旧版本 localStorage 残留的 open=false 干扰
 * - width 持久化:保留用户拖拽偏好
 */
export const useAiPanelStore = create<AiPanelState>()(
  persist(
    (set) => ({
      // open=true:AI 对话框默认弹出展开(用户规则 2026-07-20 确认)
      open: true,
      width: AI_PANEL_DEFAULT_WIDTH,
      isResizing: false,
      activeWorkspace: null,

      openPanel: () => set({ open: true }),
      closePanel: () => set({ open: false }),
      togglePanel: () => set((s) => ({ open: !s.open })),
      setWidth: (w) =>
        set({
          width: Math.min(AI_PANEL_MAX_WIDTH, Math.max(AI_PANEL_MIN_WIDTH, w)),
        }),
      setResizing: (v) => set({ isResizing: v }),
      setActiveWorkspace: (ws) => set({ activeWorkspace: ws }),
    }),
    {
      ...createPersistConfig<AiPanelState>('ihui-ai-panel', (s) => ({
        width: s.width,
        activeWorkspace: s.activeWorkspace,
      })),
      // 强制 open=true:rehydrate 时即使 localStorage 残留旧版本 open=false 也覆盖为 true。
      // 保证"AI 对话框默认弹出"规则在所有刷新场景下生效。
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...((persistedState as Partial<AiPanelState>) || {}),
        open: true,
      }),
    },
  ),
)
