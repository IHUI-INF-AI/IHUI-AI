<script setup lang="ts">
/**
 * AI 能力选择器组件
 * @description 统一的 AI 能力选择面板，支持模型、智能体、Agentic、MCP工具、生成等多种能力选择
 * @example
 * ```vue
 * <AICapabilitySelector
 *   v-model="showPanel"
 *   v-model:currentMode="currentMode"
 *   :models="modelList"
 *   :agents="agentList"
 *   @selectModel="handleModelSelect"
 * />
 * ```
 */
import { computed, ref, watch } from 'vue'
import { markIcon } from '@/utils/markRaw'
import { useI18n } from 'vue-i18n'
import {
  X,
  Cpu,
  Bot,
  Network,
  Wrench,
  Sparkles,
  ChevronRight,
  FolderOpened,
  Search,
  Globe,
  Database,
  Code,
  FileText,
  MessageSquare,
  Image,
  Server,
  Terminal,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import CapabilityItem from './CapabilityItem.vue'
import GenerationTypeSelector from './GenerationTypeSelector.vue'
import type {
  AICapabilityMode,
  ModelCategory,
  GenerationType,
  ImageProvider,
  VideoProvider,
  CapabilityItemData,
  MCPTool,
} from './types'
import type { AIModelInfo } from '@/api/aiModelInfo'
import type { Agent } from '@/api/agents'
import { getAIModelList } from '@/api/aiModelInfo'
import { getAgentList, type AgentInfo } from '@/api/agent-plaza'

// Props
const props = withDefaults(
  defineProps<{
    /** 是否显示 */
    modelValue: boolean
    /** 当前 AI 模式 */
    currentMode?: AICapabilityMode
    /** 当前模型分类 */
    modelCategory?: ModelCategory
    /** 选中的模型 */
    selectedModel?: AIModelInfo | null
    /** 选中的智能体 */
    selectedAgent?: Agent | null
    /** 选中的 Agentic Swarm ID */
    selectedAgenticSwarmId?: string | null
    /** 模型列表 */
    models?: AIModelInfo[]
    /** 智能体列表 */
    agents?: Agent[]
    /** MCP 工具列表 */
    mcpTools?: MCPTool[]
    /** 当前生成类型 */
    generationType?: GenerationType
    /** 当前图像服务商 */
    imageProvider?: ImageProvider
    /** 当前视频服务商 */
    videoProvider?: VideoProvider
    /** 生成任务 ID */
    generationTaskId?: string | null
  }>(),
  {
    currentMode: 'model',
    modelCategory: 'talk',
    selectedModel: null,
    selectedAgent: null,
    selectedAgenticSwarmId: null,
    models: () => [],
    agents: () => [],
    mcpTools: () => [],
    generationType: 'auto',
    imageProvider: 'qwen',
    videoProvider: 'qwen',
    generationTaskId: null,
  }
)

// Emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'update:currentMode', mode: AICapabilityMode): void
  (e: 'update:modelCategory', category: ModelCategory): void
  (e: 'update:generationType', type: GenerationType): void
  (e: 'update:imageProvider', provider: ImageProvider): void
  (e: 'update:videoProvider', provider: VideoProvider): void
  (e: 'selectModel', modelCode: string): void
  (e: 'selectAgent', agentId: string): void
  (e: 'selectAgentic'): void
  (e: 'selectMCPTool', tool: MCPTool): void
  (e: 'openApiAccess', model: AIModelInfo): void
}>()

const { t } = useI18n()

// 内部状态
const internalMode = ref<AICapabilityMode>(props.currentMode)
const internalCategory = ref<ModelCategory>(props.modelCategory)
/** 自获取的模型列表（统一大模型列表接口 /ihui-ai-api/llm/models-unify（由 nginx 代理到 Python 后端）） */
const fetchedModels = ref<AIModelInfo[]>([])
/** 自获取的智能体列表（参考 ai_index.vue getAgentListAll → ihui API /agents/Alllist） */
const fetchedAgents = ref<Agent[]>([])
const modelsLoading = ref(false)
const agentsLoading = ref(false)
const internalGenerationType = ref<GenerationType>(props.generationType)
const internalImageProvider = ref<ImageProvider>(props.imageProvider)
const internalVideoProvider = ref<VideoProvider>(props.videoProvider)

// 同步 props 和内部状态
watch(() => props.currentMode, (val) => { internalMode.value = val })
watch(() => props.modelCategory, (val) => {
  const valid: ModelCategory[] = ['talk', 'image', 'video', 'audio', 'videoa', 'other']
  internalCategory.value = (valid.includes(val as ModelCategory) ? val : 'talk') as ModelCategory
  if (internalCategory.value !== val) emit('update:modelCategory', internalCategory.value)
})

/** 当面板打开时获取模型列表：与参考项目 ModelList 一致，使用统一大模型列表接口，无参数 */
async function fetchModels() {
  modelsLoading.value = true
  try {
    const res = await getAIModelList()
    const list = Array.isArray(res?.data) ? res.data : []
    fetchedModels.value = list
  } catch {
    fetchedModels.value = []
  } finally {
    modelsLoading.value = false
  }
}

/** 从 bylink 接口响应中解析为扁平智能体列表（与 AI 应用商店 AgentsSquareList 同一接口 /agent/rule/search/bylink） */
function parseAgentListFromBylink(res: any): AgentInfo[] {
  if (!res || typeof res !== 'object') return []
  const r = res as Record<string, unknown>
  const data = r.data
  // data 为按分类名分组的对象 { "分类A": [...], "分类B": [...] }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const d = data as Record<string, AgentInfo[]>
    const flat: AgentInfo[] = []
    for (const arr of Object.values(d)) {
      if (Array.isArray(arr)) flat.push(...arr)
    }
    if (flat.length) return flat
    const list = (d as Record<string, unknown>).list
    if (Array.isArray(list)) return list as AgentInfo[]
  }
  if (Array.isArray(data)) return data as AgentInfo[]
  return []
}

