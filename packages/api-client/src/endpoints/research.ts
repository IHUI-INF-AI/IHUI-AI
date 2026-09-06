// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Deep Research 深度研究端点封装(2026-09-07 工作线 B 立)。
 *
 * 后端:apps/ai-service/app/routers/research.py(prefix /research,master 以 /api 挂载):
 *   POST /api/research/start         → { research_id, status }
 *   GET  /api/research/{research_id} → 研究进度 + 中间产物 + 终态报告(裸 JSON)
 * 字段契约对齐 services/deep_research.py ResearchReport.to_dict()(snake_case)。
 */
import { fetchApi } from '../client'

/** 来源引用(SourceRef):统一 URL 去重锚点,含来源分级与可信度标注 */
export interface ResearchSourceRef {
  url: string
  title: string
  snippet: string
  /** 来源分级:authoritative / media / community / unknown */
  tier: string
  /** 0~1 基础置信度 */
  confidence: number
  /** 是否为高可信来源(官方/媒体);社区/未知 → false 须标注 */
  verified: boolean
}

/** 阶段快照(StageSnapshot) */
export interface ResearchStage {
  phase: string
  /** running / done / skipped */
  status: string
  detail: string
  started_at?: number
  completed_at?: number
}

/** 证据单元(EvidenceUnit 序列化) */
export interface ResearchEvidence {
  question: string
  content: string
  depth: number
  source: string
  verification: string
  sources: string[]
}

/** 研究快照(GET /api/research/{id} 响应,进度骨架与终态报告同形) */
export interface ResearchReportDto {
  research_id?: string
  query?: string
  status?: string
  /** running = 后端任务仍在执行 */
  running?: boolean
  /** finished = 正常结束(done) */
  finished?: boolean
  error?: string
  subquestions?: string[]
  gap_questions?: string[]
  iteration?: number
  max_iterations?: number | null
  evidence?: ResearchEvidence[]
  headings?: string[]
  sources?: ResearchSourceRef[]
  markdown?: string
  stages?: ResearchStage[]
  created_at?: number
  updated_at?: number
}

/** 启动响应 */
export interface ResearchStartResult {
  research_id: string
  status: string
}

/** 启动一次多轮深度研究(POST /api/research/start,后台异步执行) */
export async function startResearch(
  query: string,
  maxIterations = 4,
): Promise<ResearchStartResult> {
  const res = await fetchApi<ResearchStartResult>('/api/research/start', {
    method: 'POST',
    body: JSON.stringify({ query, max_iterations: maxIterations }),
  })
  if (!res.success || !res.data) throw new Error(res.error || '启动研究失败')
  return res.data
}

/** 轮询研究进度 + 中间产物 + 终态报告(GET /api/research/{id}) */
export async function getResearchReport(researchId: string): Promise<ResearchReportDto> {
  const res = await fetchApi<ResearchReportDto>(`/api/research/${encodeURIComponent(researchId)}`)
  if (!res.success || !res.data) throw new Error(res.error || '查询研究失败')
  return res.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
