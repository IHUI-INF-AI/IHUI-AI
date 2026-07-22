// Package module 的 Agent 模块(12 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// AgentsApi 封装 Agent 端点(12 个):列表 / 调用 / 高级执行 / Pipeline / 并行 / 分解。
type AgentsApi struct {
	client *client.BaseClient
}

// NewAgentsApi 构造 AgentsApi。
func NewAgentsApi(c *client.BaseClient) *AgentsApi {
	return &AgentsApi{client: c}
}

// List GET /v1/agents(Agent 列表)。
func (a *AgentsApi) List(ctx context.Context) (*model.AgentsListResponse, error) {
	out := &model.AgentsListResponse{}
	if err := a.client.Request(ctx, "GET", "/agents", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Get GET /v1/agents/:id(Agent 详情)。
func (a *AgentsApi) Get(ctx context.Context, id string) (*model.AgentInfo, error) {
	out := &model.AgentInfo{}
	if err := a.client.Request(ctx, "GET", "/agents/"+client.Encode(id), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Call POST /v1/agents/:id/call(调用 Agent)。
func (a *AgentsApi) Call(ctx context.Context, id string, req *model.AgentCallRequest) (*model.AgentCallResponse, error) {
	out := &model.AgentCallResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/"+client.Encode(id)+"/call", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Execute POST /v1/agents/execute(高级执行,支持 PermissionGuard)。
func (a *AgentsApi) Execute(ctx context.Context, req *model.AgentExecuteRequest) (*model.AgentExecuteResponse, error) {
	out := &model.AgentExecuteResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/execute", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ExecuteStream POST /v1/agents/execute/stream(SSE 流式执行),返回 SSE chunk channel。
//
// 调用方:`for chunk := range stream { ... }`。channel 关闭表示流结束。
func (a *AgentsApi) ExecuteStream(ctx context.Context, req *model.AgentExecuteRequest) (<-chan map[string]any, error) {
	resp, err := a.client.RequestStream(ctx, "POST", "/agents/execute/stream", req)
	if err != nil {
		return nil, err
	}
	return client.StreamSSE(ctx, resp.Body), nil
}

// GetTaskStatus GET /v1/agents/tasks/:id/status(任务状态)。
func (a *AgentsApi) GetTaskStatus(ctx context.Context, taskID string) (*model.AgentTaskStatusResponse, error) {
	out := &model.AgentTaskStatusResponse{}
	if err := a.client.Request(ctx, "GET", "/agents/tasks/"+client.Encode(taskID)+"/status", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// CancelTask POST /v1/agents/tasks/:id/cancel(取消任务)。
func (a *AgentsApi) CancelTask(ctx context.Context, taskID string) error {
	return a.client.Request(ctx, "POST", "/agents/tasks/"+client.Encode(taskID)+"/cancel", nil, nil)
}

// ListSessions GET /v1/agents/sessions(会话列表)。
func (a *AgentsApi) ListSessions(ctx context.Context) (*model.AgentSessionsResponse, error) {
	out := &model.AgentSessionsResponse{}
	if err := a.client.Request(ctx, "GET", "/agents/sessions", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// DeleteSession DELETE /v1/agents/sessions/:id(删除会话)。
func (a *AgentsApi) DeleteSession(ctx context.Context, id string) error {
	return a.client.Request(ctx, "DELETE", "/agents/sessions/"+client.Encode(id), nil, nil)
}

// Pipeline POST /v1/agents/pipeline(Pipeline 编排)。
func (a *AgentsApi) Pipeline(ctx context.Context, req *model.AgentPipelineRequest) (*model.AgentPipelineResponse, error) {
	out := &model.AgentPipelineResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/pipeline", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Parallel POST /v1/agents/parallel(并行执行)。
func (a *AgentsApi) Parallel(ctx context.Context, req *model.AgentParallelRequest) (*model.AgentParallelResponse, error) {
	out := &model.AgentParallelResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/parallel", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Decompose POST /v1/agents/decompose(任务分解)。
func (a *AgentsApi) Decompose(ctx context.Context, req *model.AgentExecuteRequest) (*model.AgentDecomposeResponse, error) {
	out := &model.AgentDecomposeResponse{}
	if err := a.client.Request(ctx, "POST", "/agents/decompose", req, out); err != nil {
		return nil, err
	}
	return out, nil
}
