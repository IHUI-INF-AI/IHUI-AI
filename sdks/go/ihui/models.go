package ihui

// ============================================================================
// Chat / Completions 模型
// ============================================================================

// Message 是 chat completions 的消息单元。
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletionRequest 是 POST /v1/chat/completions 请求体(OpenAI 兼容)。
type ChatCompletionRequest struct {
	Model       string    `json:"model"`
	Messages    []Message `json:"messages"`
	Stream      bool      `json:"stream,omitempty"`
	Temperature *float64  `json:"temperature,omitempty"`
	MaxTokens   *int      `json:"maxTokens,omitempty"`
}

// ChatChoice 是 chat completion 的单个选择项。
type ChatChoice struct {
	Index        int     `json:"index"`
	Message      Message `json:"message"`
	FinishReason string  `json:"finishReason"`
}

// ChatUsage 是 token 用量统计。
type ChatUsage struct {
	PromptTokens     int `json:"promptTokens"`
	CompletionTokens int `json:"completionTokens"`
	TotalTokens      int `json:"totalTokens"`
}

// ChatCompletionResponse 是 POST /v1/chat/completions 响应体(OpenAI 兼容)。
type ChatCompletionResponse struct {
	ID      string       `json:"id"`
	Object  string       `json:"object"`
	Created int64        `json:"created"`
	Model   string       `json:"model"`
	Choices []ChatChoice `json:"choices"`
	Usage   ChatUsage    `json:"usage"`
}

// ChatVisionRequest 是 POST /v1/chat/vision 请求体(视觉理解)。
type ChatVisionRequest struct {
	Model     string `json:"model"`
	Image     string `json:"image"`
	Prompt    string `json:"prompt"`
	MaxTokens *int   `json:"maxTokens,omitempty"`
}

// ChatVisionResponse 是 POST /v1/chat/vision 响应体。
type ChatVisionResponse struct {
	Description string `json:"description"`
	Model       string `json:"model"`
	Usage       struct {
		PromptTokens     int `json:"promptTokens"`
		CompletionTokens int `json:"completionTokens"`
		TotalTokens      int `json:"totalTokens"`
	} `json:"usage"`
}

// ============================================================================
// Embeddings 模型
// ============================================================================

// EmbeddingsRequest 是 POST /v1/embeddings 请求体(OpenAI 兼容)。
type EmbeddingsRequest struct {
	Model      string `json:"model"`
	Input      any    `json:"input"` // string 或 []string
	Dimensions *int   `json:"dimensions,omitempty"`
}

// EmbeddingItem 是单个 embedding 结果。
type EmbeddingItem struct {
	Object    string    `json:"object"`
	Index     int       `json:"index"`
	Embedding []float64 `json:"embedding"`
}

// EmbeddingsResponse 是 POST /v1/embeddings 响应体(OpenAI 兼容)。
type EmbeddingsResponse struct {
	Object string          `json:"object"`
	Data   []EmbeddingItem `json:"data"`
	Model  string          `json:"model"`
	Usage  struct {
		PromptTokens int `json:"promptTokens"`
		TotalTokens  int `json:"totalTokens"`
	} `json:"usage"`
}

// ============================================================================
// Models 模型
// ============================================================================

// ModelInfo 是 GET /v1/models/:id 响应体(模型详情)。
type ModelInfo struct {
	ID             string   `json:"id"`
	Object         string   `json:"object"`
	Created        int64    `json:"created"`
	OwnedBy        string   `json:"ownedBy"`
	Capabilities   []string `json:"capabilities"`
	ContextWindow  *int     `json:"contextWindow,omitempty"`
	SupportsStream *bool    `json:"supportsStream,omitempty"`
}

// ModelListItem 是 GET /v1/models 列表项。
type ModelListItem struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	OwnedBy string `json:"ownedBy"`
}

// ModelsResponse 是 GET /v1/models 响应体(OpenAI 兼容)。
type ModelsResponse struct {
	Object string          `json:"object"`
	Data   []ModelListItem `json:"data"`
}

// VendorModelItem 是厂商模型列表项。
type VendorModelItem struct {
	ID     string `json:"id"`
	Object string `json:"object"`
}

// VendorModelsResponse 是 GET /v1/vendors/:vendor/models 响应体。
type VendorModelsResponse struct {
	Vendor string            `json:"vendor"`
	Object string            `json:"object"`
	Data   []VendorModelItem `json:"data"`
}

