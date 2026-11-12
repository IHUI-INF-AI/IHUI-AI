// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 任务模板定时调度(HR-4 第 1 期,2026-11-11 立)。
 *
 * 形态逐字照抄 jobs/hr-jobs-cron.ts:node-cron + start/stop 成对导出,启动侧挂
 * startBackgroundSchedulers(index.ts)。每 5 分钟扫一次 ai_task_template,挑出
 * triggerType='cron' && enabled && cron 的模板逐个 runAiTask(name, defaultCaller,
 * { manual:false });幂等键按业务日去重 ⇒ 同一天只有首轮真正执行,其余 skipped,预期行为。
 * ENABLE_AI_TASK_CRON=false 禁用(默认开启)。
 */
import cron, { type ScheduledTask } from 'node-cron'
import { logger } from '../utils/logger.js'
import {
  listAiTaskTemplates,
  runAiTask,
  type TaskStepCaller,
} from '../services/ai-task-executor.js'

/** 同进程回环 fetch caller:把本机 /api 端点当工具调用。
 *
 * 形态逐字复制 routes/ai-task-templates.ts 的 defaultCaller;jobs 不该依赖 routes 层,
 * 故就地复制这一小函数。从环境变量取本机端口,回环 fetch 到 /api 前缀端点。
 */
const defaultCaller: TaskStepCaller = async (method, path, params) => {
  const port = process.env.PORT ?? '3000'
  const qs =
    method.toUpperCase() === 'GET' && Object.keys(params ?? {}).length
      ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`
      : ''
  const url = `http://127.0.0.1:${port}/api${path.startsWith('/') ? path : `/${path}`}${qs}`
  const res = await fetch(url, {
    method: method.toUpperCase(),
    headers: { 'content-type': 'application/json' },
    body: method.toUpperCase() === 'GET' ? undefined : JSON.stringify(params ?? {}),
  })
  if (!res.ok) throw new Error(`endpoint ${method} ${path} failed: ${res.status}`)
  return res.json()
}

const scheduledTasks: ScheduledTask[] = []

/** node-cron 6 段表达式:每 5 分钟触发一次 */
const AI_TASK_CRON_EXPR = '0 */5 * * * *'

export function startAiTaskCronScheduler(): void {
  if (scheduledTasks.length > 0) return
  if (process.env.ENABLE_AI_TASK_CRON === 'false') {
    logger.info(
      '[ai-task-cron] ENABLE_AI_TASK_CRON=false,跳过调度(startAiTaskCronScheduler 仍可手动调用)',
    )
    return
  }
  const task = cron.schedule(
    AI_TASK_CRON_EXPR,
    async () => {
      try {
        const templates = await listAiTaskTemplates()
        const targets = templates.filter((t) => t.triggerType === 'cron' && t.enabled && !!t.cron)
        for (const tpl of targets) {
          try {
            await runAiTask(tpl.name, defaultCaller, { manual: false })
          } catch (e) {
            logger.error('[ai-task-cron] 单模板 tick 异常', {
              template: tpl.name,
              err: e instanceof Error ? e.message : String(e),
            })
          }
        }
      } catch (e) {
        logger.error('[ai-task-cron] 定时 tick 异常', {
          err: e instanceof Error ? e.message : String(e),
        })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  scheduledTasks.push(task)
  logger.info(`[ai-task-cron] cron started (cron: "${AI_TASK_CRON_EXPR}" Asia/Shanghai)`)
}

export function stopAiTaskCronScheduler(): void {
  for (const t of scheduledTasks) t.stop()
  if (scheduledTasks.length > 0) logger.info('[ai-task-cron] cron scheduler stopped')
  scheduledTasks.length = 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
