export type {
  KnowledgeDocSummary,
  KnowledgeDocDetail,
  KnowledgeSearchHit,
  KnowledgeChunkPreview,
} from '@/lib/knowledge-rag-api'

/** 入库表单 */
export interface IngestForm {
  ownerUuid: string
  title: string
  collectionName: string
  text: string
}

/** 检索测试表单 */
export interface SearchForm {
  query: string
  collectionName: string
  topK: number
  scoreThreshold: number
}
