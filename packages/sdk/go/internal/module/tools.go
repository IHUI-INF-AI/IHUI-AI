// Package module 的 MCP 工具 / 技能 / 人格 / 代码搜索 / 截图模块(16 端点)。
package module

import (
	"context"

	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/client"
	"github.com/IHUI-INF-AI/IHUI-AI/packages/sdk/go/internal/model"
)

// ToolsApi 封装 MCP 工具端点(16 个):工具 / 资源 / 提示词 / 技能 / slash 命令 / 采样 / 人格 / 搜索 / 截图。
type ToolsApi struct {
	client *client.BaseClient
}

// NewToolsApi 构造 ToolsApi。
func NewToolsApi(c *client.BaseClient) *ToolsApi {
	return &ToolsApi{client: c}
}

// List GET /v1/tools(MCP 工具列表)。
func (a *ToolsApi) List(ctx context.Context) (*model.ToolsResponse, error) {
	out := &model.ToolsResponse{}
	if err := a.client.Request(ctx, "GET", "/tools", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Call POST /v1/tools/call(调用 MCP 工具)。
func (a *ToolsApi) Call(ctx context.Context, req *model.ToolCallRequest) (*model.ToolCallResponse, error) {
	out := &model.ToolCallResponse{}
	if err := a.client.Request(ctx, "POST", "/tools/call", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListResources GET /v1/resources(MCP 资源列表)。
func (a *ToolsApi) ListResources(ctx context.Context) (*model.ResourcesResponse, error) {
	out := &model.ResourcesResponse{}
	if err := a.client.Request(ctx, "GET", "/resources", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetResource GET /v1/resources/:uri(资源详情)。
func (a *ToolsApi) GetResource(ctx context.Context, uri string) (*model.ResourceDetail, error) {
	out := &model.ResourceDetail{}
	if err := a.client.Request(ctx, "GET", "/resources/"+client.Encode(uri), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListPrompts GET /v1/prompts(MCP 提示词列表)。
func (a *ToolsApi) ListPrompts(ctx context.Context) (*model.PromptsResponse, error) {
	out := &model.PromptsResponse{}
	if err := a.client.Request(ctx, "GET", "/prompts", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// InvokePrompt POST /v1/prompts/invoke(调用提示词)。
func (a *ToolsApi) InvokePrompt(ctx context.Context, req *model.PromptInvokeRequest) (*model.PromptInvokeResponse, error) {
	out := &model.PromptInvokeResponse{}
	if err := a.client.Request(ctx, "POST", "/prompts/invoke", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListSkills GET /v1/skills(技能列表)。
func (a *ToolsApi) ListSkills(ctx context.Context) (*model.SkillsResponse, error) {
	out := &model.SkillsResponse{}
	if err := a.client.Request(ctx, "GET", "/skills", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListSlashCommands GET /v1/slash-commands(slash 命令列表)。
func (a *ToolsApi) ListSlashCommands(ctx context.Context) (*model.SlashCommandsResponse, error) {
	out := &model.SlashCommandsResponse{}
	if err := a.client.Request(ctx, "GET", "/slash-commands", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// InvokeSlashCommand POST /v1/slash-commands(调用 slash 命令)。
func (a *ToolsApi) InvokeSlashCommand(ctx context.Context, req *model.InvokeSlashCommandRequest) (*model.InvokeSlashCommandResponse, error) {
	out := &model.InvokeSlashCommandResponse{}
	if err := a.client.Request(ctx, "POST", "/slash-commands", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Sampling POST /v1/sampling(模型采样)。
func (a *ToolsApi) Sampling(ctx context.Context, req *model.SamplingRequest) (*model.SamplingResponse, error) {
	out := &model.SamplingResponse{}
	if err := a.client.Request(ctx, "POST", "/sampling", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListPersonas GET /v1/personas(人格列表)。
func (a *ToolsApi) ListPersonas(ctx context.Context) (*model.PersonasResponse, error) {
	out := &model.PersonasResponse{}
	if err := a.client.Request(ctx, "GET", "/personas", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetPersona GET /v1/personas/:name(人格详情)。
func (a *ToolsApi) GetPersona(ctx context.Context, name string) (*model.PersonaDetail, error) {
	out := &model.PersonaDetail{}
	if err := a.client.Request(ctx, "GET", "/personas/"+client.Encode(name), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// SearchCodebase POST /v1/tools/search-codebase(代码库搜索)。
func (a *ToolsApi) SearchCodebase(ctx context.Context, req *model.SearchCodebaseRequest) (*model.SearchCodebaseResponse, error) {
	out := &model.SearchCodebaseResponse{}
	if err := a.client.Request(ctx, "POST", "/tools/search-codebase", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// SearchWeb POST /v1/tools/search-web(网页搜索)。
func (a *ToolsApi) SearchWeb(ctx context.Context, req *model.SearchWebRequest) (*model.SearchWebResponse, error) {
	out := &model.SearchWebResponse{}
	if err := a.client.Request(ctx, "POST", "/tools/search-web", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// AnalyzeCode POST /v1/tools/analyze-code(代码分析)。
func (a *ToolsApi) AnalyzeCode(ctx context.Context, req *model.AnalyzeCodeRequest) (*model.AnalyzeCodeResponse, error) {
	out := &model.AnalyzeCodeResponse{}
	if err := a.client.Request(ctx, "POST", "/tools/analyze-code", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Screenshot POST /v1/screenshot(网页截图)。
func (a *ToolsApi) Screenshot(ctx context.Context, req *model.ScreenshotRequest) (*model.ScreenshotResponse, error) {
	out := &model.ScreenshotResponse{}
	if err := a.client.Request(ctx, "POST", "/screenshot", req, out); err != nil {
		return nil, err
	}
	return out, nil
}
