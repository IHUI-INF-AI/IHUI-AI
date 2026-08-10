package ihui

import "context"

// ThreeDApi 封装 3D 模型生成端点(1 个)。
type ThreeDApi struct {
	client *BaseClient
}

// NewThreeDApi 构造 ThreeDApi。
func NewThreeDApi(c *BaseClient) *ThreeDApi {
	return &ThreeDApi{client: c}
}

// Generations POST /v1/3d/generations(3D 模型生成)。
func (a *ThreeDApi) Generations(ctx context.Context, req *ThreeDGenerationsRequest) (*ThreeDGenerationsResponse, error) {
	out := &ThreeDGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/3d/generations", req, out); err != nil {
		return nil, err
	}
	return out, nil
}