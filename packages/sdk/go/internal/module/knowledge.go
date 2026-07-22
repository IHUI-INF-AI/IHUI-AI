// Package module 的知识库 / RAG / 知识图谱模块(13 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// KnowledgeApi 封装知识库端点(13 个):文档 / 搜索 / RAG / 知识图谱。
type KnowledgeApi struct {
	client *client.BaseClient
}

// NewKnowledgeApi 构造 KnowledgeApi。
func NewKnowledgeApi(c *client.BaseClient) *KnowledgeApi {
	return &KnowledgeApi{client: c}
}

// Health GET /v1/knowledge/health(健康检查)。
func (a *KnowledgeApi) Health(ctx context.Context) (*model.KnowledgeHealthResponse, error) {
	out := &model.KnowledgeHealthResponse{}
	if err := a.client.Request(ctx, "GET", "/knowledge/health", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListDocuments GET /v1/knowledge/documents(文档列表)。
func (a *KnowledgeApi) ListDocuments(ctx context.Context) (*model.KnowledgeDocumentsResponse, error) {
	out := &model.KnowledgeDocumentsResponse{}
	if err := a.client.Request(ctx, "GET", "/knowledge/documents", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// IngestDocument POST /v1/knowledge/documents(文档入库)。
func (a *KnowledgeApi) IngestDocument(ctx context.Context, req *model.IngestDocumentRequest) (*model.IngestDocumentResponse, error) {
	out := &model.IngestDocumentResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge/documents", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetDocument GET /v1/knowledge/documents/:id(文档详情)。
func (a *KnowledgeApi) GetDocument(ctx context.Context, id string) (*model.KnowledgeDocumentDetail, error) {
	out := &model.KnowledgeDocumentDetail{}
	if err := a.client.Request(ctx, "GET", "/knowledge/documents/"+client.Encode(id), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetDocumentChunks GET /v1/knowledge/documents/:id/chunks(文档分块)。
func (a *KnowledgeApi) GetDocumentChunks(ctx context.Context, id string) (*model.DocumentChunksResponse, error) {
	out := &model.DocumentChunksResponse{}
	if err := a.client.Request(ctx, "GET", "/knowledge/documents/"+client.Encode(id)+"/chunks", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// DeleteDocument DELETE /v1/knowledge/documents/:id(删除文档)。
func (a *KnowledgeApi) DeleteDocument(ctx context.Context, id string) error {
	return a.client.Request(ctx, "DELETE", "/knowledge/documents/"+client.Encode(id), nil, nil)
}

// BatchDeleteDocuments POST /v1/knowledge/documents/batch-delete(批量删除)。
func (a *KnowledgeApi) BatchDeleteDocuments(ctx context.Context, req *model.BatchDeleteDocumentsRequest) (*model.BatchDeleteDocumentsResponse, error) {
	out := &model.BatchDeleteDocumentsResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge/documents/batch-delete", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Search POST /v1/knowledge/search(语义搜索)。
func (a *KnowledgeApi) Search(ctx context.Context, req *model.KnowledgeSearchRequest) (*model.KnowledgeSearchResponse, error) {
	out := &model.KnowledgeSearchResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge/search", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// RagContext POST /v1/knowledge/rag-context(RAG 上下文检索)。
func (a *KnowledgeApi) RagContext(ctx context.Context, req *model.RagContextRequest) (*model.RagContextResponse, error) {
	out := &model.RagContextResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge/rag-context", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ExtractGraph POST /v1/knowledge-graph/extract(知识图谱抽取)。
func (a *KnowledgeApi) ExtractGraph(ctx context.Context, req *model.KnowledgeGraphExtractRequest) (*model.KnowledgeGraphExtractResponse, error) {
	out := &model.KnowledgeGraphExtractResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge-graph/extract", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// BuildGraph POST /v1/knowledge-graph/build(知识图谱构建)。
func (a *KnowledgeApi) BuildGraph(ctx context.Context, req *model.KnowledgeGraphBuildRequest) (*model.KnowledgeGraphBuildResponse, error) {
	out := &model.KnowledgeGraphBuildResponse{}
	if err := a.client.Request(ctx, "POST", "/knowledge-graph/build", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetGraphData GET /v1/knowledge-graph/data(知识图谱数据)。
func (a *KnowledgeApi) GetGraphData(ctx context.Context) (*model.KnowledgeGraphDataResponse, error) {
	out := &model.KnowledgeGraphDataResponse{}
	if err := a.client.Request(ctx, "GET", "/knowledge-graph/data", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ClearGraph DELETE /v1/knowledge-graph/data(清空知识图谱)。
func (a *KnowledgeApi) ClearGraph(ctx context.Context) error {
	return a.client.Request(ctx, "DELETE", "/knowledge-graph/data", nil, nil)
}
