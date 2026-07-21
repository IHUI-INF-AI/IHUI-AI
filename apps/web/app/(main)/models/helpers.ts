import type { Provider, Model, ProviderGroup, PresetPrompt } from './types'
import { FAVORITE_MODELS_STORAGE_KEY } from './types'

/**
 * 厂商分组定义:用于 ModelsNav 按分组展示 provider,降低 80+ 厂商的认知负担
 * - 显示顺序: international → domestic → inference → cloud → aggregator → local
 */
export const PROVIDER_GROUPS: { key: ProviderGroup; providers: Provider[] }[] = [
  {
    key: 'international',
    providers: [
      'openai',
      'anthropic',
      'google',
      'deepseek',
      'meta',
      'mistral',
      'xai',
      'cohere',
      'nvidia',
      'ai21',
      'microsoft',
      'perplexity',
    ],
  },
  {
    key: 'domestic',
    providers: [
      'qwen',
      'zhipu',
      'moonshot',
      'doubao',
      'stepfun',
      'hunyuan',
      'wenxin',
      'minimax',
      'baichuan',
      'spark',
      'yi',
      'sensenova',
      'skywork',
      'internlm',
      // 2026-07 新增国内新势力厂商
      'ornith',
      'codebrain',
      'mai',
    ],
  },
  {
    key: 'inference',
    providers: [
      'groq',
      'together',
      'fireworks',
      'novita',
      'lambda',
      'baseten',
      'crusoe',
      'targon',
      'centml',
      'nebius',
      'upstage',
      'leptonai',
      'hyperbolic',
      'featherless',
      'parasail',
      'friendli',
      'anyscale',
      'infermatic',
      'replit',
    ],
  },
  {
    key: 'cloud',
    providers: [
      'aws',
      'bedrock',
      'azure',
      'vertexai',
      'huggingface',
      'replicate',
      'stability',
      'inflection',
      'ibm',
      'cerebras',
      'sambanova',
      'snowflake',
      'deepinfra',
      'alephalpha',
      'nous',
      'gemma',
      'copilot',
      'bing',
      'siliconcloud',
      'modelscope',
      'ppio',
      'volcengine',
      'bailian',
      'baai',
      'tii',
      'liquid',
      'ai2',
    ],
  },
  {
    key: 'aggregator',
    providers: ['openrouter'],
  },
  {
    key: 'local',
    providers: ['ollama', 'openwebui', 'lmstudio', 'local'],
  },
]

/**
 * 内置厂商列表(展开 PROVIDER_GROUPS,保留扁平 export 以兼容旧引用)
 */
export const PROVIDERS: Provider[] = PROVIDER_GROUPS.flatMap((g) => g.providers)

/**
 * 推荐模型 id 集合:用于 highlight 标记 + "推荐排序" 加权
 * 选取标准:plan 套餐已接入 / 行业旗舰 / 项目默认模型
 */
export const HIGHLIGHT_MODEL_IDS = new Set<string>([
  'stepfun/step-3.7-flash',
  'stepfun/step-3.5-flash',
  'stepfun/step-router-v1',
  'gpt-4o',
  'gpt-4o-mini',
  'o3',
  'claude-3-7-sonnet',
  'claude-opus-4',
  'claude-sonnet-4',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'deepseek-chat',
  'deepseek-reasoner',
  'qwen-max',
  'qwen-plus',
  'glm-4.5',
  'kimi-k2',
  'grok-3',
  'llama-3.3-70b-versatile',
  // === 2026-07 新模型(旗舰 + 新势力置顶推荐) ===
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'claude-sonnet-5',
  'claude-opus-4.8',
  'gemini-3.5-pro',
  'grok-4.5',
  'deepseek-v4-pro',
  'glm-5.2',
  'qwen3.7-max',
  'hunyuan-hy3',
  'kimi-k3',
  'ornith-1.0',
  'codebrain-1',
  'mai-thinking-1',
])

/**
 * 内置兜底模型列表(50+ 厂商最新模型,fetchModels 失败时使用)
 * 与 apps/ai-service/app/routers/llm.py 中的 default_models 保持一致
 */
