// Package module 的生成队列模块(3 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// GenerationApi 封装生成队列端点(3 个):入队 / 状态查询 / 取消。
type GenerationApi struct {
	client *client.BaseClient
}

// NewGenerationApi 构造 GenerationApi。
func NewGenerationApi(c *client.BaseClient) *GenerationApi {
	return &GenerationApi{client: c}
}

// Enqueue POST /v1/generation/enqueue(入队生成任务)。
func (a *GenerationApi) Enqueue(ctx context.Context, req *model.GenerationEnqueueRequest) (*model.GenerationEnqueueResponse, error) {
	out := &model.GenerationEnqueueResponse{}
	if err := a.client.Request(ctx, "POST", "/generation/enqueue", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetStatus GET /v1/generation/status/:id(查询生成状态)。
func (a *GenerationApi) GetStatus(ctx context.Context, jobID string) (*model.GenerationStatusResponse, error) {
	out := &model.GenerationStatusResponse{}
	if err := a.client.Request(ctx, "GET", "/generation/status/"+client.Encode(jobID), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Cancel POST /v1/generation/cancel/:id(取消生成任务)。
func (a *GenerationApi) Cancel(ctx context.Context, jobID string) (*model.GenerationCancelResponse, error) {
	out := &model.GenerationCancelResponse{}
	if err := a.client.Request(ctx, "POST", "/generation/cancel/"+client.Encode(jobID), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}
