"""TypedDict 类型定义 — 对应 ``@ihui/types`` 的 v1-endpoints.ts + api-key.ts。

字段命名统一 camelCase(非 snake_case),与后端 JSON 契约一致。
所有 TypedDict 使用 ``total=False`` 以兼容 JSON 的可选字段语义;
类型注解仅用于 IDE 提示和 mypy 检查,运行时不强制。
"""

from __future__ import annotations

from typing import Any, Dict, List, TypedDict


# =============================================================================
# 通用类型
# =============================================================================

#: 任意 JSON 对象(透传上游响应)。
JsonObject = Dict[str, Any]


class ChatMessage(TypedDict, total=False):
    """聊天消息(OpenAI 兼容)。"""

    role: str  # 'system' | 'user' | 'assistant'
    content: str


# =============================================================================
# 1. AI 核心 - Chat / Embeddings / Models
# =============================================================================


class V1ChatCompletionRequest(TypedDict, total=False):
    model: str
    messages: List[ChatMessage]
    stream: bool
    temperature: float
    maxTokens: int


class V1ChatCompletionChoice(TypedDict, total=False):
    index: int
    message: ChatMessage
    finishReason: str  # 'stop' | 'length'


class V1ChatCompletionUsage(TypedDict, total=False):
    promptTokens: int
    completionTokens: int
    totalTokens: int


class V1ChatCompletionResponse(TypedDict, total=False):
    id: str
    object: str  # 'chat.completion'
    created: int
    model: str
    choices: List[V1ChatCompletionChoice]
    usage: V1ChatCompletionUsage


class V1ChatStreamDelta(TypedDict, total=False):
    role: str
    content: str


class V1ChatStreamChoice(TypedDict, total=False):
    index: int
    delta: V1ChatStreamDelta
    finishReason: str | None


class ChatStreamChunk(TypedDict, total=False):
    """chat.completions 流式 chunk(OpenAI 兼容)。"""

    id: str
    object: str  # 'chat.completion.chunk'
    created: int
    model: str
    choices: List[V1ChatStreamChoice]


class V1EmbeddingsRequest(TypedDict, total=False):
    model: str
    input: Any  # str | List[str]
    dimensions: int


class V1EmbeddingItem(TypedDict, total=False):
    object: str  # 'embedding'
    index: int
    embedding: List[float]


class V1EmbeddingsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1EmbeddingItem]
    model: str
    usage: V1ChatCompletionUsage


class V1ChatVisionRequest(TypedDict, total=False):
    model: str
    image: str
    prompt: str
    maxTokens: int


class V1ChatVisionResponse(TypedDict, total=False):
    description: str
    model: str
    usage: V1ChatCompletionUsage


class V1ChatMoaRequest(TypedDict, total=False):
    messages: List[ChatMessage]
    presetId: str
    stream: bool


class V1ChatMoaResponse(TypedDict, total=False):
    output: str
    presetId: str
    model: str
    usage: V1ChatCompletionUsage


class V1MoaPreset(TypedDict, total=False):
    id: str
    name: str
    models: List[str]
    strategy: str


class V1MoaPresetsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1MoaPreset]


class V1CreateMoaPresetRequest(TypedDict, total=False):
    name: str
    models: List[str]
    strategy: str


class V1ModelInfo(TypedDict, total=False):
    id: str
    object: str  # 'model'
    created: int
    ownedBy: str
    capabilities: List[str]
    contextWindow: int
    supportsStream: bool


class V1ModelsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1ModelInfo]


class V1VendorModelsResponse(TypedDict, total=False):
    vendor: str
    object: str  # 'list'
    data: List[V1ModelInfo]


class V1UserModelConfig(TypedDict, total=False):
    id: str
    name: str
    provider: str
    model: str
    apiKey: str
    baseUrl: str
    createdAt: str
    updatedAt: str


class V1UserModelsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1UserModelConfig]


class V1CreateUserModelRequest(TypedDict, total=False):
    name: str
    provider: str
    model: str
    apiKey: str
    baseUrl: str


# =============================================================================
# 2. AI 核心 - Agent
# =============================================================================


class V1AgentInfo(TypedDict, total=False):
    id: str
    name: str
    description: str
    capabilities: List[str]


class V1AgentsListResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1AgentInfo]


class V1AgentCallRequest(TypedDict, total=False):
    input: str
    sessionId: str