export const FALLBACK_MODELS: Model[] = [
  // === OpenAI(7 个) ===
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 2.5,
    features: ['Vision', 'Function Calling', 'Multimodal'],
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    provider: 'openai',
    description: 'model.gpt-4o-mini.description',
    contextLength: 128000,
    inputPrice: 0.15,
    features: ['Fast', 'Affordable'],
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'model.gpt-4o.description',
    contextLength: 1047576,
    inputPrice: 2.0,
    features: ['Long Context', 'Coding'],
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 mini',
    provider: 'openai',
    description: 'model.gpt-4o-mini.description',
    contextLength: 1047576,
    inputPrice: 0.4,
    features: ['Fast', 'Coding'],
  },
  {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    description: 'model.gpt-4o.description',
    contextLength: 200000,
    inputPrice: 60.0,
    features: ['Reasoning', 'PhD-Level'],
  },
  {
    id: 'o3-mini',
    name: 'o3 mini',
    provider: 'openai',
    description: 'model.gpt-4o-mini.description',
    contextLength: 200000,
    inputPrice: 1.1,
    features: ['Reasoning', 'Fast'],
  },
  {
    id: 'o4-mini',
    name: 'o4 mini',
    provider: 'openai',
    description: 'model.gpt-4o-mini.description',
    contextLength: 200000,
    inputPrice: 1.1,
    features: ['Reasoning', 'Multimodal'],
  },
  // === Anthropic(5 个) ===
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 200000,
    inputPrice: 3.0,
    features: ['Reasoning', 'Writing', 'Vision'],
  },
  {
    id: 'claude-3-5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 200000,
    inputPrice: 0.8,
    features: ['Fast', 'Affordable'],
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    provider: 'anthropic',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 200000,
    inputPrice: 3.0,
    features: ['Reasoning', 'Coding', 'Vision'],
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 200000,
    inputPrice: 15.0,
    features: ['Reasoning', 'Frontier'],
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 200000,
    inputPrice: 3.0,
    features: ['Reasoning', 'Coding'],
  },
  // === Google Gemini(3 个) ===
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'model.gemini-2-flash.description',
    contextLength: 1048576,
    inputPrice: 0.1,
    features: ['Long Context', 'Multimodal', 'Fast'],
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'model.gemini-2-flash.description',
    contextLength: 1048576,
    inputPrice: 1.25,
    features: ['Long Context', 'Reasoning'],
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    description: 'model.gemini-2-flash.description',
    contextLength: 1048576,
    inputPrice: 0.075,
    features: ['Long Context', 'Fast'],
  },
  // === Google Gemma 开源(2 个) ===
  {
    id: 'gemma-2-27b-it',
    name: 'Gemma 2 27B',
    provider: 'gemma',
    description: 'model.gemini-2-flash.description',
    contextLength: 8192,
    inputPrice: 0.1,
    features: ['Open Source', 'Lightweight'],
  },
  {
    id: 'gemma-2-9b-it',
    name: 'Gemma 2 9B',
    provider: 'gemma',
    description: 'model.gemini-2-flash.description',
    contextLength: 8192,
    inputPrice: 0.03,
    features: ['Open Source', 'Small'],
  },
  // === DeepSeek(3 个) ===
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    description: 'model.gpt-4o.description',
    contextLength: 64000,
    inputPrice: 0.27,
    features: ['Affordable', 'Chinese-Optimized'],
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner (R1)',
    provider: 'deepseek',
    description: 'model.gpt-4o.description',
    contextLength: 64000,
    inputPrice: 0.55,
    features: ['Reasoning', 'Open Source'],
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    description: 'model.gpt-4o.description',
    contextLength: 64000,
    inputPrice: 0.27,
    features: ['Affordable', 'Frontier'],
  },
  // === Meta Llama(2 个) ===
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'meta',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.59,
    features: ['Open Source', 'Reasoning'],
  },
  {
    id: 'llama-3.1-405b-instruct',
    name: 'Llama 3.1 405B',
    provider: 'meta',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 3.0,
    features: ['Open Source', 'Frontier'],
  },
  // === Mistral AI 法国(3 个) ===
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    provider: 'mistral',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 2.0,
    features: ['Reasoning', 'Multilingual'],
  },
  {
    id: 'codestral-latest',
    name: 'Codestral',
    provider: 'mistral',
    description: 'model.gpt-4o.description',
    contextLength: 256000,
    inputPrice: 0.3,
    features: ['Coding', 'Fast'],
  },
  {
    id: 'pixtral-large-latest',
    name: 'Pixtral Large',
    provider: 'mistral',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 2.0,
    features: ['Multimodal', 'Vision'],
  },
  // === xAI Grok(2 个) ===
  {
    id: 'grok-2',
    name: 'Grok 2',
    provider: 'xai',
    description: 'model.gpt-4o.description',
    contextLength: 131072,
    inputPrice: 2.0,
    features: ['Realtime', 'Humor'],
  },
  {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'xai',
    description: 'model.gpt-4o.description',
    contextLength: 131072,
    inputPrice: 3.0,
    features: ['Reasoning', 'Realtime'],
  },
  // === Cohere 加拿大(2 个) ===
  {
    id: 'command-r-plus',
    name: 'Command R+',
    provider: 'cohere',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 2.5,
    features: ['RAG', 'Tool Use'],
  },
  {
    id: 'command-a',
    name: 'Command A',
    provider: 'cohere',
    description: 'model.gpt-4o.description',
    contextLength: 256000,
    inputPrice: 2.5,
    features: ['RAG', 'Long Context'],
  },
  // === Nvidia 英伟达(2 个) ===
  {
    id: 'nemotron-4-340b-instruct',
    name: 'Nemotron 4 340B',
    provider: 'nvidia',
    description: 'model.gpt-4o.description',
    contextLength: 4096,
    inputPrice: 0,
    features: ['Synthetic Data', 'Open Source'],
  },
  {
    id: 'llama-3.1-nemotron-70b-instruct',
    name: 'Llama 3.1 Nemotron 70B',
    provider: 'nvidia',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.12,
    features: ['Aligned', 'Open Source'],
  },
  // === AI21 Labs 以色列(1 个) ===
  {
    id: 'jamba-1-5-large',
    name: 'Jamba 1.5 Large',
    provider: 'ai21',
    description: 'model.gpt-4o.description',
    contextLength: 256000,
    inputPrice: 2.0,
    features: ['SSM-Transformer', 'Long Context'],
  },
  // === Microsoft 微软 Phi 系列(2 个) ===
  {
    id: 'phi-4',
    name: 'Phi 4',
    provider: 'microsoft',
    description: 'model.gpt-4o.description',
    contextLength: 16384,
    inputPrice: 0.07,
    features: ['Small', 'Reasoning'],
  },
  {
    id: 'phi-3.5-mini-instruct',
    name: 'Phi 3.5 Mini',
    provider: 'microsoft',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.075,
    features: ['Small', 'Fast'],
  },
  // === Perplexity 美国搜索引擎(2 个) ===
  {
    id: 'sonar-large',
    name: 'Sonar Large',
    provider: 'perplexity',
    description: 'model.gpt-4o.description',
    contextLength: 127072,
    inputPrice: 2.0,
    features: ['Search', 'Realtime'],
  },
  {
    id: 'sonar-small',
    name: 'Sonar Small',
    provider: 'perplexity',
    description: 'model.gpt-4o.description',
    contextLength: 127072,
    inputPrice: 0.2,
    features: ['Search', 'Fast'],
  },
  // === AWS Amazon Nova(2 个) ===
  {
    id: 'amazon-nova-pro',
    name: 'Amazon Nova Pro',
    provider: 'aws',
    description: 'model.gpt-4o.description',
    contextLength: 300000,
    inputPrice: 0.8,
    features: ['Multimodal', 'Long Context'],
  },
  {
    id: 'amazon-nova-lite',
    name: 'Amazon Nova Lite',
    provider: 'aws',
    description: 'model.gpt-4o.description',
    contextLength: 300000,
    inputPrice: 0.06,
    features: ['Fast', 'Affordable'],
  },
  // === AWS Bedrock 聚合(2 个) ===
  {
    id: 'bedrock/anthropic.claude-3-5-sonnet-20241022-v2',
    name: 'Bedrock Claude 3.5 Sonnet v2',
    provider: 'bedrock',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 200000,
    inputPrice: 3.0,
    features: ['Reasoning', 'Multimodal'],
  },
  {
    id: 'bedrock/meta.llama3-1-405b-instruct-v1',
    name: 'Bedrock Llama 3.1 405B',
    provider: 'bedrock',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 3.0,
    features: ['Open Source', 'Reasoning'],
  },
  // === Microsoft Azure OpenAI(2 个) ===
  {
    id: 'azure/gpt-4o',
    name: 'Azure GPT-4o',
    provider: 'azure',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 2.5,
    features: ['Vision', 'Multimodal'],
  },
  {
    id: 'azure/gpt-4o-mini',
    name: 'Azure GPT-4o mini',
    provider: 'azure',
    description: 'model.gpt-4o-mini.description',
    contextLength: 128000,
    inputPrice: 0.15,
    features: ['Fast', 'Affordable'],
  },
  // === OpenRouter 聚合平台(2 个) ===
  {
    id: 'openrouter/auto',
    name: 'OpenRouter Auto',
    provider: 'openrouter',
    description: 'model.openrouter-auto.description',
    contextLength: 200000,
    inputPrice: 0,
    features: ['Auto-Route', 'Multi-Provider'],
  },
  {
    id: 'openrouter/anthropic/claude-3.5-sonnet',
    name: 'OR Claude 3.5 Sonnet',
    provider: 'openrouter',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 200000,
    inputPrice: 3.0,
    features: ['Reasoning', 'Vision'],
  },
  // === HuggingFace 推理(1 个) ===
  {
    id: 'huggingface/meta-llama/Llama-3.3-70B-Instruct',
    name: 'HF Llama 3.3 70B',
    provider: 'huggingface',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.59,
    features: ['Open Source', 'Inference API'],
  },
  // === Replicate 推理(1 个) ===
  {
    id: 'replicate/meta/llama-3-70b-instruct',
    name: 'Replicate Llama 3 70B',
    provider: 'replicate',
    description: 'model.gpt-4o.description',
    contextLength: 8192,
    inputPrice: 0.6,
    features: ['Open Source', 'Inference API'],
  },
  // === Stability AI 美国(1 个) ===
  {
    id: 'stablelm-2-12b-chat',
    name: 'StableLM 2 12B',
    provider: 'stability',
    description: 'model.gpt-4o.description',
    contextLength: 16384,
    inputPrice: 0,
    features: ['Open Source', 'Multilingual'],
  },
  // === Inflection AI 美国 Pi 助手(2 个) ===
  {
    id: 'inflection-3-pi',
    name: 'Inflection 3 Pi',
    provider: 'inflection',
    description: 'model.gpt-4o.description',
    contextLength: 8000,
    inputPrice: 1.0,
    features: ['Conversational', 'Empathetic'],
  },
  {
    id: 'inflection-3-productivity',
    name: 'Inflection 3 Productivity',
    provider: 'inflection',
    description: 'model.gpt-4o.description',
    contextLength: 8000,
    inputPrice: 1.0,
    features: ['Productivity', 'Writing'],
  },
  // === IBM watsonx Granite(2 个) ===
  {
    id: 'watsonx/granite-3-8b-instruct',
    name: 'Granite 3 8B',
    provider: 'ibm',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.2,
    features: ['Open Source', 'Enterprise'],
  },
  {
    id: 'watsonx/granite-3-2b-instruct',
    name: 'Granite 3 2B',
    provider: 'ibm',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.05,
    features: ['Small', 'Enterprise'],
  },
  // === Cerebras 美国 推理加速(2 个) ===
  {
    id: 'cerebras/llama3.1-8b',
    name: 'Cerebras Llama 3.1 8B',
    provider: 'cerebras',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.1,
    features: ['Ultra Fast', 'Open Source'],
  },
  {
    id: 'cerebras/llama3.1-70b',
    name: 'Cerebras Llama 3.1 70B',
    provider: 'cerebras',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.7,
    features: ['Ultra Fast', 'Open Source'],
  },
  // === SambaNova 美国 推理加速(2 个) ===
  {
    id: 'sambanova/llama-3.1-70b-instruct',
    name: 'SambaNova Llama 3.1 70B',
    provider: 'sambanova',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.7,
    features: ['Fast', 'Open Source'],
  },
  {
    id: 'sambanova/llama-3.1-405b-instruct',
    name: 'SambaNova Llama 3.1 405B',
    provider: 'sambanova',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 3.0,
    features: ['Fast', 'Reasoning'],
  },
  // === Snowflake Arctic(1 个) ===
  {
    id: 'snowflake-arctic',
    name: 'Snowflake Arctic',
    provider: 'snowflake',
    description: 'model.gpt-4o.description',
    contextLength: 4096,
    inputPrice: 0,
    features: ['Open Source', 'Enterprise'],
  },
  // === DeepInfra 美国 推理(1 个) ===
  {
    id: 'deepinfra/meta-llama/Llama-3.3-70B-Instruct',
    name: 'DeepInfra Llama 3.3 70B',
    provider: 'deepinfra',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.27,
    features: ['Open Source', 'Affordable'],
  },
  // === Aleph Alpha 德国(2 个) ===
  {
    id: 'luminous-base',
    name: 'Luminous Base',
    provider: 'alephalpha',
    description: 'model.gpt-4o.description',
    contextLength: 2048,
    inputPrice: 0,
    features: ['Multilingual', 'European'],
  },
  {
    id: 'luminous-supreme',
    name: 'Luminous Supreme',
    provider: 'alephalpha',
    description: 'model.gpt-4o.description',
    contextLength: 2048,
    inputPrice: 0,
    features: ['Multilingual', 'European', 'Multimodal'],
  },
  // === NousResearch 美国 Hermes 系列(2 个) ===
  {
    id: 'nous-hermes-2-mixtral-8x7b-dpo',
    name: 'Nous Hermes 2 Mixtral 8x7B',
    provider: 'nous',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.27,
    features: ['Open Source', 'Fine-Tuned'],
  },
  {
    id: 'nous-hermes-3-llama-3.1-405b',
    name: 'Nous Hermes 3 Llama 3.1 405B',
    provider: 'nous',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 3.0,
    features: ['Open Source', 'Fine-Tuned', 'Reasoning'],
  },
  // === Google Vertex AI(2 个) ===
  {
    id: 'vertex/claude-3-5-sonnet',
    name: 'Vertex Claude 3.5 Sonnet',
    provider: 'vertexai',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 200000,
    inputPrice: 3.0,
    features: ['Enterprise', 'Reasoning'],
  },
  {
    id: 'vertex/gemini-1.5-pro',
    name: 'Vertex Gemini 1.5 Pro',
    provider: 'vertexai',
    description: 'model.gemini-2-flash.description',
    contextLength: 2000000,
    inputPrice: 1.25,
    features: ['Enterprise', 'Long Context'],
  },
  // === Microsoft Copilot / Bing Chat(2 个) ===
  {
    id: 'microsoft-copilot',
    name: 'Microsoft Copilot',
    provider: 'copilot',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Search', 'Assistant', 'Free'],
  },
  {
    id: 'bing-chat-creative',
    name: 'Bing Chat Creative',
    provider: 'bing',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Search', 'Creative'],
  },
  // === Qwen 通义千问(4 个) ===
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    provider: 'qwen',
    description: 'model.gpt-4o.description',
    contextLength: 131072,
    inputPrice: 0.4,
    features: ['Chinese-Optimized', 'Reasoning'],
  },
  {
    id: 'qwen-max',
    name: 'Qwen Max',
    provider: 'qwen',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 1.6,
    features: ['Chinese-Optimized', 'Frontier'],
  },
  {
    id: 'qwen-turbo',
    name: 'Qwen Turbo',
    provider: 'qwen',
    description: 'model.gpt-4o.description',
    contextLength: 1000000,
    inputPrice: 0.05,
    features: ['Fast', 'Affordable'],
  },
  {
    id: 'qwen2.5-72b-instruct',
    name: 'Qwen2.5 72B Instruct',
    provider: 'qwen',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.4,
    features: ['Open Source', 'Bilingual'],
  },
  // === Zhipu 智谱(3 个) ===
  {
    id: 'glm-4-plus',
    name: 'GLM-4 Plus',
    provider: 'zhipu',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.7,
    features: ['Chinese-Optimized', 'Reasoning'],
  },
  {
    id: 'glm-4.5',
    name: 'GLM-4.5',
    provider: 'zhipu',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.6,
    features: ['Chinese-Optimized', 'Frontier'],
  },
  {
    id: 'glm-4-air',
    name: 'GLM-4 Air',
    provider: 'zhipu',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.1,
    features: ['Fast', 'Affordable'],
  },
  // === Moonshot 月之暗面(3 个) ===
  {
    id: 'moonshot-v1-8k',
    name: 'Moonshot v1 8K',
    provider: 'moonshot',
    description: 'model.gpt-4o.description',
    contextLength: 8192,
    inputPrice: 1.2,
    features: ['Long Context', 'Chinese-Optimized'],
  },
  {
    id: 'moonshot-v1-32k',
    name: 'Moonshot v1 32K',
    provider: 'moonshot',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 2.4,
    features: ['Long Context', 'Chinese-Optimized'],
  },
  {
    id: 'kimi-k2',
    name: 'Kimi K2',
    provider: 'moonshot',
    description: 'model.gpt-4o.description',
    contextLength: 131072,
    inputPrice: 0.55,
    features: ['Long Context', 'Reasoning'],
  },
  // === Doubao 豆包(2 个) ===
  {
    id: 'doubao-1-6-pro',
    name: 'Doubao 1.6 Pro',
    provider: 'doubao',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.11,
    features: ['Chinese-Optimized', 'Multimodal'],
  },
  {
    id: 'doubao-pro-32k',
    name: 'Doubao Pro 32K',
    provider: 'doubao',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.05,
    features: ['Chinese-Optimized', 'Fast'],
  },
  // === StepFun 阶跃星辰(3 个) ===
  {
    id: 'stepfun/step-3.7-flash',
    name: 'Step 3.7 Flash',
    provider: 'stepfun',
    description: 'model.stepfun-3-7-flash.description',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Plan', 'Fast', 'Chinese-Optimized'],
  },
  {
    id: 'stepfun/step-3.5-flash',
    name: 'Step 3.5 Flash',
    provider: 'stepfun',
    description: 'model.stepfun-3-5-flash.description',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Plan', 'Fast'],
  },
  {
    id: 'stepfun/step-router-v1',
    name: 'Step Router v1',
    provider: 'stepfun',
    description: 'model.stepfun-router-v1.description',
    contextLength: 128000,
    inputPrice: 0,
    features: ['Plan', 'Auto-Route'],
  },
  // === Tencent Hunyuan 腾讯混元(2 个) ===
  {
    id: 'hunyuan-pro',
    name: 'Hunyuan Pro',
    provider: 'hunyuan',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.45,
    features: ['Chinese-Optimized', 'Reasoning'],
  },
  {
    id: 'hunyuan-turbo',
    name: 'Hunyuan Turbo',
    provider: 'hunyuan',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.1,
    features: ['Fast', 'Affordable'],
  },
  // === Baidu Wenxin 百度文心一言(2 个) ===
  {
    id: 'ernie-4.0-turbo-8k',
    name: 'ERNIE 4.0 Turbo',
    provider: 'wenxin',
    description: 'model.gpt-4o.description',
    contextLength: 8192,
    inputPrice: 0.5,
    features: ['Chinese-Optimized', 'Multimodal'],
  },
  {
    id: 'ernie-speed-128k',
    name: 'ERNIE Speed 128K',
    provider: 'wenxin',
    description: 'model.gpt-4o.description',
    contextLength: 128000,
    inputPrice: 0.05,
    features: ['Long Context', 'Fast'],
  },
  // === MiniMax(2 个) ===
  {
    id: 'abab6.5s-chat',
    name: 'ABAB 6.5s Chat',
    provider: 'minimax',
    description: 'model.gpt-4o.description',
    contextLength: 245760,
    inputPrice: 0.1,
    features: ['Long Context', 'Chinese-Optimized'],
  },
  {
    id: 'minimax-text-01',
    name: 'MiniMax Text 01',
    provider: 'minimax',
    description: 'model.gpt-4o.description',
    contextLength: 1000000,
    inputPrice: 0.1,
    features: ['Ultra Long Context', 'Frontier'],
  },
  // === Baichuan 百川(1 个) ===
  {
    id: 'baichuan-4-turbo',
    name: 'Baichuan 4 Turbo',
    provider: 'baichuan',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.4,
    features: ['Chinese-Optimized', 'Reasoning'],
  },
  // === iFlyTek Spark 讯飞星火(1 个) ===
  {
    id: 'spark-v4',
    name: 'Spark V4',
    provider: 'spark',
    description: 'model.gpt-4o.description',
    contextLength: 8192,
    inputPrice: 0.4,
    features: ['Chinese-Optimized', 'Multimodal'],
  },
  // === 零一万物(1 个) ===
  {
    id: 'yi-large',
    name: 'Yi Large',
    provider: 'yi',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.3,
    features: ['Bilingual', 'Reasoning'],
  },
  // === 商汤 SenseNova(1 个) ===
  {
    id: 'sensenova-5',
    name: 'SenseNova 5',
    provider: 'sensenova',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.3,
    features: ['Chinese-Optimized', 'Multimodal'],
  },
  // === 天工 Skywork(1 个) ===
  {
    id: 'skywork-4',
    name: 'Skywork 4',
    provider: 'skywork',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.2,
    features: ['Bilingual', 'Reasoning'],
  },
  // === InternLM 书生(1 个) ===
  {
    id: 'internlm2.5-20b',
    name: 'InternLM 2.5 20B',
    provider: 'internlm',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0,
    features: ['Open Source', 'Chinese-Optimized'],
  },
  // === 国际推理/云平台扩展(每个厂商 1 个代表模型) ===
  // Novita AI 美国 推理平台
  {
    id: 'novita/meta-llama/llama-3.3-70b-instruct',
    name: 'Novita Llama 3.3 70B',
    provider: 'novita',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.39,
    features: ['Affordable', 'Open Source'],
  },
  // Lambda Labs 美国 GPU 推理
  {
    id: 'lambda/llama-3.3-70b-instruct',
    name: 'Lambda Llama 3.3 70B',
    provider: 'lambda',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.5,
    features: ['Open Source', 'GPU Inference'],
  },
  // Baseten 美国 推理平台
  {
    id: 'baseten/llama-3.3-70b-instruct',
    name: 'Baseten Llama 3.3 70B',
    provider: 'baseten',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.6,
    features: ['Open Source', 'Fast'],
  },
  // Crusoe 美国 云推理
  {
    id: 'crusoe/llama-3.3-70b-instruct',
    name: 'Crusoe Llama 3.3 70B',
    provider: 'crusoe',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.55,
    features: ['Open Source', 'Green Compute'],
  },
  // Targon 美国 推理平台
  {
    id: 'targon/llama-3.3-70b-instruct',
    name: 'Targon Llama 3.3 70B',
    provider: 'targon',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.5,
    features: ['Open Source', 'Affordable'],
  },
  // CentML 加拿大 推理优化
  {
    id: 'centml/llama-3.3-70b-instruct',
    name: 'CentML Llama 3.3 70B',
    provider: 'centml',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.4,
    features: ['Open Source', 'Optimized'],
  },
  // Nebius 荷兰 推理云
  {
    id: 'nebius/meta-llama/Llama-3.3-70B-Instruct',
    name: 'Nebius Llama 3.3 70B',
    provider: 'nebius',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.46,
    features: ['Open Source', 'EU Cloud'],
  },
  // Ollama 本地推理
  {
    id: 'ollama/llama3.3:70b',
    name: 'Ollama Llama 3.3 70B',
    provider: 'ollama',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0,
    features: ['Local', 'Open Source'],
  },
  // Upstage 韩国 Solar
  {
    id: 'upstage/solar-pro',
    name: 'Solar Pro',
    provider: 'upstage',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.5,
    features: ['Korean-Optimized', 'Reasoning'],
  },
  // LeptonAI 美国 推理平台
  {
    id: 'leptonai/llama3.3-70b',
    name: 'LeptonAI Llama 3.3 70B',
    provider: 'leptonai',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.5,
    features: ['Open Source', 'Fast'],
  },
  // Hyperbolic 美国 推理平台
  {
    id: 'hyperbolic/meta-llama/Meta-Llama-3.3-70B-Instruct',
    name: 'Hyperbolic Llama 3.3 70B',
    provider: 'hyperbolic',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.4,
    features: ['Open Source', 'Affordable'],
  },
  // Featherless 美国 推理平台
  {
    id: 'featherless/qwen/Qwen2.5-72B-Instruct',
    name: 'Featherless Qwen2.5 72B',
    provider: 'featherless',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.4,
    features: ['Open Source', 'Affordable'],
  },
  // Parasail 美国 推理平台
  {
    id: 'parasail/llama3.3-70b-instruct',
    name: 'Parasail Llama 3.3 70B',
    provider: 'parasail',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.45,
    features: ['Open Source', 'Fast'],
  },
  // OpenWebUI 本地推理 UI
  {
    id: 'openwebui/llama3.3-70b',
    name: 'OpenWebUI Llama 3.3 70B',
    provider: 'openwebui',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0,
    features: ['Local', 'Self-Hosted'],
  },
  // LM Studio 本地推理
  {
    id: 'lmstudio/llama-3.3-70b',
    name: 'LM Studio Llama 3.3 70B',
    provider: 'lmstudio',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0,
    features: ['Local', 'Desktop'],
  },
  // Friendli 韩国 推理优化
  {
    id: 'friendli/meta-llama-3.3-70b-instruct',
    name: 'Friendli Llama 3.3 70B',
    provider: 'friendli',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.5,
    features: ['Open Source', 'Optimized'],
  },
  // Anyscale 美国 推理平台
  {
    id: 'anyscale/meta-llama/Llama-3.3-70B-Instruct',
    name: 'Anyscale Llama 3.3 70B',
    provider: 'anyscale',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.5,
    features: ['Open Source', 'Scalable'],
  },
  // Infermatic 美国 推理平台
  {
    id: 'infermatic/llama-3.3-70b-instruct',
    name: 'Infermatic Llama 3.3 70B',
    provider: 'infermatic',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.5,
    features: ['Open Source', 'Fast'],
  },
  // Replit 美国 代码模型
  {
    id: 'replit/replit-code-v1.5-3b',
    name: 'Replit Code V1.5 3B',
    provider: 'replit',
    description: 'model.gpt-4o.description',
    contextLength: 4096,
    inputPrice: 0.1,
    features: ['Coding', 'Small'],
  },
  // === 国内推理/云平台扩展 ===
  // SiliconCloud 硅基流动
  {
    id: 'siliconcloud/Qwen/Qwen2.5-72B-Instruct',
    name: 'SiliconCloud Qwen2.5 72B',
    provider: 'siliconcloud',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.4,
    features: ['Open Source', 'Chinese-Optimized'],
  },
  // ModelScope 阿里魔搭
  {
    id: 'modelscope/Qwen/Qwen2.5-72B-Instruct',
    name: 'ModelScope Qwen2.5 72B',
    provider: 'modelscope',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0,
    features: ['Open Source', 'Free Tier'],
  },
  // PPIO 平行云
  {
    id: 'ppio/qwen/qwen2.5-72b-instruct',
    name: 'PPIO Qwen2.5 72B',
    provider: 'ppio',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.35,
    features: ['Open Source', 'Affordable'],
  },
  // Volcengine 火山引擎
  {
    id: 'volcengine/doubao-pro-32k',
    name: 'Volcengine Doubao Pro 32K',
    provider: 'volcengine',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.05,
    features: ['Long Context', 'Affordable'],
  },
  // Bailian 阿里百炼
  {
    id: 'bailian/qwen-max',
    name: 'Bailian Qwen Max',
    provider: 'bailian',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 1.6,
    features: ['Frontier', 'Chinese-Optimized'],
  },
  // BAAI 智源 FlagModels
  {
    id: 'baai/aquila2-34b',
    name: 'Aquila2 34B',
    provider: 'baai',
    description: 'model.gpt-4o.description',
    contextLength: 4096,
    inputPrice: 0,
    features: ['Open Source', 'Chinese-Optimized'],
  },
  // TII 阿联酋 Falcon
  {
    id: 'tii/falcon3-10b-instruct',
    name: 'Falcon3 10B Instruct',
    provider: 'tii',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0,
    features: ['Open Source', 'Multilingual'],
  },
  // Liquid AI 美国 LFM
  {
    id: 'liquid/lfm-40b',
    name: 'Liquid LFM 40B MoE',
    provider: 'liquid',
    description: 'model.gpt-4o.description',
    contextLength: 32768,
    inputPrice: 0.5,
    features: ['Hybrid SSM', 'Efficient'],
  },
  // Ai2 Allen AI Olmo
  {
    id: 'ai2/olmo-2-1124-7b-instruct',
    name: 'OLMo 2 7B Instruct',
    provider: 'ai2',
    description: 'model.gpt-4o.description',
    contextLength: 4096,
    inputPrice: 0,
    features: ['Open Source', 'Research'],
  },

  // === 2026-07 新模型(2026-07 收录) ===
  // OpenAI 5.6 系列(3 个分工变体)+ GPT-Red 研究预览
  {
    id: 'gpt-5.6-sol',
    name: 'GPT-5.6 Sol (OpenAI 旗舰通用)',
    provider: 'openai',
    description: 'model.gpt-4o.description',
    contextLength: 1048576,
    inputPrice: 5.0,
    features: ['Frontier', 'Multimodal', 'Long Context'],
  },
  {
    id: 'gpt-5.6-terra',
    name: 'GPT-5.6 Terra (OpenAI 多模态)',
    provider: 'openai',
    description: 'model.gpt-4o.description',
    contextLength: 1048576,
    inputPrice: 7.5,
    features: ['Multimodal', 'Vision', 'Long Context'],
  },
  {
    id: 'gpt-5.6-luna',
    name: 'GPT-5.6 Luna (OpenAI 代码专精)',
    provider: 'openai',
    description: 'model.gpt-4o.description',
    contextLength: 524288,
    inputPrice: 6.0,
    features: ['Coding', 'Long Context', 'Frontier'],
  },
  {
    id: 'gpt-red',
    name: 'GPT-Red (OpenAI 推理研究预览)',
    provider: 'openai',
    description: 'model.gpt-4o.description',
    contextLength: 524288,
    inputPrice: 15.0,
    features: ['Reasoning', 'Research', 'Long Context'],
  },
  // Anthropic 新一代
  {
    id: 'claude-sonnet-5',
    name: 'Claude Sonnet 5 (Anthropic 新旗舰)',
    provider: 'anthropic',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 524288,
    inputPrice: 5.0,
    features: ['Frontier', 'Long Context', 'Reasoning'],
  },
  {
    id: 'claude-opus-4.8',
    name: 'Claude Opus 4.8 (Anthropic 深度推理)',
    provider: 'anthropic',
    description: 'model.claude-3-5-sonnet.description',
    contextLength: 524288,
    inputPrice: 20.0,
    features: ['Reasoning', 'PhD-Level', 'Long Context'],
  },
  // Google Gemini 3.5
  {
    id: 'gemini-3.5-pro',
    name: 'Gemini 3.5 Pro (Google 多模态旗舰)',
    provider: 'google',
    description: 'model.gemini-2-flash.description',
    contextLength: 2097152,
    inputPrice: 2.0,
    features: ['Multimodal', 'Long Context', 'Frontier'],
  },
  // xAI Grok 4.5
  {
    id: 'grok-4.5',
    name: 'Grok 4.5 (xAI 实时增强)',
    provider: 'xai',
    description: 'model.gpt-4o.description',
    contextLength: 262144,
    inputPrice: 4.0,
    features: ['Real-Time', 'Reasoning', 'Long Context'],
  },
  // DeepSeek V4 系列
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro (国产开源旗舰)',
    provider: 'deepseek',
    description: 'model.gpt-4o.description',
    contextLength: 131072,
    inputPrice: 0.6,
    features: ['Open Source', 'Reasoning', 'Frontier'],
  },
  {
    id: 'deepseek-v4-flash',
    name: 'DeepSeek V4 Flash (国产开源快版)',
    provider: 'deepseek',
    description: 'model.gpt-4o.description',
    contextLength: 131072,
    inputPrice: 0.15,
    features: ['Open Source', 'Fast', 'Affordable'],
  },
  // 智谱 GLM-5.2
  {
    id: 'glm-5.2',
    name: 'GLM-5.2 (智谱清言新一代)',
    provider: 'zhipu',
    description: 'model.gpt-4o.description',
    contextLength: 262144,
    inputPrice: 1.0,
    features: ['Chinese-Optimized', 'Frontier', 'Long Context'],
  },
  // Qwen3.7 Max
  {
    id: 'qwen3.7-max',
    name: 'Qwen3.7 Max (阿里通义千问旗舰)',
    provider: 'qwen',
    description: 'model.gpt-4o.description',
    contextLength: 262144,
    inputPrice: 2.0,
    features: ['Chinese-Optimized', 'Frontier', 'Long Context'],
  },
  // 腾讯混元 3 代
  {
    id: 'hunyuan-hy3',
    name: 'Hunyuan Hy3 (腾讯混元 3 代)',
    provider: 'hunyuan',
    description: 'model.gpt-4o.description',
    contextLength: 262144,
    inputPrice: 1.5,
    features: ['Chinese-Optimized', 'Multimodal', 'Long Context'],
  },
  // Moonshot Kimi K3 长上下文旗舰
  {
    id: 'kimi-k3',
    name: 'Kimi K3 (Moonshot 长上下文旗舰)',
    provider: 'moonshot',
    description: 'model.gpt-4o.description',
    contextLength: 2097152,
    inputPrice: 0.8,
    features: ['Long Context', 'Chinese-Optimized', 'Frontier'],
  },
  // 国内新增 3 家新势力
  {
    id: 'ornith-1.0',
    name: 'Ornith 1.0 (国产新势力)',
    provider: 'ornith',
    description: 'model.gpt-4o.description',
    contextLength: 131072,
    inputPrice: 0.8,
    features: ['Chinese-Optimized', 'Frontier', 'Fast'],
  },
  {
    id: 'codebrain-1',
    name: 'CodeBrain-1 (代码专精模型)',
    provider: 'codebrain',
    description: 'model.gpt-4o.description',
    contextLength: 65536,
    inputPrice: 0.3,
    features: ['Coding', 'Affordable', 'Fast'],
  },
  {
    id: 'mai-thinking-1',
    name: 'MAI-Thinking-1 (深度推理模型)',
    provider: 'mai',
    description: 'model.gpt-4o.description',
    contextLength: 131072,
    inputPrice: 1.2,
    features: ['Reasoning', 'PhD-Level', 'Deep-Thinking'],
  },
]

