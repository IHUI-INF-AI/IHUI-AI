// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Model } from '../../types'

export const FALLBACK_MODELS_PART_6: Model[] = [
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
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
