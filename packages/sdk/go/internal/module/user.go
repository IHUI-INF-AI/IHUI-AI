// Package module 的用户 / 工作区 / 工作流 / 统计模块(9 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// UserApi 封装用户端点(9 个):用户 / 项目 / 工作流 / 用量统计。
type UserApi struct {
	client *client.BaseClient
}

// NewUserApi 构造 UserApi。
func NewUserApi(c *client.BaseClient) *UserApi {
	return &UserApi{client: c}
}

// Me GET /v1/me(当前用户信息 + 配额)。
func (a *UserApi) Me(ctx context.Context) (*model.UserInfo, error) {
	out := &model.UserInfo{}
	if err := a.client.Request(ctx, "GET", "/me", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListProjects GET /v1/projects(项目列表)。
func (a *UserApi) ListProjects(ctx context.Context) (*model.ProjectsResponse, error) {
	out := &model.ProjectsResponse{}
	if err := a.client.Request(ctx, "GET", "/projects", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListProjectFiles GET /v1/projects/:id/files(项目文件列表)。
func (a *UserApi) ListProjectFiles(ctx context.Context, projectID string) (*model.ProjectFilesResponse, error) {
	out := &model.ProjectFilesResponse{}
	if err := a.client.Request(ctx, "GET", "/projects/"+client.Encode(projectID)+"/files", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetWorkflow GET /v1/workflows/:id(工作流详情)。
func (a *UserApi) GetWorkflow(ctx context.Context, id string) (*model.WorkflowInfo, error) {
	out := &model.WorkflowInfo{}
	if err := a.client.Request(ctx, "GET", "/workflows/"+client.Encode(id), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// RunWorkflow POST /v1/workflows/instances(运行工作流)。
func (a *UserApi) RunWorkflow(ctx context.Context, req *model.RunWorkflowRequest) (*model.RunWorkflowResponse, error) {
	out := &model.RunWorkflowResponse{}
	if err := a.client.Request(ctx, "POST", "/workflows/instances", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// RunCozeWorkflow POST /v1/workflows/coze/run(Coze 工作流)。
func (a *UserApi) RunCozeWorkflow(ctx context.Context, req *model.RunCozeWorkflowRequest) (*model.RunCozeWorkflowResponse, error) {
	out := &model.RunCozeWorkflowResponse{}
	if err := a.client.Request(ctx, "POST", "/workflows/coze/run", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// RunN8nWorkflow POST /v1/workflows/n8n/run(n8n 工作流)。
func (a *UserApi) RunN8nWorkflow(ctx context.Context, req *model.RunN8nWorkflowRequest) (*model.RunN8nWorkflowResponse, error) {
	out := &model.RunN8nWorkflowResponse{}
	if err := a.client.Request(ctx, "POST", "/workflows/n8n/run", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetUsage GET /v1/usage(用量统计)。
func (a *UserApi) GetUsage(ctx context.Context) (*model.UsageResponse, error) {
	out := &model.UsageResponse{}
	if err := a.client.Request(ctx, "GET", "/usage", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetVendorUsage GET /v1/usage/:vendor(厂商用量)。
func (a *UserApi) GetVendorUsage(ctx context.Context, vendor string) (*model.VendorUsageResponse, error) {
	out := &model.VendorUsageResponse{}
	if err := a.client.Request(ctx, "GET", "/usage/"+client.Encode(vendor), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}
