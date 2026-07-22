// Package model 的生成队列(入队 / 状态 / 取消)类型。
package model

// GenerationEnqueueRequest 是 POST /v1/generation/enqueue 请求体。
type GenerationEnqueueRequest struct {
	Type     string         `json:"type"`
	Payload  map[string]any `json:"payload"`
	Priority *int           `json:"priority,omitempty"`
}

// GenerationEnqueueResponse 是 POST /v1/generation/enqueue 响应体。
type GenerationEnqueueResponse struct {
	JobID    string `json:"jobId"`
	Status   string `json:"status"`
	Position int    `json:"position"`
}

// GenerationStatusResponse 是 GET /v1/generation/status/:id 响应体。
type GenerationStatusResponse struct {
	JobID    string  `json:"jobId"`
	Status   string  `json:"status"`
	Result   any     `json:"result,omitempty"`
	Error    string  `json:"error,omitempty"`
	Progress float64 `json:"progress,omitempty"`
}

// GenerationCancelResponse 是 POST /v1/generation/cancel/:id 响应体。
type GenerationCancelResponse struct {
	JobID  string `json:"jobId"`
	Status string `json:"status"`
}