class V1AgentCallResponse(TypedDict, total=False):
    agentId: str
    sessionId: str
    output: str
    usage: V1ChatCompletionUsage


class V1AgentExecuteRequest(TypedDict, total=False):
    agentId: str
    input: str
    sessionId: str
    permissionMode: str
    maxIterations: int


class V1AgentExecuteResponse(TypedDict, total=False):
    taskId: str
    sessionId: str
    status: str  # 'running' | 'completed' | 'failed' | 'cancelled'
    output: str
    iterations: int
    usage: V1ChatCompletionUsage


class V1AgentTaskStatusResponse(TypedDict, total=False):
    taskId: str
    status: str
    progress: float
    result: str
    error: str
    createdAt: str
    updatedAt: str


class V1AgentSession(TypedDict, total=False):
    id: str
    agentId: str
    title: str
    messageCount: int
    lastMessageAt: str
    createdAt: str


class V1AgentSessionsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1AgentSession]


class V1AgentPipelineStep(TypedDict, total=False):
    agentId: str
    input: str
    dependsOn: List[int]


class V1AgentPipelineRequest(TypedDict, total=False):
    steps: List[V1AgentPipelineStep]


class V1AgentPipelineResult(TypedDict, total=False):
    stepIndex: int
    status: str  # 'completed' | 'failed'
    output: str


class V1AgentPipelineResponse(TypedDict, total=False):
    pipelineId: str
    results: List[V1AgentPipelineResult]


class V1AgentParallelTask(TypedDict, total=False):
    agentId: str
    input: str


class V1AgentParallelRequest(TypedDict, total=False):
    tasks: List[V1AgentParallelTask]


class V1AgentParallelResult(TypedDict, total=False):
    index: int
    status: str  # 'completed' | 'failed'
    output: str


class V1AgentParallelResponse(TypedDict, total=False):
    batchId: str
    results: List[V1AgentParallelResult]


class V1AgentDecomposeSubtask(TypedDict, total=False):
    id: str
    description: str
    dependsOn: List[str]


class V1AgentDecomposeResponse(TypedDict, total=False):
    taskId: str
    subtasks: List[V1AgentDecomposeSubtask]


class AgentStreamEvent(TypedDict, total=False):
    """Agent 执行流式事件。"""

    type: str  # 'data' | 'event' | 'raw'
    data: JsonObject


# =============================================================================
# 3. 多模态 - Audio
# =============================================================================


class V1AudioVoice(TypedDict, total=False):
    id: str
    name: str
    gender: str
    language: str
    preview: str


class V1AudioVoicesResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1AudioVoice]


class V1AudioSpeechRequest(TypedDict, total=False):
    model: str
    input: str
    voice: str
    responseFormat: str
    speed: float


class V1AudioSpeechResponse(TypedDict, total=False):
    audio: str
    format: str
    durationMs: int


class V1AudioTranscriptionsRequest(TypedDict, total=False):
    model: str
    audio: str
    language: str
    prompt: str


class V1AudioSegment(TypedDict, total=False):
    id: int
    start: float
    end: float
    text: str


class V1AudioTranscriptionsResponse(TypedDict, total=False):
    text: str
    language: str
    duration: float
    segments: List[V1AudioSegment]


class V1AudioChatRequest(TypedDict, total=False):
    audio: str
    model: str
    sessionId: str


class V1AudioChatResponse(TypedDict, total=False):
    text: str
    audio: str
    sessionId: str


class V1RegisterSpeakerRequest(TypedDict, total=False):
    name: str
    audio: str


class V1RegisterSpeakerResponse(TypedDict, total=False):
    speakerId: str
    status: str  # 'registered'


class V1Speaker(TypedDict, total=False):
    id: str
    name: str
    registeredAt: str


class V1SpeakersListResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1Speaker]


class V1CompareSpeakersRequest(TypedDict, total=False):
    speakerId: str
    audio: str


class V1CompareSpeakersResponse(TypedDict, total=False):
    score: float
    matched: bool


class V1MusicGenerationsRequest(TypedDict, total=False):
    prompt: str
    lyrics: str
    duration: float


class V1MusicGenerationsResponse(TypedDict, total=False):
    taskId: str
    status: str  # 'pending' | 'processing' | 'completed'


# =============================================================================
# 4. 多模态 - Images
# =============================================================================


