/**
 * /v1/* 对外开放 API 端点请求/响应类型契约(2026-07-22 立)。
 *
 * 配套 api-key.ts 的 27 个权限点,覆盖全功能对外开放。
 * 字段命名统一 camelCase(非 OpenAI snake_case),与 @ihui/types 契约一致。
 *
 * 端点分组(与后端路由文件对应):
 * - AI 核心:chat / embeddings / models / agents 高级执行
 * - 多模态:audio / images / videos / 3d / generation
 * - 知识工具:knowledge / tools / memory / messages
 * - 资源管理:files 补齐 / user / workspace / workflows / stats
 */

// =============================================================================
// 1. AI 核心 - Chat / Embeddings / Models
// =============================================================================

/** POST /v1/embeddings 请求体(OpenAI 兼容)。 */
export interface V1EmbeddingsRequest {
  model: string
  input: string | string[]
  /** 输出维度(部分模型支持)。 */
  dimensions?: number
}

/** POST /v1/embeddings 响应体(OpenAI 兼容)。 */
export interface V1EmbeddingsResponse {
  object: 'list'
  data: Array<{
    object: 'embedding'
    index: number
    embedding: number[]
  }>
  model: string
  usage: { promptTokens: number; totalTokens: number }
}

/** POST /v1/chat/vision 请求体(视觉理解)。 */
export interface V1ChatVisionRequest {
  model: string
  /** base64 编码的图片或图片 URL。 */
  image: string
  prompt: string
  maxTokens?: number
}

/** POST /v1/chat/vision 响应体。 */
export interface V1ChatVisionResponse {
  description: string
  model: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
}

/** POST /v1/chat/moa 请求体(Mixture of Agents)。 */
export interface V1ChatMoaRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  presetId?: string
  stream?: boolean
}

/** POST /v1/chat/moa 响应体。 */
export interface V1ChatMoaResponse {
  output: string
  presetId: string
  model: string
  usage: { totalTokens: number }
}

/** GET /v1/moa-presets 响应体。 */
export interface V1MoaPresetsResponse {
  object: 'list'
  data: Array<{
    id: string
    name: string
    models: string[]
    strategy: string
  }>
}

/** POST /v1/moa-presets 请求体。 */
export interface V1CreateMoaPresetRequest {
  name: string
  models: string[]
  strategy: string
}

/** GET /v1/models/:id 响应体。 */
export interface V1ModelInfo {
  id: string
  object: 'model'
  created: number
  ownedBy: string
  /** 模型能力标签。 */
  capabilities: string[]
  /** 上下文窗口大小。 */
  contextWindow?: number
  /** 是否支持流式。 */
  supportsStream?: boolean
}

/** GET /v1/vendors/:vendor/models 响应体。 */
export interface V1VendorModelsResponse {
  vendor: string
  object: 'list'
  data: Array<{ id: string; object: 'model' }>
}

/** 用户自定义模型配置。 */
export interface V1UserModelConfig {
  id: string
  name: string
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
  createdAt: string
  updatedAt: string
}

/** GET /v1/user/models 响应体。 */
export interface V1UserModelsResponse {
  object: 'list'
  data: V1UserModelConfig[]
}

/** POST /v1/user/models 请求体。 */
export interface V1CreateUserModelRequest {
  name: string
  provider: string
  model: string
  apiKey: string
  baseUrl?: string
}

// =============================================================================
// 2. AI 核心 - Agent 高级执行
// =============================================================================

/** POST /v1/agents/execute 请求体(高级执行,支持 PermissionGuard)。 */
export interface V1AgentExecuteRequest {
  agentId: string
  input: string
  sessionId?: string
  /** 权限模式:read-only / accept-edits / accept-all / bypass-permissions / plan-only。 */
  permissionMode?: string
  /** 最大迭代轮数。 */
  maxIterations?: number
}

/** POST /v1/agents/execute 响应体。 */
export interface V1AgentExecuteResponse {
  taskId: string
  sessionId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  output: string
  iterations: number
  usage: { totalTokens: number }
}

