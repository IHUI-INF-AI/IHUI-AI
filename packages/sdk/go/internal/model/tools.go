// Package model 的 MCP 工具 / 技能 / 人格 / 代码搜索 / 截图类型。
package model

// ToolItem 是 MCP 工具列表项。
type ToolItem struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"inputSchema"`
	Category    string         `json:"category,omitempty"`
}

// ToolsResponse 是 GET /v1/tools 响应体。
type ToolsResponse struct {
	Object string     `json:"object"`
	Data   []ToolItem `json:"data"`
}

// ToolCallRequest 是 POST /v1/tools/call 请求体。
type ToolCallRequest struct {
	Name      string         `json:"name"`
	Arguments map[string]any `json:"arguments"`
}

// ToolCallResponse 是 POST /v1/tools/call 响应体。
type ToolCallResponse struct {
	ToolName string `json:"toolName"`
	Result   any    `json:"result"`
	IsError  bool   `json:"isError"`
}

// ResourceItem 是 MCP 资源列表项。
type ResourceItem struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`
}

// ResourcesResponse 是 GET /v1/resources 响应体。
type ResourcesResponse struct {
	Object string         `json:"object"`
	Data   []ResourceItem `json:"data"`
}

// ResourceDetail 是 GET /v1/resources/:uri 响应体(资源详情)。
type ResourceDetail struct {
	URI         string `json:"uri"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`
	Content     string `json:"content"`
}

// PromptArgument 是提示词参数。
type PromptArgument struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

// PromptItem 是 MCP 提示词列表项。
type PromptItem struct {
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Arguments   []PromptArgument `json:"arguments,omitempty"`
}

// PromptsResponse 是 GET /v1/prompts 响应体。
type PromptsResponse struct {
	Object string       `json:"object"`
	Data   []PromptItem `json:"data"`
}

// PromptInvokeRequest 是 POST /v1/prompts/invoke 请求体。
type PromptInvokeRequest struct {
	Name      string            `json:"name"`
	Arguments map[string]string `json:"arguments,omitempty"`
}

// PromptMessage 是提示词调用返回的消息。
type PromptMessage struct {
	Role    string `json:"role"`
	Content struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

// PromptInvokeResponse 是 POST /v1/prompts/invoke 响应体。
type PromptInvokeResponse struct {
	Messages []PromptMessage `json:"messages"`
}

// SkillItem 是技能列表项。
type SkillItem struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	Version      string   `json:"version"`
	Capabilities []string `json:"capabilities"`
}

// SkillsResponse 是 GET /v1/skills 响应体。
type SkillsResponse struct {
	Object string      `json:"object"`
	Data   []SkillItem `json:"data"`
}

// SlashCommandItem 是 slash 命令列表项。
type SlashCommandItem struct {
	Command     string `json:"command"`
	Description string `json:"description"`
}

// SlashCommandsResponse 是 GET /v1/slash-commands 响应体。
type SlashCommandsResponse struct {
	Object string             `json:"object"`
	Data   []SlashCommandItem `json:"data"`
}

// InvokeSlashCommandRequest 是 POST /v1/slash-commands 请求体。
type InvokeSlashCommandRequest struct {
	Command string            `json:"command"`
	Args    map[string]string `json:"args,omitempty"`
}

// InvokeSlashCommandResponse 是调用 slash 命令响应。
type InvokeSlashCommandResponse struct {
	Output string `json:"output"`
}

// SamplingModelPreferences 是采样模型偏好。
type SamplingModelPreferences struct {
	Hints                []string `json:"hints,omitempty"`
	CostPriority         float64  `json:"costPriority,omitempty"`
	SpeedPriority        float64  `json:"speedPriority,omitempty"`
	IntelligencePriority float64  `json:"intelligencePriority,omitempty"`
}

// SamplingRequest 是 POST /v1/sampling 请求体。
type SamplingRequest struct {
	Messages         []Message                 `json:"messages"`
	ModelPreferences *SamplingModelPreferences `json:"modelPreferences,omitempty"`
	MaxTokens        int                       `json:"maxTokens"`
}

// SamplingResponse 是 POST /v1/sampling 响应体。
type SamplingResponse struct {
	Model      string `json:"model"`
	Role       string `json:"role"`
	Content    string `json:"content"`
	StopReason string `json:"stopReason"`
}

// PersonaItem 是人格列表项。
type PersonaItem struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	SystemPrompt string   `json:"systemPrompt"`
	Traits       []string `json:"traits"`
}

// PersonasResponse 是 GET /v1/personas 响应体。
type PersonasResponse struct {
	Object string        `json:"object"`
	Data   []PersonaItem `json:"data"`
}

// PersonaDetail 是 GET /v1/personas/:name 响应体(人格详情)。
type PersonaDetail struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	SystemPrompt string   `json:"systemPrompt"`
	Traits       []string `json:"traits"`
}

// SearchCodebaseRequest 是 POST /v1/tools/search-codebase 请求体。
type SearchCodebaseRequest struct {
	Query     string `json:"query"`
	Directory string `json:"directory,omitempty"`
}

// SearchCodebaseResultItem 是代码库搜索结果项。
type SearchCodebaseResultItem struct {
	File    string  `json:"file"`
	Line    int     `json:"line"`
	Content string  `json:"content"`
	Score   float64 `json:"score"`
}

// SearchCodebaseResponse 是 POST /v1/tools/search-codebase 响应体。
type SearchCodebaseResponse struct {
	Results []SearchCodebaseResultItem `json:"results"`
}

// SearchWebRequest 是 POST /v1/tools/search-web 请求体。
type SearchWebRequest struct {
	Query string `json:"query"`
	Num   *int   `json:"num,omitempty"`
}

// SearchWebResultItem 是网页搜索结果项。
type SearchWebResultItem struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet"`
}

// SearchWebResponse 是 POST /v1/tools/search-web 响应体。
type SearchWebResponse struct {
	Results []SearchWebResultItem `json:"results"`
}

// AnalyzeCodeRequest 是 POST /v1/tools/analyze-code 请求体。
type AnalyzeCodeRequest struct {
	Code     string `json:"code"`
	Language string `json:"language,omitempty"`
	Analysis string `json:"analysis,omitempty"`
}

// AnalyzeCodeIssue 是代码分析问题项。
type AnalyzeCodeIssue struct {
	Line     int    `json:"line"`
	Column   int    `json:"column"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
	Rule     string `json:"rule,omitempty"`
}

// AnalyzeCodeMetrics 是代码分析指标。
type AnalyzeCodeMetrics struct {
	Complexity      *float64 `json:"complexity,omitempty"`
	Maintainability *float64 `json:"maintainability,omitempty"`
}

// AnalyzeCodeResponse 是 POST /v1/tools/analyze-code 响应体。
type AnalyzeCodeResponse struct {
	Issues  []AnalyzeCodeIssue  `json:"issues"`
	Metrics *AnalyzeCodeMetrics `json:"metrics,omitempty"`
}

// ScreenshotRequest 是 POST /v1/screenshot 请求体。
type ScreenshotRequest struct {
	URL      string `json:"url"`
	Width    *int   `json:"width,omitempty"`
	Height   *int   `json:"height,omitempty"`
	FullPage *bool  `json:"fullPage,omitempty"`
}

// ScreenshotResponse 是 POST /v1/screenshot 响应体。
type ScreenshotResponse struct {
	Image  string `json:"image"`
	Format string `json:"format"`
	Width  int    `json:"width"`
	Height int    `json:"height"`
}
