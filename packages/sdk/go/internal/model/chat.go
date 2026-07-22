// Package model 定义 IHUI SDK 的所有数据模型,字段命名严格遵循 camelCase(与 /v1/* 端点契约一致)。
package model

// Message 是 chat completions 的消息单元。
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletionRequest 是 POST /v1/chat/completions 请求体(OpenAI 兼容)。
type ChatCompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream,omitempty"`
	Temperature *float64  `json:"temperature,omitempty"`
	MaxTokens   *int      `json:"maxTokens,omitempty"`
}

// ChatChoice 是 chat completion 的单个选择项。
type ChatChoice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finishReason"`
}

// ChatUsage 是 token 用量统计。
type ChatUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

// ChatCompletionResponse 是 POST /v1/chat/completions 响应体(OpenAI 兼容)。
type ChatCompletionResponse struct {
	ID      string       `json:"id"`
	Object  string       `json:"object"`
	Created int64        `json:"created"`
	Model   string       `json:"model"`
	Choices []ChatChoice `json:"choices"`
	Usage   ChatUsage    `json:"usage"`
}

// ChatVisionRequest 是 POST /v1/chat/vision 请求体(视觉理解)。
type ChatVisionRequest struct {
	Model     string `json:"model"`
	Image     string `json:"image"`
	Prompt    string `json:"prompt"`
	MaxTokens *int   `json:"maxTokens,omitempty"`
}

// ChatVisionUsage 是视觉理解的 token 用量。
type ChatVisionUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

// ChatVisionResponse 是 POST /v1/chat/vision 响应体。
type ChatVisionResponse struct {
	Description string          `json:"description"`
	Model       string          `json:"model"`
	Usage       ChatVisionUsage `json:"usage"`
}

// ChatMoaRequest 是 POST /v1/chat/moa 请求体(Mixture of Agents)。
type ChatMoaRequest struct {
	Messages []Message `json:"messages"`
	PresetID string    `json:"presetId,omitempty"`
	Stream   bool      `json:"stream,omitempty"`
}

// ChatMoaResponse 是 POST /v1/chat/moa 响应体。
type ChatMoaResponse struct {
	Output   string `json:"output"`
	PresetID string `json:"presetId"`
	Model    string `json:"model"`
	Usage    struct {
		TotalTokens int `json:"totalTokens"`
	} `json:"usage"`
}