/** GET /v1/agents/tasks/:id/status 响应体。 */
export interface V1AgentTaskStatusResponse {
  taskId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  result?: string
  error?: string
  createdAt: string
  updatedAt: string
}

/** GET /v1/agents/sessions 响应体。 */
export interface V1AgentSessionsResponse {
  object: 'list'
  data: Array<{
    id: string
    agentId: string
    title: string
    messageCount: number
    lastMessageAt: string
    createdAt: string
  }>
}

/** POST /v1/agents/pipeline 请求体(Pipeline 编排)。 */
export interface V1AgentPipelineRequest {
  steps: Array<{
    agentId: string
    input: string
    /** 依赖的前置步骤索引。 */
    dependsOn?: number[]
  }>
}

/** POST /v1/agents/pipeline 响应体。 */
export interface V1AgentPipelineResponse {
  pipelineId: string
  results: Array<{
    stepIndex: number
    status: 'completed' | 'failed'
    output: string
  }>
}

/** POST /v1/agents/parallel 请求体(并行执行)。 */
export interface V1AgentParallelRequest {
  tasks: Array<{
    agentId: string
    input: string
  }>
}

/** POST /v1/agents/parallel 响应体。 */
export interface V1AgentParallelResponse {
  batchId: string
  results: Array<{
    index: number
    status: 'completed' | 'failed'
    output: string
  }>
}

// =============================================================================
// 3. 多模态 - Audio
// =============================================================================

/** POST /v1/audio/speech 请求体(TTS)。 */
export interface V1AudioSpeechRequest {
  model: string
  input: string
  voice: string
  /** 输出格式:mp3 / wav / flac。 */
  responseFormat?: string
  speed?: number
}

/** POST /v1/audio/speech 响应体(二进制音频流,base64 编码)。 */
export interface V1AudioSpeechResponse {
  audio: string
  format: string
  durationMs: number
}

/** POST /v1/audio/transcriptions 请求体(ASR)。 */
export interface V1AudioTranscriptionsRequest {
  model: string
  /** base64 编码的音频。 */
  audio: string
  language?: string
  prompt?: string
}

/** POST /v1/audio/transcriptions 响应体。 */
export interface V1AudioTranscriptionsResponse {
  text: string
  language: string
  duration: number
  segments?: Array<{
    id: number
    start: number
    end: number
    text: string
  }>
}

/** GET /v1/audio/voices 响应体。 */
export interface V1AudioVoicesResponse {
  object: 'list'
  data: Array<{
    id: string
    name: string
    gender: string
    language: string
    preview?: string
  }>
}

/** POST /v1/audio/chat 请求体(语音对话)。 */
export interface V1AudioChatRequest {
  audio: string
  model: string
  sessionId?: string
}

/** POST /v1/audio/chat 响应体。 */
export interface V1AudioChatResponse {
  text: string
  audio: string
  sessionId: string
}

/** POST /v1/audio/speakers 请求体(声纹注册)。 */
export interface V1RegisterSpeakerRequest {
  name: string
  audio: string
}

/** POST /v1/audio/speakers/compare 请求体(声纹比对)。 */
export interface V1CompareSpeakersRequest {
  speakerId: string
  audio: string
}

/** POST /v1/audio/speakers/compare 响应体。 */
export interface V1CompareSpeakersResponse {
  score: number
  matched: boolean
}

// =============================================================================
// 4. 多模态 - Images
// =============================================================================

/** POST /v1/images/generations 请求体(文生图)。 */
export interface V1ImageGenerationsRequest {
  model: string
  prompt: string
  n?: number
  size?: string
  quality?: string
  style?: string
  /** 厂商:dashscope / doubao / gemini / tongyi。 */
  vendor?: string
}

/** POST /v1/images/generations 响应体(OpenAI 兼容)。 */
export interface V1ImageGenerationsResponse {
  created: number
  data: Array<{
    url?: string
    b64Json?: string
    revisedPrompt?: string
  }>
}