async function fetchAgents() {
  agentsLoading.value = true
  try {
    const res = await getAgentList({ pageNum: 1, pageSize: 100 })
    const list = parseAgentListFromBylink(res)
    fetchedAgents.value = list as unknown as Agent[]
  } catch {
    fetchedAgents.value = []
  } finally {
    agentsLoading.value = false
  }
}

watch(() => props.modelValue, (visible) => {
  if (visible) {
    fetchModels()
    fetchAgents()
    // 打开面板时若当前是大模型 tab，默认展开对话分类
    if (internalMode.value === 'model') {
      internalCategory.value = 'talk'
      emit('update:modelCategory', 'talk')
    }
  }
}, { immediate: true })
watch(() => props.generationType, (val) => { internalGenerationType.value = val })
watch(() => props.imageProvider, (val) => { internalImageProvider.value = val })
watch(() => props.videoProvider, (val) => { internalVideoProvider.value = val })

/** 主标签配置 */
const mainTabs = computed(() => [
  { key: 'model' as const, label: t('floatingChat.models'), icon: markIcon(Cpu) },
  { key: 'agent' as const, label: t('floatingChat.agents'), icon: markIcon(Bot) },
  { key: 'agentic' as const, label: t('floatingChat.agentic'), icon: markIcon(Network) },
  { key: 'mcp' as const, label: t('floatingChat.mcpTools'), icon: markIcon(Wrench) },
  { key: 'generation' as const, label: t('floatingChat.generation'), icon: markIcon(Sparkles) },
])

/** 模型分类配置 - 与参考项目 ModelList 一致：talk/image/video/audio/videoa/other */
const modelCategories = computed(() => [
  { key: 'talk' as const, label: t('home.input.tabs.talk') },
  { key: 'image' as const, label: t('home.input.tabs.image') },
  { key: 'video' as const, label: t('home.input.tabs.video') },
  { key: 'audio' as const, label: t('home.input.tabs.audio') },
  { key: 'videoa' as const, label: t('home.input.tabs.videoa') },
  { key: 'other' as const, label: t('home.input.tabs.other') },
])

/** 用于展示的模型列表：优先使用自获取数据，否则使用 props */
const displayModels = computed(() => {
  const hasFetched = fetchedModels.value.length > 0
  if (hasFetched) return fetchedModels.value
  return props.models ?? []
})

/** 根据分类过滤模型 - 与参考项目 ModelList 一致：type 0=other, 1=talk, 2=image, 3=video, 4=audio, 5=videoa */
const categoryToTypeNum: Record<ModelCategory, number> = {
  talk: 1,
  image: 2,
  video: 3,
  audio: 4,
  videoa: 5,
  other: 0,
}

/** 有效分类：父组件可能传 'text' 等旧值，统一为 talk 以默认展示对话列表 */
const effectiveModelCategory = computed(() => {
  const c = internalCategory.value
  const valid: ModelCategory[] = ['talk', 'image', 'video', 'audio', 'videoa', 'other']
  return (valid.includes(c as ModelCategory) ? c : 'talk') as ModelCategory
})

const filteredModels = computed(() => {
  if (!displayModels.value?.length) return []
  const targetType = categoryToTypeNum[effectiveModelCategory.value]
  return displayModels.value.filter((model: AIModelInfo) => {
    const modelType = model.type as number | string | undefined
    const t = modelType != null && String(modelType) !== '' ? Number(modelType) : null
    // 与参考项目一致：type 0=other, 1=talk, 2=image, 3=video, 4=audio, 5=videoa
    if (t === null) return targetType === 1 // 无 type 时归入对话
    return t === targetType
  })
})

