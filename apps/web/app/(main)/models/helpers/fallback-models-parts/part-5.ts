// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Model } from '../../types'

export const FALLBACK_MODELS_PART_5: Model[] = [
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
]
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