class V1ImageData(TypedDict, total=False):
    url: str
    b64Json: str
    revisedPrompt: str


class V1ImageGenerationsRequest(TypedDict, total=False):
    model: str
    prompt: str
    n: int
    size: str
    quality: str
    style: str
    vendor: str


class V1ImageGenerationsResponse(TypedDict, total=False):
    created: int
    data: List[V1ImageData]


class V1ImageEditsRequest(TypedDict, total=False):
    model: str
    image: str
    prompt: str
    mask: str
    n: int
    size: str


class V1ImageInpaintRequest(TypedDict, total=False):
    model: str
    image: str
    mask: str
    prompt: str


class V1StyleTransferRequest(TypedDict, total=False):
    model: str
    image: str
    style: str


class V1VirtualTryOnRequest(TypedDict, total=False):
    model: str
    personImage: str
    garmentImage: str


class V1BackgroundGenerationRequest(TypedDict, total=False):
    model: str
    foreground: str
    prompt: str


# =============================================================================
# 5. 多模态 - Videos / 3D / Generation 队列
# =============================================================================


class V1VideoGenerationsRequest(TypedDict, total=False):
    model: str
    prompt: str
    image: str
    duration: float
    resolution: str
    vendor: str


class V1VideoGenerationsResponse(TypedDict, total=False):
    taskId: str
    status: str  # 'pending' | 'processing' | 'completed' | 'failed'
    estimatedTime: int


class V1VideoTaskResponse(TypedDict, total=False):
    taskId: str
    status: str
    videoUrl: str
    progress: float
    error: str
    createdAt: str


class V1VideoComposeScene(TypedDict, total=False):
    text: str
    duration: float
    imagePrompt: str


class V1VideoComposeRequest(TypedDict, total=False):
    scenes: List[V1VideoComposeScene]
    bgmUrl: str


class V1VideoComposeResponse(TypedDict, total=False):
    composeId: str
    status: str  # 'processing' | 'completed' | 'failed'


class V1ThreeDGenerationsRequest(TypedDict, total=False):
    model: str
    input: str
    format: str


class V1ThreeDGenerationsResponse(TypedDict, total=False):
    taskId: str
    status: str  # 'pending' | 'processing' | 'completed'


class V1GenerationEnqueueRequest(TypedDict, total=False):
    type: str
    payload: JsonObject
    priority: int


class V1GenerationEnqueueResponse(TypedDict, total=False):
    jobId: str
    status: str  # 'queued'
    position: int


class V1GenerationStatusResponse(TypedDict, total=False):
    jobId: str
    status: str  # 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
    result: Any
    error: str
    progress: float


class V1GenerationCancelResponse(TypedDict, total=False):
    jobId: str
    status: str  # 'cancelled'


# =============================================================================
# 6. 知识库 / RAG / 知识图谱
# =============================================================================


class V1KnowledgeDocument(TypedDict, total=False):
    id: str
    title: str
    source: str
    chunkCount: int
    sizeBytes: int
    createdAt: str
    updatedAt: str


class V1KnowledgeDocumentsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1KnowledgeDocument]


class V1KnowledgeDocumentDetail(TypedDict, total=False):
    id: str
    title: str
    source: str
    chunkCount: int
    sizeBytes: int
    createdAt: str
    updatedAt: str


class V1IngestDocumentRequest(TypedDict, total=False):
    title: str
    content: str
    source: str
    chunkStrategy: str  # 'fixed' | 'sentence' | 'paragraph'
    chunkSize: int
    chunkOverlap: int


class V1IngestDocumentResponse(TypedDict, total=False):
    documentId: str
    chunkCount: int
    status: str  # 'ingested'


class V1KnowledgeSearchRequest(TypedDict, total=False):
    query: str
    topK: int
    documentIds: List[str]
    threshold: float


class V1KnowledgeSearchResult(TypedDict, total=False):
    id: str
    documentId: str
    content: str
    score: float
    metadata: JsonObject


class V1KnowledgeSearchResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1KnowledgeSearchResult]


class V1RagContextRequest(TypedDict, total=False):
    query: str
    topK: int
    injectSystemPrompt: bool


class V1RagContextSource(TypedDict, total=False):
    documentId: str
    chunkId: str
    score: float


class V1RagContextResponse(TypedDict, total=False):
    context: str
    sources: List[V1RagContextSource]


