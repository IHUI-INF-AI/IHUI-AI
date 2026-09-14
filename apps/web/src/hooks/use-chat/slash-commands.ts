// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { toast } from '@/components/common'
import { useModeStore } from '@/stores/mode'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'
import { useGoalStore } from '@/stores/goal'
import { useIDEWorkspace } from '@/stores/ide-workspace'
import { emitAgentHook } from '@/stores/agent-hooks'
import { runCommand } from '@ihui/api-client'
import { isFullAccessConfirmSuppressed } from '@/components/ai/full-access-confirm-dialog'
import { fetchApi } from '@/lib/api'
import { runBestOfN } from '@/api/best-of-api'
import { useBestOfStore } from '@/stores/best-of'
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

/** /plan & /act 动作型斜杠命令(2026-07-25 立,对标 主流 AI IDE SOLO Plan 模式)
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

/** /ask /build /review /spec 动作型斜杠命令(2026-07-28 立,补全 ChatMode 三通道;
 *  2026-09-13 矩阵 A #24 补 /ask)
 * - /ask:    切换到问答模式(纯问答,禁工具)
 * - /build:  切换到构建模式(正常执行,全工具开放)
 * - /review: 切换到审查模式(只读审查,deny write 工具 + 强化审查 prompt)
 * - /spec:   切换到规格模式(从代码反向生成 spec 文档)
 * - 命中即返回 true,不发送给 LLM,清空输入框。toast 给反馈。
 * - 仅当输入完全匹配 /ask /build /review /spec 开头(后接空白或行尾)时命中。
 * - t: next-intl 翻译函数(由 useChat hook 顶层 useTranslations('chat') 传入,
 *   因模块级函数无法直接调 hook,2026-07-28 i18n 补全) */