/** 从后端模型对象中取图标 URL（兼容 img / icon / image / icon_url 等字段） */
function getModelIconUrl(model: AIModelInfo & Record<string, unknown>): string | undefined {
  const raw = model as Record<string, unknown>
  const keys = ['img', 'icon', 'image', 'iconUrl', 'icon_url', 'avatar']
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

/** 转换模型为能力项数据 - 兼容 source 字段（参考项目使用 source 作为显示名） */
const modelItems = computed<CapabilityItemData[]>(() => {
  const sel = props.selectedModel
  const selId = sel?.modelCode || sel?.id
  return filteredModels.value.map((model: AIModelInfo) => {
    const modelId = model.modelCode || model.id
    const isSelected = !!selId && !!modelId && String(selId) === String(modelId)
    return {
      id: String(model.id || model.modelCode || ''),
      name: model.source || model.displayName || model.name || model.modelCode || '',
      description: model.description || model.remark || '',
      iconUrl: getModelIconUrl(model as AIModelInfo & Record<string, unknown>),
      isSelected,
      metadata: { model },
    }
  })
})

/** 用于展示的智能体列表：优先使用自获取数据，否则使用 props */
const displayAgents = computed(() => {
  if (fetchedAgents.value.length > 0) return fetchedAgents.value
  return props.agents ?? []
})

/** 从智能体对象中取图标 URL（与 AI 应用商店一致，兼容后端多种字段名） */
function getAgentIconUrl(agent: Record<string, unknown>): string {
  const keys = [
    'agentAvatar',
    'avatar',
    'agent_avatar',
    'icon_url',
    'icon',
    'bot_avatar',
    'headImg',
    'head_img',
    'cover',
    'image',
    'img',
    'picture',
    'photo',
  ]
  for (const k of keys) {
    const v = agent[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

/** 按 id 从 props.agents 中取头像，用于补全 bylink 列表缺少头像的情况 */
function getIconUrlFromPropsAgents(agentId: string): string {
  const list = props.agents ?? []
  const found = list.find(
    (a: Record<string, unknown>) =>
      String(a?.id ?? a?.agentId ?? a?.botId ?? '') === String(agentId)
  )
  return found ? getAgentIconUrl(found as Record<string, unknown>) : ''
}

/** 转换智能体为能力项数据 */
const agentItems = computed<CapabilityItemData[]>(() => {
  const sel = props.selectedAgent as { id?: string; agentId?: string; botId?: string } | null | undefined
  const selId = sel?.id ?? sel?.agentId ?? sel?.botId
  return displayAgents.value.map((agent: Agent & { agentName?: string; botName?: string; agentId?: string; botId?: string }) => {
    const agentId = agent.id ?? agent.agentId ?? agent.botId ?? ''
    const isSelected = !!selId && !!agentId && String(selId) === String(agentId)
    let iconUrl = getAgentIconUrl(agent as unknown as Record<string, unknown>)
    if (!iconUrl) iconUrl = getIconUrlFromPropsAgents(String(agentId))
    return {
      id: String(agentId),
      name: agent.agentName ?? agent.botName ?? agent.name ?? '',
      description: agent.description ?? agent.prologue ?? '',
      iconUrl,
      isSelected,
      metadata: { agent },
    }
  })
})

/** 按 MCP 服务器 id 映射图标，使列表有辨识度 */
const MCP_SERVER_ICONS: Record<string, Component> = {
  'demo-mcp-1': Wrench,
  'curated-filesystem': FolderOpened,
  'curated-fetch': Globe,
  'curated-qiniu': Server,
  'curated-github': Code,
  'curated-gitlab': Code,
  'curated-brave-search': Search,
  'curated-perplexity': Search,
  'curated-zhipu-search': Search,
  'curated-search1api': Search,
  'curated-serper': Search,
  'curated-jina': Search,
  'curated-firecrawl': Globe,
  'curated-playwright': Globe,
  'curated-puppeteer': Globe,
  'curated-agentql': Globe,
  'curated-postgres': Database,
  'curated-redis': Database,
  'curated-neon': Database,
  'curated-milvus': Database,
  'curated-amap': Globe,
  'curated-baidu-map': Globe,
  'curated-google-maps': Globe,
  'curated-slack': MessageSquare,
  'curated-flomo': FileText,
  'curated-notion': FileText,
  'curated-figma': Image,
  'curated-modelscope': Cpu,
  'curated-minimax': Image,
  'curated-everart': Image,
  'curated-sequential-thinking': Cpu,
  'curated-sentry': Terminal,
  'curated-mailtrap': MessageSquare,
  'curated-time': Cpu,
  'curated-weather': Globe,
  'curated-howtocook': FileText,
  'curated-chatsum': MessageSquare,
  'curated-bucket': Terminal,
  'curated-aws-kb': Server,
  'curated-edgeone': Server,
  'curated-officetracker': FileText,
  'curated-strands-sop': Cpu,
  'curated-cc-switch': Terminal,
  'curated-nvidia-blog': FileText,
  'curated-coop': Network,
  'curated-logicapps': Server,
  'curated-ssh-sftp': Terminal,
  'curated-alphavantage': FileText,
  'curated-kospi': FileText,
  'curated-blender': Image,
  'curated-gbox': Terminal,
  'curated-mcp-advisor': Wrench,
  'curated-openrpc': Code,
  'curated-sqlite': Database,
  'curated-memory': Cpu,
  'curated-302-browser': Globe,
  'curated-302-sandbox': Terminal,
  'curated-pagespeed': Terminal,
  'curated-google-docs': FileText,
  'curated-markdown': FileText,
  'curated-pinecone': Database,
  'curated-supabase': Database,
  'curated-image-gen': Image,
  'curated-puppeteer-steel': Globe,
  'curated-galaconnect': Server,
  'curated-degasser': Cpu,
  'curated-agentic-reliability': Cpu,
}

/** 从 tool.id（格式 serverId:toolName）解析服务器 id */
function getMCPServerId(toolId: string): string {
  return toolId.includes(':') ? toolId.split(':')[0] : toolId
}

function getMCPIcon(toolId: string): Component {
  return MCP_SERVER_ICONS[getMCPServerId(toolId)] ?? Wrench
}

/** 服务器 id → 展示名（无 serverName 时回退，保证始终显示「服务器 · 工具名」） */
const MCP_SERVER_NAMES: Record<string, string> = {
  'demo-mcp-1': 'Demo MCP',
  'curated-filesystem': 'Filesystem',
  'curated-fetch': 'Fetch',
  'curated-qiniu': '七牛云',
  'curated-github': 'GitHub',
  'curated-gitlab': 'GitLab',
  'curated-brave-search': 'Brave Search',
  'curated-perplexity': 'Perplexity',
  'curated-zhipu-search': '智谱搜索',
  'curated-search1api': 'Search1API',
  'curated-serper': 'Serper',
  'curated-jina': 'Jina AI',
  'curated-firecrawl': 'Firecrawl',
  'curated-playwright': 'Playwright',
  'curated-puppeteer': 'Puppeteer',
  'curated-agentql': 'AgentQL',
  'curated-postgres': 'PostgreSQL',
  'curated-redis': 'Redis',
  'curated-neon': 'Neon',
  'curated-milvus': 'Milvus',
  'curated-amap': '高德地图',
  'curated-baidu-map': '百度地图',
  'curated-google-maps': 'Google Maps',
  'curated-slack': 'Slack',
  'curated-flomo': 'Flomo',
  'curated-notion': 'Notion',
  'curated-figma': 'Figma',
  'curated-modelscope': '魔搭',
  'curated-minimax': 'MiniMax',
  'curated-everart': 'EverArt',
  'curated-sequential-thinking': 'Sequential Thinking',
  'curated-sentry': 'Sentry',
  'curated-mailtrap': 'Mailtrap',
  'curated-time': 'Time',
  'curated-weather': 'Weather',
  'curated-howtocook': '做饭指南',
  'curated-chatsum': 'Chatsum',
  'curated-bucket': 'Bucket',
  'curated-aws-kb': 'AWS KB',
  'curated-edgeone': 'EdgeOne',
  'curated-officetracker': 'Officetracker',
  'curated-strands-sop': 'Strands SOP',
  'curated-cc-switch': 'cc-switch',
  'curated-nvidia-blog': 'NVIDIA Blog',
  'curated-coop': 'Co-Op',
  'curated-logicapps': 'LogicApps',
  'curated-ssh-sftp': 'SSH-SFTP',
  'curated-alphavantage': 'AlphaVantage',
  'curated-kospi': 'KOSPI/KOSDAQ',
  'curated-blender': 'Blender',
  'curated-gbox': 'GBOX',
  'curated-mcp-advisor': 'MCP Advisor',
  'curated-openrpc': 'OpenRPC',
  'curated-sqlite': 'SQLite',
  'curated-memory': 'Memory',
  'curated-302-browser': '302 Browser',
  'curated-302-sandbox': '302 Sandbox',
  'curated-pagespeed': 'PageSpeed',
  'curated-google-docs': 'Google Docs',
  'curated-markdown': 'Markdown',
  'curated-pinecone': 'Pinecone',
  'curated-supabase': 'Supabase',
  'curated-image-gen': 'Image Gen',
  'curated-puppeteer-steel': 'Steel Puppeteer',
  'curated-galaconnect': 'GalaConnect',
  'curated-degasser': 'Degasser',
  'curated-agentic-reliability': 'Agentic Reliability',
}

function getMCPServerDisplayName(toolId: string): string {
  return MCP_SERVER_NAMES[getMCPServerId(toolId)] ?? ''
}

/** 转换 MCP 工具为能力项数据（含服务器名、功能介绍、图标） */
const mcpToolItems = computed<CapabilityItemData[]>(() => {
  return (props.mcpTools || []).map((tool: MCPTool) => {
    const serverLabel = tool.serverName || getMCPServerDisplayName(tool.id)
    const displayName = serverLabel ? `${serverLabel} · ${tool.name}` : tool.name
    const desc = tool.description || tool.serverDescription || ''
    return {
      id: tool.id,
      name: displayName,
      description: desc,
      iconUrl: tool.icon,
      icon: getMCPIcon(tool.id),
      metadata: { tool },
    }
  })
})

/** 关闭弹窗 */
const close = () => {
  emit('update:modelValue', false)
}

/** 切换主标签：点击大模型时默认展开对话分类 */
const switchMode = (mode: AICapabilityMode) => {
  internalMode.value = mode
  emit('update:currentMode', mode)
  if (mode === 'model') {
    internalCategory.value = 'talk'
    emit('update:modelCategory', 'talk')
  }
}

/** 切换模型分类 */
const switchCategory = (category: ModelCategory) => {
  internalCategory.value = category
  emit('update:modelCategory', category)
}

/** 处理模型选择 */
const handleModelSelect = (item: CapabilityItemData) => {
  emit('selectModel', item.id)
}

/** 处理智能体选择 */
const handleAgentSelect = (item: CapabilityItemData) => {
  emit('selectAgent', item.id)
}

/** 处理 Agentic 选择 */
const handleAgenticSelect = () => {
  emit('selectAgentic')
}

/** 处理 MCP 工具选择 */
const handleMCPToolSelect = (item: CapabilityItemData) => {
  const tool = item.metadata?.tool as MCPTool
  if (tool) {
    emit('selectMCPTool', tool)
  }
}

/** 处理 API 访问点击 */
const handleApiAccess = (item: CapabilityItemData) => {
  const model = item.metadata?.model as AIModelInfo
  if (model) {
    emit('openApiAccess', model)
  }
}

/** 更新生成类型 */
const updateGenerationType = (type: GenerationType) => {
  internalGenerationType.value = type
  emit('update:generationType', type)
}

/** 更新图像服务商 */
const updateImageProvider = (provider: ImageProvider) => {
  internalImageProvider.value = provider
  emit('update:imageProvider', provider)
}

/** 更新视频服务商 */
const updateVideoProvider = (provider: VideoProvider) => {
  internalVideoProvider.value = provider
  emit('update:videoProvider', provider)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="ai-capability-selector__backdrop" data-ai-capability-selector @click.self="close">
        <div class="ai-capability-selector ai-capability-selector__panel">
          <!-- 头部 -->
          <header class="ai-capability-selector__header">
            <h2 class="ai-capability-selector__title">
              {{ t('floatingChat.selectAICapability') }}
            </h2>
            <button class="ai-capability-selector__close" @click="close" aria-label="关闭">
              <X class="w-5 h-5" />
            </button>
          </header>

          <!-- 主标签导航：内层 .ai-capability-selector__nav-inner 做 flex 换行，避免溢出横向滚动 -->
          <nav class="ai-capability-selector__nav">
            <div class="ai-capability-selector__nav-inner">
              <button
                v-for="tab in mainTabs"
                :key="tab.key"
                class="ai-capability-selector__tab"
                :class="{ 'ai-capability-selector__tab--active': internalMode === tab.key }"
                @click="switchMode(tab.key)"
              >
                <component :is="tab.icon" class="ai-capability-selector__tab-icon" />
                <span class="ai-capability-selector__tab-label">{{ tab.label }}</span>
              </button>
            </div>
          </nav>

          <!-- 内容区 -->
          <div class="ai-capability-selector__content">
            <!-- 模型列表 -->
            <template v-if="internalMode === 'model'">
              <!-- 模型分类标签 -->
              <div class="ai-capability-selector__category-nav">
                <button
                  v-for="category in modelCategories"
                  :key="category.key"
                  class="ai-capability-selector__category"
                  :class="{ 'ai-capability-selector__category--active': effectiveModelCategory === category.key }"
                  @click="switchCategory(category.key)"
                >
                  {{ category.label }}
                </button>
              </div>

              <!-- 模型列表 -->
              <div class="ai-capability-selector__list">
                <CapabilityItem
                  v-for="item in modelItems"
                  :key="item.id"
                  :data="item"
                  :selected="item.isSelected"
                  show-api-access
                  @click="handleModelSelect"
                  @api-access="handleApiAccess"
                />
                
                <!-- 空状态 -->
                <div v-if="modelsLoading" class="ai-capability-selector__empty">
                  <Cpu class="w-12 h-12 text-muted-foreground/30 animate-pulse" />
                  <p>{{ t('common.loading') }}</p>
                </div>
                <div v-else-if="modelItems.length === 0" class="ai-capability-selector__empty">
                  <Cpu class="w-12 h-12 text-muted-foreground/30" />
                  <p>{{ t('home.input.noModelData', { type: modelCategories.find((c: { key: string; label: string }) => c.key === effectiveModelCategory)?.label ?? effectiveModelCategory })  }}</p>
                </div>
              </div>
            </template>

            <!-- 智能体列表 -->
            <template v-else-if="internalMode === 'agent'">
              <div class="ai-capability-selector__list">
                <CapabilityItem
                  v-for="item in agentItems"
                  :key="item.id"
                  :data="item"
                  :selected="item.isSelected"
                  @click="handleAgentSelect"
                />
                
                <!-- 空状态 -->
                <div v-if="agentsLoading" class="ai-capability-selector__empty">
                  <Bot class="w-12 h-12 text-muted-foreground/30 animate-pulse" />
                  <p>{{ t('common.loading') }}</p>
                </div>
                <div v-else-if="agentItems.length === 0" class="ai-capability-selector__empty">
                  <Bot class="w-12 h-12 text-muted-foreground/30" />
                  <p>{{ t('floatingChat.noAgents') }}</p>
                </div>
              </div>
            </template>

            <!-- Agentic AI -->
            <template v-else-if="internalMode === 'agentic'">
              <div class="ai-capability-selector__list">
                <!-- 创建 Agentic Swarm -->
                <div
                  class="ai-capability-selector__agentic-card"
                  @click="handleAgenticSelect"
                >
                  <div class="ai-capability-selector__agentic-icon">
                    <Network class="w-6 h-6" />
                  </div>
                  <div class="ai-capability-selector__agentic-info">
                    <h4>{{ t('floatingChat.createAgenticSwarm') }}</h4>
                    <p>{{ t('floatingChat.agenticDescription') }}</p>
                  </div>
                  <ChevronRight class="w-5 h-5 text-muted-foreground" />
                </div>

                <!-- 当前 Swarm -->
                <div
                  v-if="selectedAgenticSwarmId"
                  class="ai-capability-selector__agentic-current"
                >
                  <span class="ai-capability-selector__agentic-label">
                    {{ t('floatingChat.currentSwarm') }}
                  </span>
                  <code class="ai-capability-selector__agentic-id">
                    {{ selectedAgenticSwarmId }}
                  </code>
                </div>
              </div>
            </template>

            <!-- MCP 工具 -->
            <template v-else-if="internalMode === 'mcp'">
              <div class="ai-capability-selector__mcp-wrap">
                <p class="ai-capability-selector__mcp-intro">
                  {{ t('floatingChat.mcpToolsIntro') }}
                </p>
                <div class="ai-capability-selector__list ai-capability-selector__list--mcp">
                  <CapabilityItem
                    v-for="item in mcpToolItems"
                    :key="item.id"
                    :data="item"
                    variant="featured"
                    @click="handleMCPToolSelect"
                  />
                </div>
                <!-- 空状态 -->
                <div v-if="mcpToolItems.length === 0" class="ai-capability-selector__empty">
                  <Wrench class="w-12 h-12 text-muted-foreground/30" />
                  <p>{{ t('floatingChat.noMCPTools') }}</p>
                </div>
              </div>
            </template>

            <!-- AI 生成 -->
            <template v-else-if="internalMode === 'generation'">
              <div class="ai-capability-selector__generation">
                <GenerationTypeSelector
                  :generation-type="internalGenerationType"
                  :image-provider="internalImageProvider"
                  :video-provider="internalVideoProvider"
                  @update:generation-type="updateGenerationType"
                  @update:image-provider="updateImageProvider"
                  @update:video-provider="updateVideoProvider"
                />

                <!-- 任务状态 -->
                <Transition name="fade">
                  <div v-if="generationTaskId" class="ai-capability-selector__task">
                    <div class="ai-capability-selector__task-indicator" />
                    <span>{{ t('floatingChat.generationTaskRunning', { taskId: generationTaskId }) }}</span>
                  </div>
                </Transition>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<!--
  面板通过 Teleport 挂到 body，scoped 样式可能不会应用到 teleported 节点，
  因此使用全局样式块，以 .ai-capability-selector__backdrop 为根，仅作用于本面板。
-->
<style lang="scss">
// 设计令牌（与 AI 智能工具箱 / openclaw-quick-menu 统一，使用 CSS 变量以支持暗色）
.ai-capability-selector__backdrop {
  --acs-border: var(--unified-border);
  --acs-ease: cubic-bezier(0.4, 0, 0.2, 1);
  --acs-text-primary: var(--el-text-color-primary);
  --acs-text-secondary: var(--el-text-color-secondary);
  --acs-text-muted: var(--el-text-color-placeholder);
  --acs-bg-panel: var(--el-bg-color);
  --acs-bg-elevated: var(--el-fill-color-light);
  --acs-bg-hover: var(--el-fill-color-light);
  --acs-bg-active: var(--el-fill-color);
  --acs-panel-radius: 12px;
  --acs-panel-shadow: var(--el-box-shadow-light);
}

html.dark .ai-capability-selector__backdrop {
  --acs-border: var(--unified-border);
  --acs-text-primary: var(--el-text-color-primary);
  --acs-text-secondary: var(--el-text-color-secondary);
  --acs-text-muted: var(--el-text-color-placeholder);
  --acs-bg-panel: var(--el-bg-color);
  --acs-bg-elevated: var(--el-fill-color-light);
  --acs-bg-hover: var(--el-fill-color-light);
  --acs-bg-active: var(--el-fill-color);
  --acs-panel-shadow: var(--el-box-shadow);
}

// 仅作用于面板根及其子元素（避免影响页面其他 .ai-capability-selector，如 AIChat 内的 dropdown 触发按钮）
.ai-capability-selector__backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-max);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28px 20px 20px;
  overflow: hidden;
  background: var(--el-mask-color, color-mix(in srgb, var(--el-color-primary) 35%, transparent));
  backdrop-filter: blur(12px) saturate(120%);
  -webkit-backdrop-filter: blur(12px) saturate(120%);
  transition: opacity 0.25s var(--acs-ease);
}

html.dark .ai-capability-selector__backdrop {
  background: var(--el-mask-color);
}

/* 面板主容器：与 openclaw-popover / 智能工具箱 统一 - 白底、细描边、圆角、轻阴影 */
.ai-capability-selector__backdrop .ai-capability-selector__panel {
  position: relative;
  width: 100%;
  max-width: 520px;
  min-width: 0; /* 在 flex 布局中允许面板收缩，避免被 nav 内容撑宽 */
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--acs-bg-panel);
  border: var(--acs-border);
  border-radius: var(--acs-panel-radius);
  overflow: hidden;
  box-shadow: var(--acs-panel-shadow);
  transition: transform 0.25s var(--acs-ease), box-shadow 0.2s var(--acs-ease);
}

/* 头部：与 .menu-header / .menu-title 一致 - 左侧 4px 色条 + 标题 */
.ai-capability-selector__backdrop .ai-capability-selector__header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  padding-left: 24px;
  border-bottom: var(--acs-border);
  background: transparent;
  position: relative;
}

.ai-capability-selector__backdrop .ai-capability-selector__header::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 18px;
  background: var(--el-color-primary);
  border-radius: var(--global-border-radius);
}

