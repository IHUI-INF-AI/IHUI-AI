// Package module 的 3D 模型生成模块(1 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// ThreeDApi 封装 3D 模型生成端点(1 个)。
type ThreeDApi struct {
	client *client.BaseClient
}

// NewThreeDApi 构造 ThreeDApi。
func NewThreeDApi(c *client.BaseClient) *ThreeDApi {
	return &ThreeDApi{client: c}
}

// Generations POST /v1/3d/generations(3D 模型生成)。
func (a *ThreeDApi) Generations(ctx context.Context, req *model.ThreeDGenerationsRequest) (*model.ThreeDGenerationsResponse, error) {
	out := &model.ThreeDGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/3d/generations", req, out); err != nil {
		return nil, err
	}
	return out, nil
}