// ============================================================================
// MoA (Mixture of Agents) 模型
// ============================================================================

// MoaPresetItem 是 MoA 预设列表项。
type MoaPresetItem struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Models   []string `json:"models"`
	Strategy string   `json:"strategy"`
}

// MoaPresetsResponse 是 GET /v1/moa-presets 响应体。
type MoaPresetsResponse struct {
	Object string          `json:"object"`
	Data   []MoaPresetItem `json:"data"`
}

// CreateMoaPresetRequest 是 POST /v1/moa-presets 请求体。
type CreateMoaPresetRequest struct {
	Name     string   `json:"name"`
	Models   []string `json:"models"`
	Strategy string   `json:"strategy"`
}

// ChatMoaRequest 是 POST /v1/chat/moa 请求体(Mixture of Agents)。
type ChatMoaRequest struct {
	Messages []Message `json:"messages"`
	PresetID string    `json:"presetId,omitempty"`
	Stream   bool      `json:"stream,omitempty"`
}

// ChatMoaResponse 是 POST /v1/chat/moa 响应体。
type ChatMoaResponse struct {
	Output   string `json:"output"`
	PresetID string `json:"presetId"`
	Model    string `json:"model"`
	Usage    struct {
		TotalTokens int `json:"totalTokens"`
	} `json:"usage"`
}

// ============================================================================
// Agents 模型
// ============================================================================

// AgentInfo 是 Agent 详情。
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

// AgentExecuteRequest 是 POST /v1/agents/execute 请求体。
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

// ============================================================================
// Audio 模型
// ============================================================================

// AudioSpeechRequest 是 POST /v1/audio/speech 请求体(TTS)。
type AudioSpeechRequest struct {
	Model          string  `json:"model"`
	Input          string  `json:"input"`
	Voice          string  `json:"voice"`
	ResponseFormat string  `json:"responseFormat,omitempty"`
	Speed          float64 `json:"speed,omitempty"`
}

// AudioSpeechResponse 是 POST /v1/audio/speech 响应体。
type AudioSpeechResponse struct {
	Audio      string `json:"audio"`
	Format     string `json:"format"`
	DurationMs int64  `json:"durationMs"`
}

// AudioTranscriptionsRequest 是 POST /v1/audio/transcriptions 请求体(ASR)。
type AudioTranscriptionsRequest struct {
	Model    string `json:"model"`
	Audio    string `json:"audio"`
	Language string `json:"language,omitempty"`
	Prompt   string `json:"prompt,omitempty"`
}

// AudioTranscriptionSegment 是 ASR 转录片段。
type AudioTranscriptionSegment struct {
	ID    int     `json:"id"`
	Start float64 `json:"start"`
	End   float64 `json:"end"`
	Text  string  `json:"text"`
}

// AudioTranscriptionsResponse 是 POST /v1/audio/transcriptions 响应体。
type AudioTranscriptionsResponse struct {
	Text     string                      `json:"text"`
	Language string                      `json:"language"`
	Duration float64                     `json:"duration"`
	Segments []AudioTranscriptionSegment `json:"segments,omitempty"`
}

// AudioVoiceItem 是音色列表项。
type AudioVoiceItem struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Gender   string `json:"gender"`
	Language string `json:"language"`
	Preview  string `json:"preview,omitempty"`
}

// AudioVoicesResponse 是 GET /v1/audio/voices 响应体。
type AudioVoicesResponse struct {
	Object string           `json:"object"`
	Data   []AudioVoiceItem `json:"data"`
}

// AudioChatRequest 是 POST /v1/audio/chat 请求体(语音对话)。
type AudioChatRequest struct {
	Audio     string `json:"audio"`
	Model     string `json:"model"`
	SessionID string `json:"sessionId,omitempty"`
}

// AudioChatResponse 是 POST /v1/audio/chat 响应体。
type AudioChatResponse struct {
	Text      string `json:"text"`
	Audio     string `json:"audio"`
	SessionID string `json:"sessionId"`
}

// RegisterSpeakerRequest 是 POST /v1/audio/speakers 请求体(声纹注册)。
type RegisterSpeakerRequest struct {
	Name  string `json:"name"`
	Audio string `json:"audio"`
}

// RegisterSpeakerResponse 是声纹注册响应。
type RegisterSpeakerResponse struct {
	SpeakerID string `json:"speakerId"`
	Status    string `json:"status"`
}