/** POST /v1/images/edits 请求体(图片编辑)。 */
export interface V1ImageEditsRequest {
  model: string
  /** base64 原图。 */
  image: string
  prompt: string
  /** base64 蒙版(可选)。 */
  mask?: string
  n?: number
  size?: string
}

/** POST /v1/images/inpaint 请求体(图片修复)。 */
export interface V1ImageInpaintRequest {
  model: string
  image: string
  mask: string
  prompt: string
}

/** POST /v1/images/style-transfer 请求体(风格迁移)。 */
export interface V1StyleTransferRequest {
  model: string
  image: string
  style: string
}

/** POST /v1/images/virtual-try-on 请求体(虚拟试穿)。 */
export interface V1VirtualTryOnRequest {
  model: string
  /** 人物图。 */
  personImage: string
  /** 服装图。 */
  garmentImage: string
}

/** POST /v1/images/background 请求体(背景生成)。 */
export interface V1BackgroundGenerationRequest {
  model: string
  /** 前景图。 */
  foreground: string
  prompt: string
}

// =============================================================================
// 5. 多模态 - Videos / 3D / Generation 队列
// =============================================================================

/** POST /v1/videos/generations 请求体(视频生成)。 */
export interface V1VideoGenerationsRequest {
  model: string
  prompt: string
  /** 可选起始图片(base64)。 */
  image?: string
  duration?: number
  resolution?: string
  vendor?: string
}

/** POST /v1/videos/generations 响应体(异步任务)。 */
export interface V1VideoGenerationsResponse {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  estimatedTime?: number
}

/** GET /v1/videos/tasks/:id 响应体。 */
export interface V1VideoTaskResponse {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  videoUrl?: string
  progress?: number
  error?: string
  createdAt: string
}

/** POST /v1/videos/compose 请求体(视频编排)。 */
export interface V1VideoComposeRequest {
  /** 分镜列表。 */
  scenes: Array<{
    text: string
    duration: number
    imagePrompt?: string
  }>
  /** 背景音乐 URL。 */
  bgmUrl?: string
}

/** POST /v1/videos/compose 响应体。 */
export interface V1VideoComposeResponse {
  composeId: string
  status: 'processing' | 'completed' | 'failed'
}

/** POST /v1/audio/music 请求体(音乐生成)。 */
export interface V1MusicGenerationsRequest {
  prompt: string
  /** 歌词(可选)。 */
  lyrics?: string
  duration?: number
}

/** POST /v1/audio/music 响应体。 */
export interface V1MusicGenerationsResponse {
  taskId: string
  status: 'pending' | 'processing' | 'completed'
}

/** POST /v1/3d/generations 请求体(3D 生成)。 */
export interface V1ThreeDGenerationsRequest {
  model: string
  /** 输入图片 base64 或文本提示。 */
  input: string
  format?: string
}

/** POST /v1/3d/generations 响应体。 */
export interface V1ThreeDGenerationsResponse {
  taskId: string
  status: 'pending' | 'processing' | 'completed'
}

/** POST /v1/generation/enqueue 请求体(生成队列入队)。 */
export interface V1GenerationEnqueueRequest {
  type: string
  payload: Record<string, unknown>
  priority?: number
}

/** POST /v1/generation/enqueue 响应体。 */
export interface V1GenerationEnqueueResponse {
  jobId: string
  status: 'queued'
  position: number
}

/** GET /v1/generation/status/:id 响应体。 */
export interface V1GenerationStatusResponse {
  jobId: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  result?: unknown
  error?: string
  progress?: number
}

// =============================================================================
// 6. 知识库 / RAG
// =============================================================================

/** GET /v1/knowledge/documents 响应体。 */
export interface V1KnowledgeDocumentsResponse {
  object: 'list'
  data: Array<{
    id: string
    title: string
    source: string
    chunkCount: number
    sizeBytes: number
    createdAt: string
  }>
}

