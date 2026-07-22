// Package model 的 Agent 类型。
package model

// AgentInfo 是 GET /v1/agents/:id 响应体(Agent 详情)。
type AgentInfo struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Capabilities []string `json:"capabilities"`
}

// AgentsListResponse 是 GET /v1/agents 响应体。
type AgentsListResponse struct {
	Object string      `json:"object"`
	Data   []AgentInfo `json:"data"`
}

// AgentCallRequest 是 POST /v1/agents/:id/call 请求体。
type AgentCallRequest struct {
	Input     string `json:"input"`
	SessionID string `json:"sessionId,omitempty"`
}

// AgentCallResponse 是 POST /v1/agents/:id/call 响应体。
type AgentCallResponse struct {
	AgentID   string `json:"agentId"`
	SessionID string `json:"sessionId"`
	Output    string `json:"output"`
	Usage     struct {
		TotalTokens int `json:"totalTokens"`
	} `json:"usage"`
}

// AgentExecuteRequest 是 POST /v1/agents/execute 请求体(高级执行,支持 PermissionGuard)。
type AgentExecuteRequest struct {
	AgentID        string `json:"agentId"`
	Input          string `json:"input"`
	SessionID      string `json:"sessionId,omitempty"`
	PermissionMode string `json:"permissionMode,omitempty"`
	MaxIterations  *int   `json:"maxIterations,omitempty"`
}

// AgentExecuteResponse 是 POST /v1/agents/execute 响应体。
type AgentExecuteResponse struct {
	TaskID     string `json:"taskId"`
	SessionID  string `json:"sessionId"`
	Status     string `json:"status"`
	Output     string `json:"output"`
	Iterations int    `json:"iterations"`
	Usage      struct {
		TotalTokens int `json:"totalTokens"`
	} `json:"usage"`
}

// AgentTaskStatusResponse 是 GET /v1/agents/tasks/:id/status 响应体。
type AgentTaskStatusResponse struct {
	TaskID    string  `json:"taskId"`
	Status    string  `json:"status"`
	Progress  float64 `json:"progress,omitempty"`
	Result    string  `json:"result,omitempty"`
	Error     string  `json:"error,omitempty"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
}

// AgentSessionItem 是 Agent 会话列表项。
type AgentSessionItem struct {
	ID            string `json:"id"`
	AgentID       string `json:"agentId"`
	Title         string `json:"title"`
	MessageCount  int    `json:"messageCount"`
	LastMessageAt string `json:"lastMessageAt"`
	CreatedAt     string `json:"createdAt"`
}

// AgentSessionsResponse 是 GET /v1/agents/sessions 响应体。
type AgentSessionsResponse struct {
	Object string             `json:"object"`
	Data   []AgentSessionItem `json:"data"`
}

// PipelineStep 是 Pipeline 编排步骤。
type PipelineStep struct {
	AgentID   string `json:"agentId"`
	Input     string `json:"input"`
	DependsOn []int  `json:"dependsOn,omitempty"`
}

// AgentPipelineRequest 是 POST /v1/agents/pipeline 请求体。
type AgentPipelineRequest struct {
	Steps []PipelineStep `json:"steps"`
}

// PipelineStepResult 是 Pipeline 步骤结果。
type PipelineStepResult struct {
	StepIndex int    `json:"stepIndex"`
	Status    string `json:"status"`
	Output    string `json:"output"`
}

// AgentPipelineResponse 是 POST /v1/agents/pipeline 响应体。
type AgentPipelineResponse struct {
	PipelineID string               `json:"pipelineId"`
	Results    []PipelineStepResult `json:"results"`
}

// ParallelTask 是并行执行任务。
type ParallelTask struct {
	AgentID string `json:"agentId"`
	Input   string `json:"input"`
}

// AgentParallelRequest 是 POST /v1/agents/parallel 请求体。
type AgentParallelRequest struct {
	Tasks []ParallelTask `json:"tasks"`
}

// ParallelTaskResult 是并行任务结果。
type ParallelTaskResult struct {
	Index  int    `json:"index"`
	Status string `json:"status"`
	Output string `json:"output"`
}

// AgentParallelResponse 是 POST /v1/agents/parallel 响应体。
type AgentParallelResponse struct {
	BatchID string               `json:"batchId"`
	Results []ParallelTaskResult `json:"results"`
}

// AgentDecomposeSubtask 是任务分解子任务。
type AgentDecomposeSubtask struct {
	ID          string   `json:"id"`
	Description string   `json:"description"`
	DependsOn   []string `json:"dependsOn,omitempty"`
}

// AgentDecomposeResponse 是 POST /v1/agents/decompose 响应体。
type AgentDecomposeResponse struct {
	TaskID   string                  `json:"taskId"`
	Subtasks []AgentDecomposeSubtask `json:"subtasks"`
}
