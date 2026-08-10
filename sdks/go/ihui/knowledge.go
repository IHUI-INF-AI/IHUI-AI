package ihui

import "context"

// KnowledgeApi 封装知识库端点(13 个):文档 / 搜索 / RAG / 知识图谱。
type KnowledgeApi struct {
	client *BaseClient
}

// NewKnowledgeApi 构造 KnowledgeApi。
func NewKnowledgeApi(c *BaseClient) *KnowledgeApi {
	return &KnowledgeApi{client: c}
}

// Health GET /v1/knowledge/health(健康检查)。
func (a *KnowledgeApi) Health(ctx context.Context) (*KnowledgeHealthResponse, error) {
	out := &KnowledgeHealthResponse{}
	if err := a.client.Request(ctx, "GET", "/knowledge/health", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListDocuments GET /v1/knowledge/documents(文档列表)。
func (a *KnowledgeApi) ListDocuments(ctx context.Context) (*KnowledgeDocumentsResponse, error) {
	out := &KnowledgeDocumentsResponse{}
	if err := a.client.Request(ctx, "GET", "/knowledge/documents", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// IngestDocument POST /v1/knowledge/documents(文档入库)。
func (a *KnowledgeApi) IngestDocument(ctx context.Context, req *IngestDocumentRequest) (*IngestDocumentResponse, error) {
	out := &IngestDocumentResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge/documents", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetDocument GET /v1/knowledge/documents/:id(文档详情)。
func (a *KnowledgeApi) GetDocument(ctx context.Context, id string) (*KnowledgeDocumentDetail, error) {
	out := &KnowledgeDocumentDetail{}
	if err := a.client.Request(ctx, "GET", "/knowledge/documents/"+Encode(id), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetDocumentChunks GET /v1/knowledge/documents/:id/chunks(文档分块)。
func (a *KnowledgeApi) GetDocumentChunks(ctx context.Context, id string) (*DocumentChunksResponse, error) {
	out := &DocumentChunksResponse{}
	if err := a.client.Request(ctx, "GET", "/knowledge/documents/"+Encode(id)+"/chunks", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// DeleteDocument DELETE /v1/knowledge/documents/:id(删除文档)。
func (a *KnowledgeApi) DeleteDocument(ctx context.Context, id string) error {
	return a.client.Request(ctx, "DELETE", "/knowledge/documents/"+Encode(id), nil, nil)
}

// BatchDeleteDocuments POST /v1/knowledge/documents/batch-delete(批量删除)。
func (a *KnowledgeApi) BatchDeleteDocuments(ctx context.Context, req *BatchDeleteDocumentsRequest) (*BatchDeleteDocumentsResponse, error) {
	out := &BatchDeleteDocumentsResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge/documents/batch-delete", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Search POST /v1/knowledge/search(语义搜索)。
func (a *KnowledgeApi) Search(ctx context.Context, req *KnowledgeSearchRequest) (*KnowledgeSearchResponse, error) {
	out := &KnowledgeSearchResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge/search", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// RagContext POST /v1/knowledge/rag-context(RAG 上下文检索)。
func (a *KnowledgeApi) RagContext(ctx context.Context, req *RagContextRequest) (*RagContextResponse, error) {
	out := &RagContextResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge/rag-context", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ExtractGraph POST /v1/knowledge-graph/extract(知识图谱抽取)。
func (a *KnowledgeApi) ExtractGraph(ctx context.Context, req *KnowledgeGraphExtractRequest) (*KnowledgeGraphExtractResponse, error) {
	out := &KnowledgeGraphExtractResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge-graph/extract", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// BuildGraph POST /v1/knowledge-graph/build(知识图谱构建)。
func (a *KnowledgeApi) BuildGraph(ctx context.Context, req *KnowledgeGraphBuildRequest) (*KnowledgeGraphBuildResponse, error) {
	out := &KnowledgeGraphBuildResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge-graph/build", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetGraphData GET /v1/knowledge-graph/data(知识图谱数据)。
func (a *KnowledgeApi) GetGraphData(ctx context.Context) (*KnowledgeGraphDataResponse, error) {
	out := &KnowledgeGraphDataResponse{}
	if err := a.client.Request(ctx, "GET", "/knowledge-graph/data", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ClearGraph DELETE /v1/knowledge-graph/data(清空知识图谱)。
func (a *KnowledgeApi) ClearGraph(ctx context.Context) error {
	return a.client.Request(ctx, "DELETE", "/knowledge-graph/data", nil, nil)
}