// SpeakersListResponse 是 GET /v1/audio/speakers 响应体(声纹列表)。
type SpeakersListResponse struct {
	Object string `json:"object"`
	Data   []struct {
		ID           string `json:"id"`
		Name         string `json:"name"`
		RegisteredAt string `json:"registeredAt"`
	} `json:"data"`
}

// CompareSpeakersRequest 是 POST /v1/audio/speakers/compare 请求体(声纹比对)。
type CompareSpeakersRequest struct {
	SpeakerID string `json:"speakerId"`
	Audio     string `json:"audio"`
}

// CompareSpeakersResponse 是 POST /v1/audio/speakers/compare 响应体。
type CompareSpeakersResponse struct {
	Score   float64 `json:"score"`
	Matched bool    `json:"matched"`
}

// MusicGenerationsRequest 是 POST /v1/audio/music 请求体(音乐生成)。
type MusicGenerationsRequest struct {
	Prompt   string `json:"prompt"`
	Lyrics   string `json:"lyrics,omitempty"`
	Duration *int   `json:"duration,omitempty"`
}

// MusicGenerationsResponse 是 POST /v1/audio/music 响应体。
type MusicGenerationsResponse struct {
	TaskID string `json:"taskId"`
	Status string `json:"status"`
}

// ============================================================================
// Images 模型
// ============================================================================

// ImageGenerationsRequest 是 POST /v1/images/generations 请求体(文生图)。
type ImageGenerationsRequest struct {
	Model   string `json:"model"`
	Prompt  string `json:"prompt"`
	N       *int   `json:"n,omitempty"`
	Size    string `json:"size,omitempty"`
	Quality string `json:"quality,omitempty"`
	Style   string `json:"style,omitempty"`
	Vendor  string `json:"vendor,omitempty"`
}

// ImageItem 是图像生成结果项。
type ImageItem struct {
	URL           string `json:"url,omitempty"`
	B64JSON       string `json:"b64Json,omitempty"`
	RevisedPrompt string `json:"revisedPrompt,omitempty"`
}

// ImageGenerationsResponse 是 POST /v1/images/generations 响应体(OpenAI 兼容)。
type ImageGenerationsResponse struct {
	Created int64       `json:"created"`
	Data    []ImageItem `json:"data"`
}

// ImageEditsRequest 是 POST /v1/images/edits 请求体(图片编辑)。
type ImageEditsRequest struct {
	Model  string `json:"model"`
	Image  string `json:"image"`
	Prompt string `json:"prompt"`
	Mask   string `json:"mask,omitempty"`
	N      *int   `json:"n,omitempty"`
	Size   string `json:"size,omitempty"`
}

// ImageInpaintRequest 是 POST /v1/images/inpaint 请求体(图片修复)。
type ImageInpaintRequest struct {
	Model  string `json:"model"`
	Image  string `json:"image"`
	Mask   string `json:"mask"`
	Prompt string `json:"prompt"`
}

// StyleTransferRequest 是 POST /v1/images/style-transfer 请求体(风格迁移)。
type StyleTransferRequest struct {
	Model string `json:"model"`
	Image string `json:"image"`
	Style string `json:"style"`
}

// VirtualTryOnRequest 是 POST /v1/images/virtual-try-on 请求体(虚拟试穿)。
type VirtualTryOnRequest struct {
	Model        string `json:"model"`
	PersonImage  string `json:"personImage"`
	GarmentImage string `json:"garmentImage"`
}

// BackgroundGenerationRequest 是 POST /v1/images/background 请求体(背景生成)。
type BackgroundGenerationRequest struct {
	Model      string `json:"model"`
	Foreground string `json:"foreground"`
	Prompt     string `json:"prompt"`
}

// ============================================================================
// Videos 模型
// ============================================================================

// VideoGenerationsRequest 是 POST /v1/videos/generations 请求体(视频生成)。
type VideoGenerationsRequest struct {
	Model      string `json:"model"`
	Prompt     string `json:"prompt"`
	Image      string `json:"image,omitempty"`
	Duration   *int   `json:"duration,omitempty"`
	Resolution string `json:"resolution,omitempty"`
	Vendor     string `json:"vendor,omitempty"`
}

