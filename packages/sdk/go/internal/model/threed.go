// Package model 的 3D 模型生成类型。
package model

// ThreeDGenerationsRequest 是 POST /v1/3d/generations 请求体(3D 生成)。
type ThreeDGenerationsRequest struct {
	Model  string `json:"model"`
	Input  string `json:"input"`
	Format string `json:"format,omitempty"`
}

// ThreeDGenerationsResponse 是 POST /v1/3d/generations 响应体。
type ThreeDGenerationsResponse struct {
	TaskID string `json:"taskId"`
	Status string `json:"status"`
}
