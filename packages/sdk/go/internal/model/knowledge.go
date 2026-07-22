// Package model 的知识库 / RAG / 知识图谱类型。
package model

// KnowledgeHealthResponse 是 GET /v1/knowledge/health 响应体。
type KnowledgeHealthResponse struct {
	Status    string `json:"status"`
	Documents int    `json:"documents"`
	Chunks    int    `json:"chunks"`
}

// KnowledgeDocumentItem 是知识库文档列表项。
type KnowledgeDocumentItem struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Source     string `json:"source"`
	ChunkCount int    `json:"chunkCount"`
	SizeBytes  int64  `json:"sizeBytes"`
	CreatedAt  string `json:"createdAt"`
}

// KnowledgeDocumentsResponse 是 GET /v1/knowledge/documents 响应体。
type KnowledgeDocumentsResponse struct {
	Object string                  `json:"object"`
	Data   []KnowledgeDocumentItem `json:"data"`
}

// IngestDocumentRequest 是 POST /v1/knowledge/documents 请求体(文档入库)。
type IngestDocumentRequest struct {
	Title         string `json:"title"`
	Content       string `json:"content"`
	Source        string `json:"source,omitempty"`
	ChunkStrategy string `json:"chunkStrategy,omitempty"`
	ChunkSize     *int   `json:"chunkSize,omitempty"`
	ChunkOverlap  *int   `json:"chunkOverlap,omitempty"`
}

// IngestDocumentResponse 是 POST /v1/knowledge/documents 响应体。
type IngestDocumentResponse struct {
	DocumentID string `json:"documentId"`
	ChunkCount int    `json:"chunkCount"`
	Status     string `json:"status"`
}

// KnowledgeDocumentDetail 是 GET /v1/knowledge/documents/:id 响应体(文档详情)。
type KnowledgeDocumentDetail struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Source     string `json:"source"`
	ChunkCount int    `json:"chunkCount"`
	SizeBytes  int64  `json:"sizeBytes"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

// DocumentChunkItem 是文档分块项。
type DocumentChunkItem struct {
	ID       string         `json:"id"`
	Content  string         `json:"content"`
	Index    int            `json:"index"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

// DocumentChunksResponse 是 GET /v1/knowledge/documents/:id/chunks 响应体。
type DocumentChunksResponse struct {
	Object string              `json:"object"`
	Data   []DocumentChunkItem `json:"data"`
}

// KnowledgeSearchRequest 是 POST /v1/knowledge/search 请求体(语义搜索)。
type KnowledgeSearchRequest struct {
	Query       string   `json:"query"`
	TopK        *int     `json:"topK,omitempty"`
	DocumentIDs []string `json:"documentIds,omitempty"`
	Threshold   float64  `json:"threshold,omitempty"`
}

// KnowledgeSearchResultItem 是搜索结果项。
type KnowledgeSearchResultItem struct {
	ID         string         `json:"id"`
	DocumentID string         `json:"documentId"`
	Content    string         `json:"content"`
	Score      float64        `json:"score"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// KnowledgeSearchResponse 是 POST /v1/knowledge/search 响应体。
type KnowledgeSearchResponse struct {
	Object string                      `json:"object"`
	Data   []KnowledgeSearchResultItem `json:"data"`
}

// RagContextRequest 是 POST /v1/knowledge/rag-context 请求体。
type RagContextRequest struct {
	Query              string `json:"query"`
	TopK               *int   `json:"topK,omitempty"`
	InjectSystemPrompt *bool  `json:"injectSystemPrompt,omitempty"`
}

// RagContextSource 是 RAG 上下文来源。
type RagContextSource struct {
	DocumentID string  `json:"documentId"`
	ChunkID    string  `json:"chunkId"`
	Score      float64 `json:"score"`
}

// RagContextResponse 是 POST /v1/knowledge/rag-context 响应体。
type RagContextResponse struct {
	Context string             `json:"context"`
	Sources []RagContextSource `json:"sources"`
}

// BatchDeleteDocumentsRequest 是 POST /v1/knowledge/documents/batch-delete 请求体。
type BatchDeleteDocumentsRequest struct {
	DocumentIDs []string `json:"documentIds"`
}

// BatchDeleteDocumentsResponse 是批量删除响应。
type BatchDeleteDocumentsResponse struct {
	Deleted int `json:"deleted"`
}

// KnowledgeGraphExtractRequest 是 POST /v1/knowledge-graph/extract 请求体。
type KnowledgeGraphExtractRequest struct {
	Text        string `json:"text"`
	ExtractType string `json:"extractType,omitempty"`
}

// GraphEntity 是知识图谱实体。
type GraphEntity struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	Type       string         `json:"type"`
	Properties map[string]any `json:"properties,omitempty"`
}

// GraphRelation 是知识图谱关系。
type GraphRelation struct {
	Source     string         `json:"source"`
	Target     string         `json:"target"`
	Type       string         `json:"type"`
	Properties map[string]any `json:"properties,omitempty"`
}

// KnowledgeGraphExtractResponse 是 POST /v1/knowledge-graph/extract 响应体。
type KnowledgeGraphExtractResponse struct {
	Entities  []GraphEntity   `json:"entities"`
	Relations []GraphRelation `json:"relations"`
}

// KnowledgeGraphBuildRequest 是 POST /v1/knowledge-graph/build 请求体。
type KnowledgeGraphBuildRequest struct {
	Source     string `json:"source"`
	SourceType string `json:"sourceType,omitempty"`
}

// KnowledgeGraphBuildResponse 是 POST /v1/knowledge-graph/build 响应体。
type KnowledgeGraphBuildResponse struct {
	GraphID string `json:"graphId"`
	Nodes   int    `json:"nodes"`
	Edges   int    `json:"edges"`
}

// GraphNode 是知识图谱节点。
type GraphNode struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Type  string `json:"type"`
}

// GraphEdge 是知识图谱边。
type GraphEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label"`
}

// KnowledgeGraphDataResponse 是 GET /v1/knowledge-graph/data 响应体。
type KnowledgeGraphDataResponse struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}
