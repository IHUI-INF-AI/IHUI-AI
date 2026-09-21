// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D27(2026-09-20 立):交付审查视图 — 前端侧交付清单类型与解析。
 *
 * 跨端契约(钉死,与 ai-service/api 并行开发对齐,不可偏离):
 *   - agent_tasks.result.deliverables(dispatch 落库路径)
 *   - GET /api/v1/ai/agents/sessions/:sessionId/deliverables(会话级端点)
 *   - session_end SSE wire payload 可选新增字段 deliverables(camelCase 内层)
 * 注:@ihui/shared 的 agent-events 为只读区(不碰不改),故本文件承载
 * web 侧独立的宽松守卫解析,直接从 raw JSON 读取 deliverables 键做二次提取。
 */

/** D27 交付清单 — 单条引用溯源(与 CitationEntry 结构对齐,可直接复用 CitationBar 渲染) */
export interface DeliverableCitation {
  source: string
  label: string
  url?: string
}

/** D27 交付清单 — 单条文件变更记录 */
export interface DeliverableFileChange {
  path: string
  kind: 'add' | 'delete' | 'update'
  stepIds: string[]
  additions: number
  deletions: number
}

/** D27 交付清单 — 任务级聚合结果 */
export interface TaskDeliverables {
  citations: DeliverableCitation[]
  filesChanged: DeliverableFileChange[]
  toolsSummary: { total: number; byTool: Record<string, number> }
  outputSummary: string
  generatedAt: string
}

/** 文件变更 kind 合法值白名单(as const 保持字面量联合,校验后可收窄赋值) */
const FILE_KINDS = ['add', 'delete', 'update'] as const

/**
 * 宽松守卫:把 unknown 归一化为 TaskDeliverables。
 * 顶层契约字段缺失/类型不符 → null;数组内坏条目跳过而非整体拒绝
 * (展示场景宁缺毋滥,单条脏数据不废掉整份清单);调用方按无数据兜底空态,不抛错。
 */
export function normalizeTaskDeliverables(value: unknown): TaskDeliverables | null {
  if (value === null || typeof value !== 'object') return null
  const d = value as Record<string, unknown>
  if (!Array.isArray(d.citations) || !Array.isArray(d.filesChanged)) return null
  if (d.toolsSummary === null || typeof d.toolsSummary !== 'object') return null
  if (typeof d.outputSummary !== 'string' || typeof d.generatedAt !== 'string') return null

  // toolsSummary:total 必须是有限数字,byTool 必须是 string→number 映射
  const ts = d.toolsSummary as Record<string, unknown>
  if (typeof ts.total !== 'number' || !Number.isFinite(ts.total)) return null
  if (ts.byTool === null || typeof ts.byTool !== 'object') return null
  const byTool: Record<string, number> = {}
  for (const [k, v] of Object.entries(ts.byTool as Record<string, unknown>)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null
    byTool[k] = v
  }

  // citations:source/label 必填 string,url 可选(缺失/null/空串均视为无链接);
  // 坏条目跳过而非整体拒绝(展示场景宁缺毋滥,避免单条脏数据废掉整份清单)
  const citations: DeliverableCitation[] = []
  for (const c of d.citations) {
    if (c === null || typeof c !== 'object') continue
    const cc = c as Record<string, unknown>
    if (typeof cc.source !== 'string' || typeof cc.label !== 'string') continue
    const entry: DeliverableCitation = { source: cc.source, label: cc.label }
    if (typeof cc.url === 'string' && cc.url.length > 0) entry.url = cc.url
    citations.push(entry)
  }

  // filesChanged:path/kind/stepIds/additions/deletions 契约校验;坏条目跳过
  const filesChanged: DeliverableFileChange[] = []
  for (const f of d.filesChanged) {
    if (f === null || typeof f !== 'object') continue
    const ff = f as Record<string, unknown>
    if (typeof ff.path !== 'string') continue
    if (typeof ff.kind !== 'string' || !(FILE_KINDS as readonly string[]).includes(ff.kind))
      continue
    if (!Array.isArray(ff.stepIds) || ff.stepIds.some((s) => typeof s !== 'string')) continue
    if (typeof ff.additions !== 'number' || !Number.isFinite(ff.additions)) continue
    if (typeof ff.deletions !== 'number' || !Number.isFinite(ff.deletions)) continue
    filesChanged.push({
      path: ff.path,
      // 白名单校验已通过,此处安全收窄为字面量联合
      kind: ff.kind as DeliverableFileChange['kind'],
      stepIds: ff.stepIds as string[],
      additions: ff.additions,
      deletions: ff.deletions,
    })
  }

  return {
    citations,
    filesChanged,
    toolsSummary: { total: ts.total, byTool },
    outputSummary: d.outputSummary,
    generatedAt: d.generatedAt,
  }
}

/**
 * D27:session_end SSE 二次提取 — 从 raw JSON(字符串或已 parse 对象)读 deliverables 键。
 *
 * 背景:shared 的 parseSessionEndEvent 白名单解析会丢弃新增字段(session_end wire
 * payload 的 deliverables 不在白名单内),故在 web 侧 handler 拿 e.data(raw 字符串)
 * 后调用本函数二次提取,不碰 shared。
 * 宽松兼容:入参对象顶层无 deliverables 键但自身形如 TaskDeliverables 时,按自身解析
 * (会话级端点 res.data / 看板 task.result.deliverables 两条路径复用同一守卫)。
 * 解析失败/字段不符 → null(调用方空态兜底,不抛错)。
 */
export function extractSessionDeliverables(rawEventJson: unknown): TaskDeliverables | null {
  let obj: unknown = rawEventJson
  if (typeof rawEventJson === 'string') {
    try {
      obj = JSON.parse(rawEventJson)
    } catch {
      return null
    }
  }
  if (obj === null || typeof obj !== 'object') return null
  const outer = obj as Record<string, unknown>
  const inner = 'deliverables' in outer ? outer.deliverables : outer
  return normalizeTaskDeliverables(inner)
}

/**
 * D27:跨会话回溯合并 — 两个交付清单的 filesChanged 按 generatedAt 新在前合并,
 * 同文件路径去重(保留更新一组的记录)。任一入参为 null 时返回另一组的列表。
 */
export function mergeFilesChanged(
  a: TaskDeliverables | null,
  b: TaskDeliverables | null,
): DeliverableFileChange[] {
  const sources = [a, b]
    .filter((x): x is TaskDeliverables => x !== null)
    .sort((x, y) => {
      const ta = Date.parse(x.generatedAt) || 0
      const tb = Date.parse(y.generatedAt) || 0
      return tb - ta
    })
  const seen = new Set<string>()
  const merged: DeliverableFileChange[] = []
  for (const s of sources) {
    for (const f of s.filesChanged) {
      if (seen.has(f.path)) continue
      seen.add(f.path)
      merged.push(f)
    }
  }
  return merged
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
