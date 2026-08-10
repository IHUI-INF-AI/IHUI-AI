package ihui

import "context"

// AgentsApi 封装 Agent 端点(12 个):列表 / 调用 / 高级执行 / Pipeline / 并行 / 分解。
type AgentsApi struct {
	client *BaseClient
}

// NewAgentsApi 构造 AgentsApi。
func NewAgentsApi(c *BaseClient) *AgentsApi {
	return &AgentsApi{client: c}
}

// List GET /v1/agents(Agent 列表)。
func (a *AgentsApi) List(ctx context.Context) (*AgentsListResponse, error) {
	out := &AgentsListResponse{}
	if err := a.client.Request(ctx, "GET", "/agents", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Get GET /v1/agents/:id(Agent 详情)。
func (a *AgentsApi) Get(ctx context.Context, id string) (*AgentInfo, error) {
	out := &AgentInfo{}
	if err := a.client.Request(ctx, "GET", "/agents/"+Encode(id), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Call POST /v1/agents/:id/call(调用 Agent)。
func (a *AgentsApi) Call(ctx context.Context, id string, req *AgentCallRequest) (*AgentCallResponse, error) {
	out := &AgentCallResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/"+Encode(id)+"/call", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Execute POST /v1/agents/execute(高级执行,支持 PermissionGuard)。
func (a *AgentsApi) Execute(ctx context.Context, req *AgentExecuteRequest) (*AgentExecuteResponse, error) {
	out := &AgentExecuteResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/execute", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ExecuteStream POST /v1/agents/execute/stream(SSE 流式执行),返回 SSE chunk channel。
//
// 调用方:`for chunk := range stream { ... }`。channel 关闭表示流结束。
func (a *AgentsApi) ExecuteStream(ctx context.Context, req *AgentExecuteRequest) (<-chan map[string]any, error) {
	resp, err := a.client.RequestStream(ctx, "POST", "/agents/execute/stream", req)
	if err != nil {
		return nil, err
	}
	return StreamSSE(ctx, resp.Body), nil
}

// GetTaskStatus GET /v1/agents/tasks/:id/status(任务状态)。
func (a *AgentsApi) GetTaskStatus(ctx context.Context, taskID string) (*AgentTaskStatusResponse, error) {
	out := &AgentTaskStatusResponse{}
	if err := a.client.Request(ctx, "GET", "/agents/tasks/"+Encode(taskID)+"/status", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// CancelTask POST /v1/agents/tasks/:id/cancel(取消任务)。
func (a *AgentsApi) CancelTask(ctx context.Context, taskID string) error {
	return a.client.Request(ctx, "POST", "/agents/tasks/"+Encode(taskID)+"/cancel", nil, nil)
}

// ListSessions GET /v1/agents/sessions(会话列表)。
func (a *AgentsApi) ListSessions(ctx context.Context) (*AgentSessionsResponse, error) {
	out := &AgentSessionsResponse{}
	if err := a.client.Request(ctx, "GET", "/agents/sessions", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// DeleteSession DELETE /v1/agents/sessions/:id(删除会话)。
func (a *AgentsApi) DeleteSession(ctx context.Context, id string) error {
	return a.client.Request(ctx, "DELETE", "/agents/sessions/"+Encode(id), nil, nil)
}

// Pipeline POST /v1/agents/pipeline(Pipeline 编排)。
func (a *AgentsApi) Pipeline(ctx context.Context, req *AgentPipelineRequest) (*AgentPipelineResponse, error) {
	out := &AgentPipelineResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/pipeline", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Parallel POST /v1/agents/parallel(并行执行)。
func (a *AgentsApi) Parallel(ctx context.Context, req *AgentParallelRequest) (*AgentParallelResponse, error) {
	out := &AgentParallelResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/parallel", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Decompose POST /v1/agents/decompose(任务分解)。
func (a *AgentsApi) Decompose(ctx context.Context, req *AgentExecuteRequest) (*AgentDecomposeResponse, error) {
	out := &AgentDecomposeResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/decompose", req, out); err != nil {
		return nil, err
	}
	return out, nil
}