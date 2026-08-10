package ihui

import "context"

// GenerationApi 封装生成队列端点(3 个):入队 / 状态查询 / 取消。
type GenerationApi struct {
	client *BaseClient
}

// NewGenerationApi 构造 GenerationApi。
func NewGenerationApi(c *BaseClient) *GenerationApi {
	return &GenerationApi{client: c}
}

// Enqueue POST /v1/generation/enqueue(入队生成任务)。
func (a *GenerationApi) Enqueue(ctx context.Context, req *GenerationEnqueueRequest) (*GenerationEnqueueResponse, error) {
	out := &GenerationEnqueueResponse{}
	if err := a.client.Request(ctx, "POST", "/generation/enqueue", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetStatus GET /v1/generation/status/:id(查询生成状态)。
func (a *GenerationApi) GetStatus(ctx context.Context, jobID string) (*GenerationStatusResponse, error) {
	out := &GenerationStatusResponse{}
	if err := a.client.Request(ctx, "GET", "/generation/status/"+Encode(jobID), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Cancel POST /v1/generation/cancel/:id(取消生成任务)。
func (a *GenerationApi) Cancel(ctx context.Context, jobID string) (*GenerationCancelResponse, error) {
	out := &GenerationCancelResponse{}
	if err := a.client.Request(ctx, "POST", "/generation/cancel/"+Encode(jobID), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}