class V1DocumentChunk(TypedDict, total=False):
    id: str
    content: str
    index: int
    metadata: JsonObject


class V1DocumentChunksResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1DocumentChunk]


class V1KnowledgeHealthResponse(TypedDict, total=False):
    status: str  # 'ok' | 'degraded'
    documents: int
    chunks: int


class V1BatchDeleteDocumentsRequest(TypedDict, total=False):
    documentIds: List[str]


class V1BatchDeleteDocumentsResponse(TypedDict, total=False):
    deleted: int


class V1KnowledgeGraphExtractRequest(TypedDict, total=False):
    text: str
    extractType: str  # 'entities' | 'relations' | 'both'


class V1GraphEntity(TypedDict, total=False):
    id: str
    name: str
    type: str
    properties: JsonObject


class V1GraphRelation(TypedDict, total=False):
    source: str
    target: str
    type: str
    properties: JsonObject


class V1KnowledgeGraphExtractResponse(TypedDict, total=False):
    entities: List[V1GraphEntity]
    relations: List[V1GraphRelation]


class V1KnowledgeGraphBuildRequest(TypedDict, total=False):
    source: str
    sourceType: str  # 'text' | 'document' | 'url'


class V1KnowledgeGraphBuildResponse(TypedDict, total=False):
    graphId: str
    nodes: int
    edges: int


class V1GraphNode(TypedDict, total=False):
    id: str
    label: str
    type: str


class V1GraphEdge(TypedDict, total=False):
    source: str
    target: str
    label: str


class V1KnowledgeGraphDataResponse(TypedDict, total=False):
    nodes: List[V1GraphNode]
    edges: List[V1GraphEdge]


# =============================================================================
# 7. MCP 工具 / 技能 / 人格
# =============================================================================


class V1Tool(TypedDict, total=False):
    name: str
    description: str
    inputSchema: JsonObject
    category: str


class V1ToolsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1Tool]


class V1ToolCallRequest(TypedDict, total=False):
    name: str
    arguments: JsonObject


class V1ToolCallResponse(TypedDict, total=False):
    toolName: str
    result: Any
    isError: bool


class V1Resource(TypedDict, total=False):
    uri: str
    name: str
    description: str
    mimeType: str


class V1ResourcesResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1Resource]


class V1ResourceDetail(TypedDict, total=False):
    uri: str
    name: str
    description: str
    mimeType: str
    content: str


class V1PromptArgument(TypedDict, total=False):
    name: str
    description: str
    required: bool


class V1Prompt(TypedDict, total=False):
    name: str
    description: str
    arguments: List[V1PromptArgument]


class V1PromptsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1Prompt]


class V1PromptInvokeRequest(TypedDict, total=False):
    name: str
    arguments: Dict[str, str]


class V1PromptInvokeMessage(TypedDict, total=False):
    role: str
    content: JsonObject  # {type, text}


class V1PromptInvokeResponse(TypedDict, total=False):
    messages: List[V1PromptInvokeMessage]


class V1Skill(TypedDict, total=False):
    name: str
    description: str
    version: str
    capabilities: List[str]


class V1SkillsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1Skill]


class V1SlashCommand(TypedDict, total=False):
    command: str
    description: str


class V1SlashCommandsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1SlashCommand]


class V1InvokeSlashCommandRequest(TypedDict, total=False):
    command: str
    args: Dict[str, str]


class V1InvokeSlashCommandResponse(TypedDict, total=False):
    output: str


class V1SamplingModelPreferences(TypedDict, total=False):
    hints: List[str]
    costPriority: float
    speedPriority: float
    intelligencePriority: float


class V1SamplingRequest(TypedDict, total=False):
    messages: List[ChatMessage]
    modelPreferences: V1SamplingModelPreferences
    maxTokens: int


class V1SamplingResponse(TypedDict, total=False):
    model: str
    role: str
    content: str
    stopReason: str


class V1Persona(TypedDict, total=False):
    name: str
    description: str
    systemPrompt: str
    traits: List[str]


class V1PersonasResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1Persona]


class V1PersonaDetail(TypedDict, total=False):
    name: str
    description: str
    systemPrompt: str
    traits: List[str]


class V1SearchCodebaseRequest(TypedDict, total=False):
    query: str
    directory: str


class V1SearchCodebaseResult(TypedDict, total=False):
    file: str
    line: int
    content: str
    score: float