export function tryHandleChatModeSlash(
  text: string,
  t: (key: string, vars?: Record<string, string>) => string,
): boolean {
  const trimmed = text.trimStart()
  const m = /^\/(ask|build|review|spec)\b\s*/.exec(trimmed)
  if (!m) return false
  const target = m[1] as 'ask' | 'build' | 'review' | 'spec'
  const modeStore = useModeStore.getState()
  const labelKey =
    target === 'ask'
      ? 'modeAsk'
      : target === 'build'
        ? 'modeBuild'
        : target === 'review'
          ? 'modeReview'
          : 'modeSpec'
  const label = t(labelKey)
  if (modeStore.currentMode === target) {
    toast.info(t('modeAlreadyActive', { mode: label }))
    return true
  }
  modeStore.setMode(target)
  const descKey =
    target === 'ask'
      ? 'modeAskDesc'
      : target === 'build'
        ? 'modeBuildDesc'
        : target === 'review'
          ? 'modeReviewDesc'
          : 'modeSpecDesc'
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

/** /goal 会话目标斜杠命令(W24,2026-09-14 立,对标 AGENTS.md §8 goal 模式工作流)
 * - /goal <目标>:设定 / 更新当前会话目标(goal store 状态机置 active)
 * - /goal:查看当前目标(无目标时提示用法)
 * - /goal done:标记当前目标完成;/goal clear:清除目标
 * - 命中即返回 true,不发送给 LLM,清空输入框;GoalCard 在工具面板「目标」tab 推进
 * - t: next-intl 'chat' 翻译函数(与 tryHandleChatModeSlash 一致) */
export function tryHandleGoalSlash(
  text: string,
  t: (key: string, vars?: Record<string, string>) => string,
): boolean {
  const trimmed = text.trim()
  if (trimmed !== '/goal' && !trimmed.startsWith('/goal ') && !trimmed.startsWith('/goal\n')) {
    return false
  }
  const rest = trimmed.slice('/goal'.length).trim()
  const goalStore = useGoalStore.getState()
  // 无参数:查看当前目标
  if (!rest) {
    const g = goalStore.goal
    if (!g) {
      toast.info(t('goalNone'))
    } else {
      toast.info(t('goalCurrent', { goal: g.text, progress: String(g.progress) }))
    }
    return true
  }
  // 操作子命令:done / clear
  if (rest === 'done') {
    if (goalStore.goal) {
      goalStore.setStatus('done')
      toast.success(t('goalDone'))
    } else {
      toast.info(t('goalNone'))
    }
    return true
  }
  if (rest === 'clear') {
    goalStore.clear()
    toast.success(t('goalCleared'))
    return true
  }
  // 设定 / 更新目标文本
  goalStore.setGoal(rest)
  toast.success(t('goalSet'))
  return true
}

/** /btw 临时侧聊斜杠命令(W24,2026-09-14 立,对标 Claude Code 侧聊不污染主线上下文)
 * - /btw <问题>:直调 REST 单副本问答(复用 /api/best-of-n/run N=1 通道),
 *   回答作为 assistant 消息写入本地消息流,但携带 meta.sidechat 标记:
 *   1) LLM 主线历史构建时过滤(send-message.ts buildHistory)
 *   2) 持久化预填充(partialize recentMessages)过滤
 *   3) 不调 persistMessageSafe —— 服务端会话历史不含侧聊
 * - 回答正文以引用块前缀标注「侧聊」,随 markdown 渲染与主消息区分
 * - t: next-intl 'chat' 翻译函数 */
export async function tryHandleBtwSlash(
  text: string,
  t: (key: string, vars?: Record<string, string>) => string,
): Promise<boolean> {
  const trimmed = text.trim()
  if (trimmed !== '/btw' && !trimmed.startsWith('/btw ') && !trimmed.startsWith('/btw\n')) {
    return false
  }
  const rest = trimmed.slice('/btw'.length).trim()
  if (!rest) {
    toast.info(t('btwUsage'))
    return true
  }
  try {
    // 单副本直调:不走 LLM chat 流,不写主线历史
    const d = await runBestOfN(rest, 1)
    const c = d.candidates[0]
    const answer = c?.content || t('btwNoAnswer')
    const store = useChatStore.getState()
    store.addMessage({
      role: 'assistant',
      content: `> 💬 **${t('btwBadge')}** · ${rest}\n\n${answer}`,
      model: c?.model ?? store.currentModel,
      meta: { sidechat: true },
    })
    toast.info(t('btwNotSaved'))
  } catch (e: unknown) {
    toast.error(t('btwFailed', { error: e instanceof Error ? e.message : String(e) }))
  }
  return true
}

/** W28 Smart Commit(2026-09-14 立,对标 CodeBuddy AI 提交):
 * - /commit [补充说明]:AI 生成提交信息并自动 git add + commit
 * - 流程:commit.before 钩子 → git status 检查变更 → git diff 拿变更内容
 *   → runBestOfN(N=1) 让 LLM 生成 Conventional Commits 信息
 *   → git add -A + git commit → commit.after 钩子 → 侧聊消息回显结果
 * - 无工作区 / 无变更时提前终止并提示
 * - t: next-intl 'chat' 翻译函数 */
function escapeCommitMessage(msg: string): string {
  return msg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function tryHandleCommitSlash(
  text: string,
  t: (key: string, vars?: Record<string, string>) => string,
): Promise<boolean> {
  const trimmed = text.trim()
  if (
    trimmed !== '/commit' &&
    !trimmed.startsWith('/commit ') &&
    !trimmed.startsWith('/commit\n')
  ) {
    return false
  }
  const hint = trimmed.slice('/commit'.length).trim()
  const workspacePath = useIDEWorkspace.getState().workspacePath
  if (!workspacePath) {
    toast.warning(t('commitNoWorkspace'))
    return true
  }
  try {
    // commit.before 钩子
    emitAgentHook('commit.before', { summary: hint || 'auto' })
    // 1. 检查是否有变更
    const statusRes = await runCommand({
      command: 'git status --porcelain',
      workspacePath,
      mode: 'read-only',
    })
    if (!statusRes.success) {
      toast.error(t('commitStatusFailed', { error: statusRes.error ?? '' }))
      return true
    }
    const statusOut = statusRes.data.stdout.trim()
    if (!statusOut) {
      toast.info(t('commitNothing'))
      return true
    }
    // 2. 拿变更内容(暂存 + 未暂存,截断到 6000 字符防 prompt 爆炸)
    const diffRes = await runCommand({
      command: 'git diff HEAD --stat',
      workspacePath,
      mode: 'read-only',
    })
    const diffStat = diffRes.success ? diffRes.data.stdout.slice(0, 3000) : statusOut
    // 3. LLM 生成提交信息(单副本直调,复用 /api/best-of-n/run 通道)
    const prompt = [
      'You are a git commit message generator. Output ONLY one line in Conventional Commits format',
      '(type(scope): subject), max 72 chars. Reply in the primary language of the changes,',
      'no explanations, no quotes, no markdown.',
      hint ? `User hint: ${hint}` : '',
      `Changed files:\n${diffStat.slice(0, 3000)}`,
    ]
      .filter(Boolean)
      .join('\n')
    const d = await runBestOfN(prompt, 1)
    const c = d.candidates[0]
    let message = (c?.content ?? '').trim().split('\n')[0]?.slice(0, 72) ?? ''
    if (!message) message = 'chore: update workspace files'
    // 4. 暂存 + 提交
    const addRes = await runCommand({
      command: 'git add -A',
      workspacePath,
      mode: 'workspace-write',
    })
    if (!addRes.success) {
      toast.error(t('commitAddFailed', { error: addRes.error ?? '' }))
      return true
    }
    const commitRes = await runCommand({
      command: `git commit -m "${escapeCommitMessage(message)}"`,
      workspacePath,
      mode: 'workspace-write',
    })
    const ok = commitRes.success
    // 5. 刷新源码管理面板(git log / diff / staged)
    if (ok) {
      void useIDEWorkspace.getState().fetchGitLog()
      void useIDEWorkspace.getState().fetchDiffFiles()
    }
    // commit.after 钩子
    emitAgentHook('commit.after', { summary: `${ok ? 'ok' : 'failed'}: ${message}` })
    // 侧聊消息回显结果(不污染主线历史,同 /btw 模式)
    const store = useChatStore.getState()
    store.addMessage({
      role: 'assistant',
      content: [
        `> 🔧 **${t('commitBadge')}**`,
        '',
        `- ${t('commitResult', { ok: ok ? '✅' : '❌' })}`,
        `- ${t('commitMessageLabel')}: \`${message}\``,
        `- ${t('commitFilesLabel')}: ${statusOut.split('\n').length}`,
        ...(ok ? [] : [`- ${t('commitErrorLabel')}: ${commitRes.error ?? ''}`]),
      ].join('\n'),
      model: store.currentModel,
      meta: { sidechat: true },
    })
  } catch (e: unknown) {
    toast.error(t('commitFailed', { error: e instanceof Error ? e.message : String(e) }))
  }
  return true
}

/** 关键词 → ChatMode 映射(2026-07-28 立,AI 自动判断模式)
 * - 与原 mode-switcher.tsx 的 SUGGEST_KEYWORDS 完全一致,迁移到 use-chat.ts
 *   统一为单一事实源,移除 4 按钮后避免散落
 * - 关键词匹配采用"首次命中优先"策略,与文本子串 includes() 检测
 * - 优先级顺序:plan → build → review → spec → ask(数组顺序决定优先级;
 *   ask 置末位,避免"如何修复X"这类含 ask 关键词的构建任务被抢命中)
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
  // ask 置末位(2026-09-13 矩阵 A #24):纯问答关键词,仅在未命中 plan/build/review/spec 时兜底
  {
    mode: 'ask',
    keywords: ['什么是', '解释一下', '介绍一下', '为什么', '讲讲', 'explain', 'what is', 'why'],
  },
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

/** /bestof 斜杠命令:同任务 N 副本并行执行 + LLM 评审自动择优(2026-09-07 立,对标 Cursor 多副本择优)
 *  格式:/bestof <任务描述> [#N]  N=副本数 1-5,默认 3
 *  直调 POST /api/best-of-n/run(经 web 代理 → ai-service 8803),不走 LLM chat 流。
 *  耗时可达分钟级(N 副本同步执行 + 评审),timeoutMs 放大到 180s。 */
export async function tryHandleBestOfSlash(
  text: string,
  onResult: (assistantContent: string) => void,
): Promise<boolean> {
  const trimmed = text.trim()
  if (
    trimmed !== '/bestof' &&
    !trimmed.startsWith('/bestof ') &&
    !trimmed.startsWith('/bestof\n')
  ) {
    return false
  }
  let rest = trimmed.slice('/bestof'.length).trim()
  // 可选 #N 尾缀控制副本数(1-5)
  let n = 3
  const nMatch = rest.match(/\s#(\d+)\s*$/)
  if (nMatch) {
    n = Math.min(5, Math.max(1, Number(nMatch[1]) || 3))
    rest = rest.slice(0, nMatch.index).trim()
  }
  if (!rest) {
    onResult('用法: /bestof <任务描述> [#N]。例如 /bestof 用一句话介绍量子计算 #3(N=副本数,默认 3)')
    return true
  }
  try {
    // W23(2026-09-14):直调 REST 后把完整结果写入 best-of store,工具面板 BestOfCompare 并排对比
    const d = await runBestOfN(rest, n)
    useBestOfStore.getState().setResult(rest, d)
    const lines = [
      `### 🏆 Best-of-N 择优(N=${d.nRequested},${d.evaluatorFallback ? '评审兜底' : `评审 ${d.evaluatorModel}`},总成本 $${d.totalCostUsd.toFixed(4)})`,
      '',
      d.winner.content || '(空回复)',
      '',
      '| 副本 | 评分 | 模型 | 耗时 | 状态 |',
      '| --- | --- | --- | --- | --- |',
      ...d.candidates.map(
        (c) =>
          `| #${c.candidate_id} | ${c.score ?? '—'} | ${c.model} | ${c.latency_ms}ms | ${c.ok ? '✅' : `❌ ${c.error.slice(0, 40)}`} |`,
      ),
    ]
    if (d.rationale) lines.push('', `📌 评审理由: ${d.rationale}`)
    onResult(lines.join('\n'))
  } catch (e: unknown) {
    onResult(`❌ /bestof 调用失败: ${e instanceof Error ? e.message : String(e)}`)
  }
  return true
}

export async function tryHandleSelfMediaSlash(
  text: string,
  onResult: (assistantContent: string) => void,
): Promise<boolean> {
  // 返回 true 表示命中斜杠命令(已调 skill),false 表示走原 chat 流程
  // 优先检查 /bestof(直调 REST 择优,2026-09-07)与 /auto-task(独立处理,因 endpoint 含路径参数)
  if (await tryHandleBestOfSlash(text, onResult)) return true
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
