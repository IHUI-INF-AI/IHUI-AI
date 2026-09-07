// © 2026 IHUI AI (智汇AI) · 版权所有�? 李春�?(Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追�?(Apache-2.0 须保留本声明�?NOTICE)�?// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { createPersistConfig } from './persist-helpers'
import { useChatStore } from './chat'

/** AI 侧边 docked 面板默认宽度
 * - 2026-08-02 �?用户规则"默认宽度设置�?80"):
 *   默认 380px,�?localStorage 残留�?persist migrate version 3�? 强制覆盖�?380�? * - 1022px 全屏宽度�?isMobile 误判 bug(已在 ai-side-panel.tsx 修复,阈�?1023�?68),与本常量无关�? */
export const AI_PANEL_DEFAULT_WIDTH = 300
export const AI_PANEL_MIN_WIDTH = 300
export const AI_PANEL_MAX_WIDTH = 720

/** AI 面板当前绑定的本地工作区(参�?Trae/Codex 顶部 project selector 设计)
 *  - 用户�?AI 面板顶部"添加工作�?按钮选择本地文件夹后绑定
 *  - 绑定后标题显�?workspace.name,取代兜底"空工作区"文字
 *  - path 用于后续 AI 工具调用 fs.read/grep 等的根路径上下文
 *  - mode/techStack 来自 LocalFolderPicker 权限配置,�?UI 显示权限模式徽章 */
export interface ActiveWorkspace {
  path: string
  name: string
  /** 权限模式:default(默认需审计)/ accept-edits(自动接受编辑)/ bypass-permissions(完全跳过) */
  mode?: 'default' | 'accept-edits' | 'bypass-permissions'
  /** 技术栈标签数组(逗号分隔�?techStack 字符串拆�?,用于 UI 显示技术栈 chip */
  techStack?: string[]
}

/** 浮窗默认位置(右上角偏�? */
export const FLOAT_DEFAULT_POSITION = { x: -1, y: -1 } // -1 = 未初始化,首次使用时计算右上角

interface AiPanelState {
  /** 面板是否展开(全局唯一,任何路由可触�? */
  open: boolean
  /** 用户拖拽后的宽度(持久�? */
  width: number
  /** 拖拽中标�?禁用过渡动画) */
  isResizing: boolean
  /** 当前绑定的本地工作区(持久�?刷新后保�? */
  activeWorkspace: ActiveWorkspace | null
  /**
   * 工作区按对话隔离(2026-09-04 �?响应"工作区没有根据对话隔�?反馈):
   * conversationId �?该对话绑定的工作区。切换会话时�?ai-side-panel 的同�?effect
   * 换装 activeWorkspace;绑定/解绑�?setActiveWorkspace 内部同步写回映射�?   * - key 存在值为 null = 该对话显式解绑过工作�?   * - key 不存�?= 从未绑定(老会话切换时视为解绑)
   * 持久�?刷新后保留绑定关系�?   */
  conversationWorkspaces: Record<string, ActiveWorkspace | null>
  /**
   * 待确认权限的工作�?2026-07-25 �?深度对标 Codex approval setup):
   * 用户�?WorkspaceSelector 绑定新工作区但该工作区尚未配置权�?perm=null)�?
   * 写入此字段。由 ai-side-panel 监听并弹 WorkspacePermissionDialog,
   * 用户在弹窗选定模式�?回写 activeWorkspace.mode + 清空 pendingPermissionSetup�?   * 不持久化:刷新页面后若 perm 仍为 null,需用户重新触发绑定流程(避免旧状态误�?�?   */
  pendingPermissionSetup: { path: string; name: string; techStack?: string[] } | null
  /** 待确认启用完全访问模�?2026-07-25 �?首次启用高风险模式弹确认弹窗) */
  pendingFullAccess: boolean
  /**
   * 未绑定工作区时暂存的权限模式(2026-08-31 �?响应�?�?   * 以前�?sessionStorage,但按�?currentMode 不读�?�?切换后按钮文�?样式永远停在
   * "请求批准"不变�?P0 UI bug)。改�?store 内响应式状�?
   * - popover/Shift+Tab/斜杠命令在无 activeWorkspace 时写入此字段
   * - 绑定工作区时�?workspace-selector 应用�?activeWorkspace.mode 并清�?   * - 不持久化(会话�?刷新丢失可接�?与原 sessionStorage 行为一�?
   */
  pendingPermissionMode: 'default' | 'accept-edits' | 'bypass-permissions' | null
  /** 浮窗模式:docked(flex �?�?floating(fixed 可拖�? */
  floatMode: boolean
  /** 浮窗最小化:只显�?FAB 按钮,点击展开完整面板 */
  floatMinimized: boolean
  /** 浮窗折叠�?只显示输入框,点击展开按钮拉出完整面板(对话历史+header) */
  floatCollapsed: boolean
  /** 浮窗位置(视口坐标,持久�? */
  floatPosition: { x: number; y: number }
  /** 工作展示区折叠�?true = 隐藏右侧 work-area,AI 面板占满(2026-08-17 用户需�? */
  workAreaCollapsed: boolean
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
  setWidth: (w: number) => void
  setResizing: (v: boolean) => void
  setActiveWorkspace: (ws: ActiveWorkspace | null) => void
  /** 把当�?activeWorkspace(可为 null)绑定到指定会�?新建会话/分支时调�? */
  bindWorkspaceToConversation: (conversationId: string) => void
  setPendingPermissionSetup: (
    v: { path: string; name: string; techStack?: string[] } | null,
  ) => void
  setPendingFullAccess: (v: boolean) => void
  setPendingPermissionMode: (v: 'default' | 'accept-edits' | 'bypass-permissions' | null) => void
  setFloatMode: (v: boolean) => void
  setFloatMinimized: (v: boolean) => void
  toggleWorkAreaCollapsed: () => void
  setFloatCollapsed: (v: boolean) => void
  setFloatPosition: (pos: { x: number; y: number }) => void
}

