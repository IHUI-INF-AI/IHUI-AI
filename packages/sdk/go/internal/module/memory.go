// Package module 的记忆模块(8 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// MemoryApi 封装记忆端点(8 个):保存 / 召回 / 搜索 / Dream / 遗忘 / 分类记忆。
type MemoryApi struct {
	client *client.BaseClient
}

// NewMemoryApi 构造 MemoryApi。
func NewMemoryApi(c *client.BaseClient) *MemoryApi {
	return &MemoryApi{client: c}
}

// Save POST /v1/memory(保存记忆)。
func (a *MemoryApi) Save(ctx context.Context, req *model.SaveMemoryRequest) (*model.SaveMemoryResponse, error) {
	out := &model.SaveMemoryResponse{}
	if err := a.client.Request(ctx, "POST", "/memory", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Recall GET /v1/memory(召回记忆)。
func (a *MemoryApi) Recall(ctx context.Context) (*model.RecallMemoryResponse, error) {
	out := &model.RecallMemoryResponse{}
	if err := a.client.Request(ctx, "GET", "/memory", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Search POST /v1/memory/search(语义搜索)。
func (a *MemoryApi) Search(ctx context.Context, req *model.MemorySearchRequest) (*model.MemorySearchResponse, error) {
	out := &model.MemorySearchResponse{}
	if err := a.client.Request(ctx, "POST", "/memory/search", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Dream POST /v1/memory/dream(Dream 梦境系统)。
func (a *MemoryApi) Dream(ctx context.Context, req *model.MemoryDreamRequest) (*model.MemoryDreamResponse, error) {
	out := &model.MemoryDreamResponse{}
	if err := a.client.Request(ctx, "POST", "/memory/dream", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Forget DELETE /v1/memory(遗忘记忆)。
func (a *MemoryApi) Forget(ctx context.Context, req *model.ForgetMemoryRequest) (*model.ForgetMemoryResponse, error) {
	out := &model.ForgetMemoryResponse{}
	if err := a.client.Request(ctx, "DELETE", "/memory", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Working GET /v1/memory/working(工作记忆)。
func (a *MemoryApi) Working(ctx context.Context) (*model.WorkingMemoryResponse, error) {
	out := &model.WorkingMemoryResponse{}
	if err := a.client.Request(ctx, "GET", "/memory/working", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Episodic GET /v1/memory/episodic(情景记忆)。
func (a *MemoryApi) Episodic(ctx context.Context) (*model.EpisodicMemoryResponse, error) {
	out := &model.EpisodicMemoryResponse{}
	if err := a.client.Request(ctx, "GET", "/memory/episodic", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Procedural GET /v1/memory/procedural(程序记忆)。
func (a *MemoryApi) Procedural(ctx context.Context) (*model.ProceduralMemoryResponse, error) {
	out := &model.ProceduralMemoryResponse{}
	if err := a.client.Request(ctx, "GET", "/memory/procedural", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}