// VideoGenerationsResponse 是 POST /v1/videos/generations 响应体(异步任务)。
type VideoGenerationsResponse struct {
	TaskID        string `json:"taskId"`
	Status        string `json:"status"`
	EstimatedTime *int   `json:"estimatedTime,omitempty"`
}

// VideoTaskResponse 是 GET /v1/videos/tasks/:id 响应体。
type VideoTaskResponse struct {
	TaskID    string  `json:"taskId"`
	Status    string  `json:"status"`
	VideoURL  string  `json:"videoUrl,omitempty"`
	Progress  float64 `json:"progress,omitempty"`
	Error     string  `json:"error,omitempty"`
	CreatedAt string  `json:"createdAt"`
}

// VideoComposeScene 是视频编排分镜。
type VideoComposeScene struct {
	Text        string `json:"text"`
	Duration    int    `json:"duration"`
	ImagePrompt string `json:"imagePrompt,omitempty"`
}

// VideoComposeRequest 是 POST /v1/videos/compose 请求体(视频编排)。
type VideoComposeRequest struct {
	Scenes []VideoComposeScene `json:"scenes"`
	BgmURL string              `json:"bgmUrl,omitempty"`
}

// VideoComposeResponse 是 POST /v1/videos/compose 响应体。
type VideoComposeResponse struct {
	ComposeID string `json:"composeId"`
	Status    string `json:"status"`
}

// ============================================================================
// 3D 模型
// ============================================================================

// ThreeDGenerationsRequest 是 POST /v1/3d/generations 请求体(3D 生成)。
type ThreeDGenerationsRequest struct {
	Model  string `json:"model"`
	Input  string `json:"input"`
	Format string `json:"format,omitempty"`
}

// ThreeDGenerationsResponse 是 POST /v1/3d/generations 响应体。
type ThreeDGenerationsResponse struct {
	TaskID string `json:"taskId"`
	Status string `json:"status"`
}

// ============================================================================
// Generation 队列模型
// ============================================================================

// GenerationEnqueueRequest 是 POST /v1/generation/enqueue 请求体。
type GenerationEnqueueRequest struct {
	Type     string         `json:"type"`
	Payload  map[string]any `json:"payload"`
	Priority *int           `json:"priority,omitempty"`
}

// GenerationEnqueueResponse 是 POST /v1/generation/enqueue 响应体。
type GenerationEnqueueResponse struct {
	JobID    string `json:"jobId"`
	Status   string `json:"status"`
	Position int    `json:"position"`
}

// GenerationStatusResponse 是 GET /v1/generation/status/:id 响应体。
type GenerationStatusResponse struct {
	JobID    string  `json:"jobId"`
	Status   string  `json:"status"`
	Result   any     `json:"result,omitempty"`
	Error    string  `json:"error,omitempty"`
	Progress float64 `json:"progress,omitempty"`
}

// GenerationCancelResponse 是 POST /v1/generation/cancel/:id 响应体。
type GenerationCancelResponse struct {
	JobID  string `json:"jobId"`
	Status string `json:"status"`
}

// ============================================================================
// Knowledge 模型
// ============================================================================

// KnowledgeHealthResponse 是 GET /v1/knowledge/health 响应体。
type KnowledgeHealthResponse struct {
	Status    string `json:"status"`
	Documents int    `json:"documents"`
	Chunks    int    `json:"chunks"`
}

// KnowledgeDocumentItem 是知识库文档列表项。
type KnowledgeDocumentItem struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Source     string `json:"source"`
	ChunkCount int    `json:"chunkCount"`
	SizeBytes  int64  `json:"sizeBytes"`
	CreatedAt  string `json:"createdAt"`
}

// KnowledgeDocumentsResponse 是 GET /v1/knowledge/documents 响应体。
type KnowledgeDocumentsResponse struct {
	Object string                  `json:"object"`
	Data   []KnowledgeDocumentItem `json:"data"`
}

// IngestDocumentRequest 是 POST /v1/knowledge/documents 请求体(文档入库)。
type IngestDocumentRequest struct {
	Title         string `json:"title"`
	Content       string `json:"content"`
	Source        string `json:"source,omitempty"`
	ChunkStrategy string `json:"chunkStrategy,omitempty"`
	ChunkSize     *int   `json:"chunkSize,omitempty"`
	ChunkOverlap  *int   `json:"chunkOverlap,omitempty"`
}

