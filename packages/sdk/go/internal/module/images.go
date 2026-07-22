// Package module 的图像模块(6 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// ImagesApi 封装图像端点(6 个):文生图 / 编辑 / 修复 / 风格迁移 / 虚拟试穿 / 背景。
type ImagesApi struct {
	client *client.BaseClient
}

// NewImagesApi 构造 ImagesApi。
func NewImagesApi(c *client.BaseClient) *ImagesApi {
	return &ImagesApi{client: c}
}

// Generations POST /v1/images/generations(文生图)。
func (a *ImagesApi) Generations(ctx context.Context, req *model.ImageGenerationsRequest) (*model.ImageGenerationsResponse, error) {
	out := &model.ImageGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/images/generations", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Edits POST /v1/images/edits(图片编辑)。
func (a *ImagesApi) Edits(ctx context.Context, req *model.ImageEditsRequest) (*model.ImageGenerationsResponse, error) {
	out := &model.ImageGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/images/edits", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Inpaint POST /v1/images/inpaint(图片修复)。
func (a *ImagesApi) Inpaint(ctx context.Context, req *model.ImageInpaintRequest) (*model.ImageGenerationsResponse, error) {
	out := &model.ImageGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/images/inpaint", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// StyleTransfer POST /v1/images/style-transfer(风格迁移)。
func (a *ImagesApi) StyleTransfer(ctx context.Context, req *model.StyleTransferRequest) (*model.ImageGenerationsResponse, error) {
	out := &model.ImageGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/images/style-transfer", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// VirtualTryOn POST /v1/images/virtual-try-on(虚拟试穿)。
func (a *ImagesApi) VirtualTryOn(ctx context.Context, req *model.VirtualTryOnRequest) (*model.ImageGenerationsResponse, error) {
	out := &model.ImageGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/images/virtual-try-on", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Background POST /v1/images/background(背景生成)。
func (a *ImagesApi) Background(ctx context.Context, req *model.BackgroundGenerationRequest) (*model.ImageGenerationsResponse, error) {
	out := &model.ImageGenerationsResponse{}
	if err := a.client.Request(ctx, "POST", "/images/background", req, out); err != nil {
		return nil, err
	}
	return out, nil
}