/** POST /v1/knowledge/documents 请求体(文档入库)。 */
export interface V1IngestDocumentRequest {
  title: string
  content: string
  source?: string
  /** 分块策略:fixed / sentence / paragraph。 */
  chunkStrategy?: string
  chunkSize?: number
  chunkOverlap?: number
}

/** POST /v1/knowledge/documents 响应体。 */
export interface V1IngestDocumentResponse {
  documentId: string
  chunkCount: number
  status: 'ingested'
}

/** POST /v1/knowledge/search 请求体(语义搜索)。 */
export interface V1KnowledgeSearchRequest {
  query: string
  topK?: number
  /** 过滤文档 ID 列表。 */
  documentIds?: string[]
  /** 相似度阈值(0-1)。 */
  threshold?: number
}

/** POST /v1/knowledge/search 响应体。 */
export interface V1KnowledgeSearchResponse {
  object: 'list'
  data: Array<{
    id: string
    documentId: string
    content: string
    score: number
    metadata?: Record<string, unknown>
  }>
}

/** POST /v1/knowledge/rag-context 请求体(RAG 上下文检索)。 */
export interface V1RagContextRequest {
  query: string
  topK?: number
  /** 是否注入系统提示。 */
  injectSystemPrompt?: boolean
}

/** POST /v1/knowledge/rag-context 响应体。 */
export interface V1RagContextResponse {
  context: string
  sources: Array<{
    documentId: string
    chunkId: string
    score: number
  }>
}

/** GET /v1/knowledge/documents/:id/chunks 响应体。 */
export interface V1DocumentChunksResponse {
  object: 'list'
  data: Array<{
    id: string
    content: string
    index: number
    metadata?: Record<string, unknown>
  }>
}

/** POST /v1/knowledge-graph/extract 请求体(知识图谱抽取)。 */
export interface V1KnowledgeGraphExtractRequest {
  text: string
  /** 抽取类型:entities / relations / both。 */
  extractType?: string
}

/** POST /v1/knowledge-graph/extract 响应体。 */
export interface V1KnowledgeGraphExtractResponse {
  entities: Array<{
    id: string
    name: string
    type: string
    properties?: Record<string, unknown>
  }>
  relations: Array<{
    source: string
    target: string
    type: string
    properties?: Record<string, unknown>
  }>
}

/** GET /v1/knowledge-graph/data 响应体。 */
export interface V1KnowledgeGraphDataResponse {
  nodes: Array<{ id: string; label: string; type: string }>
  edges: Array<{ source: string; target: string; label: string }>
}

// =============================================================================
// 7. MCP 工具 / 技能 / 人格
// =============================================================================

/** GET /v1/tools 响应体(MCP 工具列表)。 */
export interface V1ToolsResponse {
  object: 'list'
  data: Array<{
    name: string
    description: string
    inputSchema: Record<string, unknown>
    category?: string
  }>
}

/** POST /v1/tools/call 请求体。 */
export interface V1ToolCallRequest {
  name: string
  arguments: Record<string, unknown>
}

/** POST /v1/tools/call 响应体。 */
export interface V1ToolCallResponse {
  toolName: string
  result: unknown
  isError: boolean
}

/** GET /v1/resources 响应体(MCP 资源)。 */
export interface V1ResourcesResponse {
  object: 'list'
  data: Array<{
    uri: string
    name: string
    description?: string
    mimeType?: string
  }>
}

/** GET /v1/prompts 响应体(MCP 提示词)。 */
export interface V1PromptsResponse {
  object: 'list'
  data: Array<{
    name: string
    description: string
    arguments?: Array<{ name: string; description: string; required: boolean }>
  }>
}

/** POST /v1/prompts/invoke 请求体。 */
export interface V1PromptInvokeRequest {
  name: string
  arguments?: Record<string, string>
}

