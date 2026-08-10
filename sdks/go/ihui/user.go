package ihui

import "context"

// UserApi 封装用户端点(9 个):用户 / 项目 / 工作流 / 用量统计。
type UserApi struct {
	client *BaseClient
}

// NewUserApi 构造 UserApi。
func NewUserApi(c *BaseClient) *UserApi {
	return &UserApi{client: c}
}

// Me GET /v1/me(当前用户信息 + 配额)。
func (a *UserApi) Me(ctx context.Context) (*UserInfo, error) {
	out := &UserInfo{}
	if err := a.client.Request(ctx, "GET", "/me", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListProjects GET /v1/projects(项目列表)。
func (a *UserApi) ListProjects(ctx context.Context) (*ProjectsResponse, error) {
	out := &ProjectsResponse{}
	if err := a.client.Request(ctx, "GET", "/projects", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListProjectFiles GET /v1/projects/:id/files(项目文件列表)。
func (a *UserApi) ListProjectFiles(ctx context.Context, projectID string) (*ProjectFilesResponse, error) {
	out := &ProjectFilesResponse{}
	if err := a.client.Request(ctx, "GET", "/projects/"+Encode(projectID)+"/files", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetWorkflow GET /v1/workflows/:id(工作流详情)。
func (a *UserApi) GetWorkflow(ctx context.Context, id string) (*WorkflowInfo, error) {
	out := &WorkflowInfo{}
	if err := a.client.Request(ctx, "GET", "/workflows/"+Encode(id), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// RunWorkflow POST /v1/workflows/instances(运行工作流)。
func (a *UserApi) RunWorkflow(ctx context.Context, req *RunWorkflowRequest) (*RunWorkflowResponse, error) {
	out := &RunWorkflowResponse{}
	if err := a.client.Request(ctx, "POST", "/workflows/instances", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// RunCozeWorkflow POST /v1/workflows/coze/run(Coze 工作流)。
func (a *UserApi) RunCozeWorkflow(ctx context.Context, req *RunCozeWorkflowRequest) (*RunCozeWorkflowResponse, error) {
	out := &RunCozeWorkflowResponse{}
	if err := a.client.Request(ctx, "POST", "/workflows/coze/run", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// RunN8nWorkflow POST /v1/workflows/n8n/run(n8n 工作流)。
func (a *UserApi) RunN8nWorkflow(ctx context.Context, req *RunN8nWorkflowRequest) (*RunN8nWorkflowResponse, error) {
	out := &RunN8nWorkflowResponse{}
	if err := a.client.Request(ctx, "POST", "/workflows/n8n/run", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetUsage GET /v1/usage(用量统计)。
func (a *UserApi) GetUsage(ctx context.Context) (*UsageResponse, error) {
	out := &UsageResponse{}
	if err := a.client.Request(ctx, "GET", "/usage", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetVendorUsage GET /v1/usage/:vendor(厂商用量)。
func (a *UserApi) GetVendorUsage(ctx context.Context, vendor string) (*VendorUsageResponse, error) {
	out := &VendorUsageResponse{}
	if err := a.client.Request(ctx, "GET", "/usage/"+Encode(vendor), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}