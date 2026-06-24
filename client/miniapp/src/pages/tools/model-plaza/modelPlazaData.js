/**
 * 模型广场静态数据：厂商列表 + 模型列表（OpenAI 来自 openai-models-generated.js）
 */
import { OPENAI_MODELS } from './openai-models-generated.js';

/** 厂商列表 */
export const PROVIDERS = [
  {
    id: 'OpenAI',
    name: 'OpenAI',
    icon: '/static/images/back.svg',
    total: OPENAI_MODELS.length,
    desc: 'OpenAI 官方模型，包含 GPT-4o、o 系列、DALL·E、TTS 等'
  }
];

/** 模型列表（与 PROVIDERS 对应，当前仅 OpenAI） */
export const MODEL_LIST = [...OPENAI_MODELS];