:where(html.dark) .ai-capability-selector__backdrop .ai-capability-selector__header {
  border-bottom-color: var(--el-border-color-lighter);
}

:where(html.dark) :where(.ai-capability-selector__backdrop) :where(.ai-capability-selector__header::before) {
  background: var(--el-text-color-primary);
}

.ai-capability-selector__backdrop .ai-capability-selector__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--acs-text-primary);
  letter-spacing: -0.02em;
  line-height: 1.3;
  padding-left: 2px;
}

.ai-capability-selector__backdrop .ai-capability-selector__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--global-border-radius);
  color: var(--acs-text-secondary);
  cursor: pointer;
  transition: background 0.15s var(--acs-ease), color 0.15s var(--acs-ease);
}

.ai-capability-selector__backdrop .ai-capability-selector__close:hover {
  background: var(--acs-bg-hover);
  color: var(--acs-text-primary);
}

.ai-capability-selector__backdrop .ai-capability-selector__close:active {
  background: var(--acs-bg-active);
}

.ai-capability-selector__backdrop .ai-capability-selector__nav {
  flex: 0 0 auto;
  min-height: 52px;
  height: auto;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  padding: 6px 20px 6px 24px;
  box-sizing: border-box;
  background: var(--acs-bg-elevated);
  border-bottom: var(--acs-border);
  overflow: hidden;
}

