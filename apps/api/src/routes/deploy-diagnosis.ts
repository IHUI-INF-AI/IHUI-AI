// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 部署 AI 诊断端点（P2-13）。
 *
 * POST /api/admin/deploy-diagnosis
 * 接收运维侧采集的部署输入（部署结果 JSON / 健康检查输出 / 日志尾部 / 容器日志，
 * 由服务器上的 ai-diagnose 脚本或 web 管理页手动粘贴提供），
 * 转调 ai-service /api/llm/complete 让 AI 分析根因并给出修复命令建议。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

const deployDiagnosisSchema = z.object({
  deployResult: z.string().max(20_000).optional(),
  healthJson: z.string().max(50_000).optional(),
  logTail: z.string().max(50_000).optional(),
  containerLogs: z.string().max(100_000).optional(),
})

export interface DeployDiagnosisReport {
  rootCause: string
  impact: string
  fixCommands: string[]
  summary: string
  /** false = AI 返回无法解析为 JSON,raw 字段带原文 */
  parseOk: boolean
  raw?: string
}

/** 容错解析 AI 返回:剥 ```json 围栏,解析失败原文落 raw 字段 */
function parseDiagnosisReport(raw: string): DeployDiagnosisReport {
  const cleaned = raw.replace(/^[ \t]*```[a-zA-Z]*[ \t]*\r?\n?/gm, '')
  let parsed: Record<string, unknown> | null = null
  try {
    const obj: unknown = JSON.parse(cleaned)
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      parsed = obj as Record<string, unknown>
    }
  } catch {
    parsed = null
  }
  if (!parsed) {
    return { rootCause: '', impact: '', fixCommands: [], summary: '', parseOk: false, raw }
  }
  const fixCommandsRaw: unknown = parsed.fixCommands
  // 命令列表是给管理员往服务器上粘的，`null` 被 String() 成 "null"、对象被 String() 成
  // "[object Object]" 都会变成看着像命令的垃圾条目 —— 只留真内容：字符串与非空数字。
  const fixCommands = Array.isArray(fixCommandsRaw)
    ? fixCommandsRaw
        .filter(
          (c): c is string | number =>
            typeof c === 'string' || (typeof c === 'number' && Number.isFinite(c)),
        )
        .map((c) => String(c))
        .filter((c) => c.trim().length > 0)
    : []
  return {
    rootCause: typeof parsed.rootCause === 'string' ? parsed.rootCause : '',
    impact: typeof parsed.impact === 'string' ? parsed.impact : '',
    fixCommands,
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    parseOk: true,
  }
}

const DIAGNOSIS_SYSTEM_PROMPT =
  '你是 IHUI-AI 部署运维诊断专家。根据用户提供的部署结果、健康检查输出、部署日志与容器日志,' +
  '分析本次部署失败或异常的根因。只输出一个 JSON 对象,不要输出任何其他文字、解释或 markdown 代码围栏,' +
  '格式:{"rootCause":"根因,一句话","impact":"影响范围","fixCommands":["按顺序执行的修复命令数组,可为空数组"],"summary":"中文一句话摘要"}。' +
  'fixCommands 只放建议在服务器上执行的命令,不要包含破坏性命令。'

export const deployDiagnosisRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.post('/deploy-diagnosis', async (request, reply) => {
    const parsed = deployDiagnosisSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { deployResult, healthJson, logTail, containerLogs } = parsed.data
    if (!deployResult && !healthJson && !logTail && !containerLogs) {
      return reply
        .status(400)
        .send(error(400, '至少提供一个输入(deployResult / healthJson / logTail / containerLogs)'))
    }

    const sections: string[] = [
      '以下是本次部署的诊断输入(标注 [缺失] 的源取不到,忽略即可):',
      deployResult
        ? `=== 部署结果(.last-deploy-result.json) ===\n${deployResult}`
        : '=== 部署结果 === [缺失]',
      healthJson ? `=== 健康检查输出 ===\n${healthJson}` : '=== 健康检查输出 === [缺失]',
      logTail ? `=== 部署日志尾部(200 行) ===\n${logTail}` : '=== 部署日志尾部 === [缺失]',
      containerLogs
        ? `=== 容器日志(api/ai-service/web 各 100 行) ===\n${containerLogs}`
        : '=== 容器日志 === [缺失]',
    ]

    const startedAt = Date.now()
    try {
      const response = await aiServiceFetch(request, '/api/llm/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: sections.join('\n\n') }],
          system_prompt: DIAGNOSIS_SYSTEM_PROMPT,
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(180_000),
      })
      const result = (await response.json().catch(() => ({}))) as Record<string, unknown>
      if (!response.ok || result.error) {
        const message = String(
          result.error_message || result.message || `ai-service 调用失败(HTTP ${response.status})`,
        )
        return reply.status(502).send(error(502, message))
      }
      const raw = typeof result.content === 'string' ? result.content : ''
      const report = parseDiagnosisReport(raw)
      return reply.send(
        success({
          report,
          model: (result.model as string | null) ?? null,
          durationMs: Date.now() - startedAt,
        }),
      )
    } catch (e) {
      return reply
        .status(502)
        .send(error(502, `ai-service 不可达: ${e instanceof Error ? e.message : String(e)}`))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