// IngestDocumentResponse 是 POST /v1/knowledge/documents 响应体。
type IngestDocumentResponse struct {
	DocumentID string `json:"documentId"`
	ChunkCount int    `json:"chunkCount"`
	Status     string `json:"status"`
}

// KnowledgeDocumentDetail 是 GET /v1/knowledge/documents/:id 响应体(文档详情)。
type KnowledgeDocumentDetail struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Source     string `json:"source"`
	ChunkCount int    `json:"chunkCount"`
	SizeBytes  int64  `json:"sizeBytes"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

// DocumentChunkItem 是文档分块项。
type DocumentChunkItem struct {
	ID       string         `json:"id"`
	Content  string         `json:"content"`
	Index    int            `json:"index"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

// DocumentChunksResponse 是 GET /v1/knowledge/documents/:id/chunks 响应体。
type DocumentChunksResponse struct {
	Object string              `json:"object"`
	Data   []DocumentChunkItem `json:"data"`
}

// KnowledgeSearchRequest 是 POST /v1/knowledge/search 请求体(语义搜索)。
type KnowledgeSearchRequest struct {
	Query       string   `json:"query"`
	TopK        *int     `json:"topK,omitempty"`
	DocumentIDs []string `json:"documentIds,omitempty"`
	Threshold   float64  `json:"threshold,omitempty"`
}