.ai-capability-selector__backdrop .ai-capability-selector__nav-inner {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  align-content: center;
  gap: 4px;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

:where(html.dark) .ai-capability-selector__backdrop .ai-capability-selector__nav {
  border-bottom-color: var(--el-border-color-lighter);
}

.ai-capability-selector__backdrop .ai-capability-selector__nav::-webkit-scrollbar {
  display: none;
}

.ai-capability-selector__backdrop .ai-capability-selector__nav-inner .ai-capability-selector__tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 40px;
  min-height: 40px;
  padding: 0 8px;
  border: none;
  background: transparent;
  border-radius: var(--global-border-radius);
  color: var(--acs-text-secondary);
  cursor: pointer;
  transition: background 0.15s var(--acs-ease), color 0.15s var(--acs-ease);
  white-space: nowrap;
  flex: 1 1 0;
  min-width: 72px;
  max-width: 100%;
  box-sizing: border-box;
}

.ai-capability-selector__backdrop .ai-capability-selector__nav-inner .ai-capability-selector__tab:hover {
  background: var(--acs-bg-hover);
  color: var(--acs-text-primary);
}

.ai-capability-selector__backdrop .ai-capability-selector__nav-inner .ai-capability-selector__tab:active {
  background: var(--acs-bg-active);
}

