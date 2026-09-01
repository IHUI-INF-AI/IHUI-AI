// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { toast } from '@/components/common'
import { useModeStore } from '@/stores/mode'
import { useAiPanelStore } from '@/stores/ai-panel'
import { isFullAccessConfirmSuppressed } from '@/components/ai/full-access-confirm-dialog'
import { fetchApi } from '@/lib/api'
import type { SlashCommandData, SlashCommandResult } from './types'
import type { WorkspacePermissionMode } from '@ihui/api-client/endpoints/workspace'
import type { ChatMode } from '@ihui/types'

// 斜杠命令 → 自媒体 skill 直调映射(避免走 LLM chat 流,直接调 skill API)
// /wechat-article <title>  → POST /api/self-media/wechat/generate {title, dryRun:true}
// /koubo-script <MMDD>     → POST /api/self-media/koubo/generate {date, dryRun:true}
// /auto-task <taskId> <HH:MM> [titleTemplate]  → POST /api/self-media/automation/tasks/:taskId/config
//   taskId: wechat_daily | koubo_daily(仅这 2 个内置任务可配置)
//   时间格式: HH:MM(24 小时制),默认 09:00
//   titleTemplate: 可选,仅 wechat_daily 用,支持 {date} 占位符
export const SELF_MEDIA_SLASH_MAP = {
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
export async function tryHandleAutoTaskSlash(
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
 * - 命中即返回 true,不发送给 LLM,清空输入框。toast 给反馈。
 * - 仅当输入完全匹配 /plan /act 开头(后接空白或行尾)时命中,避免误伤。
 * - 2026-08-27 修复:/build /review /spec 不再由此 handler 拦截(移交下方
 *   tryHandleChatModeSlash)—— 原先两 handler 功能重叠,plan 版恒先命中,
 *   ChatMode 版成死代码且 toast 硬编码中文(非 zh-CN locale 泄漏中文文案)。
 * - t: next-intl 翻译函数(useChat 顶层 useTranslations('chat') 传入,与
 *   tryHandleChatModeSlash 一致,toast 文案随 locale 切换)。 */
export function tryHandlePlanModeSlash(
  text: string,
  t: (key: string, vars?: Record<string, string>) => string,
): boolean {
  const trimmed = text.trimStart()
  // /plan /act → ChatMode(2026-07-28 移除独立 PlanActToggle 后直接走 ChatMode;
  // act=build 语义一致,plan=plan 语义一致)
  const m = /^\/(plan|act)\b\s*/.exec(trimmed)
  if (!m) return false
  const raw = m[1]
  const target: ChatMode = raw === 'act' ? 'build' : 'plan'
  const labelKey = target === 'build' ? 'modeBuild' : 'modePlan'
  const descKey = target === 'build' ? 'modeBuildDesc' : 'modePlanDesc'
  const label = t(labelKey)
  const modeStore = useModeStore.getState()
  if (modeStore.currentMode === target) {
    // 已是目标模式:不重复切换,仅 toast 提示当前模式
    toast.info(t('modeAlreadyActive', { mode: label }))
    return true
  }
  modeStore.setMode(target)
  toast.success(t('modeSwitched', { mode: label }), { description: t(descKey) })
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
export function tryHandleChatModeSlash(
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
export async function tryHandlePermissionSlash(
  text: string,
  t: (key: string, vars?: Record<string, string>) => string,
): Promise<boolean> {
  const trimmed = text.trimStart()
  // 必须以 /permission 开头,后接 ask/auto/full + 空白或行尾
  const m = /^\/permission\s+(ask|auto|full)\b\s*$/.exec(trimmed)
  if (!m) return false
  const target = m[1] as 'ask' | 'auto' | 'full'
  // 翻译函数由 useChat 调用方传入,保持模块级函数不违反 Hooks 规则。
  const { switchPermissionMode } = await import('@/components/ai/permission-mode-popover')
  const modeMap: Record<'ask' | 'auto' | 'full', WorkspacePermissionMode> = {
    ask: 'default',
    auto: 'accept-edits',
    full: 'bypass-permissions',
  }
  const targetMode = modeMap[target]
  // 已是目标模式:不重复切换,仅 toast 提示
  // 2026-08-31:未绑定工作区时读暂存模式,避免 /permission 已激活误判
  const st = useAiPanelStore.getState()
  const currentMode = st.activeWorkspace?.mode ?? st.pendingPermissionMode
  const labelKey =
    target === 'ask'
      ? 'permissionLabelAsk'
      : target === 'auto'
        ? 'permissionLabelAuto'
        : 'permissionLabelFull'
  const label = t(labelKey)
  if (currentMode === targetMode) {
    toast.info(t('permissionAlreadyActive', { mode: label }))
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
    toast.error(t('permissionSwitchFailed', { error: result.error ?? t('permissionUnknownError') }))
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
    toast(t('permissionSwitchedFullTitle'), {
      description: t('permissionSwitchedFullDesc', { previous: result.previousMode }),
      duration: 5000,
      action: {
        label: t('permissionUndoLabel'),
        onClick: async () => {
          await switchPermissionMode(result.previousMode!)
        },
      },
    })
  } else if (target === 'auto') {
    toast.success(t('permissionSwitchedAutoTitle'), {
      description: t('permissionSwitchedAutoDesc'),
      duration: 3000,
    })
  } else if (target === 'ask' && result.previousMode === 'bypass-permissions') {
    toast.success(t('permissionSwitchedAskTitle'), {
      description: t('permissionSwitchedAskDesc'),
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
export const SUGGEST_KEYWORDS: { mode: ChatMode; keywords: string[] }[] = [
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
export function suggestMode(userInput: string): ChatMode | null {
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
export function tryAutoDetectMode(text: string): void {
  const suggested = suggestMode(text)
  if (!suggested) return
  const modeStore = useModeStore.getState()
  if (modeStore.currentMode === suggested) return
  modeStore.setMode(suggested)
}

export async function tryHandleSelfMediaSlash(
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
