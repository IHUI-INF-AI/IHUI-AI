'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '@/components/common'
import {
  streamChat,
  formatSSEError,
  postToolResult,
  type FallbackEvent,
  type ToolDelegateEvent,
  type ToolSummaryEvent,
} from '@ihui/api-client'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'

import { useChatStore } from '@/stores/chat'
import type { ToolCall } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useModeStore } from '@/stores/mode'
import type { ChatMode } from '@ihui/types'
import type { PlanStep, TerminalTask } from '@ihui/types/ai'
import { useWorkPanelStore } from '@/stores/work-panel'
import { useApplyDiff } from '@/hooks/use-apply-diff'
import {
  createConversation,
  sendMessage as persistMessage,
  persistQuestion,
} from '@ihui/api-client'
import { fetchApi } from '@/lib/api'
import { openLoginDialogOnce } from '@/lib/login-dialog-trigger'
import { logger } from '@/lib/logger'
import { isTauri } from '@/lib/tauri-bridge'
import { loadWorkspaceContext, getBrowserWorkspaceHandle } from '@/lib/workspace-context-loader'
import { executeWorkspaceTool } from '@/lib/workspace-tool-executor'
import {
  mapSpawnToTimelineEvent,
  mapProgressToTimelineUpdate,
  mapEndToTimelineUpdate,
} from '@/lib/subagent-timeline-mapper'
import { useTimelineStore } from '@/stores/timeline-store'
import { getModelContextCapacity, formatTokenCount } from '@/lib/model-context-capacity'
import type { InlineDiffInfo } from '@/components/ai/types'
import { isFullAccessConfirmSuppressed } from '@/components/ai/full-access-confirm-dialog'

/** 自媒体斜杠命令 API 返回数据 */
interface SlashCommandData {
  ok?: boolean
  title?: string
  mdPath?: string
  duration_ms?: number
  error?: string
  stdout?: string
  date?: string
  articlesCount?: number
  outputPath?: string
  articles?: Array<Record<string, unknown>>
}

/** 自媒体斜杠命令 fetchApi 结果 */
interface SlashCommandResult {
  success: boolean
  error?: string
  data?: SlashCommandData
}

// 斜杠命令 → 自媒体 skill 直调映射(避免走 LLM chat 流,直接调 skill API)
// /wechat-article <title>  → POST /api/self-media/wechat/generate {title, dryRun:true}
// /koubo-script <MMDD>     → POST /api/self-media/koubo/generate {date, dryRun:true}
// /auto-task <taskId> <HH:MM> [titleTemplate]  → POST /api/self-media/automation/tasks/:taskId/config
//   taskId: wechat_daily | koubo_daily(仅这 2 个内置任务可配置)
//   时间格式: HH:MM(24 小时制),默认 09:00
//   titleTemplate: 可选,仅 wechat_daily 用,支持 {date} 占位符
const SELF_MEDIA_SLASH_MAP = {
  '/wechat-article': {
    endpoint: '/api/self-media/wechat/generate', // method: POST
    parseArgs: (rest: string) => ({ title: rest || '今日公众号文章' }),
    format: (r: SlashCommandResult) => {
      if (!r.success) return `❌ 公众号文章生成失败: ${r.error || '未知错误'}`
      const d: SlashCommandData = r.data || {}
      const ok = d.ok ?? false
      const lines = [
        `### 公众号文章生成 ${ok ? '✅' : '⚠️'}`,
        `- 标题: ${d.title || ''}`,
        `- md 路径: ${d.mdPath || '(无)'}`,
        `- 耗时: ${d.duration_ms ?? 0} ms`,
      ]
      if (d.error) lines.push(`- 错误: ${d.error}`)
      if (d.stdout) lines.push('\n```\n' + String(d.stdout).slice(0, 2000) + '\n```')
      return lines.join('\n')
    },
  },
  '/koubo-script': {
    endpoint: '/api/self-media/koubo/generate', // method: POST
    parseArgs: (rest: string) => {
      // rest 可能是 "MMDD" 或 "MMDD 选题方向"
      const [date, ...topicParts] = rest.split(/\s+/)
      return { date: date || '0720', topic: topicParts.join(' ') }
    },
    format: (r: SlashCommandResult) => {
      if (!r.success) return `❌ 口播稿生成失败: ${r.error || '未知错误'}`
      const d: SlashCommandData = r.data || {}
      const ok = d.ok ?? false
      const lines = [
        `### 口播稿生成 ${ok ? '✅' : '⚠️'}`,
        `- 日期: ${d.date || ''}`,
        `- 篇数: ${d.articlesCount ?? 0}`,
        `- 输出: ${d.outputPath || '(无)'}`,
        `- 耗时: ${d.duration_ms ?? 0} ms`,
      ]
      if (d.error) lines.push(`- 错误: ${d.error}`)
      const articles: Array<Record<string, unknown>> = d.articles || []
      if (articles.length) {
        lines.push('\n---')
        for (const a of articles.slice(0, 8)) {
          lines.push(`\n#### 第 ${a.index} 篇\n\n${a.content || ''}`)
        }
      }
      return lines.join('\n')
    },
  },
} as const

/** /auto-task 斜杠命令:配置自媒体自动化定时任务(2026-07-22 新增)
 *  格式:/auto-task <taskId> <HH:MM> [titleTemplate]
 *  示例:/auto-task wechat_daily 09:00
 *        /auto-task koubo_daily 08:00
 *  说明:直接调 /api/self-media/automation/tasks/:taskId/config,不走 LLM chat 流 */