export const MODEL_DESCRIPTIONS: Record<string, { description: string; features: string[] }> = {
  'stepfun/step-3.7-flash': {
    description: 'model.stepfun-3-7-flash.description',
    features: ['Plan', 'Fast', 'Chinese-Optimized'],
  },
  'stepfun/step-3.5-flash': {
    description: 'model.stepfun-3-5-flash.description',
    features: ['Plan', 'Fast'],
  },
  'stepfun/step-router-v1': {
    description: 'model.stepfun-router-v1.description',
    features: ['Plan', 'Auto-Route'],
  },
  'agnes/gpt-4o': {
    description: 'model.agnes-gpt-4o.description',
    features: ['Plan', 'Multimodal'],
  },
  'groq/llama-3.3-70b-versatile': {
    description: 'model.groq-llama-3-3-70b.description',
    features: ['Free', 'Fast', 'Open Source'],
  },
  'gemini/gemini-1.5-flash': {
    description: 'model.gemini-1-5-flash.description',
    features: ['Free', 'Long Context', 'Multimodal'],
  },
  'openrouter/auto': {
    description: 'model.openrouter-auto.description',
    features: ['Free', 'Auto-Route', 'Multi-Provider'],
  },
  'gpt-4o': {
    description: 'model.gpt-4o.description',
    features: ['Vision', 'Function Calling', 'Multimodal'],
  },
  'gpt-4o-mini': { description: 'model.gpt-4o-mini.description', features: ['Fast', 'Affordable'] },
  'claude-3-5-sonnet': {
    description: 'model.claude-3-5-sonnet.description',
    features: ['Reasoning', 'Writing', 'Vision'],
  },
  'gemini-2-flash': {
    description: 'model.gemini-2-flash.description',
    features: ['Long Context', 'Multimodal'],
  },
}

