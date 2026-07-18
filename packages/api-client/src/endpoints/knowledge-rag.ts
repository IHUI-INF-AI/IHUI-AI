import { fetchApi } from '../client.js'

/** 知识库文档摘要 */
export interface KnowledgeDocSummary {
  id: number
  title: string
  sourceType: string
  chunkCount: number
  createdAt: string | null
}

/** 知识库文档详情 */
export interface KnowledgeDocDetail extends KnowledgeDocSummary {
  sourcePath: string | null
  contentHash: string | null
}

/** 检索命中条目 */
export interface KnowledgeSearchHit {
  id: number
  docId: number
  content: string
  score: number
  chunkIndex: number
}

/** 文档切片预览 */
export interface KnowledgeChunkPreview {
  id: number
  chunkIndex: number
  content: string
}

/** 知识库健康检查 */
export async function checkKnowledgeHealth(): Promise<{ status: string }> {
  const res = await fetchApi<{ status: string }>('/api/knowledge/health')
  if (!res.success) throw new Error(res.error || '知识库健康检查失败')
  return res.data
}

/** 文本入库 */
export async function ingestKnowledgeText(opts: {
  ownerUuid: string
  title: string
  text: string
  collectionName?: string
}): Promise<{ chunkCount: number }> {
  const res = await fetchApi<{ chunkCount: number }>('/api/knowledge/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  if (!res.success) throw new Error(res.error || '入库失败')
  return res.data
}

/** 语义检索 */
export async function searchKnowledge(opts: {
  query: string
  collectionName?: string
  topK?: number
  scoreThreshold?: number
  ownerUuid?: string
}): Promise<KnowledgeSearchHit[]> {
  const res = await fetchApi<KnowledgeSearchHit[]>('/api/knowledge/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  if (!res.success) throw new Error(res.error || '检索失败')
  return res.data
}

/** 生成 RAG 上下文 */
export async function getKnowledgeRagContext(opts: {
  query: string
  collectionName?: string
  topK?: number
  ownerUuid?: string
}): Promise<{ context: string; hasResult: boolean }> {
  const res = await fetchApi<{ context: string; hasResult: boolean }>(
    '/api/knowledge/rag-context',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opts),
    },
  )
  if (!res.success) throw new Error(res.error || '生成上下文失败')
  return res.data
}

/** 列出文档 */
export async function listKnowledgeDocs(ownerUuid: string): Promise<KnowledgeDocSummary[]> {
  const res = await fetchApi<KnowledgeDocSummary[]>(
    `/api/knowledge/docs?ownerUuid=${encodeURIComponent(ownerUuid)}`,
  )
  if (!res.success) throw new Error(res.error || '查询文档列表失败')
  return res.data
}

/** 文档详情 */
export async function getKnowledgeDoc(
  docId: number,
  ownerUuid: string,
): Promise<KnowledgeDocDetail> {
  const res = await fetchApi<KnowledgeDocDetail>(
    `/api/knowledge/docs/${docId}?ownerUuid=${encodeURIComponent(ownerUuid)}`,
  )
  if (!res.success) throw new Error(res.error || '查询文档失败')
  return res.data
}

/** 文档切片预览 */
export async function getKnowledgeDocChunks(
  docId: number,
  ownerUuid: string,
  limit?: number,
): Promise<KnowledgeChunkPreview[]> {
  const q = new URLSearchParams({ ownerUuid })
  if (limit !== undefined) q.append('limit', String(limit))
  const res = await fetchApi<KnowledgeChunkPreview[]>(
    `/api/knowledge/docs/${docId}/chunks?${q.toString()}`,
  )
  if (!res.success) throw new Error(res.error || '查询切片失败')
  return res.data
}

/** 软删除文档 */
export async function deleteKnowledgeDoc(
  docId: number,
  ownerUuid: string,
): Promise<{ deleted: boolean }> {
  const res = await fetchApi<{ deleted: boolean }>(
    `/api/knowledge/docs/${docId}?ownerUuid=${encodeURIComponent(ownerUuid)}`,
    { method: 'DELETE' },
  )
  if (!res.success) throw new Error(res.error || '删除失败')
  return res.data
}

/** 批量删除文档 */
export async function batchDeleteKnowledgeDocs(
  docIds: number[],
  ownerUuid: string,
): Promise<{ success: number[]; failed: number[] }> {
  const res = await fetchApi<{ success: number[]; failed: number[] }>(
    '/api/knowledge/docs/batch-delete',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docIds, ownerUuid }),
    },
  )
  if (!res.success) throw new Error(res.error || '批量删除失败')
  return res.data
}