async function tryHandleAutoTaskSlash(
  text: string,
  onResult: (assistantContent: string) => void,
): Promise<boolean> {
  const trimmed = text.trim()
  if (
    trimmed !== '/auto-task' &&
    !trimmed.startsWith('/auto-task ') &&
    !trimmed.startsWith('/auto-task\n')
  ) {
    return false
  }
  const rest = trimmed.slice('/auto-task'.length).trim()
  const [taskIdRaw, timeRaw, ...titleParts] = rest.split(/\s+/)
  const taskId = taskIdRaw === 'koubo_daily' ? 'koubo_daily' : 'wechat_daily'
  const [h, m] = (timeRaw || '09:00').split(':').map(Number)
  const hour = typeof h === 'number' && Number.isFinite(h) && h >= 0 && h <= 23 ? h : 9
  const minute = typeof m === 'number' && Number.isFinite(m) && m >= 0 && m <= 59 ? m : 0
  const titleTemplate = titleParts.join(' ') || undefined
  try {
    const r = await fetchApi<{
      ok: boolean
      message?: string
      error?: string
      config?: { dry_run?: boolean; enabled?: boolean }
    }>(`/api/self-media/automation/tasks/${encodeURIComponent(taskId)}/config`, {
      method: 'POST',
      body: JSON.stringify({
        hour,
        minute,
        dry_run: true,
        enabled: true,
        ...(titleTemplate ? { title_template: titleTemplate } : {}),
      }),
    })
    if (!r.success) {
      onResult(`❌ 自动化任务配置失败: ${r.error}`)
      return true
    }
    const d = r.data
    if (!d.ok) {
      onResult(`❌ 自动化任务配置失败: ${d.message || d.error || '未知错误'}`)
      return true
    }
    const cfg = d.config || {}
    const lines = [
      `### 自动化任务配置 ✅`,
      `- 任务 ID: ${taskId}`,
      `- 执行时间: 每天 ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      `- dry-run: ${cfg.dry_run ? '是' : '否'}`,
      `- 已启用: ${cfg.enabled ? '是' : '否'}`,
    ]
    if (titleTemplate) lines.push(`- 标题模板: ${titleTemplate}`)
    lines.push(`\n请在自动化任务页面查看详情,点击"立即触发"可测试运行。`)
    onResult(lines.join('\n'))
  } catch (e: unknown) {
    onResult(`❌ /auto-task 调用失败: ${e instanceof Error ? e.message : String(e)}`)
  }
  return true
}

/** /plan & /act 动作型斜杠命令(2026-07-25 立,对标 Trae SOLO Plan 模式)
 * - /plan [可选说明]:切换到 ChatMode.plan(只读分析,deny write 工具)。后续说明文字被忽略(纯动作命令)。
 * - /act [可选说明]:切换到 ChatMode.build(正常执行,全工具开放,默认)。
 * - /build /review /spec 同理(2026-07-28 补全 ChatMode 4 态 / 命令通道)。
 * - 命中即返回 true,不发送给 LLM,清空输入框。toast 给反馈。
 * - 仅当输入完全匹配 /plan /act /build /review /spec 开头(后接空白或行尾)时命中,避免误伤。 */
function tryHandlePlanModeSlash(text: string): boolean {
  const trimmed = text.trimStart()
  // /plan /act /build /review /spec → ChatMode 4 态(2026-07-28 移除独立 PlanActToggle 后,/plan /act 直接走 ChatMode)
  const m = /^\/(plan|act|build|review|spec)\b\s*/.exec(trimmed)
  if (!m) return false
  const raw = m[1]
  // 映射:plan/act → ChatMode(act=build 语义一致,plan=plan 语义一致)
  const target: ChatMode = raw === 'act' ? 'build' : (raw as ChatMode)
  const modeStore = useModeStore.getState()
  if (modeStore.currentMode === target) {
    // 已是目标模式:不重复切换,仅 toast 提示当前模式
    const label =
      target === 'build'
        ? '构建'
        : target === 'plan'
          ? '计划'
          : target === 'review'
            ? '审查'
            : '规格'
    toast.info(`当前已是${label}模式`)
    return true
  }
  modeStore.setMode(target)
  const label =
    target === 'build' ? '构建' : target === 'plan' ? '计划' : target === 'review' ? '审查' : '规格'
  const desc =
    target === 'build'
      ? 'AI 将正常执行,全工具开放(Ctrl+1 可快速切换)'
      : target === 'plan'
        ? 'AI 将只读分析,不执行写工具(Ctrl+2 可快速切换)'
        : target === 'review'
          ? 'AI 将只读审查(Ctrl+3 可快速切换)'
          : 'AI 将从代码反向生成 spec 文档(Ctrl+4 可快速切换)'
  toast.success(`已切换到${label}模式`, { description: desc })
  return true
}

/** /build /review /spec 动作型斜杠命令(2026-07-28 立,补全 ChatMode 4态三通道)
 * - /build:  切换到构建模式(正常执行,全工具开放)
 * - /review: 切换到审查模式(只读审查,deny write 工具 + 强化审查 prompt)
 * - /spec:   切换到规格模式(从代码反向生成 spec 文档)
 * - 命中即返回 true,不发送给 LLM,清空输入框。toast 给反馈。
 * - 仅当输入完全匹配 /build /review /spec 开头(后接空白或行尾)时命中。
 * - t: next-intl 翻译函数(由 useChat hook 顶层 useTranslations('chat') 传入,
 *   因模块级函数无法直接调 hook,2026-07-28 i18n 补全) */
function tryHandleChatModeSlash(
  text: string,
  t: (key: string, vars?: Record<string, string>) => string,
): boolean {
  const trimmed = text.trimStart()
  const m = /^\/(build|review|spec)\b\s*/.exec(trimmed)
  if (!m) return false
  const target = m[1] as 'build' | 'review' | 'spec'
  const modeStore = useModeStore.getState()
  const labelKey =
    target === 'build' ? 'modeBuild' : target === 'review' ? 'modeReview' : 'modeSpec'
  const label = t(labelKey)
  if (modeStore.currentMode === target) {
    toast.info(t('modeAlreadyActive', { mode: label }))
    return true
  }
  modeStore.setMode(target)
  const descKey =
    target === 'build' ? 'modeBuildDesc' : target === 'review' ? 'modeReviewDesc' : 'modeSpecDesc'
  toast.success(t('modeSwitched', { mode: label }), { description: t(descKey) })
  return true
}

/** /permission ask|auto|full 动作型斜杠命令(2026-07-25 深化,深度对标 Codex approvalMode CLI)
 * - /permission ask:切换到 default 模式(请求批准,默认)
 * - /permission auto:切换到 accept-edits 模式(自动接受编辑)
 * - /permission full:切换到 bypass-permissions 模式(完全访问,高风险)
 * - 必须以 /permission 开头,后接 ask/auto/full + 空白或行尾(避免误伤 /permissioned 等)
 * - 命中即清空输入框 + 走 switchPermissionMode 切换模式
 * - 纯 UI 状态切换,不需要登录,不调用 LLM,不需要创建会话
 * - 切换失败时回滚 + toast 报错
 * - 切到 full → 5s 撤销 toast(与 PermissionModePopover 一致体验)
 * - 首次切到 full + 未在 localStorage 静默 → 走 store.pendingFullAccess,
 *   由 message-input 渲染 FullAccessConfirmDialog,确认后切模式 */
async function tryHandlePermissionSlash(text: string): Promise<boolean> {
  const trimmed = text.trimStart()
  // 必须以 /permission 开头,后接 ask/auto/full + 空白或行尾
  const m = /^\/permission\s+(ask|auto|full)\b\s*$/.exec(trimmed)
  if (!m) return false
  const target = m[1] as 'ask' | 'auto' | 'full'
  // 注:此函数内部不能直接调 useTranslations(非 React 组件),
  // 借助 useAiPanelStore 共享状态,让已挂载的 toast 监听器来显示。
  // 但 toast 是瞬时反馈,直接在内部硬编码调 sonner(2026-07-25 收尾时改用 i18n)
  const { switchPermissionMode } = await import('@/components/ai/permission-mode-popover')
  const modeMap: Record<'ask' | 'auto' | 'full', WorkspacePermissionMode> = {
    ask: 'default',
    auto: 'accept-edits',
    full: 'bypass-permissions',
  }
  const targetMode = modeMap[target]
  // 已是目标模式:不重复切换,仅 toast 提示
  const currentMode = useAiPanelStore.getState().activeWorkspace?.mode
  if (currentMode === targetMode) {
    // 已是目标模式 → 不切换,提示用户(2026-07-25 收尾:用 i18n 替代硬编码)
    // 通过动态 import 加载 useTranslations hook 不可行(hook 必须在组件顶层)
    // 改用预定义文案 map(由 use-chat 调用方提供 i18n,或直接硬编码英文 fallback)
    const label = target === 'ask' ? 'Ask' : target === 'auto' ? 'Auto-approve' : 'Full access'
    toast.info(`Already in ${label} mode`)
    return true
  }
  // 切到 full + 首次启用 + 未静默 → 弹确认弹窗(2026-07-25 深化,深度对标 Codex safety guard)
  // 由 message-input 的 FullAccessConfirmBridge 监听 store.pendingFullAccess 渲染 Dialog
  if (target === 'full' && !isFullAccessConfirmSuppressed()) {
    useAiPanelStore.getState().setPendingFullAccess(true)
    return true
  }
  // 切换模式(乐观更新 + 落库 + 失败回滚)
  const result = await switchPermissionMode(targetMode)
  if (!result.ok) {
    toast.error(`Permission mode switch failed: ${result.error ?? 'unknown'}`)
    return true
  }
  // 切完模式 → 把刚被 message-input useEffect 占位为 'popover' 的最新一条记录
  // source 改为 'slash'(2026-07-25 深化,来源精细化)
  try {
    const { updateLatestRecordSource } = await import('@/lib/permission-mode-history')
    updateLatestRecordSource('slash', (e) => e.mode === targetMode)
  } catch {
    // permission-mode-history 模块不可用时静默(避免 slash 命令主流程受阻)
  }
  // 切到 full → 5s 撤销 toast(与 PermissionModePopover 一致体验)
  if (target === 'full' && result.previousMode) {
    toast('Switched to full access', {
      description: `AI can now run any action without confirmation (undo within 5s, previous:${result.previousMode})`,
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          await switchPermissionMode(result.previousMode!)
        },
      },
    })
  } else if (target === 'auto') {
    toast.success('Switched to auto-approve', {
      description: 'Only asks before running detected risky actions',
      duration: 3000,
    })
  } else if (target === 'ask' && result.previousMode === 'bypass-permissions') {
    toast.success('Switched to ask for approval', {
      description: 'Always asks before editing files outside this project or using the internet',
      duration: 3000,
    })
  }
  return true
}

/** 关键词 → ChatMode 映射(2026-07-28 立,AI 自动判断模式)
 * - 与原 mode-switcher.tsx 的 SUGGEST_KEYWORDS 完全一致,迁移到 use-chat.ts
 *   统一为单一事实源,移除 4 按钮后避免散落
 * - 关键词匹配采用"首次命中优先"策略,与文本子串 includes() 检测
 * - 优先级顺序:plan → build → review → spec(数组顺序决定优先级)
 * - 中英文混排:关键词里既包含中文("修改"/"分析")也包含英文("build"/"plan")
 *   兼容用户纯英文输入或中英混输场景 */
const SUGGEST_KEYWORDS: { mode: ChatMode; keywords: string[] }[] = [
  {
    mode: 'plan',
    keywords: ['调研', '分析', '了解', '看看', '查看', '研究', '探索', '梳理', 'plan'],
  },
  {
    mode: 'build',
    keywords: ['修改', '实现', '重构', '添加', '删除', '编写', '创建', '修复', '更新', 'build'],
  },
  { mode: 'review', keywords: ['审查', '检查', '对比', '评审', 'review', 'diff'] },
  { mode: 'spec', keywords: ['规格', '规范', '契约', 'spec', 'specification'] },
]

/** 根据用户输入文本推荐 ChatMode(关键词匹配,首次命中优先)
 * - 输入为空 → 返回 null
 * - 命中关键词 → 返回对应 mode
 * - 未命中 → 返回 null(保持当前模式)
 *
 * 设计原则(2026-07-28 立,用户规则"AI 自动决策"):
 * - 保留关键词匹配 + 命中即切换的轻量启发式
 * - 不引入 LLM/embedding(轻量、毫秒级、可解释)
 * - 漏命中场景下保持当前模式,LLM 仍可正常工作(模式只是约束 write 工具) */
function suggestMode(userInput: string): ChatMode | null {
  if (!userInput.trim()) return null
  const text = userInput.toLowerCase()
  for (const { mode, keywords } of SUGGEST_KEYWORDS) {
    if (keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return mode
    }
  }
  return null
}

/** AI 自动判断模式(2026-07-28 立,移除 4 按钮后由 AI 决定用哪种模式)
 * - 时机:在 sendMessage 流程中,所有显式 /命令拦截后、createConversation 前
 *   用户敲完消息按发送,才触发自动切换(避免边输入边跳)
 * - 静默切换(无 toast):自动判断是辅助能力,反复提示会刷屏
 *   当前模式徽章(apps/web/src/components/chat/message-input.tsx CurrentModeBadge)会
 *   实时反映新模式,提供视觉反馈
 * - 仅当建议模式 ≠ 当前模式时才切换(避免无意义的 setState)
 * - 已在 plan/build 等模式(用户主动选择)下不打扰:
 *   例如用户已显式 /review,后续普通对话不会自动改回 build
 *   (因为关键词不命中会返回 null,保持当前模式)
 *
 * 边界场景:
 * - 短文本"看看" → 命中 plan → 自动切到只读分析
 * - 长 prompt 包含多关键词 → 数组优先级优先(plan 优先于 build)
 * - 无关键词 → 保持当前模式不变
 */
function tryAutoDetectMode(text: string): void {
  const suggested = suggestMode(text)
  if (!suggested) return
  const modeStore = useModeStore.getState()
  if (modeStore.currentMode === suggested) return
  modeStore.setMode(suggested)
}

async function tryHandleSelfMediaSlash(
  text: string,
  onResult: (assistantContent: string) => void,
): Promise<boolean> {
  // 返回 true 表示命中斜杠命令(已调 skill),false 表示走原 chat 流程
  // 优先检查 /auto-task(独立处理,因 endpoint 含路径参数)
  if (await tryHandleAutoTaskSlash(text, onResult)) return true
  const trimmed = text.trim()
  const matched = Object.keys(SELF_MEDIA_SLASH_MAP).find(
    (cmd) => trimmed === cmd || trimmed.startsWith(cmd + ' ') || trimmed.startsWith(cmd + '\n'),
  )
  if (!matched) return false
  const cfg = SELF_MEDIA_SLASH_MAP[matched as keyof typeof SELF_MEDIA_SLASH_MAP]
  const rest = trimmed.slice(matched.length).trim()
  const body = cfg.parseArgs(rest)
  try {
    const r = await fetchApi<SlashCommandData>(cfg.endpoint, {
      method: 'POST',
      body: JSON.stringify({ ...body, dryRun: true }),
    })
    onResult(cfg.format(r))
  } catch (e: unknown) {
    onResult(`❌ ${matched} 调用失败: ${e instanceof Error ? e.message : String(e)}`)
  }
  return true
}

/** Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
 *  传入 streamChat → api /ai/chat/stream → ai-service /api/llm/complete/stream
 *  ai-service 收到后从 mcp_server 加载完整 schema,走 tool loop(complete→tool_calls→execute→astream)
 *  2026-07-27 补齐 12 核心 MCP 工具(read_file/search_codebase/file_search 等),共 34 个 */
const AGENT_TOOLS = [
  // ===== 核心 MCP 工具(2026-07-27 补齐,对标 Trae Work + Codex 工具集)=====
  // 之前只传 browser/computer 工具,LLM 看不到 read_file/search_codebase 等核心工具 schema,
  // 导致用户问"读一下 xxx 文件"时 LLM 无法调用 read_file,只能瞎编。
  // 现在补齐普通用户可用的核心工具(admin only 工具由后端 mcp_server 权限检查兜底)。
  'read_file',
  'search_codebase',
  'file_search',
  'analyze_code',
  'generate_test',
  'web_search',
  'search_web',
  'vision_analyze',
  'knowledge_lookup',
  // 2026-08-02 移除:dispatch_subagent 不应在默认 AGENT_TOOLS 中
  // LLM 对简单问题也会调用 subagent,导致 subagent 执行失败(空输出/超时)→ 前端显示"执行失败"
  // 改为按需启用:仅在用户明确选择"Agent 模式"时通过 mergeAgentTools 动态添加
  'summarize_artifacts',
  'proactive_suggestion',
  // 12 browser tools
  'browser_screenshot',
  'browser_click_element',
  'browser_type_text',
  'browser_scroll',
  'browser_navigate',
  'browser_extract_dom',
  'browser_wait_for_element',
  'browser_get_attribute',
  'browser_hover',
  'browser_select_option',
  'browser_switch_tab',
  'browser_close_tab',
  // 10 computer tools
  'computer_screenshot_screen',
  'computer_mouse_move',
  'computer_mouse_click',
  'computer_keyboard_type',
  'computer_mouse_scroll',
  'computer_keyboard_press',
  'computer_keyboard_hotkey',
  'computer_active_window',
  'computer_clipboard_get',
  'computer_clipboard_set',
] as const

/**
 * 插件市场 pluginId → ai-service MCP 工具名映射(2026-07-22 立)。
 *
 * 用户在插件市场点击"+"添加到对话后,selectedTools 存 pluginId。
 * sendMessage 时通过 mergeAgentTools() 把对应 MCP 工具名合并到 agentTools,
 * 传给后端 ai-service /api/llm/complete/stream。
 *
 * 仅 realIntegrated=true 的插件有真实 MCP 工具映射;'model' 接入类和
 * 仅 prompt 意图类无映射,不参与 mergeAgentTools(避免污染 AGENT_TOOLS)。
 */
const PLUGIN_ID_TO_TOOLS: Record<string, readonly string[]> = {
  // 12 browser tools(所有浏览器类插件共用同一组 browser_* 工具)
  'playwright-mcp': [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  puppeteer: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  'browser-use': [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  stagehand: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  skyvern: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  selenium: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  playwright: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  multion: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  axiom: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  brightdata: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  browserbase: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  browserless: [
    'browser_screenshot',
    'browser_click_element',
    'browser_type_text',
    'browser_scroll',
    'browser_navigate',
    'browser_extract_dom',
    'browser_wait_for_element',
    'browser_get_attribute',
    'browser_hover',
    'browser_select_option',
    'browser_switch_tab',
    'browser_close_tab',
  ],
  // 10 computer tools(所有电脑控制类插件共用同一组 computer_* 工具)
  'anthropic-computer-use': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  'open-interpreter': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  'auto-gpt': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  babyagi: [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  'self-operating-computer': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  'claude-desktop': [
    'computer_screenshot_screen',
    'computer_mouse_move',
    'computer_mouse_click',
    'computer_keyboard_type',
    'computer_mouse_scroll',
    'computer_keyboard_press',
    'computer_keyboard_hotkey',
    'computer_active_window',
    'computer_clipboard_get',
    'computer_clipboard_set',
  ],
  // 其他真集成插件:filesystem / postgres / search / code-exec / github / langgraph
  'filesystem-mcp': ['read_file', 'write_file'],
  'postgres-mcp': ['db_query'],
  duckduckgo: ['search_web'],
  'code-interpreter-mcp': ['run_command'],
  e2b: ['run_command'],
  'github-mcp': ['run_command'],
  langgraph: ['run_command'],
} as const

/**
 * 合并默认 AGENT_TOOLS + 用户已选插件对应的 MCP 工具(2026-07-22 立)。
 *
 * 调用时机:sendMessage / sendAnswer 构造 streamChat 参数前。
 * 去重保证工具名唯一,ai-service 收到后从 mcp_server 加载完整 schema。
 *
 * 阶段 2(2026-08-02 立):恢复 fs 类工具(read_file/search_codebase/file_edit 等)。
 * 阶段 1 在 web 非 Tauri 环境下移除这些工具(因 ai-service 在远程服务器无法访问本地文件);
 * 阶段 2 实现"前端工具执行代理"后,LLM 调用 fs 工具时 ai-service 通过 SSE tool-delegate
 * 事件委托前端用 FileSystemDirectoryHandle 执行,通过 POST API 回传结果,恢复 tool loop。
 */
function mergeAgentTools(): string[] {
  const selected = useChatStore.getState().selectedTools
  const extra = selected.flatMap((id) => PLUGIN_ID_TO_TOOLS[id] ?? [])
  return [...new Set([...AGENT_TOOLS, ...extra])]
}

/**
 * 加载浏览器端工作区上下文(2026-08-02 立,阶段 1 核心)。
 *
 * 仅在 web 非 Tauri 环境下生效:
 *   1. 从 ai-panel store 取 activeWorkspace.name
 *   2. 用 name 从 module-level Map 取 FileSystemDirectoryHandle
 *   3. 用 handle 遍历读取工作区关键文件,返回格式化 context 字符串
 *
 * Tauri 桌面端返回 undefined,走原有 workspacePath 逻辑(ai-service 直接读本地文件)。
 *
 * 缓存:同一工作区只加载一次,切换工作区后自动重新加载。
 */
let cachedBrowserContext: { name: string; text: string } | null = null

async function loadBrowserWorkspaceContext(): Promise<string | undefined> {
  // Tauri 桌面端走 workspacePath,不需要 workspaceContext
  if (isTauri()) return undefined
  // 非 Tauri 环境:从 ai-panel store 拿 activeWorkspace
  const ws = useAiPanelStore.getState().activeWorkspace
  if (!ws?.name) return undefined
  // 缓存命中(同一工作区不重复加载)
  if (cachedBrowserContext && cachedBrowserContext.name === ws.name) {
    return cachedBrowserContext.text
  }
  const handle = getBrowserWorkspaceHandle(ws.name)
  if (!handle) return undefined
  try {
    const result = await loadWorkspaceContext(handle)
    cachedBrowserContext = { name: ws.name, text: result.text }
    logger.info(
      `[workspace-context] loaded ${result.stats.fileCount} files, ` +
        `${result.stats.totalSize} bytes, truncated=${result.stats.truncated}`,
    )
    return result.text
  } catch (err) {
    logger.warn('[workspace-context] load failed:', err)
    return undefined
  }
}

/** 浏览器类工具:命中即自动在右侧 WorkPanel 打开 URL(2026-07-22 立,P2 联动) */
const BROWSER_TOOL_NAMES = new Set([
  'browser_navigate',
  'browser_click',
  'browser_extract',
  'browser_screenshot',
  'web_search',
  'fetch-url',
  'fetch_url',
  'web_fetch',
])

/** 从 tool args/result 提取 URL(与 tool-call-card.tsx extractUrl 逻辑一致) */
function extractToolUrl(args?: Record<string, unknown>, result?: unknown): string | null {
  if (args) {
    const fromArgs =
      (args.url as string) ||
      (args.href as string) ||
      (args.link as string) ||
      (args.target as string)
    if (typeof fromArgs === 'string' && /^https?:\/\//i.test(fromArgs)) return fromArgs
  }
  if (typeof result === 'string') {
    const match = result.match(/https?:\/\/[^\s"'<>]+/i)
    if (match) return match[0]
  } else if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    const fromResult = (obj.url as string) || (obj.href as string) || (obj.link as string)
    if (typeof fromResult === 'string' && /^https?:\/\//i.test(fromResult)) return fromResult
  }
  if (Array.isArray(result)) {
    const first = result.find((r) => {
      if (typeof r === 'object' && r !== null) {
        const u = (r as Record<string, unknown>).url
        return typeof u === 'string' && /^https?:\/\//i.test(u)
      }
      return false
    })
    if (first) return (first as Record<string, unknown>).url as string
  }
  return null
}

/** onToolCall 工厂:绑定 assistantMessageId,生成统一 handler 给 streamChat 用 */
function createToolCallHandler(assistantMessageId: string) {
  return (event: {
    type: 'tool-call-start' | 'tool-result'
    toolCallId: string
    toolName: string
    args?: Record<string, unknown>
    result?: unknown
    isError?: boolean
    iteration?: number
    repeated?: boolean
    // 2026-07-31 立,AI 对话可视化:工具来源标识(从 SSE 透传到 ToolCallCard 徽章)
    serverSource?: 'builtin' | 'plugin' | 'mcp'
    serverId?: string
    serverName?: string
  }) => {
    if (event.type === 'tool-call-start') {
      useChatStore.getState().addToolCall(assistantMessageId, {
        id: event.toolCallId,
        toolName: event.toolName,
        args: event.args ?? {},
        status: 'running',
        iteration: event.iteration,
        serverSource: event.serverSource,
        serverId: event.serverId,
        serverName: event.serverName,
      })
      // browser_navigate 类工具:args 含 url 时立即打开 WorkPanel(无需等 result)
      if (BROWSER_TOOL_NAMES.has(event.toolName) && event.args) {
        const url = extractToolUrl(event.args)
        if (url) {
          useWorkPanelStore.getState().openPanel({ url, source: 'ai-tool' })
        }
      }
    } else {
      // tool-result
      const updates: Partial<ToolCall> = {
        status: event.isError ? 'error' : 'success',
        result: event.result,
        serverSource: event.serverSource,
        serverId: event.serverId,
        serverName: event.serverName,
      }
      if (event.args) updates.args = event.args
      if (event.iteration !== undefined) updates.iteration = event.iteration
      // 后端 repeated: true 标记(同 tool_name + 同 args 已执行过,跳过实际调用)
      if (event.repeated === true) updates.repeated = true
      useChatStore.getState().updateToolCall(assistantMessageId, event.toolCallId, updates)

      // tool-result 含 URL:延迟打开(仅当之前 args 没 url 时,result 含 url 的场景)
      if (!BROWSER_TOOL_NAMES.has(event.toolName)) return
      const url = extractToolUrl(event.args, event.result)
      if (url) {
        useWorkPanelStore.getState().openPanel({ url, source: 'ai-tool' })
      }
    }
  }
}

/**
 * onToolSummary 工厂(2026-07-31 立,AI 对话可视化深度接入):
 * 绑定 assistantMessageId,把 SSE tool-summary 事件聚合结果写入 message.toolCallSummary,
 * 让 ToolCallSummary 组件在 AI 回复末尾展示"搜索文件 N 个/网页 N 个/改了 N 个文件/N 行代码"。
 */
function createToolSummaryHandler(assistantMessageId: string) {
  return (summary: ToolSummaryEvent) => {
    useChatStore.getState().setMessageToolSummary(assistantMessageId, summary)
  }
}

/**
 * #9 流式 token 节流(2026-07-25 立):
 * 用 requestAnimationFrame 每帧合并一次 token,避免每个 token 触发 store 更新 + React 重渲染。
 * - batch(delta):累加 delta,标记 dirty,下帧 flush
 * - flush():立即把累积 delta 一次性 append(用于错误/中止前最后冲刺)
 * - cancel():取消 raf,清空累积(用于 finally)
 */
function createDeltaBatcher(appendFn: (delta: string) => void) {
  let pending = ''
  let rafId: number | null = null
  const flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (pending) {
      const d = pending
      pending = ''
      appendFn(d)
    }
  }
  const batch = (delta: string) => {
    pending += delta
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (pending) {
          const d = pending
          pending = ''
          appendFn(d)
        }
      })
    }
  }
  const cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pending = ''
  }
  return { batch, flush, cancel }
}

/**
 * #9 多 agent stream 节流(2026-07-25 立):
 * 单一 manager 管理多个 agentId 各自的 batcher,flushAll/cancelAll 统一清理。
 */
function createAgentDeltaBatcher() {
  const map = new Map<string, ReturnType<typeof createDeltaBatcher>>()
  const batch = (agentId: string, delta: string) => {
    let b = map.get(agentId)
    if (!b) {
      b = createDeltaBatcher((d) => useChatStore.getState().appendToAgentStream(agentId, d))
      map.set(agentId, b)
    }
    b.batch(delta)
  }
  const flushAll = () => {
    for (const b of map.values()) b.flush()
  }
  const cancelAll = () => {
    for (const b of map.values()) b.cancel()
    map.clear()
  }
  return { batch, flushAll, cancelAll }
}

export interface UseChatReturn {
  messages: ReturnType<typeof useChatStore.getState>['messages']
  currentModel: string
  isStreaming: boolean
  error: string | null
  /** 当前挂起的 AI 提问;非 null 时弹窗阻塞输入 */
  pendingQuestion: ReturnType<typeof useChatStore.getState>['pendingQuestion']
  /** P4-2: fallback 通知(主模型失败切换到备用模型时非 null,UI 展示横幅) */
  fallbackNotice: FallbackEvent | null
  /** 发送消息(2026-07-24 立,返回 Promise<boolean>,true=已提交可清空输入框,false=未发送需保留输入内容) */
  sendMessage: (content: string) => Promise<boolean>
  /** 用户回答 AI 主动提问,触发 /chat/answer 续流 */
  sendAnswer: (answer: string) => Promise<void>
  /** 跳过当前挂起的提问(不续流,允许用户继续发新消息) */
  skipQuestion: () => void
  stop: () => void
  clearMessages: () => void
  setModel: (model: string) => void
  /** P4-2: 清除 fallback 通知(用户关闭横幅时调用) */
  clearFallbackNotice: () => void
  /** Accept:把 edit_file/write_file 的 diff 写入文件系统(2026-07-22 立,P3 Inline Diff) */
  applyDiff: (messageId: string, toolCallId: string, diffInfo: InlineDiffInfo) => Promise<void>
  /** Reject:纯前端标记为 rejected,无 API 调用 */
  rejectDiff: (messageId: string, toolCallId: string) => void
}

/** 后台持久化消息，失败仅打日志，不阻塞流式体验
 *  P2 多端同步:metadata 参数用于标记 questionId/isAnswer(用户回答)或其他业务元数据 */
async function persistMessageSafe(
  conversationId: string,
  content: string,
  role: 'user' | 'assistant',
  metadata?: { questionId?: string; isAnswer?: boolean; [key: string]: unknown },
) {
  const res = await persistMessage(conversationId, content, role, metadata)
  if (!res.success) {
    logger.error(`[chat] persist ${role} message failed:`, res.error)
    // 用户可见提示(非阻塞 toast),让用户知道消息未保存到服务端
    toast.error('消息保存失败', {
      description: res.error || '网络异常,本次对话未被服务端记录',
    })
  }
}

/** 后台持久化 AI 主动提问挂起状态 + WS 广播到多端
 *  失败仅打日志,不阻塞主流程(用户仍能在当前端看到弹窗,只是其他端不会同步) */
async function persistQuestionSafe(
  conversationId: string,
  question: {
    questionId: string
    prompt: string
    options: { id: string; label: string }[]
    allowCustom: boolean
    allowMultiple: boolean
  },
) {
  const res = await persistQuestion({ conversationId, ...question })
  if (!res.success) {
    logger.error(`[chat] persist question ${question.questionId} failed:`, res.error)
    // 静默失败:不弹 toast(避免干扰用户),仅日志记录
    // 影响:其他端不会收到 ai_question WS 事件,但当前端弹窗仍正常工作
  }
}

export function useChat(): UseChatReturn {
  const messages = useChatStore((s) => s.messages)
  const currentModel = useChatStore((s) => s.currentModel)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)
  // P4-2: fallback 通知状态(主模型失败切换到备用模型时设置,UI 展示横幅)
  const [fallbackNotice, setFallbackNotice] = React.useState<FallbackEvent | null>(null)

  const router = useRouter()
  const queryClient = useQueryClient()
  // ChatMode 斜杠命令 toast i18n(2026-07-28 立,模块级函数无法调 hook,由此处传入 t)
  const t = useTranslations('chat')
  const abortRef = React.useRef<AbortController | null>(null)
  // P1 错误重试(2026-07-23):保存最后发送内容,toast 加 retry 按钮
  const lastSentContentRef = React.useRef('')
  // #10 sendAnswer 错误重试(2026-07-25 立):保存最后回答内容,toast 加 retry 按钮
  // 与 lastSentContentRef 对称,sendAnswer catch 块复用 sendMessage 路径的 retry 模式
  const lastSentAnswerRef = React.useRef<{ answer: string; questionId: string } | null>(null)
  // 2026-08-06 修复:聊天发送在途锁。原防重仅靠 store.isStreaming,但 sendMessage
  // 在 createConversation 网络往返完成后才 setStreaming(true),期间用户快速连按
  // Enter/双击发送可重复建会话/发消息。此 ref 在函数入口即置位,覆盖所有 await 间隙。
  const sendInFlightRef = React.useRef(false)

  // P3 修复:切换会话时清空 lastSentContentRef/lastSentAnswerRef,释放大文本引用
  // (用户输入可能含大段粘贴代码,ref 不会自动释放;retry toast 在切换会话后不再有意义)
  const conversationId = useChatStore((s) => s.conversationId)
  React.useEffect(() => {
    lastSentContentRef.current = ''
    lastSentAnswerRef.current = null
  }, [conversationId])

  const sendMessage = React.useCallback(
    async (content: string): Promise<boolean> => {
      const text = content.trim()
      if (!text) return false
      // 2026-08-06 修复:入口即置在途锁,覆盖 createConversation/斜杠命令等
      // await 间隙,防止快速连按 Enter/双击重复发送(原仅靠 isStreaming 防重,
      // 但 setStreaming(true) 在网络往返之后才执行,存在竞态窗口)。
      if (sendInFlightRef.current) return false

      const store = useChatStore.getState()
      if (store.isStreaming) return false

      sendInFlightRef.current = true
      // 所有提前 return 前必须解锁(见下方各处 sendInFlightRef.current = false)
      lastSentContentRef.current = text

      // /plan & /act 动作型斜杠命令拦截(2026-07-25 立,对标 Trae SOLO Plan 模式):
      // - 纯 UI 模式切换,不需要登录,不调用 LLM,不创建会话
      // - 命中即清空输入框 + toast 反馈
      if (tryHandlePlanModeSlash(text)) {
        sendInFlightRef.current = false
        return true
      }

      // /build /review /spec 动作型斜杠命令拦截(2026-07-28 立,补全 ChatMode 4态三通道):
      // - 纯 ChatMode 切换,不需要登录,不调用 LLM,不创建会话
      // - 命中即清空输入框 + toast 反馈(返回 true 与 tryHandlePlanModeSlash 一致)
      if (tryHandleChatModeSlash(text, t)) {
        sendInFlightRef.current = false
        return true
      }

      // /permission ask|auto|full 动作型斜杠命令拦截(2026-07-25 深化,对标 Codex approvalMode):
      // - 纯 UI 模式切换,不需要登录,不调用 LLM,不创建会话
      // - 命中即清空输入框 + toast 反馈(切 full 时弹 5s 撤销 toast)
      if (await tryHandlePermissionSlash(text)) {
        sendInFlightRef.current = false
        return true
      }

      // AI 自动判断 ChatMode(2026-07-28 立,移除 4 按钮后由 AI 决定用哪种模式):
      // - 时机:所有 /命令拦截后、createConversation 前(用户敲完按发送才触发)
      // - 静默切换,无 toast(自动判断是辅助能力,反复提示会刷屏)
      // - 当前模式徽章(CurrentModeBadge)实时反映新模式,提供视觉反馈
      // - 显式 /命令优先级最高(已在上方拦截,这里只处理普通对话)
      tryAutoDetectMode(text)

      // 未登录拦截(2026-07-24 立,修复"未登录点发送无反应"问题):
      // - 不调 createConversation(避免 401 无可见反馈)
      // - toast 提示 + 弹出登录弹窗(用户偏好:登录/注册用弹窗)
      // - return false 让 MessageInput 保留输入内容,登录后可直接重发
      // - 注意:仅检查 isAuthenticated(UI 标志位)。token 刷新后为 null 但 cookie 仍有效,
      //   不能用 !token 判断,否则会误拦刷新后已登录用户。stale 场景由 createConversation
      //   401 失败兜底(下方 createRes.status === 401 分支处理)。
      if (!useAuthStore.getState().isAuthenticated) {
        toast.warning('请先登录', {
          description: '登录后即可与 AI 对话',
        })
        useLoginDialogStore.getState().open('login')
        sendInFlightRef.current = false
        return false
      }

      // 拦截自媒体斜杠命令(/wechat-article / /koubo-script),直接调 skill API,
      // 不走 LLM chat 流。结果作为 assistant 消息追加到对话。
      const slashHit = await tryHandleSelfMediaSlash(text, (assistantContent) => {
        const m = store.currentModel
        store.addMessage({ role: 'user', content: text, model: m })
        store.addMessage({ role: 'assistant', content: assistantContent, model: m })
      })
      if (slashHit) {
        sendInFlightRef.current = false
        return true
      }

      const model = store.currentModel

      // 1. 若无 conversationId，先创建会话并同步 URL
      let conversationId = store.conversationId
      if (!conversationId) {
        const createRes = await createConversation({ model })
        if (!createRes.success) {
          // 401 兜底(2026-07-24 立):isAuthenticated 可能 stale(localStorage 持久化但 cookie 已失效),
          // createConversation 返回 401 时需明确提示用户重新登录,而非静默 setError。
          // fetchApi wrapper 已调 openLoginDialogOnce 打开弹窗,此处补 toast + 同步 auth 状态。
          if (createRes.status === 401) {
            toast.warning('登录已过期', {
              description: '请重新登录后继续对话',
            })
            useAuthStore.setState({ isAuthenticated: false, user: null })
            const { isAuthenticated: isAuth, token } = useAuthStore.getState()
            // bootstrap 幽灵态不弹窗(避免刷新后并发请求的 401 打断自动登录)
            if (!(isAuth && !token)) {
              openLoginDialogOnce('/')
            }
          } else {
            // 2026-07-27 修复"登录后点击发送无反应":createConversation 非 401 失败时
            // (如 500/502/网络错误)只调 store.setError 用户看不到任何反馈,误以为按钮失灵。
            // 必须 toast.error 让用户看到错误原因,并附带重试按钮。
            const errMsg = createRes.error || `服务异常(${createRes.status ?? '未知'})`
            toast.error('创建会话失败', {
              description: errMsg,
              action: {
                label: t('retry'),
                onClick: () => sendMessage(lastSentContentRef.current),
              },
            })
            store.setError(createRes.error)
          }
          sendInFlightRef.current = false
          return false
        }
        conversationId = createRes.data.conversation.id
        store.setConversationId(conversationId)
        const sp = new URLSearchParams(window.location.search)
        sp.set('conversationId', conversationId)
        router.replace(`/chat?${sp.toString()}`, { scroll: false })
        queryClient.invalidateQueries({ queryKey: ['chat', 'conversations'] })
      }

      // 2. 持久化用户消息(后台 fire-and-forget,不阻塞流式响应)
      void persistMessageSafe(conversationId, text, 'user')

      const history = store.messages
        .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role, content: m.content }))

      store.addMessage({ role: 'user', content: text, model })
      // 记录该消息生成时的工作区权限模式(2026-07-25 深化,深度对标 Codex 透明性)
      // 模式用于消息气泡的徽章展示,让用户事后能识别"这条回答是基于哪种权限模式生成的"
      const currentMode = useAiPanelStore.getState().activeWorkspace?.mode
      const assistantId = store.addMessage({
        role: 'assistant',
        content: '',
        model,
        permissionMode: currentMode,
      })

      store.setStreaming(true)
      store.setError(null)
      store.resetSubAgentActivities()
      // P4-2: 清除上一轮 fallback 通知,避免旧横幅残留到新对话轮次
      setFallbackNotice(null)

      const controller = new AbortController()
      abortRef.current = controller

      // #13 首 token 超时区分 reasoning(2026-07-25 立):
      // 双阶超时适配 reasoning 模型(o1/R1)长思考场景:
      // - timeout30s:30s 内 reasoning + content 都未收到 → abort(完全冷启动)
      //   2026-07-27 修复:15s → 30s。StepFun step-router-v1 等推理模型首次请求冷启动
      //   可能 >15s(含 CORS preflight + TCP + LLM 首 token 延迟),15s 误 abort 导致 net::ERR_ABORTED。
      // - timeout60s:60s 内 content 未收到但 reasoning 已收到 → abort(reasoning 模型可能长时间只产 reasoning)
      // - 任一 content token 到达 → clearTimeout 两个 timer(进入正常流式)
      // - 用户主动 stop 触发的 abort 不报错(由 abortedByTimeout* 标志区分)
      let firstContentTokenReceived = false
      let firstReasoningTokenReceived = false
      let abortedByTimeout15s = false
      let abortedByTimeout60s = false
      const timeout15sId = setTimeout(() => {
        if (!firstContentTokenReceived && !firstReasoningTokenReceived) {
          abortedByTimeout15s = true
          controller.abort()
        }
      }, 30000)
      const timeout60sId = setTimeout(() => {
        if (!firstContentTokenReceived && firstReasoningTokenReceived) {
          abortedByTimeout60s = true
          controller.abort()
        }
      }, 60000)

      // #9 流式 token 节流(2026-07-25 立):
      // 用 requestAnimationFrame 每帧合并一次 token,避免每个 token 触发 store 更新 + React 重渲染
      const contentBatcher = createDeltaBatcher((d) =>
        useChatStore.getState().appendToMessage(assistantId, d),
      )
      const reasoningBatcher = createDeltaBatcher((d) =>
        useChatStore.getState().appendReasoningToMessage(assistantId, d),
      )
      const agentBatcher = createAgentDeltaBatcher()

      // 从 auth store 获取 userId(用于回调链路关联)
      const userId = useAuthStore.getState().user?.id ?? ''
      // 从 ai-panel store 获取当前绑定的本地工作区路径(用于注入 CLAUDE.md/AGENTS.md 项目记忆)
      const workspacePath = useAiPanelStore.getState().activeWorkspace?.path
      // web 非 Tauri 环境:用 FileSystemDirectoryHandle 预加载工作区文件内容(阶段 1)
      // Tauri 桌面端返回 undefined,走原有 workspacePath 逻辑
      const workspaceContext = await loadBrowserWorkspaceContext()

      // 2026-08-06 立:不再做 'auto' → stepfun/step-router-v1 防御性降级。
      // 原降级会把 Auto 模式绑死 stepfun 一家,违反用户反馈"应该自动切换所有可使用的模型"。
      // 现在把 'auto' 原样透传到 ai-service,由后端 llm_gateway._resolve_auto_model
      // 从 model_availability 全量可用模型池中跨厂商选最优(stepfun/agnes/cloudflare/nvidia_nim/gemini 等)。
      const effectiveModel = model
      // 2026-08-07 修复:web 端无活跃工作区 / 无 workspace handle 时,fs 类工具静默失败,
      // 给用户一个一次性 toast 提示(整个 sendMessage 周期内只弹一次,避免刷屏)。
      let noWorkspaceNoticeShown = false
      const notifyNoWorkspace = (reason: string): void => {
        if (noWorkspaceNoticeShown) return
        noWorkspaceNoticeShown = true
        toast.warning('未选择工作区,文件类工具无法执行', {
          description: `${reason}。请在 AI 面板选择一个工作区后再发起对话,或选择不需要文件操作的提问。`,
          duration: 6000,
        })
      }
      try {
        await streamChat({
          model: effectiveModel,
          messages: [...history, { role: 'user', content: text }],
          signal: controller.signal,
          metadata: {
            conversationId,
            userId,
            messageId: assistantId,
          },
          // 模式透传(2026-07-22 立,对标 Trae Plan/Spec):build/plan/review/spec
          // Plan/Act 模式(2026-07-24 立):plan=只制定计划不执行工具,act=正常执行
          extraBody: {
            // ChatMode 4 态唯一模式字段(2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已废弃,语义合并到 mode)
            mode: useModeStore.getState().currentMode,
          },
          workspacePath,
          workspaceContext,
          // 跨端统一 88% 阈值自动压缩:从模型 ID 推断 contextLimit,API 端调用共享包压缩
          contextLimit: getModelContextCapacity(effectiveModel),
          onCompaction: (info) => {
            // 后端自动压缩完成,toast 提示用户(对标 CLI /compact 命令的可见性)
            toast.success('上下文已自动压缩', {
              description: `${formatTokenCount(info.tokensBefore)} → ${formatTokenCount(info.tokensAfter)}(移除 ${info.removedCount} 条历史)`,
            })
          },
          onQuestion: (q) => {
            // AI 主动提问:挂起对话,弹窗阻塞输入,等用户回答后 sendAnswer 续流
            useChatStore.getState().setPendingQuestion({
              questionId: q.questionId,
              prompt: q.prompt,
              options: q.options,
              allowCustom: q.allowCustom,
              allowMultiple: q.allowMultiple,
              assistantMessageId: assistantId,
            })
            // P2 多端同步:持久化挂起状态到 conversation.metadata + WS 广播 ai_question 给其他端
            // fire-and-forget,失败仅日志(当前端弹窗仍正常,只是其他端不会同步)
            const convId = useChatStore.getState().conversationId
            if (convId) {
              void persistQuestionSafe(convId, {
                questionId: q.questionId,
                prompt: q.prompt,
                options: q.options,
                allowCustom: q.allowCustom,
                allowMultiple: q.allowMultiple,
              })
            }
          },
          // P4-2: 后端 fallback 触发时设置通知状态,UI 展示"已切换到备用模型"横幅
          onFallback: (event) => setFallbackNotice(event),
          // P1 重连提示(2026-08-02 立):streamChat 自动重连时 toast 通知用户,避免无感知等待
          onReconnect: (attempt: number, delay: number) => {
            const reconnectingMsg =
              t('reconnecting') === 'reconnecting' ? 'Reconnecting...' : t('reconnecting')
            const attemptMsg =
              t('reconnectAttempt', { n: String(attempt), ms: String(delay) }) ===
              'reconnectAttempt'
                ? `Attempt ${attempt}, retrying in ${delay}ms`
                : t('reconnectAttempt', { n: String(attempt), ms: String(delay) })
            toast.info(reconnectingMsg, { description: attemptMsg })
          },
          // 2026-07-27 修复:response 已到达即清除"完全冷启动"超时(timeout15s),
          // 避免"response 到达但首 token 未到达"时误 abort 导致 net::ERR_ABORTED。
          // 保留 timeout60s(防止 reasoning 模型长时间只产 reasoning 不产 content)。
          onResponse: () => {
            clearTimeout(timeout15sId)
          },
          onDelta: (delta) => {
            if (!firstContentTokenReceived) {
              firstContentTokenReceived = true
              clearTimeout(timeout15sId)
              clearTimeout(timeout60sId)
            }
            contentBatcher.batch(delta)
          },
          onAgentDelta: (_agentId, delta) => {
            if (!firstContentTokenReceived) {
              firstContentTokenReceived = true
              clearTimeout(timeout15sId)
              clearTimeout(timeout60sId)
            }
            agentBatcher.batch(_agentId, delta)
          },
          onReasoning: (delta) => {
            if (!firstReasoningTokenReceived) {
              firstReasoningTokenReceived = true
              // 2026-07-27 修复:收到 reasoning token 即清除 timeout15s(完全冷启动超时),
              // 避免冷启动延迟 + 首个 reasoning 到达间隔 >30s 时误 abort。
              // 保留 timeout60s(防止 reasoning 模型长时间只产 reasoning 不产 content)。
              clearTimeout(timeout15sId)
            }
            reasoningBatcher.batch(delta)
          },
          onToolCall: (event) => {
            // 2026-07-27 修复工具调用场景下 15s 超时中断 SSE 流:
            // 工具调用过程中 SSE 只发 tool-call-start/tool-result 事件,不发 content/reasoning token,
            // 导致 firstContentTokenReceived 和 firstReasoningTokenReceived 都为 false,
            // 15s 后 timeout15s 触发 controller.abort() 中断 SSE 流,UI 显示"无响应"。
            // 修复:收到任意 tool-call 事件即视为正常响应,清除两个超时定时器。
            if (!firstContentTokenReceived) {
              firstContentTokenReceived = true
              clearTimeout(timeout15sId)
              clearTimeout(timeout60sId)
            }
            createToolCallHandler(assistantId)(event)
          },
          // Subagent 自动派发(2026-07-28 立,对标 Trae Work):
          // 后端 dispatch_subagent 工具执行前后发 subagent_spawn/end SSE 事件,
          // 前端通过回调写入 chat store.subAgentActivities,UI 自动展示生命周期。
          // 2026-07-29 Phase 21:同步写入 timeline-store,让 Timeline tab 实时响应。
          onSubagentSpawn: (evt) => {
            useChatStore.getState().addSubagentSpawn(evt)
            useTimelineStore.getState().addEvent(mapSpawnToTimelineEvent(evt))
          },
          onSubagentProgress: (evt) => {
            useChatStore.getState().updateSubagentProgress(evt)
            const update = mapProgressToTimelineUpdate(evt)
            if (update) useTimelineStore.getState().updateEvent(update.id, update.updates)
          },
          onSubagentEnd: (evt) => {
            useChatStore.getState().markSubagentEnd(evt)
            const update = mapEndToTimelineUpdate(evt)
            if (update) useTimelineStore.getState().updateEvent(update.id, update.updates)
          },
          // 2026-07-31 立,AI 对话可视化深度接入:SSE 流末尾 tool-summary 事件落地
          onToolSummary: createToolSummaryHandler(assistantId),
          // 2026-08-01 Phase 4a:消息级 plan/terminal 事件落地(inline 到消息气泡)
          // subagent 事件无需新增回调:store 的 addSubagentSpawn/markSubagentEnd/updateSubagentProgress
          // 已内部判断 event.messageId 同步写入 message.subagentActivities。
          onPlanUpdate: (evt) => {
            if (!evt.messageId) return
            const steps: PlanStep[] = evt.plan.map((item, i) => ({
              id: `plan-${i}-${item.step.slice(0, 16)}`,
              step: item.step,
              status: item.status,
              explanation: evt.explanation,
              startedAt: item.startedAt,
              endedAt: item.endedAt,
              durationMs: item.durationMs,
              tokenUsage: item.tokenUsage,
              messageId: evt.messageId,
            }))
            useChatStore.getState().setMessagePlanSteps(evt.messageId, steps)
          },
          onTerminalStart: (evt) => {
            if (!evt.messageId) return
            const task: TerminalTask = {
              id: evt.terminalId,
              command: evt.command,
              status: 'running',
              startedAt: evt.startedAt ?? new Date().toISOString(),
              messageId: evt.messageId,
            }
            useChatStore.getState().appendMessageTerminalTask(evt.messageId, task)
          },
          onTerminalEnd: (evt) => {
            if (!evt.messageId) return
            useChatStore.getState().updateMessageTerminalTask(evt.messageId, evt.terminalId, {
              status: evt.status,
              output: evt.output,
              exitCode: evt.exitCode,
              endedAt: evt.endedAt,
              durationMs: evt.durationMs,
            })
          },
          // 阶段 2:浏览器端工具执行代理(2026-08-02 立)
          // ai-service 在远程服务器无法访问本地文件,LLM 调用 fs 类工具时通过 SSE
          // tool-delegate 事件委托前端用 FileSystemDirectoryHandle 执行,通过 postToolResult 回传
          // 2026-08-07:无工作区提示已移到 sendMessage 顶层,通过 noWorkspaceNoticeShown 去重,
          // 多个 fs 工具失败时只弹一次 toast,避免刷屏。
          onToolDelegate: async (event: ToolDelegateEvent) => {
            const ws = useAiPanelStore.getState().activeWorkspace
            if (!ws?.name) {
              notifyNoWorkspace('当前没有活跃工作区')
              await postToolResult(
                event.session_id,
                event.tool_call_id,
                null,
                'No active workspace',
              )
              return
            }
            const handle = getBrowserWorkspaceHandle(ws.name)
            if (!handle) {
              notifyNoWorkspace('工作区未授权目录访问权限')
              await postToolResult(
                event.session_id,
                event.tool_call_id,
                null,
                'No browser workspace handle',
              )
              return
            }
            const execResult = await executeWorkspaceTool(event.tool_name, event.args, handle)
            await postToolResult(
              event.session_id,
              event.tool_call_id,
              execResult.result,
              execResult.error,
            )
          },
          agentTools: mergeAgentTools(),
          onError: (errMsg, info) => {
            // #9 错误前先 flush 累积 token,避免最后一批内容丢失
            contentBatcher.flush()
            reasoningBatcher.flush()
            agentBatcher.flushAll()
            const formatted = formatSSEError(errMsg, info)
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
            if (formatted.severity === 'auth') {
              useLoginDialogStore.getState().open('login')
            }
            // 前端错误码透出(P1,2026-07-22 立):toast description 前缀 [errorCode],
            // 让用户直接定位问题(MODEL_NOT_CONFIGURED/PROVIDER_NOT_IMPLEMENTED/LLM_ERROR 等)
            const ec = info?.errorCode
            const toastDesc =
              formatted.severity === 'auth'
                ? formatted.message
                : ec
                  ? `[${ec}] ${formatted.rawMessage}`
                  : formatted.rawMessage
            if (formatted.severity === 'ratelimit') {
              toast.warning(formatted.title, { description: toastDesc })
            } else if (formatted.severity === 'safety') {
              // 内容被 AI 厂商安全策略拦截,用 warning 级别提示用户调整提问方式
              toast.warning(formatted.title, { description: formatted.message })
            } else {
              // P1 错误重试(2026-07-23):toast 加 retry 按钮,一键重发
              toast.error(formatted.title, {
                description: toastDesc,
                action: {
                  label: t('retry'),
                  onClick: () => sendMessage(lastSentContentRef.current),
                },
              })
            }
          },
        })
      } catch (err) {
        // #9 catch 前先 flush 累积 token,避免最后一批内容丢失
        contentBatcher.flush()
        reasoningBatcher.flush()
        agentBatcher.flushAll()
        if (err instanceof DOMException && err.name === 'AbortError') {
          // #13 区分两种超时:15s 完全冷启动 vs 60s reasoning 已收到但 content 未到
          // 用户主动 stop 触发的 abort(abortedByTimeout* 均为 false)静默不报错
          if (abortedByTimeout15s) {
            const formatted = formatSSEError(err, t('errorTimeout15s'))
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
          } else if (abortedByTimeout60s) {
            const formatted = formatSSEError(err, t('errorTimeout60s'))
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
          }
        } else {
          const formatted = formatSSEError(err)
          useChatStore.getState().setMessageError(assistantId, formatted.message)
          useChatStore.getState().setError(formatted.message)
          if (formatted.severity === 'auth') {
            useLoginDialogStore.getState().open('login')
          }
          // 前端错误码透出(P1):catch 路径(HTTP 4xx throw)的 errorCode 从 formatted 直接取
          const ec = formatted.errorCode
          const prefix = ec ? `[${ec}] ` : ''
          if (formatted.severity === 'ratelimit' || formatted.severity === 'safety') {
            toast.warning(formatted.title, { description: `${prefix}${formatted.message}` })
          } else if (formatted.severity === 'network') {
            // P1 错误重试(2026-07-23):网络错误 toast 加 retry 按钮
            toast.error(formatted.title, {
              description: `${prefix}${formatted.message}`,
              action: { label: t('retry'), onClick: () => sendMessage(lastSentContentRef.current) },
            })
          } else {
            toast.error(formatted.title, {
              description: `${prefix}${formatted.rawMessage}`,
              action: { label: t('retry'), onClick: () => sendMessage(lastSentContentRef.current) },
            })
          }
        }
      } finally {
        clearTimeout(timeout15sId)
        clearTimeout(timeout60sId)
        // 2026-07-27 修复"AI 响应不显示":finally 必须先 flush 再 cancel,
        // 否则最后一批 token(还在 pending 未触发 rAF)会被 cancel 直接丢弃,
        // 导致 streamChat 成功返回后 UI 仍为空。
        // flush 内部已 cancelAnimationFrame + 清 pending,后续 cancel 仅兜底。
        contentBatcher.flush()
        reasoningBatcher.flush()
        agentBatcher.flushAll()
        contentBatcher.cancel()
        reasoningBatcher.cancel()
        agentBatcher.cancelAll()
        abortRef.current = null
        useChatStore.getState().setStreaming(false)
        useChatStore.getState().markAllAgentStreamsDone()
        // 2026-08-06 修复:发送完成(成功/异常)释放 in-flight 锁,允许下一次发送
        sendInFlightRef.current = false
      }
      // 消息已提交到 store(即使流式出错也有 error 标记 + retry 按钮),可清空输入框
      return true
    },
    [router, queryClient, t],
  )

  const stop = React.useCallback(() => {
    abortRef.current?.abort()
  }, [])

  // 用户回答 AI 主动提问:调 /chat/answer 续流,不中断对话
  // 后端会把 answer 作为新 user 消息 append 到 messages 末尾,继续生成
  const sendAnswer = React.useCallback(
    async (answer: string) => {
      const trimmed = answer.trim()
      if (!trimmed) return
      const store = useChatStore.getState()
      const pending = store.pendingQuestion
      if (!pending || store.isStreaming) return

      // #10 入口存储 lastSentAnswerRef(2026-07-25 立):catch 块 retry 按钮用
      lastSentAnswerRef.current = { answer: trimmed, questionId: pending.questionId }

      // 立即关闭弹窗,避免重复提交
      store.clearPendingQuestion()

      const model = store.currentModel

      // 历史消息(不含 answer,后端 /chat/answer 自动 append answer 到末尾)
      const history = store.messages
        .filter((m) => !m.error && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map((m) => ({ role: m.role, content: m.content }))

      // UI 上把 answer 显示为 user 消息(让用户看到自己回答了什么)
      store.addMessage({ role: 'user', content: trimmed, model })
      // 记录续流时的工作区权限模式(2026-07-25 深化,深度对标 Codex 透明性)
      const currentMode = useAiPanelStore.getState().activeWorkspace?.mode
      const assistantId = store.addMessage({
        role: 'assistant',
        content: '',
        model,
        permissionMode: currentMode,
      })

      store.setStreaming(true)
      store.setError(null)
      store.resetSubAgentActivities()
      // P4-2: 清除上一轮 fallback 通知(与 sendMessage 对称)
      setFallbackNotice(null)

      const controller = new AbortController()
      abortRef.current = controller

      // #13 首 token 超时区分 reasoning(2026-07-25 立,与 sendMessage 对称)
      // 2026-07-27 修复:15s → 30s(与 sendMessage 同步,防冷启动误 abort)
      let firstContentTokenReceived = false
      let firstReasoningTokenReceived = false
      let abortedByTimeout15s = false
      let abortedByTimeout60s = false
      const timeout15sId = setTimeout(() => {
        if (!firstContentTokenReceived && !firstReasoningTokenReceived) {
          abortedByTimeout15s = true
          controller.abort()
        }
      }, 30000)
      const timeout60sId = setTimeout(() => {
        if (!firstContentTokenReceived && firstReasoningTokenReceived) {
          abortedByTimeout60s = true
          controller.abort()
        }
      }, 60000)

      // #9 流式 token 节流(2026-07-25 立,与 sendMessage 对称)
      const contentBatcher = createDeltaBatcher((d) =>
        useChatStore.getState().appendToMessage(assistantId, d),
      )
      const reasoningBatcher = createDeltaBatcher((d) =>
        useChatStore.getState().appendReasoningToMessage(assistantId, d),
      )
      const agentBatcher = createAgentDeltaBatcher()

      const userId = useAuthStore.getState().user?.id ?? ''
      const workspacePath = useAiPanelStore.getState().activeWorkspace?.path
      // web 非 Tauri 环境:用 FileSystemDirectoryHandle 预加载工作区文件内容(与 sendMessage 对称)
      const workspaceContext = await loadBrowserWorkspaceContext()

      // 2026-08-06 立:与 sendMessage 对称,删除 'auto' → stepfun/step-router-v1 降级,
      // 让 'auto' 透传到 ai-service 跨厂商路由(详见 line 1246-1249 注释)。
      const effectiveModel = model
      // 2026-08-07 修复:与 sendMessage 对称,无工作区时给用户一次性 toast(避免 fs 工具静默失败)
      let noWorkspaceNoticeShown = false
      const notifyNoWorkspace = (reason: string): void => {
        if (noWorkspaceNoticeShown) return
        noWorkspaceNoticeShown = true
        toast.warning('未选择工作区,文件类工具无法执行', {
          description: `${reason}。请在 AI 面板选择一个工作区后再发起对话,或选择不需要文件操作的提问。`,
          duration: 6000,
        })
      }
      try {
        await streamChat({
          model: effectiveModel,
          messages: history,
          path: '/ai/chat/answer',
          extraBody: {
            questionId: pending.questionId,
            answer: trimmed,
            // 模式透传(2026-07-22 立,对标 Trae Plan/Spec):build/plan/review/spec
            // 2026-07-28 移除独立 PlanActToggle 后,plan_mode 字段已废弃,仅传 mode
            mode: useModeStore.getState().currentMode,
          },
          signal: controller.signal,
          metadata: {
            conversationId: store.conversationId ?? undefined,
            userId,
            messageId: assistantId,
          },
          workspacePath,
          workspaceContext,
          contextLimit: getModelContextCapacity(effectiveModel),
          // P4-2: 后端 fallback 触发时设置通知状态(与 sendMessage 对称)
          onFallback: (event) => setFallbackNotice(event),
          // P1 重连提示(2026-08-02 立,与 sendMessage 对称):streamChat 自动重连时 toast 通知用户
          onReconnect: (attempt: number, delay: number) => {
            const reconnectingMsg =
              t('reconnecting') === 'reconnecting' ? 'Reconnecting...' : t('reconnecting')
            const attemptMsg =
              t('reconnectAttempt', { n: String(attempt), ms: String(delay) }) ===
              'reconnectAttempt'
                ? `Attempt ${attempt}, retrying in ${delay}ms`
                : t('reconnectAttempt', { n: String(attempt), ms: String(delay) })
            toast.info(reconnectingMsg, { description: attemptMsg })
          },
          // 2026-07-27 修复:与 sendMessage 同步,response 到达即清除 timeout15s
          onResponse: () => {
            clearTimeout(timeout15sId)
          },
          onDelta: (delta) => {
            if (!firstContentTokenReceived) {
              firstContentTokenReceived = true
              clearTimeout(timeout15sId)
              clearTimeout(timeout60sId)
            }
            contentBatcher.batch(delta)
          },
          onAgentDelta: (agentId, delta) => {
            if (!firstContentTokenReceived) {
              firstContentTokenReceived = true
              clearTimeout(timeout15sId)
              clearTimeout(timeout60sId)
            }
            agentBatcher.batch(agentId, delta)
          },
          onReasoning: (delta) => {
            if (!firstReasoningTokenReceived) {
              firstReasoningTokenReceived = true
              // 2026-07-27 修复:与 sendMessage 同步,收到 reasoning 即清除 timeout15s
              clearTimeout(timeout15sId)
            }
            reasoningBatcher.batch(delta)
          },
          onToolCall: createToolCallHandler(assistantId),
          // Subagent 自动派发(2026-07-28 立,与 sendMessage 对称):
          // sendAnswer 续流同样可能触发 dispatch_subagent 工具,需写入 store。
          // 2026-07-29 Phase 21:补齐 onSubagentProgress + 同步写入 timeline-store。
          onSubagentSpawn: (evt) => {
            useChatStore.getState().addSubagentSpawn(evt)
            useTimelineStore.getState().addEvent(mapSpawnToTimelineEvent(evt))
          },
          onSubagentProgress: (evt) => {
            useChatStore.getState().updateSubagentProgress(evt)
            const update = mapProgressToTimelineUpdate(evt)
            if (update) useTimelineStore.getState().updateEvent(update.id, update.updates)
          },
          onSubagentEnd: (evt) => {
            useChatStore.getState().markSubagentEnd(evt)
            const update = mapEndToTimelineUpdate(evt)
            if (update) useTimelineStore.getState().updateEvent(update.id, update.updates)
          },
          // 2026-07-31 立,与 sendMessage 对称:sendAnswer 续流同样发出 tool-summary 事件
          onToolSummary: createToolSummaryHandler(assistantId),
          // 2026-08-01 Phase 4a:与 sendMessage 对称,消息级 plan/terminal 事件落地
          onPlanUpdate: (evt) => {
            if (!evt.messageId) return
            const steps: PlanStep[] = evt.plan.map((item, i) => ({
              id: `plan-${i}-${item.step.slice(0, 16)}`,
              step: item.step,
              status: item.status,
              explanation: evt.explanation,
              startedAt: item.startedAt,
              endedAt: item.endedAt,
              durationMs: item.durationMs,
              tokenUsage: item.tokenUsage,
              messageId: evt.messageId,
            }))
            useChatStore.getState().setMessagePlanSteps(evt.messageId, steps)
          },
          onTerminalStart: (evt) => {
            if (!evt.messageId) return
            const task: TerminalTask = {
              id: evt.terminalId,
              command: evt.command,
              status: 'running',
              startedAt: evt.startedAt ?? new Date().toISOString(),
              messageId: evt.messageId,
            }
            useChatStore.getState().appendMessageTerminalTask(evt.messageId, task)
          },
          onTerminalEnd: (evt) => {
            if (!evt.messageId) return
            useChatStore.getState().updateMessageTerminalTask(evt.messageId, evt.terminalId, {
              status: evt.status,
              output: evt.output,
              exitCode: evt.exitCode,
              endedAt: evt.endedAt,
              durationMs: evt.durationMs,
            })
          },
          // 阶段 2:浏览器端工具执行代理(2026-08-02 立,与 sendMessage 对称)
          // ai-service 在远程服务器无法访问本地文件,LLM 调用 fs 类工具时通过 SSE
          // tool-delegate 事件委托前端用 FileSystemDirectoryHandle 执行,通过 postToolResult 回传
          // 2026-08-07:与 sendMessage 对称,无工作区 toast 提示
          onToolDelegate: async (event: ToolDelegateEvent) => {
            const ws = useAiPanelStore.getState().activeWorkspace
            if (!ws?.name) {
              notifyNoWorkspace('当前没有活跃工作区')
              await postToolResult(
                event.session_id,
                event.tool_call_id,
                null,
                'No active workspace',
              )
              return
            }
            const handle = getBrowserWorkspaceHandle(ws.name)
            if (!handle) {
              notifyNoWorkspace('工作区未授权目录访问权限')
              await postToolResult(
                event.session_id,
                event.tool_call_id,
                null,
                'No browser workspace handle',
              )
              return
            }
            const execResult = await executeWorkspaceTool(event.tool_name, event.args, handle)
            await postToolResult(
              event.session_id,
              event.tool_call_id,
              execResult.result,
              execResult.error,
            )
          },
          agentTools: mergeAgentTools(),
          onError: (errMsg, info) => {
            // #9 错误前先 flush 累积 token,避免最后一批内容丢失
            contentBatcher.flush()
            reasoningBatcher.flush()
            agentBatcher.flushAll()
            const formatted = formatSSEError(errMsg, info)
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
            if (formatted.severity === 'auth') {
              useLoginDialogStore.getState().open('login')
            }
            // 前端错误码透出(P1):sendAnswer 路径同 sendMessage,toast description 加 [errorCode] 前缀
            const ec = info?.errorCode
            const toastDesc =
              formatted.severity === 'auth'
                ? formatted.message
                : ec
                  ? `[${ec}] ${formatted.rawMessage}`
                  : formatted.rawMessage
            if (formatted.severity === 'ratelimit') {
              // ratelimit/safety 错误保持 warning 无 retry(与 sendMessage 一致)
              toast.warning(formatted.title, { description: toastDesc })
            } else if (formatted.severity === 'safety') {
              toast.warning(formatted.title, { description: formatted.message })
            } else {
              // #10 sendAnswer 错误加 retry 按钮(2026-07-25 立,与 sendMessage 路径对齐)
              toast.error(formatted.title, {
                description: toastDesc,
                action: {
                  label: t('retry'),
                  onClick: () => {
                    const last = lastSentAnswerRef.current
                    if (last) sendAnswer(last.answer)
                  },
                },
              })
            }
          },
        })
      } catch (err) {
        // #9 catch 前先 flush 累积 token
        contentBatcher.flush()
        reasoningBatcher.flush()
        agentBatcher.flushAll()
        if (err instanceof DOMException && err.name === 'AbortError') {
          // #13 区分两种超时,用户主动 stop 静默不报错
          if (abortedByTimeout15s) {
            const formatted = formatSSEError(err, t('errorTimeout15s'))
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
          } else if (abortedByTimeout60s) {
            const formatted = formatSSEError(err, t('errorTimeout60s'))
            useChatStore.getState().setMessageError(assistantId, formatted.message)
            useChatStore.getState().setError(formatted.message)
          }
        } else {
          const formatted = formatSSEError(err)
          useChatStore.getState().setMessageError(assistantId, formatted.message)
          useChatStore.getState().setError(formatted.message)
          if (formatted.severity === 'auth') {
            useLoginDialogStore.getState().open('login')
          }
          // 前端错误码透出(P1):catch 路径(HTTP 4xx throw)的 errorCode 从 formatted 直接取
          const ec = formatted.errorCode
          const prefix = ec ? `[${ec}] ` : ''
          if (formatted.severity === 'ratelimit' || formatted.severity === 'safety') {
            // ratelimit/safety 错误保持 warning 无 retry
            toast.warning(formatted.title, { description: `${prefix}${formatted.message}` })
          } else if (formatted.severity === 'network') {
            // #10 网络错误 toast 加 retry 按钮(2026-07-25 立,与 sendMessage 对称)
            toast.error(formatted.title, {
              description: `${prefix}${formatted.message}`,
              action: {
                label: t('retry'),
                onClick: () => {
                  const last = lastSentAnswerRef.current
                  if (last) sendAnswer(last.answer)
                },
              },
            })
          } else {
            // #10 通用错误 toast 加 retry 按钮
            toast.error(formatted.title, {
              description: `${prefix}${formatted.rawMessage}`,
              action: {
                label: t('retry'),
                onClick: () => {
                  const last = lastSentAnswerRef.current
                  if (last) sendAnswer(last.answer)
                },
              },
            })
          }
        }
      } finally {
        clearTimeout(timeout15sId)
        clearTimeout(timeout60sId)
        // 2026-07-27 修复"AI 响应不显示"(与 sendMessage 对称):先 flush 再 cancel
        contentBatcher.flush()
        reasoningBatcher.flush()
        agentBatcher.flushAll()
        contentBatcher.cancel()
        reasoningBatcher.cancel()
        agentBatcher.cancelAll()
        abortRef.current = null
        useChatStore.getState().setStreaming(false)
        useChatStore.getState().markAllAgentStreamsDone()
      }
      return
    },
    [t],
  )

  // 跳过当前挂起的提问:不续流 LLM,允许用户继续发新消息
  const skipQuestion = React.useCallback(() => {
    useChatStore.getState().clearPendingQuestion()
  }, [])

  // 组件卸载时中止进行中的流式请求,避免后台僵尸请求
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const clearMessages = useChatStore((s) => s.clearMessages)
  const setModel = useChatStore((s) => s.setModel)
  const pendingQuestion = useChatStore((s) => s.pendingQuestion)
  // P4-2: 清除 fallback 通知(用户关闭横幅时调用)
  const clearFallbackNotice = React.useCallback(() => setFallbackNotice(null), [])

  // P3 Inline Diff Apply 工作流:Accept 调 API 写入文件,Reject 纯前端标记
  const { applyDiff, rejectDiff } = useApplyDiff()

  return {
    messages,
    currentModel,
    isStreaming,
    error,
    pendingQuestion,
    fallbackNotice,
    sendMessage,
    sendAnswer,
    skipQuestion,
    stop,
    clearMessages,
    setModel,
    clearFallbackNotice,
    applyDiff,
    rejectDiff,
  }
}
