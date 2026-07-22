// Package module 实现 IHUI SDK 的 13 个业务模块,每个模块对应一组 /v1/* 端点。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// AiApi 封装 AI 核心端点(13 个):chat / embeddings / vision / moa / models / userModels。
type AiApi struct {
	client *client.BaseClient
}

// NewAiApi 构造 AiApi。
func NewAiApi(c *client.BaseClient) *AiApi {
	return &AiApi{client: c}
}

// Completions POST /v1/chat/completions(非流式)。
func (a *AiApi) Completions(ctx context.Context, req *model.ChatCompletionRequest) (*model.ChatCompletionResponse, error) {
	out := &model.ChatCompletionResponse{}
	if err := a.client.Request(ctx, "POST", "/chat/completions", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// CompletionsStream POST /v1/chat/completions(stream:true),返回 SSE chunk channel。
//
// 调用方:`for chunk := range stream { ... }`。channel 关闭表示流结束。
// 解析失败的行作为 {"_raw": "<payload>"} 发送。
func (a *AiApi) CompletionsStream(ctx context.Context, req *model.ChatCompletionRequest) (<-chan map[string]any, error) {
	streamReq := *req
	streamReq.Stream = true
	resp, err := a.client.RequestStream(ctx, "POST", "/chat/completions", &streamReq)
	if err != nil {
		return nil, err
	}
	return client.StreamSSE(ctx, resp.Body), nil
}

// Embeddings POST /v1/embeddings(文本向量化)。
func (a *AiApi) Embeddings(ctx context.Context, req *model.EmbeddingsRequest) (*model.EmbeddingsResponse, error) {
	out := &model.EmbeddingsResponse{}
	if err := a.client.Request(ctx, "POST", "/embeddings", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ChatVision POST /v1/chat/vision(视觉理解)。
func (a *AiApi) ChatVision(ctx context.Context, req *model.ChatVisionRequest) (*model.ChatVisionResponse, error) {
	out := &model.ChatVisionResponse{}
	if err := a.client.Request(ctx, "POST", "/chat/vision", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ChatMoa POST /v1/chat/moa(Mixture of Agents)。
func (a *AiApi) ChatMoa(ctx context.Context, req *model.ChatMoaRequest) (*model.ChatMoaResponse, error) {
	out := &model.ChatMoaResponse{}
	if err := a.client.Request(ctx, "POST", "/chat/moa", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListModels GET /v1/models(模型列表)。
func (a *AiApi) ListModels(ctx context.Context) (*model.ModelsResponse, error) {
	out := &model.ModelsResponse{}
	if err := a.client.Request(ctx, "GET", "/models", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetModel GET /v1/models/:id(模型详情)。
func (a *AiApi) GetModel(ctx context.Context, id string) (*model.ModelInfo, error) {
	out := &model.ModelInfo{}
	if err := a.client.Request(ctx, "GET", "/models/"+client.Encode(id), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListVendorModels GET /v1/vendors/:vendor/models(厂商模型列表)。
func (a *AiApi) ListVendorModels(ctx context.Context, vendor string) (*model.VendorModelsResponse, error) {
	out := &model.VendorModelsResponse{}
	if err := a.client.Request(ctx, "GET", "/vendors/"+client.Encode(vendor)+"/models", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListMoaPresets GET /v1/moa-presets(MoA 预设列表)。
func (a *AiApi) ListMoaPresets(ctx context.Context) (*model.MoaPresetsResponse, error) {
	out := &model.MoaPresetsResponse{}
	if err := a.client.Request(ctx, "GET", "/moa-presets", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// CreateMoaPreset POST /v1/moa-presets(创建 MoA 预设)。
func (a *AiApi) CreateMoaPreset(ctx context.Context, req *model.CreateMoaPresetRequest) (*model.MoaPresetsResponse, error) {
	out := &model.MoaPresetsResponse{}
	if err := a.client.Request(ctx, "POST", "/moa-presets", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListUserModels GET /v1/user/models(用户自定义模型列表)。
func (a *AiApi) ListUserModels(ctx context.Context) (*model.UserModelsResponse, error) {
	out := &model.UserModelsResponse{}
	if err := a.client.Request(ctx, "GET", "/user/models", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// CreateUserModel POST /v1/user/models(创建用户自定义模型)。
func (a *AiApi) CreateUserModel(ctx context.Context, req *model.CreateUserModelRequest) (*model.UserModelConfig, error) {
	out := &model.UserModelConfig{}
	if err := a.client.Request(ctx, "POST", "/user/models", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// UpdateUserModel PUT /v1/user/models/:id(更新用户自定义模型)。
func (a *AiApi) UpdateUserModel(ctx context.Context, id string, req *model.CreateUserModelRequest) (*model.UserModelConfig, error) {
	out := &model.UserModelConfig{}
	if err := a.client.Request(ctx, "PUT", "/user/models/"+client.Encode(id), req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// DeleteUserModel DELETE /v1/user/models/:id(删除用户自定义模型)。
func (a *AiApi) DeleteUserModel(ctx context.Context, id string) error {
	return a.client.Request(ctx, "DELETE", "/user/models/"+client.Encode(id), nil, nil)
}
