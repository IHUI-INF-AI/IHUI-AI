// Package module 的文件模块(9 端点)。
package module

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// FilesApi 封装文件端点(9 个):列表 / 上传 / 详情 / 删除 / 内容 / 版本 / 分片上传。
type FilesApi struct {
	client *client.BaseClient
}

// NewFilesApi 构造 FilesApi。
func NewFilesApi(c *client.BaseClient) *FilesApi {
	return &FilesApi{client: c}
}

// List GET /v1/files(文件列表)。
func (a *FilesApi) List(ctx context.Context) (*model.FilesListResponse, error) {
	out := &model.FilesListResponse{}
	if err := a.client.Request(ctx, "GET", "/files", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Upload POST /v1/files(上传文件,multipart/form-data)。
//
// filename 为上传文件名;reader 为文件内容流。
func (a *FilesApi) Upload(ctx context.Context, filename string, reader io.Reader) (*model.FileInfo, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(part, reader); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	out := &model.FileInfo{}
	if err := a.client.RequestMultipart(ctx, "/files", writer.FormDataContentType(), body.Bytes(), out); err != nil {
		return nil, err
	}
	return out, nil
}

// Get GET /v1/files/:id(文件详情)。
func (a *FilesApi) Get(ctx context.Context, id string) (*model.FileInfo, error) {
	out := &model.FileInfo{}
	if err := a.client.Request(ctx, "GET", "/files/"+client.Encode(id), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Delete DELETE /v1/files/:id(删除文件)。
func (a *FilesApi) Delete(ctx context.Context, id string) error {
	return a.client.Request(ctx, "DELETE", "/files/"+client.Encode(id), nil, nil)
}

// GetContent GET /v1/files/:id/content(文件内容,返回原始字节)。
func (a *FilesApi) GetContent(ctx context.Context, id string) ([]byte, error) {
	return a.client.RequestBytes(ctx, "/files/"+client.Encode(id)+"/content")
}

// GetVersions GET /v1/files/:id/versions(文件版本列表)。
func (a *FilesApi) GetVersions(ctx context.Context, id string) (*model.FileVersionsResponse, error) {
	out := &model.FileVersionsResponse{}
	if err := a.client.Request(ctx, "GET", "/files/"+client.Encode(id)+"/versions", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// UploadInit POST /v1/files/upload-init(分片上传初始化)。
func (a *FilesApi) UploadInit(ctx context.Context, req *model.UploadInitRequest) (*model.UploadInitResponse, error) {
	out := &model.UploadInitResponse{}
	if err := a.client.Request(ctx, "POST", "/files/upload-init", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// UploadChunk POST /v1/files/upload-chunk(上传分片)。
func (a *FilesApi) UploadChunk(ctx context.Context, req *model.UploadChunkRequest) error {
	return a.client.Request(ctx, "POST", "/files/upload-chunk", req, nil)
}

// UploadComplete POST /v1/files/complete(完成分片上传)。
func (a *FilesApi) UploadComplete(ctx context.Context, req *model.UploadCompleteRequest) (*model.UploadCompleteResponse, error) {
	out := &model.UploadCompleteResponse{}
	if err := a.client.Request(ctx, "POST", "/files/complete", req, out); err != nil {
		return nil, err
	}
	return out, nil
}