/** POST /v1/prompts/invoke 响应体。 */
export interface V1PromptInvokeResponse {
  messages: Array<{
    role: string
    content: { type: string; text: string }
  }>
}

/** GET /v1/skills 响应体。 */
export interface V1SkillsResponse {
  object: 'list'
  data: Array<{
    name: string
    description: string
    version: string
    capabilities: string[]
  }>
}

/** GET /v1/slash-commands 响应体。 */
export interface V1SlashCommandsResponse {
  object: 'list'
  data: Array<{
    command: string
    description: string
  }>
}

/** POST /v1/sampling 请求体。 */
export interface V1SamplingRequest {
  messages: Array<{ role: string; content: string }>
  modelPreferences?: {
    hints?: string[]
    costPriority?: number
    speedPriority?: number
    intelligencePriority?: number
  }
  maxTokens: number
}

/** POST /v1/sampling 响应体。 */
export interface V1SamplingResponse {
  model: string
  role: string
  content: string
  stopReason: string
}

/** GET /v1/personas 响应体。 */
export interface V1PersonasResponse {
  object: 'list'
  data: Array<{
    name: string
    description: string
    systemPrompt: string
    traits: string[]
  }>
}

/** POST /v1/tools/search-codebase 请求体。 */
export interface V1SearchCodebaseRequest {
  query: string
  directory?: string
}

/** POST /v1/tools/search-web 请求体。 */
export interface V1SearchWebRequest {
  query: string
  num?: number
}

/** POST /v1/screenshot 请求体。 */
export interface V1ScreenshotRequest {
  url: string
  width?: number
  height?: number
  fullPage?: boolean
}

/** POST /v1/screenshot 响应体。 */
export interface V1ScreenshotResponse {
  image: string
  format: string
  width: number
  height: number
}

// =============================================================================
// 8. Memory / Messages
// =============================================================================

/** POST /v1/memory 请求体(保存记忆)。 */
export interface V1SaveMemoryRequest {
  content: string
  /** 记忆类型:working / episodic / procedural / semantic。 */
  type?: string
  metadata?: Record<string, unknown>
}

/** GET /v1/memory 响应体(召回记忆)。 */
export interface V1RecallMemoryResponse {
  object: 'list'
  data: Array<{
    id: string
    content: string
    type: string
    score: number
    createdAt: string
    metadata?: Record<string, unknown>
  }>
}

/** POST /v1/memory/search 请求体(语义搜索)。 */
export interface V1MemorySearchRequest {
  query: string
  topK?: number
  type?: string
}

/** POST /v1/memory/dream 请求体(Dream 梦境系统)。 */
export interface V1MemoryDreamRequest {
  /** Dream 模式:consolidate / create / analyze。 */
  mode?: string
}

/** POST /v1/memory/dream 响应体。 */
export interface V1MemoryDreamResponse {
  dreamId: string
  insights: string[]
  newMemories: number
}

/** GET /v1/memory/working 响应体。 */
export interface V1WorkingMemoryResponse {
  items: Array<{ id: string; content: string; createdAt: string }>
}

/** GET /v1/memory/episodic 响应体。 */
export interface V1EpisodicMemoryResponse {
  episodes: Array<{
    id: string
    summary: string
    timestamp: string
    participants: string[]
  }>
}

/** GET /v1/memory/procedural 响应体。 */
export interface V1ProceduralMemoryResponse {
  procedures: Array<{
    id: string
    name: string
    steps: string[]
    successRate: number
  }>
}

/** POST /v1/messages 请求体(消息发布)。 */
export interface V1PublishMessageRequest {
  channel: string
  content: string
  /** 目标接收者(可选,空则广播)。 */
  recipients?: string[]
  metadata?: Record<string, unknown>
}

/** POST /v1/messages 响应体。 */
export interface V1PublishMessageResponse {
  messageId: string
  status: 'published'
  subscriberCount: number
}

/** POST /v1/messages/subscribe 请求体。 */
export interface V1SubscribeMessageRequest {
  channel: string
  /** Webhook 回调 URL。 */
  callbackUrl: string
}

