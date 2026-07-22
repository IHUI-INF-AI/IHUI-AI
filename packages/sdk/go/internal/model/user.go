// Package model 的用户 / 工作区 / 工作流 / 统计类型。
package model

// UserQuota 是用户配额信息。
type UserQuota struct {
	HourlyUsed  int    `json:"hourlyUsed"`
	HourlyLimit int    `json:"hourlyLimit"`
	DailyUsed   int    `json:"dailyUsed"`
	DailyLimit  int    `json:"dailyLimit"`
	ResetAt     string `json:"resetAt"`
}

// UserInfo 是 GET /v1/me 响应体(当前用户 + 配额)。
type UserInfo struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Avatar    string    `json:"avatar,omitempty"`
	CreatedAt string    `json:"createdAt"`
	Quota     UserQuota `json:"quota"`
}

// ProjectItem 是项目列表项。
type ProjectItem struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	FileCount   int    `json:"fileCount"`
	CreatedAt   string `json:"createdAt"`
	UpdatedAt   string `json:"updatedAt"`
}

// ProjectsResponse 是 GET /v1/projects 响应体。
type ProjectsResponse struct {
	Object string        `json:"object"`
	Data   []ProjectItem `json:"data"`
}

// ProjectFilesResponse 是 GET /v1/projects/:id/files 响应体。
type ProjectFilesResponse struct {
	Object string     `json:"object"`
	Data   []FileInfo `json:"data"`
}

// WorkflowStep 是工作流步骤。
type WorkflowStep struct {
	ID     string         `json:"id"`
	Name   string         `json:"name"`
	Type   string         `json:"type"`
	Config map[string]any `json:"config,omitempty"`
}

// WorkflowInfo 是 GET /v1/workflows/:id 响应体(工作流详情)。
type WorkflowInfo struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Steps       []WorkflowStep `json:"steps"`
	CreatedAt   string         `json:"createdAt"`
}

// RunWorkflowRequest 是 POST /v1/workflows/instances 请求体。
type RunWorkflowRequest struct {
	WorkflowID string         `json:"workflowId"`
	Inputs     map[string]any `json:"inputs,omitempty"`
}

// RunWorkflowResponse 是 POST /v1/workflows/instances 响应体。
type RunWorkflowResponse struct {
	InstanceID string         `json:"instanceId"`
	Status     string         `json:"status"`
	Outputs    map[string]any `json:"outputs,omitempty"`
}

// RunCozeWorkflowRequest 是 POST /v1/workflows/coze/run 请求体。
type RunCozeWorkflowRequest struct {
	WorkflowID string         `json:"workflowId"`
	Parameters map[string]any `json:"parameters"`
}

// RunCozeWorkflowResponse 是 Coze 工作流运行响应(透传上游)。
type RunCozeWorkflowResponse = map[string]any

// RunN8nWorkflowRequest 是 POST /v1/workflows/n8n/run 请求体。
type RunN8nWorkflowRequest struct {
	WorkflowID string         `json:"workflowId"`
	Data       map[string]any `json:"data,omitempty"`
}

// RunN8nWorkflowResponse 是 n8n 工作流运行响应(透传上游)。
type RunN8nWorkflowResponse = map[string]any

// UsageResponse 是 GET /v1/usage 响应体。
type UsageResponse struct {
	APIKeyID      string         `json:"apiKeyId"`
	Period        string         `json:"period"`
	TotalRequests int            `json:"totalRequests"`
	ByCategory    map[string]int `json:"byCategory"`
	ByModel       map[string]int `json:"byModel"`
	TokensUsed    int            `json:"tokensUsed"`
}

// VendorUsageResponse 是 GET /v1/usage/:vendor 响应体。
type VendorUsageResponse struct {
	Vendor   string  `json:"vendor"`
	Requests int     `json:"requests"`
	Tokens   int     `json:"tokens"`
	Cost     float64 `json:"cost"`
}
