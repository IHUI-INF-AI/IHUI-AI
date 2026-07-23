/**
 * 兜底模型列表(独立模块,纯数据,可在 SSR 和 CSR 中共享)
 *
 * 设计目的:
 *   - model-selector.tsx(AI 输入框客户端组件)
 *   - 其他需要展示完整厂商列表的 SSR 组件
 *   - 当 fetchModels() 失败或返回空时使用
 *
 * 与 apps/ai-service/app/routers/llm.py 的 default_models 保持一致
 * vendor 字段用于 BrandIcon 显示;inferVendor() 用于运行时修正
 */

export interface FallbackModel {
  value: string
  label: string
  /** 厂商代码(用于 BrandIcon,如 'openai'、'deepseek') */
  vendor: string
  /** 描述 i18n 键(可选) */
  descriptionKey?: string
}

export const FALLBACK_MODELS: FallbackModel[] = [
  // === 默认主力(与 ai-service default_models.json 第 1 位对齐)===
  { value: 'stepfun/step-router-v1', label: 'Step Router v1', vendor: 'stepfun' },
  // === 国际原厂 ===
  // OpenAI(7 个)
  { value: 'gpt-4o', label: 'GPT-4o', vendor: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini', vendor: 'openai' },
  { value: 'gpt-4.1', label: 'GPT-4.1', vendor: 'openai' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini', vendor: 'openai' },
  { value: 'o3', label: 'o3', vendor: 'openai' },
  { value: 'o3-mini', label: 'o3 mini', vendor: 'openai' },
  { value: 'o4-mini', label: 'o4 mini', vendor: 'openai' },
  // Anthropic(5 个)
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', vendor: 'anthropic' },
  { value: 'claude-3-5-haiku', label: 'Claude 3.5 Haiku', vendor: 'anthropic' },
  { value: 'claude-3-7-sonnet', label: 'Claude 3.7 Sonnet', vendor: 'anthropic' },
  { value: 'claude-opus-4', label: 'Claude Opus 4', vendor: 'anthropic' },
  { value: 'claude-sonnet-4', label: 'Claude Sonnet 4', vendor: 'anthropic' },
  // Google Gemini(3 个)
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', vendor: 'google' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', vendor: 'google' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', vendor: 'google' },
  // Google Gemma 开源(2 个)
  { value: 'gemma-2-27b-it', label: 'Gemma 2 27B', vendor: 'gemma' },
  { value: 'gemma-2-9b-it', label: 'Gemma 2 9B', vendor: 'gemma' },
  // DeepSeek(3 个)
  { value: 'deepseek-chat', label: 'DeepSeek Chat', vendor: 'deepseek' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (R1)', vendor: 'deepseek' },
  { value: 'deepseek-v3', label: 'DeepSeek V3', vendor: 'deepseek' },
  // Meta Llama(2 个)
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', vendor: 'meta' },
  { value: 'llama-3.1-405b-instruct', label: 'Llama 3.1 405B', vendor: 'meta' },
  // Mistral AI 法国(3 个)
  { value: 'mistral-large-latest', label: 'Mistral Large', vendor: 'mistral' },
  { value: 'codestral-latest', label: 'Codestral', vendor: 'mistral' },
  { value: 'pixtral-large-latest', label: 'Pixtral Large', vendor: 'mistral' },
  // xAI Grok 埃隆·马斯克旗下(2 个)
  { value: 'grok-2', label: 'Grok 2', vendor: 'xai' },
  { value: 'grok-3', label: 'Grok 3', vendor: 'xai' },
  // Cohere 加拿大(2 个)
  { value: 'command-r-plus', label: 'Command R+', vendor: 'cohere' },
  { value: 'command-a', label: 'Command A', vendor: 'cohere' },
  // Nvidia 英伟达(2 个)
  { value: 'nemotron-4-340b-instruct', label: 'Nemotron 4 340B', vendor: 'nvidia' },
  { value: 'llama-3.1-nemotron-70b-instruct', label: 'Llama 3.1 Nemotron 70B', vendor: 'nvidia' },
  // AI21 Labs 以色列(1 个)
  { value: 'jamba-1-5-large', label: 'Jamba 1.5 Large', vendor: 'ai21' },
  // Microsoft 微软 Phi 系列(2 个)
  { value: 'phi-4', label: 'Phi 4', vendor: 'microsoft' },
  { value: 'phi-3.5-mini-instruct', label: 'Phi 3.5 Mini', vendor: 'microsoft' },
  // Perplexity 美国搜索引擎(2 个)
  { value: 'sonar-large', label: 'Sonar Large', vendor: 'perplexity' },
  { value: 'sonar-small', label: 'Sonar Small', vendor: 'perplexity' },
  // === 国际云平台/聚合平台 ===
  // AWS Amazon Nova(2 个)
  { value: 'amazon-nova-pro', label: 'Amazon Nova Pro', vendor: 'aws' },
  { value: 'amazon-nova-lite', label: 'Amazon Nova Lite', vendor: 'aws' },
  // AWS Bedrock 聚合(2 个)
  {
    value: 'bedrock/anthropic.claude-3-5-sonnet-20241022-v2',
    label: 'Bedrock Claude 3.5 Sonnet v2',
    vendor: 'bedrock',
  },
  {
    value: 'bedrock/meta.llama3-1-405b-instruct-v1',
    label: 'Bedrock Llama 3.1 405B',
    vendor: 'bedrock',
  },
  // Microsoft Azure OpenAI(2 个)
  { value: 'azure/gpt-4o', label: 'Azure GPT-4o', vendor: 'azure' },
  { value: 'azure/gpt-4o-mini', label: 'Azure GPT-4o mini', vendor: 'azure' },
  // OpenRouter 聚合平台(2 个)
  { value: 'openrouter/auto', label: 'OpenRouter Auto', vendor: 'openrouter' },
  {
    value: 'openrouter/anthropic/claude-3.5-sonnet',
    label: 'OR Claude 3.5 Sonnet',
    vendor: 'openrouter',
  },
  // HuggingFace 推理(1 个)
  {
    value: 'huggingface/meta-llama/Llama-3.3-70B-Instruct',
    label: 'HF Llama 3.3 70B',
    vendor: 'huggingface',
  },
  // Replicate 推理(1 个)
  {
    value: 'replicate/meta/llama-3-70b-instruct',
    label: 'Replicate Llama 3 70B',
    vendor: 'replicate',
  },
  // Stability AI 美国(1 个)
  { value: 'stablelm-2-12b-chat', label: 'StableLM 2 12B', vendor: 'stability' },
  // Inflection AI 美国 Pi 助手(2 个)
  { value: 'inflection-3-pi', label: 'Inflection 3 Pi', vendor: 'inflection' },
  { value: 'inflection-3-productivity', label: 'Inflection 3 Productivity', vendor: 'inflection' },
  // IBM watsonx Granite(2 个)
  { value: 'watsonx/granite-3-8b-instruct', label: 'Granite 3 8B', vendor: 'ibm' },
  { value: 'watsonx/granite-3-2b-instruct', label: 'Granite 3 2B', vendor: 'ibm' },
  // Cerebras 美国 推理加速(2 个)
  { value: 'cerebras/llama3.1-8b', label: 'Cerebras Llama 3.1 8B', vendor: 'cerebras' },
  { value: 'cerebras/llama3.1-70b', label: 'Cerebras Llama 3.1 70B', vendor: 'cerebras' },
  // SambaNova 美国 推理加速(2 个)
  {
    value: 'sambanova/llama-3.1-70b-instruct',
    label: 'SambaNova Llama 3.1 70B',
    vendor: 'sambanova',
  },
  {
    value: 'sambanova/llama-3.1-405b-instruct',
    label: 'SambaNova Llama 3.1 405B',
    vendor: 'sambanova',
  },
  // Snowflake Arctic(1 个)
  { value: 'snowflake-arctic', label: 'Snowflake Arctic', vendor: 'snowflake' },
  // DeepInfra 美国 推理(1 个)
  {
    value: 'deepinfra/meta-llama/Llama-3.3-70B-Instruct',
    label: 'DeepInfra Llama 3.3 70B',
    vendor: 'deepinfra',
  },
  // Aleph Alpha 德国(2 个)
  { value: 'luminous-base', label: 'Luminous Base', vendor: 'alephalpha' },
  { value: 'luminous-supreme', label: 'Luminous Supreme', vendor: 'alephalpha' },
  // NousResearch 美国 Hermes 系列(2 个)
  { value: 'nous-hermes-2-mixtral-8x7b-dpo', label: 'Nous Hermes 2 Mixtral 8x7B', vendor: 'nous' },
  { value: 'nous-hermes-3-llama-3.1-405b', label: 'Nous Hermes 3 Llama 3.1 405B', vendor: 'nous' },
  // Google Vertex AI(2 个)
  { value: 'vertex/claude-3-5-sonnet', label: 'Vertex Claude 3.5 Sonnet', vendor: 'vertexai' },
  { value: 'vertex/gemini-1.5-pro', label: 'Vertex Gemini 1.5 Pro', vendor: 'vertexai' },
  // Microsoft Copilot / Bing Chat(2 个)
  { value: 'microsoft-copilot', label: 'Microsoft Copilot', vendor: 'copilot' },
  { value: 'bing-chat-creative', label: 'Bing Chat Creative', vendor: 'bing' },
  // === 国内厂商 ===
  // Qwen 通义千问(4 个)
  { value: 'qwen-plus', label: 'Qwen Plus', vendor: 'qwen' },
  { value: 'qwen-max', label: 'Qwen Max', vendor: 'qwen' },
  { value: 'qwen-turbo', label: 'Qwen Turbo', vendor: 'qwen' },
  { value: 'qwen2.5-72b-instruct', label: 'Qwen2.5 72B Instruct', vendor: 'qwen' },
  // Zhipu 智谱(3 个)
  { value: 'glm-4-plus', label: 'GLM-4 Plus', vendor: 'zhipu' },
  { value: 'glm-4.5', label: 'GLM-4.5', vendor: 'zhipu' },
  { value: 'glm-4-air', label: 'GLM-4 Air', vendor: 'zhipu' },
  // Moonshot 月之暗面(3 个)
  { value: 'moonshot-v1-8k', label: 'Moonshot v1 8K', vendor: 'moonshot' },
  { value: 'moonshot-v1-32k', label: 'Moonshot v1 32K', vendor: 'moonshot' },
  { value: 'kimi-k2', label: 'Kimi K2', vendor: 'moonshot' },
  // Doubao 豆包(2 个)
  { value: 'doubao-1-6-pro', label: 'Doubao 1.6 Pro', vendor: 'doubao' },
  { value: 'doubao-pro-32k', label: 'Doubao Pro 32K', vendor: 'doubao' },
  // StepFun 阶跃星辰(2 个)
  { value: 'stepfun/step-3.7-flash', label: 'Step 3.7 Flash', vendor: 'stepfun' },
  { value: 'stepfun/step-3.5-flash', label: 'Step 3.5 Flash', vendor: 'stepfun' },
  // Tencent Hunyuan 腾讯混元(2 个)
  { value: 'hunyuan-pro', label: 'Hunyuan Pro', vendor: 'hunyuan' },
  { value: 'hunyuan-turbo', label: 'Hunyuan Turbo', vendor: 'hunyuan' },
  // Baidu Wenxin 百度文心一言(2 个)
  { value: 'ernie-4.0-turbo-8k', label: 'ERNIE 4.0 Turbo', vendor: 'wenxin' },
  { value: 'ernie-speed-128k', label: 'ERNIE Speed 128K', vendor: 'wenxin' },
  // MiniMax(2 个)
  { value: 'abab6.5s-chat', label: 'ABAB 6.5s Chat', vendor: 'minimax' },
  { value: 'minimax-text-01', label: 'MiniMax Text 01', vendor: 'minimax' },
  // Baichuan 百川(1 个)
  { value: 'baichuan-4-turbo', label: 'Baichuan 4 Turbo', vendor: 'baichuan' },
  // iFlyTek Spark 讯飞星火(1 个)
  { value: 'spark-v4', label: 'Spark V4', vendor: 'spark' },
  // 零一万物(1 个)
  { value: 'yi-large', label: 'Yi Large', vendor: 'yi' },
  // 商汤 SenseNova(1 个)
  { value: 'sensenova-5', label: 'SenseNova 5', vendor: 'sensenova' },
  // 天工 Skywork(1 个)
  { value: 'skywork-4', label: 'Skywork 4', vendor: 'skywork' },
  // InternLM 书生(1 个)
  { value: 'internlm2.5-20b', label: 'InternLM 2.5 20B', vendor: 'internlm' },
  // === 国际推理/云平台扩展(每个厂商 1 个代表模型) ===
  {
    value: 'novita/meta-llama/llama-3.3-70b-instruct',
    label: 'Novita Llama 3.3 70B',
    vendor: 'novita',
  },
  { value: 'lambda/llama-3.3-70b-instruct', label: 'Lambda Llama 3.3 70B', vendor: 'lambda' },
  { value: 'baseten/llama-3.3-70b-instruct', label: 'Baseten Llama 3.3 70B', vendor: 'baseten' },
  { value: 'crusoe/llama-3.3-70b-instruct', label: 'Crusoe Llama 3.3 70B', vendor: 'crusoe' },
  { value: 'targon/llama-3.3-70b-instruct', label: 'Targon Llama 3.3 70B', vendor: 'targon' },
  { value: 'centml/llama-3.3-70b-instruct', label: 'CentML Llama 3.3 70B', vendor: 'centml' },
  {
    value: 'nebius/meta-llama/Llama-3.3-70B-Instruct',
    label: 'Nebius Llama 3.3 70B',
    vendor: 'nebius',
  },
  { value: 'ollama/llama3.3:70b', label: 'Ollama Llama 3.3 70B', vendor: 'ollama' },
  { value: 'upstage/solar-pro', label: 'Solar Pro', vendor: 'upstage' },
  { value: 'leptonai/llama3.3-70b', label: 'LeptonAI Llama 3.3 70B', vendor: 'leptonai' },
  {
    value: 'hyperbolic/meta-llama/Meta-Llama-3.3-70B-Instruct',
    label: 'Hyperbolic Llama 3.3 70B',
    vendor: 'hyperbolic',
  },
  {
    value: 'featherless/qwen/Qwen2.5-72B-Instruct',
    label: 'Featherless Qwen2.5 72B',
    vendor: 'featherless',
  },
  { value: 'parasail/llama3.3-70b-instruct', label: 'Parasail Llama 3.3 70B', vendor: 'parasail' },
  { value: 'openwebui/llama3.3-70b', label: 'OpenWebUI Llama 3.3 70B', vendor: 'openwebui' },
  { value: 'lmstudio/llama-3.3-70b', label: 'LM Studio Llama 3.3 70B', vendor: 'lmstudio' },
  {
    value: 'friendli/meta-llama-3.3-70b-instruct',
    label: 'Friendli Llama 3.3 70B',
    vendor: 'friendli',
  },
  {
    value: 'anyscale/meta-llama/Llama-3.3-70B-Instruct',
    label: 'Anyscale Llama 3.3 70B',
    vendor: 'anyscale',
  },
  {
    value: 'infermatic/llama-3.3-70b-instruct',
    label: 'Infermatic Llama 3.3 70B',
    vendor: 'infermatic',
  },
  { value: 'replit/replit-code-v1.5-3b', label: 'Replit Code V1.5 3B', vendor: 'replit' },
  // === 国内推理/云平台扩展 ===
  {
    value: 'siliconcloud/Qwen/Qwen2.5-72B-Instruct',
    label: 'SiliconCloud Qwen2.5 72B',
    vendor: 'siliconcloud',
  },
  {
    value: 'modelscope/Qwen/Qwen2.5-72B-Instruct',
    label: 'ModelScope Qwen2.5 72B',
    vendor: 'modelscope',
  },
  { value: 'ppio/qwen/qwen2.5-72b-instruct', label: 'PPIO Qwen2.5 72B', vendor: 'ppio' },
  { value: 'volcengine/doubao-pro-32k', label: 'Volcengine Doubao Pro 32K', vendor: 'volcengine' },
  { value: 'bailian/qwen-max', label: 'Bailian Qwen Max', vendor: 'bailian' },
  { value: 'baai/aquila2-34b', label: 'Aquila2 34B', vendor: 'baai' },
  { value: 'tii/falcon3-10b-instruct', label: 'Falcon3 10B Instruct', vendor: 'tii' },
  { value: 'liquid/lfm-40b', label: 'Liquid LFM 40B MoE', vendor: 'liquid' },
  { value: 'ai2/olmo-2-1124-7b-instruct', label: 'OLMo 2 7B Instruct', vendor: 'ai2' },

  // === 2026-07 新模型(2026-07 收录) ===
  // OpenAI 5.6 系列(3 个分工变体)+ GPT-Red 研究预览
  { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol (OpenAI 旗舰通用)', vendor: 'openai' },
  { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra (OpenAI 多模态)', vendor: 'openai' },
  { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna (OpenAI 代码专精)', vendor: 'openai' },
  { value: 'gpt-red', label: 'GPT-Red (OpenAI 推理研究预览)', vendor: 'openai' },
  // Anthropic 新一代
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 (Anthropic 新旗舰)', vendor: 'anthropic' },
  { value: 'claude-opus-4.8', label: 'Claude Opus 4.8 (Anthropic 深度推理)', vendor: 'anthropic' },
  // Google Gemini 3.5
  { value: 'gemini-3.5-pro', label: 'Gemini 3.5 Pro (Google 多模态旗舰)', vendor: 'google' },
  // xAI Grok 4.5
  { value: 'grok-4.5', label: 'Grok 4.5 (xAI 实时增强)', vendor: 'xai' },
  // DeepSeek V4 系列
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro (国产开源旗舰)', vendor: 'deepseek' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash (国产开源快版)', vendor: 'deepseek' },
  // 智谱 GLM-5.2
  { value: 'glm-5.2', label: 'GLM-5.2 (智谱清言新一代)', vendor: 'zhipu' },
  // Qwen3.7 Max
  { value: 'qwen3.7-max', label: 'Qwen3.7 Max (阿里通义千问旗舰)', vendor: 'qwen' },
  // 腾讯混元 3 代
  { value: 'hunyuan-hy3', label: 'Hunyuan Hy3 (腾讯混元 3 代)', vendor: 'hunyuan' },
  // Moonshot Kimi K3 长上下文旗舰
  { value: 'kimi-k3', label: 'Kimi K3 (Moonshot 长上下文旗舰)', vendor: 'moonshot' },
  // 国内新增 3 家新势力
  { value: 'ornith-1.0', label: 'Ornith 1.0 (国产新势力)', vendor: 'ornith' },
  { value: 'codebrain-1', label: 'CodeBrain-1 (代码专精模型)', vendor: 'codebrain' },
  { value: 'mai-thinking-1', label: 'MAI-Thinking-1 (深度推理模型)', vendor: 'mai' },
]

/** 厂商代码 → 中英文显示名(用于下拉菜单分组标题) */
export const VENDOR_LABEL: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  deepseek: 'DeepSeek',
  meta: 'Meta',
  mistral: 'Mistral AI',
  xai: 'xAI Grok',
  cohere: 'Cohere',
  nvidia: 'Nvidia',
  ai21: 'AI21 Labs',
  microsoft: 'Microsoft',
  perplexity: 'Perplexity',
  groq: 'Groq',
  together: 'Together',
  fireworks: 'Fireworks',
  // 国际云平台/聚合平台
  aws: 'AWS',
  bedrock: 'AWS Bedrock',
  azure: 'Azure OpenAI',
  openrouter: 'OpenRouter',
  huggingface: 'HuggingFace',
  replicate: 'Replicate',
  stability: 'Stability AI',
  inflection: 'Inflection AI',
  ibm: 'IBM watsonx',
  cerebras: 'Cerebras',
  sambanova: 'SambaNova',
  snowflake: 'Snowflake',
  deepinfra: 'DeepInfra',
  alephalpha: 'Aleph Alpha',
  nous: 'NousResearch',
  vertexai: 'Google Vertex AI',
  gemma: 'Google Gemma',
  copilot: 'Microsoft Copilot',
  bing: 'Bing Chat',
  // 国际推理/云平台扩展
  novita: 'Novita AI',
  lambda: 'Lambda Labs',
  baseten: 'Baseten',
  crusoe: 'Crusoe',
  targon: 'Targon',
  centml: 'CentML',
  nebius: 'Nebius',
  ollama: 'Ollama',
  upstage: 'Upstage',
  leptonai: 'LeptonAI',
  hyperbolic: 'Hyperbolic',
  featherless: 'Featherless',
  parasail: 'Parasail',
  openwebui: 'OpenWebUI',
  lmstudio: 'LM Studio',
  friendli: 'Friendli',
  anyscale: 'Anyscale',
  infermatic: 'Infermatic',
  replit: 'Replit',
  // 国内推理/云平台扩展
  siliconcloud: '硅基流动',
  modelscope: '魔搭 ModelScope',
  ppio: 'PPIO 平行云',
  volcengine: '火山引擎',
  bailian: '阿里百炼',
  baai: '智源 BAAI',
  tii: 'TII Falcon',
  liquid: 'Liquid AI',
  ai2: 'Ai2 Allen',
  qwen: '通义千问',
  zhipu: '智谱',
  moonshot: '月之暗面',
  doubao: '豆包',
  stepfun: '阶跃星辰',
  hunyuan: '腾讯混元',
  wenxin: '百度文心',
  minimax: 'MiniMax',
  baichuan: '百川',
  spark: '讯飞星火',
  yi: '零一万物',
  sensenova: '商汤',
  skywork: '天工',
  internlm: '书生 InternLM',
  // 2026-07 新增国内新势力厂商
  ornith: 'Ornith',
  codebrain: 'CodeBrain',
  mai: 'MAI',
  other: '其他',
}
