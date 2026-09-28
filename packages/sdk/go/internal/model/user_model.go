// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// Package model 的用户自定义模型类型。
package model

// UserModelConfig 是用户自定义模型配置。
type UserModelConfig struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Provider  string `json:"provider"`
	Model     string `json:"model"`
	APIKey    string `json:"apiKey"`
	BaseURL   string `json:"baseUrl,omitempty"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// UserModelsResponse 是 GET /v1/user/models 响应体。
type UserModelsResponse struct {
	Object string            `json:"object"`
	Data   []UserModelConfig `json:"data"`
}

// CreateUserModelRequest 是 POST /v1/user/models 请求体。
type CreateUserModelRequest struct {
	Name     string `json:"name"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	APIKey   string `json:"apiKey"`
	BaseURL  string `json:"baseUrl,omitempty"`
}
