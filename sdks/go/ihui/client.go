// Package ihui 是 IHUI-AI 官方 Go SDK(骨架,后续真发布时填实现)。
// OpenAI 兼容:POST /api/chat/completions + GET /api/models
package ihui

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// IhuiError HTTP 4xx/5xx 异常,含 StatusCode 与 Body。
type IhuiError struct {
	StatusCode int
	Body       string
}

func (e *IhuiError) Error() string {
	return fmt.Sprintf("IHUI API 错误 [%d]: %s", e.StatusCode, e.Body)
}

// Message 单条对话消息。
type Message struct {
	Role    string `json:"role"`    // system | user | assistant
	Content string `json:"content"`
}

// ChatCompletionRequest 对话补全请求(OpenAI 兼容)。
type ChatCompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Temperature *float64  `json:"temperature,omitempty"`
	MaxTokens   *int      `json:"max_tokens,omitempty"`
	Stream      bool      `json:"stream,omitempty"`
}

// ChatCompletionResponse 对话补全响应。
type ChatCompletionResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index        int     `json:"index"`
		Message      Message `json:"message"`
		FinishReason string  `json:"finish_reason"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage,omitempty"`
}

// ModelInfo 单个模型信息。
type ModelInfo struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"owned_by"`
}

// ModelsListResponse 模型列表响应。
type ModelsListResponse struct {
	Object string      `json:"object"`
	Data   []ModelInfo `json:"data"`
}

// IhuiClient IHUI-AI 客户端,内部封装 http.Client,统一加 Authorization + 错误抛出。
type IhuiClient struct {
	apiBase  string
	apiKey   string
	http     *http.Client
}

// NewIhuiClient 构造客户端。
func NewIhuiClient(apiBase, apiKey string) *IhuiClient {
	return &IhuiClient{
		apiBase: strings.TrimRight(apiBase, "/"),
		apiKey:  apiKey,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

// request 统一请求封装:4xx/5xx 返回 *IhuiError。
func (c *IhuiClient) request(path, method string, body any) ([]byte, error) {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, c.apiBase+path, reader)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return nil, &IhuiError{StatusCode: resp.StatusCode, Body: string(data)}
	}
	return data, nil
}

// ChatCompletionsCreate POST /api/chat/completions — 创建对话补全。
func (c *IhuiClient) ChatCompletionsCreate(body *ChatCompletionRequest) (*ChatCompletionResponse, error) {
	data, err := c.request("/api/chat/completions", http.MethodPost, body)
	if err != nil {
		return nil, err
	}
	var out ChatCompletionResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

// ModelsList GET /api/models — 模型列表。
func (c *IhuiClient) ModelsList() (*ModelsListResponse, error) {
	data, err := c.request("/api/models", http.MethodGet, nil)
	if err != nil {
		return nil, err
	}
	var out ModelsListResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
