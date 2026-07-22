// Package model 的模型列表 / 厂商模型类型。
package model

// ModelInfo 是 GET /v1/models/:id 响应体(模型详情)。
type ModelInfo struct {
	ID             string   `json:"id"`
	Object         string   `json:"object"`
	Created        int64    `json:"created"`
	OwnedBy        string   `json:"ownedBy"`
	Capabilities   []string `json:"capabilities"`
	ContextWindow  *int     `json:"contextWindow,omitempty"`
	SupportsStream *bool    `json:"supportsStream,omitempty"`
}

// ModelListItem 是 GET /v1/models 列表项。
type ModelListItem struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"ownedBy"`
}

// ModelsResponse 是 GET /v1/models 响应体(OpenAI 兼容)。
type ModelsResponse struct {
	Object string          `json:"object"`
	Data   []ModelListItem `json:"data"`
}

// VendorModelItem 是厂商模型列表项。
type VendorModelItem struct {
	ID     string `json:"id"`
	Object string `json:"object"`
}

// VendorModelsResponse 是 GET /v1/vendors/:vendor/models 响应体。
type VendorModelsResponse struct {
	Vendor string            `json:"vendor"`
	Object string            `json:"object"`
	Data   []VendorModelItem `json:"data"`
}