// KnowledgeSearchResultItem 是搜索结果项。
type KnowledgeSearchResultItem struct {
	ID         string         `json:"id"`
	DocumentID string         `json:"documentId"`
	Content    string         `json:"content"`
	Score      float64        `json:"score"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// KnowledgeSearchResponse 是 POST /v1/knowledge/search 响应体。
type KnowledgeSearchResponse struct {
	Object string                      `json:"object"`
	Data   []KnowledgeSearchResultItem `json:"data"`
}

// RagContextRequest 是 POST /v1/knowledge/rag-context 请求体。
type RagContextRequest struct {
	Query              string `json:"query"`
	TopK               *int   `json:"topK,omitempty"`
	InjectSystemPrompt *bool  `json:"injectSystemPrompt,omitempty"`
}

// RagContextSource 是 RAG 上下文来源。
type RagContextSource struct {
	DocumentID string  `json:"documentId"`
	ChunkID    string  `json:"chunkId"`
	Score      float64 `json:"score"`
}

// RagContextResponse 是 POST /v1/knowledge/rag-context 响应体。
type RagContextResponse struct {
	Context string             `json:"context"`
	Sources []RagContextSource `json:"sources"`
}

// BatchDeleteDocumentsRequest 是 POST /v1/knowledge/documents/batch-delete 请求体。
type BatchDeleteDocumentsRequest struct {
	DocumentIDs []string `json:"documentIds"`
}

// BatchDeleteDocumentsResponse 是批量删除响应。
type BatchDeleteDocumentsResponse struct {
	Deleted int `json:"deleted"`
}

// KnowledgeGraphExtractRequest 是 POST /v1/knowledge-graph/extract 请求体。
type KnowledgeGraphExtractRequest struct {
	Text        string `json:"text"`
	ExtractType string `json:"extractType,omitempty"`
}

// GraphEntity 是知识图谱实体。
type GraphEntity struct {
	ID         string         `json:"id"`
	Name       string         `json:"name"`
	Type       string         `json:"type"`
	Properties map[string]any `json:"properties,omitempty"`
}

// GraphRelation 是知识图谱关系。
type GraphRelation struct {
	Source     string         `json:"source"`
	Target     string         `json:"target"`
	Type       string         `json:"type"`
	Properties map[string]any `json:"properties,omitempty"`
}

// KnowledgeGraphExtractResponse 是 POST /v1/knowledge-graph/extract 响应体。
type KnowledgeGraphExtractResponse struct {
	Entities  []GraphEntity   `json:"entities"`
	Relations []GraphRelation `json:"relations"`
}

// KnowledgeGraphBuildRequest 是 POST /v1/knowledge-graph/build 请求体。
type KnowledgeGraphBuildRequest struct {
	Source     string `json:"source"`
	SourceType string `json:"sourceType,omitempty"`
}

// KnowledgeGraphBuildResponse 是 POST /v1/knowledge-graph/build 响应体。
type KnowledgeGraphBuildResponse struct {
	GraphID string `json:"graphId"`
	Nodes   int    `json:"nodes"`
	Edges   int    `json:"edges"`
}

// GraphNode 是知识图谱节点。
type GraphNode struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Type  string `json:"type"`
}

// GraphEdge 是知识图谱边。
type GraphEdge struct {
	Source string `json:"source"`
	Target string `json:"target"`
	Label  string `json:"label"`
}

// KnowledgeGraphDataResponse 是 GET /v1/knowledge-graph/data 响应体。
type KnowledgeGraphDataResponse struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// ============================================================================
// Tools 模型
// ============================================================================

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
	Messages         []Message                `json:"messages"`
	ModelPreferences *SamplingModelPreferences `json:"modelPreferences,omitempty"`
	MaxTokens        int                      `json:"maxTokens"`
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

// ============================================================================
// Memory 模型
// ============================================================================

// SaveMemoryRequest 是 POST /v1/memory 请求体(保存记忆)。
type SaveMemoryRequest struct {
	Content  string         `json:"content"`
	Type     string         `json:"type,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

// SaveMemoryResponse 是保存记忆响应。
type SaveMemoryResponse struct {
	MemoryID string `json:"memoryId"`
	Status   string `json:"status"`
}

// RecallMemoryItem 是召回记忆项。
type RecallMemoryItem struct {
	ID        string         `json:"id"`
	Content   string         `json:"content"`
	Type      string         `json:"type"`
	Score     float64        `json:"score"`
	CreatedAt string         `json:"createdAt"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

// RecallMemoryResponse 是 GET /v1/memory 响应体(召回记忆)。
type RecallMemoryResponse struct {
	Object string             `json:"object"`
	Data   []RecallMemoryItem `json:"data"`
}

// MemorySearchRequest 是 POST /v1/memory/search 请求体(语义搜索)。
type MemorySearchRequest struct {
	Query string `json:"query"`
	TopK  *int   `json:"topK,omitempty"`
	Type  string `json:"type,omitempty"`
}

// MemorySearchResponse 是 POST /v1/memory/search 响应体。
type MemorySearchResponse struct {
	Object string             `json:"object"`
	Data   []RecallMemoryItem `json:"data"`
}

// MemoryDreamRequest 是 POST /v1/memory/dream 请求体(Dream 梦境系统)。
type MemoryDreamRequest struct {
	Mode string `json:"mode,omitempty"`
}

// MemoryDreamResponse 是 POST /v1/memory/dream 响应体。
type MemoryDreamResponse struct {
	DreamID     string   `json:"dreamId"`
	Insights    []string `json:"insights"`
	NewMemories int      `json:"newMemories"`
}

// ForgetMemoryRequest 是 DELETE /v1/memory 请求体(遗忘记忆)。
type ForgetMemoryRequest struct {
	MemoryID string `json:"memoryId"`
}

// ForgetMemoryResponse 是遗忘记忆响应。
type ForgetMemoryResponse struct {
	MemoryID string `json:"memoryId"`
	Status   string `json:"status"`
}

// WorkingMemoryItem 是工作记忆项。
type WorkingMemoryItem struct {
	ID        string `json:"id"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

// WorkingMemoryResponse 是 GET /v1/memory/working 响应体。
type WorkingMemoryResponse struct {
	Items []WorkingMemoryItem `json:"items"`
}

// EpisodicMemoryItem 是情景记忆项。
type EpisodicMemoryItem struct {
	ID           string   `json:"id"`
	Summary      string   `json:"summary"`
	Timestamp    string   `json:"timestamp"`
	Participants []string `json:"participants"`
}

// EpisodicMemoryResponse 是 GET /v1/memory/episodic 响应体。
type EpisodicMemoryResponse struct {
	Episodes []EpisodicMemoryItem `json:"episodes"`
}

// ProceduralMemoryItem 是程序记忆项。
type ProceduralMemoryItem struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Steps       []string `json:"steps"`
	SuccessRate float64  `json:"successRate"`
}

// ProceduralMemoryResponse 是 GET /v1/memory/procedural 响应体。
type ProceduralMemoryResponse struct {
	Procedures []ProceduralMemoryItem `json:"procedures"`
}

// ============================================================================
// Messages 模型
// ============================================================================

// PublishMessageRequest 是 POST /v1/messages 请求体(消息发布)。
type PublishMessageRequest struct {
	Channel    string         `json:"channel"`
	Content    string         `json:"content"`
	Recipients []string       `json:"recipients,omitempty"`
	Metadata   map[string]any `json:"metadata,omitempty"`
}

// PublishMessageResponse 是 POST /v1/messages 响应体。
type PublishMessageResponse struct {
	MessageID       string `json:"messageId"`
	Status          string `json:"status"`
	SubscriberCount int    `json:"subscriberCount"`
}

// SubscribeMessageRequest 是 POST /v1/messages/subscribe 请求体。
type SubscribeMessageRequest struct {
	Channel     string `json:"channel"`
	CallbackURL string `json:"callbackUrl"`
}

// SubscribeMessageResponse 是 POST /v1/messages/subscribe 响应体。
type SubscribeMessageResponse struct {
	SubscriptionID string `json:"subscriptionId"`
	Status         string `json:"status"`
}

// UnsubscribeResponse 是 DELETE /v1/messages/subscribe/:id 响应体。
type UnsubscribeResponse struct {
	SubscriptionID string `json:"subscriptionId"`
	Status         string `json:"status"`
}

// MessageStatusResponse 是 GET /v1/messages/:id/status 响应体。
type MessageStatusResponse struct {
	MessageID      string `json:"messageId"`
	Status         string `json:"status"`
	DeliveredCount int    `json:"deliveredCount"`
	FailedCount    int    `json:"failedCount"`
}

// ============================================================================
// Files 模型
// ============================================================================

// FileListItem 是文件列表项。
type FileListItem struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	Filename  string `json:"filename"`
	Bytes     int64  `json:"bytes"`
	CreatedAt string `json:"createdAt"`
}