.ai-capability-selector__backdrop .ai-capability-selector__nav-inner .ai-capability-selector__tab.ai-capability-selector__tab--active {
  background: var(--acs-bg-panel);
  color: var(--acs-text-primary);
  font-weight: 500;
}

:where(.ai-capability-selector__backdrop) .ai-capability-selector__nav-inner .ai-capability-selector__tab.ai-capability-selector__tab--active .ai-capability-selector__tab-icon {
  color: var(--acs-text-primary);
}

.ai-capability-selector__backdrop .ai-capability-selector__tab-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  transition: color 0.15s var(--acs-ease);
}

.ai-capability-selector__backdrop .ai-capability-selector__tab-label {
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.01em;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-capability-selector__backdrop .ai-capability-selector__content {
  flex: 1;
  min-height: 0;
  padding: 18px 24px 24px;
  overflow: hidden auto;
  background: var(--acs-bg-panel);
}

.ai-capability-selector__backdrop .ai-capability-selector__content::-webkit-scrollbar {
  width: 6px;
}

.ai-capability-selector__backdrop .ai-capability-selector__content::-webkit-scrollbar-track {
  background: transparent;
}

.ai-capability-selector__backdrop .ai-capability-selector__content::-webkit-scrollbar-thumb {
  background: var(--border-unified-color);
  border-radius: var(--global-border-radius);
}

.ai-capability-selector__backdrop .ai-capability-selector__content::-webkit-scrollbar-thumb:hover {
  background: var(--acs-text-muted);
}

.ai-capability-selector__backdrop .ai-capability-selector__category-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.ai-capability-selector__backdrop .ai-capability-selector__category {
  padding: 6px 14px;
  font-size: 12px;
  font-weight: 400;
  color: var(--acs-text-secondary);
  background: var(--acs-bg-elevated);
  border: var(--acs-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background 0.15s var(--acs-ease), border-color 0.15s var(--acs-ease), color 0.15s var(--acs-ease);
}

:where(html.dark) .ai-capability-selector__backdrop .ai-capability-selector__category {
  border-color: var(--el-border-color-lighter);
}

.ai-capability-selector__backdrop .ai-capability-selector__category:hover {
  background: var(--acs-bg-hover);
  color: var(--acs-text-primary);
}

.ai-capability-selector__backdrop .ai-capability-selector__category.ai-capability-selector__category--active {
  background: var(--acs-bg-panel);
  border-color: var(--acs-text-primary);
  color: var(--acs-text-primary);
  font-weight: 500;
}

.ai-capability-selector__backdrop .ai-capability-selector__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-capability-selector__backdrop .ai-capability-selector__mcp-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ai-capability-selector__backdrop .ai-capability-selector__mcp-intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--acs-text-secondary);
  letter-spacing: 0.01em;
}