class V1SearchCodebaseResponse(TypedDict, total=False):
    results: List[V1SearchCodebaseResult]


class V1SearchWebRequest(TypedDict, total=False):
    query: str
    num: int


class V1SearchWebResult(TypedDict, total=False):
    title: str
    url: str
    snippet: str


class V1SearchWebResponse(TypedDict, total=False):
    results: List[V1SearchWebResult]


class V1AnalyzeCodeRequest(TypedDict, total=False):
    code: str
    language: str
    analysis: str  # 'complexity' | 'security' | 'style' | 'all'


class V1AnalyzeCodeIssue(TypedDict, total=False):
    line: int
    column: int
    severity: str  # 'error' | 'warning' | 'info'
    message: str
    rule: str


class V1AnalyzeCodeMetrics(TypedDict, total=False):
    complexity: int
    maintainability: float


class V1AnalyzeCodeResponse(TypedDict, total=False):
    issues: List[V1AnalyzeCodeIssue]
    metrics: V1AnalyzeCodeMetrics


class V1ScreenshotRequest(TypedDict, total=False):
    url: str
    width: int
    height: int
    fullPage: bool


class V1ScreenshotResponse(TypedDict, total=False):
    image: str
    format: str
    width: int
    height: int


# =============================================================================
# 8. Memory / Messages
# =============================================================================


class V1SaveMemoryRequest(TypedDict, total=False):
    content: str
    type: str  # 'working' | 'episodic' | 'procedural' | 'semantic'
    metadata: JsonObject


class V1MemoryItem(TypedDict, total=False):
    id: str
    content: str
    type: str
    score: float
    createdAt: str
    metadata: JsonObject


class V1RecallMemoryResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1MemoryItem]


class V1MemorySearchRequest(TypedDict, total=False):
    query: str
    topK: int
    type: str


class V1MemorySearchResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1MemoryItem]


class V1MemoryDreamRequest(TypedDict, total=False):
    mode: str  # 'consolidate' | 'create' | 'analyze'


class V1MemoryDreamResponse(TypedDict, total=False):
    dreamId: str
    insights: List[str]
    newMemories: int


class V1ForgetMemoryRequest(TypedDict, total=False):
    memoryId: str


class V1ForgetMemoryResponse(TypedDict, total=False):
    memoryId: str
    status: str  # 'forgotten'


class V1SaveMemoryResponse(TypedDict, total=False):
    memoryId: str
    status: str  # 'saved'


class V1WorkingMemoryItem(TypedDict, total=False):
    id: str
    content: str
    createdAt: str


class V1WorkingMemoryResponse(TypedDict, total=False):
    items: List[V1WorkingMemoryItem]


class V1EpisodicMemoryEpisode(TypedDict, total=False):
    id: str
    summary: str
    timestamp: str
    participants: List[str]


class V1EpisodicMemoryResponse(TypedDict, total=False):
    episodes: List[V1EpisodicMemoryEpisode]


class V1ProceduralMemoryProcedure(TypedDict, total=False):
    id: str
    name: str
    steps: List[str]
    successRate: float


class V1ProceduralMemoryResponse(TypedDict, total=False):
    procedures: List[V1ProceduralMemoryProcedure]


class V1PublishMessageRequest(TypedDict, total=False):
    channel: str
    content: str
    recipients: List[str]
    metadata: JsonObject


class V1PublishMessageResponse(TypedDict, total=False):
    messageId: str
    status: str  # 'published'
    subscriberCount: int


class V1SubscribeMessageRequest(TypedDict, total=False):
    channel: str
    callbackUrl: str


class V1SubscribeMessageResponse(TypedDict, total=False):
    subscriptionId: str
    status: str  # 'subscribed'


class V1UnsubscribeResponse(TypedDict, total=False):
    subscriptionId: str
    status: str  # 'unsubscribed'


class V1MessageStatusResponse(TypedDict, total=False):
    messageId: str
    status: str  # 'pending' | 'delivered' | 'failed'
    deliveredCount: int
    failedCount: int


# =============================================================================
# 9. Files / User / Workspace / Workflows / Stats
# =============================================================================


class V1FileInfo(TypedDict, total=False):
    id: str
    object: str  # 'file'
    filename: str
    bytes: int
    mimeType: str
    createdAt: str
    updatedAt: str


