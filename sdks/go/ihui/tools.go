package ihui

import "context"

// ToolsApi 封装 MCP 工具端点(16 个):工具 / 资源 / 提示词 / 技能 / slash 命令 / 采样 / 人格 / 搜索 / 截图。
type ToolsApi struct {
	client *BaseClient
}

// NewToolsApi 构造 ToolsApi。
func NewToolsApi(c *BaseClient) *ToolsApi {
	return &ToolsApi{client: c}
}

// List GET /v1/tools(MCP 工具列表)。
func (a *ToolsApi) List(ctx context.Context) (*ToolsResponse, error) {
	out := &ToolsResponse{}
	if err := a.client.Request(ctx, "GET", "/tools", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Call POST /v1/tools/call(调用 MCP 工具)。
func (a *ToolsApi) Call(ctx context.Context, req *ToolCallRequest) (*ToolCallResponse, error) {
	out := &ToolCallResponse{}
	if err := a.client.Request(ctx, "POST", "/tools/call", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListResources GET /v1/resources(MCP 资源列表)。
func (a *ToolsApi) ListResources(ctx context.Context) (*ResourcesResponse, error) {
	out := &ResourcesResponse{}
	if err := a.client.Request(ctx, "GET", "/resources", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetResource GET /v1/resources/:uri(资源详情)。
func (a *ToolsApi) GetResource(ctx context.Context, uri string) (*ResourceDetail, error) {
	out := &ResourceDetail{}
	if err := a.client.Request(ctx, "GET", "/resources/"+Encode(uri), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListPrompts GET /v1/prompts(MCP 提示词列表)。
func (a *ToolsApi) ListPrompts(ctx context.Context) (*PromptsResponse, error) {
	out := &PromptsResponse{}
	if err := a.client.Request(ctx, "GET", "/prompts", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// InvokePrompt POST /v1/prompts/invoke(调用提示词)。
func (a *ToolsApi) InvokePrompt(ctx context.Context, req *PromptInvokeRequest) (*PromptInvokeResponse, error) {
	out := &PromptInvokeResponse{}
	if err := a.client.Request(ctx, "POST", "/prompts/invoke", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListSkills GET /v1/skills(技能列表)。
func (a *ToolsApi) ListSkills(ctx context.Context) (*SkillsResponse, error) {
	out := &SkillsResponse{}
	if err := a.client.Request(ctx, "GET", "/skills", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListSlashCommands GET /v1/slash-commands(slash 命令列表)。
func (a *ToolsApi) ListSlashCommands(ctx context.Context) (*SlashCommandsResponse, error) {
	out := &SlashCommandsResponse{}
	if err := a.client.Request(ctx, "GET", "/slash-commands", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// InvokeSlashCommand POST /v1/slash-commands(调用 slash 命令)。
func (a *ToolsApi) InvokeSlashCommand(ctx context.Context, req *InvokeSlashCommandRequest) (*InvokeSlashCommandResponse, error) {
	out := &InvokeSlashCommandResponse{}
	if err := a.client.Request(ctx, "POST", "/slash-commands", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Sampling POST /v1/sampling(模型采样)。
func (a *ToolsApi) Sampling(ctx context.Context, req *SamplingRequest) (*SamplingResponse, error) {
	out := &SamplingResponse{}
	if err := a.client.Request(ctx, "POST", "/sampling", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// ListPersonas GET /v1/personas(人格列表)。
func (a *ToolsApi) ListPersonas(ctx context.Context) (*PersonasResponse, error) {
	out := &PersonasResponse{}
	if err := a.client.Request(ctx, "GET", "/personas", nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetPersona GET /v1/personas/:name(人格详情)。
func (a *ToolsApi) GetPersona(ctx context.Context, name string) (*PersonaDetail, error) {
	out := &PersonaDetail{}
	if err := a.client.Request(ctx, "GET", "/personas/"+Encode(name), nil, out); err != nil {
		return nil, err
	}
	return out, nil
}

// SearchCodebase POST /v1/tools/search-codebase(代码库搜索)。
func (a *ToolsApi) SearchCodebase(ctx context.Context, req *SearchCodebaseRequest) (*SearchCodebaseResponse, error) {
	out := &SearchCodebaseResponse{}
	if err := a.client.Request(ctx, "POST", "/tools/search-codebase", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// SearchWeb POST /v1/tools/search-web(网页搜索)。
func (a *ToolsApi) SearchWeb(ctx context.Context, req *SearchWebRequest) (*SearchWebResponse, error) {
	out := &SearchWebResponse{}
	if err := a.client.Request(ctx, "POST", "/tools/search-web", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// AnalyzeCode POST /v1/tools/analyze-code(代码分析)。
func (a *ToolsApi) AnalyzeCode(ctx context.Context, req *AnalyzeCodeRequest) (*AnalyzeCodeResponse, error) {
	out := &AnalyzeCodeResponse{}
	if err := a.client.Request(ctx, "POST", "/tools/analyze-code", req, out); err != nil {
		return nil, err
	}
	return out, nil
}

// Screenshot POST /v1/screenshot(网页截图)。
func (a *ToolsApi) Screenshot(ctx context.Context, req *ScreenshotRequest) (*ScreenshotResponse, error) {
	out := &ScreenshotResponse{}
	if err := a.client.Request(ctx, "POST", "/screenshot", req, out); err != nil {
		return nil, err
	}
	return out, nil
}