.ai-capability-selector__backdrop .ai-capability-selector__list--mcp {
  gap: 10px;
}

:where(.ai-capability-selector__backdrop) :where(.ai-capability-selector__list--mcp) .capability-item {
  padding: 16px 18px;
  border-radius: var(--global-border-radius);
}

:where(.ai-capability-selector__backdrop) :where(.ai-capability-selector__list--mcp) .capability-item__name {
  font-size: 14px;
  font-weight: 600;
}

:where(.ai-capability-selector__backdrop) :where(.ai-capability-selector__list--mcp) .capability-item__desc {
  font-size: 12px;
  color: var(--acs-text-secondary);
  margin-top: 4px;
}

/* 能力卡图标：与全局按钮/图标一致，使用设计令牌 */
.ai-capability-selector__backdrop .capability-item__icon {
  background: var(--acs-bg-elevated);
  color: var(--el-text-color-primary);
}

.ai-capability-selector__backdrop .capability-item__icon-svg,
:where(.ai-capability-selector__backdrop) :where(.capability-item__icon) .el-icon {
  color: var(--el-text-color-primary);
}

:where(.ai-capability-selector__backdrop) :where(.ai-capability-selector__list--mcp) .capability-item__icon {
  width: 40px;
  height: 40px;
  border-radius: var(--global-border-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--acs-bg-elevated);
  color: var(--el-color-primary);
}

:where(.ai-capability-selector__backdrop) :where(.ai-capability-selector__list--mcp) .capability-item__icon-svg {
  width: 22px;
  height: 22px;
}

:where(.ai-capability-selector__backdrop) :where(.ai-capability-selector__list--mcp) .capability-item__icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.ai-capability-selector__backdrop .ai-capability-selector__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 56px 28px;
  text-align: center;
}

.ai-capability-selector__backdrop .ai-capability-selector__empty p {
  margin: 0;
  font-size: 14px;
  color: var(--acs-text-muted);
  letter-spacing: 0.01em;
}