class V1FilesListResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1FileInfo]


class V1FileVersion(TypedDict, total=False):
    version: int
    size: int
    createdAt: str
    checksum: str


class V1FileVersionsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1FileVersion]


class V1UploadInitRequest(TypedDict, total=False):
    filename: str
    size: int
    mimeType: str
    chunkSize: int


class V1UploadInitResponse(TypedDict, total=False):
    uploadId: str
    chunkCount: int


class V1UploadChunkRequest(TypedDict, total=False):
    uploadId: str
    index: int
    chunk: str  # base64


class V1UploadCompleteRequest(TypedDict, total=False):
    uploadId: str


class V1UploadCompleteResponse(TypedDict, total=False):
    fileId: str
    status: str  # 'completed'


class V1UserQuota(TypedDict, total=False):
    hourlyUsed: int
    hourlyLimit: int
    dailyUsed: int
    dailyLimit: int
    resetAt: str


class V1UserInfo(TypedDict, total=False):
    id: str
    username: str
    email: str
    avatar: str
    createdAt: str
    quota: V1UserQuota


class V1Project(TypedDict, total=False):
    id: str
    name: str
    description: str
    fileCount: int
    createdAt: str
    updatedAt: str


class V1ProjectsResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1Project]


class V1ProjectFilesResponse(TypedDict, total=False):
    object: str  # 'list'
    data: List[V1FileInfo]


class V1WorkflowStep(TypedDict, total=False):
    id: str
    name: str
    type: str
    config: JsonObject


class V1WorkflowInfo(TypedDict, total=False):
    id: str
    name: str
    description: str
    steps: List[V1WorkflowStep]
    createdAt: str


class V1RunWorkflowRequest(TypedDict, total=False):
    workflowId: str
    inputs: JsonObject


class V1RunWorkflowResponse(TypedDict, total=False):
    instanceId: str
    status: str  # 'running' | 'completed' | 'failed'
    outputs: JsonObject


class V1RunCozeWorkflowRequest(TypedDict, total=False):
    workflowId: str
    parameters: JsonObject


class V1RunN8nWorkflowRequest(TypedDict, total=False):
    workflowId: str
    data: JsonObject


#: Coze/n8n 工作流运行响应(透传上游)。
V1RunCozeWorkflowResponse = JsonObject
V1RunN8nWorkflowResponse = JsonObject


class V1UsageResponse(TypedDict, total=False):
    apiKeyId: str
    period: str
    totalRequests: int
    byCategory: Dict[str, int]
    byModel: Dict[str, int]
    tokensUsed: int


class V1VendorUsageResponse(TypedDict, total=False):
    vendor: str
    requests: int
    tokens: int
    cost: float