/**
 * 为 FALLBACK_MODELS / API 返回的模型统一补充 highlight / popularity 元数据
 * - highlight: 命中 HIGHLIGHT_MODEL_IDS 标记为 true(用于"推荐位"徽章 + 推荐排序加权)
 * - popularity: highlight 模型 88,其余 50(用于稳定排序,避免随机)
 */
function enrichModel(m: Model): Model {
  const highlight = HIGHLIGHT_MODEL_IDS.has(m.id)
  return {
    ...m,
    highlight,
    popularity: highlight ? 88 : 50,
  }
}

/** 应用 highlight/popularity 元数据到模型列表(纯函数,不修改入参) */
export function enrichModels(list: Model[]): Model[] {
  return list.map(enrichModel)
}

export async function fetchModels(): Promise<Model[]> {
  try {
    const res = await fetch('/api/llm/models', {
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as {
      models: Array<{
        id: string
        name: string
        provider: Provider
        context_length: number
        input_price: number
      }>
    }
    const list: Model[] = data.models.map((m) => {
      const desc = MODEL_DESCRIPTIONS[m.id] ?? { description: '', features: [] }
      return {
        id: m.id,
        name: m.name,
        provider: m.provider,
        description: desc.description,
        contextLength: m.context_length,
        inputPrice: m.input_price,
        features: desc.features,
      }
    })
    return enrichModels(list)
  } catch {
    return enrichModels(FALLBACK_MODELS)
  }
}

/**
 * 预设 prompt:用于详情对话框"快捷试用"区,降低用户试用门槛
 * 选取跨模型、跨场景的 4 个常见 prompt,覆盖"打招呼/创意写作/翻译/编程"
 */
export const PRESET_PROMPTS: PresetPrompt[] = [
  {
    key: 'greet',
    label: '打招呼',
    content: '你好,请简单介绍一下你自己,以及你最擅长处理哪类任务?',
  },
  {
    key: 'creative',
    label: '创意写作',
    content: '请用 200 字以内,写一段关于"清晨海边"的散文,要求意境优美,语言精炼。',
  },
  {
    key: 'translate',
    label: '中英翻译',
    content: '请将下面这句中文翻译成英文:"科技的发展应当服务于人类福祉,而非取代人类的判断与情感。"',
  },
  {
    key: 'code',
    label: '编程示例',
    content:
      '请用 TypeScript 写一个函数 debounce,接受函数和等待时间,返回防抖后的函数。要求含类型注解。',
  },
]

/**
 * 收藏模型工具:基于 localStorage 持久化用户收藏的模型 id 集合
 *
 * 设计:
 * - 仅在客户端调用(SSR 场景由调用方判断 typeof window)
 * - 读取失败/空时返回空集合,不抛错
 * - 写入失败静默(隐私模式可能禁用 localStorage)
 */
export function getFavoriteModelIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = window.localStorage.getItem(FAVORITE_MODELS_STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

export function setFavoriteModelIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAVORITE_MODELS_STORAGE_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    // 隐私模式禁用 localStorage 时静默失败
  }
}

export function toggleFavoriteModel(modelId: string): Set<string> {
  const ids = getFavoriteModelIds()
  if (ids.has(modelId)) {
    ids.delete(modelId)
  } else {
    ids.add(modelId)
  }
  setFavoriteModelIds(ids)
  return ids
}

// LIVE_2026_MODELS:供 AiNewsStrip 兜底渲染的 2026-07 最新发布模型列表
// 取 FALLBACK_MODELS 前 6 条,字段形态与 AiNewsStrip 中 FallbackItem 期望的 id/name/description/releasedAt/provider 对齐
export const LIVE_2026_MODELS: Array<{
  id: string
  name: string
  description: string
  releasedAt?: string
  provider: string
}> = FALLBACK_MODELS.slice(0, 6).map((m) => ({
  id: m.id,
  name: m.name,
  description: m.description ?? '',
  releasedAt: (m as { releasedAt?: string }).releasedAt,
  provider: m.provider,
}))
