// Package model 的图像(文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景)类型。
package model

// ImageGenerationsRequest 是 POST /v1/images/generations 请求体(文生图)。
type ImageGenerationsRequest struct {
	Model   string `json:"model"`
	Prompt  string `json:"prompt"`
	N       *int   `json:"n,omitempty"`
	Size    string `json:"size,omitempty"`
	Quality string `json:"quality,omitempty"`
	Style   string `json:"style,omitempty"`
	Vendor  string `json:"vendor,omitempty"`
}

// ImageItem 是图像生成结果项。
type ImageItem struct {
	URL           string `json:"url,omitempty"`
	B64JSON       string `json:"b64Json,omitempty"`
	RevisedPrompt string `json:"revisedPrompt,omitempty"`
}

// ImageGenerationsResponse 是 POST /v1/images/generations 响应体(OpenAI 兼容)。
type ImageGenerationsResponse struct {
	Created int64       `json:"created"`
	Data    []ImageItem `json:"data"`
}

// ImageEditsRequest 是 POST /v1/images/edits 请求体(图片编辑)。
type ImageEditsRequest struct {
	Model  string `json:"model"`
	Image  string `json:"image"`
	Prompt string `json:"prompt"`
	Mask   string `json:"mask,omitempty"`
	N      *int   `json:"n,omitempty"`
	Size   string `json:"size,omitempty"`
}

// ImageInpaintRequest 是 POST /v1/images/inpaint 请求体(图片修复)。
type ImageInpaintRequest struct {
	Model  string `json:"model"`
	Image  string `json:"image"`
	Mask   string `json:"mask"`
	Prompt string `json:"prompt"`
}

// StyleTransferRequest 是 POST /v1/images/style-transfer 请求体(风格迁移)。
type StyleTransferRequest struct {
	Model string `json:"model"`
	Image string `json:"image"`
	Style string `json:"style"`
}

// VirtualTryOnRequest 是 POST /v1/images/virtual-try-on 请求体(虚拟试穿)。
type VirtualTryOnRequest struct {
	Model        string `json:"model"`
	PersonImage  string `json:"personImage"`
	GarmentImage string `json:"garmentImage"`
}

// BackgroundGenerationRequest 是 POST /v1/images/background 请求体(背景生成)。
type BackgroundGenerationRequest struct {
	Model      string `json:"model"`
	Foreground string `json:"foreground"`
	Prompt     string `json:"prompt"`
}