__all__ = [
    # 通用
    "JsonObject",
    "ChatMessage",
    # AI 核心
    "V1ChatCompletionRequest",
    "V1ChatCompletionResponse",
    "ChatStreamChunk",
    "V1EmbeddingsRequest",
    "V1EmbeddingsResponse",
    "V1ChatVisionRequest",
    "V1ChatVisionResponse",
    "V1ChatMoaRequest",
    "V1ChatMoaResponse",
    "V1MoaPresetsResponse",
    "V1CreateMoaPresetRequest",
    "V1ModelInfo",
    "V1ModelsResponse",
    "V1VendorModelsResponse",
    "V1UserModelConfig",
    "V1UserModelsResponse",
    "V1CreateUserModelRequest",
    # Agents
    "V1AgentInfo",
    "V1AgentsListResponse",
    "V1AgentCallRequest",
    "V1AgentCallResponse",
    "V1AgentExecuteRequest",
    "V1AgentExecuteResponse",
    "V1AgentTaskStatusResponse",
    "V1AgentSessionsResponse",
    "V1AgentPipelineRequest",
    "V1AgentPipelineResponse",
    "V1AgentParallelRequest",
    "V1AgentParallelResponse",
    "V1AgentDecomposeResponse",
    "AgentStreamEvent",
    # Audio
    "V1AudioVoicesResponse",
    "V1AudioSpeechRequest",
    "V1AudioSpeechResponse",
    "V1AudioTranscriptionsRequest",
    "V1AudioTranscriptionsResponse",
    "V1AudioChatRequest",
    "V1AudioChatResponse",
    "V1RegisterSpeakerRequest",
    "V1RegisterSpeakerResponse",
    "V1SpeakersListResponse",
    "V1CompareSpeakersRequest",
    "V1CompareSpeakersResponse",
    "V1MusicGenerationsRequest",
    "V1MusicGenerationsResponse",
    # Images
    "V1ImageGenerationsRequest",
    "V1ImageGenerationsResponse",
    "V1ImageEditsRequest",
    "V1ImageInpaintRequest",
    "V1StyleTransferRequest",
    "V1VirtualTryOnRequest",
    "V1BackgroundGenerationRequest",
    # Videos / 3D / Generation
    "V1VideoGenerationsRequest",
    "V1VideoGenerationsResponse",
    "V1VideoTaskResponse",
    "V1VideoComposeRequest",
    "V1VideoComposeResponse",
    "V1ThreeDGenerationsRequest",
    "V1ThreeDGenerationsResponse",
    "V1GenerationEnqueueRequest",
    "V1GenerationEnqueueResponse",
    "V1GenerationStatusResponse",
    "V1GenerationCancelResponse",
    # Knowledge
    "V1KnowledgeDocumentsResponse",
    "V1KnowledgeDocumentDetail",
    "V1IngestDocumentRequest",
    "V1IngestDocumentResponse",
    "V1KnowledgeSearchRequest",
    "V1KnowledgeSearchResponse",
    "V1RagContextRequest",
    "V1RagContextResponse",
    "V1DocumentChunksResponse",
    "V1KnowledgeHealthResponse",
    "V1BatchDeleteDocumentsRequest",
    "V1BatchDeleteDocumentsResponse",
    "V1KnowledgeGraphExtractRequest",
    "V1KnowledgeGraphExtractResponse",
    "V1KnowledgeGraphBuildRequest",
    "V1KnowledgeGraphBuildResponse",
    "V1KnowledgeGraphDataResponse",
    # Tools
    "V1ToolsResponse",
    "V1ToolCallRequest",
    "V1ToolCallResponse",
    "V1ResourcesResponse",
    "V1ResourceDetail",
    "V1PromptsResponse",
    "V1PromptInvokeRequest",
    "V1PromptInvokeResponse",
    "V1SkillsResponse",
    "V1SlashCommandsResponse",
    "V1InvokeSlashCommandRequest",
    "V1InvokeSlashCommandResponse",
    "V1SamplingRequest",
    "V1SamplingResponse",
    "V1PersonasResponse",
    "V1PersonaDetail",
    "V1SearchCodebaseRequest",
    "V1SearchCodebaseResponse",
    "V1SearchWebRequest",
    "V1SearchWebResponse",
    "V1AnalyzeCodeRequest",
    "V1AnalyzeCodeResponse",
    "V1ScreenshotRequest",
    "V1ScreenshotResponse",
    # Memory / Messages
    "V1SaveMemoryRequest",
    "V1SaveMemoryResponse",
    "V1RecallMemoryResponse",
    "V1MemorySearchRequest",
    "V1MemorySearchResponse",
    "V1MemoryDreamRequest",
    "V1MemoryDreamResponse",
    "V1ForgetMemoryRequest",
    "V1ForgetMemoryResponse",
    "V1WorkingMemoryResponse",
    "V1EpisodicMemoryResponse",
    "V1ProceduralMemoryResponse",
    "V1PublishMessageRequest",
    "V1PublishMessageResponse",
    "V1SubscribeMessageRequest",
    "V1SubscribeMessageResponse",
    "V1UnsubscribeResponse",
    "V1MessageStatusResponse",
    # Files / User
    "V1FileInfo",
    "V1FilesListResponse",
    "V1FileVersionsResponse",
    "V1UploadInitRequest",
    "V1UploadInitResponse",
    "V1UploadChunkRequest",
    "V1UploadCompleteRequest",
    "V1UploadCompleteResponse",
    "V1UserInfo",
    "V1ProjectsResponse",
    "V1ProjectFilesResponse",
    "V1WorkflowInfo",
    "V1RunWorkflowRequest",
    "V1RunWorkflowResponse",
    "V1RunCozeWorkflowRequest",
    "V1RunCozeWorkflowResponse",
    "V1RunN8nWorkflowRequest",
    "V1RunN8nWorkflowResponse",
    "V1UsageResponse",
    "V1VendorUsageResponse",
]