/** POST /v1/messages/subscribe 响应体。 */
export interface V1SubscribeMessageResponse {
  subscriptionId: string
  status: 'subscribed'
}

/** GET /v1/messages/:id/status 响应体。 */
export interface V1MessageStatusResponse {
  messageId: string
  status: 'pending' | 'delivered' | 'failed'
  deliveredCount: number
  failedCount: number
}

// =============================================================================
// 9. Files 补齐 / User / Workspace / Workflows / Stats
// =============================================================================

/** GET /v1/files/:id 响应体。 */
export interface V1FileInfo {
  id: string
  object: 'file'
  filename: string
  bytes: number
  mimeType: string
  createdAt: string
  updatedAt: string
}

/** GET /v1/files/:id/content 响应体(二进制流,Content-Type 由后端设置)。 */

/** POST /v1/files/upload-init 请求体(分片上传初始化)。 */
export interface V1UploadInitRequest {
  filename: string
  size: number
  mimeType: string
  /** 分片大小(字节)。 */
  chunkSize: number
}

/** POST /v1/files/upload-init 响应体。 */
export interface V1UploadInitResponse {
  uploadId: string
  chunkCount: number
}

/** POST /v1/files/upload-chunk 请求体。 */
export interface V1UploadChunkRequest {
  uploadId: string
  index: number
  /** base64 分片数据。 */
  chunk: string
}

/** POST /v1/files/complete 请求体。 */
export interface V1UploadCompleteRequest {
  uploadId: string
}

/** GET /v1/files/:id/versions 响应体。 */
export interface V1FileVersionsResponse {
  object: 'list'
  data: Array<{
    version: number
    size: number
    createdAt: string
    checksum: string
  }>
}

/** GET /v1/me 响应体。 */
export interface V1UserInfo {
  id: string
  username: string
  email: string
  avatar?: string
  createdAt: string
  /** API Key 配额信息。 */
  quota: {
    hourlyUsed: number
    hourlyLimit: number
    dailyUsed: number
    dailyLimit: number
    resetAt: string
  }
}

/** GET /v1/projects 响应体。 */
export interface V1ProjectsResponse {
  object: 'list'
  data: Array<{
    id: string
    name: string
    description?: string
    fileCount: number
    createdAt: string
    updatedAt: string
  }>
}

/** GET /v1/projects/:id/files 响应体。 */
export interface V1ProjectFilesResponse {
  object: 'list'
  data: V1FileInfo[]
}

/** GET /v1/workflows/:id 响应体。 */
export interface V1WorkflowInfo {
  id: string
  name: string
  description?: string
  steps: Array<{
    id: string
    name: string
    type: string
    config?: Record<string, unknown>
  }>
  createdAt: string
}

/** POST /v1/workflows/instances 请求体。 */
export interface V1RunWorkflowRequest {
  workflowId: string
  inputs?: Record<string, unknown>
}

/** POST /v1/workflows/instances 响应体。 */
export interface V1RunWorkflowResponse {
  instanceId: string
  status: 'running' | 'completed' | 'failed'
  outputs?: Record<string, unknown>
}

/** POST /v1/workflows/coze/run 请求体。 */
export interface V1RunCozeWorkflowRequest {
  workflowId: string
  parameters: Record<string, unknown>
}

/** POST /v1/workflows/n8n/run 请求体。 */
export interface V1RunN8nWorkflowRequest {
  workflowId: string
  data?: Record<string, unknown>
}

/** GET /v1/usage 响应体。 */
export interface V1UsageResponse {
  apiKeyId: string
  period: string
  totalRequests: number
  byCategory: Record<string, number>
  byModel: Record<string, number>
  tokensUsed: number
}

/** GET /v1/usage/:vendor 响应体。 */
export interface V1VendorUsageResponse {
  vendor: string
  requests: number
  tokens: number
  cost: number
}