// FilesListResponse 是 GET /v1/files 响应体。
type FilesListResponse struct {
	Object string         `json:"object"`
	Data   []FileListItem `json:"data"`
}

// FileInfo 是 GET /v1/files/:id 响应体(文件详情)。
type FileInfo struct {
	ID        string `json:"id"`
	Object    string `json:"object"`
	Filename  string `json:"filename"`
	Bytes     int64  `json:"bytes"`
	MimeType  string `json:"mimeType"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// UploadInitRequest 是 POST /v1/files/upload-init 请求体(分片上传初始化)。
type UploadInitRequest struct {
	Filename  string `json:"filename"`
	Size      int64  `json:"size"`
	MimeType  string `json:"mimeType"`
	ChunkSize int    `json:"chunkSize"`
}

// UploadInitResponse 是 POST /v1/files/upload-init 响应体。
type UploadInitResponse struct {
	UploadID   string `json:"uploadId"`
	ChunkCount int    `json:"chunkCount"`
}

// UploadChunkRequest 是 POST /v1/files/upload-chunk 请求体。
type UploadChunkRequest struct {
	UploadID string `json:"uploadId"`
	Index    int    `json:"index"`
	Chunk    string `json:"chunk"`
}

// UploadCompleteRequest 是 POST /v1/files/complete 请求体。
type UploadCompleteRequest struct {
	UploadID string `json:"uploadId"`
}

// UploadCompleteResponse 是 POST /v1/files/complete 响应体。
type UploadCompleteResponse struct {
	FileID string `json:"fileId"`
	Status string `json:"status"`
}

// FileVersionItem 是文件版本项。
type FileVersionItem struct {
	Version   int    `json:"version"`
	Size      int64  `json:"size"`
	CreatedAt string `json:"createdAt"`
	Checksum  string `json:"checksum"`
}

// FileVersionsResponse 是 GET /v1/files/:id/versions 响应体。
type FileVersionsResponse struct {
	Object string            `json:"object"`
	Data   []FileVersionItem `json:"data"`
}

// ============================================================================
// User 模型
// ============================================================================

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

// UserModelConfig 是用户自定义模型配置。
type UserModelConfig struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Provider  string `json:"provider"`
	Model     string `json:"model"`
	APIKey    string `json:"apiKey"`
	BaseURL   string `json:"baseUrl,omitempty"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

// UserModelsResponse 是 GET /v1/user/models 响应体。
type UserModelsResponse struct {
	Object string            `json:"object"`
	Data   []UserModelConfig `json:"data"`
}

// CreateUserModelRequest 是 POST /v1/user/models 请求体。
type CreateUserModelRequest struct {
	Name     string `json:"name"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
	APIKey   string `json:"apiKey"`
	BaseURL  string `json:"baseUrl,omitempty"`
}