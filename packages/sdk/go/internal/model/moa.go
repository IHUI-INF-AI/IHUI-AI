// Package model 的 MoA(Mixture of Agents)预设类型。
package model

// MoaPresetItem 是 MoA 预设列表项。
type MoaPresetItem struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Models   []string `json:"models"`
	Strategy string   `json:"strategy"`
}

// MoaPresetsResponse 是 GET /v1/moa-presets 响应体。
type MoaPresetsResponse struct {
	Object string          `json:"object"`
	Data   []MoaPresetItem `json:"data"`
}

// CreateMoaPresetRequest 是 POST /v1/moa-presets 请求体。
type CreateMoaPresetRequest struct {
	Name     string   `json:"name"`
	Models   []string `json:"models"`
	Strategy string   `json:"strategy"`
}
