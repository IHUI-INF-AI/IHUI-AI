import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'

/** AI 侧边 docked 面板默认宽度
 * - 2026-08-02 立(用户规则"默认宽度设置为380"):
 *   默认 380px,旧 localStorage 残留由 persist migrate version 3→4 强制覆盖为 380。
 * - 1022px 全屏宽度是 isMobile 误判 bug(已在 ai-side-panel.tsx 修复,阈值 1023→768),与本常量无关。
 */
export const AI_PANEL_DEFAULT_WIDTH = 380
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

/** 浮窗默认位置(右上角偏移) */
export const FLOAT_DEFAULT_POSITION = { x: -1, y: -1 } // -1 = 未初始化,首次使用时计算右上角

interface AiPanelState {
  /** 面板是否展开(全局唯一,任何路由可触发) */
  open: boolean
  /** 用户拖拽后的宽度(持久化) */
  width: number
  /** 拖拽中标记(禁用过渡动画) */
  isResizing: boolean
  /** 当前绑定的本地工作区(持久化,刷新后保留) */
  activeWorkspace: ActiveWorkspace | null
  /**
   * 待确认权限的工作区(2026-07-25 立,深度对标 Codex approval setup):
   * 用户在 WorkspaceSelector 绑定新工作区但该工作区尚未配置权限(perm=null)时,
   * 写入此字段。由 ai-side-panel 监听并弹 WorkspacePermissionDialog,
   * 用户在弹窗选定模式后:回写 activeWorkspace.mode + 清空 pendingPermissionSetup。
   * 不持久化:刷新页面后若 perm 仍为 null,需用户重新触发绑定流程(避免旧状态误弹)。
   */
  pendingPermissionSetup: { path: string; name: string; techStack?: string[] } | null
  /** 待确认启用完全访问模式(2026-07-25 立,首次启用高风险模式弹确认弹窗) */
  pendingFullAccess: boolean
  /** 浮窗模式:docked(flex 流)→ floating(fixed 可拖拽) */
  floatMode: boolean
  /** 浮窗最小化:只显示 FAB 按钮,点击展开完整面板 */
  floatMinimized: boolean
  /** 浮窗折叠态:只显示输入框,点击展开按钮拉出完整面板(对话历史+header) */
  floatCollapsed: boolean
  /** 浮窗位置(视口坐标,持久化) */
  floatPosition: { x: number; y: number }
  /**
   * 工作展示区折叠态(2026-08-17 用户需求):
   * true = 隐藏右侧 work-area(主内容区 + 内置浏览器),AI 面板占满右侧;
   * false = 恢复 work-area,AI 面板回默认宽度。不持久化,会话级。
   */
  workAreaCollapsed: boolean
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  setWidth: (w: number) => void
  setResizing: (v: boolean) => void
  setActiveWorkspace: (ws: ActiveWorkspace | null) => void
  setPendingPermissionSetup: (
    v: { path: string; name: string; techStack?: string[] } | null,
  ) => void
  setPendingFullAccess: (v: boolean) => void
  setFloatMode: (v: boolean) => void
  setFloatMinimized: (v: boolean) => void
  setFloatCollapsed: (v: boolean) => void
  setFloatPosition: (pos: { x: number; y: number }) => void
  toggleWorkAreaCollapsed: () => void
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
      pendingPermissionSetup: null,
      pendingFullAccess: false,
      floatMode: false,
      floatMinimized: false,
      floatCollapsed: false,
      floatPosition: FLOAT_DEFAULT_POSITION,
      workAreaCollapsed: false,

      openPanel: () => set({ open: true }),
      closePanel: () => set({ open: false }),
      togglePanel: () => set((s) => ({ open: !s.open })),
      setWidth: (w) =>
        set({
          width: Math.min(AI_PANEL_MAX_WIDTH, Math.max(AI_PANEL_MIN_WIDTH, w)),
        }),
      setResizing: (v: boolean) => set({ isResizing: v }),
      setActiveWorkspace: (ws) => set({ activeWorkspace: ws }),
      setPendingPermissionSetup: (v) => set({ pendingPermissionSetup: v }),
      setPendingFullAccess: (v: boolean) => set({ pendingFullAccess: v }),
      setFloatMode: (v: boolean) => set({ floatMode: v }),
      setFloatMinimized: (v: boolean) => set({ floatMinimized: v }),
      setFloatCollapsed: (v: boolean) => set({ floatCollapsed: v }),
      setFloatPosition: (pos: { x: number; y: number }) => set({ floatPosition: pos }),
      toggleWorkAreaCollapsed: () => set((s) => ({ workAreaCollapsed: !s.workAreaCollapsed })),
    }),
    {
      ...createPersistConfig<AiPanelState>('ihui-ai-panel', (s) => ({
        width: s.width,
        activeWorkspace: s.activeWorkspace,
      })),
      // 强制 open=true:rehydrate 时即使 localStorage 残留旧版本 open=false 也覆盖为 true。
      // 保证"AI 对话框默认弹出"规则在所有刷新场景下生效。
      //
      // floatMode/floatPosition 不持久化(2026-08-01 立,用户规则"默认状态应该在侧边栏和工作区中间"):
      // 旧版本曾持久化 floatMode,但 ai-side-panel.tsx 的移动端 effect(isMobile && !floatMode)
      // 会 setFloatMode(true) 并被持久化,导致回到桌面端刷新后仍为浮窗态,违反默认 docked 期望。
      // 现改为会话级状态:每次刷新回到 docked 默认态,移动端 effect 仅在当前会话生效不污染桌面端。
      // merge 显式强制 floatMode:false + floatPosition:默认值,忽略旧 localStorage 残留的 true。
      //
      // 2026-08-02 version 0→1→2→3→4 迁移(用户规则"默认宽度设置为380"):
      // - v0→v1:仅 width < 680 提升到 680(漏了 width > 680)
      // - v1→v2:无论 width 多少强制设为 680(用户反馈没生效)
      // - v2→v3:强制设为 460 验证 migrate 生效(用户确认生效)
      // - v3→v4(本次):强制设为 380(用户最终偏好)
      //   用户后续拖拽正常持久化(setWidth 受 MIN 320 / MAX 720 钳制)
      version: 4,
      migrate: (persistedState: unknown, version: number) => {
        const s = (persistedState as Partial<AiPanelState>) || {}
        if (version < 4 && typeof s.width === 'number') {
          s.width = AI_PANEL_DEFAULT_WIDTH
        }
        return s as Partial<AiPanelState>
      },
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...((persistedState as Partial<AiPanelState>) || {}),
        open: true,
        floatMode: false,
        // 强制非最小化/非折叠:防旧版本 localStorage 残留 floatMinimized:true
        // 导致 AI 对话框默认收成 FAB(用户规则:默认展开正常态)
        floatMinimized: false,
        floatCollapsed: false,
        floatPosition: FLOAT_DEFAULT_POSITION,
      }),
    },
  ),
)