/**
 * 全局 AI docked 面板状态�? * - open 不持久化:每次刷新默认展开(2026-07-19 �?符合"AI 对话框默认弹�?的全局设定)
 *   merge 函数强制覆盖 rehydrate 后的 open=true,防止旧版�?localStorage 残留�?open=false 干扰
 * - width 持久�?保留用户拖拽偏好
 */
export const useAiPanelStore = create<AiPanelState>()(
  persist(
    (set) => ({
      // open=true:AI 对话框默认弹出展开(用户规则 2026-07-20 确认)
      open: true,
      width: AI_PANEL_DEFAULT_WIDTH,
      isResizing: false,
      activeWorkspace: null,
      conversationWorkspaces: {},
      pendingPermissionSetup: null,
      pendingFullAccess: false,
      pendingPermissionMode: null,
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
      setActiveWorkspace: (ws) =>
        set((s) => {
          // 工作区按对话隔离(2026-09-04):当前有会话时,绑定/解绑同步写回映射,
          // 保证切换会话后各对话恢复各自的工作区;无会�?新对�?仅更新当前�?
          // �?send-message 创建会话后由 bindWorkspaceToConversation 补挂到该会话�?          const cid = useChatStore.getState().conversationId
          if (cid) {
            return {
              activeWorkspace: ws,
              conversationWorkspaces: { ...s.conversationWorkspaces, [cid]: ws },
            }
          }
          return { activeWorkspace: ws }
        }),
      bindWorkspaceToConversation: (conversationId) =>
        set((s) => ({
          conversationWorkspaces: {
            ...s.conversationWorkspaces,
            [conversationId]: s.activeWorkspace,
          },
        })),
      setPendingPermissionSetup: (v) => set({ pendingPermissionSetup: v }),
      setPendingFullAccess: (v: boolean) => set({ pendingFullAccess: v }),
      setPendingPermissionMode: (v) => set({ pendingPermissionMode: v }),
      setFloatMode: (v: boolean) => set({ floatMode: v }),
      setFloatMinimized: (v: boolean) => set({ floatMinimized: v }),
      toggleWorkAreaCollapsed: () => set((s) => ({ workAreaCollapsed: !s.workAreaCollapsed })),
      setFloatCollapsed: (v: boolean) => set({ floatCollapsed: v }),
      setFloatPosition: (pos: { x: number; y: number }) => set({ floatPosition: pos }),
    }),
    {
      ...createPersistConfig<AiPanelState>('ihui-ai-panel', (s) => ({
        width: s.width,
        activeWorkspace: s.activeWorkspace,
        // 会话级工作区映射持久�?2026-09-04):刷新后各对话绑定关系保留
        conversationWorkspaces: s.conversationWorkspaces,
      })),
      // 强制 open=true:rehydrate 时即�?localStorage 残留旧版�?open=false 也覆盖为 true�?      // 保证"AI 对话框默认弹�?规则在所有刷新场景下生效�?      //
      // floatMode/floatPosition 不持久化(2026-08-01 �?用户规则"默认状态应该在侧边栏和工作区中�?):
      // 旧版本曾持久�?floatMode,�?ai-side-panel.tsx 的移动端 effect(isMobile && !floatMode)
      // �?setFloatMode(true) 并被持久�?导致回到桌面端刷新后仍为浮窗�?违反默认 docked 期望�?      // 现改为会话级状�?每次刷新回到 docked 默认�?移动�?effect 仅在当前会话生效不污染桌面端�?      // merge 显式强制 floatMode:false + floatPosition:默认�?忽略�?localStorage 残留�?true�?      //
      // 2026-08-02 version 0�?�?�?�? 迁移(用户规则"默认宽度设置�?80"):
      // - v0→v1:�?width < 680 提升�?680(漏了 width > 680)
      // - v1→v2:无论 width 多少强制设为 680(用户反馈没生�?
      // - v2→v3:强制设为 460 验证 migrate 生效(用户确认生效)
      // - v3→v4(本次):强制设为 380(用户最终偏�?
      //   用户后续拖拽正常持久�?setWidth �?MIN 320 / MAX 720 钳制)
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
        // 强制非最小化/非折�?防旧版本 localStorage 残留 floatMinimized:true
        // 导致 AI 对话框默认收�?FAB(用户规则:默认展开正常�?
        floatMinimized: false,
        floatCollapsed: false,
        floatPosition: FLOAT_DEFAULT_POSITION,
      }),
    },
  ),
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