.ai-capability-selector__backdrop .ai-capability-selector__agentic-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  background: var(--acs-bg-elevated);
  border: var(--acs-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: background 0.2s var(--acs-ease), border-color 0.2s var(--acs-ease), transform 0.2s var(--acs-ease);
}

:where(html.dark) .ai-capability-selector__backdrop .ai-capability-selector__agentic-card {
  border-color: var(--el-border-color-lighter);
}

.ai-capability-selector__backdrop .ai-capability-selector__agentic-card:hover {
  background: var(--acs-bg-hover);
  border-color: var(--acs-text-muted);
  transform: translateY(-1px);
}

.ai-capability-selector__backdrop .ai-capability-selector__agentic-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--acs-bg-active);
  border-radius: var(--global-border-radius);
  color: var(--acs-text-primary);
  flex-shrink: 0;
}

.ai-capability-selector__backdrop .ai-capability-selector__agentic-info {
  flex: 1;
  min-width: 0;
}

.ai-capability-selector__backdrop .ai-capability-selector__agentic-info h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: var(--acs-text-primary);
  letter-spacing: -0.01em;
}

.ai-capability-selector__backdrop .ai-capability-selector__agentic-info p {
  margin: 0;
  font-size: 12px;
  color: var(--acs-text-secondary);
  line-height: 1.45;
  letter-spacing: 0.01em;
}

.ai-capability-selector__backdrop .ai-capability-selector__agentic-current {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: var(--acs-bg-elevated);
  border: var(--acs-border);
  border-radius: var(--global-border-radius);
  margin-top: 10px;
}

:where(html.dark) .ai-capability-selector__backdrop .ai-capability-selector__agentic-current {
  border-color: var(--el-border-color-lighter);
}

.ai-capability-selector__backdrop .ai-capability-selector__agentic-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--acs-text-secondary);
}

.ai-capability-selector__backdrop .ai-capability-selector__agentic-id {
  padding: 4px 10px;
  font-size: 11px;
  font-family: var(--font-family-mono, ui-monospace, monospace);
  background: var(--acs-bg-panel);
  border: var(--acs-border);
  border-radius: var(--global-border-radius);
  color: var(--acs-text-primary);
}

.ai-capability-selector__backdrop .ai-capability-selector__generation {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ai-capability-selector__backdrop .ai-capability-selector__task {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  background: color-mix(in srgb, var(--el-color-warning) 6%, transparent);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  color: var(--acs-text-secondary);
  font-size: 13px;
  letter-spacing: 0.01em;
}

.ai-capability-selector__backdrop .ai-capability-selector__task-indicator {
  width: 8px;
  height: 8px;
  background: color-mix(in srgb, var(--el-color-warning) 70%, transparent);
  border-radius: 50%;
  animation: acs-pulse 1.5s var(--acs-ease) infinite;
}

@keyframes acs-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.45; }
}

.ai-capability-selector__backdrop.modal-enter-active,
.ai-capability-selector__backdrop.modal-leave-active {
  transition: opacity 0.25s var(--acs-ease);
}

.ai-capability-selector__backdrop.modal-enter-active .ai-capability-selector,
.ai-capability-selector__backdrop.modal-leave-active .ai-capability-selector {
  transition: transform 0.25s var(--acs-ease);
}

.ai-capability-selector__backdrop.modal-enter-from,
.ai-capability-selector__backdrop.modal-leave-to {
  opacity: 0;
}

.ai-capability-selector__backdrop.modal-enter-from .ai-capability-selector,
.ai-capability-selector__backdrop.modal-leave-to .ai-capability-selector {
  transform: scale(0.97) translateY(12px);
}

.ai-capability-selector__backdrop.modal-enter-to .ai-capability-selector,
.ai-capability-selector__backdrop.modal-leave-from .ai-capability-selector {
  transform: scale(1) translateY(0);
}

.ai-capability-selector__backdrop .fade-enter-active,
.ai-capability-selector__backdrop .fade-leave-active {
  transition: opacity 0.2s var(--acs-ease);
}

.ai-capability-selector__backdrop .fade-enter-from,
.ai-capability-selector__backdrop .fade-leave-to {
  opacity: 0;
}

@media (width <= 640px) {
  .ai-capability-selector__backdrop {
    padding: 20px 14px 14px;
  }

  .ai-capability-selector__backdrop .ai-capability-selector__panel {
    border-radius: var(--global-border-radius);
  }

  .ai-capability-selector__backdrop .ai-capability-selector__header {
    padding: 16px 18px;
  }

  .ai-capability-selector__backdrop .ai-capability-selector__title {
    font-size: 16px;
  }

  .ai-capability-selector__backdrop .ai-capability-selector__nav {
    min-height: 46px;
    height: auto;
    padding: 6px 16px 6px 18px;
    overflow: hidden;
  }

  :where(.ai-capability-selector__backdrop) :where(.ai-capability-selector__nav-inner) .ai-capability-selector__tab {
    height: 36px;
    min-height: 36px;
    min-width: 64px;
    padding: 0 6px;
    gap: 2px;
  }

  .ai-capability-selector__backdrop .ai-capability-selector__tab-icon {
    width: 12px;
    height: 12px;
  }

  .ai-capability-selector__backdrop .ai-capability-selector__tab-label {
    font-size: 10px;
  }

  .ai-capability-selector__backdrop .ai-capability-selector__content {
    padding: 16px 18px 22px;
  }

  .ai-capability-selector__backdrop .ai-capability-selector__category-nav {
    margin-bottom: 14px;
  }

  .ai-capability-selector__backdrop .ai-capability-selector__empty {
    padding: 40px 20px;
  }
}
</style>
