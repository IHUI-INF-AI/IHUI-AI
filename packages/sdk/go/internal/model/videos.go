// Package model 的视频(生成 / 任务查询 / 编排)类型。
package model

// VideoGenerationsRequest 是 POST /v1/videos/generations 请求体(视频生成)。
type VideoGenerationsRequest struct {
	Model      string `json:"model"`
	Prompt     string `json:"prompt"`
	Image      string `json:"image,omitempty"`
	Duration   *int   `json:"duration,omitempty"`
	Resolution string `json:"resolution,omitempty"`
	Vendor     string `json:"vendor,omitempty"`
}

// VideoGenerationsResponse 是 POST /v1/videos/generations 响应体(异步任务)。
type VideoGenerationsResponse struct {
	TaskID        string `json:"taskId"`
	Status        string `json:"status"`
	EstimatedTime *int   `json:"estimatedTime,omitempty"`
}

// VideoTaskResponse 是 GET /v1/videos/tasks/:id 响应体。
type VideoTaskResponse struct {
	TaskID    string  `json:"taskId"`
	Status    string  `json:"status"`
	VideoURL  string  `json:"videoUrl,omitempty"`
	Progress  float64 `json:"progress,omitempty"`
	Error     string  `json:"error,omitempty"`
	CreatedAt string  `json:"createdAt"`
}

// VideoComposeScene 是视频编排分镜。
type VideoComposeScene struct {
	Text        string `json:"text"`
	Duration    int    `json:"duration"`
	ImagePrompt string `json:"imagePrompt,omitempty"`
}

// VideoComposeRequest 是 POST /v1/videos/compose 请求体(视频编排)。
type VideoComposeRequest struct {
	Scenes []VideoComposeScene `json:"scenes"`
	BgmURL string              `json:"bgmUrl,omitempty"`
}

// VideoComposeResponse 是 POST /v1/videos/compose 响应体。
type VideoComposeResponse struct {
	ComposeID string `json:"composeId"`
	Status    string `json:"status"`
}
