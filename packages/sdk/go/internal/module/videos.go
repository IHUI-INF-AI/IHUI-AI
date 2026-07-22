// Package module 的视频模块(3 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// VideosApi 封装视频端点(3 个):生成 / 任务查询 / 编排。
type VideosApi struct {
	client *client.BaseClient
}

// NewVideosApi 构造 VideosApi。
func NewVideosApi(c *client.BaseClient) *VideosApi {
	return &VideosApi{client: c}
}

// Generations POST /v1/videos/generations(视频生成,异步任务)。
func (a *VideosApi) Generations(ctx context.Context, req *model.VideoGenerationsRequest) (*model.VideoGenerationsResponse, error) {
	out := &model.VideoGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/videos/generations", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetTask GET /v1/videos/tasks/:id(查询视频任务状态)。
func (a *VideosApi) GetTask(ctx context.Context, taskID string) (*model.VideoTaskResponse, error) {
	out := &model.VideoTaskResponse{}
	if err := a.client.Request(ctx, "GET", "/videos/tasks/"+client.Encode(taskID), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Compose POST /v1/videos/compose(视频编排)。
func (a *VideosApi) Compose(ctx context.Context, req *model.VideoComposeRequest) (*model.VideoComposeResponse, error) {
	out := &model.VideoComposeResponse{}
	if err := a.client.Request(ctx, "POST", "/videos/compose", req, out); err != nil {
		return nil, err
	}
	return out, nil
}
