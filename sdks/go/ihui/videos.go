package ihui

import "context"

// VideosApi 封装视频端点(3 个):生成 / 任务查询 / 编排。
type VideosApi struct {
	client *BaseClient
}

// NewVideosApi 构造 VideosApi。
func NewVideosApi(c *BaseClient) *VideosApi {
	return &VideosApi{client: c}
}

// Generations POST /v1/videos/generations(视频生成,异步任务)。
func (a *VideosApi) Generations(ctx context.Context, req *VideoGenerationsRequest) (*VideoGenerationsResponse, error) {
	out := &VideoGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/videos/generations", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetTask GET /v1/videos/tasks/:id(查询视频任务状态)。
func (a *VideosApi) GetTask(ctx context.Context, taskID string) (*VideoTaskResponse, error) {
	out := &VideoTaskResponse{}
	if err := a.client.Request(ctx, "GET", "/videos/tasks/"+Encode(taskID), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Compose POST /v1/videos/compose(视频编排)。
func (a *VideosApi) Compose(ctx context.Context, req *VideoComposeRequest) (*VideoComposeResponse, error) {
	out := &VideoComposeResponse{}
	if err := a.client.Request(ctx, "POST", "/videos/compose", req, out); err != nil {
		return nil, err
	}
	return out, nil
}