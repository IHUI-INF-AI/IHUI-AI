// Package model 的 embeddings 类型。
package model

// EmbeddingsRequest 是 POST /v1/embeddings 请求体(OpenAI 兼容)。
type EmbeddingsRequest struct {
	Model      string `json:"model"`
	Input      any    `json:"input"` // string 或 []string
	Dimensions *int   `json:"dimensions,omitempty"`
}

// EmbeddingItem 是单个 embedding 结果。
type EmbeddingItem struct {
	Object    string    `json:"object"`
	Index     int       `json:"index"`
	Embedding []float64 `json:"embedding"`
}

// EmbeddingsResponse 是 POST /v1/embeddings 响应体(OpenAI 兼容)。
type EmbeddingsResponse struct {
	Object string          `json:"object"`
	Data   []EmbeddingItem `json:"data"`
	Model  string          `json:"model"`
	Usage  struct {
		PromptTokens int `json:"promptTokens"`
		TotalTokens  int `json:"totalTokens"`
	} `json:"usage"`
}
