/**
 * 知识库 / RAG / 知识图谱模块。
 *
 * 端点(13 个):
 * - GET    /v1/knowledge/health
 * - GET    /v1/knowledge/documents
 * - POST   /v1/knowledge/documents
 * - GET    /v1/knowledge/documents/:id
 * - GET    /v1/knowledge/documents/:id/chunks
 * - DELETE /v1/knowledge/documents/:id
 * - POST   /v1/knowledge/documents/batch-delete
 * - POST   /v1/knowledge/search
 * - POST   /v1/knowledge/rag-context
 * - POST   /v1/knowledge-graph/extract
 * - POST   /v1/knowledge-graph/build
 * - GET    /v1/knowledge-graph/data
 * - DELETE /v1/knowledge-graph/data
 */

import type { BaseClient } from './base.js'

// =============================================================================
// 内联类型定义
// =============================================================================

/** 知识库健康检查响应。 */
export interface V1KnowledgeHealthResponse {
  status: 'ok' | 'degraded'
  documents: number
  chunks: number
}

export interface V1KnowledgeDocumentsResponse {
  object: 'list'
  data: Array<{
    id: string
    title: string
    source: string
    chunkCount: number
    sizeBytes: number
    createdAt: string
  }>
}

export interface V1IngestDocumentRequest {
  title: string
  content: string
  source?: string
  chunkStrategy?: string
  chunkSize?: number
  chunkOverlap?: number
}

export interface V1IngestDocumentResponse {
  documentId: string
  chunkCount: number
  status: 'ingested'
}

/** 文档详情。 */
export interface V1KnowledgeDocumentDetail {
  id: string
  title: string
  source: string
  chunkCount: number
  sizeBytes: number
  createdAt: string
  updatedAt: string
}

export interface V1DocumentChunksResponse {
  object: 'list'
  data: Array<{
    id: string
    content: string
    index: number
    metadata?: Record<string, unknown>
  }>
}

export interface V1KnowledgeSearchRequest {
  query: string
  topK?: number
  documentIds?: string[]
  threshold?: number
}

export interface V1KnowledgeSearchResponse {
  object: 'list'
  data: Array<{
    id: string
    documentId: string
    content: string
    score: number
    metadata?: Record<string, unknown>
  }>
}

export interface V1RagContextRequest {
  query: string
  topK?: number
  injectSystemPrompt?: boolean
}

export interface V1RagContextResponse {
  context: string
  sources: Array<{
    documentId: string
    chunkId: string
    score: number
  }>
}

export interface V1KnowledgeGraphExtractRequest {
  text: string
  extractType?: string
}

export interface V1KnowledgeGraphExtractResponse {
  entities: Array<{
    id: string
    name: string
    type: string
    properties?: Record<string, unknown>
  }>
  relations: Array<{
    source: string
    target: string
    type: string
    properties?: Record<string, unknown>
  }>
}

/** 知识图谱构建请求。 */
export interface V1KnowledgeGraphBuildRequest {
  source: string
  sourceType?: string
}

/** 知识图谱构建响应。 */
export interface V1KnowledgeGraphBuildResponse {
  graphId: string
  nodes: number
  edges: number
}

export interface V1KnowledgeGraphDataResponse {
  nodes: Array<{ id: string; label: string; type: string }>
  edges: Array<{ source: string; target: string; label: string }>
}

/** 批量删除请求。 */
export interface V1BatchDeleteDocumentsRequest {
  documentIds: string[]
}

/** 批量删除响应。 */
export interface V1BatchDeleteDocumentsResponse {
  deleted: number
}

// =============================================================================
// Module 接口 + 工厂函数
// =============================================================================

export interface KnowledgeModule {
  /** GET /v1/knowledge/health(健康检查)。 */
  health(): Promise<V1KnowledgeHealthResponse>
  /** GET /v1/knowledge/documents(文档列表)。 */
  listDocuments(): Promise<V1KnowledgeDocumentsResponse>
  /** POST /v1/knowledge/documents(文档入库)。 */
  ingestDocument(req: V1IngestDocumentRequest): Promise<V1IngestDocumentResponse>
  /** GET /v1/knowledge/documents/:id(文档详情)。 */
  getDocument(id: string): Promise<V1KnowledgeDocumentDetail>
  /** GET /v1/knowledge/documents/:id/chunks(文档分块)。 */
  getDocumentChunks(id: string): Promise<V1DocumentChunksResponse>
  /** DELETE /v1/knowledge/documents/:id(删除文档)。 */
  deleteDocument(id: string): Promise<void>
  /** POST /v1/knowledge/documents/batch-delete(批量删除)。 */
  batchDeleteDocuments(req: V1BatchDeleteDocumentsRequest): Promise<V1BatchDeleteDocumentsResponse>
  /** POST /v1/knowledge/search(语义搜索)。 */
  search(req: V1KnowledgeSearchRequest): Promise<V1KnowledgeSearchResponse>
  /** POST /v1/knowledge/rag-context(RAG 上下文检索)。 */
  ragContext(req: V1RagContextRequest): Promise<V1RagContextResponse>
  /** POST /v1/knowledge-graph/extract(知识图谱抽取)。 */
  extractGraph(req: V1KnowledgeGraphExtractRequest): Promise<V1KnowledgeGraphExtractResponse>
  /** POST /v1/knowledge-graph/build(知识图谱构建)。 */
  buildGraph(req: V1KnowledgeGraphBuildRequest): Promise<V1KnowledgeGraphBuildResponse>
  /** GET /v1/knowledge-graph/data(知识图谱数据)。 */
  getGraphData(): Promise<V1KnowledgeGraphDataResponse>
  /** DELETE /v1/knowledge-graph/data(清空知识图谱)。 */
  clearGraph(): Promise<void>
}

export function createKnowledgeModule(client: BaseClient): KnowledgeModule {
  return {
    health: () => client.request<V1KnowledgeHealthResponse>('GET', '/knowledge/health'),
    listDocuments: () =>
      client.request<V1KnowledgeDocumentsResponse>('GET', '/knowledge/documents'),
    ingestDocument: (req) =>
      client.request<V1IngestDocumentResponse>('POST', '/knowledge/documents', req),
    getDocument: (id) =>
      client.request<V1KnowledgeDocumentDetail>(
        'GET',
        `/knowledge/documents/${encodeURIComponent(id)}`,
      ),
    getDocumentChunks: (id) =>
      client.request<V1DocumentChunksResponse>(
        'GET',
        `/knowledge/documents/${encodeURIComponent(id)}/chunks`,
      ),
    deleteDocument: (id) =>
      client.request<void>('DELETE', `/knowledge/documents/${encodeURIComponent(id)}`),
    batchDeleteDocuments: (req) =>
      client.request<V1BatchDeleteDocumentsResponse>(
        'POST',
        '/knowledge/documents/batch-delete',
        req,
      ),
    search: (req) => client.request<V1KnowledgeSearchResponse>('POST', '/knowledge/search', req),
    ragContext: (req) =>
      client.request<V1RagContextResponse>('POST', '/knowledge/rag-context', req),
    extractGraph: (req) =>
      client.request<V1KnowledgeGraphExtractResponse>('POST', '/knowledge-graph/extract', req),
    buildGraph: (req) =>
      client.request<V1KnowledgeGraphBuildResponse>('POST', '/knowledge-graph/build', req),
    getGraphData: () =>
      client.request<V1KnowledgeGraphDataResponse>('GET', '/knowledge-graph/data'),
    clearGraph: () => client.request<void>('DELETE', '/knowledge-graph/data'),
  }
}
