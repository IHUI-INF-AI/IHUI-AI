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
import type {
  V1KnowledgeDocumentsResponse,
  V1IngestDocumentRequest,
  V1IngestDocumentResponse,
  V1DocumentChunksResponse,
  V1KnowledgeSearchRequest,
  V1KnowledgeSearchResponse,
  V1RagContextRequest,
  V1RagContextResponse,
  V1KnowledgeGraphExtractRequest,
  V1KnowledgeGraphExtractResponse,
  V1KnowledgeGraphDataResponse,
} from '@ihui/types'

/** 知识库健康检查响应。 */
export interface V1KnowledgeHealthResponse {
  status: 'ok' | 'degraded'
  documents: number
  chunks: number
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

/** 批量删除请求。 */
export interface V1BatchDeleteDocumentsRequest {
  documentIds: string[]
}

/** 批量删除响应。 */
export interface V1BatchDeleteDocumentsResponse {
  deleted: number
}

/** 知识图谱构建请求。 */
export interface V1KnowledgeGraphBuildRequest {
  source: string
  /** 数据源类型:text / document / url。 */
  sourceType?: string
}

/** 知识图谱构建响应。 */
export interface V1KnowledgeGraphBuildResponse {
  graphId: string
  nodes: number
  edges: number
}

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
    listDocuments: () => client.request<V1KnowledgeDocumentsResponse>('GET', '/knowledge/documents'),
    ingestDocument: (req) =>
      client.request<V1IngestDocumentResponse>('POST', '/knowledge/documents', req),
    getDocument: (id) =>
      client.request<V1KnowledgeDocumentDetail>('GET', `/knowledge/documents/${encodeURIComponent(id)}`),
    getDocumentChunks: (id) =>
      client.request<V1DocumentChunksResponse>(
        'GET',
        `/knowledge/documents/${encodeURIComponent(id)}/chunks`,
      ),
    deleteDocument: (id) =>
      client.request<void>('DELETE', `/knowledge/documents/${encodeURIComponent(id)}`),
    batchDeleteDocuments: (req) =>
      client.request<V1BatchDeleteDocumentsResponse>('POST', '/knowledge/documents/batch-delete', req),
    search: (req) => client.request<V1KnowledgeSearchResponse>('POST', '/knowledge/search', req),
    ragContext: (req) => client.request<V1RagContextResponse>('POST', '/knowledge/rag-context', req),
    extractGraph: (req) =>
      client.request<V1KnowledgeGraphExtractResponse>('POST', '/knowledge-graph/extract', req),
    buildGraph: (req) =>
      client.request<V1KnowledgeGraphBuildResponse>('POST', '/knowledge-graph/build', req),
    getGraphData: () => client.request<V1KnowledgeGraphDataResponse>('GET', '/knowledge-graph/data'),
    clearGraph: () => client.request<void>('DELETE', '/knowledge-graph/data'),
  }
}
